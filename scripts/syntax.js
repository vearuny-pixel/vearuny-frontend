const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
let count=0;
function check(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){if(entry.name!=='vendor')check(file)}else if(file.endsWith('.js')){new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});count++}}}
check('site');check('scripts');check('test');console.log(`${count} maintained JavaScript files passed syntax checks`);
