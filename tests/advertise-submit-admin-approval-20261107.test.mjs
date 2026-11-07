import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const form=read('src/app/advertise/index.tsx');
const admin=read('src/app/admin/sponsors.tsx');
const review=read('src/components/BuklodPaidAdsReview.tsx');
const migration=read('supabase/migrations/20261107222500_buklod_paid_ad_admin_review_v1.sql');

test('final Advertise CTA is a reachable fixed action outside keyboard-tappable ScrollView',()=>{
 assert.match(form,/return <KeyboardAvoidingView/);
 assert.match(form,/keyboardShouldPersistTaps="always"/);
 assert.match(form,/testID="advertise-submit"/);
 assert.match(form,/accessibilityLabel="Submit advertisement for admin review"/);
 assert.match(form,/<\/ScrollView>\s*<View style=\{\[s\.submitFooter/);
 assert.match(form,/paddingBottom:Math\.max\(8,insets\.bottom\)/);
 assert.match(form,/onPress=\{\(\)=>void submit\(\)\}/);
 assert.match(form,/disabled=\{busy\|\|submitted\}/);
});

test('submit must never fail silently, mark paid, or duplicate after a successful response',()=>{
 assert.match(form,/if\(!user\?\.id\)\{fail\('/);
 assert.match(form,/if\(!name\.trim\(\)\)\{fail\('/);
 assert.match(form,/if\(!headline\.trim\(\)\)\{fail\('/);
 assert.match(form,/if\(!asset\)\{fail\('/);
 assert.match(form,/if\(!reference\.trim\(\)\)\{fail\('/);
 assert.match(form,/ratesBusy \|\| !selectedRate/);
 assert.match(form,/submitLock\.current=true/);
 assert.match(form,/setFeedback\(\{kind:'error',message:'Could not submit: '/);
 assert.match(form,/setFeedback\(\{kind:'success'/);
 assert.match(form,/setSubmitted\(true\)/);
 assert.match(form,/payment_status:'pending'/);
 assert.match(form,/status:'pending'/);
 assert.match(form,/amount_paid:0/);
 assert.doesNotMatch(form,/payment_status:'paid'|status:'approved'/);
});

test('admin Sponsors & Ads includes the paid submissions in addition to historic sponsors',()=>{
 assert.match(admin,/import BuklodPaidAdsReview/);
 assert.match(admin,/<AdminGate>/);
 assert.match(admin,/<BuklodPaidAdsReview \/>/);
 assert.match(admin,/\.from\('app_sponsors'\)/);
 assert.match(review,/\.from\('buklod_paid_ad_campaigns'\)/);
 assert.match(review,/testID="admin-paid-ad-review"/);
 assert.match(review,/\.order\('created_at',\{ascending:false\}\)\.limit\(60\)/);
 assert.match(review,/Refresh/);
 assert.match(review,/payment_reference/);
 assert.match(review,/payment_proof_path/);
});

test('admin payment proof is private and payment verification precedes content approval',()=>{
 assert.match(review,/\.from\('paid-ad-payment'\)\.createSignedUrl/);
 assert.match(migration,/CREATE POLICY paid_ad_payment_admin_read_v1/);
 assert.match(migration,/bucket_id='paid-ad-payment' AND public\.is_system_admin\(\)/);
 assert.match(review,/Confirm you independently verified the full payment/);
 assert.match(review,/Confirm payment verified/);
 assert.match(review,/p_campaign_id:item\.id,p_action:action/);
 assert.match(review,/admin-paid-ad-confirm-/);
 assert.match(migration,/p_action='verify_payment'/);
 assert.match(migration,/p_action='approve'/);
 assert.match(migration,/v_ad\.payment_status NOT IN \('paid','waived'\)/);
 assert.match(migration,/v_ad\.amount_paid<v_ad\.monthly_price/);
 assert.match(migration,/starts_at=v_now, ends_at=v_now \+ interval '30 days'/);
 assert.match(migration,/FOR UPDATE/);
 assert.match(migration,/public\.is_system_admin\(\)/);
 assert.match(migration,/REVOKE ALL ON FUNCTION.*FROM PUBLIC/);
 assert.match(migration,/GRANT EXECUTE .* TO authenticated/);
 assert.match(review,/admin-paid-ad-confirm/);
});

test('admin cannot pay or approve without second confirmation, and public ads stay pending',()=>{
 assert.match(review,/setConfirm\(\{id:item\.id,action\}\)/);
 assert.match(review,/\{confirm\?\.id===item\.id&&/);
 assert.match(review,/onPress=\{\(\)=>void apply\(item,confirm\.action\)\}/);
 assert.match(review,/item\.payment_status==='pending'/);
 assert.match(review,/item\.payment_status==='paid'\|\|item\.payment_status==='waived'/);
 assert.match(review,/onPress=\{\(\)=>ask\(item,'reject'\)\}/);
 assert.match(migration,/IF v_ad\.status <> 'pending'/);
 assert.match(migration,/UPDATE public\.buklod_paid_ad_campaigns\s+SET status='approved'/);
 assert.match(migration,/UPDATE public\.buklod_paid_ad_campaigns SET status='rejected'/);
 assert.match(migration,/IF v_ad\.status <> 'approved'/);
 assert.match(migration,/v_ad\.ends_at <= v_now/);
});
