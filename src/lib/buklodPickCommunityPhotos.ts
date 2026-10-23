import { Alert, Platform } from 'react-native';

import { COMMUNITY_MAX_PHOTOS } from '@/lib/buklodCommunityMediaLimits';
import { ensureImagePickerLibraryAccess } from '@/lib/buklodImagePickerAccess';

export type PickedCommunityPhoto = {
  id: string;
  uri: string;
};

async function optimizePickedPhoto(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;
  try {
    const ImageManipulator = await import('expo-image-manipulator');
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1440 } }],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri || uri;
  } catch {
    // Preserve the original photo if device-side optimization is unavailable.
    return uri;
  }
}

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

  return Promise.all(result.assets
    .map(asset => ({
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uri: String(asset.uri ?? '').trim(),
    }))
    .filter(photo => !!photo.uri)
    .slice(0, remaining)
    .map(async photo => ({ ...photo, uri: await optimizePickedPhoto(photo.uri) })));
}

function isVideoAsset(asset: { type?: string | null; mimeType?: string | null }) {
  const type = String(asset.type ?? '').toLowerCase();
  const mime = String(asset.mimeType ?? '').toLowerCase();
  return type === 'video' || mime.startsWith('video/');
}

export async function pickCommunityGallery(options: {
  photoRemaining: number;
  hasVideo: boolean;
  maxPhotos?: number;
}): Promise<{
  photos: PickedCommunityPhoto[];
  videoAsset: any | null;
} | null> {
  const maxPhotos = options.maxPhotos ?? COMMUNITY_MAX_PHOTOS;
  const photoRemaining = Math.max(0, Number(options.photoRemaining ?? 0));

  if (photoRemaining <= 0 && options.hasVideo) {
    Alert.alert(
      'Gallery',
      `You can add 1 video and up to ${maxPhotos} photos.`,
    );
    return null;
  }

  const P = await import('expo-image-picker');
  const allowed = await ensureImagePickerLibraryAccess(
    P.requestMediaLibraryPermissionsAsync,
  );

  if (!allowed) {
    Alert.alert('Gallery', 'Please allow photo and video access.');
    return null;
  }

  const result = await P.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'] as any,
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: Math.max(
      1,
      photoRemaining + (options.hasVideo ? 0 : 1),
    ),
    quality: 0.85,
    videoMaxDuration: 30 * 60,
    legacy: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const videos = result.assets.filter(isVideoAsset);
  const images = result.assets.filter(asset => !isVideoAsset(asset));
  const photos = await Promise.all(images
    .map(asset => ({
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uri: String(asset.uri ?? '').trim(),
    }))
    .filter(photo => !!photo.uri)
    .slice(0, photoRemaining)
    .map(async photo => ({ ...photo, uri: await optimizePickedPhoto(photo.uri) })));

  const notices: string[] = [];

  if (videos.length > 1) {
    notices.push('Only one video can be added. The first video was kept.');
  }

  if (images.length > photoRemaining) {
    notices.push(
      photoRemaining > 0
        ? `Only ${maxPhotos} photos can be added. Extra photos were left out.`
        : `You can add up to ${maxPhotos} photos.`,
    );
  }

  if (notices.length) {
    Alert.alert('Gallery', notices.join('\n'));
  }

  const videoAsset = videos[0] ?? null;

  if (!photos.length && !videoAsset) {
    return null;
  }

  return { photos, videoAsset };
}
