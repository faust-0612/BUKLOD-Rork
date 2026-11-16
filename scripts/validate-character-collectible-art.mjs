#!/usr/bin/env node
/* Validate the forthcoming 1,300 character story images before publishing.
 * This checks a manifest; it never uploads files or awards a collectible.
 * Format: {version:1,items:[{key,path,sha256,width,height}]}.
 */
import { readFileSync } from 'node:fs';

export const CHARACTER_IDS = Object.freeze([
 'phan','quin','van','christian','lhen','ace','ellusur',
 'jawo','mitch','niel','angel','vhen','trudice',
]);
export function expectedEntries(){
 const entries=[];
 for(const id of CHARACTER_IDS)for(let level=1;level<=20;level++)
  for(let index=1;index<=5;index++){
   const pad=n=>String(n).padStart(2,'0');
   entries.push({key:id+':L'+pad(level)+':I'+pad(index),
    path:'character-collectibles/'+id+'/l'+pad(level)+'-i'+pad(index)+'.webp'});
  }
 return entries;
}
export function validateArtManifest(input) {
 if(!input||input.version!==1||!Array.isArray(input.items))
  throw new Error('Expected image manifest version 1 with items array');
 const expected=expectedEntries();
 if(input.items.length!==expected.length)
  throw new Error('Expected 1300 images; got '+input.items.length);
 const wanted=new Map(expected.map(item=>[item.key,item.path])),seen=new Set(),paths=new Set();
 for(const image of input.items){
  const key=String(image?.key??''),path=String(image?.path??'');
  if(!wanted.has(key)||wanted.get(key)!==path)throw new Error('Unknown or invalid image slot: '+key);
  if(seen.has(key)||paths.has(path))throw new Error('Duplicate image slot or storage path: '+key);
  if(typeof image.sha256!=='string'|| !/^[0-9a-f]{64}$/i.test(image.sha256))
   throw new Error('Missing verified SHA-256: '+key);
  if(!Number.isInteger(image.width)||!Number.isInteger(image.height)||
    image.width<160||image.height<160||image.width>4096||image.height>4096)
   throw new Error('Invalid image dimensions: '+key);
  seen.add(key);paths.add(path);
 }
 return {valid:true,total:seen.size,characters:CHARACTER_IDS.length};
}
if(process.argv[1]&&process.argv[1].endsWith('validate-character-collectible-art.mjs')){
 try{
  if(!process.argv[2])throw new Error('Usage: node scripts/validate-character-collectible-art.mjs FILE.json');
  const result=validateArtManifest(JSON.parse(readFileSync(process.argv[2],'utf8')));
  process.stdout.write(JSON.stringify(result)+'\n');
 }catch(err){process.stderr.write(String(err instanceof Error?err.message:err)+'\n');process.exitCode=1;}
}
