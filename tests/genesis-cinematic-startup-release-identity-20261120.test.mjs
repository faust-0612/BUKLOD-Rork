import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const png=readFileSync(new URL('../assets/season2/genesis/genesis-green-b-transparent.png',import.meta.url));
function getCfg(values){
 const names=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','BUKLOD_APP_TARGET','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW'];
 const before=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 try {
  names.forEach(k=>delete process.env[k]);Object.assign(process.env,values);
  return require('../app.config.js')({config:{}});
 }finally{names.forEach(k=>{if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];});}
}
test('native Genesis staging release uses only transparent green B; production splash and identity never change',()=>{
 const qa=getCfg({APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true'});
 const prod=getCfg({APP_VARIANT:'production',EXPO_PUBLIC_APP_ENV:'production'});
 const stageOther=getCfg({APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging'});
 const splash=p=>p.plugins.find(x=>Array.isArray(x)&&x[0]==='expo-splash-screen')[1];
 const mark='./assets/season2/genesis/genesis-green-b-transparent.png';
 assert.equal(qa.android.package,'org.mzbministry.buklod.staging');
 assert.equal(qa.runtimeVersion,'2.0.0-genesis-preview');
 assert.equal(qa.icon,mark);
 assert.equal(qa.android.adaptiveIcon.foregroundImage,mark);
 assert.equal(qa.android.adaptiveIcon.backgroundColor,'#050A19');
 assert.equal(splash(qa).image,mark);
 assert.equal(splash(qa).dark.image,mark);
 assert.equal(splash(qa).backgroundColor,'#050A19');
 assert.equal(prod.android.package,'org.mzbministry.buklod');
 assert.equal(prod.runtimeVersion,'1.3.2');
 assert.equal(splash(prod).image,'./assets/release/splash-icon.png');
 assert.equal(stageOther.icon,'./assets/release/buklod-main-canonical.png');
 assert.equal(splash(stageOther).image,'./assets/release/splash-icon.png');
});
test('exact canonical green B PNG has real alpha, no opaque square or BUKLOD text',()=>{
 assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 assert.equal(width,384);assert.equal(height,384);
 assert.equal(png[25],6,'Truecolor RGBA PNG with alpha');
 let offset=8;const idat=[];
 while(offset<png.length){
  const len=png.readUInt32BE(offset),kind=png.toString('ascii',offset+4,offset+8);
  if(kind==='IDAT')idat.push(png.subarray(offset+8,offset+8+len));
  offset+=len+12;if(kind==='IEND')break;
 }
 const raw=inflateSync(Buffer.concat(idat));
 const stride=width*4+1;
 assert.equal(raw.length,stride*height);
 let visible=0,transparent=0,top=height,bottom=0,green=0;
 for(let y=0;y<height;y++){
  assert.equal(raw[y*stride],0,'PNG scanlines use deterministic filter 0');
  for(let x=0;x<width;x++){
   const o=y*stride+1+x*4,alpha=raw[o+3];
   if(alpha===0){transparent++;continue;}
   visible++;top=Math.min(top,y);bottom=Math.max(bottom,y);
   if(raw[o+1]>raw[o]&&raw[o+1]>raw[o+2])green++;
  }
 }
 assert.ok(visible>45000&&visible<100000,'Original B cutout detected');
 assert.ok(transparent>40000,'Transparent canvas required');
 assert.ok(green/visible>.98,'No cream letterbox survives');
 assert.ok(top>10&&bottom<height-10,'Centered logo without lower wordmark');
});
test('Genesis preview alone mounts real cinematic; production retains preexisting startup and chrome safeguards',()=>{
 const intro=src('src/components/BuklodMainBrandIntro.tsx');
 const scene=src('src/features/season2/genesis/GenesisCinematicStartup.tsx');
 const cfg=src('app.config.js');
 assert.match(intro,/isGenesisPreviewBuild\(\)/);
 assert.match(intro,/SplashScreen\.preventAutoHideAsync/);
 assert.match(intro,/<GenesisCinematicStartup>\{children\}<\/GenesisCinematicStartup>/);
 assert.match(intro,/return <LegacyBrandIntro>\{children\}<\/LegacyBrandIntro>/);
 assert.match(scene,/genesis-green-b-transparent\.png/);
 assert.match(scene,/<CreationUniverse\/>/);
 assert.match(scene,/<FirstLightBurst phase=\{reveal\}\/>/);
 assert.match(scene,/markBuklodStartupChromeReady/);
 assert.match(scene,/subscribeBuklodStartupChromeReady/);
 assert.match(scene,/isReduceMotionEnabled/);
 assert.match(scene,/useNativeDriver: true/);
 assert.match(scene,/SplashScreen\.hideAsync/);
 assert.match(scene,/no remote assets|No remote assets/);
 assert.match(cfg,/genesisNativePreview \? '\.\/assets\/season2\/genesis\/genesis-green-b-transparent.png'/);
 assert.doesNotMatch(scene,/supabase|awardPoints|\.rpc\(|supabase\.from\(|useRorkGameAmbience|expo-audio/);
});
