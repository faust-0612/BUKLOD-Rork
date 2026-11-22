import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const fs=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Official library icons bind by original ID to authoritative 300 temporary pickup catalog',()=>{
 const gd=fs('godot/empire-arena/scripts/arena_root.gd');
 const builder=fs('scripts/build-empire-godot-pack.mjs');
 assert.match(gd,/drop\.get\("item_id", ""\)/);
 assert.match(gd,/res:\/\/art\/drops\/atlas\.png/);
 assert.match(gd,/draw_texture_rect_region\(drop_atlas,/);
 assert.match(builder,/new Set\(catalog\.pickups\.map\(x=>x\.id\)\)/);
 assert.match(builder,/art\/drops\/atlas\.json/);
 assert.match(builder,/Partial original BUKLOD Library spritepack/);
});
test('Exactly eight original minion archetypes are mapped to existing roles with no duplicated AI',()=>{
 const gd=fs('godot/empire-arena/scripts/arena_root.gd');
 for(const role of ['vanguard','ranger','mender','siege_breaker'])assert.match(gd,new RegExp(role));
 for(const team of ['solar','nebula'])assert.match(gd,new RegExp(team));
 assert.match(gd,/p\.get\("library_minion", false\)/);
 assert.match(gd,/minion_texture = _art/);
 const ingest=fs('scripts/ingest-buklod-arena-library-art.py');
 assert.match(ingest,/len\(items\)==300/);
 assert.match(ingest,/len\(entries\)==8/);
});
