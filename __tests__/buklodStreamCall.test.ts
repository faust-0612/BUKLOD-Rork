import { formatBuklodCallStartError, buildBuklodPersonalCallId } from '../src/lib/buklodStreamCall';

describe('BUKLOD direct call reliability', () => {
  it('never shows a raw Stream SDK user-token exception to members', () => {
    expect(formatBuklodCallStartError(
      new Error("User token is not set. Either client.connectUser wasn't called or client.disconnect was called")
    )).toContain('Hindi pa handa');
  });

  it('mints a different ringing call ID for each attempt', () => {
    expect(buildBuklodPersonalCallId('thread-1'))
      .not.toBe(buildBuklodPersonalCallId('thread-1'));
  });
});
