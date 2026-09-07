const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM,VirtualConsole}=require('jsdom');
const catalog=Object.assign({},...['plans','packages','addons'].map(k=>JSON.parse(fs.readFileSync(`evidence/integration-${k}.json`))));
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
async function page({failCatalog=false,failOrder=false,delayOrder=false,saved}={}) {
 const errors=[],calls=[];
 const dom=new JSDOM(fs.readFileSync('site/index.html','utf8'),{url:'http://localhost:4173',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole().on('error',(...args)=>errors.push(args.join(' ')))});
 await tick();const w=dom.window;
 w.eval=code=>vm.runInContext(code,dom.getInternalVMContext());
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.AbortController=AbortController;w.TextEncoder=TextEncoder;
 w.Image=class {set src(value){this.url=value;setTimeout(()=>this.onload?.(),0)}};
 let release;
 const gate=new Promise(r=>release=r);
 let failures=failOrder?1:0;
 const send=data=>({ok:true,status:200,json:async()=>data,headers:{get:()=>String(failOrder)}});
 w.fetch=async(url,options)=>{
  calls.push({url,options});const key=url.split('/').pop();
  if(['plans','packages','addons'].includes(key)){if(failCatalog)throw Error('offline');return send({status:'OK',[key]:catalog[key]})}
  if(key==='customers')return send({status:'OK',customer:{id:777}});
  if(key==='quote')return send({status:'OK',quote:{meal_plan_id:1,plan_code:'WEEKLY',currency:'USD',base_amount:'91.23',discount_amount:'7.89',discount_rule:'new_subscriber',discount_percentage:8,addon_total:'12.34',delivery_fee:'0.00',total_amount:'95.68',items:JSON.parse(options.body).items.map(i=>({package_id:i.package_id,package_code:'F',package_name:'High-Protein Salad',quantity:i.quantity,base_amount:'91.23',addon_amount:'12.34',total_amount:'95.68',addons:[{id:1,name:'x2 Egg',billable_meal_count:5,total_amount:'12.34'}]}))}});
  if(key==='orders'){
   if(delayOrder)await gate;
   if(failures-- >0)throw Error('lost response');
   const body=JSON.parse(options.body);
   return send({status:'OK',order:{...body,order_code:'VRN-DOM-777',base_amount:'91.23',discount_amount:'7.89',discount_rule:'new_subscriber',discount_percentage:8,addon_total:'12.34',delivery_fee:'0.00',total_amount:'95.68',currency:'USD',payment_status:'unpaid'},customer:{name:'<img src=x onerror=alert(1)>',phone:'TEST'},plan:{code:'MONTHLY'},items:body.items.map(i=>({...i,package_code:'F',base_amount:'91.23',addons:[{name:'x2 Egg',total_amount:'12.34'}]}))});
  }
  throw Error('Forbidden route '+url);
 };
 w.QRCode=function(node,options){node.dataset.qr=options.text};w.QRCode.CorrectLevel={H:1,L:1};
 if(saved)w.sessionStorage.setItem('vearuny.checkout.v1',saved);
 for(const file of ['lang-en.js','lang-kh.js','nutrition.js','js/nutrition-fallback.js','js/api.js','js/checkout.js'])w.eval(fs.readFileSync('site/'+file,'utf8'));
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));await tick();await new Promise(resolve=>setTimeout(resolve,320));
 const get=id=>w.document.getElementById(id);
 const change=(id,value)=>{get(id).value=value;get(id).dispatchEvent(new w.Event('change',{bubbles:true}))};
 const submit=()=>get('meal-order-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 const fill=()=>{change('customer_name','DISPOSABLE DOM');change('phone','TEST-DOM');change('subscriber_type','new');w.document.querySelector('[value="pickup"]').checked=true;w.eval('toggleMethodFields()');};
 return {dom,w,get,change,submit,fill,calls,errors,release};
}
test('actual HTML initializes Khmer catalog; English switch preserves delivery geography and nutrition/menu UI',async()=>{
 const p=await page();try{
 assert.deepEqual(p.errors,[]);assert.equal(p.get('generate-ticket-btn').disabled,false);assert.equal(p.w.document.documentElement.lang,'km');
 assert.equal(p.w.document.querySelectorAll('.addon-checkbox').length,4);assert.equal(p.get('discount-row').style.display,'flex');assert.match(p.get('summary-breakdown').textContent,/High-Protein Salad/);
 assert.equal(p.get('commune').parentElement.classList.contains('hidden'),false);assert.equal(p.get('district').required,true);assert.equal(p.get('summary-total-cost').textContent,'$95.68');
 const district=p.get('district').options[1].value;p.change('district',district);p.change('commune',p.get('commune').options[1].value);
 p.w.eval("setLanguage('en')");assert.equal(p.get('district').selectedIndex,1);assert.equal(p.get('commune').selectedIndex,1);assert.equal(p.w.document.documentElement.lang,'en');assert.match(p.get('package-buttons').textContent,/\$17.00/);
 await tick();p.w.eval('openNutritionModal()');assert.equal(p.get('nutrition-modal').classList.contains('hidden'),false);assert.ok(p.get('nutrition-content').textContent.length>100);assert.match(p.get('menu-image').src,/assets\/menus/);
 }finally{p.dom.window.close()}
});
test('DOM mixed sets, per-item add-ons, pending lock, double click, escaped authoritative receipt and QR',async()=>{
 const p=await page({delayOrder:true});try{
 p.fill();p.w.eval("setLanguage('en')");p.change('quantity','2');p.w.eval('handleQuantityChange()');p.get('diff_packages_check').checked=true;p.w.eval('handleDiffCheck()');
 const extra=p.w.document.querySelector('.additional-pkg-select');extra.value='F';extra.dispatchEvent(new p.w.Event('change'));
 p.w.document.querySelectorAll('.addon-checkbox')[0].click();await tick();p.w.document.querySelectorAll('.addon-checkbox')[7].click();
 p.change('nutrition_notes','NO REAL FOOD');p.submit();p.submit();await tick();assert.equal(p.get('generate-ticket-btn').disabled,true);assert.match(p.get('generate-ticket-btn').textContent,/Submitting/);assert.equal(p.get('customer_name').disabled,true);
 p.release();await tick();await tick();const orderCalls=p.calls.filter(c=>c.url.endsWith('/orders'));assert.equal(orderCalls.length,1);
 const order=JSON.parse(orderCalls[0].options.body);assert.equal(order.items.length,2);assert.deepEqual(order.items.map(i=>i.addons),[[{id:1}],[{id:4}]]);assert.equal(order.fulfillment_method,'pickup');assert.equal(order.district,null);
 assert.equal(p.get('ticket-modal').classList.contains('hidden'),false);assert.match(p.get('ticket-card').textContent,/95.68 USD/);assert.match(p.get('ticket-card').textContent,/VRN-DOM-777/);assert.equal(p.get('ticket-card').querySelector('[onerror]'),null);
 assert.equal(p.w.document.querySelectorAll('#qrcode-usd').length,1);assert.equal(p.get('qrcode-usd').dataset.qr,'https://link.payway.com.kh/Ji386167m');assert.match(p.get('order-qr-code').dataset.qr,/VRN-DOM-777/);
 p.w.eval("setLanguage('kh')");assert.match(p.get('ticket-card').textContent,/សរុប/);assert.match(p.get('ticket-card').textContent,/95.68 USD/);assert.equal(p.get('generate-ticket-btn').disabled,true);
 p.get('new-order-btn').click();await new Promise(resolve=>setTimeout(resolve,350));assert.equal(p.get('generate-ticket-btn').disabled,false);assert.equal(p.get('customer_name').disabled,false);
 assert.deepEqual(p.errors,[]);
 }finally{p.dom.window.close()}
});
test('DOM network failure enables retry; reload preserves key and frozen order despite empty form',async()=>{
 const p=await page({failOrder:true});let saved,first;
 try{p.fill();await new Promise(resolve=>setTimeout(resolve,350));p.submit();await tick();await tick();assert.equal(p.get('generate-ticket-btn').disabled,false);assert.equal(p.get('customer_name').disabled,true);saved=p.w.sessionStorage.getItem('vearuny.checkout.v1');first=p.calls.find(c=>c.url.endsWith('/orders'));assert.ok(first)}finally{p.dom.window.close()}
 const q=await page({saved});try{
 assert.equal(q.get('customer_name').value,'DISPOSABLE DOM');q.submit();await tick();await tick();const retry=q.calls.find(c=>c.url.endsWith('/orders'));assert.equal(retry.options.body,first.options.body);assert.equal(retry.options.headers['Idempotency-Key'],first.options.headers['Idempotency-Key']);assert.equal(q.calls.some(c=>c.url.endsWith('/customers')),false);assert.match(q.get('ticket-card').textContent,/VRN-DOM-777/);
 }finally{q.dom.window.close()}
});
test('DOM unavailable catalog fails closed and offers retry',async()=>{
 const p=await page({failCatalog:true});try{assert.equal(p.get('generate-ticket-btn').disabled,true);assert.equal(p.get('catalog-retry-btn').hidden,false);assert.ok(p.get('checkout-status').textContent.length>10);assert.equal(p.calls.some(c=>c.options.method==='POST'),false)}finally{p.dom.window.close()}
});
