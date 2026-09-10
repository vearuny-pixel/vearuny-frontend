/* Run in the disposable Playwright workspace. All customer/order POSTs are intercepted.
 * MODE=preview verifies hosted assets; default serves the local site at the preview origin.
 * GET catalogs and POST checkout/quote are read-only production requests.
 */
const {chromium,firefox,webkit}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const ROOT=process.env.FRONTEND_ROOT||'/repo',OUT=process.env.ACCEPTANCE_OUT||'/work';
const ORIGIN='https://vearuny--phase5g-acceptance-20260910-gsof5not.web.app';
const widths=[320,360,375,390,412,430,768,1024];
const catalog={},quotes=new Map(),report={mode:process.env.MODE||'local',cases:[],screenshots:[],productionOrderPosts:0,errors:[]};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.ttf':'font/ttf'};
async function main(){
 for(const key of ['plans','packages','addons']){const r=await fetch('https://api.vearuny.com/api/'+key);assert.equal(r.status,200);catalog[key]=(await r.json())[key];}
 const engines=process.env.FOCUSED ? [[chromium,'chromium',[320,390]]] : [[chromium,'chromium',widths],[firefox,'firefox',[390,768]],[webkit,'webkit',[390,768]]];
 for(const [engine,name,engineWidths] of engines){
 const browser=await engine.launch({headless:true});
 for(const width of engineWidths)for(const lang of ['en','kh']){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1});
  const page=await context.newPage();let serial=0,quoteFailure=false,slowQuote=false,slowImages=false;const calls=[],keys=[];
  page.on('pageerror',e=>report.errors.push({name,width,lang,error:e.message}));
  await context.route('https://api.vearuny.com/**',async route=>{
   const request=route.request(),url=new URL(request.url()),body=request.postDataJSON();calls.push({path:url.pathname,method:request.method()});
   const send=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   const key=url.pathname.split('/').pop();
   if(request.method()==='GET'&&catalog[key])return send({status:'OK',[key]:catalog[key]});
   if(url.pathname==='/api/checkout/quote'){
    if(slowQuote)await new Promise(r=>setTimeout(r,600));
    if(quoteFailure)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({status:'ERROR',message:'simulated offline'})});
    const signature=JSON.stringify([body.meal_plan_id,body.items,body.subscriber_type,body.fulfillment_method]);
    if(!quotes.has(signature)){
     const result=await fetch('https://api.vearuny.com/api/checkout/quote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
     assert.equal(result.status,200,await result.clone().text());quotes.set(signature,await result.json());
    }
    return send(quotes.get(signature));
   }
   if(url.pathname==='/api/customers'&&request.method()==='POST')return send({status:'OK',customer:{id:777}});
   if(url.pathname==='/api/orders'&&request.method()==='POST'){
    keys.push(request.headers()['idempotency-key']);const signature=JSON.stringify([body.meal_plan_id,body.items,body.subscriber_type,body.fulfillment_method]);
    assert.ok(quotes.has(signature),'order must follow matching authoritative quote');const q=quotes.get(signature).quote;
    await new Promise(r=>setTimeout(r,120));
    return send({status:'OK',order:{...body,...q,order_code:`PREVIEW-TEST-${++serial}`,payment_status:'unpaid'},customer:{name:lang==='kh'?'អតិថិជនសាកល្បង':'Preview Test Customer',phone:'000000000'},plan:{code:q.plan_code},items:q.items});
   }
   report.errors.push({unexpectedAPI:url.pathname});await route.abort();
  });
  await context.route(ORIGIN+'/**',async route=>{
   const url=new URL(route.request().url());
   if(slowImages&&url.pathname.includes('/menus/'))await new Promise(r=>setTimeout(r,2000));
   if(process.env.MODE==='preview')return route.continue();
   const relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname),file=path.resolve(ROOT,'site','.'+relative);
   if(!file.startsWith(path.resolve(ROOT,'site')+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   await route.fulfill({status:200,contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  slowImages=true;const started=Date.now();await page.goto(ORIGIN,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.getElementById('generate-ticket-btn').disabled);const usableMs=Date.now()-started;
  await page.evaluate(lang=>setLanguage(lang),lang);await page.waitForTimeout(50);
  const controlsUsable=await page.locator('#customer_name').isEnabled();assert.ok(controlsUsable);
  slowImages=false;
  const beforeSwitch=calls.length;await page.evaluate(lang=>{setLanguage(lang==='en'?'kh':'en');setLanguage(lang)},lang);await page.waitForTimeout(350);
  assert.equal(calls.length,beforeSwitch,'language switches must not fetch quotes/catalogs');
  for(const plan of ['weekly','monthly'])for(const code of 'ABCDEF'){
   const returning='BDF'.includes(code),addons='ACE'.includes(code),quantity=code==='F'?3:2,method='AD'.includes(code)?'delivery':'pickup';
   await page.evaluate(({plan,code,returning,addons,quantity,method})=>{
    const set=(id,value)=>document.getElementById(id).value=value;
    set('plan_type',plan);set('package',code);set('quantity',quantity);set('subscriber_type',returning?'old':'new');set('subscription_number',returning?'SYNTHETIC-OLD':'');
    document.querySelector(`input[name=method][value=${method}]`).checked=true;
    selectedAddons.clear();for(let i=0;i<quantity;i++)selectedAddons.set(i,new Set(addons?[catalog.addons[0].id,catalog.addons[3].id]:[]));
    handleQuantityChange();syncFocusJuiceFromPackage();toggleMethodFields();handleSubscriberTypeChange();updatePriceSummary();
   },{plan,code,returning,addons,quantity,method});
   await page.waitForFunction(()=>!quoteLoading&&!!latestQuote&&!quoteError);
   const values=await page.evaluate(()=>({base:document.getElementById('summary-package-cost').textContent,addons:document.getElementById('summary-addon-cost').textContent,discount:document.getElementById('summary-discount').textContent,delivery:document.getElementById('summary-delivery-cost').textContent,total:document.getElementById('summary-total-cost').textContent,quote:latestQuote,overflow:document.documentElement.scrollWidth>innerWidth}));
   for(const [display,field] of [['base','base_amount'],['addons','addon_total'],['discount','discount_amount'],['delivery','delivery_fee'],['total','total_amount']])assert.ok(values[display].includes('$'+Number(values.quote[field]).toFixed(2)),`${name}/${width}/${lang}/${plan}/${code}/${field}`);
   assert.equal(values.overflow,false,`form overflow ${width}`);
   report.cases.push({engine:name,width,lang,plan,code,subscriber:returning?'old':'new',addons,quantity,method,quote:values.quote.total_amount,passed:true});
  }
  // Safe failures and recovery; no order is sent on an invalid quote.
  quoteFailure=true;await page.evaluate(()=>{document.getElementById('subscriber_type').value='new';updatePriceSummary()});await page.waitForFunction(()=>quoteError);
  assert.ok((await page.locator('#quote-state').textContent()).length>10);assert.equal(await page.locator('#summary-total-cost').textContent(),'—');assert.ok(await page.locator('#generate-ticket-btn').isDisabled());
  quoteFailure=false;slowQuote=true;await page.locator('#quote-retry-btn').click();await page.waitForFunction(()=>!!latestQuote&&!quoteLoading&&!quoteError);slowQuote=false;
  // Mixed packages and per-set add-ons, with long delivery details in English.
  await page.evaluate(lang=>{
   document.getElementById('quantity').value=2;document.getElementById('package').value='B';document.getElementById('diff_packages_check').checked=true;handleQuantityChange();
   document.querySelector('.additional-pkg-select').value='F';selectedAddons.clear();selectedAddons.set(0,new Set([catalog.addons[0].id]));selectedAddons.set(1,new Set([catalog.addons[3].id]));
   document.querySelector(`input[name=method][value=${lang==='en'?'delivery':'pickup'}]`).checked=true;toggleMethodFields();
   const district=document.getElementById('district');district.selectedIndex=1;updateCommuneOptions(district.value);document.getElementById('commune').selectedIndex=1;
   updatePriceSummary();
  },lang);
  await page.waitForFunction(()=>!quoteLoading&&!!latestQuote&&!quoteError);
  await page.evaluate(()=>{document.getElementById('customer_name').value='Preview Test Customer';document.getElementById('phone').value='000000000';document.getElementById('remark').value='Synthetic preview acceptance only. '.repeat(18);document.getElementById('nutrition_notes').value='Synthetic notes. '.repeat(18);document.getElementById('address').value='Synthetic long address. '.repeat(18);});
  await page.locator('#generate-ticket-btn').click();await page.evaluate(()=>document.getElementById('meal-order-form').requestSubmit());
  await page.waitForSelector('#ticket-modal:not(.hidden)');assert.equal(keys.length,1,'double submit must not create a second order');
  assert.ok(!(await page.locator('.receipt-more').getAttribute('open')));assert.ok((await page.locator('.ticket-total').textContent()).includes(await page.locator('#summary-total-cost').textContent()));
  await page.evaluate(lang=>setLanguage(lang==='en'?'kh':'en'),lang);await page.evaluate(lang=>setLanguage(lang),lang);
  await page.addScriptTag({path:require.resolve('jsqr/dist/jsQR.js')});
  const renderedQrs=[];
  for(const currency of ['usd','khr']){
   await page.locator(`[data-currency=${currency}]`).click();assert.ok(await page.locator('#qrcode-'+currency).isVisible());assert.ok(!(await page.locator('#qrcode-'+(currency==='usd'?'khr':'usd')).isVisible()));
   const expected=currency==='usd'?'https://link.payway.com.kh/Ji386167m':'https://link.payway.com.kh/ra386168n';
   assert.equal(await page.locator('#payway-link').getAttribute('href'),expected);
   await page.waitForTimeout(180);
   const png=await page.locator('#qrcode-'+currency).screenshot();
   const decoded=await page.evaluate(async base64=>{const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);const data=x.getImageData(0,0,c.width,c.height);return jsQR(data.data,c.width,c.height)?.data},png.toString('base64'));
   assert.equal(decoded,expected,'rendered payment QR must decode at this width');renderedQrs.push({currency,decoded});
  }
  const qr=await page.evaluate(()=>['usd','khr'].map(currency=>{const container=document.getElementById('qrcode-'+currency),canvas=container.querySelector('canvas');const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);const decoded=jsQR(data.data,data.width,data.height);return {currency,source:[canvas.width,canvas.height],rendered:container.querySelector('img')?.getBoundingClientRect().width,padding:getComputedStyle(container).padding,decoded:decoded?.data}}));
  assert.equal(qr[0].decoded,'https://link.payway.com.kh/Ji386167m');assert.equal(qr[1].decoded,'https://link.payway.com.kh/ra386168n');
  await page.locator('[data-currency=usd]').click();
  const modalOverflow=await page.locator('.ticket-modal-content').evaluate(el=>el.scrollWidth>el.clientWidth);assert.equal(modalOverflow,false,'ticket overflow');
  await page.locator('.receipt-more summary').click();assert.ok(await page.locator('.receipt-more').getAttribute('open')!==null);
  assert.ok((await page.locator('.receipt-more').textContent()).includes('Synthetic preview acceptance only.'));
  if(lang==='en')assert.ok((await page.locator('.receipt-more').textContent()).includes('Synthetic long address.'));
  await page.locator('.receipt-more summary').click();
  await page.locator('.ticket-modal-content').evaluate(el=>el.scrollTop=0);
  const shot=`phase5h-${name}-${width}-${lang}.png`;await page.screenshot({path:path.join(OUT,shot)});report.screenshots.push(shot);
  await page.locator('#close-ticket-modal-btn').click();assert.ok(await page.locator('#receipt-open-btn').isEnabled());await page.locator('#receipt-open-btn').click();assert.equal(keys.length,1);assert.ok((await page.locator('.receipt-header').textContent()).includes('PREVIEW-TEST-1'));
  await page.keyboard.press('Escape');assert.ok(await page.locator('#ticket-modal').isHidden());
  await page.locator('#new-order-btn').click();assert.equal(await page.locator('#quantity').inputValue(),'1');assert.equal(await page.locator('#customer_name').inputValue(),'');assert.equal(await page.locator('.addon-checkbox:checked').count(),0);
  await page.evaluate(()=>{document.querySelector('input[name=method][value=pickup]').checked=true;toggleMethodFields();document.getElementById('customer_name').value='Second Synthetic';document.getElementById('phone').value='000000000';});
  await page.waitForFunction(()=>!quoteLoading&&!!latestQuote);await page.locator('#generate-ticket-btn').click();await page.waitForSelector('#ticket-modal:not(.hidden)');assert.equal(keys.length,2);assert.notEqual(keys[0],keys[1]);
  const metrics={engine:name,width,lang,usableMs,controlsUsable,qr,renderedQrs,catalogRequests:calls.filter(x=>['/api/plans','/api/packages','/api/addons'].includes(x.path)).length,quoteRequests:calls.filter(x=>x.path.endsWith('/quote')).length,orderRequestsMocked:keys.length};
  (report.metrics??=[]).push(metrics);console.log(JSON.stringify(metrics));await context.close();
 }
 await browser.close();
 }
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.readOnlyQuoteVariants=quotes.size;
 fs.writeFileSync(path.join(OUT,'acceptance-'+report.mode+'.json'),JSON.stringify(report,null,2));console.log('PASSED '+report.cases.length+' commercial browser cases');
}
main().catch(error=>{console.error(error);fs.writeFileSync(path.join(OUT,'acceptance-failure.json'),JSON.stringify({...report,failure:error.stack},null,2));process.exit(1)});
