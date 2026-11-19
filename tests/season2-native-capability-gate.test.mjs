import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectRelease,inspectSource} from '../scripts/season2-native-capability-gate.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
const source={sourceBlockers:['No approved original 13-character Rive rigs'],
  preview:{package:'org.mzbministry.buklod.staging',runtime:'2.0.0-genesis-preview',
    channel:'season2-genesis-preview'}};
const receipt={sourceSha:'a'.repeat(40),apkSourceSha:'a'.repeat(40),
  easBuildId:'123e4567-e89b-42d3-a456-426614174000',
  androidPackage:source.preview.package,runtimeVersion:source.preview.runtime,
  channel:source.preview.channel,nativeModulesVerified:true,deviceSceneVerified:true,
  deviceAudioVerified:true,adMobFirstViewVerified:true,navigationVerified:true,
  productionUnchangedVerified:true,evidenceUrl:'https://example.org/evidence'};
test('source-only does not prove APK readiness',()=>{
  const result=inspectRelease(source,null);
  assert.equal(result.eligibleForIndependentReleaseReview,false);
  assert.match(result.blockers.join(' '),/receipt/);
});
test('missing rig assets remain blockers even with optimistic receipt',()=>{
  const result=inspectRelease(source,receipt);
  assert.equal(result.eligibleForIndependentReleaseReview,false);
  assert.match(result.blockers.join(' '),/13-character/);
});
test('mismatched source SHA and production channel fail closed',()=>{
  const result=inspectRelease({...source,sourceBlockers:[]},
    {...receipt,apkSourceSha:'b'.repeat(40),channel:'production'});
  assert.equal(result.eligibleForIndependentReleaseReview,false);
  assert.match(result.blockers.join(' '),/SHA/);
  assert.match(result.blockers.join(' '),/runtime\/channel/);
});
test('even complete receipt is only eligible for external review, not proof of live install',()=>{
  const result=inspectRelease({...source,sourceBlockers:[]},receipt);
  assert.equal(result.eligibleForIndependentReleaseReview,true);
  assert.match(result.note,/NOT proof/);
});
test('repo source audit labels libraries, separate preview runtime, empty rig/audio as incomplete',()=>{
  const root=mkdtempSync(join(tmpdir(),'buklod-native-truth-'));
  const write=(p,v)=>{const f=join(root,p);mkdirSync(dirname(f),{recursive:true});writeFileSync(f,v);};
  try{
    write('package.json',JSON.stringify({dependencies:{
      '@rive-app/react-native':'1','@shopify/react-native-skia':'1',
      'react-native-reanimated':'1','lottie-react-native':'1',
      'expo-audio':'1','expo-updates':'1'
    }}));
    write('eas.json',JSON.stringify({build:{
      production:{channel:'production'},
      'season2-genesis-preview':{channel:'season2-genesis-preview',
        env:{EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true'}}
    }}));
    write('app.config.js',
      "module.exports=()=>{const s=process.env.APP_VARIANT==='staging';"+
      "const p=process.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW==='true';"+
      "return {android:{package:s?'org.mzbministry.buklod.staging':'org.mzbministry.buklod'},"+
      "runtimeVersion:s&&p?'2.0.0-genesis-preview':'1.3.2'};}");
    write('src/features/season2/genesis/genesisAssetRegistry.ts',
      'const APPROVED_RIGS:Readonly<Record<string,string>>=Object.freeze({});\n'+
      'const APPROVED_AUDIO:Readonly<Record<string,string>>=Object.freeze({});');
    write('src/components/BuklodMainBrandIntro.tsx',
      'const x=isGenesisPreviewBuild();\n const y=genesisPreview ? one:two;');
    write('src/features/season2/genesis/GenesisRiveCharacter.native.tsx',
      'getGenesisApprovedRig(id); return fallback??null;');
    const result=inspectSource(root);
    assert.equal(result.sourceLibrariesDeclared,true);
    assert.equal(result.distinctPreviewRuntime,true);
    assert.equal(result.characterRigs,'EMPTY');
    assert.equal(result.masteredSeason2Audio,'EMPTY');
    assert.equal(result.nativeModulesInInstalledAPK,'UNVERIFIED');
    assert.equal(result.compiledAPK,'UNVERIFIED');
    assert.equal(result.sourceBlockers.length,2);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('production embargo recognizes Genesis feature assets and source folder',async()=>{
  const {createRequire}=await import('node:module');
  const require=createRequire(import.meta.url);
  const embargo=require('../scripts/buklod-season2-production-embargo.cjs');
  assert.ok(embargo.FORBIDDEN_PATHS.includes('src/features/season2/genesis'));
  const root=mkdtempSync(join(tmpdir(),'buklod-genesis-embargo-'));
  try{
    mkdirSync(join(root,'src/features/season2/genesis'),{recursive:true});
    const evidence=embargo.runtimeEvidence(root);
    assert.ok(evidence.some(x=>x.file==='src/features/season2/genesis'));
  }finally{rmSync(root,{recursive:true,force:true});}
});
