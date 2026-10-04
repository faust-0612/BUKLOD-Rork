import {
  querySmartDrawerItems,
} from './localStore';
import type {
  SmartDrawerItem,
} from './types';

function tokens(item: SmartDrawerItem) {
  return new Set(
    [
      item.title,
      item.body,
      item.extractedText,
      item.location,
      item.type,
      ...item.listItems.map(entry => entry.text),
    ]
      .join(' ')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9À-ÿ]+/gi, ' ')
      .split(/\s+/)
      .filter(value => value.length >= 4)
      .slice(0, 200),
  );
}

export async function findRelatedSmartDrawerItems(
  userId: string,
  item: SmartDrawerItem,
  limit = 3,
) {
  const candidates = await querySmartDrawerItems(userId, {
    view: 'for-you',
    limit: 100,
  });

  const source = tokens(item);
  if (!source.size) return [];

  return candidates
    .filter(candidate => candidate.id !== item.id)
    .map(candidate => {
      const other = tokens(candidate);
      let overlap = 0;
      for (const token of source) {
        if (other.has(token)) overlap += 1;
      }

      if (
        candidate.type === item.type &&
        candidate.type !== 'QUICK_NOTE'
      ) {
        overlap += 1;
      }

      return { candidate, overlap };
    })
    .filter(row => row.overlap >= 2)
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        Date.parse(b.candidate.updatedAt) -
          Date.parse(a.candidate.updatedAt),
    )
    .slice(0, Math.max(0, limit))
    .map(row => row.candidate);
}
