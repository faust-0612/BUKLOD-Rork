#!/usr/bin/env python3
"""Offline importer for owner-provided BUKLOD Library visual ZIPs.
Deterministic, no executable extraction, and no network calls. Requires Pillow.
Outputs Godot art/minions/*.png + art/drops/atlas.png/json.
"""
from __future__ import annotations
import argparse,hashlib,io,json,zipfile
from pathlib import Path
from PIL import Image
MINIONS=(
 'solar_vanguard','solar_ranger','solar_mender','solar_siege_breaker',
 'nebula_vanguard','nebula_ranger','nebula_mender','nebula_siege_breaker')
PNG=b'\x89PNG\r\n\x1a\n'
def make(drops:Path,minions:Path,out:Path)->dict:
  dropdir=out/'art/drops';mindir=out/'art/minions'
  dropdir.mkdir(parents=True,exist_ok=True);mindir.mkdir(parents=True,exist_ok=True)
  with zipfile.ZipFile(drops) as z:
    catalog=json.loads(z.read('BUKLOD_Arena_Drops/drop_items.json'))
    items=catalog['items']
    assert catalog['count']==300 and len(items)==300
    ids={item['id'] for item in items}
    assert len(ids)==300 and all(isinstance(i,str) and 0<len(i)<70 and i.replace('-','').replace('_','').isalnum() for i in ids)
    assert sum(i['category']=='universal' for i in items)==144
    assert sum(i['category']=='exclusive' for i in items)==156
    atlas=Image.new('RGBA',(1920,1440))
    index={};hashes={}
    for n,item in enumerate(sorted(items,key=lambda i:i['id'])):
      src='BUKLOD_Arena_Drops/'+item['asset']
      assert src=='BUKLOD_Arena_Drops/icons/'+item['id']+'.png'
      original=z.read(src);assert len(original)<300000 and original[:8]==PNG
      im=Image.open(io.BytesIO(original));im.load()
      assert im.size==(256,256)
      x,y=n%20,n//20
      atlas.alpha_composite(im.convert('RGBA').resize((96,96),Image.Resampling.LANCZOS),(x*96,y*96))
      index[item['id']]=[x,y];hashes[item['id']]=hashlib.sha256(original).hexdigest()
    atlas.save(dropdir/'atlas.png',optimize=True,compress_level=9)
    metadata={'schema':1,'count':300,'columns':20,'rows':15,'cellSize':96,
      'items':index,'originalSha256':hashes,'temporary':True,'transferable':False}
    (dropdir/'atlas.json').write_text(json.dumps(metadata,sort_keys=True,separators=(',',':'))+'\n')
  with zipfile.ZipFile(minions) as z:
    entries=json.loads(z.read('manifest.json'))['minions']
    assert len(entries)==8 and {m['id'] for m in entries}==set(MINIONS)
    for item in entries:
      data=z.read(item['png'])
      assert item['png']==item['id']+'.png'
      assert data[:8]==PNG and len(data)<1024*1024
      im=Image.open(io.BytesIO(data));im.load()
      assert im.size==(512,512)
      im.convert('RGBA').resize((256,256),Image.Resampling.LANCZOS).save(
        mindir/(item['id']+'.png'),optimize=True,compress_level=9)
  return {'items':300,'minions':8,'atlasSha256':hashlib.sha256((dropdir/'atlas.png').read_bytes()).hexdigest()}
if __name__=='__main__':
  p=argparse.ArgumentParser()
  p.add_argument('--drops',required=True,type=Path)
  p.add_argument('--minions',required=True,type=Path)
  p.add_argument('--out',required=True,type=Path)
  a=p.parse_args()
  print(json.dumps(make(a.drops,a.minions,a.out),sort_keys=True))
