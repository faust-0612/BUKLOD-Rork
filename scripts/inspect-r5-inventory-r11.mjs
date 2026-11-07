#!/usr/bin/env node
/** BUKLOD R11: read-only R5 inventory schema discovery. No uploads, deletions, or original-file reads.
 * Inputs: --self-test | <R5-json-path> [output-json-path]
 * Reports only structural field names, counts, and sample field TYPES, never original paths/values.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const MAX=128*1024*1024, MAX_DEPTH=16, MAX_ARRAY_SAMPLE=16, MAX_NODES=200000;
const ok=(v,msg)=>{if(!v)throw Error(msg)};
const safeType=v=>v===null?'null':Array.isArray(v)?'array':typeof v;
const safeKey=(key)=>/^[a-zA-Z_][\w.\-]{0,70}$/.test(key)?key:'[redacted-key]';
const histogram=items=>{const m={};for(const v of items){let t=safeType(v);m[t]=(m[t]||0)+1;}return m};
export function inspect(data){
 const examined=new WeakSet();let nodes=0;const candidates=[],warnings=[];
 function walk(v,p,depth){
  if(++nodes>MAX_NODES){warnings.push('Node inspection limit reached');return;}
  if(depth>MAX_DEPTH){warnings.push('Depth inspection limit reached');return;}
  if(v===null||typeof v!=='object'||examined.has(v))return;
  examined.add(v);
  if(Array.isArray(v)){
   if(v.length){const sample=v.slice(0,MAX_ARRAY_SAMPLE);const obj=sample.find(x=>x&&typeof x==='object'&&!Array.isArray(x));
    if(obj){const keys=Object.keys(obj).slice(0,60);const types=Object.fromEntries(keys.map(k=>[safeKey(k),safeType(obj[k])]));
     const hints=keys.filter(k=>/path|file|hash|sha|size|byte|crc|source|relative|category|status|origin/i.test(k));
     if(hints.length>=1)candidates.push({location:p,arrayLength:v.length,sampled:sample.length,fieldTypes:types,inventoryLikelihood:hints.length>=2?'high':'medium'});
    }}
   for(let i=0;i<Math.min(v.length,MAX_ARRAY_SAMPLE);i++)walk(v[i],`${p}[*]`,depth+1);
  }else{
   const keys=Object.keys(v);
   for(const k of keys.slice(0,100))walk(v[k],`${p}.${safeKey(k)}`,depth+1);
   if(keys.length>100)warnings.push('Object has more than 100 fields');
  }
 }
 walk(data,'$',0);
 const rootKeys=data&&typeof data==='object'&&!Array.isArray(data)?Object.keys(data).map(safeKey).slice(0,100):[];
 return {schema:'buklod-r11-r5-inventory-structure/v1',status:'STRUCTURE_ONLY_NO_CLEARANCE',deleteClearance:false,rootType:safeType(data),rootKeys,candidates:candidates.slice(0,100),candidateCount:candidates.length,warnings:[...new Set(warnings)],limits:'No original files read, no path values or secrets returned, no upload, no mutation. R5 schema discovery is NOT recovery evidence.'};
}
function test(){
 const example={kind:'fixture',records:[{relativePath:'src/app.ts',sha256:'x'.repeat(64),bytes:200,secret:'DO_NOT_LEAK'},{relativePath:'src/foo.ts',sha256:'y'.repeat(64),bytes:30}]};
 const a=inspect(example);ok(a.candidates.length===1,'Missing candidate');ok(a.candidates[0].arrayLength===2,'Count mismatch');ok(!JSON.stringify(a).includes('DO_NOT_LEAK'),'Leaked sample values');ok(!JSON.stringify(a).includes('src/app.ts'),'Leaked path');ok(a.deleteClearance===false,'Unsafe clearance');
 const b=inspect({nodes:[{file:'private.key',size:12}]});ok(!JSON.stringify(b).includes('private.key'),'Leaked values in nested object');
 const c=inspect([]);ok(c.candidates.length===0,'Empty inventory');
 console.log('R11 SELF-TEST PASSED: 6 assertions, read-only, no clearance');
}
const argv=process.argv.slice(2);
if(argv.length===1&&argv[0]==='--self-test'){test();}
else if(argv.length===1||argv.length===2){
 try{
  const p=path.resolve(argv[0]), s=fs.lstatSync(p);
  ok(s.isFile()&&!s.isSymbolicLink(),'Input must be regular file');ok(s.size>0&&s.size<=MAX,'Input too large or empty');
  const result=inspect(JSON.parse(fs.readFileSync(p,'utf8')));
  const encoded=JSON.stringify(result,null,2)+'\n';
  if(argv.length===2){const output=path.resolve(argv[1]);ok(output!==p,'Cannot overwrite input');ok(!fs.existsSync(output),'Output already exists; refusing overwrite');
   fs.writeFileSync(output,encoded,{flag:'wx',mode:0o600});console.log(`R11 structural inspection written: ${output}`);
  }else console.log(encoded);
  process.exitCode=3;
 }catch(e){console.error('R11 input rejected: '+e.message);process.exitCode=2;}
}else {console.error('Usage: node inspect-r5-inventory-r11.mjs <R5.json> [NEW-report.json] | --self-test');process.exitCode=2;}
