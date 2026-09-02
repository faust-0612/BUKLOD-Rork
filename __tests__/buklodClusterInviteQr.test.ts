import * as QRCode from 'qrcode';

import {
  buildClusterInviteUrl,
  parseClusterInviteUrl,
} from '@/lib/buklodClusterInvite';

describe('Cluster invite QR payload', () => {
  const scopeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  it('builds canonical buklod://clusters/{id} URL', () => {
    const url = buildClusterInviteUrl(scopeId);
    expect(url).toBe(`buklod://clusters/${scopeId}`);
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
  });

  it('parses expo-router style cluster paths', () => {
    expect(parseClusterInviteUrl(`/clusters/${scopeId}`)).toBe(scopeId);
  });
});
