import { supabase } from '@/lib/supabase';
import {
  type ConnectMessageReactionKey,
} from '@/lib/buklodConnectMessageReactions';

type SetReactionParams = {
  mode: 'direct' | 'scope';
  containerId: string;
  messageId: string;
  reaction: ConnectMessageReactionKey;
};

function isMissingRpcError(message: string) {
  return /could not find the function|function.*does not exist|schema cache/i.test(
    message
  );
}

export async function setConnectMessageReaction(
  params: SetReactionParams
) {
  const payload = {
    _mode: params.mode,
    _container_id: params.containerId,
    _message_id: params.messageId,
    _reaction: params.reaction,
  };

  const v2 = await supabase.rpc(
    'buklod_connect_set_reaction_v2',
    payload
  );

  if (!v2.error) {
    return v2;
  }

  if (
    !isMissingRpcError(
      String(v2.error.message ?? '')
    )
  ) {
    return v2;
  }

  return supabase.rpc(
    'buklod_connect_set_reaction',
    payload
  );
}
