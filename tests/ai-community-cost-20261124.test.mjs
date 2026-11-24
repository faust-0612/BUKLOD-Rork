import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../supabase/functions/buklod-community-ai/index.ts',import.meta.url),'utf8');
test('takeaway generation uses user-scoped concurrent deduplication',()=>{assert.match(s,/singleFlightAi\(actor, JSON\.stringify\(\['takeaway', prompt\]\)/);});
test('moderation remains independently validated',()=>{assert.match(s,/withModels\(geminiKey, prompt, moderationSchema, image\)/);});
test('private replies are excluded from public summary',()=>{assert.match(s,/publicInput = allRows\.filter/);});
