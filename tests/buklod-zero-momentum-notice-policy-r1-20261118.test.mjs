import test from 'node:test';
import assert from 'node:assert/strict';
import {ZERO_MOMENTUM_NOTICE_POLICY,canDeleteAccountBecauseMomentumIsZero,
  previewZeroMomentumNotices} from '../src/lib/buklodZeroMomentumNoticePolicyR1.ts';
const defaults={
  manilaToday:'2026-11-18',seasonId:'nov26',userIsEnrolledInSeason:true,
  serverSnapshotVerified:true,seasonIsOpen:true,seasonalMomentumPoints:0,
  zeroSinceManilaDay:'2026-11-18',pendingOfflineReconciliation:false,
  pushOptIn:false,inPushQuietHours:false,alreadyDeliveredKeys:[],
};
const get=(override={})=>previewZeroMomentumNotices({...defaults,...override});
test('zero score is never authorization for account deletion',()=>{
  assert.equal(ZERO_MOMENTUM_NOTICE_POLICY.rolloutEnabled,false);
  assert.equal(ZERO_MOMENTUM_NOTICE_POLICY.accountDeletionOnZero,false);
  for(const x of [0,1,20,200])assert.equal(canDeleteAccountBecauseMomentumIsZero(x),false);
  const p=get();assert.equal(p.accountDeletionScheduled,false);assert.equal(p.accountAction,'NONE');
});
test('first zero is recovery-only, private generic in-app notice',()=>{
  const p=get();assert.equal(p.reason,'NOTICE_READY');assert.equal(p.recoveryAvailable,true);
  assert.equal(p.notices[0].stage,'ZERO_RECOVERY');assert.equal(p.notices[0].channel,'in_app');
  assert.match(p.notices[0].body,/account/i);assert.doesNotMatch(p.notices[0].body,/prayer|formation|child/i);
});
test('low score warns, positive score never treated as zero',()=>{
  const x=get({seasonalMomentumPoints:20,zeroSinceManilaDay:null});
  assert.equal(x.notices[0].stage,'LOW_BALANCE');assert.equal(x.recoveryAvailable,false);
  assert.equal(get({seasonalMomentumPoints:21,zeroSinceManilaDay:null}).reason,'SCORE_OK');
});
test('three-day, seven-day, thirty-day ladder, with no deletion',()=>{
  for(const [start,stage,archive] of [
    ['2026-11-15','RECOVERY_REMINDER',false],
    ['2026-11-11','RECOVERY_HELP',false],
    ['2026-10-19','SEASON_ARCHIVE_INFO',true]
  ]){
    const p=get({zeroSinceManilaDay:start});
    assert.equal(p.notices[0].stage,stage);assert.equal(p.seasonalChallengeArchiveSuggestion,archive);
    assert.equal(p.accountDeletionScheduled,false);
  }
});
test('dedupe notice on confirmed delivery, same season and same stage',()=>{
  const first=get({zeroSinceManilaDay:'2026-11-15'});
  const again=get({zeroSinceManilaDay:'2026-11-15',
    alreadyDeliveredKeys:[first.notices[0].dedupeKey]});
  assert.equal(again.reason,'ALREADY_SENT');assert.equal(again.notices.length,0);
});
test('push is always opted-in and subject to quiet hours',()=>{
  assert.equal(get({pushOptIn:true}).notices[0].channel,'push');
  assert.equal(get({pushOptIn:true,inPushQuietHours:true}).notices[0].channel,'in_app');
  assert.equal(get({pushOptIn:false,inPushQuietHours:false}).notices[0].channel,'in_app');
});
test('unsynced offline activity blocks notices',()=>{
  const p=get({pendingOfflineReconciliation:true,pushOptIn:true});
  assert.equal(p.reason,'PENDING_SYNC');assert.deepEqual(p.notices,[]);
});
test('unenrolled or closed seasons cannot send notices',()=>{
  assert.equal(get({userIsEnrolledInSeason:false}).reason,'NOT_ENROLLED');
  assert.equal(get({seasonIsOpen:false}).notices.length,0);
});
test('stale source or missing zero evidence cannot notify or delete',()=>{
  assert.equal(get({serverSnapshotVerified:false}).reason,'INCOMPLETE_EVIDENCE');
  assert.equal(get({zeroSinceManilaDay:null}).reason,'INCOMPLETE_EVIDENCE');
  assert.equal(get({seasonalMomentumPoints:15}).reason,'INCOMPLETE_EVIDENCE');
  assert.equal(get({zeroSinceManilaDay:'2026-11-19'}).reason,'INCOMPLETE_EVIDENCE');
  assert.throws(()=>get({manilaToday:'2026-02-30'}));
});
test('coming back to score >20 ends recovery notices without affecting account',()=>{
  const p=get({seasonalMomentumPoints:30,zeroSinceManilaDay:null});
  assert.equal(p.reason,'SCORE_OK');assert.equal(p.accountAction,'NONE');
  assert.equal(p.recoveryAvailable,false);
});
