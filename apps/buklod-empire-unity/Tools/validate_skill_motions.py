"""Fail-closed offline skill motion validation; uses only the Python standard library."""
import hashlib, json, math, pathlib, struct
from skill_motions import PROFILES, SLOTS

def validate_hero(data, hero_id):
    if len(data)<28 or struct.unpack_from('<4sII',data)!=(b'glTF',2,len(data)):
        raise ValueError('Invalid GLB header')
    size,tag=struct.unpack_from('<I4s',data,12)
    if tag!=b'JSON' or 28+size>len(data):raise ValueError('Invalid JSON chunk')
    doc=json.loads(data[20:20+size]);length,tag=struct.unpack_from('<I4s',data,20+size);buf=data[28+size:]
    if tag!=b'BIN\0' or length!=len(buf) or doc['buffers'][0]['byteLength']!=length:raise ValueError('Invalid binary chunk')
    def accessor(i,kind,width):
        a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
        if a['componentType']!=5126 or a['type']!=kind or a['count']<2 or v.get('buffer')!=0 or v.get('byteStride',width*4)!=width*4:raise ValueError('Unexpected animation accessor')
        offset=v.get('byteOffset',0);start=offset+a.get('byteOffset',0);end=start+a['count']*width*4
        if not 0<=offset<=start<end<=offset+v['byteLength']<=length or start%4:raise ValueError('Animation accessor out of bounds')
        raw=buf[start:end];values=list(struct.iter_unpack('<'+'f'*width,raw))
        if not all(math.isfinite(x) for row in values for x in row):raise ValueError('Non-finite animation value')
        return values,raw
    animations=doc['animations'];names=[a['name'] for a in animations]
    if len(names)!=12 or len(set(names))!=12:raise ValueError('Expected 12 unique named clips')
    joints=set(doc['skins'][0]['joints']);signatures={}
    for slot,profile in zip(SLOTS,PROFILES[hero_id]):
        a=next((a for a in animations if a['name']==slot),None)
        if a is None or a.get('extras',{}).get('canonicalSkill')!=profile[0]:raise ValueError('Missing or mismapped '+slot)
        channels=a['channels'];targets=set();digest=hashlib.sha256();changed=False
        for ch in sorted(channels,key=lambda ch:ch['target']['node']):
            target=ch['target'];node=target['node'];s=a['samplers'][ch['sampler']]
            if node not in joints or node in targets or target['path']!='rotation' or s.get('interpolation')!='LINEAR':raise ValueError('Unexpected rotation channel')
            targets.add(node);times,tbytes=accessor(s['input'],'SCALAR',1);values,vbytes=accessor(s['output'],'VEC4',4)
            if len(times)!=len(values) or abs(times[0][0])>1e-6 or abs(times[-1][0]-profile[1])>1e-5 or any(b[0]<=a[0] for a,b in zip(times,times[1:])):raise ValueError('Invalid skill timing')
            if any(abs(sum(x*x for x in q)-1)>1e-4 for q in values):raise ValueError('Non-unit rotation quaternion')
            changed|=any(any(abs(x-y)>1e-4 for x,y in zip(values[0],q)) for q in values[1:]);digest.update(struct.pack('<I',node));digest.update(tbytes);digest.update(vbytes)
        if targets!=joints or not changed:raise ValueError('Missing joint channels or static skill')
        signatures[slot]=digest.hexdigest()
    if len(set(signatures.values()))!=len(SLOTS):raise ValueError('Duplicate skill motions')
    return signatures

def validate_roster(root):
    root=pathlib.Path(root);manifest=json.loads((root/'manifest.json').read_text());rows=manifest['heroes'];ids=[r['id'] for r in rows]
    if len(ids)!=13 or set(ids)!=set(PROFILES):raise ValueError('Incomplete hero roster')
    signatures=set();report=[]
    for r in rows:
        if r['file']!=r['id']+'.glb':raise ValueError('Unexpected model path')
        data=(root/r['file']).read_bytes()
        if hashlib.sha256(data).hexdigest()!=r['sha256'] or len(data)!=r['bytes']:raise ValueError('Model hash mismatch')
        motions=validate_hero(data,r['id'])
        if signatures.intersection(motions.values()):raise ValueError('Duplicated active motion across heroes')
        signatures.update(motions.values());report.append({'id':r['id'],'sha256':r['sha256'],'skillMotionSignatures':motions})
    if len(signatures)!=39:raise ValueError('Incomplete motion coverage')
    return {'status':'OFFLINE_SKILL_MOTION_VALIDATED_NOT_UNITY_APPROVED','heroCount':len(ids),'distinctSkillMotions':len(signatures),'heroes':report}

if __name__=='__main__':
    root=pathlib.Path(__file__).resolve().parent/'ReviewOutput/heroes'
    report=validate_roster(root)
    (root/'skill-motion-verification.json').write_text(json.dumps(report,indent=2)+'\n')
    print('Verified',report['heroCount'],'heroes and',report['distinctSkillMotions'],'distinct skill motions.')
