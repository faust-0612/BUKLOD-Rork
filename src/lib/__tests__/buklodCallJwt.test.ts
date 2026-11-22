import { isBuklodCallJwtExpired } from '../buklodCallJwt';

function jwt(exp: number | undefined) {
  return `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
}

describe('BUKLOD call JWT expiration', () => {
  const NOW = 1_800_000_000_000;
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
  afterEach(() => jest.restoreAllMocks());

  it('accepts a token with enough remaining validity', () => {
    expect(isBuklodCallJwtExpired(jwt(NOW / 1000 + 180))).toBe(false);
  });

  it('rejects expired and nearly-expired tokens', () => {
    expect(isBuklodCallJwtExpired(jwt(NOW / 1000 - 1))).toBe(true);
    expect(isBuklodCallJwtExpired(jwt(NOW / 1000 + 30))).toBe(true);
    expect(isBuklodCallJwtExpired(jwt(NOW / 1000 + 30), 0)).toBe(false);
  });

  it('fails closed on missing, malformed, and uninspectable expiry', () => {
    expect(isBuklodCallJwtExpired('')).toBe(true);
    expect(isBuklodCallJwtExpired('not-a-token')).toBe(true);
    expect(isBuklodCallJwtExpired('header.*.signature')).toBe(true);
    expect(isBuklodCallJwtExpired(jwt(undefined))).toBe(true);
  });
});
