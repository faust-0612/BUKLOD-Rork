#!/usr/bin/env python3
"""Vendor pinned CC0 professional audio as offline Expo assets."""
import hashlib
import json
import pathlib
import subprocess
import tempfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/sounds/kingdom-premium'
SOURCES = {
    'score': ('https://raw.githubusercontent.com/gtherond/crown-of-embers/06c4583f2ac7f36ddd5eb244e567e7caa0cfbf83/Crown%20of%20Embers%20%28Orchestral%20Version%29.mp3', 12000000),
    **{key: (f'https://raw.githubusercontent.com/Barty-Bart/motion-graphics/3d83d987d658601d8a1269eb691622bdcd427335/skills/sound-effects/sfx/kit/{key}.ogg', 200000) for key in ('click','pop','impact','riser','whoosh','tick')},
}

def run(*argv):
    return subprocess.check_output(argv, stderr=subprocess.STDOUT, text=True).strip()

def duration(path):
    return float(run('ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(path)))

def fetch(key, folder):
    url, limit = SOURCES[key]
    if not url.startswith('https://raw.githubusercontent.com/'): raise ValueError('Unauthorized origin')
    req = urllib.request.Request(url, headers={'User-Agent': 'BUKLOD-Audio-Vendor/1.0'})
    path = folder / (key + ('.mp3' if key == 'score' else '.ogg'))
    with urllib.request.urlopen(req, timeout=30) as resp, path.open('wb') as output:
        total = 0
        while True:
            chunk = resp.read(65536)
            if not chunk: break
            total += len(chunk)
            if total > limit: raise ValueError('Oversized source: ' + key)
            output.write(chunk)
    if total < (200000 if key == 'score' else 2000): raise ValueError('Unexpectedly short source: ' + key)
    return path

def main():
    DEST.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='buklod-audio-') as temporary:
        folder = pathlib.Path(temporary)
        files = {key: fetch(key, folder) for key in SOURCES}
        manifest = {'license':'CC0-1.0', 'sources':{}, 'outputs':{}}
        for key, path in files.items():
            manifest['sources'][key] = {'url':SOURCES[key][0], 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        if duration(files['score']) < 59: raise ValueError('Orchestral recording too short for seamless loop')
        score = DEST / 'kingdom-score.mp3'
        # The loop starts and ends on source second 5, with a seamless crossfade.
        filtergraph = ('[0:a]atrim=start=5:end=52,asetpts=PTS-STARTPTS[body];'
                       '[0:a]atrim=start=52:end=57,asetpts=PTS-STARTPTS[tail];'
                       '[0:a]atrim=start=0:end=5,asetpts=PTS-STARTPTS[head];'
                       '[tail][head]acrossfade=d=5:c1=tri:c2=tri[seam];'
                       '[body][seam]concat=n=2:v=0:a=1,volume=-5dB[out]')
        run('ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y','-i',str(files['score']),'-filter_complex',filtergraph,'-map','[out]','-ac','2','-ar','44100','-c:a','libmp3lame','-b:a','112k',str(score))
        if not 51 <= duration(score) <= 54: raise ValueError('Invalid music duration')
        for key in SOURCES:
            if key == 'score': continue
            dest = DEST / (key+'.mp3')
            run('ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y','-i',str(files[key]),'-af','alimiter=limit=0.85','-ac','2','-ar','44100','-c:a','libmp3lame','-b:a','96k',str(dest))
            if not 0 < duration(dest) <= 12: raise ValueError('Invalid sound effect: '+key)
        for path in DEST.glob('*.mp3'):
            manifest['outputs'][path.name] = {'duration':round(duration(path),3),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        (DEST/'assets.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Verified offline Kingdom audio:',', '.join(sorted(manifest['outputs'])))

if __name__ == '__main__': main()
