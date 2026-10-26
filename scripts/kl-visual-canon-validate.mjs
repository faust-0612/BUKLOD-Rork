#!/usr/bin/env node
// KL Visual Canon Guard: fail-closed manifest validation. Node built-ins only.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const manifestPath=process.argv[2]||'docs/kabihasnang-ligaw-visual-reference-candidates-v1.json';
const release=process.argv.includes('--release');
const errors=[];
const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
const m=read(manifestPath);
const fail=(msg)=>errors.push(msg);
const root=process.cwd();
const isSafe=(p)=>typeof p==='string'&&p.length>0&&!path.isAbsolute(p)&&!p.split(/[\\/]/).includes('..');
const hash=(p)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(m.rules?.series!==12||m.rules?.chaptersPerSeries!==30||m.rules?.minImagesPerChapter!==2||m.rules?.maxImagesPerChapter!==3)fail('Locked 12x30 / 2-3 image contract changed');
const ids=['phan','quin','van','christian','lhen'];
for(const id of ids){
 const c=m.characters?.find(x=>x.id===id);
 if(!c){fail('Missing core character '+id);continue;}
 if(!isSafe(c.path)){fail('Unsafe asset path for '+id);continue;}
 const p=path.resolve(root,c.path);
 if(!fs.existsSync(p)){fail('Missing binary '+c.path);continue;}
 const sha=hash(p);
 if(c.sha256&&c.sha256!==sha)fail('SHA256 mismatch '+id);
 if(release&&(!c.approvedForStory||!c.sha256))fail('Unapproved/unpinned character '+id);
}
if(release){
 if(!Array.isArray(m.settings)||m.settings.length===0)fail('No approved setting library');
 if(!Array.isArray(m.covers)||m.covers.length!==12)fail('12 approved series covers required');
 for(const s of m.settings||[])if(!s.ownerApprovalId||!s.sha256||!isSafe(s.path)||!fs.existsSync(s.path)||hash(s.path)!==s.sha256)fail('Setting approval/hash failed '+s.id);
 for(const c of m.covers||[])if(!c.ownerApprovalId||!c.sha256||!isSafe(c.path)||!fs.existsSync(c.path)||hash(c.path)!==c.sha256)fail('Cover approval/hash failed '+c.series);
 const chapters=m.chapters||[];
 if(chapters.length!==360)fail('Expected 360 approved chapter records');
 const keys=new Set();
 for(const ch of chapters){
  const key=ch.series+':'+ch.chapter;
  if(keys.has(key))fail('Duplicate chapter '+key);keys.add(key);
  if(!Number.isInteger(ch.series)||ch.series<1||ch.series>12||!Number.isInteger(ch.chapter)||ch.chapter<1||ch.chapter>30)fail('Invalid chapter index '+key);
  if(!Array.isArray(ch.images)||ch.images.length<2||ch.images.length>3)fail('Invalid image count '+key);
  for(const a of ch.images||[])if(!a.ownerApprovalId||!a.sceneId||!a.sha256||!isSafe(a.path)||!fs.existsSync(a.path)||hash(a.path)!==a.sha256)fail('Image approval/hash failed '+key);
 }
}
if(errors.length){console.error('KL VISUAL CANON: BLOCKED\n'+errors.map(x=>' - '+x).join('\n'));process.exitCode=1}
else console.log('KL VISUAL CANON: PASS ('+(release?'release':'inventory')+' mode)');
