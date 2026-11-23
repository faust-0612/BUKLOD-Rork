import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { BuklodCommentMedia } from '@/lib/buklodCommentMediaBody';
import { readVideoSizeBytes } from '@/lib/buklodCommunityWallMedia';
import { buklodCommentVideoFormat, validateBuklodCommentVideoMetadata } from '@/lib/buklodCommentVideoValidation';
import { isLocalMediaUri } from '@/lib/buklodMediaUrl';
import { uploadCommunityVideoFile } from '@/lib/uploadCommunityVideoFile';

/** Enforce actual file-size limit again, not just gallery metadata. */
export async function uploadBuklodCommentVideo(media: BuklodCommentMedia, pathBase: string): Promise<BuklodCommentMedia> {
  if (media.kind !== 'video' || !isLocalMediaUri(media.ref)) throw new Error('Select a local short video before uploading.');
  const format = buklodCommentVideoFormat({ mimeType: media.mimeType, uri: media.ref });
  const nativeSizeLookup = Platform.OS === 'web' ? undefined : async (uri: string) => {
    const info: any = await FileSystem.getInfoAsync(uri, { size: true });
    return { exists: Boolean(info?.exists), size: Number(info?.size ?? 0) };
  };
  let sizeBytes = await readVideoSizeBytes({ uri: media.ref, fileSize: media.sizeBytes }, nativeSizeLookup);
  if (!sizeBytes && Platform.OS === 'web') {
    const response = await fetch(media.ref);
    if (response.ok) sizeBytes = (await response.blob()).size;
  }
  if (!sizeBytes) throw new Error('Could not read video size. Choose the video again.');
  const error = validateBuklodCommentVideoMetadata(Number(media.durationSeconds ?? 0), sizeBytes);
  if (error) throw new Error(error);
  const path = pathBase + '.' + format.extension;
  await uploadCommunityVideoFile({ path, uri: media.ref, contentType: format.mimeType, generateWallPreview: false });
  return { kind: 'video', ref: path };
}
