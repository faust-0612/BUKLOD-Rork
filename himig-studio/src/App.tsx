import { useCallback, useEffect, useRef, useState } from 'react';
import { stereoWav, chordNotes } from './arrangement';
import type { Config, Part, Analysis, Outcome } from './arrangement';
import {
  AudioLines,
  Download,
  FileAudio,
  Headphones,
  Music2,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react';

type Mode = 'preserve' | 'polish' | 'suggest';
type Genre = 'modern-pop' | 'worship' | 'acoustic' | 'ballad' | 'rnb' | 'opm';
type PitchAnalysis = {
  detected: boolean;
  note: string | null;
  cents: number | null;
  frequencyHz: number | null;
  voicedWindows: number;
};
const genreNames: Record<Genre, string> = {
  'modern-pop': 'Modern pop',
  worship: 'Worship',
  acoustic: 'Acoustic',
  ballad: 'Ballad',
  rnb: 'R&B',
  opm: 'OPM',
};

function wavBlob(pcm: Int16Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const data = new DataView(buf);
  const write = (index: number, text: string) => {
    for (let j = 0; j < text.length; j++)
      data.setUint8(index + j, text.charCodeAt(j));
  };
  write(0, 'RIFF');
  data.setUint32(4, 36 + pcm.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, rate, true);
  data.setUint32(28, rate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  write(36, 'data');
  data.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) data.setInt16(44 + i * 2, pcm[i], true);
  return new Blob([buf], { type: 'audio/wav' });
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 120000);
}

function makeDemo(): AudioBuffer {
  const rate = 44100;
  const ctx = new AudioContext({ sampleRate: rate });
  const buffer = ctx.createBuffer(1, rate * 4, rate);
  const out = buffer.getChannelData(0);
  const notes = [220, 246.94, 261.63, 293.66, 329.63, 293.66, 261.63, 220];
  for (let i = 0; i < out.length; i++) {
    const segment = Math.min(notes.length - 1, Math.floor(i / (rate / 2)));
    const local = (i % (rate / 2)) / rate;
    const env =
      Math.max(0, Math.min(1, local * 25)) *
      Math.max(0, Math.min(1, (0.5 - local) * 10));
    const phase = i / rate;
    const f = notes[segment];
    out[i] =
      env *
      (0.22 * Math.sin(2 * Math.PI * f * phase) +
        0.08 * Math.sin(2 * Math.PI * f * 2 * phase));
  }
  void ctx.close();
  return buffer;
}

export default function App() {
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [backingFile, setBackingFile] = useState<File | null>(null);
  const [lyrics, setLyrics] = useState('');
  const [mode, setMode] = useState<Mode>('polish');
  const [genre, setGenre] = useState<Genre>('modern-pop');
  const [backingLevel, setBackingLevel] = useState(32);
  const [songKey, setSongKey] = useState('auto');
  const [tempo, setTempo] = useState('auto');
  const [progression, setProgression] = useState('source');
  const [parts, setParts] = useState<Part[]>(['piano','guitar','bass','strings','drums']);
  const [arrangementLevel, setArrangementLevel] = useState(70);
  const [vocalLevel, setVocalLevel] = useState(90);
  const [ambience, setAmbience] = useState(20);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [musicResult, setMusicResult] = useState<Outcome | null>(null);
  const [approved,setApproved]=useState(false);
  const [renderMessage, setRenderMessage] = useState('');
  const [beforeUrl, setBeforeUrl] = useState('');
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [percentage, setPercentage] = useState(0);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [pitch, setPitch] = useState<PitchAnalysis | null>(null);
  const [ready, setReady] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const resultRef = useRef<{ pcm: Int16Array; rate: number } | null>(null);
  const activeRef = useRef(0);
  const urlRef = useRef('');
  const audioRef = useRef<AudioBuffer | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerStopRef = useRef<(() => void) | null>(null);
  const stereoRef = useRef<{pcm:Int16Array;rate:number;config:Config;chords:string[]}|null>(null);

  useEffect(() => { setReady(typeof Worker !== 'undefined' && typeof AudioContext !== 'undefined'); }, []);
  useEffect(() => {
    if(!voiceFile){setBeforeUrl('');return;}
    const src=URL.createObjectURL(voiceFile);
    setBeforeUrl(src);
    return ()=>URL.revokeObjectURL(src);
  },[voiceFile]);
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      workerStopRef.current?.();
      workerRef.current?.terminate();
      activeRef.current += 1;
    },
    []
  );

  const resetResult = useCallback(() => {
    activeRef.current += 1;
    workerStopRef.current?.();
    workerRef.current?.terminate();
    workerRef.current = null;
    setBusy(false);
    resultRef.current = null;
    setUrl('');
    setPitch(null);
    setProcessingLabel('');
    stereoRef.current = null;
    setMusicResult(null);setApproved(false);
    setRenderMessage('');
    setPercentage(0);
    setError('');
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = '';
  }, []);

  async function loadFile(file: File): Promise<AudioBuffer> {
    if (file.size > 45 * 1024 * 1024)
      throw new Error('Choose an audio file smaller than 45 MB.');
    const ctx = new AudioContext();
    try {
      const bytes = await file.arrayBuffer();
      return await ctx.decodeAudioData(bytes.slice(0));
    } finally {
      void ctx.close();
    }
  }

  async function render() {
    if (!ready || busy || (!voiceFile && !demo)) return;
    const ticket = ++activeRef.current;
    setBusy(true);
    setError('');
    setUrl('');
    setPitch(null);
    resultRef.current = null;
    try {
      const decoded =
        demo && !voiceFile ? makeDemo() : await loadFile(voiceFile!);
      audioRef.current = decoded;
      const rate = decoded.sampleRate;
      if (![16000, 22050, 32000, 44100, 48000].includes(rate))
        throw new Error(
          'This sample rate is not yet supported. Convert your recording to 44.1 kHz WAV or MP3.'
        );
      if (decoded.duration > 240)
        throw new Error('Maximum song length is four minutes in this version.');
      if (decoded.duration < 0.2) throw new Error('Recording is too short.');
      const count = decoded.length;
      const channels = Array.from(
        { length: decoded.numberOfChannels },
        (_, i) => decoded.getChannelData(i)
      );
      const mono = new Float32Array(count);
      let globalPeak = 0;
      for (let i = 0; i < count; i++) {
        let sample = 0;
        for (const channel of channels) sample += channel[i] / channels.length;
        mono[i] = sample;
        globalPeak = Math.max(globalPeak, Math.abs(sample));
      }
      if (globalPeak < 0.00002)
        throw new Error(
          'The recording is silent. Upload a recording with audible sound.'
        );
      if (!parts.length) throw new Error('Select at least one new instrument.');
      setRenderMessage('Analyzing musical key and tempo inside the audio worker');
      const config: Config = {
        key: songKey === 'auto' ? '__AUTO__' : songKey,
        bpm: tempo === 'auto' ? 0 : Number(tempo),
        genre, progression, parts, strength: arrangementLevel,
        vocal: vocalLevel, ambience
      };
      setRenderMessage('Preparing offline song renderer');
      let backing: Float32Array | undefined;
      if (backingFile && backingLevel > 0) {
        const backingDecoded = await loadFile(backingFile);
        backing = new Float32Array(count);
        const backingChannels = Array.from(
          { length: backingDecoded.numberOfChannels },
          (_, channel) => backingDecoded.getChannelData(channel)
        );
        const ratio = backingDecoded.sampleRate / rate;
        for (let i = 0; i < count; i++) {
          const sample = i * ratio;
          const j = Math.floor(sample);
          if (j >= backingDecoded.length) break;
          let mixed = 0;
          for (const channel of backingChannels) {
            const first = channel[j];
            const second = channel[Math.min(channel.length - 1, j + 1)];
            mixed += (first + (second - first) * (sample - j)) / backingChannels.length;
          }
          backing[i] = mixed;
        }
      }
      if (ticket !== activeRef.current) throw new Error('Processing cancelled.');
      const peakGain = mode === 'suggest'
        ? 1
        : Math.min(3, Math.max(.7, .75 / globalPeak));
      const outcome = await new Promise<{ pcm: Int16Array; result: Outcome }>((resolve, reject) => {
        const worker = new Worker('/audio-worker.js');
        workerRef.current = worker;
        let finished = false;
        let watchdog = 0;
        const cleanup = () => {
          if (finished) return false;
          finished = true;
          window.clearTimeout(watchdog);
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
          workerStopRef.current = null;
          return true;
        };
        const fail = (message: string) => {
          if (cleanup()) reject(new Error(message));
        };
        const armWatchdog = () => {
          window.clearTimeout(watchdog);
          watchdog = window.setTimeout(
            () => fail('Audio processing stopped responding. Try again; no upload or paid job is lost.'),
            45000
          );
        };
        workerStopRef.current = () => fail('Processing cancelled.');
        worker.onmessage = event => {
          if (ticket !== activeRef.current) {
            fail('Processing cancelled.');
            return;
          }
          const message = event.data as {
            type: string; percent?: number; message?: string;
            stereo?: Int16Array; result?: Outcome;
          };
          if (message.type === 'progress') {
            armWatchdog();
            setPercentage(Math.max(0, Math.min(99, message.percent ?? 0)));
            setRenderMessage(message.message || 'Rendering audio locally');
            return;
          }
          if (message.type === 'error') {
            fail(message.message || 'Song processing failed.');
            return;
          }
          if (message.type === 'complete') {
            if (!message.stereo || !message.result || message.stereo.length !== count * 2) {
              fail('The audio engine returned an incomplete recording.');
              return;
            }
            const complete = { pcm: message.stereo, result: message.result };
            if (cleanup()) resolve(complete);
          }
        };
        worker.onerror = () => fail('The browser audio worker crashed. Close other tabs and retry.');
        worker.onmessageerror = () => fail('The audio worker returned an unreadable result.');
        armWatchdog();
        try {
          const transfer: Transferable[] = [mono.buffer];
          if (backing) transfer.push(backing.buffer);
          worker.postMessage({
            type: 'render', mono, backing, sampleRate: rate,
            mode, config, gain: peakGain, backingLevel: backingLevel / 100
          }, transfer);
        } catch {
          fail('Your browser could not start the offline audio renderer.');
        }
      });
      if (ticket !== activeRef.current) throw new Error('Processing cancelled.');
      if (outcome.result.backingRms < .00003 || outcome.result.eventCount === 0) {
        throw new Error('No accompaniment was produced; the export was not marked successful.');
      }
      const next = URL.createObjectURL(stereoWav(outcome.pcm, rate));
      const finalConfig = outcome.result.resolvedConfig || config;
      stereoRef.current = { pcm: outcome.pcm, rate, config: finalConfig, chords: outcome.result.chords };
      if (outcome.result.songAnalysis) setAnalysis(outcome.result.songAnalysis);
      setMusicResult(outcome.result);
      setPercentage(100);
      setRenderMessage('New accompaniment and studio mix complete');
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = next;
      resultRef.current = { pcm: new Int16Array(0), rate };
      setPitch(null);
      setProcessingLabel('Offline multi-instrument backing + original voice · stereo recording');
      setUrl(next);
    } catch (err) {
      if (ticket === activeRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : 'Rendering failed. You can retry.'
        );
        resultRef.current = null;
      }
    } finally {
      if (ticket === activeRef.current) setBusy(false);
    }
  }

  async function saveMp3() {
    if(!approved)return;
    const result = resultRef.current;
    if (!result) return;
    setError('');
    try {
      const module = await import('lamejs');
      const Lame = module.default || module;
      if(stereoRef.current){
        const mix=stereoRef.current;
        const encoder=new Lame.Mp3Encoder(2,mix.rate,192);
        const parts:Uint8Array[]=[];
        for(let start=0;start<mix.pcm.length/2;start+=1152){
          const len=Math.min(1152,mix.pcm.length/2-start);
          const l=new Int16Array(len),r=new Int16Array(len);
          for(let i=0;i<len;i++){
            l[i]=mix.pcm[(start+i)*2];
            r[i]=mix.pcm[(start+i)*2+1];
          }
          const bytes=encoder.encodeBuffer(l,r);
          if(bytes.length)parts.push(new Uint8Array(bytes));
          if(start%(1152*40)===0)await new Promise(resolve=>window.setTimeout(resolve,0));
        }
        const tail=encoder.flush();
        if(tail.length)parts.push(new Uint8Array(tail));
        if(!parts.length)throw new Error('MP3 encoding returned no bytes');
        download(new Blob(parts as BlobPart[],{type:'audio/mpeg'}),'himig-arranged-song.mp3');
        return;
      }
      const encoder = new Lame.Mp3Encoder(1, result.rate, 160);
      const blocks: Uint8Array[] = [];
      for (let i = 0; i < result.pcm.length; i += 1152) {
        const bytes = encoder.encodeBuffer(result.pcm.subarray(i, i + 1152));
        if (bytes.length) blocks.push(new Uint8Array(bytes));
        if (i % (1152 * 60) === 0)
          await new Promise(resolve => window.setTimeout(resolve, 0));
      }
      const final = encoder.flush();
      if (final.length) blocks.push(new Uint8Array(final));
      download(
        new Blob(blocks as BlobPart[], { type: 'audio/mpeg' }),
        'himig-refined.mp3'
      );
    } catch {
      setError(
        'MP3 encoding was unavailable in this browser. WAV export is still available.'
      );
    }
  }

  const hasAudio = Boolean(voiceFile || demo);
  return (
    <main className="shell">
      <header className="brand">
        <div className="logo">
          <AudioLines size={24} />
        </div>
        <div>
          <span className="overline">ORIGINAL MUSIC WORKSPACE</span>
          <h1>Himig Studio</h1>
          <p>Preserve your original song, add a full instrumental arrangement, and mix your own voice.</p>
        </div>
      </header>
      <div className="two-col">
        <section className="panel">
          <div className="heading">
            <span className="step">01</span>
            <h2>Approved lyrics & draft</h2>
          </div>
          <label className="field-label" htmlFor="lyrics">
            Your approved lyrics{' '}
            <span className="muted">(kept in this browser)</span>
          </label>
          <textarea
            id="lyrics"
            value={lyrics}
            onChange={e => setLyrics(e.target.value)}
            placeholder="Paste your final approved lyrics here. We will not rewrite them."
            rows={5}
          />
          <div className="upload-grid">
            <label className="upload">
              {' '}
              <FileAudio size={20} />
              <strong>Draft vocal recording</strong>
              <small>
                {voiceFile
                  ? voiceFile.name
                  : 'Choose audio · MP3, WAV, M4A, etc.'}
              </small>
              <input
                aria-label="Draft vocal recording"
                type="file"
                accept="audio/*,.m4a"
                onChange={e => {
                  setVoiceFile(e.target.files?.[0] || null);
                  setDemo(false);
                  resetResult();
                }}
              />
            </label>
            <label className="upload">
              <Music2 size={20} />
              <strong>Instrumental (optional)</strong>
              <small>
                {backingFile
                  ? backingFile.name
                  : 'Mix in your own backing track'}
              </small>
              <input
                aria-label="Optional instrumental backing track"
                type="file"
                accept="audio/*,.m4a"
                onChange={e => {
                  setBackingFile(e.target.files?.[0] || null);
                  resetResult();
                }}
              />
            </label>
          </div>
          <button
            className="link-button"
            onClick={() => {
              setDemo(true);
              setVoiceFile(null);
              resetResult();
            }}
          >
            Use original demo melody for a quick engine test
          </button>
          {backingFile && (
            <label className="field-label slider-label">
              Instrumental volume {backingLevel}%
              <input
                type="range"
                min="0"
                max="70"
                value={backingLevel}
                onChange={e => {
                  setBackingLevel(Number(e.target.value));
                  resetResult();
                }}
              />
            </label>
          )}
          <div className="heading second">
            <span className="step">02</span>
            <h2>Refine the recording</h2>
          </div>
          <p className="field-label">How much should we change?</p>
          <div className="segments" role="group" aria-label="Refinement mode">
            {(['preserve', 'polish', 'suggest'] as Mode[]).map(m => (
              <button
                key={m}
                className={mode === m ? 'selected' : ''}
                onClick={() => {
                  setMode(m);
                  resetResult();
                }}
              >
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <p className="help">
            {mode === 'preserve'
              ? 'Gentle cleanup to keep vocal dynamics and expression.'
              : mode === 'polish'
                ? 'Voice cleanup, consistent dynamics and loudness. Pitch guidance is advisory.'
                : 'Analyze pitch without changing the audio samples.'}
          </p>
          <label className="field-label" htmlFor="genre">
            Genre & arrangement
          </label>
          <select
            id="genre"
            value={genre}
            onChange={e => {
              setGenre(e.target.value as Genre);
              resetResult();
            }}
          >
            {(Object.keys(genreNames) as Genre[]).map(g => (
              <option value={g} key={g}>
                {genreNames[g]}
              </option>
            ))}
          </select>
          <div className="arrangement-panel">
            <div className="arrangement-head"><Music2 size={23}/><div><strong>New instrumental accompaniment</strong><small>Automatically compose instrumental backing to your chosen chords and tempo.</small></div></div>
            <div className="arrangement-fields">
              <label className="field-label">Song key
                <select aria-label="Song key" value={songKey} onChange={e=>{setSongKey(e.target.value);resetResult();}}>
                  <option value="auto">Auto estimate</option>
                  {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map(note=><option key={note} value={note}>{note} major</option>)}
                </select>
              </label>
              <label className="field-label">Tempo
                <select aria-label="Tempo" value={tempo} onChange={e=>{setTempo(e.target.value);resetResult();}}>
                  <option value="auto">Auto estimate</option>
                  {[65,70,75,80,85,90,95,100,105,110,115,120,130,140,150,160].map(bpm=><option key={bpm} value={bpm}>{bpm} BPM</option>)}
                </select>
              </label>
            </div>
            <label className="field-label">Chord progression
              <select aria-label="Chord progression" value={progression} onChange={e=>{setProgression(e.target.value);resetResult();}}>
                <option value="source">Follow uploaded recording (estimated chords)</option>
                <option value="1564">I - V - vi - IV</option>
                <option value="6415">vi - IV - I - V</option>
                <option value="1645">I - vi - IV - V</option>
                <option value="1451">I - IV - V - I</option>
              </select>
            </label>
            <span className="field-label">Choose accompanying instruments</span>
            <div className="track-list">
              {(['piano','guitar','bass','strings','drums'] as Part[]).map(p=><label className="track-choice" key={p}>
                <input type="checkbox" checked={parts.includes(p)} onChange={e=>{setParts(old=>e.target.checked?[...old,p]:old.filter(q=>q!==p));resetResult();}}/>
                <span>{p==='piano'?'🎹':p==='guitar'?'🎸':p==='bass'?'🎵':p==='strings'?'🎻':'🥁'} {p[0].toUpperCase()+p.slice(1)}</span>
              </label>)}
            </div>
            <label className="field-label slider-label">New instruments: {arrangementLevel}%
              <input aria-label="Instrument strength" type="range" min="15" max="100" value={arrangementLevel} onChange={e=>{setArrangementLevel(Number(e.target.value));resetResult();}}/>
            </label>
            <label className="field-label slider-label">Original voice level: {vocalLevel}%
              <input aria-label="Vocal strength" type="range" min="50" max="120" value={vocalLevel} onChange={e=>{setVocalLevel(Number(e.target.value));resetResult();}}/>
            </label>
            <label className="field-label slider-label">Vocal studio ambience: {ambience}%
              <input aria-label="Voice ambience" type="range" min="0" max="60" value={ambience} onChange={e=>{setAmbience(Number(e.target.value));resetResult();}}/>
            </label>
            <p className="arrangement-warning">Your uploaded recording is the musical reference. Source-following estimates chords across the full song, rather than repeating a fixed four-chord loop. A melody alone can allow several harmonizations; review and approve this draft before using it as a final master.</p>
          </div>
          <label className="field-label" htmlFor="voice">
            Vocal direction
          </label>
          <select id="voice">
            <option>Keep my own voice · EQ, compression and ambience</option>
          </select>
          <div className="detail">
            <Sparkles size={20} />
            <div>
              <strong>Tagalog clarity & pitch guide</strong>
              <small>
                Actual voice is kept. We can analyze a representative note;
                lyric pronunciation and per-note correction require a separate
                validated model.
              </small>
            </div>
          </div>
          <button
            className="primary"
            onClick={render}
            disabled={!ready || busy || !hasAudio}
          >
            <WandSparkles size={20} />
            {busy ? 'Rendering locally…' : 'Produce song with new instruments'}
          </button>
          {busy && <button className="link-button" type="button" onClick={resetResult}>Cancel processing</button>}
          {busy && (
            <div className="progress" aria-label="Render progress">
              <div style={{ width: percentage + '%' }} />
            </div>
          )}
          <div className="status" role="status">
            {busy
              ? percentage + '% · ' + renderMessage
              : ready
                ? 'Offline renderer ready · No per-chunk server uploads'
                : 'Checking audio engine connection…'}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside className="panel result">
          <div className="heading">
            <span className="step">03</span>
            <h2>Preview & export</h2>
          </div>
          {url ? (
            <>
              <span className="success">
                <ShieldCheck size={17} /> Arrangement draft rendered · Approval required
              </span>
              <p>{processingLabel}</p>
              {beforeUrl && <div className="compare-audio"><strong>BEFORE · Your uploaded draft</strong><audio controls src={beforeUrl} aria-label="Original recording before arrangement" /></div>}
              <div className="compare-audio"><strong>AFTER · Newly arranged song with accompaniment</strong><audio controls src={url} aria-label="Finished song with newly generated instruments" /></div>
              <label className="music-approval">
                <input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} />
                <span>I listened to the result and approve its lyrics, melody, timing and harmony for export. These automatic chord estimates are not guaranteed.</span>
              </label>
              <div className="actions">
                <button
                  className="export"
                  disabled={!approved}
                  onClick={() => {
                    const r = resultRef.current;
                    if (r)
                      download(stereoRef.current?stereoWav(stereoRef.current.pcm,stereoRef.current.rate):wavBlob(r.pcm,r.rate),'himig-arranged-song.wav');
                  }}
                >
                  <Download size={18} /> Export WAV
                </button>
                <button className="export" disabled={!approved} onClick={saveMp3}>
                  <Download size={18} /> Export MP3
                </button>
              </div>
              {musicResult&&stereoRef.current&&<div className="arrangement-summary">
                <strong>ARRANGEMENT DRAFT · not a verified studio master</strong>
                {typeof musicResult.harmonyConfidence === 'number' && <p><b>Source-harmony confidence:</b> {(musicResult.harmonyConfidence*100).toFixed(0)}% heuristic score · {musicResult.lowConfidenceBars}/{musicResult.totalBars} bars uncertain. This is NOT a percent musical accuracy guarantee.</p>}
                <strong>Arrangement draft (not a verified studio master)</strong>
                <p><b>New parts:</b> {stereoRef.current.config.parts.join(' · ')}</p>
                <p><b>Chord cycle:</b> {musicResult.chords.slice(0,4).join(' - ')}</p>
                <p><b>Actual instrument events:</b> {musicResult.eventCount}</p>
                <p><b>Verified backing audio signal:</b> {musicResult.backingRms.toFixed(4)} RMS (nonzero)</p>
                <p><b>Instrument generation:</b> lightweight offline synthesis; no large sample downloads.</p>
                <p><b>Voice comparison:</b> The generated song adds a new instrumental backing while keeping your original vocal. The original audio can be played separately using the uploaded source file.</p>
                {analysis&&<p>Estimated song key: {analysis.key}, tempo {analysis.bpm} BPM ({analysis.confidence})</p>}
                <button className="notes-export" onClick={()=>download(new Blob([chordNotes(stereoRef.current!.config,stereoRef.current!.chords)],{type:'text/plain'}),'himig-chord-arrangement.txt')}>Export chord & arrangement notes</button>
              </div>}
              {pitch?.detected && (
                <div className="analysis">
                  <strong>Pitch guide (representative)</strong>
                  <div>
                    <b>{pitch.note}</b>
                    <span>
                      {pitch.frequencyHz} Hz ·{' '}
                      {pitch.cents && pitch.cents > 0 ? '+' : ''}
                      {pitch.cents} cents
                    </span>
                  </div>
                  <small>
                    Estimate from a short voiced portion, not a verified key or
                    complete chord chart.
                  </small>
                </div>
              )}
            </>
          ) : (
            <div className="empty">
              <Headphones size={48} />
              <h3>Your finished preview appears here</h3>
              <p>
                Upload your voice recording or select the demo and process it to
                enable real audio playback and exports.
              </p>
            </div>
          )}
          <div className="notice">
            <ShieldCheck size={18} />
            <span>
              Original lyrics and voice stay yours. This version processes audio
              transiently in memory; it does not send a paid music-generation
              job.
            </span>
          </div>
          <div className="scope">
            <strong>What this engine does</strong>
            <p>
              Actual instrumental creation: piano, guitar, bass, strings and drums, rendered as separate musical notes; stereo mixing, original-voice compression and ambience, editable chord cycles and WAV/MP3 exports. Exact chord transcription, realistic voice reconstruction and AI song mastering are not yet implemented.
            </p>
          </div>
        </aside>
      </div>
      <footer>
        HIMIG STUDIO · Original compositions remain yours · Instrument samples: FluidR3 GM, CC BY 3.0 (gleitz/midi-js-soundfonts)
      </footer>
    </main>
  );
}
