import React from 'react';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import BuklodPressable from '@/components/BuklodPressable';
import { parseBuklodCommentMediaBody } from '@/lib/buklodCommentMediaBody';

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
  const parsed = parseBuklodCommentMediaBody(preview.body);
  // RPC snippets sometimes truncate a media header: never expose its token.
  const encoded = String(preview.body || '').startsWith('[[BUKLOD_COMMENT_MEDIA:v1:');
  const isGif = parsed.media?.kind === 'gif' ||
    String(preview.body || '').startsWith('[[BUKLOD_COMMENT_MEDIA:v1:gif:');
  const isPhoto = parsed.media?.kind === 'image' || (encoded && !isGif);
  const visibleCaption = encoded && !parsed.media ? '' : parsed.caption;

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

        {isGif ? (
          <View style={styles.mediaRow}>
            {parsed.media?.kind === 'gif' && /^https:\/\//i.test(parsed.media.ref) ? (
              <ExpoImage source={{ uri: parsed.media.ref }} style={styles.gifThumb} contentFit="cover" />
            ) : <MaterialCommunityIcons name="file-gif-box" size={23} color={isReel ? '#FFFFFF' : '#186B50'} />}
            <Text style={[styles.mediaLabel, isReel && styles.reelBody]}>GIF · Tap to view</Text>
          </View>
        ) : isPhoto ? (
          <Text style={[styles.mediaLabel, isReel && styles.reelBody]}>Photo · Tap to view</Text>
        ) : null}
        {!!visibleCaption.trim() && (
          <Text numberOfLines={2} style={[styles.body, isReel && styles.reelBody,
            !isReel && { color: theme.textPrimary }]}>
            {repairMojibakeText(visibleCaption)}
          </Text>
        )}
      </View>
    </BuklodPressable>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
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
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  reelName: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
  },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  gifThumb: { width: 58, height: 48, borderRadius: 8 },
  mediaLabel: { fontSize: 13, fontWeight: '800', color: '#186B50' },
  body: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.text,
  },
  reelBody: {
    color: '#F2F5F3',
    fontSize: 13,
    lineHeight: 18,
  },
});

export default BuklodCommunityCommentPreview;
