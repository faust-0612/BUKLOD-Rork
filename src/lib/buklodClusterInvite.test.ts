import { buildClusterInviteUrl, parseClusterInviteUrl } from './buklodClusterInvite';

const id = '123e4567-e89b-42d3-a456-426614174000';

describe('Cluster invitation links', () => {
  it('shares an HTTPS invitation that resolves to the same Cluster', () => {
    const url = buildClusterInviteUrl(id);
    expect(url).toBe('https://buklod.expo.app/clusters/' + id + '?fromInvite=1');
    expect(parseClusterInviteUrl(url)).toBe(id);
  });

  it('keeps compatibility with existing native invite links', () => {
    expect(parseClusterInviteUrl('buklod://clusters/' + id)).toBe(id);
    expect(parseClusterInviteUrl('buklod-staging://clusters/' + id)).toBe(id);
  });

  it('rejects unrelated domains and invalid identifiers', () => {
    expect(parseClusterInviteUrl('https://attacker.example/clusters/' + id)).toBeNull();
    expect(parseClusterInviteUrl('https://buklod.expo.app.evil.example/clusters/' + id)).toBeNull();
    expect(parseClusterInviteUrl('https://buklod.expo.app/clusters/not-a-uuid')).toBeNull();
    expect(parseClusterInviteUrl('buklod://clusters/%ZZ')).toBeNull();
    expect(parseClusterInviteUrl('')).toBeNull();
  });
});
