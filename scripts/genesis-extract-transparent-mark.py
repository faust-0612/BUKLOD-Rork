#!/usr/bin/env python3
"""Reproducibly cut out the *actual* green B from the canonical 512px logo.
No AI-reinvented lettering, no cream badge and no lower BUKLOD wordmark.
Uses Python standard library only; uploads no pixels or private data anywhere.
"""
import argparse, base64, binascii, json, struct, zlib
from pathlib import Path

SIGNATURE = b"\x89PNG\r\n\x1a\n"

def chunks(data):
    assert data.startswith(SIGNATURE), "Canonical brand source must be PNG"
    off = len(SIGNATURE)
    while off < len(data):
        n = struct.unpack_from(">I", data, off)[0]
        kind = data[off + 4:off + 8]
        payload = data[off + 8:off + 8 + n]
        crc = struct.unpack_from(">I", data, off + 8 + n)[0]
        assert (binascii.crc32(kind + payload) & 0xffffffff) == crc, "PNG CRC mismatch"
        off += n + 12
        yield kind, payload
        if kind == b"IEND": break

def indexed_png_pixels(data):
    palette = None
    compressed = bytearray()
    dims = None
    for kind, payload in chunks(data):
        if kind == b"IHDR":
            width, height, depth, kind_id, compression, filtering, interlace = struct.unpack(">IIBBBBB", payload)
            assert (width, height, depth, kind_id, compression, filtering, interlace) == (512,512,8,3,0,0,0), "Unexpected canonical source format"
            dims = (width, height)
        elif kind == b"PLTE":
            palette = [tuple(payload[i:i+3]) for i in range(0,len(payload),3)]
        elif kind == b"IDAT":
            compressed.extend(payload)
    assert palette and dims
    data = zlib.decompress(compressed)
    w,h = dims
    assert len(data) == h*(w+1), "Invalid PNG pixel count"
    prior = bytearray(w)
    rows = []
    offset = 0
    for _ in range(h):
        filter_kind = data[offset]; offset += 1
        row = bytearray(data[offset:offset+w]); offset += w
        for x in range(w):
            a = row[x-1] if x else 0
            b = prior[x]
            c = prior[x-1] if x else 0
            if filter_kind == 1: predictor = a
            elif filter_kind == 2: predictor = b
            elif filter_kind == 3: predictor = (a+b)//2
            elif filter_kind == 4:
                p=a+b-c
                pa,pb,pc=abs(p-a),abs(p-b),abs(p-c)
                predictor = a if pa<=pb and pa<=pc else b if pb<=pc else c
            elif filter_kind == 0: predictor = 0
            else: raise ValueError("Unsupported PNG filter")
            row[x] = (row[x] + predictor) & 255
        rows.append([palette[index] for index in row])
        prior = row
    return rows

def png_chunk(kind,data):
    return struct.pack(">I",len(data)) + kind + data + struct.pack(">I",binascii.crc32(kind+data)&0xffffffff)

def encode_rgba_png(width,height,pixels):
    assert len(pixels)==height and all(len(row)==width*4 for row in pixels)
    raw = b"".join(b"\x00"+row for row in pixels)
    ihdr = struct.pack(">IIBBBBB",width,height,8,6,0,0,0)
    return SIGNATURE+png_chunk(b"IHDR",ihdr)+png_chunk(b"IDAT",zlib.compress(raw,9))+png_chunk(b"IEND",b"")

def extract(source):
    rows=indexed_png_pixels(source)
    mask=[]
    bounds=[]
    # The green B is above y=382; brand wordmark below is intentionally excluded.
    for y in range(40,380):
        for x in range(95,430):
            r,g,b=rows[y][x]
            if g <= r+4 or g <= b+11: continue
            alpha=min(255, max(0, min(g-r-4,g-b-11)*15))
            if alpha > 24: bounds.append((x,y))
            if alpha: mask.append((x,y,r,g,b,alpha))
    assert len(bounds)>18000, "Green B not found; canonical art may have changed"
    x0=min(x for x,_ in bounds); x1=max(x for x,_ in bounds)
    y0=min(y for _,y in bounds); y1=max(y for _,y in bounds)
    assert 200<=x1-x0<=340 and 240<=y1-y0<=355, f"Unexpected green B bounds {(x0,y0,x1,y1)}"
    size=384
    ox=(size-(x1-x0+1))//2-x0
    oy=(size-(y1-y0+1))//2-y0
    out=[bytearray(size*4) for _ in range(size)]
    for x,y,r,g,b,a in mask:
        px=x+ox; py=y+oy
        if 0<=px<size and 0<=py<size:
            i=px*4
            out[py][i:i+4]=bytes((r,g,b,a))
    alpha_count=sum(row[i]>0 for row in out for i in range(3,len(row),4))
    assert alpha_count>18000
    assert out[0][3]==0 and out[-1][-1]==0, "PNG edges must be transparent"
    return encode_rgba_png(size,size,out),dict(pixels=alpha_count,bounds=[x0,y0,x1,y1],canvas=[size,size])

if __name__ == "__main__":
    cli=argparse.ArgumentParser()
    cli.add_argument("--source",default="assets/release/buklod-main-canonical.png")
    cli.add_argument("--output",default="/tmp/genesis-green-b-transparent.png")
    cli.add_argument("--emit-base64",action="store_true")
    args=cli.parse_args()
    png,details=extract(Path(args.source).read_bytes())
    Path(args.output).write_bytes(png)
    print("GENESIS_MARK_META="+json.dumps({**details,"fileBytes":len(png)}))
    if args.emit_base64: print("GENESIS_MARK_BASE64="+base64.b64encode(png).decode("ascii"))
