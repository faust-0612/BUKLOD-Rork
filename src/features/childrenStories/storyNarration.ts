/**
 * BUKLOD child-story narration. One Expo Speech utterance at a time, so long
 * narratives play continuously without overflowing Android's TTS input limit.
 * No remote service, downloads, child identifiers, or new native dependency.
 */
export type StoryAudioStatus = 'idle' | 'preparing' | 'playing' | 'paused' | 'error';
export type StoryAudioProblem = 'voice-unavailable' | 'engine-unavailable' | 'playback-failed';
export type StoryAudioState = { status: StoryAudioStatus; problem?: StoryAudioProblem };

type DeviceVoice = { identifier: string; language: string; quality?: string };
type SpeechConfig = {
  language?: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error: Error) => void;
  onBoundary?: (event: { charIndex?: number; charLength?: number }) => void;
};
export type StorySpeechPort = {
  maxSpeechInputLength: number;
  speak(text: string, options: SpeechConfig): void;
  stop(): Promise<void>;
  getAvailableVoicesAsync(): Promise<DeviceVoice[]>;
};
export type StoryNarrationLanguage = 'tl' | 'en';

const normalizeLocale = (value: string) => value.trim().toLowerCase().replace(/_/g, '-');
export function findNarrationVoice(voices: DeviceVoice[], language: StoryNarrationLanguage): DeviceVoice | null {
  const codes = language === 'tl' ? ['fil-ph', 'tl-ph', 'fil', 'tl'] : ['en-us', 'en-ph', 'en-gb', 'en'];
  for (const code of codes) {
    const matching = voices.filter(voice => normalizeLocale(voice.language) === code ||
      (code === 'fil' && normalizeLocale(voice.language).startsWith('fil-')) ||
      (code === 'tl' && normalizeLocale(voice.language).startsWith('tl-')) ||
      (code === 'en' && normalizeLocale(voice.language).startsWith('en-')));
    if (matching.length) return matching.find(voice => voice.quality === 'Enhanced') ?? matching[0];
  }
  return null;
}

export function splitStoryNarration(text: string, inputLimit: number): string[] {
  const safeLimit = Number.isFinite(inputLimit) && inputLimit > 32
    ? Math.min(650, Math.floor(inputLimit) - 8) : 650;
  const chunks: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    let rest = paragraph.replace(/\s+/g, ' ').trim();
    while (rest.length > safeLimit) {
      const space = rest.lastIndexOf(' ', safeLimit);
      const end = space > safeLimit / 2 ? space : safeLimit;
      chunks.push(rest.slice(0, end).trim());
      rest = rest.slice(end).trim();
    }
    if (rest) chunks.push(rest);
  }
  return chunks;
}

/**
 * pause() / resume() aren't implemented by expo-speech on Android.
 * Track the most recently spoken word boundary and restart from that point
 * instead; at worst, replay the current short segment if no boundary arrives.
 */
export class StoryNarrator {
  private epoch = 0;
  private disposed = false;
  private stopChain: Promise<void> = Promise.resolve();
  private state: StoryAudioState = { status: 'idle' };
  private chunks: string[] = [];
  private position = 0;
  private offset = 0;
  private locale = 'fil-PH';
  private voice: string | undefined;
  private rate = 0.88;

  private readonly speech: StorySpeechPort;
  private readonly onState: (state: StoryAudioState) => void;
  private readonly voiceTimeoutMs: number;
  constructor(speech: StorySpeechPort, onState: (state: StoryAudioState) => void, voiceTimeoutMs = 7500) {
    this.speech = speech;
    this.onState = onState;
    this.voiceTimeoutMs = voiceTimeoutMs;
  }

  private publish(state: StoryAudioState) {
    this.state = state;
    if (!this.disposed) this.onState(state);
  }
  private isCurrent(ticket: number) { return !this.disposed && ticket === this.epoch; }
  private stopNative(): Promise<void> {
    // A slow stop may not cancel speech that starts later. Serialize every
    // stop/start transition to prevent stale stops from killing new playback.
    this.stopChain = this.stopChain.catch(() => undefined).then(() => this.speech.stop()).catch(() => undefined);
    return this.stopChain;
  }
  private async readVoices(): Promise<DeviceVoice[]> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.speech.getAvailableVoicesAsync(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Text-to-speech voice lookup timed out')), this.voiceTimeoutMs);
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
  stop(): void {
    ++this.epoch;
    this.chunks = [];
    this.position = 0;
    this.offset = 0;
    this.publish({ status: 'idle' });
    void this.stopNative();
  }
  dispose(): void {
    ++this.epoch;
    this.disposed = true;
    this.chunks = [];
    void this.stopNative();
  }
  async play(text: string, language: StoryNarrationLanguage, bedtime = false): Promise<void> {
    if (this.disposed) return;
    const ticket = ++this.epoch;
    this.publish({ status: 'preparing' });
    await this.stopNative();
    if (!this.isCurrent(ticket)) return;
    const chunks = splitStoryNarration(text, this.speech.maxSpeechInputLength);
    if (!chunks.length) { this.publish({ status: 'idle' }); return; }

    let voices: DeviceVoice[];
    try {
      voices = await this.readVoices();
    } catch {
      if (this.isCurrent(ticket)) this.publish({ status: 'error', problem: 'engine-unavailable' });
      return;
    }
    if (!this.isCurrent(ticket)) return;
    const selected = findNarrationVoice(voices, language);
    if (!selected) {
      this.publish({ status: 'error', problem: voices.length ? 'voice-unavailable' : 'engine-unavailable' });
      return;
    }
    this.locale = selected.language;
    this.voice = selected.identifier;
    this.rate = bedtime ? 0.77 : 0.88;
    this.chunks = chunks;
    this.position = 0;
    this.offset = 0;
    this.sayCurrent(ticket);
  }
  pause(): void {
    if (this.state.status !== 'playing' && this.state.status !== 'preparing') return;
    ++this.epoch;
    this.publish({ status: this.chunks.length ? 'paused' : 'idle' });
    void this.stopNative();
  }
  async resume(): Promise<void> {
    if (this.disposed || this.state.status !== 'paused' || !this.chunks.length) return;
    const ticket = ++this.epoch;
    this.publish({ status: 'preparing' });
    await this.stopNative();
    if (this.isCurrent(ticket)) this.sayCurrent(ticket);
  }
  private sayCurrent(ticket: number): void {
    if (!this.isCurrent(ticket)) return;
    if (this.position >= this.chunks.length) {
      this.publish({ status: 'idle' });
      return;
    }
    const start = this.offset;
    const fragment = this.chunks[this.position].slice(start);
    if (!fragment.trim()) {
      ++this.position;
      this.offset = 0;
      this.sayCurrent(ticket);
      return;
    }
    try {
      this.speech.speak(fragment, {
        language: this.locale, voice: this.voice, rate: this.rate, pitch: 1,
        onStart: () => { if (this.isCurrent(ticket)) this.publish({ status: 'playing' }); },
        onBoundary: event => {
          const index = event?.charIndex;
          if (this.isCurrent(ticket) && Number.isInteger(index) && index! >= 0)
            this.offset = Math.min(this.chunks[this.position].length, start + index!);
        },
        onDone: () => {
          if (!this.isCurrent(ticket)) return;
          ++this.position;
          this.offset = 0;
          this.sayCurrent(ticket);
        },
        onStopped: () => {
          if (!this.isCurrent(ticket)) return;
          ++this.epoch;
          this.publish({ status: 'idle' });
        },
        onError: () => {
          if (!this.isCurrent(ticket)) return;
          ++this.epoch;
          this.publish({ status: 'error', problem: 'playback-failed' });
          void this.stopNative();
        },
      });
    } catch {
      if (!this.isCurrent(ticket)) return;
      ++this.epoch;
      this.publish({ status: 'error', problem: 'playback-failed' });
      void this.stopNative();
    }
  }
}
