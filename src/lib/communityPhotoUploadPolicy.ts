/**
 * Free, device-side Community Wall photo preparation policy.
 * Reduce bytes before upload; avoid upscaling already small photos.
 */
export const COMMUNITY_PHOTO_MAX_EDGE_PX = 1600;
export const COMMUNITY_PHOTO_PASSTHROUGH_BYTES = 1200 * 1024;
export const COMMUNITY_PHOTO_JPEG_QUALITY = 0.78;

export type CommunityPhotoDimensions = {
  width: number;
  height: number;
};

export function planCommunityPhotoUpload(input: {
  width?: number | null;
  height?: number | null;
  sizeBytes?: number | null;
  isJpeg: boolean;
}) {
  const width = Math.max(0, Number(input.width) || 0);
  const height = Math.max(0, Number(input.height) || 0);
  const sizeBytes = Math.max(0, Number(input.sizeBytes) || 0);
  const hasDimensions = width > 0 && height > 0;
  const needsResize = hasDimensions &&
    Math.max(width, height) > COMMUNITY_PHOTO_MAX_EDGE_PX;

  const resize: { width: number | null; height: number | null } | null =
    !needsResize ? null :
    width >= height
      ? { width: COMMUNITY_PHOTO_MAX_EDGE_PX, height: null }
      : { width: null, height: COMMUNITY_PHOTO_MAX_EDGE_PX };

  const passthrough =
    input.isJpeg &&
    sizeBytes > 0 &&
    sizeBytes <= COMMUNITY_PHOTO_PASSTHROUGH_BYTES &&
    !needsResize;

  return {
    passthrough,
    resize,
    compress: COMMUNITY_PHOTO_JPEG_QUALITY,
  };
}
