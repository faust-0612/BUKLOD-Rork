/* BUKLOD_COMMUNITY_WEB_UPLOAD_R2 */
/* BUKLOD_AWS_WALL_VIDEO_ROUTE_R1 */
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ReactNativeImage, Platform } from 'react-native';
import { classifyNetworkQuality } from '@/lib/buklodNetworkQuality';
import { planCommunityPhotoUpload } from '@/lib/communityPhotoUploadPolicy';

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
  shouldUseResumableUpload,
  toDirectStorageUrl,
  uploadCommunityFileResumableTus,
} from '@/lib/uploadCommunityResumableTus';
import {
  registerPendingAwsWallVideo,
  shouldUseAwsWallVideo,
  uploadAwsWallVideo,
} from '@/lib/buklodAwsWallVideo';

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
 * Wall videos above 45 MiB are stored in private AWS S3 so the Supabase Free
 * 50 MB global object ceiling is never hit. This is pure JS/TS and keeps the
 * existing installed native runtime/APK.
 *
 * Smaller videos stay on Supabase to avoid unnecessary cross-provider traffic.
 */
export async function uploadCommunityVideoFile({
  path,
  uri,
  contentType,
  onProgress,
}: {
  path: string;
  uri: string;
  contentType: string;
  onProgress?: (
    progress: CommunityVideoUploadProgress
  ) => void;
}): Promise<void> {
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

  if (sizeBytes > 0 && sizeBytes > BUKLOD_VIDEO_MAX_SIZE_BYTES) {
    throw new Error(communityVideoTooLargeMessage(sizeBytes));
  }

  if (sizeBytes > 0 && shouldUseAwsWallVideo(sizeBytes)) {
    const objectKey = await uploadAwsWallVideo({
      uri,
      contentType,
      sizeBytes,
      onProgress,
    });
    registerPendingAwsWallVideo(path, objectKey);
    return;
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

function readLocalImageDimensions(
  uri: string,
): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    let settled = false;
    const finish = (value: { width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    // Bad content URIs must not strand the entire upload indefinitely.
    const timer = setTimeout(() => finish(null), 3000);
    try {
      ReactNativeImage.getSize(
        uri,
        (width, height) => finish({ width, height }),
        () => finish(null),
      );
    } catch {
      finish(null);
    }
  });
}

export async function prepareCommunityJpegUri(
  uri: string,
): Promise<{ uri: string; sizeBytes: number }> {
  const existingBytes = await readBinarySizeBytes(uri).catch(() => 0);
  const dimensions = await readLocalImageDimensions(uri);
  const plan = planCommunityPhotoUpload({
    width: dimensions?.width,
    height: dimensions?.height,
    sizeBytes: existingBytes,
    isJpeg: /\.jpe?g(?:[?#]|$)/i.test(uri),
  });
  if (plan.passthrough) {
    return { uri, sizeBytes: existingBytes };
  }

  const M = await import('expo-image-manipulator');
  const context = M.ImageManipulator.manipulate(uri);
  if (plan.resize) context.resize(plan.resize);
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({
    format: M.SaveFormat.JPEG,
    compress: plan.compress,
  });
  const fileUri = String(image.uri ?? uri).trim() || uri;
  const sizeBytes = await readBinarySizeBytes(fileUri);

  if (!sizeBytes) {
    throw new Error('Could not read the prepared photo size.');
  }

  // A simple re-encode should never make an existing JPEG more expensive
  // to download. Resized photos retain their smaller display dimensions.
  if (!plan.resize && existingBytes > 0 && sizeBytes >= existingBytes &&
      /\.jpe?g(?:[?#]|$)/i.test(uri)) {
    return { uri, sizeBytes: existingBytes };
  }

  return { uri: fileUri, sizeBytes };
}

export async function uploadCommunityPhotoFile({
  path,
  uri,
  onProgress,
}: {
  path: string;
  uri: string;
  onProgress?: (
    progress: CommunityVideoUploadProgress
  ) => void;
}): Promise<{ sizeBytes: number }> {
  const prepared = await prepareCommunityJpegUri(uri);

  await uploadCommunityBinaryFile({
    path,
    uri: prepared.uri,
    contentType: 'image/jpeg',
    onProgress,
    sizeBytes: prepared.sizeBytes,
    failureLabel: 'Photo',
    preferResumable: false,
  });

  return { sizeBytes: prepared.sizeBytes };
}

/* Legacy compatibility only. Community Wall no longer exposes GIF upload. */
export async function uploadCommunityGifFile({
  path,
  uri,
  sizeBytes = 0,
  onProgress,
}: {
  path: string;
  uri: string;
  sizeBytes?: number;
  onProgress?: (
    progress: CommunityVideoUploadProgress
  ) => void;
}): Promise<{ sizeBytes: number }> {
  let resolvedSizeBytes = Math.max(0, Number(sizeBytes ?? 0));
  if (!resolvedSizeBytes) {
    resolvedSizeBytes = await readBinarySizeBytes(uri);
  }
  if (!resolvedSizeBytes) {
    throw new Error('Could not read the GIF file size.');
  }
  if (resolvedSizeBytes > 25 * 1024 * 1024) {
    throw new Error('Maximum GIF size is 25 MB.');
  }

  await uploadCommunityBinaryFile({
    path,
    uri,
    contentType: 'image/gif',
    onProgress,
    sizeBytes: resolvedSizeBytes,
    failureLabel: 'GIF',
    preferResumable: false,
  });

  return { sizeBytes: resolvedSizeBytes };
}

async function uploadCommunityBinaryFile({
  path,
  uri,
  contentType,
  onProgress,
  sizeBytes = 0,
  failureLabel,
  preferResumable = false,
}: {
  path: string;
  uri: string;
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
    contentType,
    onProgress,
    sizeBytes,
    failureLabel,
  });
}

async function uploadCommunitySignedPut({
  path,
  uri,
  contentType,
  onProgress,
  sizeBytes = 0,
  failureLabel,
}: {
  path: string;
  uri: string;
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
      const blob = await readWebBlob(uri);
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
