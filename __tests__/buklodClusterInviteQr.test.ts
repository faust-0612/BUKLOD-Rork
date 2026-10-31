import * as QRCode from 'qrcode';

import {
  buildClusterInviteUrl,
  parseClusterInviteUrl,
} from '@/lib/buklodClusterInvite';

describe('Cluster invite QR payload', () => {
  const scopeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('builds HTTPS invitations that messaging apps can linkify', () => {
    const url = buildClusterInviteUrl(scopeId);
    expect(url).toBe(
      `https://buklod.expo.app/clusters/${scopeId}?fromInvite=1`
    );
  });

  it('round-trips through QR matrix generation', () => {
    const url = buildClusterInviteUrl(scopeId);
    const matrix = QRCode.create(url, {
      errorCorrectionLevel: 'M',
    });

    expect(matrix.modules.size).toBeGreaterThan(21);
    expect(parseClusterInviteUrl(url)).toBe(scopeId);
  });

  it('parses staging scheme and resolves cluster route id', () => {
    const stagingUrl = `buklod-staging://clusters/${encodeURIComponent(scopeId)}`;
    expect(parseClusterInviteUrl(stagingUrl)).toBe(scopeId);
    expect(parseClusterInviteUrl(`buklod://clusters/${scopeId}`)).toBe(scopeId);
  });

  it('parses expo-router style cluster paths', () => {
    expect(parseClusterInviteUrl(`/clusters/${scopeId}`)).toBe(scopeId);
  });
});
