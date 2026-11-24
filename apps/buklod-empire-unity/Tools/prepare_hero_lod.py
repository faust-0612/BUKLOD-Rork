"""Generate a lower-tessellation review mesh per hero without changing rig or skills."""
import hashlib, importlib.util, json, pathlib, struct
from validate_skill_motions import validate_hero

ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('hero_review',ROOT/'prepare-hero-review.py')
hero=importlib.util.module_from_spec(spec);spec.loader.exec_module(hero)

def inspect(data):
    if struct.unpack_from('<4sII',data)!=(b'glTF',2,len(data)):raise ValueError('Invalid GLB')
    n,tag=struct.unpack_from('<I4s',data,12)
    if tag!=b'JSON':raise ValueError('Invalid JSON')
    doc=json.loads(data[20:20+n]);length,tag=struct.unpack_from('<I4s',data,20+n);binary=data[28+n:]
    if tag!=b'BIN\0' or len(binary)!=length:raise ValueError('Invalid binary')
    def acc(i):
        a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
        width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]*{5123:2,5126:4}[a['componentType']]
        start=v.get('byteOffset',0)+a.get('byteOffset',0);end=start+a['count']*width
        if v.get('byteStride',width)!=width or end>v.get('byteOffset',0)+v['byteLength'] or end>len(binary):raise ValueError('Invalid accessor')
        return binary[start:end]
    rig=doc['skins'][0];motion=[]
    for a in doc['animations']:
        motion.append((a['name'],a['channels'],a.get('extras'),[(s.get('interpolation'),acc(s['input']),acc(s['output'])) for s in a['samplers']]))
    tri=sum(doc['accessors'][p['indices']]['count']//3 for m in doc['meshes'] for p in m['primitives'])
    return (doc['nodes'],rig['joints'],acc(rig['inverseBindMatrices']),motion,doc['materials'],tri)

def main():
    full=ROOT/'ReviewOutput/heroes';out=ROOT/'ReviewOutput/hero-lod';out.mkdir(parents=True,exist_ok=True)
    rows=[]
    for id,profile in hero.original.HEROES.items():
        source=(full/(id+'.glb')).read_bytes();h=hero.Candidate(id,profile);h.mobile_lod=True
        path=out/(id+'.glb');h.export(path);hero.texture_glb(path);hero.add_skill_motions(path,id)
        data=path.read_bytes();a=inspect(source);b=inspect(data)
        if a[:5]!=b[:5]:raise ValueError('Rig, motions or material identity changed: '+id)
        if b[5]>=a[5]*.80:raise ValueError('Insufficient mesh reduction: '+id)
        if validate_hero(source,id)!=validate_hero(data,id):raise ValueError('Skill motion drift')
        rows.append({'id':id,'file':id+'.glb','sha256':hashlib.sha256(data).hexdigest(),'sourceSha256':hashlib.sha256(source).hexdigest(),'bytes':len(data),'fullTriangles':a[5],'lodTriangles':b[5]})
    if len(rows)!=13:raise ValueError('Incomplete LOD roster')
    (out/'manifest.json').write_text(json.dumps({'status':'LOD_REVIEW_ONLY','heroes':rows},indent=2)+'\n')
    print('Generated',len(rows),'LOD meshes:',sum(r['fullTriangles'] for r in rows),'->',sum(r['lodTriangles'] for r in rows),'triangles')
if __name__=='__main__':main()
