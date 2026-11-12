/**
 * Explanatory triage only. Never interprets an error signature as verified root cause.
 * No cross-user health data or private case information is transmitted here.
 */
export type BsocTriageInput = {
  title?: string | null;
  message?: string | null;
  category?: string | null;
  route?: string | null;
  platform?: string | null;
  app_version?: string | null;
};
export type BsocTriage = {
  signal: string;
  suspectedArea: string;
  confidence: 'Preliminary only';
  investigation: string;
  bsocAction: string;
  userAction: string;
};
export function isBsoCaseId(value: unknown): value is string {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function triageBsoCase(item: BsocTriageInput): BsocTriage {
  const signal = String(item.title ?? '') + ' ' + String(item.message ?? '');
  const normalized = signal.toUpperCase();
  if (/AUTH_SESSION_STALE/.test(normalized)) {
    return {
      signal: 'Session refresh could not be verified',
      suspectedArea: 'Client session / authentication path; backend status unverified',
      confidence: 'Preliminary only',
      investigation: 'Compare token-refresh results, device time, app version, connectivity, and auth service errors. Verify whether other accounts and devices are affected.',
      bsocAction: 'Keep case under investigation. Escalate to engineering if repeatable after refresh or affecting multiple users. Never request passwords, OTPs, or reset codes.',
      userAction: 'Ask the member to reopen the app and retry after confirming connectivity. Do not ask them to clear data or reinstall before checking unsynced work.',
    };
  }
  if (/AUTH_REQUEST_(FAILED|TIMEOUT)/.test(normalized)) {
    return {
      signal: 'Authentication request failed or timed out',
      suspectedArea: 'Network / client / auth API; cannot distinguish yet',
      confidence: 'Preliminary only',
      investigation: 'Check time correlation against auth/API availability, request latency, rate limits, and affected-user count. A single failed request does not prove backend outage.',
      bsocAction: 'Check service metrics first; escalate only if backend evidence supports it. Avoid unverified password-reset actions.',
      userAction: 'Ask whether the issue persists on another connection and after app restart; request the approximate time, never credentials.',
    };
  }
  if (/RENDER_[0-9A-F]{6,}|RENDER_EXCEPTION/.test(normalized)) {
    return {
      signal: 'UI render exception (anonymized signature)',
      suspectedArea: 'Client render / route / native lifecycle; precise cause unknown',
      confidence: 'Preliminary only',
      investigation: 'Match signature plus route, OS, app/runtime version, and timestamp with crash/ANR logs. A hash does not identify the crashing component by itself.',
      bsocAction: 'Route to client engineering with scoped reproduction evidence; compare OTA/runtime compatibility. Do not claim an OTA fixed it without verification.',
      userAction: 'Ask what screen/action triggered the failure, whether it repeats, and request a redacted screenshot if useful.',
    };
  }
  if (/SYNC_QUEUE_STUCK|OFFLINE|CONTENT_REFRESH_FAILED/.test(normalized)) {
    return {
      signal: 'Sync or content refresh did not complete',
      suspectedArea: 'Connectivity, queued local work, or API; unverified',
      confidence: 'Preliminary only',
      investigation: 'Check offline queue age and pending count, retry behavior, API health, and whether work is safely persisted before recommending recovery.',
      bsocAction: 'Do not advise clearing app storage or reinstalling when unsynced changes may exist. Escalate if repeatable with healthy connectivity.',
      userAction: 'Ask the member to reconnect and retry without deleting app data. Gather approximate time and affected screen.',
    };
  }
  return {
    signal: item.category ? 'Support request: ' + item.category : 'Unclassified support request',
    suspectedArea: 'Not established from this case',
    confidence: 'Preliminary only',
    investigation: 'Read the original report and evidence. Confirm route, action, expected result, current app version, onset, and whether multiple accounts are affected.',
    bsocAction: 'Record the observed facts and route to the responsible team. Do not close or claim a rollout fix without actual verification.',
    userAction: 'Request only missing reproduction details; advise no destructive troubleshooting.',
  };
}

/** Informational, read-only intervention routing. Never marks a support case resolved. */
export type BsocIntervention={
 category:'client'|'auth'|'provider'|'sync'|'account'|'approval'|'unclassified';
 urgency:'investigate'|'priority';
 owner:string; firstCheck:string; memberDraft:string; closureGate:string;
};
export function bsoCaseIntervention(item:BsocTriageInput):BsocIntervention{
 const s=(String(item.title??'')+' '+String(item.message??'')+' '+String(item.category??'')).toUpperCase();
 const keep='Huwag munang mag-clear data o mag-reinstall kung may pending na gawa. Huwag magpadala ng password o OTP.';
 if(/RENDER_[0-9A-F]{6,}|SYS-500|RENDER_EXCEPTION/.test(s))return {
  category:'client',urgency:'priority',owner:'Client navigation/render engineering',
  firstCheck:'Match sanitized route, signature, OS, app/runtime version and exact tap sequence to operational health events; reproduce before changing code.',
  memberDraft:'Pakisabi kung anong button saang screen ang pinindot, oras, app version at kung nauulit ang SYS-500 pagkatapos buksang muli ang app. '+keep,
  closureGate:'Isolate render root cause, targeted test on affected runtime, verify exact deployed fix and get member confirmation.'
 };
 if(/AUTH_SESSION_STALE|AUTH_REQUEST_FAILED|INVALID_SESSION|LOGIN|TOKEN_REFRESH/.test(s))return {
  category:'auth',urgency:'priority',owner:'Auth/session engineering',
  firstCheck:'Compare token refresh results, device clock, connectivity and auth health; do not bypass RLS or assume outage from one error.',
  memberDraft:'Pakisabi ang app version, approximate time at kung nangyayari rin sa ibang koneksyon. '+keep,
  closureGate:'Confirm safe session recovery and authorization for affected member, with service evidence if widespread.'
 };
 if(/EDGE FUNCTION|NON-2XX|PROVIDER|GPT|HTTP.?429/.test(s))return {
  category:'provider',urgency:'investigate',owner:'BSOC provider operations',
  firstCheck:'Distinguish Edge Function status from AI provider 429 quota/rate limit; review auth, server configuration and manual fallback before escalating.',
  memberDraft:'Pansamantalang hindi available ang AI diagnostics pero magpapatuloy ang manual BSOC investigation. Pakisabi ang apektadong screen at safe error code. '+keep,
  closureGate:'Provider and function responses verified, safe fallback tested, and error messaging is accurate.'
 };
 if(/SYNC_QUEUE|OFFLINE|UPLOAD|CONTENT_REFRESH/.test(s))return {
  category:'sync',urgency:'priority',owner:'Client sync/media engineering',
  firstCheck:'Inspect queued work, retry behavior, local persistence and server response. Avoid destructive recovery while pending changes exist.',
  memberDraft:'Mayroon pa po bang hindi na-upload o hindi na-sync? Subukang kumonekta muli. '+keep,
  closureGate:'Queued work syncs exactly once and the member confirms restored operation.'
 };
 if(/PASSWORD RESET|ACCOUNT RECOVERY|LOCKED ACCOUNT/.test(s))return {
  category:'account',urgency:'priority',owner:'Authorized BSOC recovery officer',
  firstCheck:'Use restricted identity verification and official recovery workflow; no password, token, OTP or reset link collection in chat.',
  memberDraft:'Tutulungan namin kayo sa opisyal at ligtas na account recovery. Huwag magpadala ng password, OTP o reset code sa chat.',
  closureGate:'Authorized account recovery and member sign-in confirmed without bypassing identity verification.'
 };
 if(/ADVERTISEMENT|APPROVAL|REQUEST TO JOIN/.test(s))return {
  category:'approval',urgency:'investigate',owner:'Admin approvals team',
  firstCheck:'Find the source request in the authorized approval queue and identify exact missing information or audited decision.',
  memberDraft:'Sinusuri ang inyong request. Ipapadala namin dito ang eksaktong requirements o resulta ng approval.',
  closureGate:'Approval decision audited, member notified and correct request status visible.'
 };
 return {
  category:'unclassified',urgency:'investigate',owner:'BSOC agent → responsible specialist',
  firstCheck:'Confirm exact screen, button, expected/actual behavior, time, version, repeat rate and cross-account impact before diagnosing.',
  memberDraft:'Aling screen at button ang ginamit, ano ang inaasahan, ano ang nangyari, anong oras at version? '+keep,
  closureGate:'Root cause and fix evidence documented, relevant test passed and member confirmation received.'
 };
}
export type BsocReplyIntent = 'acknowledge' | 'request_details' | 'client_retry' | 'ota_check';
export function bsoReplyDraft(intent: BsocReplyIntent): string {
  switch (intent) {
    case 'acknowledge': return 'Natanggap namin ang inyong concern at kasalukuyan itong sinusuri ng BSOC. Magbibigay kami ng update rito kapag may na-verify na resulta. Wala pa kayong kailangang baguhin sa ngayon.';
    case 'request_details': return 'Para masuri namin nang tama: saang screen at anong oras nangyari, ano ang pinindot ninyo, at umulit ba ang problema? Maaari kayong mag-attach ng screenshot na walang personal na impormasyon. Huwag magpadala ng password o OTP.';
    case 'client_retry': return 'Habang sinusuri namin, maaari bang subukang buksan muli ang BUKLOD at tingnan kung nauulit ang concern? Huwag munang mag-clear ng app data o mag-reinstall, lalo na kung may hindi pa na-sync.';
    case 'ota_check': return 'Sinusuri namin kung sakop ito ng kasalukuyang update. Hindi pa namin kinukumpirmang resolved. Pakisabi ang app version at kung nauulit pa ang isyu pagkatapos ng update.';
  }
}

/**
 * A notification can only open one of the existing protected BSOC destinations.
 * The destination screen still checks its own authenticated record membership.
 */
export function bsoNotificationCasePath(route: unknown, caseId: unknown): string | null {
  if (route !== '/support/live' && route !== '/admin/bsoc-conversations') return null;
  return isBsoCaseId(caseId) ? route + '?case_id=' + encodeURIComponent(caseId) : route;
}
