#!/usr/bin/env python3
"""Assemble independent Godot Android project from exact canonical game ZIP.
Do not alter MAIN, React Native, or shared game source. Preserve raw runtime
media as .bin files because Godot export remaps imported PNG/WAV/GLB resources.
"""
import argparse, hashlib, json, pathlib, re, shutil, zipfile
p=argparse.ArgumentParser()
p.add_argument('--pack',required=True)
p.add_argument('--out',required=True)
args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
out=pathlib.Path(args.out).resolve()
assert not out.exists(), 'Refuse to overwrite an existing project'
out.mkdir(parents=True)
with zipfile.ZipFile(args.pack) as z:
    for item in z.infolist():
        name=pathlib.PurePosixPath(item.filename)
        assert not name.is_absolute() and '..' not in name.parts
        assert not item.is_dir()
        assert item.file_size < 256*1024*1024
        z.extract(item,out)
assert len(list((out/'art').rglob('*.png')))==68
assert len(list((out/'audio/sfx').glob('*.wav')))==70
assert len(list((out/'kingdom-items').glob('*.webp')))==42
assert len(list((out/'3d').rglob('*.glb')))==22
manifest=json.loads((out/'data/3d_manifest.json').read_text())
assert manifest['license']=='CC0-1.0'
assert len(manifest['models'])==22 and sum(bool(x.get('rigged')) for x in manifest['models'])==2
# Keep the boot logo as an imported texture; every dynamically decoded media
# source is preserved in the export as an opaque, byte-identical file.
media=[]
for f in list(out.rglob('*')):
    if f.is_file() and f.suffix in {'.png','.wav','.webp','.glb'} and f.relative_to(out).as_posix()!='splash/buklod-green-b.png':
        digest=hashlib.sha256(f.read_bytes()).hexdigest()
        target=f.with_name(f.name+'.bin')
        f.rename(target)
        media.append({'path':target.relative_to(out).as_posix(),'sha256':digest,'bytes':target.stat().st_size})
for f in (out/'scripts').glob('*.gd'):
    s=f.read_text()
    # Current canonical raw asset names, including dynamically constructed suffixes.
    s=re.sub(r'\.(png|webp|wav|glb)(?=")',r'.\1.bin',s)
    f.write_text(s)
def patch(relative,old,new):
    path=out/relative
    s=path.read_text()
    assert s.count(old)==1, relative+': canonical anchor changed'
    path.write_text(s.replace(old,new))
patch('project.godot','config/name="BUKLOD Empire Arena"','config/name="BUKLOD Empire"')
patch('project.godot','[rendering]\n','[rendering]\ntextures/vram_compression/import_etc2_astc=true\n')
patch('project.godot','run/main_scene="res://scenes/Arena.tscn"','run/main_scene="res://scenes/EmpireHub.tscn"\nconfig/icon="res://splash/buklod-green-b.png"')
patch('scripts/arena_root.gd','get_tree().quit(0)','get_tree().change_scene_to_file("res://scenes/EmpireHub.tscn")')
patch('scripts/world_preview.gd','\tfor arg in OS.get_cmdline_user_args():','\tworld_id = str(get_tree().get_meta("buklod_empire_world", "kingdom"))\n\tif not WORLD_ART.has(world_id):\n\t\tworld_id = "kingdom"\n\tfor arg in OS.get_cmdline_user_args():')
patch('scripts/world_preview.gd','get_tree().quit())','get_tree().change_scene_to_file("res://scenes/EmpireHub.tscn"))')
patch('scripts/premium_world_3d.gd','    return "arena"\n\nfunc _model','    var selected := str(get_tree().get_meta("buklod_empire_world", "arena"))\n    return selected if selected in ["arena", "kingdom"] else "arena"\n\nfunc _model')
for source,destination in [('empire_hub.gd','scripts/empire_hub.gd'),('EmpireHub.tscn','scenes/EmpireHub.tscn'),('export_presets.cfg','export_presets.cfg'),('standalone_smoke.gd','tests/standalone_smoke.gd')]:
    shutil.copyfile(root/'godot/empire-standalone'/source,out/destination)
# The existing test suite is retained in source but not shipped; the standalone
# smoke runs against the actual converted project before export.
(out/'data/standalone_media_manifest.json').write_text(json.dumps({'schema':1,'assets':media,'mode':'OFFLINE_PREVIEW','server_settlement':False},indent=2))
print('BUKLOD_EMPIRE_STANDALONE_PROJECT_READY',len(media),'raw assets',sum(x['bytes'] for x in media),'bytes')
