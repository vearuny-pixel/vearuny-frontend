const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');

function readLanguage(file){
  const context={window:{}};
  vm.runInNewContext(readFileSync(file,'utf8'),context);
  return JSON.parse(JSON.stringify(context.window.DATA));
}

test('delivery locations remove only the requested entries and add Ta Khmao bilingually',()=>{
  const baseline=JSON.parse(readFileSync('test/fixtures/delivery-locations-origin-main.json','utf8'));
  const actual={en:readLanguage('site/lang-en.js').en,kh:readLanguage('site/lang-kh.js').kh};
  const expected=structuredClone(baseline);
  const removed={
    en:{'Chbar Ampov':['Preaek Pra','Kbal Kaoh'],'Chroy Changvar':['Kaoh Dach','Bak Khaeng','Preaek Ta Sek'],'Por Senchey':['Kamboul']},
    kh:{'ច្បារអំពៅ':['ព្រែកប្រា','ក្បាលកោះ'],'ជ្រោយចង្វារ':['កោះដាច់','បាក់ខែង','ព្រែកតាសេក'],'ពោធិ៍សែនជ័យ':['កំបូល']},
  };
  const taKhmau={
    en:{district:'Ta Khmao',communes:['Ta Kdol','Prek Ruessey','Doeum Mien','Ta Khmao','Prek Ho','Kampong Samnanh','Svay Rolum','Kaoh Anlong Chen','Settak Bou','Roka Khpuos']},
    kh:{district:'តាខ្មៅ',communes:['តាក្ដុល','ព្រែកឫស្សី','ដើមមៀន','តាខ្មៅ','ព្រែកហូរ','កំពង់សំណាញ់','ស្វាយរលំ','កោះអន្លង់ចិន','សិត្បូ','រកាខ្ពស់']},
  };
  for(const lang of ['en','kh']){
    for(const [district,values] of Object.entries(removed[lang]))
      expected[lang].communes[district]=expected[lang].communes[district].filter(value=>!values.includes(value));
    expected[lang].districts.push(taKhmau[lang].district);
    expected[lang].districts.sort();
    expected[lang].communes[taKhmau[lang].district]=[...taKhmau[lang].communes].sort();
  }
  assert.deepEqual(actual,expected);
});
