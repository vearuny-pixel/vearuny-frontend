const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createClient,buildPayload,receiptLines,APIError,STORAGE_KEY}=require('../site/js/api.js');
const catalog=Object.assign({},...['plans','packages','addons'].map(k=>JSON.parse(fs.readFileSync(`evidence/integration-${k}.json`))));
const form={plan_type:'weekly',quantity:'1',method:'pickup',customer_name:'DISPOSABLE TEST',phone:'TEST-only',start_date:'2026-09-15',pickup_time:'10:00 AM',time_slot:'8:00 AM - 10:00 AM',subscriber_type:'none',remark:'TEST DO NOT FULFILL',nutrition_notes:'Test nutrition notes'};
const response=(rule='none',discount='0.00')=>({status:'OK',order:{order_code:'VRN-TEST-123',base_amount:'123.45',discount_amount:discount,discount_rule:rule,discount_percentage:rule==='friday'?10:rule==='new_subscriber'?8:rule==='returning_subscriber'?5:0,addon_total:'9.87',delivery_fee:'0.00',total_amount:'117.23',currency:'USD',fulfillment_method:'pickup',payment_status:'unpaid',nutrition_notes:'server nutrition'},items:[{package_code:'A',quantity:1,base_amount:'123.45',addons:[{name:'x2 Egg',total_amount:'9.87'}]}],customer:{id:123,name:'SERVER NAME',phone:'TEST'},plan:{code:'WEEKLY'}});
const reply=(data,status=200,replayed=false)=>({ok:status<400,status,json:async()=>data,headers:{get:()=>String(replayed)}});
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}};
test('loads three catalogs and refuses missing confirmed add-ons',async()=>{
 const calls=[]; const client=createClient({fetchImpl:async url=>{calls.push(url);const k=url.split('/').pop();return reply({status:'OK',[k]:catalog[k]})}});
 assert.equal((await client.catalog()).addons.length,4);assert.equal(calls.length,3);
 await assert.rejects(createClient({fetchImpl:async url=>reply({status:'OK',[url.split('/').pop()]:[]})}).catalog(),/catalog unavailable/);
});
test('quote client uses the public quote route and accepts only authoritative totals',async()=>{
 const calls=[]; const client=createClient({fetchImpl:async(url,options)=>{calls.push({url,options});return reply({status:'OK',quote:{base_amount:'80.00',discount_amount:'8.00',discount_rule:'new_subscriber',discount_percentage:8,addon_total:'10.00',delivery_fee:'0.00',total_amount:'82.00',currency:'USD',items:[]}})}});
 const quote=await client.quote({meal_plan_id:2,items:[{package_id:10,quantity:1,addons:[]}]});
 assert.equal(quote.total_amount,'82.00');assert.equal(calls[0].url,'https://api.vearuny.com/api/checkout/quote');assert.equal(calls[0].options.method,'POST');
 await assert.rejects(client.request('/api/payments/1/confirm',{}),/Unsupported public/);
});
for(const plan of ['weekly','monthly'])for(const code of 'ABCDEF')test(`${plan} ${code} resolves API IDs, price-free quantity and add-ons`,()=>{
 const result=buildPayload(catalog,{...form,plan_type:plan,quantity:'2'},[{code,addons:[1,2,3,4]},{code,addons:[1,2,3,4]}],'kh');
 const item=result.order.items[0];assert.equal(result.order.items.length,1);assert.equal(item.quantity,2);assert.equal(item.package_id,catalog.packages.find(p=>p.plan_code===plan.toUpperCase()&&p.package_code===code).id);assert.equal(item.addons.length,4);assert.equal(result.customer.language,'KH');assert.ok(!JSON.stringify(result).match(/price|discount|amount|billable/));
});
test('mixed sets retain per-item add-ons and metadata; delivery requires all locations; pickup omits them',()=>{
 const sets=[{code:'A',addons:[1]},{code:'F',addons:[4]}];
 const {order}=buildPayload(catalog,{...form,quantity:2,method:'delivery',district:'D',commune:'C',address:'A',subscriber_type:'old',subscription_number:'PREVIOUS'},sets,'en');
 assert.equal(order.items.length,2);assert.equal(order.items[1].menu_focus,'muscle');assert.equal(order.items[1].juice_option,'large');assert.deepEqual(order.items[1].addons,[{id:4}]);assert.equal(order.previous_subscription_number,'PREVIOUS');assert.equal(order.nutrition_notes,form.nutrition_notes);assert.equal(order.customer_remarks,form.remark);assert.equal(order.fulfillment_time,form.time_slot);
 for(const field of ['district','commune','address'])assert.throws(()=>buildPayload(catalog,{...form,method:'delivery',district:'D',commune:'C',address:'A',[field]:''},[sets[0]],'en'),/Delivery requires/);
 assert.equal(buildPayload(catalog,form,[sets[0]],'en').order.address,null);
 assert.throws(()=>buildPayload(catalog,{...form,quantity:101},sets,'en'),/Quantity/);
 assert.throws(()=>buildPayload(catalog,form,[{code:'A',addons:[999]}],'en'),/add-on/);
 assert.throws(()=>buildPayload(catalog,form,[{code:'Z',addons:[]}],'en'),/Unavailable package/);
});
for(const rule of ['friday','new_subscriber','returning_subscriber'])for(const lang of ['en','kh'])test(`${rule} ${lang} receipt shows server amounts without recalculation`,()=>{
 const lines=receiptLines(response(rule,'16.09'),lang).flat().join('\n');
 for(const value of ['VRN-TEST-123','123.45 USD','16.09 USD','9.87 USD','117.23 USD','SERVER NAME','server nutrition'])assert.ok(lines.includes(value));
 assert.ok(lines.includes(lang==='kh'?'សរុប':'Total'));
});
test('double click rejected; customer precedes order; completed attempt never posts again',async()=>{
 let unblock;const gate=new Promise(r=>unblock=r);const calls=[];
 const client=createClient({storage:memory(),uuid:()=> 'test-key-12345678',fetchImpl:async(url,options)=>{calls.push({url,options});if(url.endsWith('customers')){await gate;return reply({status:'OK',customer:{id:123}})}return reply(response());}});
 const payload=buildPayload(catalog,form,[{code:'A',addons:[]}],'en');const first=client.checkout(payload.customer,payload.order);
 assert.equal(client.pending,true);await assert.rejects(client.checkout(payload.customer,payload.order),/pending/);unblock();await first;
 assert.equal(calls.length,2);assert.equal(calls[1].options.headers['Idempotency-Key'],'test-key-12345678');assert.equal(JSON.parse(calls[1].options.body).customer_id,123);
 await client.checkout();assert.equal(calls.length,2);assert.equal(client.pending,false);
});
test('lost order response persists exact payload/key across reload and changed form retry',async()=>{
 const storage=memory();const sent=[];let fail=true;
 const fetchImpl=async(url,options)=>{if(url.endsWith('customers'))return reply({status:'OK',customer:{id:123}});sent.push(options);if(fail){fail=false;throw new TypeError('lost response')}return reply(response(),200,true)};
 const payload=buildPayload(catalog,form,[{code:'A',addons:[1]}],'en');let client=createClient({storage,fetchImpl,uuid:()=> 'original-key-12345678'});
 await assert.rejects(client.checkout(payload.customer,payload.order),/uncertain/);assert.throws(()=>client.reset(),/existing order/);
 client=createClient({storage,fetchImpl,uuid:()=>{throw Error('must not generate a new key')}});
 const result=await client.checkout({name:'CHANGED'},{items:[]});assert.equal(result.replayed,true);assert.equal(sent[0].body,sent[1].body);assert.equal(sent[0].headers['Idempotency-Key'],sent[1].headers['Idempotency-Key']);assert.ok(storage.getItem(STORAGE_KEY));
});
for(const status of [400,404,409,413,415,422,429,500,503])test(`HTTP ${status} error handling and recovery semantics`,async()=>{
 const client=createClient({storage:memory(),uuid:()=> 'test-errors-12345678',fetchImpl:async url=>url.endsWith('customers')?reply({status:'OK',customer:{id:123}}):reply({status:'ERROR',message:'API detail'},status)});
 await assert.rejects(client.checkout({name:'test'},{items:[]}),e=>e instanceof APIError && e.status===status && e.message==='API detail');assert.equal(client.pending,false);
 if([400,404,413,415,422].includes(status)){assert.equal(client.attempt.rejected,true);client.reset();assert.equal(client.attempt,null)}else assert.throws(()=>client.reset(),/existing order/);
});
test('timeout and malformed success retain retry key; storage failure prevents requests',async()=>{
 const client=createClient({storage:memory(),timeout:5,uuid:()=> 'timeout-test-12345678',fetchImpl:(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject({name:'AbortError'})))});
 await assert.rejects(client.checkout({},{}),/timeout/);assert.equal(client.attempt.key,'timeout-test-12345678');assert.equal(client.pending,false);
 let calls=0;const badStorage={getItem:()=>null,setItem:()=>{throw Error('storage full')}};
 await assert.rejects(createClient({storage:badStorage,uuid:()=> 'storage-key-12345678',fetchImpl:async()=>{calls++}}).checkout({},{}),/storage full/);assert.equal(calls,0);
 const bad=createClient({storage:memory(),uuid:()=> 'malformed-key-12345678',fetchImpl:async url=>reply(url.endsWith('customers')?{status:'OK',customer:{id:123}}:{status:'OK'})});
 await assert.rejects(bad.checkout({},{}),/Incomplete receipt/);assert.equal(bad.attempt.key,'malformed-key-12345678');
});

test('public client refuses protected or unexpected routes',async()=>{const client=createClient({fetchImpl:()=>{throw Error('must not call network')}});await assert.rejects(client.request('/api/orders/1'),/Unsupported public/);await assert.rejects(client.request('/api/payments/1/confirm',{}),/Unsupported public/);});
