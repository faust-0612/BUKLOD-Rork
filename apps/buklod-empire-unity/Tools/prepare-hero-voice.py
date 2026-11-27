"""Local synthetic speech preview only. Never a voice actor recording or release license."""
import hashlib,json,os,pathlib,shutil,subprocess,tempfile,wave
TOOLS=pathlib.Path(__file__).resolve().parent
SOURCE=TOOLS/'hero-dialogue.json'
OUT=TOOLS/'ReviewOutput/hero-voice'
IDS='phan quin van christian lhen ace ellusur jawo mitch niel angel vhen trudice'.split()
SLOTS=('selection','ultimate')
def sha(data):return hashlib.sha256(data).hexdigest()
def source():
    raw=SOURCE.read_bytes();doc=json.loads(raw);heroes=doc['heroes']
    if doc['schema']!=1 or [h['id'] for h in heroes]!=IDS:raise ValueError('Dialogue identity drift')
    for h in heroes:
        if h['gender'] not in ('Male','Female') or not -3<=h['rate']<=3 or any(not 0<len(h[s])<=100 for s in SLOTS):
            raise ValueError('Invalid dialogue')
    return sha(raw),heroes
def inspect(path):
    with wave.open(str(path),'rb') as w:
        n=w.getnframes()
        if (w.getnchannels(),w.getsampwidth(),w.getframerate())!=(1,2,22050) or not 4410<=n<=22050*8:
            raise ValueError('Invalid preview audio: '+path.name)
        raw=w.readframes(n)
        if len(raw)!=n*2 or not any(raw):raise ValueError('Truncated/silent audio')
    return {'file':path.name,'sha256':sha(path.read_bytes()),'bytes':path.stat().st_size,'samples':n}
def verify(folder):
    digest,_=source();doc=json.loads((folder/'manifest.json').read_text())
    if doc['status']!='LOCAL_SYNTHETIC_REVIEW_ONLY' or doc['sourceSha256']!=digest or doc['engine'] not in ('espeak','windows-sapi') or len(doc['clips'])!=26:
        raise ValueError('Invalid voice manifest')
    names={i+'_'+s+'.wav' for i in IDS for s in SLOTS}
    hashes=set()
    for row in doc['clips']:
        if row['file'] not in names or row!=inspect(folder/row['file']) or row['sha256'] in hashes:raise ValueError('Voice clip integrity mismatch')
        names.remove(row['file']);hashes.add(row['sha256'])
    if names:raise ValueError('Incomplete voice roster')
    return doc
def prepare():
    digest,heroes=source()
    try:
        doc=verify(OUT);print('Synthetic voice preview cache verified:',len(doc['clips']));return
    except (OSError,ValueError,KeyError,TypeError,wave.Error,EOFError):
        (OUT/'manifest.json').unlink(missing_ok=True)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    engine=shutil.which('espeak-ng') or shutil.which('espeak')
    sapi=os.name=='nt' and shutil.which('powershell.exe')
    if not engine and not sapi:
        print('No local speech engine. Subtitles and existing announcer retained.');return
    # Keep incomplete output out of the import path. The successful receipt is written last.
    with tempfile.TemporaryDirectory(prefix='hero-voice-',dir=OUT.parent) as temp:
        stage=pathlib.Path(temp)
        try:
            if engine:
                for i,h in enumerate(heroes):
                    voice='en-us+'+('f'+str(1+i%4) if h['gender']=='Female' else 'm'+str(1+i%5))
                    for slot in SLOTS:
                        subprocess.run([engine,'-v',voice,'-s',str(150+h['rate']*9),'-p',str(42+i%7*4),'-w',str(stage/(h['id']+'_'+slot+'.wav')),h[slot]],check=True,timeout=15)
                kind='espeak'
            else:
                subprocess.run([sapi,'-NoProfile','-NonInteractive','-File',str(TOOLS/'generate-hero-voice.ps1'),'-Source',str(SOURCE),'-Destination',str(stage)],check=True,timeout=180)
                kind='windows-sapi'
            rows=[inspect(stage/(i+'_'+s+'.wav')) for i in IDS for s in SLOTS]
            doc={'status':'LOCAL_SYNTHETIC_REVIEW_ONLY','sourceSha256':digest,'engine':kind,'clips':rows}
            (stage/'manifest.json').write_text(json.dumps(doc,indent=2)+'\n',encoding='utf8')
            verify(stage)
            OUT.mkdir(exist_ok=True)
            receipt=OUT/'manifest.json'
            receipt.unlink(missing_ok=True)
            for row in rows:os.replace(stage/row['file'],OUT/row['file'])
            os.replace(stage/'manifest.json',receipt)
            print('Local synthetic voice preview verified:',len(verify(OUT)['clips']),'clips; not approved recordings.')
        except (OSError,ValueError,subprocess.SubprocessError,wave.Error,EOFError) as error:
            # Incomplete/stale voice material must not be imported. Text remains available.
            (OUT/'manifest.json').unlink(missing_ok=True)
            print('Synthetic speech unavailable; keeping subtitles:',type(error).__name__)
if __name__=='__main__':prepare()
