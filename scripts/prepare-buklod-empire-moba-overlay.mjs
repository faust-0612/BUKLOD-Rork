/** Compose a cumulative offline gameplay candidate from the exact installed
 * APK baseline. No engine, boot, menu, session, catalog or online code edits. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,copyFileSync,cpSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const [baselineFile,assetRoot,out]=process.argv.slice(2);
assert.ok(baselineFile&&assetRoot&&out,'Usage: baseline.json baseline-assets new-candidate-dir');
assert.ok(!existsSync(out),'Candidate must not exist');
const base=JSON.parse(readFileSync(baselineFile,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(hash(JSON.stringify(base.inventory)),base.base);
for(const [p,h] of Object.entries(base.inventory))assert.equal(hash(readFileSync(path.join(assetRoot,p))),h,p+' baseline differs');
cpSync(assetRoot,out,{recursive:true});
const root='apps/buklod-empire/offline-moba';
execFileSync('python3',['scripts/generate-buklod-empire-hero-glbs.py','--out',path.join(out,'3d/buklod_heroes')],{stdio:'inherit',timeout:120000});
for(const [a,b] of [['moba_sim.gd','scripts/moba_sim.gd'],['moba_3d.gd','scripts/moba_3d.gd'],['Moba3D.tscn','scenes/Moba3D.tscn']])copyFileSync(path.join(root,a),path.join(out,b));
const entry=path.join(out,'scripts/arena_root.gd');
let s=readFileSync(entry,'utf8');
for(const [a,b] of [['preview3d_button.text = "3D ARENA VIEW"','preview3d_button.text = "3D MOBA 5v5"'],['get_tree().change_scene_to_file("res://scenes/PremiumWorld3D.tscn")','get_tree().change_scene_to_file("res://scenes/Moba3D.tscn")']]){
 assert.equal(s.split(a).length,2,'Existing Arena entry changed');s=s.replace(a,b);
}
writeFileSync(entry,s);
console.log('BUKLOD_OFFLINE_MOBA_OVERLAY_READY');
