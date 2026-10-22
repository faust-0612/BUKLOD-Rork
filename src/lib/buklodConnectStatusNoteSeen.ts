import { supabase } from '@/lib/supabase';

const pending = new Set<string>();
const completed = new Set<string>();

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

export async function markConnectStatusNoteSeen(
  ownerId: string
) {
  const id = String(ownerId ?? '').trim();

  if (!id || pending.has(id) || completed.has(id)) {
    return;
  }

  pending.add(id);

  try {
    const { error } = await supabase.rpc(
      'mark_buklod_connect_status_note_seen_v1',
      { p_owner_id: id }
    );

    if (error) {
      if (!isMissingRpcError(String(error.message ?? ''))) {
        console.warn(
          'Connect status note seen:',
          error.message
        );
      }
      return;
    }

    completed.add(id);
  } finally {
    pending.delete(id);
  }
}
