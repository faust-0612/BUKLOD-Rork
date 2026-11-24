import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync(new URL('../supabase/functions/_shared/aiCostPolicy.ts',import.meta.url),'utf8');
test('never cross-user cache grading, moderation or private advice',()=>{assert.match(s,/case 'grading': return \{ cacheable: false/);assert.match(s,/case 'moderation': return \{ cacheable: false/);assert.match(s,/case 'private_advice': return \{ cacheable: false/);});
test('bounded retry and rate-limit handling',()=>{assert.match(s,/maxAttempts: 2/);assert.match(s,/status === 429/);assert.match(s,/retryAfterSeconds/);});
test('public caching requires immutable version and no personal data',()=>{assert.match(s,/immutableVersionedSource && !containsPersonalData/);});
