/**
 * Lightweight link detection for BUKLOD Connect bubbles. Never execute message
 * text as markup; only explicit web URLs and our existing Cluster invite
 * schemes become tap targets. Retain punctuation and all surrounding text.
 */
export type ConnectMessageLinkPart = {
  text: string;
  href: string | null;
};

const LINK_CANDIDATE = /(?:https?:\/\/|buklod(?:-staging)?:\/\/)[^\s<>"']+/gi;
const VALID_CLUSTER_SCHEME =
  /^buklod(?:-staging)?:\/\/clusters\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:[?#][^\s]*)?$/i;

function tappableUrl(value: string): boolean {
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return (url.protocol === 'https:' || url.protocol === 'http:') &&
        Boolean(url.hostname);
    } catch {
      return false;
    }
  }
  return VALID_CLUSTER_SCHEME.test(value);
}

export function splitConnectMessageLinks(message: string): ConnectMessageLinkPart[] {
  const text = String(message ?? '');
  const result: ConnectMessageLinkPart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_CANDIDATE)) {
    const at = match.index ?? 0;
    if (at > last) result.push({ text: text.slice(last, at), href: null });

    const candidate = match[0];
    const core = candidate.replace(/[.,!?;:)]+$/g, '');
    const tail = candidate.slice(core.length);
    if (core && tappableUrl(core)) {
      result.push({ text: core, href: core });
    } else {
      result.push({ text: core, href: null });
    }
    if (tail) result.push({ text: tail, href: null });
    last = at + candidate.length;
  }
  if (last < text.length) result.push({ text: text.slice(last), href: null });
  if (!result.length) result.push({ text, href: null });
  return result;
}
