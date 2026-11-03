/** Shared, bounded media framing rules for feed cards. */
export type CommunityPhotoFit = 'cover' | 'contain';

export function communitySinglePhotoFrame(width: number, aspectRatio: number, maxHeight = 640, minHeight = 220): { height: number; contentFit: CommunityPhotoFit } {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  const naturalHeight = safeWidth / safeRatio;
  const height = Math.min(maxHeight, Math.max(minHeight, Math.round(naturalHeight)));
  const contentFit = naturalHeight > maxHeight || naturalHeight < minHeight ? 'contain' : 'cover';
  return { height, contentFit };
}

export function communityVideoFrameHeight(width: number, aspectRatio: number, fallbackHeight = 380, maxHeight = 620, minHeight = 220): number {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return fallbackHeight;
  return Math.min(maxHeight, Math.max(minHeight, Math.round(width / aspectRatio)));
}
