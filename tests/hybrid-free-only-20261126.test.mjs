import test from 'node:test';
import assert from 'node:assert/strict';
import {freeOnlyConfig,providerFailure} from '../supabase/functions/_shared/hybrid-free-only.mjs';
const now=1795672800000;
const env={"BUKLOD_HYBRID_FREE_ONLY":"true","BUKLOD_HYBRID_BILLING_DISABLED_VERIFIED":"true","BUKLOD_HYBRID_FREE_GEMINI_KEY":"test-only-not-a-real-key-123","BUKLOD_HYBRID_FREE_GEMINI_MODEL":"gemini-test","BUKLOD_HYBRID_FREE_PROJECT_ID":"test-project","BUKLOD_HYBRID_FREE_VERIFIED_UNTIL":"2026-11-26T12:00:00Z","GEMINI_API_KEY":"legacy-not-a-real-key"};
test('verified short-lived free-only config',()=>{assert.ok(freeOnlyConfig(env,now));for(const patch of [{BUKLOD_HYBRID_FREE_ONLY:'false'},{BUKLOD_HYBRID_BILLING_DISABLED_VERIFIED:'false'},{BUKLOD_HYBRID_FREE_VERIFIED_UNTIL:'2026-11-25'},{BUKLOD_HYBRID_FREE_VERIFIED_UNTIL:'2026-11-28'},{GEMINI_API_KEY:env.BUKLOD_HYBRID_FREE_GEMINI_KEY},{BUKLOD_HYBRID_FREE_PROJECT_ID:''},{BUKLOD_HYBRID_FREE_GEMINI_MODEL:'other'}])assert.equal(freeOnlyConfig({...env,...patch},now),null);});
test('quota and provider blocks are distinct from transient failures',()=>{assert.equal(providerFailure(429),'quota_exhausted');assert.equal(providerFailure(403),'provider_blocked');assert.equal(providerFailure(503),'retry');});
