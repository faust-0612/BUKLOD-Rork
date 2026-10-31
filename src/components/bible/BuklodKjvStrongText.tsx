import React from 'react';
import { Alert, Linking, Text, type StyleProp, type TextStyle } from 'react-native';
import {
  alignKjvStrongWords,
  strongLexiconUrl,
  type TaggedKjvWord,
} from '@/lib/buklodBibleStudy';

/**
 * The highlighted KJV word itself opens the exact H/G Strong's entry.
 * No generated/made-up matches; unaligned text remains ordinary scripture.
 */
export default function BuklodKjvStrongText({
  text,
  tags,
  textStyle,
}: {
  text: string;
  tags?: TaggedKjvWord[];
  textStyle?: StyleProp<TextStyle>;
}) {
  const aligned = alignKjvStrongWords(text, tags);
  return (
    <Text style={textStyle}>
      {aligned.map((segment, i) => {
        const first = segment.strongs[0];
        const target = first ? strongLexiconUrl(first) : null;
        if (!target) return <Text key={i}>{segment.text}</Text>;
        return (
          <Text
            key={i}
            accessibilityRole="link"
            accessibilityLabel={`${segment.text}, Strong's ${segment.strongs.join(', ')}`}
            onPress={(event) => {
              event.stopPropagation();
              void Linking.openURL(target).catch(() =>
                Alert.alert('Strong’s Concordance', 'Hindi mabuksan ang reference. Suriin ang internet connection.')
              );
            }}
            style={{ color: '#1B6F49', backgroundColor: '#E1F3E8', textDecorationLine: 'underline', fontWeight: '700' }}
          >
            {segment.text}
          </Text>
        );
      })}
    </Text>
  );
}
