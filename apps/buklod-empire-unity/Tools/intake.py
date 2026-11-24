#!/usr/bin/env python3
"""Lossless reference intake and reproducible, non-final hero baseline."""
import hashlib,json,pathlib,shutil,subprocess,sys
project=pathlib.Path(__file__).resolve().parents[1]
repo=project.parents[1]
idx=json.loads((project/'ReferenceIndex.json').read_text())
def git_blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def main():
    rows=[]
    for a in idx['assets']:
        source=repo/a['path']
        data=source.read_bytes()
        if git_blob(data)!=a['gitBlob'] or len(data)!=a['bytes']:
            raise ValueError('Reference drift: '+a['path'])
        target=project/'ReferenceArt'/a['path']
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(data)
        rows.append({'path':a['path'],'sha256':hashlib.sha256(data).hexdigest()})
    out=project/'Assets/Generated/HeroBaseline'
    subprocess.run([sys.executable,str(repo/'scripts/generate-buklod-empire-hero-glbs.py'),'--out',str(out)],check=True)
    manifest=json.loads((out/'manifest.json').read_text())
    assert len(manifest['heroes'])==13 and len({x['meshHash'] for x in manifest['heroes']})==13
    for h in manifest['heroes']:
        assert hashlib.sha256((out/h['file']).read_bytes()).hexdigest()==h['sha256']
    dest=project/'Assets/Generated/Canonical'
    dest.mkdir(parents=True,exist_ok=True)
    shutil.copy2(repo/'godot/empire-arena/library/arena_intake_20261122.json',dest/'arena_intake.json')
    (project/'ReferenceArt/receipt.json').write_text(json.dumps({'references':rows,'heroBaseline':manifest,'premiumVerified':False},indent=2))
    print('Reference intake complete; premium release remains blocked:',len(rows))
if __name__=='__main__': main()
