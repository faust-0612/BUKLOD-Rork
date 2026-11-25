#!/usr/bin/env python3
"""Read-only structural review of GLB; never approves art or production use."""
import argparse, hashlib, json, pathlib, struct
import numpy as np
import trimesh

def inspect(path):
    path = pathlib.Path(path)
    if path.stat().st_size > 512 * 1024**2: raise ValueError('File exceeds review size limit')
    raw = path.read_bytes()
    if len(raw) < 28: raise ValueError('Truncated GLB')
    magic, version, size = struct.unpack_from('<4sII', raw)
    if (magic, version, size) != (b'glTF', 2, len(raw)): raise ValueError('Invalid GLB header')
    n, kind = struct.unpack_from('<I4s', raw, 12)
    if kind != b'JSON' or n % 4 or 20+n+8 > size: raise ValueError('Invalid JSON chunk')
    doc = json.loads(raw[20:20+n])
    bn, bk = struct.unpack_from('<I4s', raw, 20+n)
    if bk != b'BIN\0' or bn % 4 or 28+n+bn != size: raise ValueError('Invalid binary chunk')
    if any('uri' in x for x in doc.get('buffers', []) + doc.get('images', [])): raise ValueError('External URI prohibited')
    if len(doc.get('buffers', [])) != 1 or not 0 <= doc['buffers'][0]['byteLength'] <= bn: raise ValueError('Invalid buffer')
    for view in doc.get('bufferViews', []):
        off, count = view.get('byteOffset', 0), view['byteLength']
        if view['buffer'] != 0 or off < 0 or count < 0 or off+count > doc['buffers'][0]['byteLength']: raise ValueError('Invalid bufferView')
    scene = trimesh.load(str(path), force='scene', process=False)
    if not scene.geometry: raise ValueError('No geometry')
    faces = vertices = 0
    for mesh in scene.geometry.values():
        if not isinstance(mesh, trimesh.Trimesh) or not len(mesh.faces) or not len(mesh.vertices): raise ValueError('Missing triangle mesh')
        if not np.isfinite(mesh.vertices).all() or not np.isfinite(mesh.area_faces).all(): raise ValueError('Nonfinite geometry')
        if mesh.faces.min() < 0 or mesh.faces.max() >= len(mesh.vertices): raise ValueError('Index out of range')
        if not (mesh.area_faces > 0).any(): raise ValueError('Degenerate geometry')
        faces += len(mesh.faces); vertices += len(mesh.vertices)
    if not np.isfinite(scene.bounds).all() or max(scene.extents) <= 0: raise ValueError('Invalid world bounds')
    prims = [p for m in doc.get('meshes', []) for p in m.get('primitives', [])]
    color = any('COLOR_0' in p.get('attributes', {}) for p in prims)
    texture = bool(doc.get('images')) and any(m.get('pbrMetallicRoughness', {}).get('baseColorTexture') for m in doc.get('materials', []))
    if not (color or texture): raise ValueError('Missing vertex color or base-color texture')
    return {'status':'STRUCTURAL_REVIEW_ONLY','sha256':hashlib.sha256(raw).hexdigest(),'bytes':size,'triangles':faces,'vertices':vertices,'vertex_color':color,'embedded_basecolor_texture':texture,'skin_count':len(doc.get('skins',[])),'runtime_verified':False,'likeness_approved':False,'production_approved':False}

def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('glb',type=pathlib.Path); a=p.parse_args()
    print(json.dumps(inspect(a.glb),indent=2))
if __name__=='__main__': main()
