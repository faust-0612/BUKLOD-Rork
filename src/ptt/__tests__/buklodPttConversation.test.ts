import type { BuklodPttConnection } from '../buklodPttCore';
import { supabase } from '../buklodPttCore';
import {
  persistOwnBuklodPttCaption,
  sendBuklodPttText,
} from '../buklodPttConversation';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../buklodPttCore', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

const speaker = '22222222-2222-4222-8222-222222222222';
const scope = '33333333-3333-4333-8333-333333333333';
const tx = '44444444-4444-4444-8444-444444444444';
const connection = {
  userId: speaker,
  scope: { id: scope },
  channel: 2,
} as BuklodPttConnection;

describe('BUKLOD PTT conversation safety', () => {
  const insert = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: speaker, user_metadata: { full_name: 'PTT Tester' } } },
      error: null,
    });
  });

  it('never impersonates another speaker during caption persistence', async () => {
    await persistOwnBuklodPttCaption(connection, {
      id: 'caption-1',
      speaker_id: '88888888-8888-4888-8888-888888888888',
      text: 'Not my speech',
    }, tx);
    expect(insert).not.toHaveBeenCalled();
  });

  it('does not persist translated duplicates', async () => {
    await persistOwnBuklodPttCaption(connection, {
      id: 'caption-1', speaker_id: speaker, text: 'Translation', translated: true,
    }, tx);
    expect(insert).not.toHaveBeenCalled();
  });

  it('writes an original caption with scope, channel, user, and floor identity', async () => {
    await persistOwnBuklodPttCaption(connection, {
      id: 'caption-1', speaker_id: speaker, text: '  Kumusta po?  ',
      user: { id: speaker, name: 'PTT Tester' },
    }, tx);
    expect(supabase.from).toHaveBeenCalledWith('buklod_ptt_channel_messages');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      scope_id: scope, channel: 2, sender_user_id: speaker,
      transmission_id: tx, provider_event_id: 'caption-1',
      kind: 'CAPTION', body: 'Kumusta po?',
    }));
  });

  it('treats duplicate caption events as successful idempotent retries', async () => {
    insert.mockResolvedValue({ error: { code: '23505' } });
    await expect(persistOwnBuklodPttCaption(connection, {
      id: 'caption-1', speaker_id: speaker, text: 'Hello',
    }, tx)).resolves.toBeUndefined();
  });

  it('sends trimmed typed messages as the authenticated user', async () => {
    await sendBuklodPttText(scope, 2, '  Hello, team  ');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      sender_user_id: speaker, kind: 'TEXT', body: 'Hello, team',
      sender_name: 'PTT Tester', scope_id: scope, channel: 2,
    }));
  });
});
