/**
 * BUKLOD World inter-community challenges — DEV-ONLY design/verification contract.
 *
 * No member BP wager, no winner-takes-loser-stakes settlement, no direct QMP
 * credit, and no wallet write. Earned-only BP is a budget for actual work, not
 * a cash bet. A future award must pass independent legal / Play review.
 *
 * Mutual Cluster approval is NOT evidence of project completion.
 * A barangay permission letter is NOT a certificate that the work happened.
 */
export const WORLD_CHALLENGES_ENABLED = false as const;
export const WORLD_WINNER_TAKES_STAKES_ENABLED = false as const;

export type WorldCommunityKind = 'cluster' | 'organization';
export type WorldCommunity = { kind: WorldCommunityKind; scopeId: string };
export type WorldChallengeFormat = 'joint_bayanihan' | 'friendly_impact_contest' | 'sponsor_hosted_contest';
export type WorldChallengeState =
  | 'draft' | 'invited' | 'accepted' | 'active' | 'submitted'
  | 'under_review' | 'verified' | 'rejected' | 'disputed' | 'closed';
export type WorldChallengeFunding = {
  mode: 'none' | 'restricted_project_budget' | 'separate_sponsor_award';
  /** BP spent on verifiable project resources. Cannot be lost to an opponent. */
  restrictedProjectBudgetBp: number;
  /** No award is issued until independently approved and policy-cleared. */
  prefundedSponsorAwardBp: number;
  recipientGetsOtherTeamsBudget: false;
};
export type WorldChallenge = {
  id: string;
  format: WorldChallengeFormat;
  title: string;
  purpose: string;
  measurableOutcome: string;
  participants: readonly WorldCommunity[];
  evidenceWindowStart: string;
  deadline: string;
  localPermissionRequired: boolean;
  funding: WorldChallengeFunding;
  state: WorldChallengeState;
};
export type WorldEvidenceKind =
  | 'baseline_photo' | 'progress_photo' | 'completion_photo'
  | 'materials_receipt' | 'beneficiary_confirmation'
  | 'member_attestation' | 'authority_permission'
  | 'authority_completion_certificate' | 'independent_witness'
  | 'neutral_site_audit';

export type WorldProjectEvidence = {
  id: string;
  challengeId: string;
  kind: WorldEvidenceKind;
  submittedBy: string;
  contentHash: string;
  recordedAt: string;
  verification: {
    state: 'pending' | 'verified' | 'rejected';
    /** Reviewers must be verified independent persons — never participant officers. */
    reviewerId: string | null;
    reviewerIndependent: boolean;
    /** For official documents, issuer was verified via trusted external channel. */
    verifiedWithIssuer: boolean;
    /** Server-origin verification receipt; not a photo or client-side badge. */
    reviewReceiptId: string | null;
  };
};
export type WorldIndependentReview = {
  reviewerId: string;
  scopeIdsReviewerBelongsTo: readonly string[];
  conflictOfInterestDeclared: boolean;
  /** Must be a second, server-recorded review of the consolidated evidence. */
  finalAuditReceiptId: string | null;
  result: 'pass' | 'reject' | 'needs_more_evidence';
};
export type WorldChallengeEvidenceContext = {
  priorEvidenceHashes: ReadonlySet<string>;
  reuseExceptionApprovedByIndependentAuditor: boolean;
  disputeOpen: boolean;
  participantApprovals: readonly string[];
  independentReview: WorldIndependentReview | null;
};
export type WorldChallengeAssessment = {
  /** Readiness for a fully server-authorized final decision, never payout approval. */
  evidenceReady: boolean;
  bpReleaseAuthorized: false;
  reasons: readonly string[];
  validatedEvidenceKinds: readonly WorldEvidenceKind[];
};

const SHA256 = /^[a-f0-9]{64}$/i;
const PROJECT_STATES: readonly WorldChallengeState[] =
 ['draft','invited','accepted','active','submitted','under_review','verified','rejected','disputed','closed'];
const FORMATS: readonly WorldChallengeFormat[] =
 ['joint_bayanihan','friendly_impact_contest','sponsor_hosted_contest'];
const KIND_SET = new Set<WorldEvidenceKind>([
  'baseline_photo','progress_photo','completion_photo','materials_receipt',
  'beneficiary_confirmation','member_attestation','authority_permission',
  'authority_completion_certificate','independent_witness','neutral_site_audit',
]);
const validDate = (v: string): boolean => typeof v==='string' && Number.isFinite(Date.parse(v));
const naturalBp = (v: number): boolean => Number.isSafeInteger(v) && v>=0;

export function validateWorldChallengeFunding(f: WorldChallengeFunding): string | null {
  if (!f || !['none','restricted_project_budget','separate_sponsor_award'].includes(f.mode) ||
      !naturalBp(f.restrictedProjectBudgetBp) || !naturalBp(f.prefundedSponsorAwardBp))
    return 'Invalid or unsupported BP funding.';
  if (f.recipientGetsOtherTeamsBudget!==false)
    return 'Winner-takes-loser BP stakes are not enabled.';
  if (f.mode==='none' && (f.restrictedProjectBudgetBp!==0 || f.prefundedSponsorAwardBp!==0))
    return 'Unfunded challenge cannot hold a BP stake or award.';
  if (f.mode==='restricted_project_budget' && f.prefundedSponsorAwardBp!==0)
    return 'Project budget cannot become a prize for the opposing community.';
  if (f.mode==='separate_sponsor_award' && f.restrictedProjectBudgetBp!==0)
    return 'Sponsor award and project spending cannot share a pool.';
  return null;
}
export function validateWorldChallenge(challenge: WorldChallenge): string | null {
  if (!challenge?.id?.trim() || !challenge.title?.trim() || !challenge.purpose?.trim() ||
      !challenge.measurableOutcome?.trim() || !FORMATS.includes(challenge.format) ||
      !PROJECT_STATES.includes(challenge.state))
    return 'Missing or invalid real-world project definition.';
  if (!validDate(challenge.evidenceWindowStart) || !validDate(challenge.deadline) ||
      Date.parse(challenge.deadline)<=Date.parse(challenge.evidenceWindowStart))
    return 'Invalid project timeline.';
  if (!Array.isArray(challenge.participants) ||
      challenge.participants.length<2 || challenge.participants.length>20)
    return 'A challenge requires 2–20 participating communities.';
  const participants = new Set<string>();
  for (const p of challenge.participants) {
    if (!p?.scopeId?.trim() || !['cluster','organization'].includes(p.kind) ||
        participants.has(p.scopeId))
      return 'Invalid or duplicate participating community.';
    participants.add(p.scopeId);
  }
  return validateWorldChallengeFunding(challenge.funding);
}
function independentlyVerified(e: WorldProjectEvidence): boolean {
  return e.verification.state==='verified' && e.verification.reviewerIndependent &&
    Boolean(e.verification.reviewerId?.trim()) &&
    Boolean(e.verification.reviewReceiptId?.trim());
}

/**
 * Evidence completeness is not fraud-proof verification.
 * The ultimate server settlement must review signatures/issuer, site visits,
 * conflicting evidence, reuse, verified community identity and an appeal window.
 * Documents may contain sensitive information; do not publish them to Wall.
 */
export function assessWorldChallengeEvidence(
  challenge: WorldChallenge,
  evidence: readonly WorldProjectEvidence[],
  ctx: WorldChallengeEvidenceContext,
): WorldChallengeAssessment {
  const reasons: string[] = [];
  const fail = (...newReasons: string[]): WorldChallengeAssessment => ({
    evidenceReady: false, bpReleaseAuthorized: false,
    reasons: newReasons, validatedEvidenceKinds: [],
  });
  const invalid=validateWorldChallenge(challenge);
  if (invalid) return fail(invalid);
  if (!Array.isArray(evidence) || evidence.length>80)
    return fail('Missing evidence or too many evidence records.');
  if (!ctx || !(ctx.priorEvidenceHashes instanceof Set) ||
      !Array.isArray(ctx.participantApprovals))
    return fail('Invalid private audit context.');
  if (ctx.disputeOpen) reasons.push('A pending dispute prevents project finalization.');

  const unique=new Set<string>();
  const valid:WorldProjectEvidence[]=[];
  const min=Date.parse(challenge.evidenceWindowStart);
  const max=Date.parse(challenge.deadline);
  for (const e of evidence) {
    if (!e?.id?.trim() || unique.has(e.id) || e.challengeId!==challenge.id ||
        !e.submittedBy?.trim() || !KIND_SET.has(e.kind) ||
        !SHA256.test(e.contentHash) || !validDate(e.recordedAt) ||
        Date.parse(e.recordedAt)<min || Date.parse(e.recordedAt)>max) {
      reasons.push('Invalid, duplicate or outside-window evidence.');
      continue;
    }
    unique.add(e.id);
    if (ctx.priorEvidenceHashes.has(e.contentHash) &&
        !ctx.reuseExceptionApprovedByIndependentAuditor) {
      reasons.push('Evidence reused across projects: independent investigation needed.');
      continue;
    }
    if (!independentlyVerified(e)) {
      reasons.push('An evidence item has not passed independent review.');
      continue;
    }
    if ((e.kind==='authority_permission' || e.kind==='authority_completion_certificate') &&
        !e.verification.verifiedWithIssuer) {
      reasons.push('Government document issuer has not been confirmed.');
      continue;
    }
    valid.push(e);
  }

  const kinds=new Set(valid.map(e=>e.kind));
  if(!kinds.has('baseline_photo')) reasons.push('Missing independently checked before-project evidence.');
  if(!kinds.has('completion_photo')) reasons.push('Missing independently checked after-project evidence.');
  if(!['independent_witness','neutral_site_audit','authority_completion_certificate']
        .some(kind=>kinds.has(kind as WorldEvidenceKind)))
    reasons.push('Need neutral real-world confirmation, not only participant sign-off.');
  if(challenge.localPermissionRequired && !kinds.has('authority_permission'))
    reasons.push('Missing verified permission or required clearance before fieldwork.');

  const reviewer=ctx.independentReview;
  const participantScopeIds=new Set(challenge.participants.map(p=>p.scopeId));
  if(!reviewer || reviewer.result!=='pass' || !reviewer.finalAuditReceiptId?.trim() ||
      !reviewer.reviewerId?.trim() || reviewer.conflictOfInterestDeclared ||
      reviewer.scopeIdsReviewerBelongsTo.some(id=>participantScopeIds.has(id)))
    reasons.push('No independent, conflict-free final audit receipt.');
  // Participant approval is allowed as extra evidence, never substituted for impartial assessment.
  return {
    evidenceReady: reasons.length===0,
    bpReleaseAuthorized: false,
    reasons,
    validatedEvidenceKinds:Array.from(kinds),
  };
}
