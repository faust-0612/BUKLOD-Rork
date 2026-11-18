/**
 * BUKLOD R1 zero-Momentum NOTICE PREVIEW.
 *
 * Not imported by runtime, not a notification producer and never an account
 * deletion worker. Zero seasonal score is NOT an account deletion criterion.
 * No user data, BP, QMP, cash, Character level or owned items are mutated.
 */
export const ZERO_MOMENTUM_NOTICE_POLICY=Object.freeze({
  rolloutEnabled:false,
  accountDeletionOnZero:false,
  lowBalanceThreshold:20,
  zeroNoticeAfterDays:0,
  recoveryReminderAfterDays:3,
  recoveryHelpAfterDays:7,
  seasonalChallengeArchiveSuggestionAfterDays:30,
});
export type NoticeStage =
  'LOW_BALANCE'|'ZERO_RECOVERY'|'RECOVERY_REMINDER'|'RECOVERY_HELP'|'SEASON_ARCHIVE_INFO';
export type NoticeChannel = 'in_app'|'push';
export type ZeroMomentumNotice=Readonly<{
  stage:NoticeStage;
  dedupeKey:string;
  channel:NoticeChannel;
  title:string;
  body:string;
}>;
export type ZeroMomentumNoticeInput=Readonly<{
  manilaToday:string;
  seasonId:string;
  userIsEnrolledInSeason:boolean;
  serverSnapshotVerified:boolean;
  seasonIsOpen:boolean;
  seasonalMomentumPoints:number;
  zeroSinceManilaDay:string|null;
  pendingOfflineReconciliation:boolean;
  pushOptIn:boolean;
  inPushQuietHours:boolean;
  alreadyDeliveredKeys:readonly string[];
}>;
export type ZeroMomentumNoticePreview=Readonly<{
  live:false;
  accountAction:'NONE';
  accountDeletionScheduled:false;
  recoveryAvailable:boolean;
  seasonalChallengeArchiveSuggestion:boolean;
  notices:readonly ZeroMomentumNotice[];
  reason:'NOT_ENROLLED'|'INCOMPLETE_EVIDENCE'|'PENDING_SYNC'|'SCORE_OK'|'NOT_DUE'|'NOTICE_READY'|'ALREADY_SENT';
}>;
function dayNumber(day:string):number{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||
    new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)
    throw new Error('Invalid Manila day');
  return Date.parse(day+'T00:00:00Z')/86400000;
}
/** Only a separately verified, user-initiated account-deletion request may reach deletion code. */
export function canDeleteAccountBecauseMomentumIsZero(_points:number):false{return false;}
/** Pure deterministic candidate selection. Server owns score, season, zero start and notification receipts. */
export function previewZeroMomentumNotices(input:ZeroMomentumNoticeInput):ZeroMomentumNoticePreview{
  const today=dayNumber(input.manilaToday);
  const result=(reason:ZeroMomentumNoticePreview['reason'],notice?:ZeroMomentumNotice,archive=false):
    ZeroMomentumNoticePreview=>({
    live:false,accountAction:'NONE',accountDeletionScheduled:false,
    recoveryAvailable:input.userIsEnrolledInSeason&&input.seasonalMomentumPoints===0,
    seasonalChallengeArchiveSuggestion:archive,notices:notice?[notice]:[],reason,
  });
  if(!input.userIsEnrolledInSeason||!input.seasonIsOpen) return result('NOT_ENROLLED');
  if(!input.serverSnapshotVerified||!input.seasonId.trim()||
    !Number.isSafeInteger(input.seasonalMomentumPoints)||input.seasonalMomentumPoints<0)
    return result('INCOMPLETE_EVIDENCE');
  if(input.pendingOfflineReconciliation) return result('PENDING_SYNC');
  const points=input.seasonalMomentumPoints;
  if(points>ZERO_MOMENTUM_NOTICE_POLICY.lowBalanceThreshold)return result('SCORE_OK');
  let stage:NoticeStage, title:string, body:string,archive=false;
  if(points>0){
    if(input.zeroSinceManilaDay!==null)return result('INCOMPLETE_EVIDENCE');
    stage='LOW_BALANCE';title='Seasonal Momentum update';
    body='Malapit na sa zero ang optional seasonal score mo. May mga paraan para makabawi.';
  }else{
    if(input.zeroSinceManilaDay===null)return result('INCOMPLETE_EVIDENCE');
    const since=dayNumber(input.zeroSinceManilaDay),elapsed=today-since;
    if(elapsed<0)return result('INCOMPLETE_EVIDENCE');
    archive=elapsed>=ZERO_MOMENTUM_NOTICE_POLICY.seasonalChallengeArchiveSuggestionAfterDays;
    if(archive){
      stage='SEASON_ARCHIVE_INFO';title='Seasonal challenge update';
      body='Maaaring i-archive ang lumang optional challenge. Nananatiling active ang BUKLOD account mo.';
    }else if(elapsed>=ZERO_MOMENTUM_NOTICE_POLICY.recoveryHelpAfterDays){
      stage='RECOVERY_HELP';title='Balik-BUKLOD options';
      body='May optional comeback activities para makabawi sa seasonal score. Nananatiling active ang account mo.';
    }else if(elapsed>=ZERO_MOMENTUM_NOTICE_POLICY.recoveryReminderAfterDays){
      stage='RECOVERY_REMINDER';title='Seasonal Momentum recovery';
      body='Zero ang seasonal score mo. Maaari kang makabawi anumang oras; walang account deletion.';
    }else{
      stage='ZERO_RECOVERY';title='Seasonal Momentum is zero';
      body='Recovery Mode ka sa optional season. Ligtas ang account at naipon mong rewards.';
    }
  }
  // Stable season-specific key: a retry cannot create a new reward or mass notice.
  const dedupeKey='momentum-notice:'+encodeURIComponent(input.seasonId)+':'+stage;
  if(input.alreadyDeliveredKeys.includes(dedupeKey))return result('ALREADY_SENT',undefined,archive);
  const channel:NoticeChannel=input.pushOptIn&&!input.inPushQuietHours?'push':'in_app';
  return result('NOTICE_READY',{stage,dedupeKey,channel,title,body},archive);
}
