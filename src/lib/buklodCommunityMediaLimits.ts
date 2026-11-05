/* BUKLOD_COMMUNITY_MEDIA_CANONICAL_R3 */
/** Community Wall canonical composer contract. */
export const COMMUNITY_MAX_PHOTOS = 10;
/** High-quality Community photos; upload uses TUS above the 6 MiB threshold. */
export const COMMUNITY_PHOTO_MAX_SIZE_BYTES = 25 * 1024 * 1024;
/** One video plus up to 10 photos on the same post. */
export const COMMUNITY_MAX_WALL_MEDIA = COMMUNITY_MAX_PHOTOS + 1;

/**
 * Community Wall GIF posting is intentionally retired.
 * Historical GIF posts may still render, and Connect may keep its own GIF tools,
 * but Public/Scoped Community composers must not expose or upload new GIFs.
 */
export const COMMUNITY_WALL_GIF_ENABLED = false as const;

export const COMMUNITY_WALL_VIDEO_MAX_BYTES = 1_073_741_824;
export const COMMUNITY_WALL_VIDEO_MAX_SECONDS = 30 * 60;

export const COMMUNITY_MEDIA_POSITION_MIN = 0;
export const COMMUNITY_MEDIA_POSITION_MAX = COMMUNITY_MAX_WALL_MEDIA - 1;

export function communityPhotoLimitMessage(
  maxPhotos = COMMUNITY_MAX_PHOTOS
) {
  return `You can add up to ${maxPhotos} photos per post.`;
}
