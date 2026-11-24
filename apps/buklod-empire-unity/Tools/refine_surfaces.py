"""Original zero-purchase GLB surface detail. No external art, packages or network.
Input: the BUKLOD generator's non-index-shared triangle vertices, float positions/normals.
Preserves skin, animation, vertex count, material factors and original source assets.
"""
import json, math, struct, zlib
from premium_surface import SIZE, surface, tangent
from hd_surface import review_size, encoded_surface

def png(size, pixel):
    def chunk(kind,data):
        return struct.pack(">I",len(data))+kind+data+struct.pack(">I",zlib.crc32(kind+data)&0xffffffff)
    raw=b"".join(b"\0"+bytes(v for x in range(size) for v in pixel(x,y)) for y in range(size))
    return b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",size,size,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b"")

def texture_glb(path):
    raw=path.read_bytes()
    if struct.unpack_from("<4sII",raw)!=(b"glTF",2,len(raw)):raise ValueError("Invalid GLB header")
    n,tag=struct.unpack_from("<I4s",raw,12)
    if tag!=b"JSON":raise ValueError("Missing JSON")
    d=json.loads(raw[20:20+n])
    size,tag=struct.unpack_from("<I4s",raw,20+n)
    if tag!=b"BIN\0" or 28+n+size!=len(raw):raise ValueError("Invalid BIN")
    b=bytearray(raw[28+n:]);views=d["bufferViews"];access=d["accessors"]
    if d.get("textures"):raise ValueError("Refusing to replace existing textures")
    def append(data,target=None):
        b.extend(b"\0"*((-len(b))%4))
        row={"buffer":0,"byteOffset":len(b),"byteLength":len(data)}
        if target:row["target"]=target
        views.append(row);b.extend(data);return len(views)-1
    def vectors(i):
        a=access[i];v=views[a["bufferView"]]
        if a["componentType"]!=5126 or a["type"]!="VEC3" or v.get("byteStride",12)!=12:raise ValueError("Expected packed float VEC3")
        offset=v.get("byteOffset",0)+a.get("byteOffset",0)
        if offset+12*a["count"]>len(b):raise ValueError("Accessor exceeds buffer")
        return list(struct.iter_unpack("<fff",b[offset:offset+12*a["count"]]))
    for mesh in d["meshes"]:
        for primitive in mesh["primitives"]:
            a=primitive["attributes"];p=vectors(a["POSITION"]);norm=vectors(a["NORMAL"])
            if len(p)!=len(norm) or len(p)%3 or "TEXCOORD_0" in a:raise ValueError("Expected original triangle geometry")
            uv=[];tangents=[]
            for i in range(0,len(p),3):
                # One dominant projection per triangle; never change the skin/geometry.
                axis=max(range(3),key=lambda k:abs(sum(norm[j][k] for j in range(i,i+3))))
                axes=[k for k in range(3) if k!=axis]
                uv.extend((p[j][axes[0]]*5,p[j][axes[1]]*5) for j in range(i,i+3))
                tangents.extend(tangent(norm[j],axes) for j in range(i,i+3))
            view=append(b"".join(struct.pack("<ff",*q) for q in uv),34962)
            access.append({"bufferView":view,"componentType":5126,"count":len(uv),"type":"VEC2"})
            a["TEXCOORD_0"]=len(access)-1
            view=append(b"".join(struct.pack("<ffff",*q) for q in tangents),34962)
            access.append({"bufferView":view,"componentType":5126,"count":len(tangents),"type":"VEC4"})
            a["TANGENT"]=len(access)-1
    d["images"]=[];d["textures"]=[];d["samplers"]=[{"magFilter":9729,"minFilter":9987,"wrapS":10497,"wrapT":10497}]
    def image(data,name):
        d["images"].append({"bufferView":append(data),"mimeType":"image/png","name":name})
        d["textures"].append({"sampler":0,"source":len(d["images"])-1})
        return {"index":len(d["textures"])-1}
    # All patterns are original analytic tileable detail. Factors retain canonical colors.
    cache={}
    resolution=review_size()
    for m in d["materials"]:
        name=m["name"];p=m["pbrMetallicRoughness"]
        if name.startswith("SacredStone") or name in ("eye","pupil","glow"):continue
        kind=name
        if kind not in cache:
            if resolution==SIZE:
                maps=tuple(png(SIZE,lambda x,y: pixels[y*SIZE+x]) for pixels in surface(kind))
            else:
                maps=encoded_surface(kind,resolution)
            cache[kind]=tuple(image(data,kind+suffix) for data,suffix in zip(maps,("_detail","_roughness","_normal")))
        p["baseColorTexture"],p["metallicRoughnessTexture"],m["normalTexture"]=cache[kind]
    b.extend(b"\0"*((-len(b))%4));d["buffers"][0]["byteLength"]=len(b)
    j=json.dumps(d,separators=(",",":")).encode();j+=b" "*((-len(j))%4)
    result=struct.pack("<4sII",b"glTF",2,28+len(j)+len(b))+struct.pack("<I4s",len(j),b"JSON")+j+struct.pack("<I4s",len(b),b"BIN\0")+b
    tmp=path.with_suffix(".glb.tmp");tmp.write_bytes(result);tmp.replace(path)
