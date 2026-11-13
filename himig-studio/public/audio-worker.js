"use strict";
(() => {
  // src/arrangement.ts
  var NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var PRESETS = { "1564": [0, 4, 5, 3], "6415": [5, 3, 0, 4], "1645": [0, 5, 3, 4], "1451": [0, 3, 4, 0] };
  var DEGREES = [0, 2, 4, 5, 7, 9, 11];
  var clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  function createMusicEvents(c, duration, sourceChords) {
    const beat = 60 / clamp(c.bpm, 60, 180), bar = 4 * beat;
    const bars = Math.ceil(duration / bar);
    const progression = PRESETS[c.progression] || PRESETS["1564"];
    const root = Math.max(0, NAMES.indexOf(c.key));
    const events = [], chords = [];
    const add = (part, at, span, note, vol, pan = 0) => {
      if (c.parts.includes(part) && at < duration && span > 0) events.push({ part, at, end: Math.min(duration, at + span), note, vol, pan });
    };
    for (let b = 0; b < bars; b++) {
      const degree = progression[b % 4], base = b * bar;
      const suggested = sourceChords?.[b];
      const note = suggested ? suggested.root : (root + DEGREES[degree]) % 12;
      const minor = suggested ? suggested.minor : degree === 1 || degree === 2 || degree === 5;
      const triad = [60 + note, 60 + note + (minor ? 3 : 4), 67 + note];
      chords.push(NAMES[note] + (minor ? "m" : ""));
      const calm = c.genre === "worship" || c.genre === "ballad";
      if (calm) {
        for (const n of triad) add("piano", base, bar * 0.92, n, 0.21, 0.06);
        add("piano", base, beat * 2¶»§q«^