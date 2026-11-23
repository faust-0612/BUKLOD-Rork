import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import type { BuklodCommentMedia } from '@/lib/buklodCommentMediaBody';
import { readVideoDurationSeconds, readVideoSizeBytes } from '@/lib/buklodCommunityWallMedia';
import { isLocalMediaUri } from '@/lib/buklodMediaUrl';
import { uploadCommunityVideoFile } from '@/lib/uploadCommunityVideoFile';

export const BUKLOD_COMMENT_VIDEO_MAX_SECONDS = 30;
export const BUKLOD_COMMENT_VIDEO_MAX_BYTES = 25 * 1024 * 1024;
type Selection = { uri: string; duration?: number | null; fileSize?: number | null; mimeType?: string | null; fileName?: string | null };

export function buklodCommentVideoFormat(value: { mimeType?: string | null; fileName?: string | null; uri?: string | null }): { mimeType: string; extension: 'mp4' | 'mov' | 'webm' } {
  const mimeType = String(value.mimeType ?? '').split(';')[0].trim().toLowerCase();
  const filename = String(value.fileName ?? value.uri ?? '').split(/[?#]/)[0].toLowerCase();
  if (mimeType === 'video/mp4') return { mimeType, extension: 'mp4' };
  if (mimeType === 'video/quicktime') return { mimeType, extension: 'mov' };
  if (mimeType === 'video/webm') return { mimeType, extension: 'webm' };
  if (!mimeType && /\.mp4$/.test(filename)) return { mimeType: 'video/mp4', extension: 'mp4' };
  if (!mimeType && /\.mov$/.test(filename)) return { mimeType: 'video/quicktime', extension: 'mov' };
  if (!mimeType && /\.webm$/.test(filename)) return { mimeType: 'video/webm', extension: 'webm' };
  throw new Error('Choose an MP4, MOV, or WebM short video.');
}
export function validateBuklodCommentVideoMetadata(durationSeconds: number, sizeBytes: number): string | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 'Could not read video duration. Choose another video.';
  if (durationSeconds > BUKLOD_COMMENT_VIDEO_MAX_SECONDS) return 'Short video comments must be 30 seconds or less.';
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return 'Could not read video size.';
  if (sizeBytes > BUKLOD_COMMENT_VIDEO_MAX_BYTES) return 'Short video comments must be 25 MB or less.';
  return null;
}
export function inspectBuklodCommentVideoSelection(asset: Selection) {
  if (!asset?.uri) throw new Error('Choose a video to attach.');
  const format = buklodCommentVideoFormat(asset);
  const durationSeconds = readVideoDurationSeconds(asset);
  const sizeBytes = Math.max(0, Number(asset.fileSize ?? 0));
  const error = validateBuklodCommentVideoMetadata(durationSeconds, sizeBytes);
  if (error) throw new Error(error);
  return { ...format, durationSeconds, sizeBytes };
}
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
