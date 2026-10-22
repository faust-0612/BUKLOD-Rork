import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodPressable from '@/components/BuklodPressable';

import {
  BuklodTappableAvatar,
} from '@/components/BuklodTappableAvatar';
import {
  formatSpecificDateTime,
} from '@/lib/dateTime';
import {
  repairMojibakeText,
} from '@/lib/repairMojibakeText';
import {
  colors,
} from '@/lib/theme';
import {
  useBuklodTheme,
} from '@/providers/BuklodThemeProvider';

export type BuklodCommunityCommentPreviewData = {
  comment_id?: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at?: string;
};

type Props = {
  preview: BuklodCommunityCommentPreviewData;
  onPress: () => void;
  variant?: 'default' | 'reel';
};

export function BuklodCommunityCommentPreview({
  preview,
  onPress,
  variant = 'default',
}: Props) {
  const { theme } = useBuklodTheme();
  const isReel = variant === 'reel';

  return (
    <BuklodPressable
      accessibilityRole="button"
      accessibilityLabel="Open comments"
      nested
      onPress={onPress}
      style={[
        styles.row,
        isReel
          ? styles.reelRow
          : {
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
            },
      ]}
    >
      <BuklodTappableAvatar
        userId={preview.user_id}
        name={preview.author_name}
        size={isReel ? 24 : 28}
      />

      <View style={styles.copy}>
        <View style={styles.metaRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.name,
              isReel && styles.reelName,
              !isReel && { color: theme.textPrimary },
            ]}
          >
            {preview.author_name}
          </Text>

          {!!preview.created_at && !isReel && (
            <Text
              style={[
                styles.time,
                { color: theme.textMuted },
              ]}
            >
              {formatSpecificDateTime(preview.created_at)}
            </Text>
          )}
        </View>

        <Text
          numberOfLines={2}
          style={[
            styles.body,
            isReel && styles.reelBody,
            !isReel && { color: theme.textPrimary },
          ]}
        >
          {repairMojibakeText(preview.body)}
        </Text>
      </View>
    </BuklodPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reelRow: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  name: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  reelName: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  time: {
    fontSize: 10,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.text,
  },
  reelBody: {
    color: '#F2F5F3',
    fontSize: 11,
    lineHeight: 15,
  },
});

export default BuklodCommunityCommentPreview;
