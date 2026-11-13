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
  for (let i = 0; i < pcm.le¶»§q«^