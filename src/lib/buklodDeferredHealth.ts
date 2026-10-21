import AsyncStorage from '@react-native-async-storage/async-storage';

// No error messages, routes, user IDs, identifiers, tokens or credentials enter
// this device-local queue. Delivery belongs to the later authenticated session;
// it does not assert the identity of whoever encountered the original failure.
const CODES = ['AUTH_REQUEST_FAILED', 'AUTH_REQUEST_TIMEOUT', 'CONTENT_REFRESH_FAILED', 'CLIENT_OPERATION_FAILED'] as const;
export type DeferredHealthCode = typeof CODES[number];
export type DeferredHealthEvent = {
  id: string;
  code: DeferredHealthCode;
  detectedAt: string;
  lastAt: string;
  count: number;
};
const KEY = 'BUKLOD:DEFERRED_HEALTH:V1';
const MAX_ROWS = 30;
// Backend BUKLOD_MAIN accepts events younger than 24 hours.
const MAX_AGE_MS = 23 * 60 * 60_000;
const DEDUPE_MS = 5 * 60_000;
let serial: Promise<unknown> = Promise.resolve();
let draining: Promise<void> | null = null;
const volatile = new Map<string, DeferredHealthEvent>();

function locked<T>(run: () => Promise<T>): Promise<T> {
  const task = serial.then(run, run);
  serial = task.catch(() => undefined);
  return task;
}
function clean(row: unknown): DeferredHealthEvent | null {
  const r = row as Partial<DeferredHealthEvent> | null;
  if (!r || !CODES.includes(r.code as DeferredHealthCode) ||
      !/^dh_[a-z0-9_]{8,100}$/.test(String(r.id ?? '')) ||
      !Number.isFinite(Date.parse(String(r.detectedAt))) ||
      !Number.isFinite(Date.parse(String(r.lastAt))) ||
      Date.parse(String(r.detectedAt)) < Date.now() - MAX_AGE_MS ||
      Date.parse(String(r.lastAt)) < Date.parse(String(r.detectedAt)) ||
      Date.parse(String(r.lastAt)) < Date.now() - MAX_AGE_MS ||
      Date.parse(String(r.lastAt)) > Date.now() + 60_000) return null;
  return { id: String(r.id), code: r.code as DeferredHealthCode,
    detectedAt: new Date(String(r.detectedAt)).toISOString(), lastAt: new Date(String(r.lastAt)).toISOString(),
    count: Math.min(1000, Math.max(1, Math.floor(Number(r.count)) || 1)) };
}
async function read(): Promise<DeferredHealthEvent[]> {
  const raw = await AsyncStorage.getItem(KEY);
  let parsed: unknown = [];
  try { parsed = raw ? JSON.parse(raw) : []; } catch { /* Reject corrupt content. */ }
  const rows = Array.isArray(parsed) ? parsed.map(clean).filter((r): r is DeferredHealthEvent => r !== null) : [];
  const merged = new Map(rows.map(r => [r.id, r]));
  for (const [id, row] of volatile) { const safe = clean(row); if (safe) merged.set(id, safe); }
  return [...merged.values()].slice(-MAX_ROWS);
}
async function write(rows: DeferredHealthEvent[]) {
  const safe = rows.slice(-MAX_ROWS);
  volatile.clear();
  for (const row of safe) volatile.set(row.id, row);
  await AsyncStorage.setItem(KEY, JSON.stringify(safe));
}
export async function enqueueDeferredBuklodFailure(code: DeferredHealthCode): Promise<void> {
  if (!CODES.includes(code)) return;
  await locked(async () => {
    let rows: DeferredHealthEvent[];
    try { rows = await read(); } catch { rows = [...volatile.values()]; }
    const now = new Date().toISOString();
    const recent = [...rows].reverse().find(r => r.code === code && Date.now() - Date.parse(r.lastAt) < DEDUPE_MS);
    if (recent) { recent.lastAt = now; recent.count = Math.min(1000, recent.count + 1); }
    else rows.push({ id: `dh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`, code, detectedAt: now, lastAt: now, count: 1 });
    // Volatile fallback keeps safe events for this runtime when storage fails.
    await write(rows).catch(() => undefined);
  });
}
export function drainDeferredBuklodFailures(deliver: (event: DeferredHealthEvent) => Promise<boolean>): Promise<void> {
  if (draining) return draining;
  const task = (async () => {
    const rows = await locked(read);
    for (const row of rows.slice(0, 5)) {
      // Freeze the delivery snapshot; enqueues may update the live row meanwhile.
      const snapshot = { ...row };
      if (!(await deliver(snapshot))) break;
      await locked(async () => {
        const current = await read();
        await write(current.filter(r => r.id !== snapshot.id || r.count !== snapshot.count || r.lastAt !== snapshot.lastAt));
      });
    }
  })();
  draining = task;
  void task.finally(() => { if (draining === task) draining = null; }).catch(() => undefined);
  return task;
}
