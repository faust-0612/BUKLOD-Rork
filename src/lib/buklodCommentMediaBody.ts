/**
 * Encode optional photo/GIF attachments into a comment body so text-only
 * `add_buklod_post_comment_v4` can still carry media without a schema change.
 *
 * Format: [[BUKLOD_COMMENT_MEDIA:v1:<kind>:<payload>]]\n<caption>
 * kind = image (storage path) | gif (https URL)
 */

const PREFIX = '[[BUKLOD_COMMENT_MEDIA:v1:';

export type BuklodCommentMediaKind = 'image' | 'gif';

export type BuklodCommentMedia = {
  kind: BuklodCommentMediaKind;
  /** Storage path for image, or https URL for gif. */
  ref: string;
};

export function parseBuklodCommentMediaBody(body?: string | null): {
  media: BuklodCommentMedia | null;
  caption: string;
} {
  const raw = String(body ?? '');
  const match = raw.match(
    /^\[\[BUKLOD_COMMENT_MEDIA:v1:(image|gif):([^\]]*)\]\](?:\n|(?=$))/,
  );

  if (!match) {
    return { media: null, caption: raw };
  }

  let ref = match[2] ?? '';
  try {
    ref = decodeURIComponent(ref);
  } catch {
    // keep raw
  }

  ref = ref.trim();
  if (!ref) {
    return { media: null, caption: raw.slice(match[0].length) };
  }

  return {
    media: {
      kind: match[1] as BuklodCommentMediaKind,
      ref,
    },
    caption: raw.slice(match[0].length),
  };
}

export function encodeBuklodCommentMediaBody(
  media: BuklodCommentMedia | null | undefined,
  caption: string,
): string {
  const text = String(caption ?? '').trim();
  if (!media?.ref?.trim()) {
    return text;
  }

  const packed = encodeURIComponent(media.ref.trim());
  const header = `${PREFIX}${media.kind}:${packed}]]`;
  return text ? `${header}\n${text}` : header;
}

export function buklodCommentHasSendableContent(
  caption: string,
  media?: BuklodCommentMedia | null,
): boolean {
  return Boolean(String(caption ?? '').trim() || media?.ref?.trim());
}
