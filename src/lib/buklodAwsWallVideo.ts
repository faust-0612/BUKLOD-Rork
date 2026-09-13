/* BUKLOD_AWS_WALL_VIDEO_R3_NATIVE_BOUNDED_MEMORY
 * Large Wall-video transport only. No native dependency is added.
 * - Web: parallel multipart S3 upload using Blob slices.
 * - Android/iOS: materialize one multipart part at a time with bounded FileHandle reads,
 *   then upload the temp part through the already-installed legacy FileSystem uploader.
 * - AWS credentials never enter the app. The AWS API only returns short-lived signed URLs
 *   after validating the current Supabase access token.
 */
import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const DEFAULT_WALL_VIDEO_API =
  'https://wpb76r52p4.execute-api.ap-southeast-1.amazonaws.com/video';

export const BUKLOD_AWS_WALL_VIDEO_THRESHOLD_BYTES =
  45 * 1024 * 1024;

const FAST_PART_SIZE_BYTES = 16 * 1024 * 1024;
const WEB_MULTIPART_WORKERS = 5;
const PART_UPLOAD_RETRIES = 3;
const NATIVE_COPY_CHUNK_BYTES = 1024 * 1024;

type MultipartPart = {
  partNumber: number;
  etag: string;
};

export type AwsWallVideoProgress = {
  sentBytes: number;
  totalBytes: number;
  ratio: number;
};

type ApiBody = Record<string, unknown>;

type MultipartCreate = {
  uploadId: string;
  key: string;
  partSize: number;
};

type PendingExternalMedia = {
  storage_provider: 'AWS';
  external_object_key: string;
  media_path: string;
};

const pendingByOriginalPath = new Map<
  string,
  PendingExternalMedia
>();

const viewUrlCache = new Map<
  string,
  { url: string; expiresAt: number }
>();

function apiEndpoint() {
  return String(
    process.env.EXPO_PUBLIC_BUKLOD_WALL_VIDEO_API_URL ??
      DEFAULT_WALL_VIDEO_API,
  ).trim();
}

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  const token = String(data?.session?.access_token ?? '').trim();
  if (!token) {
    throw new Error('Please sign in again before uploading this video.');
  }
  return token;
}

async function callVideoApi<T>(body: ApiBody): Promise<T> {
  const token = await accessToken();
  const response = await fetch(apiEndpoint(), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text().catch(() => '');
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    throw new Error(
      String(parsed?.error ?? raw ?? 'AWS video request failed.').trim() ||
        'AWS video request failed.',
    );
  }

  return parsed as T;
}

function extensionFor(contentType: string) {
  const mime = String(contentType ?? '').toLowerCase();
  if (mime.includes('quicktime')) return 'mov';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('x-m4v')) return 'm4v';
  return 'mp4';
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fastPartSize(serverPartSize?: number) {
  return Math.max(
    5 * 1024 * 1024,
    FAST_PART_SIZE_BYTES,
    Number(serverPartSize ?? 0) || 0,
  );
}

function responseHeader(
  headers: Record<string, string> | null | undefined,
  name: string,
) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (key.toLowerCase() === wanted) return String(value ?? '').trim();
  }
  return '';
}

async function createMultipartUpload(options: {
  sizeBytes: number;
  contentType: string;
}) {
  return callVideoApi<MultipartCreate>({
    action: 'create',
    sizeBytes: options.sizeBytes,
    contentType: options.contentType,
    extension: extensionFor(options.contentType),
  });
}

async function signedPartUrl(
  created: MultipartCreate,
  partNumber: number,
) {
  return callVideoApi<{ url: string; partNumber: number }>({
    action: 'part',
    key: created.key,
    uploadId: created.uploadId,
    partNumber,
  });
}

async function completeMultipartUpload(
  created: MultipartCreate,
  parts: MultipartPart[],
) {
  await callVideoApi({
    action: 'complete',
    key: created.key,
    uploadId: created.uploadId,
    parts,
  });
}

async function abortMultipartUpload(created: MultipartCreate) {
  await callVideoApi({
    action: 'abort',
    key: created.key,
    uploadId: created.uploadId,
  }).catch(() => undefined);
}

export function shouldUseAwsWallVideo(sizeBytes: number) {
  return Number(sizeBytes ?? 0) > BUKLOD_AWS_WALL_VIDEO_THRESHOLD_BYTES;
}

export function registerPendingAwsWallVideo(
  originalMediaPath: string,
  externalObjectKey: string,
) {
  const original = String(originalMediaPath ?? '').trim();
  const key = String(externalObjectKey ?? '').trim();
  if (!original || !key) return;

  pendingByOriginalPath.set(original, {
    storage_provider: 'AWS',
    external_object_key: key,
    media_path: `aws:${key}`,
  });
}

export function peekPendingAwsWallVideo(
  originalMediaPath?: string | null,
) {
  return pendingByOriginalPath.get(
    String(originalMediaPath ?? '').trim(),
  ) ?? null;
}

export function clearPendingAwsWallVideo(
  originalMediaPath?: string | null,
) {
  pendingByOriginalPath.delete(
    String(originalMediaPath ?? '').trim(),
  );
}

async function uploadWebMultipart(options: {
  uri: string;
  contentType: string;
  sizeBytes: number;
  onProgress?: (progress: AwsWallVideoProgress) => void;
}) {
  const source = await fetch(options.uri);
  if (!source.ok) {
    throw new Error(`Could not read selected video (${source.status}).`);
  }

  const blob = await source.blob();
  const totalBytes = Number(blob.size || options.sizeBytes || 0);
  const created = await createMultipartUpload({
    sizeBytes: totalBytes,
    contentType: options.contentType,
  });

  const partSize = fastPartSize(created.partSize);
  const partCount = Math.ceil(totalBytes / partSize);
  const parts: MultipartPart[] = new Array(partCount);
  let nextPart = 0;
  let uploadedBytes = 0;

  options.onProgress?.({ sentBytes: 0, totalBytes, ratio: 0 });

  try {
    const workers = Array.from(
      {
        length: Math.min(
          WEB_MULTIPART_WORKERS,
          Math.max(1, partCount),
        ),
      },
      async () => {
        while (true) {
          const index = nextPart++;
          if (index >= partCount) return;

          const partNumber = index + 1;
          const start = index * partSize;
          const end = Math.min(totalBytes, start + partSize);
          let lastError: unknown = null;

          for (let attempt = 1; attempt <= PART_UPLOAD_RETRIES; attempt += 1) {
            try {
              const signed = await signedPartUrl(created, partNumber);
              const put = await fetch(signed.url, {
                method: 'PUT',
                body: blob.slice(start, end),
              });

              if (!put.ok) {
                const message = await put.text().catch(() => '');
                throw new Error(
                  message ||
                    `Video part ${partNumber} upload failed (${put.status}).`,
                );
              }

              const etag = String(put.headers.get('etag') ?? '').trim();
              if (!etag) {
                throw new Error(
                  `Video part ${partNumber} did not return an ETag.`,
                );
              }

              parts[index] = { partNumber, etag };
              uploadedBytes += end - start;
              options.onProgress?.({
                sentBytes: uploadedBytes,
                totalBytes,
                ratio: totalBytes > 0
                  ? Math.min(1, uploadedBytes / totalBytes)
                  : 0,
              });
              lastError = null;
              break;
            } catch (error) {
              lastError = error;
              if (attempt < PART_UPLOAD_RETRIES) {
                await sleep(350 * 2 ** (attempt - 1));
              }
            }
          }

          if (lastError) throw lastError;
        }
      },
    );

    await Promise.all(workers);
    await completeMultipartUpload(created, parts);

    options.onProgress?.({
      sentBytes: totalBytes,
      totalBytes,
      ratio: 1,
    });

    return created.key;
  } catch (error) {
    await abortMultipartUpload(created);
    throw error;
  }
}

function createNativePartFileName(partNumber: number) {
  return `buklod-igpat-${Date.now()}-${partNumber}-${Math.random()
    .toString(36)
    .slice(2)}.part`;
}

function materializeNativePart(options: {
  source: File;
  start: number;
  end: number;
  partNumber: number;
}) {
  const temp = new File(
    Paths.cache,
    createNativePartFileName(options.partNumber),
  );
  temp.create({ overwrite: true });

  const sourceHandle = options.source.open();
  const targetHandle = temp.open();

  try {
    sourceHandle.offset = options.start;
    let remaining = Math.max(0, options.end - options.start);

    while (remaining > 0) {
      const requested = Math.min(
        NATIVE_COPY_CHUNK_BYTES,
        remaining,
      );
      const bytes = sourceHandle.readBytes(requested);
      if (!bytes.byteLength) {
        throw new Error(
          `Could not read video part ${options.partNumber}.`,
        );
      }
      targetHandle.writeBytes(bytes);
      remaining -= bytes.byteLength;
    }
  } finally {
    try {
      sourceHandle.close();
    } catch {}
    try {
      targetHandle.close();
    } catch {}
  }

  return temp;
}

async function uploadNativeTempPart(options: {
  signedUrl: string;
  file: File;
}) {
  return LegacyFileSystem.uploadAsync(
    options.signedUrl,
    options.file.uri,
    {
      httpMethod: 'PUT',
      uploadType:
        LegacyFileSystem.FileSystemUploadType.BINARY_CONTENT,
    },
  );
}

async function uploadNativeMultipart(options: {
  uri: string;
  contentType: string;
  sizeBytes: number;
  onProgress?: (progress: AwsWallVideoProgress) => void;
}) {
  const source = new File(options.uri);
  const totalBytes = Number(source.size || options.sizeBytes || 0);

  if (!totalBytes) {
    throw new Error('Could not read the selected video size.');
  }

  if (typeof (source as any).open !== 'function') {
    throw new Error(
      'This installed app version cannot safely stream large IGPAT videos. Please update BUKLOD before publishing this video.',
    );
  }

  const created = await createMultipartUpload({
    sizeBytes: totalBytes,
    contentType: options.contentType,
  });

  const partSize = fastPartSize(created.partSize);
  const partCount = Math.ceil(totalBytes / partSize);
  const parts: MultipartPart[] = new Array(partCount);
  let uploadedBytes = 0;

  options.onProgress?.({ sentBytes: 0, totalBytes, ratio: 0 });

  try {
    // Native deliberately uploads one part at a time. The previous parallel
    // File.slice + expo/fetch path could cause Android to call bytesSync() on
    // the entire source video and exhaust the Java heap. One bounded temp part
    // keeps memory predictable while preserving the same S3 multipart contract.
    for (let index = 0; index < partCount; index += 1) {
      const partNumber = index + 1;
      const start = index * partSize;
      const end = Math.min(totalBytes, start + partSize);
      const partBytes = end - start;
      const temp = materializeNativePart({
        source,
        start,
        end,
        partNumber,
      });

      let lastError: unknown = null;

      try {
        for (let attempt = 1; attempt <= PART_UPLOAD_RETRIES; attempt += 1) {
          try {
            const signed = await signedPartUrl(created, partNumber);
            const put = await uploadNativeTempPart({
              signedUrl: signed.url,
              file: temp,
            });

            if (put.status < 200 || put.status >= 300) {
              throw new Error(
                put.body ||
                  `Video part ${partNumber} upload failed (${put.status}).`,
              );
            }

            const etag = responseHeader(put.headers, 'etag');
            if (!etag) {
              throw new Error(
                `Video part ${partNumber} did not return an ETag.`,
              );
            }

            parts[index] = { partNumber, etag };
            uploadedBytes += partBytes;
            options.onProgress?.({
              sentBytes: uploadedBytes,
              totalBytes,
              ratio: totalBytes > 0
                ? Math.min(1, uploadedBytes / totalBytes)
                : 0,
            });
            lastError = null;
            break;
          } catch (error) {
            lastError = error;
            if (attempt < PART_UPLOAD_RETRIES) {
              await sleep(350 * 2 ** (attempt - 1));
            }
          }
        }
      } finally {
        try {
          if (temp.exists) temp.delete();
        } catch {}
      }

      if (lastError) throw lastError;
    }

    await completeMultipartUpload(created, parts);

    options.onProgress?.({
      sentBytes: totalBytes,
      totalBytes,
      ratio: 1,
    });

    return created.key;
  } catch (error) {
    await abortMultipartUpload(created);
    throw error;
  }
}

export async function uploadAwsWallVideo(options: {
  uri: string;
  contentType: string;
  sizeBytes: number;
  onProgress?: (progress: AwsWallVideoProgress) => void;
}) {
  if (Platform.OS === 'web') {
    return uploadWebMultipart(options);
  }
  return uploadNativeMultipart(options);
}

export async function deleteAwsWallVideo(objectKey: string) {
  const key = String(objectKey ?? '').trim();
  if (!key) return;
  await callVideoApi({ action: 'delete', key });
}

export async function getAwsWallVideoViewUrl(
  postId: string,
  objectKey: string,
) {
  const post = String(postId ?? '').trim();
  const key = String(objectKey ?? '').trim();
  if (!post || !key) return null;

  const cacheKey = `${post}:${key}`;
  const hit = viewUrlCache.get(cacheKey);
  if (hit && hit.expiresAt > Date.now() + 30_000) {
    return hit.url;
  }

  const result = await callVideoApi<{
    url: string;
    expiresIn?: number;
  }>({
    action: 'view',
    postId: post,
    key,
  });

  const url = String(result?.url ?? '').trim();
  if (!url) return null;

  const lifetime = Math.max(
    60,
    Number(result.expiresIn ?? 900) || 900,
  );
  viewUrlCache.set(cacheKey, {
    url,
    expiresAt: Date.now() + Math.min(lifetime - 30, 720) * 1000,
  });
  return url;
}
