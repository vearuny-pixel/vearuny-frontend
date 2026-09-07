/* Explicitly opt-in live disposable testing. Never run as part of npm test. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {createClient,buildPayload}=require('../site/js/api.js');
if(process.env.DISPOSABLE_API_TEST!=='1')throw Error('Set DISPOSABLE_API_TEST=1 to create disposable unpaid test records.');
const stateDir=process.env.SMOKE_STATE_DIR;
if(!stateDir)throw Error('SMOKE_STATE_DIR is required to preserve retry identities across script failures.');
fs.mkdirSync(stateDir,{recursive:true,mode:0o700});
function storage(name){const file=`${stateDir}/${name}.json`;return {getItem:()=>fs.existsSync(file)?fs.readFileSync(file,'utf8'):null,setItem:(_k,v)=>fs.writeFileSync(file,v,{mode:0o600}),removeItem:()=>fs.unlinkSync(file)}}
(async()=>{
 const api=createClient();const catalog=await api.catalog();
 const results={timestamp:new Date().toISOString(),backend:'748131b60bb1ae63256b02dd06bef6be56ef30f4',catalog:{plans:catalog.plans.length,packages:catalog.packages.length,addons:catalog.addons.length},orders:[],checks:[]};
 const origin='http://127.0.0.1:4173';
 const cors=await fetch('https://api.vearuny.com/api/orders',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,idempotency-key'}});
 assert.equal(cors.status,204);assert.equal(cors.headers.get('access-control-allow-origin'),'*');assert.match(cors.headers.get('access-control-allow-headers'),/idempotency-key/i);results.checks.push('Public order CORS preflight allows Idempotency-Key');
 for(const scenario of ['weekly-mixed-pickup','monthly-delivery']) {
  const client=createClient({storage:storage(scenario)});
  const monthly=scenario.startsWith('monthly');
  const marker='PHASE5B-'+crypto.randomUUID();
  const form={plan_type:monthly?'monthly':'weekly',quantity:'2',customer_name:'DISPOSABLE PHASE5B TEST — DO NOT FULFILL',phone:marker,method:monthly?'delivery':'pickup',district:'TEST ONLY',commune:'TEST ONLY',address:'DISPOSABLE TEST — DO NOT DELIVER',time_slot:'TEST ONLY',pickup_time:'TEST ONLY',start_date:'2099-01-01',subscriber_type:monthly?'old':'new',subscription_number:monthly?'DISPOSABLE-TEST-ONLY':'',remark:'DISPOSABLE API INTEGRATION TEST. DO NOT FULFILL. DO NOT CONTACT. NO PAYMENT.',nutrition_notes:'DISPOSABLE TEST — DO NOT PREPARE FOOD'};
  const ids=catalog.addons.map(a=>a.id);
  const sets=monthly?[{code:'F',addons:ids},{code:'F',addons:ids}]:[{code:'A',addons:[ids[0],ids[2]]},{code:'F',addons:[ids[1],ids[3]]}];
  const payload=buildPayload(catalog,form,sets,monthly?'KH':'EN');
  const receipt=await client.checkout(payload.customer,payload.order);
  assert.equal(receipt.order.payment_status,'unpaid');assert.equal(receipt.order.order_status,'pending');assert.equal(receipt.order.quantity,2);assert.equal(receipt.items.length,monthly?1:2);
  const replay=await client.request('/api/orders',client.attempt.order,client.attempt.key);
  assert.equal(replay.replayed,true);assert.equal(replay.data.order.order_code,receipt.order.order_code);assert.equal(replay.data.order.total_amount,receipt.order.total_amount);
  await assert.rejects(client.request('/api/orders',{...client.attempt.order,customer_remarks:'DIFFERENT DISPOSABLE TEST PAYLOAD'},client.attempt.key),e=>e.status===409);
  results.orders.push({scenario,customer_id:receipt.customer.id,order_id:receipt.order.id,order_code:receipt.order.order_code,base_amount:receipt.order.base_amount,discount_amount:receipt.order.discount_amount,discount_rule:receipt.order.discount_rule,addon_total:receipt.order.addon_total,total_amount:receipt.order.total_amount,payment_status:receipt.order.payment_status,replay_verified:true,conflicting_key_rejected:true});
  for(const [name,change] of [['delivery validation',{fulfillment_method:'delivery',district:null}],['invalid package',{items:[{package_id:2147483647,quantity:1}]}],['invalid add-on',{items:[{package_id:client.attempt.order.items[0].package_id,quantity:1,addons:[{id:2147483647}]}]}]]){
   await assert.rejects(client.request('/api/orders',{...client.attempt.order,...change},crypto.randomUUID()),e=>e.status===400);
   results.checks.push(`${scenario}: ${name} rejected`);
  }
  fs.writeFileSync('evidence/integration-smoke.json',JSON.stringify(results,null,2)+'\n');
 }
 console.log(JSON.stringify(results,null,2));
})().catch(error=>{console.error(error.message);process.exitCode=1});
