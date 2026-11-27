// A single ordered input list and hash algorithm shared with the Python generator.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
export function heroPipelineHash(project){
 const paths=JSON.parse(readFileSync(join(project,'Tools','hero-pipeline-inputs.json'),'utf8'));
 if(!Array.isArray(paths)||!paths.length||new Set(paths).size!==paths.length)throw Error('Invalid hero pipeline inputs');
 const hash=createHash('sha256');
 for(const path of paths)hash.update(createHash('sha256').update(readFileSync(join(project,path))).digest());
 return hash.digest('hex');
}
