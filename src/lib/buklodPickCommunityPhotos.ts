import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { COMMUNITY_MAX_PHOTOS } from '@/lib/buklodCommunityMediaLimits';
import { ensureImagePickerLibraryAccess } from '@/lib/buklodImagePickerAccess';

export type PickedCommunityPhoto = {
  id: string;
  uri: string;
  /** Browser-owned file avoids re-fetching multi-MB data URIs in iOS webviews. */
  webFile?: Blob;
  mimeType?: string;
  width?: number;
  height?: number;
};


/**
 * Android Photo Picker can fail to launch on some devices. Retain the native
 * picker first (photo/video metadata intact); try its legacy path on failure,
 * then use Android's grant-scoped Files picker for photos.
 *
 * Files offers no verified video duration, so it must never be used to bypass
 * the Community Wall video-duration contract. Web/iOS are unchanged.
 */
async function recoverAndroidCommunityLibrary(
  originalError: unknown,
  pickerOptions: ImagePicker.ImagePickerOptions,
  remainingPhotos: number,
): Promise<ImagePicker.ImagePickerResult> {
  if (Platform.OS !== 'android') throw originalError;

  try {
    return await ImagePicker.launchImageLibraryAsync({
      ...pickerOptions,
      legacy: true,
    });
  } catch (legacyError) {
    if (remainingPhotos <= 0) throw legacyError;

    const documents = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (documents.canceled || !documents.assets?.length) {
      return { canceled: true, assets: null };
    }

    const photos: ImagePicker.ImagePickerAsset[] = documents.assets
      .filter(asset => {
        const mime = String(asset.mimeType ?? '').toLowerCase();
        const name = String(asset.name ?? '').toLowerCase();
        // Accept supported images only; never treat arbitrary file/video as photo.
        return mime
          ? /^image\/(jpeg|png|gif|webp|heic|heif|avif|bmp)$/.test(mime)
          : /\.(jpe?g|png|gif|webp|heic|heif|avif|bmp)$/.test(name);
      })
      .filter(asset => Boolean(String(asset.uri ?? '').trim()))
      .slice(0, remainingPhotos)
      .map(asset => ({
        uri: asset.uri,
        width: 0,
        height: 0,
        type: 'image' as const,
        fileName: asset.name,
        mimeType: asset.mimeType ?? undefined,
        fileSize: asset.size ?? undefined,
      }));

    return photos.length
      ? { canceled: false, assets: photos }
      : { canceled: true, assets: null };
  }
}

export async function pickCommunityPhotos(options: {
  remaining: number;
  maxPhotos?: number;
  /** Preserve original animated GIF bytes in comment attachments. */
  preserveAnimation?: boolean;
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

  // Expo web picker must run directly within the tap gesture. Permissions
  // are native-only; awaiting the web no-op loses transient user activation.
  if (Platform.OS !== 'web') {
    const allowed = await ensureImagePickerLibraryAccess(
      ImagePicker.requestMediaLibraryPermissionsAsync
    );
    if (!allowed) {
      Alert.alert('Photos', 'Please allow photo access.');
      return [];
    }
  }

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 1, // Avoid a second lossy picker encode; encode once at publish.
    legacy: false,
  };
  const result = await ImagePicker.launchImageLibraryAsync(pickerOptions)
    .catch(error => recoverAndroidCommunityLibrary(error, pickerOptions, remaining));

  if (result.canceled || !result.assets?.length) {
    return [];
  }

  return result.assets
    .map(asset => ({
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uri: String(asset.uri ?? '').trim(),
      webFile: Platform.OS === 'web' ? asset.file ?? undefined : undefined,
      mimeType: String(asset.mimeType ?? asset.file?.type ?? '').trim().toLowerCase() || undefined,
      width: Number(asset.width ?? 0) > 0 ? Number(asset.width) : undefined,
      height: Number(asset.height ?? 0) > 0 ? Number(asset.height) : undefined,
    }))
    .filter(photo => !!photo.uri)
    .slice(0, remaining);
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

  // Do not await a permission request or a dynamic import before opening
  // the web file dialog. Video and photo selection share this gesture path.
  if (Platform.OS !== 'web') {
    const allowed = await ensureImagePickerLibraryAccess(
      ImagePicker.requestMediaLibraryPermissionsAsync,
    );
    if (!allowed) {
      Alert.alert('Gallery', 'Please allow photo and video access.');
      return null;
    }
  }

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images', 'videos'],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: Math.max(
      1,
      photoRemaining + (options.hasVideo ? 0 : 1),
    ),
    quality: 1, // Local preview first; resize/compress once at publish.
    videoMaxDuration: 30 * 60,
    legacy: false,
  };
  const result = await ImagePicker.launchImageLibraryAsync(pickerOptions)
    .catch(error => recoverAndroidCommunityLibrary(error, pickerOptions, photoRemaining));

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const videos = result.assets.filter(isVideoAsset);
  const images = result.assets.filter(asset => !isVideoAsset(asset));
  const photos = images
    .map(asset => ({
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uri: String(asset.uri ?? '').trim(),
      webFile: Platform.OS === 'web' ? asset.file ?? undefined : undefined,
      mimeType: String(asset.mimeType ?? asset.file?.type ?? '').trim().toLowerCase() || undefined,
      width: Number(asset.width ?? 0) > 0 ? Number(asset.width) : undefined,
      height: Number(asset.height ?? 0) > 0 ? Number(asset.height) : undefined,
    }))
    .filter(photo => !!photo.uri)
    .slice(0, photoRemaining);

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
