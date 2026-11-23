import { matchesConnectInboxSearch } from '../src/lib/connectInboxSearch';

describe('Connect conversation search respects active inbox tab', () => {
  const personal = { other_user_name: 'Maria Santos', last_message: 'Kamusta sa cluster?' };
  const room = { scope_name: 'Cluster Verde', last_message: 'Pulong bukas' };

  it('matches names and previews without a database query', () => {
    expect(matchesConnectInboxSearch(personal, 'maria')).toBe(true);
    expect(matchesConnectInboxSearch(personal, 'CLUSTER')).toBe(true);
    expect(matchesConnectInboxSearch(room, 'verde')).toBe(true);
    expect(matchesConnectInboxSearch(room, 'PULONG')).toBe(true);
  });

  it('rejects non-matches and does not search unrelated fields', () => {
    expect(matchesConnectInboxSearch(personal, 'random')).toBe(false);
    expect(matchesConnectInboxSearch({ scope_name: null, last_message: null }, 'hello')).toBe(false);
  });

  it('preserves normal inbox when query is shorter than two characters', () => {
    expect(matchesConnectInboxSearch(personal, ' ')).toBe(true);
    expect(matchesConnectInboxSearch(room, 'x')).toBe(true);
  });
});
