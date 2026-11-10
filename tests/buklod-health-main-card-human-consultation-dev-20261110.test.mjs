import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const panel=read('src/components/home/BuklodMainHealthCard.tsx');
const home=read('src/components/home/BuklodHomeUtilityCards.tsx');
const sql=read('supabase/migrations/20261110213000_buklod_main_health_human_consultation_dev.sql');

test('Main Home Health card owns language, consultation and registration without a new route',()=>{
  assert.match(home, /BuklodMainHealthCard/);
  assert.match(panel, /onPress=\{\(\)=>setLanguage\('fil'\)\}/);
  assert.match(panel, /onPress=\{\(\)=>setLanguage\('en'\)\}/);
  assert.match(panel, /openSection\('consult'\)/);
  assert.match(panel, /openSection\('professional'\)/);
  assert.match(panel, /OPEN|LIBRENG KONSULTASYON/);
  assert.match(panel, /PROFESSIONAL REGISTRATION/);
  assert.match(panel, /aspectRatio:1/);
  assert.match(panel, /cardExpanded:\{width:'100%'/);
  assert.doesNotMatch(panel, /router\.push|useRouter|navigate\(/);
});

test('Consultation requires independent real identity, red flag clearance and informed consent',()=>{
  assert.match(sql, /buklod_health_card_register_identity_v1/);
  assert.match(sql, /status='VERIFIED'/);
  assert.match(sql, /v_service not in \('HEALTH_ADVICE','PHYSICIAN_CONSULT'\)/);
  assert.match(sql, /p_red_flags is distinct from false/);
  assert.match(sql, /p_informed_consent is distinct from true/);
  assert.match(panel, /redFlags!=='no'/);
  assert.match(panel, /!consent/);
  assert.match(panel, /Linking\.openURL\('tel:911'\)/);
  assert.match(sql, /Adult-only trial/);
});

test('PRC license checks and admin review are server-side, volunteer cannot self approve',()=>{
  assert.match(sql, /PRC_OFFICIAL_VERIFICATION/);
  assert.match(sql, /public\.buklod_is_system_admin\(\)/);
  assert.match(sql, /p_user_id=v_actor/);
  assert.match(sql, /p_license_expires_on<=current_date/);
  assert.match(sql, /license_expires_on>=current_date/);
  assert.match(panel, /expiryDays<=7/);
  assert.match(panel, /expiryDays<=30/);
  assert.match(panel, /verification\.prc\.gov\.ph/);
});

test('Private clinical records use controlled RPCs, never public direct table grants',()=>{
  for(const table of ['buklod_health_identities_v1','buklod_health_professionals_v1',
    'buklod_health_consultations_v1','buklod_health_consult_notes_v1','buklod_health_review_audit_v1']){
      assert.ok(sql.includes("'"+table+"'"));
  }
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on private/);
  assert.match(sql, /where client_id=v_actor and status in \('OPEN','IN_PROGRESS'\)/);
  assert.match(sql, /v_case\.client_id<>v_actor/);
  assert.match(sql, /v_actor=v_case\.professional_id/);
  assert.match(sql, /v_profession<>'PHYSICIAN'/);
  assert.doesNotMatch(panel, /supabase\.from\(|supabase\.auth|getUser\(/);
  assert.doesNotMatch(panel, /AsyncStorage|console\.log\(/);
  assert.match(panel, /Only your assigned professional and you see case notes/);
});

test('Consultation clinic has structured notes, referral, cancellation and replay protection',()=>{
  assert.match(sql, /CARE_PLAN/);
  assert.match(sql, /FOLLOW_UP/);
  assert.match(sql, /REFERRAL/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /buklod_health_consult_request_unique_v1 unique\(client_id,client_request_key\)/);
  assert.match(panel, /p_request_key:requestKey\.current/);
  assert.match(sql, /client_id<>v_actor/);
  assert.match(panel, /buklod_health_card_get_notes_v1/);
  assert.match(panel, /buklod_health_card_close_consult_v1/);
  assert.match(panel, /caseIdRef\.current===id/);
  assert.match(panel, /dashUserId===user\?\.id/);
  assert.match(panel, /busyRef\.current/);
  assert.match(panel, /CANCEL PENDING REQUEST/);
});

test('Private consultations are ad-free and keep external app doorway separate',()=>{
  assert.match(home, /launchBuklodHealthCenter/);
  assert.doesNotMatch(panel, /BuklodAdMobBanner|AdSlot|interstitial|rewarded|adsbygoogle/);
  assert.match(panel, /No ads inside private clinical records/);
  assert.doesNotMatch(sql, /insert into public\.posts|buklod_public_wall|provider_access_token/i);
});

test('Clinical updates do not require another screen or permanent background process',()=>{
  assert.match(panel,/setInterval\(\(\)=>void sync\(\),20000\)/);
  assert.match(panel,/AppState\.currentState==='background'/);
  assert.match(panel,/caseItem\?\.status!=='IN_PROGRESS'/);
  assert.match(panel,/if\(!silent\)setLoading\(true\)/);
  assert.doesNotMatch(panel,/setInterval\([^\n]*1000\)/);
});
test('Recorded advice remains available after closure and transfer',()=>{
  assert.match(panel,/caseItem\.status!=='OPEN'/);
  assert.match(panel,/Read-only clinical history/);
  assert.match(sql,/status in \('IN_PROGRESS','REFERRED'\)/);
});
test('PRC number and message replay protection are enforced on server',()=>{
  assert.match(sql,/unique\(profession,prc_license_number\)/);
  assert.match(sql,/note_request_key text not null/);
  assert.match(sql,/unique\(consultation_id,author_id,note_request_key\)/);
  assert.match(sql,/on conflict \(consultation_id,author_id,note_request_key\) do nothing/);
  assert.match(panel,/p_note_key:noteRequestKey\.current/);
});
test('Other professional scopes do not automatically unlock medical advice',()=>{
  assert.match(sql,/v_profession='OTHER'/);
  assert.match(sql,/v_service='PHYSICIAN_CONSULT' and v_profession<>'PHYSICIAN'/);
  assert.match(panel,/profession==='OTHER'/);
});

test('Clinical note persistence and closure are serialized on same private case row',()=>{
  assert.match(sql,/select \* into v_case from private\.buklod_health_consultations_v1[\s\S]*?for update/);
  assert.match(sql,/note_request_key/);
  assert.match(sql,/on conflict \(consultation_id,author_id,note_request_key\) do nothing/);
  assert.match(sql,/status in \('IN_PROGRESS','REFERRED'\)/);
});
test('No device/native update is needed to render the clinical Main Home card',()=>{
  assert.match(home,/<BuklodMainHealthCard/);
  assert.doesNotMatch(panel,/expo-camera|expo-file-system|new NativeModules|react-native-webrtc/);
  assert.doesNotMatch(panel,/provider_access_token|service_role|secret_key/);
});
