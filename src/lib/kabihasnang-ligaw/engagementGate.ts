/** Feature-gated KL discussion access. Backend is not deployed: fail closed. */
export const KL_ENGAGEMENT_GATE = Object.freeze({
  backendVerified: false,
  commentsEnabled: false,
  reactionsEnabled: false,
  repliesEnabled: false,
  pointsEnabled: false,
});

export function canSubmitKlInteraction(input: {
  signedIn: boolean;
  released: boolean;
  online: boolean;
  busy: boolean;
  kind: 'comment' | 'reaction' | 'reply';
}): boolean {
  if (!KL_ENGAGEMENT_GATE.backendVerified || !input.signedIn || !input.released || !input.online || input.busy) return false;
  switch (input.kind) {
    case 'comment': return KL_ENGAGEMENT_GATE.commentsEnabled;
    case 'reaction': return KL_ENGAGEMENT_GATE.reactionsEnabled;
    case 'reply': return KL_ENGAGEMENT_GATE.repliesEnabled;
  }
}
