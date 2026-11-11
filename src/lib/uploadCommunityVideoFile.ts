/* BUKLOD_COMMUNITY_WEB_UPLOAD_R2 */
/* BUKLOD_AWS_WALL_VIDEO_ROUTE_R1 (legacy reads only; new writes retired) */
/* BUKLOD_SUPABASE_ONLY_VIDEO_UPLOAD_R1 */
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ReactNativeImage, Platform } from 'react-native';
import { classifyNetworkQuality } from '@/lib/buklodNetworkQuality';
import { communityWallPreviewOriginalPath, communityWallPreviewPath } from '@/lib/communityWallPreviewPath';

import {
  BUKLOD_VIDEO_MAX_SIZE_BYTES,
  classifyCommunityUploadFailure,
  communityUploadFailureMessage,
  communityVideoTooLargeMessage,
  readVideoSizeBytes,
  type CommunityUploadFailureReason,
} from '@/lib/buklodCommunityWallMedia';
import { supabase } from '@/lib/supabase';
import {
  communityVideoPostPreviewPath,
  communityVideoUploadPreviewPath,
  generateCommunityVideoPreview,
  saveCommunityVideoThumbnail,
} from '@/lib/communityVideoPreview';
import {
  shouldUseResumableUpload,
  toDirectStorageUrl,
  uploadCommunityFileResumableTus,
} from '@/lib/uploadCommunityResumableTus';

export type CommunityVideoUploadProgress = {
  sentBytes: number;
  totalBytes: number;
  ratio: number;
};

async function readWebBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Could not read selected media (${response.status}).`);
  }
  return response.blob();
}

async function readBinarySizeBytes(uri: string): Promise<number> {
  if (Platform.OS === 'web') {
    const blob = await readWebBlob(uri);
    return Number(blob.size ?? 0);
  }

  const info: any = await FileSystem.getInfoAsync(
    uri,
    { size: true } as any,
  );
  return Number(info?.size ?? 0);
}

function throwClassifiedUploadError({
  failureLabel,
  sizeBytes,
  status,
  body,
  message,
  aborted,
}: {
  failureLabel: string;
  sizeBytes?: number;
  status?: number | null;
  body?: string | null;
  message?: string | null;
  aborted?: boolean;
}): never {
  const reason: CommunityUploadFailureReason =
    classifyCommunityUploadFailure({
      status,
      body,
      message,
      aborted,
    });

  throw new Error(
    communityUploadFailureMessage(reason, {
      sizeBytes,
      failureLabel,
      serverBody: body || message || '',
    }),
  );
}

/*
 * All new IGPAT and Community videos use private Supabase Storage.
 * Native small files stream via signed PUT; large files use bounded 6 MiB TUS
 * chunks with offset recovery. Historical external objects remain read-only.
 */
export async function uploadCommunityVideoFile({
  path,
  uri,
  contentType,
  onProgress,
  generateWallPreview = false,
}: {
  path: string;
  uri: string;
  contentType: string;
  onProgress?: (
    progress: CommunityVideoUploadProgress
  ) => void;
  /** Generate a private, durable poster for Community Wall videos only. */
  generateWallPreview?: boolean;
}): Promise<{ preview_path?: string; preview_bytes?: number }> {
  const uploadPreview = async (): Promise<{ preview_path?: string; preview_bytes?: number }> => {
    if (!generateWallPreview) return {};
    const parts = String(path ?? '').split('/');
    const ownerId = parts[0] === 'scope' ? parts[2] : parts[0];
    const previewPath = communityVideoUploadPreviewPath(ownerId, path);
    if (!previewPath) return {};
    const preview = await generateCommunityVideoPreview(uri).catch(() => null);
    if (!preview) return {};
    try {
      await uploadCommunityBinaryFile({
        path: previewPath,
        uri: preview.uri,
        contentType: 'image/jpeg',
        sizeBytes: preview.sizeBytes,
        failureLabel: 'Video preview',
        preferResumable: false,
      });
      return { preview_path: previewPath, preview_bytes: preview.sizeBytes };
    } catch {
      // Video is authoritative; a failed optional poster never blocks posting.
      return {};
    } finally {
      await preview.cleanup().catch(() => undefined);
    }
  };
  let sizeBytes = await readVideoSizeBytes(
    { uri },
    Platform.OS === 'web'
      ? undefined
      : async fileUri => {
          const info: any = await FileSystem.getInfoAsync(
            fileUri,
            { size: true } as any,
          );
          return {
            exists: Boolean(info?.exists),
            size: Number(info?.size ?? 0),
          };
        },
  );

  if (!sizeBytes && Platform.OS === 'web') {
    sizeBytes = await readBinarySizeBytes(uri);
  }

  if (!sizeBytes) {
    // Do not accidentally fall back to an unbounded upload for unknown sizes.
    throw new Error('Could not determine this video file size. Please reselect the video and try again.');
  }
  if (sizeBytes > BUKLOD_VIDEO_MAX_SIZE_BYTES) {
    throw new Error(communityVideoTooLargeMessage(sizeBytes));
  }

  await uploadCommunityBinaryFile({
    path,
    uri,
    contentType,
    onProgress,
    sizeBytes,
    failureLabel: 'Video',
    preferResumable: true,
  });
  return await uploadPreview();
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];

  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  // Avoid saturating a weak uplink with three concurrent photo PUTs.
  const quality = classifyNetworkQuality();
  const workerCount = Math.min(
    quality === 'normal' ? Math.max(1, concurrency) : 1,
    items.length,
  );

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );
  return results;
}

// Determine dimensions only for photos requiring encoding. Never upscale.
async function readCommunityPhotoDimensions(uri: string): Promise<{width: number; height: number} | null> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (dimensions: {width: number; height: number} | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(dimensions);
    };
    const timer = setTimeout(() => finish(null), 3000);
    try {
      ReactNativeImage.getSize(
        uri,
        (width, height) => finish(width > 0 && height > 0 ? {width, height} : null),
        () => finish(null),
      );
    } catch {
      finish(null);
    }
  });
}

/** Browser-only JPEG fallback for photo formats WebKit can decode.
 * This is attempted only if Expo's converter failed, and keeps source
 * Blob URLs short-lived so repeated photos do not leak resources.
 */
async function convertWebPhotoToJpegBlob(source: Blob): Promise<Blob | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  let url: string;
  try {
    url = URL.createObjectURL(source);
  } catch {
    return null;
  }
  try {
    const image = document.createElement('img');
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Image decode timed out')), 12000);
      image.onload = () => { clearTimeout(timeout); resolve(); };
      image.onerror = () => { clearTimeout(timeout); reject(new Error('Image decode failed')); };
      image.src = url;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) return null;
    const scale = Math.min(1, 1440 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    );
    return result?.size && /^image\/jpeg$/i.test(result.type) ? result : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareCommunityJpegUri(
  uri: string,
  webFile?: Blob | null,
): Promise<{ uri: string; sizeBytes: number; webBlob?: Blob }> {
  // Expo's web picker provides a File. Keep the actual bytes instead of
  // loading a large base64 URI again in the iOS Messenger browser.
  const webSelectedBlob = Platform.OS === 'web'
    ? webFile ?? await readWebBlob(uri).catch(() => null)
    : null;
  const existingBytes = webSelectedBlob
    ? Number(webSelectedBlob.size ?? 0)
    : await readBinarySizeBytes(uri).catch(() => 0);
  const actualMime = String(webSelectedBlob?.type ?? '').trim().toLowerCase();
  const isJpeg = actualMime
    ? /^image\/jpe?g$/.test(actualMime)
    : /\.jpe?g(?:[?#]|$)/i.test(uri) || /^data:image\/jpe?g[;,]/i.test(uri);

  // Small native JPEGs can upload unchanged; larger native files must pass
  // through bounded resize/compression to avoid weak-uplink floods.
  if (Platform.OS !== 'web' && isJpeg && existingBytes > 0 && existingBytes <= 2 * 1024 * 1024) {
    return { uri, sizeBytes: existingBytes };
  }

  // Preserve the iOS Messenger web recovery: bypass unreliable WebKit canvas
  // conversion for already valid JPEG bytes, without affecting native limits.
  if (Platform.OS === 'web') {
    if (isJpeg && existingBytes > 0 && existingBytes <= 12 * 1024 * 1024) {
      return { uri, sizeBytes: existingBytes, webBlob: webSelectedBlob ?? undefined };
    }
  }

  try {
    const M = await import('expo-image-manipulator');
    const context = M.ImageManipulator.manipulate(uri);
    const dimensions = await readCommunityPhotoDimensions(uri);
    if (dimensions && Math.max(dimensions.width, dimensions.height) > 1440) {
      context.resize({
        width: dimensions.width >= dimensions.height ? 1440 : null,
        height: dimensions.height > dimensions.width ? 1440 : null,
      });
    }
    const rendered = await context.renderAsync();
    const image = await rendered.saveAsync({
      format: M.SaveFormat.JPEG,
      compress: 0.82,
    });
    const fileUri = String(image.uri ?? '').trim();
    if (!fileUri) throw new Error('Photo conversion did not return an image.');
    const webBlob = Platform.OS === 'web'
      ? await readWebBlob(fileUri)
      : null;
    const sizeBytes = webBlob
      ? Number(webBlob.size ?? 0)
      : await readBinarySizeBytes(fileUri);
    if (!sizeBytes || (webBlob && !/^image\/jpeg$/i.test(webBlob.type))) {
      throw new Error('Prepared photo is not a valid JPEG.');
    }
    return { uri: fileUri, sizeBytes, webBlob: webBlob ?? undefined };
  } catch (error) {
    if (Platform.OS === 'web') {
      // Browser canvas is an independent fallback for PNG/HEIC that WebKit
      // itself can decode, without uploading non-JPEG bytes as a .jpg.
      const converted = webSelectedBlob
        ? await convertWebPhotoToJpegBlob(webSelectedBlob)
        : null;
      if (converted) {
        return { uri, sizeBytes: converted.size, webBlob: converted };
      }
      if (isJpeg && existingBytes > 0 && existingBytes <= 45 * 1024 * 1024) {
        return { uri, sizeBytes: existingBytes, webBlob: webSelectedBlob ?? undefined };
      }
      throw new Error(
        'This photo could not be converted in your browser. Try a JPEG photo or open BUKLOD in Safari.',
      );
    }
    throw error;
  }
}
/**
 * Optional preview generation is deliberately best-effort. Never sacrifice
 * the original upload or a post to make a thumbnail.
 */
export async function prepareCommunityPreviewJpegUri(
  uri: string,
): Promise<{ uri: string; sizeBytes: number } | null> {
  if (Platform.OS === 'web') return null; // Native only until browser path is validated.
  const dims = await readCommunityPhotoDimensions(uri);
  if (!dims?.width || !dims?.height) return null; // No unknown upscaling.
  try {
    const M = await import('expo-image-manipulator');
    for (const side of [480, 320]) {
      const context = M.ImageManipulator.manipulate(uri);
      const longest = Math.max(dims.width, dims.height);
      if (longest > side) {
        context.resize(dims.width >= dims.height
          ? { width: side }
          : { height: side });
      }
      const rendered = await context.renderAsync();
      const encoded = await rendered.saveAsync({
        format: M.SaveFormat.JPEG,
        compress: side === 480 ? 0.56 : 0.48,
      });
      const result = String(encoded.uri ?? '').trim();
      const sizeBytes = result ? await readBinarySizeBytes(result).catch(() => 0) : 0;
      // Preview has value only when genuinely small; never upload a huge
      // second file in the name of weak-network performance.
      if (result && sizeBytes > 0 && sizeBytes <= 125 * 1024) {
        return { uri: result, sizeBytes };
      }
    }
  } catch {
    // Unsupported format/corrupt image: original upload remains authoritative.
  }
  return null;
}

export async function uploadCommunityPhotoFile({
  path,
  uri,
  webFile,
  onProgress,
  wallPreview = false,
}: {
  path: string;
  uri: string;
  webFile?: Blob;
  onProgress?: (
    progress: CommunityVideoUploadProgress
  ) => void;
  wallPreview?: boolean;
}): Promise<{ sizeBytes: number; path: string }> {
  const prepared = await prepareCommunityJpegUri(uri, webFile);
  let actualPath = path;

  // Upload preview first; only mark the original path with -p1 after Storage
  // confirms a successful preview PUT. Failed previews remain optional and
  // are never referenced by the Wall, preventing broken legacy tiles.
  const taggedOriginal = wallPreview ? communityWallPreviewOriginalPath(path) : null;
  const previewPath = taggedOriginal ? communityWallPreviewPath(taggedOriginal) : null;
  if (previewPath && taggedOriginal) {
    const preview = await prepareCommunityPreviewJpegUri(prepared.uri).catch(() => null);
    if (preview) {
      try {
        await uploadCommunityBinaryFile({
          path: previewPath,
          uri: preview.uri,
          contentType: 'image/jpeg',
          sizeBytes: preview.sizeBytes,
          failureLabel: 'Photo preview',
          preferResumable: false,
        });
        actualPath = taggedOriginal;
      } catch {
        // Fall back to the unmarked original. The post remains publishable.
      }
    }
  }

  await uploadCommunityBinaryFile({
    path: actualPath,
    uri: prepared.uri,
    webBlob: prepared.webBlob,
    contentType: 'image/jpeg',
    onProgress,
    sizeBytes: prepared.sizeBytes,
    failureLabel: 'Photo',
    preferResumable: false,
  });

  return { sizeBytes: prepared.sizeBytes, path: actualPath };
}

/* Comment GIF uploader: preserve animation and copy Android content:// shares. */
export async function uploadCommunityGifFile({
  path, uri, sizeBytes = 0, onProgress,
}: {
  path: string;
  uri: string;
  sizeBytes?: number;
  onProgress?: (progress: CommunityVideoUploadProgress) => void;
}): Promise<{ sizeBytes: number }> {
  let uploadUri = uri;
  let temporaryUri: string | null = null;
  try {
    if (Platform.OS === 'android' && /^content:\/\//i.test(uri)) {
      const directory = FileSystem.cacheDirectory;
      if (!directory) throw new Error('Could not access the GIF upload cache.');
      temporaryUri = directory + 'buklod-comment-gif-' +
        Date.now() + '-' + Math.random().toString(36).slice(2) + '.gif';
      await FileSystem.copyAsync({ from: uri, to: temporaryUri });
      uploadUri = temporaryUri;
    }

    let resolvedSizeBytes = Math.max(0, Number(sizeBytes ?? 0));
    if (!resolvedSizeBytes) resolvedSizeBytes = await readBinarySizeBytes(uploadUri);
    if (!resolvedSizeBytes) throw new Error('Could not read the GIF file size.');
    if (resolvedSizeBytes > 25 * 1024 * 1024) {
      throw new Error('Maximum GIF size is 25 MB.');
    }

    await uploadCommunityBinaryFile({
      path, uri: uploadUri, contentType: 'image/gif', onProgress,
      sizeBytes: resolvedSizeBytes, failureLabel: 'GIF',
      preferResumable: false,
    });
    return { sizeBytes: resolvedSizeBytes };
  } finally {
    if (temporaryUri) {
      await FileSystem.deleteAsync(temporaryUri, { idempotent: true })
        .catch(() => undefined);
    }
  }
}

async function uploadCommunityBinaryFile({
  path,
  uri,
  webBlob,
  contentType,
  onProgress,
  sizeBytes = 0,
  failureLabel,
  preferResumable = false,
}: {
  path: string;
  uri: string;
  webBlob?: Blob;
  contentType: string;
  onProgress?: (
    progress: CommunityVideoUploadProgress
  ) => void;
  sizeBytes?: number;
  failureLabel: string;
  preferResumable?: boolean;
}): Promise<void> {
  const useResumable =
    preferResumable && shouldUseResumableUpload(sizeBytes);

  if (useResumable) {
    try {
      await uploadCommunityFileResumableTus({
        path,
        uri,
        contentType,
        sizeBytes,
        onProgress,
      });
      return;
    } catch (error: any) {
      const message = String(error?.message ?? error ?? '');
      const sliceUnsupported =
        Platform.OS !== 'web' &&
        /position|length|not supported|invalid option/i.test(message);

      if (!sliceUnsupported) {
        throwClassifiedUploadError({
          failureLabel,
          sizeBytes,
          status: error.status,
          body: error.body || message,
          message,
          aborted: Boolean(error.aborted) || /timeout/i.test(message),
        });
      }
    }
  }

  await uploadCommunitySignedPut({
    path,
    uri,
    webBlob,
    contentType,
    onProgress,
    sizeBytes,
    failureLabel,
  });
}

async function uploadCommunitySignedPut({
  path,
  uri,
  webBlob,
  contentType,
  onProgress,
  sizeBytes = 0,
  failureLabel,
}: {
  path: string;
  uri: string;
  webBlob?: Blob;
  contentType: string;
  onProgress?: (
    progress: CommunityVideoUploadProgress
  ) => void;
  sizeBytes?: number;
  failureLabel: string;
}): Promise<void> {
  const bucket = supabase.storage.from('community-media');
  const { data: signed, error: signedError } =
    await bucket.createSignedUploadUrl(path, { upsert: false });

  if (signedError) {
    throwClassifiedUploadError({
      failureLabel,
      sizeBytes,
      message: String(signedError.message ?? signedError),
    });
  }

  const signedUrl = toDirectStorageUrl(
    String(signed?.signedUrl ?? ''),
  );

  if (!signedUrl) {
    throw new Error(
      `Could not prepare the ${failureLabel.toLowerCase()} upload URL.`,
    );
  }

  let result: {
    status: number;
    body?: string | null;
  } | null | undefined;

  try {
    if (Platform.OS === 'web') {
      const blob = webBlob ?? await readWebBlob(uri);
      const totalBytes = Number(blob.size ?? sizeBytes ?? 0);
      onProgress?.({ sentBytes: 0, totalBytes, ratio: 0 });

      const response = await fetch(signedUrl, {
        method: 'PUT',
        headers: {
          'content-type': contentType,
          'cache-control': '3600',
          'x-upsert': 'false',
        },
        body: blob,
      });

      result = {
        status: response.status,
        body: await response.text().catch(() => ''),
      };

      if (response.ok) {
        onProgress?.({
          sentBytes: totalBytes,
          totalBytes,
          ratio: 1,
        });
      }
    } else {
      const uploadOptions = {
        httpMethod: 'PUT' as const,
        uploadType:
          FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          'content-type': contentType,
          'cache-control': '3600',
          'x-upsert': 'false',
        },
      };

      result = onProgress
        ? await FileSystem.createUploadTask(
            signedUrl,
            uri,
            uploadOptions,
            progress => {
              const sentBytes = Number(
                progress.totalBytesSent ?? 0,
              );
              const totalBytes = Number(
                progress.totalBytesExpectedToSend ?? sizeBytes ?? 0,
              );
              const ratio = totalBytes > 0
                ? Math.min(1, sentBytes / totalBytes)
                : 0;
              onProgress({ sentBytes, totalBytes, ratio });
            },
          ).uploadAsync()
        : await FileSystem.uploadAsync(
            signedUrl,
            uri,
            uploadOptions,
          );
    }
  } catch (error: any) {
    throwClassifiedUploadError({
      failureLabel,
      sizeBytes,
      message: String(error?.message ?? error ?? ''),
      aborted: /timeout|timed out|abort/i.test(
        String(error?.message ?? ''),
      ),
    });
  }

  if (!result) {
    throw new Error(`${failureLabel} upload failed (no response).`);
  }

  if (result.status < 200 || result.status >= 300) {
    const serverBody = String(result.body ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);

    throwClassifiedUploadError({
      failureLabel,
      sizeBytes,
      status: result.status,
      body: serverBody,
      message: serverBody,
    });
  }
}


const communityVideoPosterPersisting = new Set<string>();

/**
 * Persist a poster generated by a visible feed player. This gradually backfills
 * older public/scoped videos without hidden players, background downloads, or
 * changing the original media object. The server RPC enforces post visibility.
 */
export async function persistCommunityVideoPoster(options: {
  postId: string;
  mediaPosition: number;
  mediaPath: string;
  viewerUserId: string;
  thumbnail: unknown;
}): Promise<string | null> {
  const releaseWebInput = () => {
    if (Platform.OS === 'web' && typeof options.thumbnail === 'string') {
      (globalThis as any).URL?.revokeObjectURL?.(options.thumbnail);
    }
  };
  const postId = String(options.postId ?? '').trim();
  const mediaPath = String(options.mediaPath ?? '').trim();
  const viewerUserId = String(options.viewerUserId ?? '').trim();
  const mediaPosition = Number(options.mediaPosition ?? 0);
  if (!postId || !mediaPath || !viewerUserId ||
      !Number.isInteger(mediaPosition) || mediaPosition < 0 || mediaPosition > 10) {
    releaseWebInput();
    return null;
  }
  const lockKey = `${postId}:${mediaPosition}:${mediaPath}`;
  if (communityVideoPosterPersisting.has(lockKey)) {
    releaseWebInput();
    return null;
  }
  communityVideoPosterPersisting.add(lockKey);
  let preview: Awaited<ReturnType<typeof saveCommunityVideoThumbnail>> = null;
  try {
    const previewPath = communityVideoPostPreviewPath(
      viewerUserId, postId, mediaPosition, mediaPath,
    );
    if (!previewPath) return null;
    if (Platform.OS === 'web' && typeof options.thumbnail === 'string') {
      const blob = await readWebBlob(options.thumbnail).catch(() => null);
      if (!blob || blob.size < 1 || blob.size > 125_000) {
        (globalThis as any).URL?.revokeObjectURL?.(options.thumbnail);
        return null;
      }
      const URLApi = (globalThis as any).URL;
      preview = {
        uri: options.thumbnail,
        sizeBytes: blob.size,
        cleanup: async () => URLApi?.revokeObjectURL?.(options.thumbnail),
      };
    } else {
      preview = await saveCommunityVideoThumbnail(options.thumbnail);
    }
    if (!preview) return null;
    // A duplicate upload can mean another device already wrote this stable
    // path. The RPC verifies object existence before accepting the reference.
    await uploadCommunityBinaryFile({
      path: previewPath,
      uri: preview.uri,
      contentType: 'image/jpeg',
      sizeBytes: preview.sizeBytes,
      failureLabel: 'Video preview',
      preferResumable: false,
    }).catch(() => undefined);
    const { data, error } = await (supabase as any).rpc(
      'register_buklod_video_preview_v1',
      {
        p_post_id: postId,
        p_media_position: mediaPosition,
        p_preview_path: previewPath,
        p_preview_bytes: preview.sizeBytes,
      },
    );
    if (error) throw error;
    const savedPath = String(data ?? previewPath).trim();
    return savedPath || previewPath;
  } catch {
    return null;
  } finally {
    await preview?.cleanup().catch(() => undefined);
    communityVideoPosterPersisting.delete(lockKey);
  }
}
