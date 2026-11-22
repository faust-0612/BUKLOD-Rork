#!/usr/bin/env node
/**
 * Offline/read-only Genesis visual inventory.
 *
 * This audit intentionally separates "files exist" from "drawn in Godot" and
 * "signed APK verified". Never infer visual fidelity from artwork titles,
 * a smoke-test pass, or a source-only EAS receipt.
 */
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(ROOT,p),'utf8');
const file=p=>existsSync(path.join(ROOT,p));
const count=(dir,regex)=>file(dir)?
  readdirSync(path.join(ROOT,dir)).filter(name=>regex.test(name)).length:0;
export const EXPECTED=Object.freeze({
  heroes:13,heroPoses:52,heroSprites:13,battlefieldPlates:3,
  minionFactions:2,minionPortraits:8,dropIcons:300,
});
const MINION_IDS=Object.freeze([
  'solar_vanguard','solar_ranger','solar_mender','solar_siege_breaker',
  'nebula_vanguard','nebula_ranger','nebula_mender','nebula_siege_breaker',
]);
const REQUIRED_MAPS=Object.freeze([
  'genesis_rift','aurora_foundry','verdant_fracture',
]);

export function inspectVisualReadiness(){
  const assets=read('src/features/games/empire/arenaGeneratedAssets.ts');
  const native=read('godot/empire-arena/scripts/arena_root.gd');
  const builder=read('scripts/build-empire-godot-pack.mjs');
  const inApp=read('src/app/games/empire-arena.tsx');
  const found={
    reactHeroPoses:[...assets.matchAll(/'fullbody:[a-z]+_(?:idle|walk|attack|skill)'/g)].length,
    reactHeroSprites:[...assets.matchAll(/'sprite:[a-z]+'/g)].length,
    reactBattlefieldPlates:[...assets.matchAll(/'scene:[a-z_]+'/g)].length,
    godotHeroPoses:count('godot/empire-arena/art/fullbody',/^[a-z]+_(idle|walk|attack|skill)\.png$/),
    godotHeroSprites:count('godot/empire-arena/art/sprite',/^[a-z]+\.png$/),
    // Scene PNGs are packed directly from the 3 signed RN scene plates; the
    // native source does not maintain a duplicate art/scene folder.
    godotBattlefieldPlates:builder.includes("group === 'scene' ? filename : vendored") &&
      builder.includes('artCounts, { fullbody: 52, scene: 3, sprite: 13 }') ? 3 : 0,
    libraryMinionPortraits:MINION_IDS.filter(id=>file('godot/empire-arena/art/minions/'+id+'.png')).length,
    // Accept either 300 independent PNG or one indexed sprite atlas (no dummy).
    libraryDropIcons:count('godot/empire-arena/art/drops',/^[uh]-[a-z0-9_-]+\.png$/),
    hasDropAtlas:file('godot/empire-arena/art/drops/atlas.png') &&
      file('godot/empire-arena/art/drops/atlas.json'),
    rendersNativeHeroAtlases:native.includes('res://art/fullbody/') &&
      native.includes('draw_texture_rect_region('),
    rendersNativeMinionPortraits:/res:\/\/art\/minions\//.test(native),
    rendersNativeItemIcons:/res:\/\/art\/drops\//.test(native),
    rendersNativeStructureTextures:/res:\/\/art\/structures\//.test(native),
    usesCanonicalMapArt:native.includes('res://art/scene/'),
    builderCopiesApprovedArt:builder.includes('artCounts')&&
      builder.includes('art/' + "' + group + '" + '/'),
    newLibraryNativeFirst:inApp.includes("EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE === 'true'") &&
      inApp.includes('nativeAutoAttempted.current = true'),
    actualSignedApkVerified:false,
  };
  let atlasEntries=0;
  if(found.hasDropAtlas){
    try{
      const atlas=JSON.parse(read('godot/empire-arena/art/drops/atlas.json'));
      const entries=Array.isArray(atlas.items)?atlas.items:Object.keys(atlas.items||{});
      atlasEntries=entries.length;
    }catch{atlasEntries=0;}
  }
  const missing=[];
  for(const [key,expected,actual] of [
    ['react_hero_pose_images',52,found.reactHeroPoses],
    ['react_hero_sprites',13,found.reactHeroSprites],
    ['react_3_battlefield_images',3,found.reactBattlefieldPlates],
    ['godot_hero_pose_images',52,found.godotHeroPoses],
    ['godot_hero_sprites',13,found.godotHeroSprites],
    ['godot_3_battlefield_images',3,found.godotBattlefieldPlates],
    ['library_faction_minions',8,found.libraryMinionPortraits],
    ['library_drop_icons',300,Math.max(found.libraryDropIcons,atlasEntries)],
  ])if(actual!==expected)missing.push({component:key,expected,actual});
  for(const [key,present] of [
    ['native_hero_render',found.rendersNativeHeroAtlases],
    ['native_faction_minion_render',found.rendersNativeMinionPortraits],
    ['native_drop_icon_render',found.rendersNativeItemIcons],
    ['native_structure_art_render',found.rendersNativeStructureTextures],
    ['native_map_image_render',found.usesCanonicalMapArt],
    ['native_pack_builder_library_art',builder.includes("art/minions/")&&builder.includes("art/drops/")],
    ['library_native_first_entry',found.newLibraryNativeFirst],
  ])if(!present)missing.push({component:key,expected:true,actual:false});
  return {
    source:'BUKLOD MAIN Genesis library runtime — inspected source, not device',
    status:missing.length?'NOT_VISUAL_RELEASE_READY':'SOURCE_INVENTORY_READY_PENDING_SIGNED_ANDROID_VISUAL_QA',
    expected:EXPECTED,found,missing,
    releaseHolds:['physical signed APK screen capture','real GPU/frame pacing',
      'AdMob first view/navigation and audio/PTT focus regression',
      'backend/RLS isolation and production fix reconciliation'],
    verifiedProduction:false,
  };
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=inspectVisualReadiness();
  console.log(JSON.stringify(result,null,2));
  if(process.argv.includes('--strict')&&result.missing.length){
    console.error('BUKLOD_VISUAL_RELEASE_HOLD: unavailable Library art / native render paths');
    process.exitCode=1;
  }
}
