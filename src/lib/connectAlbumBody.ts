const CONNECT_ALBUM_PREFIX = '[[BUKLOD_CONNECT_ALBUM:v1:';

export function parseConnectAlbumBody(body?: string | null): {
  paths: string[];
  caption: string;
} {
  const raw = String(body ?? '');
  const match = raw.match(
    /^\[\[BUKLOD_CONNECT_ALBUM:v1:([^\]]*)\]\](?:\n|(?=$))/
  );

  if (!match) {
    return { paths: [], caption: raw };
  }

  const paths = match[1]
    .split('|')
    .map(part => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .map(part => part.trim())
    .filter(Boolean);

  return {
    paths,
    caption: raw.slice(match[0].length),
  };
}

export function encodeConnectAlbumBody(
  paths: string[],
  caption: string
) {
  const trimmed = String(caption ?? '').trim();

  if (paths.length <= 1) {
    return trimmed;
  }

  const packed = paths.map(path => encodeURIComponent(path)).join('|');
  return `${CONNECT_ALBUM_PREFIX}${packed}]]${trimmed ? `\n${trimmed}` : ''}`;
}

export function getConnectMessageImagePaths(item: {
  body?: string | null;
  attachment_path?: string | null;
  attachment_mime?: string | null;
}) {
  const parsed = parseConnectAlbumBody(item.body);

  if (parsed.paths.length) {
    return parsed.paths;
  }

  if (
    item.attachment_path &&
    String(item.attachment_mime ?? '').startsWith('image/')
  ) {
    return [item.attachment_path];
  }

  return [];
}

export function connectAlbumInboxPreview(body?: string | null) {
  const raw = String(body ?? '');

  if (!/\[\[BUKLOD_CONNECT_ALBUM:/.test(raw)) {
    return null;
  }

  const parsed = parseConnectAlbumBody(raw);
  const caption = parsed.caption.trim();

  if (
    caption &&
    !/\[\[BUKLOD_CONNECT_ALBUM:/.test(caption)
  ) {
    return caption;
  }

  if (parsed.paths.length > 1) {
    return `Photo · ${parsed.paths.length}`;
  }

  return 'Photo';
}
