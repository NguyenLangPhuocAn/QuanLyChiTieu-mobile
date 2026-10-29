const path=require('node:path');
const local=require('./metro.local.cjs');
module.exports={...local,resolver:{...local.resolver,resolveRequest(context,name,platform){
  if(name.endsWith('/apiEndpoints'))return {type:'sourceFile',filePath:path.join(__dirname,'api.widget-loan.ts')};
  return local.resolver.resolveRequest(context,name,platform);
}}};
