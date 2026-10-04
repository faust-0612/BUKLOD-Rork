export type BuklodMention = {
  user_id: string;
  full_name: string;
  church_name?: string;
  group_name?: string;
};

export const BUKLOD_MENTION_COLOR = '#176B2C';

export function mentionToken(name: string) {
  return `@${String(name ?? '').trim()}`;
}

export function mentionsStillInText(
  text: string,
  mentions: BuklodMention[],
) {
  const lower = String(text ?? '').toLowerCase();

  return mentions.filter(mention => {
    const token = mentionToken(mention.full_name).toLowerCase();
    return token.length > 1 && lower.includes(token);
  });
}

export function activeMentionQuery(
  text: string,
  cursor: number,
) {
  const source = String(text ?? '');
  const safeCursor = Math.max(
    0,
    Math.min(cursor, source.length),
  );
  const before = source.slice(0, safeCursor);
  const at = before.lastIndexOf('@');

  if (at < 0) {
    return null;
  }

  const previous = at === 0 ? ' ' : before[at - 1];

  if (previous && !/\s/.test(previous)) {
    return null;
  }

  const query = before.slice(at + 1);

  if (query.length > 48 || /[\n\r]/.test(query)) {
    return null;
  }

  return { start: at, query };
}

export function insertMention(
  text: string,
  cursor: number,
  name: string,
) {
  const source = String(text ?? '');
  const safeCursor = Math.max(
    0,
    Math.min(cursor, source.length),
  );
  const token = `${mentionToken(name)} `;
  const active = activeMentionQuery(source, safeCursor);
  const start = active?.start ?? safeCursor;
  const next =
    source.slice(0, start) +
    token +
    source.slice(safeCursor);

  return {
    text: next,
    cursor: start + token.length,
  };
}
