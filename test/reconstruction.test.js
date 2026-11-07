const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const code=read('recovered/index.html').match(/<script>\s*(\/\/ --- CONSTANTS ---[\s\S]*?)<\/script>/)[1];
const constants=code.slice(0,code.indexOf('const styleChoiceButtons'));
function model(selected=[],packages=['A'],date='2026-09-07T05:00:00Z') {
  class FixedDate extends Date { constructor(...args){ super(...(args.length?args:[date])); } }
  const document={getElementById:id=>id==='package'?{value:packages[0]}:id==='diff_packages_check'?{checked:packages.length>1}:null,querySelectorAll:selector=>selector==='.addon-checkbox:checked'?selected.map(value=>({value})):packages.slice(1).map(value=>({value}))};
  return vm.runInNewContext(constants+';({PRICING,ADD_ONS,FOCUS_JUICE_TO_PACKAGE,getAddOnCost,getSubscriptionDiscount})',{window:{},document,Date:FixedDate,Intl});
}
test('every recovered asset matches recorded public-source SHA-256',()=>{
  const assets=JSON.parse(read('evidence/assets.json'));
  assert.equal(assets.length,28);
  for(const a of assets){assert.equal(a.error,undefined);assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,a.path))).digest('hex'),a.sha256);}
});
test('package catalog comparison identifies exactly eleven mismatches',()=>{
  const m=model();const catalog=JSON.parse(read('evidence/phase5b-packages.json')).packages;
  const mismatch=catalog.filter(p=>m.PRICING[p.plan_code.toLowerCase()][p.package_code]!==Number(p.price));
  assert.equal(mismatch.length,11);
  assert.equal(catalog.find(p=>!mismatch.includes(p)).package_code,'A');
});
test('deployed add-on charges vary by package family and meal days',()=>{
  for(const [addon,weeklyA,weeklyD] of [['x2 Egg',5,5],['x2 Meat',5,5],['x2 Chicken',2,3],['x2 Seafood',2,1]]) {
    assert.equal(model([addon],['A']).getAddOnCost('weekly',1),weeklyA);
    assert.equal(model([addon],['D']).getAddOnCost('weekly',1),weeklyD);
    assert.equal(model([addon],['A','D']).getAddOnCost('monthly',2),(weeklyA+weeklyD)*4);
  }
});
test('Friday promotion supersedes subscriber discounts and excludes add-ons',()=>{
  assert.equal(model().getSubscriptionDiscount(100,'new','').amount,8);
  assert.equal(model().getSubscriptionDiscount(100,'old','previous').amount,5);
  assert.equal(model().getSubscriptionDiscount(100,'old','').amount,0);
  assert.equal(model([],['A'],'2026-09-11T05:00:00Z').getSubscriptionDiscount(100,'new','').amount,10);
});
test('English and Khmer delivery translations remain aligned without pickup options',()=>{
  const context={window:{}};
  for(const lang of ['en','kh'])vm.runInNewContext(read('site/lang-'+lang+'.js'),context);
  assert.equal(context.window.translations.en.method_delivery,'Delivery');
  assert.equal(context.window.translations.kh.method_delivery,'ដឹកជញ្ជូន');
  assert.equal(context.window.translations.en.method_pickup,undefined);
  assert.equal(context.window.translations.kh.method_pickup,undefined);
  assert.equal(Object.keys(context.window.translations.en).length,Object.keys(context.window.translations.kh).length);
});
test('maintained HTML script/style/image dependencies are local and present',()=>{
  const html=read('site/index.html');
  const tags=[...html.matchAll(/<(script|img|link)\b[^>]*>/g)];
  for(const [tag] of tags){
    const match=tag.match(/(?:src|href)="([^"]+)"/);if(!match)continue;
    const value=match[1];assert.ok(!value.startsWith('http'),value);
    assert.ok(fs.existsSync(path.join(root,'site',value.split('?')[0])),value);
  }
  assert.ok(!html.includes('googletagmanager.com'));
  assert.ok(!html.includes('connect.facebook.net'));
});
