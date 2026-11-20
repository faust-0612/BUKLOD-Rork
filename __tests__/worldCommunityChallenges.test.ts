import {
  validateWorldChallenge, validateWorldChallengeFunding, assessWorldChallengeEvidence,
  WORLD_CHALLENGES_ENABLED, WORLD_WINNER_TAKES_STAKES_ENABLED,
  type WorldChallenge, type WorldProjectEvidence, type WorldChallengeEvidenceContext,
} from '@/features/world/worldCommunityChallenges';

const base=(): WorldChallenge=>({
  id:'project-1',
  format:'friendly_impact_contest',
  title:'Community Gardening Challenge',
  purpose:'Create a clean garden area for community residents',
  measurableOutcome:'Square meters planted and sustained after one month',
  participants:[{kind:'cluster',scopeId:'cluster-a'},{kind:'cluster',scopeId:'cluster-b'}],
  evidenceWindowStart:'2026-12-01T00:00:00+08:00',
  deadline:'2026-12-31T23:00:00+08:00',
  localPermissionRequired:true,
  funding:{mode:'restricted_project_budget',restrictedProjectBudgetBp:1000,
    prefundedSponsorAwardBp:0,recipientGetsOtherTeamsBudget:false},
  state:'under_review',
});
const hashes=['a','b','c','d'].map(ch=>ch.repeat(64));
const evidence=(kind:WorldProjectEvidence['kind'],i:number):WorldProjectEvidence=>({
  id:'e'+i, challengeId:'project-1',kind,
  submittedBy:'member-'+i,
  contentHash:hashes[i%hashes.length],
  recordedAt:'2026-12-10T10:00:00+08:00',
  verification:{
    state:'verified', reviewerId:'neutral-reviewer',
    reviewerIndependent:true,verifiedWithIssuer:true,reviewReceiptId:'audit-receipt-'+i,
  },
});
const context=():WorldChallengeEvidenceContext=>({
  priorEvidenceHashes:new Set<string>(),reuseExceptionApprovedByIndependentAuditor:false,
  disputeOpen:false,participantApprovals:['cluster-a','cluster-b'],
  independentReview:{
    reviewerId:'neutral-auditor',scopeIdsReviewerBelongsTo:[],conflictOfInterestDeclared:false,
    finalAuditReceiptId:'audit-final',result:'pass',
  },
});

describe('BUKLOD inter-community projects — no BP wagering',()=>{
  it('is source-only; no challenge wallet or settlement launch',()=>{
    expect(WORLD_CHALLENGES_ENABLED).toBe(false);
    expect(WORLD_WINNER_TAKES_STAKES_ENABLED).toBe(false);
  });
  it('rejects opposite-community loser-funded stakes and mixed sponsor pools',()=>{
    expect(validateWorldChallengeFunding({...base().funding,recipientGetsOtherTeamsBudget:true as false})).toBeTruthy();
    expect(validateWorldChallengeFunding({...base().funding,prefundedSponsorAwardBp:100})).toBeTruthy();
    expect(validateWorldChallengeFunding({mode:'separate_sponsor_award',
      restrictedProjectBudgetBp:0,prefundedSponsorAwardBp:100,recipientGetsOtherTeamsBudget:false})).toBeNull();
  });
  it('requires distinct communities, measurable purpose and dates',()=>{
    expect(validateWorldChallenge(base())).toBeNull();
    expect(validateWorldChallenge({...base(),participants:[{kind:'cluster',scopeId:'cluster-a'},{kind:'organization',scopeId:'cluster-a'}]})).toBeTruthy();
    expect(validateWorldChallenge({...base(),deadline:'2026-01-01T00:00:00+08:00'})).toBeTruthy();
    expect(validateWorldChallenge({...base(),measurableOutcome:''})).toBeTruthy();
  });
  it('community approvals and barangay clearance alone do NOT verify actual completion',()=>{
    const docs=[evidence('authority_permission',0)];
    const state=assessWorldChallengeEvidence(base(),docs,context());
    expect(state.evidenceReady).toBe(false);
    expect(state.bpReleaseAuthorized).toBe(false);
    expect(state.reasons.some(x=>x.includes('before-project'))).toBe(true);
    expect(state.reasons.some(x=>x.includes('after-project'))).toBe(true);
  });
  it('before+after with neutral witness and verified permit is eligible for independent decision ONLY',()=>{
    const docs=[
      evidence('baseline_photo',0),
      evidence('completion_photo',1),
      evidence('independent_witness',2),
      evidence('authority_permission',3),
    ];
    const state=assessWorldChallengeEvidence(base(),docs,context());
    expect(state.evidenceReady).toBe(true);
    expect(state.bpReleaseAuthorized).toBe(false);
  });
  it('rejects reused photos, forged issuer confirmations, open disputes and conflicted judges',()=>{
    const docs=[
      evidence('baseline_photo',0),
      evidence('completion_photo',1),
      evidence('independent_witness',2),
      evidence('authority_permission',3),
    ];
    expect(assessWorldChallengeEvidence(base(),docs,
      {...context(),priorEvidenceHashes:new Set([hashes[1]])}).evidenceReady).toBe(false);
    expect(assessWorldChallengeEvidence(base(),docs,
      {...context(),disputeOpen:true}).evidenceReady).toBe(false);
    const conflicted=context();
    if(conflicted.independentReview){
      conflicted.independentReview.scopeIdsReviewerBelongsTo=['cluster-a'];
    }
    expect(assessWorldChallengeEvidence(base(),docs,conflicted).evidenceReady).toBe(false);
    const forged=docs.map(x=>x.kind==='authority_permission'
      ?{...x,verification:{...x.verification,verifiedWithIssuer:false}}:x);
    expect(assessWorldChallengeEvidence(base(),forged,context()).evidenceReady).toBe(false);
  });
  it('expired, invalid and unreviewed evidence fails even when two groups approve',()=>{
    const docs=[evidence('baseline_photo',0),evidence('completion_photo',1),
      evidence('independent_witness',2),evidence('authority_permission',3)];
    const noReview=docs.map((x,i)=>i===1
      ?{...x,verification:{...x.verification,state:'pending' as const}}:x);
    expect(assessWorldChallengeEvidence(base(),noReview,context()).evidenceReady).toBe(false);
    const late=docs.map((x,i)=>i===0?{...x,recordedAt:'2027-01-01T12:00:00+08:00'}:x);
    expect(assessWorldChallengeEvidence(base(),late,context()).evidenceReady).toBe(false);
  });
});
