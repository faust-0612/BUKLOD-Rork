jest.mock('@/ptt/buklodPttCore', () => ({
  connectBuklodPtt: jest.fn(),
  disconnectBuklodPtt: jest.fn(async () => undefined),
  claimBuklodPttFloor: jest.fn(),
  refreshBuklodPttFloor: jest.fn(async () => true),
  releaseBuklodPttFloor: jest.fn(async () => true),
}));
import { AppState } from 'react-native';
jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
import * as core from '@/ptt/buklodPttCore';
import * as runtime from '@/ptt/buklodPttRuntime';
const scope = { id: 'scope', name: 'Test', scope_type: 'ORGANIZATION' as const };
const connection = {
  callId: 'test', scope, channel: 1, userId: 'viewer',
  call: { microphone: { enable: jest.fn(async () => undefined) } },
} as any;
const flush = async () => { for (let i=0;i<10;i++) await Promise.resolve(); };
beforeEach(async () => {
  await runtime.shutdownBuklodPttRuntime();
  jest.clearAllMocks();
  (core.connectBuklodPtt as jest.Mock).mockResolvedValue(connection);
  (core.claimBuklodPttFloor as jest.Mock).mockResolvedValue({ granted: true, transmission_id: 'floor' });
});
afterEach(async () => { await runtime.shutdownBuklodPttRuntime(); });
test('startup, selection and incoming push never join', async () => {
  await runtime.bootstrapBuklodPttRuntime();
  await runtime.connectBuklodPttRuntime(scope, 1);
  await runtime.handleBuklodPttPush({ kind: 'ptt_sos', scope_id: scope.id, channel: 1 });
  expect(core.connectBuklodPtt).not.toHaveBeenCalled();
});
test('joins on hold and disconnects on release', async () => {
  await runtime.connectBuklodPttRuntime(scope, 1);
  await runtime.pttDown();
  expect(core.connectBuklodPtt).toHaveBeenCalledTimes(1);
  expect(runtime.getBuklodPttRuntimeState().transmitting).toBe(true);
  await runtime.pttUp();
  expect(core.disconnectBuklodPtt).toHaveBeenCalledWith(connection);
  expect(core.releaseBuklodPttFloor).toHaveBeenCalledWith('floor');
  expect(runtime.getBuklodPttRuntimeState().connection).toBeNull();
});
test('a join completing after release is immediately left without claiming floor', async () => {
  let resolve!: (value: any) => void;
  (core.connectBuklodPtt as jest.Mock).mockImplementation(() => new Promise(r => { resolve = r; }));
  await runtime.connectBuklodPttRuntime(scope, 1);
  const down = runtime.pttDown();
  await flush();
  await runtime.pttUp();
  expect((core.connectBuklodPtt as jest.Mock).mock.calls[0][2]()).toBe(false);
  resolve(connection);
  await down;
  expect(core.claimBuklodPttFloor).not.toHaveBeenCalled();
  expect(core.disconnectBuklodPtt).toHaveBeenCalledWith(connection);
  expect(runtime.getBuklodPttRuntimeState().connection).toBeNull();
});
test('floor response after exit is released and never enables the mic', async () => {
  let resolve!: (value: any) => void;
  (core.claimBuklodPttFloor as jest.Mock).mockImplementation(() => new Promise(r => { resolve = r; }));
  await runtime.connectBuklodPttRuntime(scope, 1);
  const down = runtime.pttDown();
  await flush();
  await runtime.disconnectBuklodPttRuntime();
  expect(core.disconnectBuklodPtt).toHaveBeenCalledWith(connection);
  resolve({ granted: true, transmission_id: 'late-floor' });
  await down;
  expect(connection.call.microphone.enable).not.toHaveBeenCalled();
  expect(core.releaseBuklodPttFloor).toHaveBeenCalledWith('late-floor');
  expect(core.disconnectBuklodPtt).toHaveBeenCalledWith(connection);
});
