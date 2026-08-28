import * as FileSystem
  from 'expo-file-system/legacy';

import {
  BUKLOD_VIDEO_MAX_SIZE_BYTES,
  communityVideoTooLargeMessage,
  communityVideoUploadRejectedMessage,
  readVideoSizeBytes,
} from '@/lib/buklodCommunityWallMedia';
import {
  supabase,
} from '@/lib/supabase';

export type CommunityVideoUploadProgress = {
  sentBytes: number;
  totalBytes: number;
  ratio: number;
};

/*
 * Memory-safe community video upload:
 * signed URL + Expo FileSystem binary PUT (no base64 / ArrayBuffer copy).
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
    tooLargeMessage:
      communityVideoUploadRejectedMessage(sizeBytes),
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
  });

  return {
    sizeBytes: prepared.sizeBytes,
  };
}

async function uploadCommunityBinaryFile({
  path,
  uri,
  contentType,
  onProgress,
  sizeBytes = 0,
  failureLabel,
  tooLargeMessage,
}: {
  path: string;
  uri: string;
  contentType: string;
  onProgress?: (
    progress: CommunityVideoUploadProgress
  ) => void;
  sizeBytes?: number;
  failureLabel: string;
  tooLargeMessage?: string;
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
    throw signedError;
  }

  const signedUrl = String(
    signed?.signedUrl ?? '',
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

  const result = onProgress
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

    const normalized = serverBody.toLowerCase();

    if (
      normalized.includes(
        'maximum size',
      ) ||
      normalized.includes(
        'exceeded the maximum',
      ) ||
      normalized.includes(
        'payload too large',
      ) ||
      normalized.includes(
        'entity too large',
      )
    ) {
      throw new Error(
        tooLargeMessage ||
          `${failureLabel} is too large to upload.`,
      );
    }

    throw new Error(
      serverBody
        ? `${failureLabel} upload failed (${result.status}): ${serverBody}`
        : `${failureLabel} upload failed (${result.status}).`,
    );
  }
}
