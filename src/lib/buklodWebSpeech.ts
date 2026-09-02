import type { BibleSpeechDelivery } from '@/lib/buklodBibleNarration';

type WebSpeechResult = 'done' | 'stopped' | 'stale';

function speechSynthesis(): SpeechSynthesis | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.speechSynthesis ?? null;
}

function scoreWebVoice(
  voice: SpeechSynthesisVoice,
  language: string,
) {
  const wanted = String(language || 'fil-PH').toLowerCase();
  const base = wanted.split('-')[0];
  const lang = String(voice.lang || '').toLowerCase();
  const name = String(voice.name || '').toLowerCase();
  let score = 0;

  if (lang === wanted || lang === wanted.replace('fil', 'tl')) score += 90;
  else if (lang.startsWith(`${base}-`) || lang === base) score += 60;
  else if (base.startsWith('fil') && (lang.startsWith('tl') || lang.startsWith('fil'))) {
    score += 70;
  } else if (base.startsWith('fil') && lang.startsWith('id')) score += 32;
  else if (base.startsWith('fil') && lang.startsWith('en')) score += 8;

  if (/google/.test(name)) score += 28;
  if (/natural|neural|premium|enhanced|online/.test(name)) score += 16;
  if (/microsoft/.test(name)) score += 10;
  if (/(^|[\s_-])(male|guy|juan|angelo)([\s_-]|$)/.test(name)) score += 12;
  if (/(female|woman|girl|zira|susan)/.test(name)) score -= 6;
  if (voice.localService) score += 3;

  return score;
}

export function pickWebBibleVoice(
  language: string,
  voices: SpeechSynthesisVoice[],
) {
  if (!voices.length) {
    return null;
  }

  return [...voices].sort(
    (a, b) => scoreWebVoice(b, language) - scoreWebVoice(a, language),
  )[0] ?? null;
}

function webRate(rate: number) {
  if (!Number.isFinite(rate)) {
    return 0.96;
  }
  return Math.max(0.88, Math.min(1.04, rate));
}

function webPitch(pitch: number) {
  if (!Number.isFinite(pitch)) {
    return 1;
  }
  return Math.max(0.97, Math.min(1.04, pitch));
}

function waitForWebVoices() {
  const synth = speechSynthesis();
  if (!synth) {
    return Promise.resolve([] as SpeechSynthesisVoice[]);
  }

  const existing = synth.getVoices();
  if (existing.length) {
    return Promise.resolve(existing);
  }

  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const finish = () => {
      synth.removeEventListener('voiceschanged', onChange);
      resolve(synth.getVoices());
    };
    const onChange = () => finish();
    synth.addEventListener('voiceschanged', onChange);
    setTimeout(finish, 900);
  });
}

/**
 * Browser speech for Bible narration.
 * Short utterances plus a watchdog avoid Chrome's silent 15s cutoff
 * without pause/resume, which restarts and sounds unnatural.
 */
export async function speakWebBibleChunk(input: {
  text: string;
  language: string;
  delivery: BibleSpeechDelivery;
  volume: number;
  isCurrent: () => boolean;
}): Promise<WebSpeechResult> {
  const synth = speechSynthesis();
  if (!synth) {
    return 'done';
  }

  const voices = await waitForWebVoices();
  if (!input.isCurrent()) {
    return 'stale';
  }

  return new Promise((resolve) => {
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    const utterance = new SpeechSynthesisUtterance(input.text);

    const finish = (value: WebSpeechResult) => {
      if (settled) {
        return;
      }
      settled = true;
      if (watchdog) {
        clearTimeout(watchdog);
      }
      utterance.onend = null;
      utterance.onerror = null;
      resolve(value);
    };

    utterance.lang = input.language || 'fil-PH';
    utterance.rate = webRate(input.delivery.rate);
    utterance.pitch = webPitch(input.delivery.pitch);
    utterance.volume = Math.max(0, Math.min(1, input.volume));

    const voice = pickWebBibleVoice(input.language, voices);
    if (voice) {
      utterance.voice = voice;
      if (voice.lang) {
        utterance.lang = voice.lang;
      }
    }

    utterance.onend = () => {
      finish(input.isCurrent() ? 'done' : 'stale');
    };
    utterance.onerror = () => {
      finish(input.isCurrent() ? 'done' : 'stale');
    };

    try {
      synth.resume();
      synth.speak(utterance);
    } catch {
      finish('done');
      return;
    }

    watchdog = setTimeout(() => {
      if (settled) {
        return;
      }
      if (!input.isCurrent()) {
        try {
          synth.cancel();
        } catch {
          // ignore
        }
        finish('stale');
        return;
      }
      finish('done');
    }, 14000);
  });
}

export function stopWebBibleSpeech() {
  const synth = speechSynthesis();
  if (!synth) {
    return;
  }
  try {
    synth.cancel();
  } catch {
    // ignore
  }
}

export function warmWebBibleVoices() {
  void waitForWebVoices();
}
