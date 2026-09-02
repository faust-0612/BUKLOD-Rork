import { Alert } from 'react-native';

import { COMMUNITY_MAX_PHOTOS } from '@/lib/buklodCommunityMediaLimits';
import { ensureImagePickerLibraryAccess } from '@/lib/buklodImagePickerAccess';

export type PickedCommunityPhoto = {
  id: string;
  uri: string;
};

export async function pickCommunityPhotos(options: {
  remaining: number;
  maxPhotos?: number;
}): Promise<PickedCommunityPhoto[]> {
  const maxPhotos = options.maxPhotos ?? COMMUNITY_MAX_PHOTOS;
  const remaining = Math.max(0, Number(options.remaining ?? 0));

  if (remaining <= 0) {
    Alert.alert(
      'Photos',
      `You can add up to ${maxPhotos} photos per post.`
    );
    return [];
  }

  const P = await import('expo-image-picker');
  const allowed = await ensureImagePickerLibraryAccess(
    P.requestMediaLibraryPermissionsAsync
  );

  if (!allowed) {
    Alert.alert('Photos', 'Please allow photo access.');
    return [];
  }

  const result = await P.launchImageLibraryAsync({
    mediaTypes: ['images'] as any,
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 0.85,
    legacy: false,
  });

  if (result.canceled || !result.assets?.length) {
    return [];
  }

  return result.assets
    .map(asset => ({
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uri: String(asset.uri ?? '').trim(),
    }))
    .filter(photo => !!photo.uri)
    .slice(0, remaining);
}
