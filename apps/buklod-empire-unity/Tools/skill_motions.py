"""Original, deterministic skill-specific animation candidates. No network/dependencies."""
import json, math, struct
# (motion name, duration, right pitch, left pitch, right spread, left spread, torso yaw, bow)
# All angles in radians. Matched to canonical hero kit slots; not final choreography approval.
PROFILES={
 "phan": [
  [
   "groundbreaker",
   0.88,
   -2.15,
   -1.25,
   -0.36,
   0.24,
   0.48,
   0.4
  ],
  [
   "foundation_wall",
   1.05,
   -1.45,
   -1.45,
   -0.62,
   0.62,
   0.06,
   -0.18
  ],
  [
   "bayanihan_bastion",
   1.35,
   -1.8,
   -1.8,
   -0.95,
   0.95,
   0.1,
   -0.24
  ]
 ],
 "quin": [
  [
   "route_dash",
   0.55,
   -0.65,
   0.55,
   -0.3,
   0.12,
   0.42,
   0.4
  ],
  [
   "beacon_mark",
   0.8,
   -1.5,
   -0.6,
   -0.12,
   0.18,
   -0.22,
   0.12
  ],
  [
   "horizon_corridor",
   1.22,
   -1.7,
   -1.1,
   -0.7,
   0.82,
   0.55,
   -0.12
  ]
 ],
 "van": [
  [
   "signal_shield",
   0.85,
   -1.2,
   -0.55,
   -0.28,
   0.24,
   -0.35,
   0.18
  ],
  [
   "intercept_rush",
   0.62,
   -0.88,
   0.4,
   -0.25,
   0.2,
   0.3,
   0.38
  ],
  [
   "command_network",
   1.3,
   -1.6,
   -1.6,
   -0.9,
   0.9,
   -0.35,
   -0.15
  ]
 ],
 "christian": [
  [
   "banner_rush",
   0.72,
   -1.85,
   0.38,
   -0.42,
   0.18,
   0.62,
   0.28
  ],
  [
   "rally_formation",
   0.95,
   -2,
   -0.65,
   -0.55,
   0.35,
   0.22,
   -0.15
  ],
  [
   "stand_united",
   1.36,
   -2.2,
   -1,
   -0.75,
   0.62,
   0.48,
   -0.25
  ]
 ],
 "lhen": [
  [
   "resonance_wave",
   0.8,
   -1.35,
   -0.95,
   -0.42,
   0.6,
   0.54,
   0.08
  ],
  [
   "restorative_beat",
   1.04,
   -0.95,
   -1.25,
   -0.22,
   0.3,
   -0.25,
   -0.13
  ],
  [
   "symphony_of_buklod",
   1.48,
   -1.65,
   -1.7,
   -0.9,
   0.9,
   0.76,
   -0.2
  ]
 ],
 "ace": [
  [
   "field_patch",
   0.82,
   -1.18,
   -1.42,
   -0.12,
   0.18,
   -0.18,
   0.25
  ],
  [
   "knight_step",
   0.57,
   -0.45,
   0.65,
   -0.35,
   0.28,
   0.35,
   0.32
  ],
  [
   "checkmate_rescue",
   1.32,
   -1.52,
   -1.85,
   -0.45,
   0.55,
   -0.42,
   -0.18
  ]
 ],
 "jawo": [
  [
   "vine_riff",
   0.85,
   -1.25,
   -0.48,
   -0.62,
   0.24,
   0.65,
   0.15
  ],
  [
   "echo_skip",
   0.58,
   -0.65,
   0.48,
   -0.45,
   0.32,
   -0.46,
   0.28
  ],
  [
   "canopy_crescendo",
   1.3,
   -1.7,
   -1.45,
   -0.85,
   0.75,
   0.9,
   -0.16
  ]
 ],
 "mitch": [
  [
   "pigment_bolt",
   0.73,
   -1.65,
   -0.5,
   -0.38,
   0.19,
   0.55,
   0.15
  ],
  [
   "mosaic_wall",
   1.04,
   -1.15,
   -1.6,
   -0.65,
   0.5,
   -0.38,
   -0.1
  ],
  [
   "living_canvas",
   1.41,
   -1.45,
   -1.65,
   -1.05,
   0.95,
   0.72,
   -0.22
  ]
 ],
 "niel": [
  [
   "echo_lance",
   0.72,
   -1.6,
   -0.75,
   -0.24,
   0.12,
   0.35,
   0.18
  ],
  [
   "conviction_dash",
   0.62,
   -0.82,
   0.58,
   -0.22,
   0.22,
   0.48,
   0.42
  ],
  [
   "call_of_the_dawn",
   1.38,
   -2.1,
   -1.6,
   -0.75,
   0.7,
   0.55,
   -0.3
  ]
 ],
 "angel": [
  [
   "ledger_shield",
   0.88,
   -1.35,
   -1.12,
   -0.28,
   0.35,
   -0.26,
   0.14
  ],
  [
   "balance_field",
   1.03,
   -1.52,
   -1.52,
   -0.74,
   0.74,
   0.14,
   -0.12
  ],
  [
   "equal_measure",
   1.38,
   -1.8,
   -1.8,
   -1,
   1,
   -0.55,
   -0.25
  ]
 ],
 "vhen": [
  [
   "seed_turret",
   0.98,
   -1.2,
   -0.7,
   -0.3,
   0.18,
   0.38,
   0.48
  ],
  [
   "irrigation_snare",
   0.94,
   -1.65,
   -0.8,
   -0.55,
   0.2,
   -0.6,
   0.34
  ],
  [
   "harvest_engine",
   1.42,
   -2.05,
   -1.1,
   -0.7,
   0.56,
   0.66,
   -0.2
  ]
 ],
 "ellusur": [
  [
   "guiding_path",
   0.86,
   -1.82,
   -0.5,
   -0.44,
   0.2,
   0.4,
   -0.09
  ],
  [
   "seed_sanctuary",
   1.1,
   -1.2,
   -1.4,
   -0.5,
   0.58,
   -0.24,
   0.28
  ],
  [
   "beacon_of_service",
   1.55,
   -2.15,
   -1.7,
   -0.8,
   0.78,
   0.45,
   -0.32
  ]
 ],
 "trudice": [
  [
   "question_sigil",
   0.93,
   -1.45,
   -0.95,
   -0.42,
   0.35,
   0.4,
   0.12
  ],
  [
   "turning_page",
   0.91,
   -0.85,
   -1.4,
   -0.22,
   0.57,
   -0.52,
   -0.08
  ],
  [
   "grand_lesson",
   1.45,
   -1.7,
   -1.9,
   -0.85,
   0.82,
   0.68,
   -0.28
  ]
 ]
}
SLOTS=('Primary','Secondary','Ultimate')
def quat(x,y,z):
    cx,sx=math.cos(x/2),math.sin(x/2);cy,sy=math.cos(y/2),math.sin(y/2);cz,sz=math.cos(z/2),math.sin(z/2)
    return (sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz)
def add_skill_motions(path,hero_id):
    raw=path.read_bytes();magic,version,total=struct.unpack_from('<4sII',raw)
    if (magic,version,total)!=(b'glTF',2,len(raw)):raise ValueError('Invalid GLB')
    n,tag=struct.unpack_from('<I4s',raw,12)
    if tag!=b'JSON':raise ValueError('Missing JSON')
    doc=json.loads(raw[20:20+n]);size,tag=struct.unpack_from('<I4s',raw,20+n)
    if tag!=b'BIN\0' or 28+n+size!=len(raw):raise ValueError('Invalid BIN')
    data=bytearray(raw[28+n:]);views=doc['bufferViews'];access=doc['accessors']
    def add(values,kind):
        data.extend(b'\0'*((-len(data))%4));offset=len(data)
        flat=[v for row in values for v in row] if kind=='VEC4' else values
        payload=struct.pack('<'+'f'*len(flat),*flat);data.extend(payload)
        views.append({'buffer':0,'byteOffset':offset,'byteLength':len(payload)})
        a={'bufferView':len(views)-1,'componentType':5126,'count':len(values),'type':kind}
        if kind=='SCALAR':a.update(min=[values[0]],max=[values[-1]])
        access.append(a);return len(access)-1
    original={a['name'] for a in doc['animations']}
    if original.intersection(('Primary','Secondary')) or 'Ultimate' not in original:raise ValueError('Unexpected existing skill clips')
    # Keep the original Ultimate as a fallback reference, but use the new named Ultimate in gameplay.
    for a in doc['animations']:
        if a['name']=='Ultimate':a['name']='LegacyUltimate'
    joints=doc['skins'][0]['joints']; names={doc['nodes'][j]['name'] for j in joints}
    if not {'Chest','UpperArm_R','UpperArm_L','Forearm_R','Forearm_L'}.issubset(names):raise ValueError('Unexpected rig')
    for slot,(skill,duration,r,l,rz,lz,yaw,bow) in zip(SLOTS,PROFILES[hero_id]):
        times=[duration*t/16 for t in range(17)];time=add(times,'SCALAR');samplers=[];channels=[]
        for j in joints:
            name=doc['nodes'][j]['name'];keys=[]
            for k in range(17):
                t=k/16; pulse=math.sin(math.pi*t)**1.15;wind=math.sin(2*math.pi*t)*pulse
                x=y=z=0.
                if name=='Chest':x=bow*pulse;y=yaw*wind
                elif name=='Head':x=-bow*.4*pulse;y=-yaw*.22*wind
                elif name=='UpperArm_R':x=r*pulse;z=rz*pulse;y=yaw*.18*wind
                elif name=='UpperArm_L':x=l*pulse;z=lz*pulse;y=-yaw*.18*wind
                elif name=='Forearm_R':x=-.48*pulse-.18*wind
                elif name=='Forearm_L':x=-.38*pulse+.12*wind
                elif name=='Mantle':x=-.28*pulse;z=.18*wind
                elif name.startswith('Thigh'):x=-bow*.38*pulse
                elif name.startswith('Shin'):x=abs(bow)*.58*pulse
                keys.append(quat(x,y,z))
            output=add(keys,'VEC4');samplers.append({'input':time,'output':output,'interpolation':'LINEAR'});channels.append({'sampler':len(samplers)-1,'target':{'node':j,'path':'rotation'}})
        doc['animations'].append({'name':slot,'samplers':samplers,'channels':channels,'extras':{'canonicalSkill':skill,'candidate':True}})
    doc['buffers'][0]['byteLength']=len(data);j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4);data.extend(b'\0'*((-len(data))%4));doc_len=len(j)
    # Every appended accessor is four-byte aligned, so final buffer padding is zero.
    out=struct.pack('<4sII',b'glTF',2,28+doc_len+len(data))+struct.pack('<I4s',doc_len,b'JSON')+j+struct.pack('<I4s',len(data),b'BIN\0')+data
    tmp=path.with_suffix('.glb.tmp');tmp.write_bytes(out);tmp.replace(path)
    return [a['name'] for a in doc['animations']]
