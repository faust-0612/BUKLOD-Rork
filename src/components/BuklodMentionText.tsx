import React, { useMemo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

const MENTION_RE =
  /@[A-Za-z0-9][A-Za-z0-9._'-]*(?:\s+[A-Z][A-Za-z0-9._'-]*){0,3}/g;

export function splitMentionParts(text: string) {
  const source = String(text ?? '');
  const parts: { value: string; mention: boolean }[] = [];
  let cursor = 0;
  const matches = source.matchAll(MENTION_RE);

  for (const match of matches) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push({
        value: source.slice(cursor, index),
        mention: false,
      });
    }
    parts.push({
      value: match[0],
      mention: true,
    });
    cursor = index + match[0].length;
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
  numberOfLines,
}: Props) {
  const parts = useMemo(
    () => splitMentionParts(text),
    [text]
  );

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) =>
        part.mention ? (
          <Text key={`${index}-${part.value}`} style={mentionStyle}>
            {part.value}
          </Text>
        ) : (
          part.value
        )
      )}
    </Text>
  );
}

export default BuklodMentionText;
