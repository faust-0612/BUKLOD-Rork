"""Original review-only cosmetic GLBs. Standard library; no external art or paid service."""
import copy, hashlib, json, pathlib, struct, zipfile, sys

HEROES=('phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice')
STYLES=('original','radiant','nightwatch','legendary','mythical')
CHANGED={'armor','trim','fabric','leather'}

def unpack(raw):
    if len(raw)<28 or struct.unpack_from('<4sII',raw)!=(b'glTF',2,len(raw)):raise ValueError('Invalid GLB header')
    n,tag=struct.unpack_from('<I4s',raw,12)
    if tag!=b'JSON' or 28+n>len(raw):raise ValueError('Invalid JSON')
    doc=json.loads(raw[20:20+n]);size,tag=struct.unpack_from('<I4s',raw,20+n);binary=raw[28+n:]
    if tag!=b'BIN\0' or size!=len(binary) or doc['buffers'][0]['byteLength']!=size:raise ValueError('Invalid BIN')
    return doc,binary

def pack(doc,binary):
    j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
    return struct.pack('<4sII',b'glTF',2,28+len(j)+len(binary))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary

def mix(rgb,target,amount):
    return [round(a*(1-amount)+b*amount,6) for a,b in zip(rgb,target)]+[1]

def create(raw,hero,style):
    if hero not in HEROES or style not in STYLES:raise ValueError('Unknown hero/style')
    source,binary=unpack(raw);doc=copy.deepcopy(source)
    if len(doc['animations'])!=12 or len(doc['skins'])!=1 or sum(m['name'].startswith('SacredStone_') for m in doc['materials'])!=1:raise ValueError('Incomplete hero')
    if not CHANGED.issubset({m['name'] for m in doc['materials']}):raise ValueError('Missing costume materials')
    for m in doc['materials']:
        name=m['name'];p=m['pbrMetallicRoughness'];rgb=p['baseColorFactor'][:3]
        if style=='radiant' and name in CHANGED:
            target={'armor':(.83,.87,.88),'trim':(.96,.78,.38),'fabric':(.42,.48,.49),'leather':(.37,.26,.18)}[name]
            p['baseColorFactor']=mix(rgb,target,.55 if name=='armor' else .45)
        elif style=='nightwatch' and name in CHANGED:
            target={'armor':(.055,.075,.12),'trim':(.40,.53,.65),'fabric':(.045,.055,.08),'leather':(.055,.045,.065)}[name]
            p['baseColorFactor']=mix(rgb,target,.68 if name=='armor' else .55)
        elif style in ('legendary','mythical') and name in CHANGED:
            # Preserve the original textile textures and geometry; upgrade only costume PBR.
            # Hero-specific source colors survive the blend; the stone itself is immutable.
            if style=='legendary':
                target={'armor':(.58,.45,.22),'trim':(.98,.82,.42),'fabric':(.24,.12,.09),'leather':(.25,.14,.09)}[name]
                metal,rough={'armor':(.88,.25),'trim':(.95,.19),'fabric':(.05,.58),'leather':(.04,.65)}[name]
            else:
                target={'armor':(.23,.30,.48),'trim':(.70,.88,.98),'fabric':(.15,.10,.28),'leather':(.12,.10,.20)}[name]
                metal,rough={'armor':(.83,.21),'trim':(.91,.16),'fabric':(.08,.49),'leather':(.05,.62)}[name]
            p['baseColorFactor']=mix(rgb,target,.60 if name=='trim' else .46)
            p['metallicFactor']=metal
            p['roughnessFactor']=rough
            if name=='trim':
                m['emissiveFactor']=[round(x*(.08 if style=='legendary' else .16),6) for x in p['baseColorFactor'][:3]]
    doc['extras']={**doc.get('extras',{}),'reviewCosmetic':hero+'_'+style,'visualApproval':False}
    result=pack(doc,binary);actual,actualbin=unpack(result)
    if actualbin!=binary:raise ValueError('Geometry/texture/animation buffer changed')
    if any(actual[k]!=source[k] for k in source if k not in ('materials','extras')):raise ValueError('Non-cosmetic document changed')
    for before,after in zip(source['materials'],actual['materials']):
        if before['name'] not in CHANGED and before!=after:raise ValueError('Protected material changed')
        expected=copy.deepcopy(before)
        if before['name'] in CHANGED:
            expected['pbrMetallicRoughness']['baseColorFactor']=after['pbrMetallicRoughness']['baseColorFactor']
            if style in ('legendary','mythical'):
                for k in ('metallicFactor','roughnessFactor'):
                    expected['pbrMetallicRoughness'][k]=after['pbrMetallicRoughness'][k]
                if before['name']=='trim':expected['emissiveFactor']=after['emissiveFactor']
        if expected!=after:raise ValueError('Unexpected material modification')
    return result

def generate(read,write):
    rows=[]
    for hero in HEROES:
        raw=read(hero+'.glb');palettes=set()
        for style in STYLES:
            data=create(raw,hero,style);doc,_=unpack(data)
            signature=tuple(tuple(m['pbrMetallicRoughness']['baseColorFactor']) for m in doc['materials'] if m['name'] in CHANGED)
            if signature in palettes:raise ValueError('Duplicate palette')
            palettes.add(signature);name=hero+'_'+style+'.glb';write(name,data)
            rows.append({'hero':hero,'style':style,'file':name,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'sourceSha256':hashlib.sha256(raw).hexdigest()})
    if len(rows)!=len(HEROES)*len(STYLES):raise ValueError('Incomplete variants')
    write('manifest.json',(json.dumps({'status':'COSMETIC_REVIEW_ONLY','variants':rows},indent=2)+'\n').encode())
    return rows

if __name__=='__main__':
    if len(sys.argv)==3:
        with zipfile.ZipFile(sys.argv[1]) as src,zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED,compresslevel=6) as dest:
            rows=generate(src.read,dest.writestr)
    else:
        root=pathlib.Path(__file__).resolve().parent/'ReviewOutput';dest=root/'variants';dest.mkdir(parents=True,exist_ok=True)
        rows=generate(lambda name:(root/'heroes'/name).read_bytes(),lambda name,data:(dest/name).write_bytes(data))
    print('Validated',len(rows),'cosmetic GLBs; geometry, rig, skills and Sacred Stones unchanged.')
