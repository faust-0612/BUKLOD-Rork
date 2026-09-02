export const COMMUNITY_MAX_PHOTOS = 10;

export const COMMUNITY_MEDIA_POSITION_MIN = 0;

export const COMMUNITY_MEDIA_POSITION_MAX = COMMUNITY_MAX_PHOTOS - 1;

export function communityPhotoLimitMessage(
  maxPhotos = COMMUNITY_MAX_PHOTOS
) {
  return `You can add up to ${maxPhotos} photos per post.`;
}
