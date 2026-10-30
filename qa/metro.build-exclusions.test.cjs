const {test}=require('node:test');
const assert=require('node:assert/strict');
const config=require('../metro.config');
const excluded=file=>config.resolver.blockList.some(regex=>regex.test(file));
test('excludes native temporary/build trees on Windows and POSIX',()=>{
 for(const file of ['C:\\project\\android\\app\\.cxx\\Debug\\CMakeTmp\\temp.dir','C:\\project\\android\\.gradle\\cache','/project/android/app/build/intermediates/test','/project/android/build/tmp'])assert.equal(excluded(file),true,file);
});
test('keeps native source and application JS available',()=>{
 for(const file of ['C:\\project\\android\\app\\src\\main\\java\\Main.kt','/project/src/screens/home/MoneyCalendarScreen.tsx','/project/node_modules/library/build/index.js'])assert.equal(excluded(file),false,file);
});
