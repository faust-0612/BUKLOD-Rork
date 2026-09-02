/*
 * PATCH_191G_R5_COMPATIBILITY_SAFE_VIDEO_FINALIZER
 * Current helper contract preserved intentionally:
 * video + photo upload, bounded concurrency, progress callbacks,
 * signed native binary transfer, and existing caller compatibility.
 */import * as FileSystem
  from 'expo-file-system/legacy';

import {
  BUKLOD_VIDEO_MAX_SIZE_BYTES,
  classifyCommunityUploadFailure,
  communityUploadFailureMessage,
  communityVideoTooLargeMessage,
  readVideoSizeBytes,
  type CommunityUploadFailureReason,
} from '@/lib/buklodCommunityWallMedia';
import {
  supabase,
} from '@/lib/supabase';
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
    })
  );
}

/*
 * Memory-safe community video upload:
 * 1) TUS resumable chunks (6 MiB) for large files — no full-file JS copy
 * 2) signed URL + Expo FileSystem binary PUT for smaller files
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
  const sizeBytes = await readVideoSizeBytes(
    { uri },
    async (fileUri) => {
      const info: any =
        await FileSystem.getInfoAsync(
          fileUri,
          { size: true } as any,
        );

      return {
        exists: Boolean(info?.exists),
        size: Number(info?.size ?? 0),
      };
    },
  );

  if (
    sizeBytes > 0 &&
    sizeBytes > BUKLOD_VIDEO_MAX_SIZE_BYTES
  ) {
    throw new Error(
      communityVideoTooLargeMessage(sizeBytes),
    );
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
  if (!items.length) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(
    Math.max(1, concurrency),
    items.length,
  );

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= items.length) {
        return;
      }

      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: workerCount }, () => worker()),
  );

  return results;
}

export async function prepareCommunityJpegUri(
  uri: string,
): Promise<{ uri: string; sizeBytes: number }> {
  const M = await import('expo-image-manipulator');
  const context = M.ImageManipulator.manipulate(uri);
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({
    format: M.SaveFormat.JPEG,
    compress: 0.86,
  });
  const fileUri = String(image.uri ?? uri).trim() || uri;
  const info: any = await FileSystem.getInfoAsync(
    fileUri,
    { size: true } as any,
  );

  return {
    uri: fileUri,
    sizeBytes: Number(info?.size ?? 0),
  };
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

  return {
    sizeBytes: prepared.sizeBytes,
  };
}

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
  let resolvedSizeBytes = Math.max(
    0,
    Number(sizeBytes ?? 0),
  );

  if (!resolvedSizeBytes) {
    const info: any = await FileSystem.getInfoAsync(
      uri,
      { size: true } as any,
    );
    resolvedSizeBytes = Number(info?.size ?? 0);
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

  return {
    sizeBytes: resolvedSizeBytes,
  };
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
    preferResumable &&
    shouldUseResumableUpload(sizeBytes);

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

      // Slice reads are unavailable (some content:// URIs). Fall through
      // to a native streamed PUT instead of loading the file into JS.
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
  const bucket =
    supabase.storage.from(
      'community-media',
    );

  const {
    data: signed,
    error: signedError,
  } =
    await bucket.createSignedUploadUrl(
      path,
      {
        upsert: false,
      },
    );

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

  const uploadOptions = {
    httpMethod: 'PUT' as const,
    uploadType:
      FileSystem.FileSystemUploadType
        .BINARY_CONTENT,
    headers: {
      'content-type': contentType,
      'cache-control': '3600',
      'x-upsert': 'false',
    },
  };

  let result: {
    status: number;
    body?: string | null;
  } | null | undefined;

  try {
    result = onProgress
      ? await (async () => {
          const task =
            FileSystem.createUploadTask(
              signedUrl,
              uri,
              uploadOptions,
              (progress) => {
                const sentBytes = Number(
                  progress.totalBytesSent ?? 0,
                );
                const totalBytes = Number(
                  progress.totalBytesExpectedToSend ??
                    sizeBytes ??
                    0,
                );
                const ratio =
                  totalBytes > 0
                    ? Math.min(
                        1,
                        sentBytes / totalBytes,
                      )
                    : 0;

                onProgress({
                  sentBytes,
                  totalBytes,
                  ratio,
                });
              },
            );

          return task.uploadAsync();
        })()
      : await FileSystem.uploadAsync(
          signedUrl,
          uri,
          uploadOptions,
        );
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
    throw new Error(
      `${failureLabel} upload failed (no response).`,
    );
  }

  if (
    result.status < 200 ||
    result.status >= 300
  ) {
    const serverBody = String(
      result.body ?? '',
    )
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
