// Offline Git-blob integrity check. No download or Unity execution.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=[];
for(const name of ['THIRD_PARTY_ASSET_LOCK.json','AUTHORED_INTERACTION_ASSETS.json','AUTHORED_COMBAT_AUDIO.json']){
 const doc=JSON.parse(readFileSync(resolve(root,'Tools',name),'utf8'));
 files.push(...(doc.seedFiles||doc.files).map(x=>({path:x.destination||x.path,sha:x.sha})));
}
const seen=new Set();
for(const row of files){
 if(typeof row.path!=='string'||!row.path.startsWith('Assets/ThirdParty/')||!(/^[a-f0-9]{40}$/).test(row.sha)||seen.has(row.path))throw Error('Invalid asset identity '+row.path);
 seen.add(row.path);
 const target=resolve(root,row.path);
 if(!target.startsWith(resolve(root,'Assets/ThirdParty')+sep))throw Error('Invalid asset path');
 const data=readFileSync(target);
 const sha=createHash('sha1').update('blob '+data.length+'\0').update(data).digest('hex');
 if(sha!==row.sha)throw Error('Asset hash mismatch '+row.path);
}
console.log('Verified authored review asset files: '+seen.size);
