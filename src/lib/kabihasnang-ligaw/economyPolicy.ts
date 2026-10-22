/** Kabihasnang Ligaw economy v2 — policy for server-side enforcement.
 * Never grant points from this client module. Existing BUKLOD Points ledger is the sole authority.
 * Supersedes R5 +2 episode reward prospectively, after server migration activation.
 */
export const KL_ECONOMY_V2 = Object.freeze({
  policyVersion: 'kl-economy-v2-pending-server-activation',
  chapterCompletionPoints: 7,
  meaningfulCommentPoints: 2,
  seasonCompletionPoints: 10,
  reactionPoints: 0, // Reaction is enabled as interaction, not an unlimited earning source.
  replyPoints: 0, // Reply UI is enabled; earning requires separately approved anti-farming caps.
  panimulaCompletionPoints: 0,
  awardOncePerAccountPerChapter: true,
  requireReleasedApprovedChapter: true,
  requireVerifiedReadingCompletion: true,
  requireServerQualifiedComment: true,
  prohibitSelfInteractionRewards: true,
  prohibitDuplicateAndCopiedCommentRewards: true,
  prohibitAutomatedRapidCommentRewards: true,
  noPointsToBayanihanConversion: true,
  noFixedPesoConversion: true,
  lifetimePointsUnaffectedByRedemption: true,
  separateStoryJourneyFromCharacterLevel: true,
} as const);

export function expectedKlChapterPoints(firstVerifiedCompletion: boolean, chapterNumber: number): number {
  return firstVerifiedCompletion && Number.isInteger(chapterNumber) && chapterNumber >= 1
    ? KL_ECONOMY_V2.chapterCompletionPoints
    : 0;
}

export function eligibleKlCommentPoints(input: {
  serverQualified: boolean;
  isDuplicate: boolean;
  isSelfInteraction: boolean;
  alreadyRewarded: boolean;
}): number {
  return input.serverQualified && !input.isDuplicate && !input.isSelfInteraction && !input.alreadyRewarded
    ? KL_ECONOMY_V2.meaningfulCommentPoints
    : 0;
}
