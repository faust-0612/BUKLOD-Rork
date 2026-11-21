import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = name => readFileSync(new URL('../'+name, import.meta.url),'utf8');
const registration = file('src/app/(auth)/register.tsx');
const rewards = file('src/lib/buklodRewards.ts');

test('new passwords strengthen only signup and preserve existing login', () => {
 assert.match(registration,/password\.length < 10/);
 assert.match(registration,/!\s*\/\[A-Za-z\]\//);
 assert.match(registration,/No OTP is required/);
 assert.match(registration,/signInWithPasswordResilient/);
});

test('optional referral must be confirmed before creating account', () => {
 assert.match(registration,/referralQuery\.trim\(\) && !selectedReferralCode\.trim\(\)/);
 assert.match(registration,/setSelectedReferralCode\(resolved\.canonical_referral_code \|\| resolved\.referral_code\)/);
 assert.match(registration,/selectedReferralCode\.trim\(\) \|\|/);
});

test('wrong referrer is never interpreted as idempotent signup', () => {
 assert.match(rewards,/buklod_record_referral_verified_v2/);
 assert.doesNotMatch(rewards,/if \(error && !\/already recorded/i);
 assert.match(rewards,/captureBuklodReferralCode\(canonicalCode, 'SIGNUP_FORM'\)/);
});
