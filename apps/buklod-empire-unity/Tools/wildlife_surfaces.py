"""Original shared creature surface tiles, offline only."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image

FAMILIES = ('fur', 'scales', 'chitin', 'stone', 'spirit', 'feather', 'armor')


def maps(kind, size):
    if kind not in FAMILIES or size not in (1024, 2048, 4096):
        raise ValueError('unsupported surface or size')
    t = np.arange(size, dtype=np.float32) * np.float32(2*np.pi/size)
    x, y = t[None, :], t[:, None]
    def wave(a, b, phase=0):
        return np.sin(a*x+b*y+phase)
    grain = .55*wave(91,53)+.30*wave(173,-119,1)+.15*wave(251,193,2)
    if kind == 'fur':
        detail = wave(136,9,.7*wave(3,4))*.7+grain*.3
    elif kind == 'scales':
        detail = wave(24,36)*wave(24,-36)*.85+grain*.15
    elif kind == 'chitin':
        detail = .7*wave(15,24,.5*wave(2,3))+.3*grain
    elif kind == 'stone':
        detail = .55*wave(11,17)*wave(23,-13)+.45*grain
    elif kind == 'spirit':
        detail = .80*wave(8,19,1.2*wave(3,-2))+.20*grain
    elif kind == 'feather':
        detail = .70*wave(84,14,1.5*wave(0,8))+.30*grain
    else:
        detail = .6*wave(4,127)+.4*grain
    h = .12*detail
    tint = np.clip(.91+.07*detail,0,1)
    base = np.repeat(np.rint(tint*255).astype(np.uint8)[...,None],3,axis=2)
    # URP mask: metallic in R and smoothness in A. Material tint remains in Unity.
    metal, smooth = {'fur':(.02,.19),'scales':(.08,.38),'chitin':(.19,.48),'stone':(.04,.21),'spirit':(.12,.52),'feather':(.02,.22),'armor':(.66,.55)}[kind]
    mask = np.full((size,size,4),255,dtype=np.uint8)
    mask[:,:,0] = round(metal*255)
    mask[:,:,3] = np.rint(np.clip(smooth+.08*detail,0,1)*255).astype(np.uint8)
    dx = -(np.roll(h,-1,axis=1)-np.roll(h,1,axis=1))*size*.004
    dy = -(np.roll(h,-1,axis=0)-np.roll(h,1,axis=0))*size*.004
    length = np.sqrt(1+dx*dx+dy*dy)
    normal = np.rint(np.clip(np.stack((dx/length,dy/length,1/length),axis=-1)*.5+.5,0,1)*255).astype(np.uint8)
    return base, mask, normal


def generate(out, size):
    out = Path(out); out.mkdir(parents=True, exist_ok=True)
    rows = []
    for kind in FAMILIES:
        for role, pixels in zip(('base','mask','normal'),maps(kind,size)):
            name = f'{kind}_{role}.png'; path = out/name
            Image.fromarray(pixels).save(path,compress_level=3)
            with Image.open(path) as image:
                image.load()
                if image.size != (size,size) or image.mode != ('RGBA' if role=='mask' else 'RGB'):
                    raise ValueError('unexpected PNG')
            data=path.read_bytes()
            rows.append({'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
    manifest={'status':'REVIEW_ONLY','resolution':size,'textures':rows}
    temp=out/'manifest.tmp'; temp.write_text(json.dumps(manifest,indent=2)+'\n'); temp.replace(out/'manifest.json')
    return manifest


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--size',type=int,default=2048,choices=(1024,2048,4096))
    a=p.parse_args()
    result=generate(Path(__file__).resolve().parent/'ReviewOutput'/'wildlife-materials',a.size)
    print('Generated',len(result['textures']),'shared creature textures')
