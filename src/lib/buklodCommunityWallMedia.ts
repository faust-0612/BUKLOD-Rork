/* PATCH_COMMUNITY_VIDEO_5G_R2C */
/**
 * Wall vs Reel video rules — shared by Public and scoped Community composers.
 */

/** 5 GiB product maximum for community video uploads (1024-based). */
export const BUKLOD_VIDEO_MAX_SIZE_BYTES =
  5 * 1024 * 1024 * 1024;

export const BUKLOD_VIDEO_MAX_SIZE_LABEL = '5 GB';

/** @deprecated Prefer communityVideoTooLargeMessage(sizeBytes). */
export const BUKLOD_VIDEO_TOO_LARGE_MESSAGE =
  `Maximum video size is ${BUKLOD_VIDEO_MAX_SIZE_LABEL}.`;

/** Reels remain short-form (product rule unchanged). */
export const BUKLOD_REEL_MAX_DURATION_SECONDS = 60;

/** Wall / general community video duration ceiling. */
export const BUKLOD_WALL_VIDEO_MAX_DURATION_SECONDS = 1800;

export const BUKLOD_WALL_VIDEO_TOO_LONG_MESSAGE =
  'Videos can be up to 30 minutes long.';

export const BUKLOD_REEL_TOO_LONG_MESSAGE =
  'Reels may be up to 60 seconds only.';

export type CommunityUploadFailureReason =
  | 'app_validation_limit'
  | 'storage_bucket_limit'
  | 'platform_api_limit'
  | 'network'
  | 'timeout'
  | 'unknown';

export function formatVideoBytes(bytes: number): string {
  const value = Math.max(0, Number(bytes) || 0);

  if (value < 1024) {
    return `${Math.round(value)} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Client-side reject when the measured file is actually over the product max. */
export function communityVideoTooLargeMessage(
  sizeBytes?: number
): string {
  const actual = Number(sizeBytes ?? 0);

  if (actual > 0) {
    return `This video is ${formatVideoBytes(actual)}. Maximum size is ${BUKLOD_VIDEO_MAX_SIZE_LABEL}.`;
  }

  return `Maximum video size is ${BUKLOD_VIDEO_MAX_SIZE_LABEL}.`;
}

export function classifyCommunityUploadFailure(input: {
  status?: number | null;
  body?: string | null;
  message?: string | null;
  aborted?: boolean;
}): CommunityUploadFailureReason {
  const status = Number(input.status ?? 0);
  const text = `${input.body ?? ''} ${input.message ?? ''}`
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (input.aborted || status === 408 || status === 504) {
    return 'timeout';
  }

  if (
    /timed? out|timeout|aborted|deadline exceeded/.test(text)
  ) {
    return 'timeout';
  }

  if (
    /network request failed|failed to fetch|network error|connection (reset|refused|closed)|internet connection|offline|socket/.test(
      text
    )
  ) {
    return 'network';
  }

  if (
    /object exceeded the maximum|exceeded the maximum allowed size|file_size_limit|bucket.*file size/.test(
      text
    )
  ) {
    return 'storage_bucket_limit';
  }

  if (
    status === 413 ||
    /payload too large|entity too large|request entity too large|content too large/.test(
      text
    )
  ) {
    return 'platform_api_limit';
  }

  if (
    /maximum size|too large to upload|file too large/.test(text)
  ) {
    return 'storage_bucket_limit';
  }

  return 'unknown';
}

export function communityUploadFailureMessage(
  reason: CommunityUploadFailureReason,
  options?: {
    sizeBytes?: number;
    failureLabel?: string;
    serverBody?: string;
  }
): string {
  const label = options?.failureLabel || 'Video';
  const actual = Number(options?.sizeBytes ?? 0);
  const sizePart =
    actual > 0 ? ` Your ${label.toLowerCase()} is ${formatVideoBytes(actual)}.` : '';
  const serverPart = String(options?.serverBody ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  switch (reason) {
    case 'app_validation_limit':
      return communityVideoTooLargeMessage(actual);
    case 'storage_bucket_limit':
      return (
        `${label} upload was rejected by the storage bucket size limit.` +
        sizePart +
        ' The file is within the 5 GB app limit, but storage is still enforcing a lower ceiling.'
      );
    case 'platform_api_limit':
      return (
        `${label} upload was rejected by the upload API size limit.` +
        sizePart +
        ' The file is within the 5 GB app limit, but the current hosting plan or gateway cap is lower.'
      );
    case 'network':
      return (
        `${label} upload was interrupted by the network.` +
        sizePart +
        ' Check your connection and try again.'
      );
    case 'timeout':
      return (
        `${label} upload timed out.` +
        sizePart +
        ' Try again on a more stable connection.'
      );
    default:
      return serverPart
        ? `${label} upload failed: ${serverPart}`
        : `${label} upload failed. Please try again.`;
  }
}

/**
 * Server/storage rejected the upload. Do not claim the file itself is over 5 GB
 * when the measured size is smaller than the product maximum.
 */
export function communityVideoUploadRejectedMessage(
  sizeBytes?: number
): string {
  return communityUploadFailureMessage('storage_bucket_limit', {
    sizeBytes,
    failureLabel: 'Video',
  });
}

export function isReelMediaPath(path: string | null | undefined) {
  const value = String(path ?? '').toLowerCase();
  return value.includes('/reel-') || value.includes('reel-');
}

export function readVideoDurationSeconds(asset: {
  duration?: number | null;
}) {
  const raw = Number(asset?.duration ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }

  /*
   * Expo ImagePicker documents milliseconds. Some Android galleries
   * already report seconds. Values above the 30-minute wall cap are ms.
   */
  if (raw > BUKLOD_WALL_VIDEO_MAX_DURATION_SECONDS) {
    return Math.max(1, Math.ceil(raw / 1000));
  }

  return Math.max(1, Math.ceil(raw));
}

/**
 * Best-effort file size for validation/metadata.
 * Prefer FileSystem size — ImagePicker fileSize is often missing or wrong
 * on Android content:// URIs.
 */
export async function readVideoSizeBytes(
  asset: {
    uri?: string | null;
    fileSize?: number | null;
  },
  getInfoAsync?: (
    uri: string,
    options?: { size?: boolean }
  ) => Promise<{ exists?: boolean; size?: number }>
): Promise<number> {
  const pickerSize = Number(asset?.fileSize ?? 0);
  const uri = String(asset?.uri ?? '').trim();

  let fileSystemSize = 0;

  if (uri && getInfoAsync) {
    try {
      const info = await getInfoAsync(uri, { size: true });

      if (info.exists && Number(info.size ?? 0) > 0) {
        fileSystemSize = Number(info.size);
      }
    } catch {
      // metadata optional
    }
  }

  if (fileSystemSize > 0) {
    return fileSystemSize;
  }

  if (pickerSize > 0) {
    return pickerSize;
  }

  return 0;
}

export function validateCommunityVideoUpload(params: {
  durationSeconds: number;
  sizeBytes?: number;
  isReel?: boolean;
}): string | null {
  const isReel = Boolean(params.isReel);
  const duration = Number(params.durationSeconds ?? 0);
  const sizeBytes = Number(params.sizeBytes ?? 0);

  if (isReel) {
    if (duration > BUKLOD_REEL_MAX_DURATION_SECONDS) {
      return BUKLOD_REEL_TOO_LONG_MESSAGE;
    }
  } else if (duration > BUKLOD_WALL_VIDEO_MAX_DURATION_SECONDS) {
    return BUKLOD_WALL_VIDEO_TOO_LONG_MESSAGE;
  }

  if (
    sizeBytes > 0 &&
    sizeBytes > BUKLOD_VIDEO_MAX_SIZE_BYTES
  ) {
    return communityVideoTooLargeMessage(sizeBytes);
  }

  return null;
}
