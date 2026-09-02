import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolvePersonDisplayName } from '@/lib/buklodPersonDisplay';

export const CONNECT_REPLY_PREFIX =
  '[[BUKLOD_REPLY:v1:';

export const CONNECT_DELETED_BODY =
  'This message was deleted.';

export type ConnectMessageLike = {
  id: string;
  sender_id: string;
  sender_name?: string | null;
  body: string;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  deleted_at?: string | null;
};

export function connectHiddenStorageKey(
  mode: 'direct' | 'scope',
  containerId: string,
) {
  return `buklod_connect_hidden:${mode}:${containerId}`;
}

export async function loadHiddenConnectMessageIds(
  mode: 'direct' | 'scope',
  containerId: string,
): Promise<Set<string>> {
  if (!containerId) {
    return new Set();
  }

  try {
    const raw = await AsyncStorage.getItem(
      connectHiddenStorageKey(mode, containerId),
    );

    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(
      parsed
        .map(value => String(value ?? '').trim())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

export async function saveHiddenConnectMessageIds(
  mode: 'direct' | 'scope',
  containerId: string,
  ids: Set<string>,
) {
  if (!containerId) {
    return;
  }

  await AsyncStorage.setItem(
    connectHiddenStorageKey(mode, containerId),
    JSON.stringify([...ids]),
  );
}

export async function clearHiddenConnectMessageIds(
  mode: 'direct' | 'scope',
  containerId: string,
) {
  if (!containerId) {
    return;
  }

  await AsyncStorage.removeItem(
    connectHiddenStorageKey(mode, containerId),
  );
}

export function parseConnectReplyBody(body: string) {
  const value = String(body ?? '');
  const match = value.match(
    /^\[\[BUKLOD_REPLY:v1:([0-9a-f-]{36})\]\]\n?/i,
  );

  if (!match) {
    return {
      replyToId: null as string | null,
      text: value,
    };
  }

  return {
    replyToId: match[1],
    text: value.slice(match[0].length),
  };
}

export function buildConnectReplyBody(
  replyToId: string,
  text: string,
) {
  const clean = String(text ?? '').trim();

  return `${CONNECT_REPLY_PREFIX}${replyToId}]]\n${clean}`;
}

export function isConnectDeletedMessage(
  message: ConnectMessageLike,
) {
  if (message.deleted_at) {
    return true;
  }

  const body = String(message.body ?? '').trim();

  return (
    body === CONNECT_DELETED_BODY ||
    body.startsWith('[[BUKLOD_DELETED')
  );
}

export function getConnectMessageCopyText(
  message: ConnectMessageLike,
) {
  if (isConnectDeletedMessage(message)) {
    return '';
  }

  const { text } = parseConnectReplyBody(
    message.body,
  );

  const trimmed = String(text ?? '').trim();

  if (trimmed) {
    return trimmed.replace(
      /^\[\[BUKLOD_SHARED_POST:[0-9a-f-]{36}\]\]\s*/i,
      '',
    );
  }

  const mime = String(
    message.attachment_mime ?? '',
  ).toLowerCase();

  if (mime.startsWith('image/')) {
    return mime.includes('gif')
      ? 'GIF'
      : 'Photo';
  }

  if (message.attachment_name) {
    return message.attachment_name;
  }

  return '';
}

export function getConnectMessagePreview(
  message: ConnectMessageLike,
  maxLength = 120,
) {
  const copy = getConnectMessageCopyText(message);

  if (!copy) {
    return 'Message';
  }

  if (copy.length <= maxLength) {
    return copy;
  }

  return `${copy.slice(0, maxLength - 1)}…`;
}

export function getConnectForwardText(
  message: ConnectMessageLike,
) {
  const copy = getConnectMessageCopyText(message);

  if (!copy) {
    return 'Shared from BUKLOD Connect';
  }

  const sender = resolvePersonDisplayName(
    message.sender_name,
    message.sender_id,
  );

  return `${sender}:\n${copy}\n\n— Shared from BUKLOD Connect`;
}
