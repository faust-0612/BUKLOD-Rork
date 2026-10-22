import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import manifestData from '@/data/henryCommentaryManifest.json';

export type HenryEdition = 'concise' | 'complete';
export type HenryLanguage = 'en' | 'fil';
export type HenrySection = {
  id: string; edition: HenryEdition; book: number; chapter: number;
  start: number; end: number; heading: string; text: string;
  sourceVersion: string; sourceHash: string;
  filipino?: { text: string; sourceHash: string; sourceVersion: string;
    version: string; status: 'draft-for-review'; translator: string; reviewed: false };
};
type Descriptor = { path: string; sha256: string; bytes: number };
type Manifest = { schema: number; version: string;
  packages: Record<string, Descriptor>; mappingNotes: Record<string, string>;
  provenance: Record<HenryEdition, { version: string; license: string; url: string }> };
type Package = { schema: number; version: string; edition: HenryEdition; book: number; entries: HenrySection[] };
const manifest = manifestData as unknown as Manifest;
const BASE_URL = 'https://yhanxndaqbmuzbdqlblu.supabase.co/storage/v1/object/public/buklod-bible-commentary/';
const PREFIX = '@buklod/henry/v1/';
const INDEX = '@buklod/henry/v1-index';
export const HENRY_CACHE_LIMIT_BYTES = 16 * 1024 * 1024;
const MAX_CACHE_ITEMS = 96;
type IndexRow = { key: string; bytes: number; savedAt: number };
let writes: Promise<unknown> = Promise.resolve();
const requests = new Map<string, Promise<Package>>();
const sha256 = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
const byteLength = (text: string) => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
};
const cacheKey = (accountId: string, item: string) => `${PREFIX}${encodeURIComponent(accountId)}/${item}`;

async function save(accountId: string, item: string, text: string): Promise<void> {
  if (!accountId) return;
  const key = cacheKey(accountId, item);
  const bytes = byteLength(text);
  if (bytes > 1024 * 1024) return;
  const write = writes.catch(() => {}).then(async () => {
    const raw = await AsyncStorage.getItem(INDEX);
    let rows: IndexRow[] = [];
    try { rows = raw ? JSON.parse(raw) : []; } catch { rows = []; }
    if (!Array.isArray(rows) || rows.some(row => !row?.key?.startsWith(PREFIX) || !Number.isFinite(row.bytes))) rows = [];
    // A lost/corrupt index must not turn this dedicated cache into unbounded storage.
    if (!rows.length) {
      const orphaned = (await AsyncStorage.getAllKeys()).filter(value => value.startsWith(PREFIX));
      if (orphaned.length) await AsyncStorage.multiRemove(orphaned);
    }
    const next = [{ key, bytes, savedAt: Date.now() }, ...rows.filter(row => row.key !== key)];
    let total = 0;
    const keep = next.filter((row, index) => {
      if (index >= MAX_CACHE_ITEMS || total + row.bytes > HENRY_CACHE_LIMIT_BYTES) return false;
      total += row.bytes; return true;
    });
    const retained = new Set(keep.map(row => row.key));
    await AsyncStorage.setItem(key, text);
    try { await AsyncStorage.setItem(INDEX, JSON.stringify(keep)); }
    catch (error) { await AsyncStorage.removeItem(key); throw error; }
    const evicted = next.filter(row => !retained.has(row.key)).map(row => row.key);
    if (evicted.length) await AsyncStorage.multiRemove(evicted);
  });
  writes = write;
  await write;
}

export function henryLanguageForBible(languageCode: string | null | undefined, translationCode: string): HenryLanguage {
  const code = String(languageCode || '').toLowerCase();
  return /^(fil|tl|tgl)(-|$)/.test(code) || /tagalog|filipino/.test(code) || translationCode.toUpperCase() === 'ASD' ? 'fil' : 'en';
}

export function matchingHenrySections(rows: HenrySection[], book: number, chapter: number, start: number, end: number): HenrySection[] {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) return [];
  return rows.filter(row => row.book === book && row.chapter === chapter && row.start <= end && row.end >= start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function henryMappingNote(edition: HenryEdition, book: number, chapter: number): string | null {
  return manifest.mappingNotes[`${edition}.${book}.${chapter}`] || null;
}

export function henrySource(edition: HenryEdition) { return manifest.provenance[edition]; }

function validatePackage(value: Package, edition: HenryEdition, book: number): void {
  if (value.schema !== 1 || value.version !== manifest.version || value.edition !== edition || value.book !== book || !Array.isArray(value.entries)) throw Error('Commentary package does not match this passage.');
  const sourceVersion = manifest.provenance[edition].version;
  for (const row of value.entries) {
    if (row.edition !== edition || row.book !== book || row.sourceVersion !== sourceVersion || !Number.isInteger(row.chapter) || !Number.isInteger(row.start) || !Number.isInteger(row.end) || row.start < 1 || row.end < row.start || typeof row.text !== 'string' || typeof row.sourceHash !== 'string') throw Error('Invalid commentary section.');
  }
}

export async function loadHenrySections(input: { accountId: string; edition: HenryEdition; book: number; chapter: number; start: number; end: number; online: boolean }): Promise<HenrySection[]> {
  if (!input.accountId) throw Error('Sign in to save commentary for offline reading.');
  const descriptor = manifest.packages[`${input.edition}.${input.book}.${input.chapter}`];
  if (!descriptor) return [];
  const item = `${manifest.version}:${descriptor.sha256}`;
  const requestKey = cacheKey(input.accountId, item);
  let task = requests.get(requestKey);
  if (!task) {
    task = (async () => {
      let raw: string | null = null;
      try { raw = await AsyncStorage.getItem(requestKey); } catch { /* A cache miss can use the verified remote package. */ }
      if (raw && await sha256(raw) !== descriptor.sha256) { await AsyncStorage.removeItem(requestKey); raw = null; }
      if (!raw) {
        if (!input.online) throw Error('This commentary is not saved offline. Connect and retry.');
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 12000);
        try {
          const response = await fetch(BASE_URL + descriptor.path, { signal: abort.signal });
          if (!response.ok) throw Error('Commentary download unavailable. Please retry.');
          raw = await response.text();
          if (byteLength(raw) !== descriptor.bytes || await sha256(raw) !== descriptor.sha256) throw Error('Commentary integrity check failed.');
        } finally { clearTimeout(timer); }
        const parsed = JSON.parse(raw) as Package;
        validatePackage(parsed, input.edition, input.book);
        try { await save(input.accountId, item, raw); } catch { /* Reading stays available if local storage is full. */ }
        return parsed;
      }
      const parsed = JSON.parse(raw) as Package;
      validatePackage(parsed, input.edition, input.book);
      return parsed;
    })();
    requests.set(requestKey, task);
    const clear = () => { if (requests.get(requestKey) === task) requests.delete(requestKey); };
    void task.then(clear, clear);
  }
  const value = await task;
  return matchingHenrySections(value.entries, input.book, input.chapter, input.start, input.end);
}

export async function henryText(row: HenrySection, language: HenryLanguage, accountId: string): Promise<string | null> {
  if (language === 'en') return row.text;
  const draft = row.filipino;
  if (!draft || draft.status !== 'draft-for-review' || draft.sourceHash !== row.sourceHash || draft.sourceVersion !== row.sourceVersion) return savedRuntimeText(row, accountId);
  const item = `${row.id}:fil:${row.sourceVersion}:${draft.version}:${row.sourceHash}`;
  try {
    const saved = await AsyncStorage.getItem(cacheKey(accountId, item));
    if (saved === draft.text) return saved;
    await save(accountId, item, draft.text);
  } catch { /* The exact bundled-source draft remains usable without a storage write. */ }
  return draft.text;
}

const translationTasks = new Map<string, Promise<string>>();
const runtimeItem = (row: HenrySection) => `${row.id}:fil:${row.sourceVersion}:bible-assist-v1:${row.sourceHash}`;
async function savedRuntimeText(row: HenrySection, accountId: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(accountId, runtimeItem(row)));
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value.sourceHash === row.sourceHash && value.sourceVersion === row.sourceVersion && value.status === 'draft-for-review' && typeof value.text === 'string' ? value.text : null;
  } catch { return null; }
}
export async function translateHenrySection(row: HenrySection, accountId: string, isCurrent: () => boolean = () => true, onProgress?: (done: number, total: number) => void): Promise<string> {
  if (!accountId) throw Error('Sign in to translate commentary.');
  const already = await henryText(row, 'fil', accountId); if (already) return already;
  const key = cacheKey(accountId, runtimeItem(row));
  const active = translationTasks.get(key); if (active) return active;
  const task = (async () => {
    const parts: { text: string; paragraph: number }[] = [];
    let total = 1;
    for (let index = 0; index < total; index++) {
      if (!isCurrent()) throw Error('Translation stopped. Saved sections remain available.');
      const item = `${runtimeItem(row)}:chunk:${index}`;
      let value: any = null;
      try { const raw = await AsyncStorage.getItem(cacheKey(accountId, item)); if (raw) value = JSON.parse(raw); } catch { /* Missing partial cache resumes through verified backend. */ }
      if (!value || value.sourceHash !== row.sourceHash || value.sourceVersion !== row.sourceVersion || value.chunkIndex !== index || value.version !== 'bible-assist-v1') {
        const session = await supabase.auth.getSession();
        if (session.data.session?.user.id !== accountId || !isCurrent()) throw Error('Account changed. Translation stopped.');
        const response = await supabase.functions.invoke('buklod-bible-assist-v1', { body: { task: 'translate', edition: row.edition, book: row.book, chapter: row.chapter, sectionId: row.id, sourceHash: row.sourceHash, sourceVersion: row.sourceVersion, chunkIndex: index } });
        if (response.error || response.data?.error) throw Error(response.data?.error || 'Translation unavailable. Connect and retry.');
        value = response.data;
        if (value?.sourceHash !== row.sourceHash || value?.sourceVersion !== row.sourceVersion || value?.sectionId !== row.id || value?.chunkIndex !== index || value?.version !== 'bible-assist-v1') throw Error('Translation/source mismatch.');
        await save(accountId, item, JSON.stringify(value));
      }
      if (typeof value.text !== 'string' || !Number.isInteger(value.totalChunks) || value.totalChunks < 1 || value.totalChunks > 128 || !Number.isInteger(value.paragraph)) throw Error('Incomplete translation response.');
      if (index && value.totalChunks !== total) throw Error('Translation chunk count changed.');
      total = value.totalChunks; parts.push({ text: value.text, paragraph: value.paragraph }); onProgress?.(index + 1, total);
    }
    const text = parts.map((p, i) => (i ? (p.paragraph === parts[i - 1].paragraph ? ' ' : '\n\n') : '') + p.text).join('');
    await save(accountId, runtimeItem(row), JSON.stringify({ text, sourceHash: row.sourceHash, sourceVersion: row.sourceVersion, status: 'draft-for-review', reviewed: false }));
    return text;
  })();
  translationTasks.set(key, task);
  const clear = () => { if (translationTasks.get(key) === task) translationTasks.delete(key); };
  void task.then(clear, clear);
  return task;
}
