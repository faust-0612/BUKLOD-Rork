"""Original procedural PBR tiles for review, with no network or paid assets."""
import io, os, zlib
from functools import lru_cache


def review_size():
    value = int(os.environ.get('BUKLOD_REVIEW_TEXTURE_SIZE', '256'))
    if value not in (256, 1024, 2048, 4096):
        raise ValueError('Review texture size must be 256, 1024, 2048 or 4096')
    return value


@lru_cache(maxsize=24)
def encoded_surface(kind, size):
    # Lazy imports keep the existing 256px standard-library pipeline working.
    import numpy as np
    from PIL import Image
    if size not in (1024, 2048, 4096):
        raise ValueError('Unsupported HD review resolution')
    t = np.arange(size, dtype=np.float32) * np.float32(2*np.pi/size)
    x, y = t[None, :], t[:, None]
    seed = zlib.crc32(kind.encode())
    def wave(a, b, phase=0):
        return np.sin(a*x+b*y+phase)
    # Periodic multi-frequency detail, not interpolation of the 256px maps.
    grain = (.48*wave(61, 37, seed%7)+.28*wave(127, -79, 1)+.16*wave(211, 97, 2)+.08*wave(307, -173, 3))
    if kind in ('armor', 'trim'):
        brush = wave(5, 149, .5*wave(3, 1))
        scratches = np.maximum(0, wave(19, 83)+.25*wave(37, -11)-.92)**2
        height = .025*brush + .045*grain - .09*scratches
        rough = .88+.08*grain+.04*brush
        tint = .94+.025*grain-.035*scratches
        strength = .005
    elif kind == 'fabric':
        weave = wave(128,0)*wave(0,128)
        height = .11*weave+.025*grain
        rough = .94+.045*weave
        tint = .91+.055*weave+.015*grain
        strength = .004
    elif kind == 'hair':
        strands = wave(192, 0, .5*wave(0, 4))
        height = .085*strands+.035*grain
        rough = .88+.07*strands
        tint = .91+.07*strands+.015*grain
        strength = .004
    elif kind == 'leather':
        folds = wave(12, 9)*wave(17,-13)
        height = .10*grain+.055*folds
        rough = .91+.06*grain
        tint = .91+.05*grain+.025*folds
        strength = .006
    else:
        # Subtle pores, never a baked face identity or painted lighting.
        pores = np.maximum(0, wave(151,73)*wave(89,-137)-.35)**2
        height = .015*grain-.04*pores
        rough = .94+.04*grain-.03*pores
        tint = .97+.018*grain-.015*pores
        strength = .003
    def u8(a): return np.rint(np.clip(a,0,1)*255).astype(np.uint8)
    def png(a):
        out = io.BytesIO(); Image.fromarray(a).save(out,format='PNG',compress_level=3); return out.getvalue()
    base = png(np.repeat(u8(tint)[...,None],3,axis=2))
    mr = np.full((size,size,3),255,dtype=np.uint8); mr[:,:,1] = u8(rough)
    metallic_roughness = png(mr); del mr
    dx = -(np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*size*strength
    dy = -(np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*size*strength
    length = np.sqrt(1+dx*dx+dy*dy)
    normal = png(u8(np.stack((dx/length,dy/length,1/length),axis=-1)*.5+.5))
    return base, metallic_roughness, normal
