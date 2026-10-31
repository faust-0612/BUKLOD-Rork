import {
  allRequiredPoliciesAccepted,
  hasMatchingPolicySession,
  mayRestoreOfflineAuthSnapshot,
} from '../buklodPolicyAuthGuard';

describe('BUKLOD policy/auth boundary', () => {
  it('never treats degraded, unknown, or online persisted tokens as authoritative', () => {
    expect(mayRestoreOfflineAuthSnapshot('offline')).toBe(true);
    for (const state of ['online', 'degraded', 'unknown', 'syncing']) {
      expect(mayRestoreOfflineAuthSnapshot(state)).toBe(false);
    }
  });
  it('requires the current SDK session to belong to the active account', () => {
    const active = { access_token: 'jwt', user: { id: 'alice' } };
    expect(hasMatchingPolicySession(active, 'alice')).toBe(true);
    expect(hasMatchingPolicySession(active, 'bob')).toBe(false);
    expect(hasMatchingPolicySession(null, 'alice')).toBe(false);
    expect(hasMatchingPolicySession({ access_token: '', user: { id: 'alice' } }, 'alice')).toBe(false);
  });
  it('does not accept partial or placeholder server acknowledgements', () => {
    expect(allRequiredPoliciesAccepted([{ accepted: true }])).toBe(true);
    expect(allRequiredPoliciesAccepted([{ accepted: true }, { accepted: false }])).toBe(false);
    expect(allRequiredPoliciesAccepted([{ accepted: false }])).toBe(false);
    expect(allRequiredPoliciesAccepted([])).toBe(true); // server confirms no policies required
  });
});
