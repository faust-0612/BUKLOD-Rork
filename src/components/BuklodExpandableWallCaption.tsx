import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BuklodMentionText } from '@/components/BuklodMentionText';

type Props = React.ComponentProps<typeof BuklodMentionText>;

/** Keep long Community Wall captions compact until the reader expands them. */
export function BuklodExpandableWallCaption(props: Props) {
  const [expanded, setExpanded] = useState(false);
  const fullText = String(props.text ?? '');
  const long = fullText.length > 280;
  const shown = long && !expanded ? fullText.slice(0, 280).trimEnd() + '…' : fullText;
  return (
    <View>
      <BuklodMentionText {...props} text={shown} />
      {long ? (
        <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'See less' : 'See more'} onPress={() => setExpanded(value => !value)} style={{ alignSelf: 'flex-start', paddingVertical: 5 }}>
          <Text style={{ fontWeight: '700', color: '#2867A5' }}>{expanded ? 'See less' : 'See more'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
