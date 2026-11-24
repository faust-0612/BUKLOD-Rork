#!/usr/bin/env node
/** Compose only the reviewed Godot game sources into native Android assets.
 * No MAIN bundle, Expo, Vercel, live backend calls or credential transfer. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,copyFileSync,mkdirSync,rmSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {createHash,createPublicKey} from 'node:crypto';
const base=path.resolve('apps/buklod-empire');
const assets=path.join(base,'app/src/main/assets');
const build=path.resolve('build/buklod-empire');
mkdirSync(build,{recursive:true});
const zip=path.join(build,'canonical.zip');
assert.equal(process.env.BUKLOD_GENESIS_PREMIUM_3D,'true','Public 3D assets required');
execFileSync(process.execPath,['scripts/build-empire-godot-pack.mjs','--out='+zip],{stdio:'inherit',timeout:120000});
rmSync(assets,{recursive:true,force:true});
mkdirSync(assets,{recursive:true});
execFileSync('unzip',['-q',zip,'-d',assets],{stdio:'inherit'});
const change=(file,from,to)=>{
 const p=path.join(assets,file);
 const data=readFileSync(p,'utf8');
 assert.equal(data.split(from).length,2,'Unmatched source anchor '+file);
 writeFileSync(p,data.replace(from,()=>to));
};
change('project.godot','config/name="BUKLOD Empire Arena"','config/name="BUKLOD Empire"');
change('project.godot','run/main_scene="res://scenes/Arena.tscn"','run/main_scene="res://scenes/EmpireBoot.tscn"');
change('project.godot','[display]','[autoload]\nEmpireOta="*res://scripts/empire_ota.gd"\nEmpireSession="*res://scripts/empire_session.gd"\n\n[display]');
change('project.godot','window/size/mode=3','window/size/mode=3\nwindow/handheld/orientation=0'.replace('\nwindow/handheld/orientation=0','')+'\nwindow/size/initial_position_type=0');
change('scripts/arena_root.gd','\tget_tree().quit(0)','\tget_node("/root/EmpireSession").return_to_menu()');
change('scripts/world_preview.gd','\tEngine.max_fps = 30','\tworld_id = get_node("/root/EmpireSession").world_id\n\tEngine.max_fps = 30');
change('scripts/world_preview.gd','back.pressed.connect(func() -> void: get_tree().quit())','back.pressed.connect(func() -> void: get_node("/root/EmpireSession").return_to_menu())');
change('scripts/premium_world_3d.gd','    world_id = _get_world()','    world_id = get_node("/root/EmpireSession").world_id');
change('scripts/arena_root.gd','\trunning = true\n\tif preview3d_button','\trunning = true\n\tprint("BUKLOD_EMPIRE_OFFLINE_BATTLE_STARTED")\n\tif preview3d_button');
for(const [source,dest] of [['EmpireMenu.tscn','scenes/EmpireMenu.tscn'],['empire_menu.gd','scripts/empire_menu.gd'],['empire_session.gd','scripts/empire_session.gd'],['EmpireBoot.tscn','scenes/EmpireBoot.tscn'],['empire_boot.gd','scripts/empire_boot.gd'],['empire_ota.gd','scripts/empire_ota.gd']])copyFileSync(path.join(base,'game',source),path.join(assets,dest));
rmSync(path.join(assets,'tests'),{recursive:true,force:true});
const drawable=path.join(base,'app/src/main/res/drawable');
mkdirSync(drawable,{recursive:true});
copyFileSync(path.join(assets,'splash/buklod-green-b.png'),path.join(drawable,'empire_icon.png'));
const m=JSON.parse(readFileSync(path.join(assets,'data/3d_manifest.json'),'utf8'));
assert.equal(m.models.length,22);
assert.equal(m.models.filter(x=>x.rigged).length,2);
const audio=JSON.parse(readFileSync(path.join(assets,'data/audio_manifest.json'),'utf8'));
assert.equal(audio.count,70);assert.equal(audio.prototype,false);
assert.equal(readdirSync(path.join(assets,'kingdom-items')).length,42);
const catalog=JSON.parse(readFileSync(path.join(assets,'data/catalog.json'),'utf8'));
assert.equal(Object.keys(catalog.heroes).length,13);
assert.equal(catalog.pickups.length,300);
// Stable APK baseline fingerprint includes all shipped source resources.
// Store the inventory separately as the immutable input for future cumulative deltas.
const inventory={};
function walk(dir){
 for(const name of readdirSync(dir).sort()){
  const p=path.join(dir,name);
  if(statSync(p).isDirectory())walk(p);
  else inventory[path.relative(assets,p).split(path.sep).join('/')]=createHash('sha256').update(readFileSync(p)).digest('hex');
 }
}
walk(assets);
const baseHash=createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
const channel=process.env.BUKLOD_EMPIRE_OTA_CHANNEL||'dev';
assert.ok(['dev','staging','production'].includes(channel));
const key=process.env.BUKLOD_EMPIRE_OTA_PUBLIC_KEY||'';
if(key){
 const pinned=createPublicKey(key);
 assert.equal(pinned.asymmetricKeyType,'rsa');
 assert.ok(pinned.asymmetricKeyDetails.modulusLength>=2048);
}
if(channel!=='dev'||process.env.BUKLOD_EMPIRE_REQUIRE_RELEASE_SIGNING==='true')assert.ok(key,'Owner-controlled permanent OTA public key required');
mkdirSync(path.join(assets,'empire-ota'),{recursive:true});
writeFileSync(path.join(assets,'empire-ota/config.json'),JSON.stringify({schema:1,channel,runtime:'empire-godot-4.7.2-r1',base:baseHash,key}));
writeFileSync(path.join(build,'ota-baseline.json'),JSON.stringify({schema:1,channel,runtime:'empire-godot-4.7.2-r1',base:baseHash,keyFingerprint:key?createHash('sha256').update(createPublicKey(key).export({type:'spki',format:'der'})).digest('hex'):null,inventory},null,2)+'\n');
const manifest={otaProtocol:1,otaChannel:channel,otaTrustConfigured:!!key,otaBaseline:baseHash,status:'OFFLINE_DEV',sourceSha:process.env.GITHUB_SHA??null,package:'org.mzbministry.buklod.empire',godot:'4.7.2',canonicalPackSha256:createHash('sha256').update(readFileSync(zip)).digest('hex'),worlds:['arena','kingdom','house','community'],heroes:13,models:22,rigged:2,kingdomItems:42,audioCues:70,liveRewards:false,backendProjectCreated:false};
writeFileSync(path.join(build,'content-receipt.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('BUKLOD_EMPIRE_ASSETS_READY '+JSON.stringify(manifest));
