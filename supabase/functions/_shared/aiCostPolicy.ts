/** Server-side AI cost controls. Do not use for authentication, moderation, grades, or reward decisions. */
export type AiWorkload = 'public_content' | 'private_advice' | 'grading' | 'moderation' | 'generation';
export type AiCostPolicy = { cacheable: boolean; ttlMs: number; maxAttempts: number; timeoutMs: number };
export function aiCostPolicy(workload: AiWorkload): AiCostPolicy {
  switch (workload) {
    case 'public_content': return { cacheable: true, ttlMs: 6 * 60 * 60_000, maxAttempts: 2, timeoutMs: 12_000 };
    case 'generation': return { cacheable: true, ttlMs: 24 * 60 * 60_000, maxAttempts: 2, timeoutMs: 20_000 };
    case 'grading': return { cacheable: false, ttlMs: 0, maxAttempts: 2, timeoutMs: 20_000 };
    case 'moderation': return { cacheable: false, ttlMs: 0, maxAttempts: 2, timeoutMs: 8_000 };
    case 'private_advice': return { cacheable: false, ttlMs: 0, maxAttempts: 2, timeoutMs: 15_000 };
  }
}
export function isRetryableAiStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}
export function aiRetryDelayMs(status: number, retryAfterSeconds?: number): number | null {
  if (!isRetryableAiStatus(status)) return null;
  if (status === 429 && retryAfterSeconds != null && Number.isFinite(retryAfterSeconds)) return Math.min(60_000, Math.max(1000, retryAfterSeconds * 1000));
  return status === 429 ? 30_000 : 1500;
}
/** Only immutable, versioned, public material can be shared across users. */
export function canShareAiCache(workload: AiWorkload, immutableVersionedSource: boolean, containsPersonalData: boolean): boolean {
  return aiCostPolicy(workload).cacheable && immutableVersionedSource && !containsPersonalData;
}
export function normalizeAiCacheKey(parts: readonly string[]): string {
  return JSON.stringify(parts.map(part => part.trim().normalize('NFC')));
}
