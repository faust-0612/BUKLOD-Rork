import React, { useMemo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { BUKLOD_MENTION_COLOR } from '@/lib/buklodMentionCompose';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
  knownNames?: string[];
  numberOfLines?: number;
};

const MENTION_RE =
  /@[A-Za-z0-9][A-Za-z0-9._'-]*(?:\s+[A-Z][A-Za-z0-9._'-]*){0,3}/g;

const DEFAULT_MENTION_STYLE: TextStyle = {
  color: BUKLOD_MENTION_COLOR,
  fontWeight: '800',
};

function rangesOverlap(
  ranges: { start: number; end: number }[],
  start: number,
  end: number,
) {
  return ranges.some(
    range => start < range.end && end > range.start,
  );
}

export function splitMentionParts(
  text: string,
  knownNames: string[] = [],
) {
  const source = String(text ?? '');
  const ranges: { start: number; end: number }[] = [];
  const lower = source.toLowerCase();
  const names = [...knownNames]
    .map(name => String(name ?? '').trim())
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);

  for (const name of names) {
    const token = `@${name.toLowerCase()}`;
    let from = 0;

    while (from < source.length) {
      const index = lower.indexOf(token, from);

      if (index < 0) {
        break;
      }

      const end = index + token.length;
      const previous = index === 0 ? ' ' : source[index - 1];
      const next = source[end] ?? ' ';

      if (
        /\s/.test(previous) &&
        (next === '' || /[\s.,!?;:]/.test(next)) &&
        !rangesOverlap(ranges, index, end)
      ) {
        ranges.push({ start: index, end });
      }

      from = index + token.length;
    }
  }

  for (const match of source.matchAll(MENTION_RE)) {
    const index = match.index ?? 0;
    const end = index + match[0].length;

    if (!rangesOverlap(ranges, index, end)) {
      ranges.push({ start: index, end });
    }
  }

  ranges.sort((left, right) => left.start - right.start);

  const parts: { value: string; mention: boolean }[] = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push({
        value: source.slice(cursor, range.start),
        mention: false,
      });
    }

    parts.push({
      value: source.slice(range.start, range.end),
      mention: true,
    });
    cursor = range.end;
  }

  if (cursor < source.length) {
    parts.push({
      value: source.slice(cursor),
      mention: false,
    });
  }

  if (!parts.length) {
    parts.push({ value: source, mention: false });
  }

  return parts;
}

export function BuklodMentionText({
  text,
  style,
  mentionStyle,
  knownNames,
  numberOfLines,
}: Props) {
  const parts = useMemo(
    () => splitMentionParts(text, knownNames),
    [knownNames, text],
  );

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) =>
        part.mention ? (
          <Text
            key={`${index}-${part.value}`}
            style={mentionStyle ?? DEFAULT_MENTION_STYLE}
          >
            {part.value}
          </Text>
        ) : (
          part.value
        ),
      )}
    </Text>
  );
}

export default BuklodMentionText;
