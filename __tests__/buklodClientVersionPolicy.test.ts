import { CLIENT_VERSION_REPORT_TTL_MS, shouldReportClientVersion } from '@/lib/buklodClientVersionPolicy';

describe('BUKLOD client update adoption reporting policy', () => {
  const fingerprintA = JSON.stringify(['1.3.2', '1.3.2', 'ota-a', 'production']);
  const fingerprintB = JSON.stringify(['1.3.2', '1.3.2', 'ota-b', 'production']);

  it('reports new installations and changed running OTA immediately', () => {
    expect(shouldReportClientVersion(null, fingerprintA, 1_000)).toBe(true);
    expect(shouldReportClientVersion({ fingerprint: fingerprintA, at: 1_000 }, fingerprintB, 2_000)).toBe(true);
  });

  it('limits unchanged running versions to one successful report per six hours', () => {
    expect(shouldReportClientVersion({ fingerprint: fingerprintA, at: 1_000 }, fingerprintA, 2_000)).toBe(false);
    expect(shouldReportClientVersion({ fingerprint: fingerprintA, at: 1_000 }, fingerprintA, 1_000 + CLIENT_VERSION_REPORT_TTL_MS)).toBe(true);
  });

  it('recovers from invalid or clock-skewed local timestamps', () => {
    expect(shouldReportClientVersion({ fingerprint: fingerprintA, at: Number.NaN }, fingerprintA, 10_000)).toBe(true);
    expect(shouldReportClientVersion({ fingerprint: fingerprintA, at: 100_000 }, fingerprintA, 10_000)).toBe(true);
  });
});
