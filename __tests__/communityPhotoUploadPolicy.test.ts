import {
  COMMUNITY_PHOTO_MAX_EDGE_PX,
  planCommunityPhotoUpload,
} from '@/lib/communityPhotoUploadPolicy';

describe('Community Wall photo bandwidth policy', () => {
  it('preserves an already-small JPEG without recompressing', () => {
    expect(planCommunityPhotoUpload({
      width: 1000, height: 750, sizeBytes: 400_000, isJpeg: true,
    })).toMatchObject({ passthrough: true, resize: null });
  });

  it('resizes landscape and portrait photos without upscaling', () => {
    expect(planCommunityPhotoUpload({
      width: 4032, height: 3024, sizeBytes: 1_000_000, isJpeg: true,
    })).toMatchObject({
      passthrough: false, resize: { width: COMMUNITY_PHOTO_MAX_EDGE_PX, height: null },
    });
    expect(planCommunityPhotoUpload({
      width: 1200, height: 2400, sizeBytes: 700_000, isJpeg: true,
    })).toMatchObject({
      passthrough: false, resize: { width: null, height: COMMUNITY_PHOTO_MAX_EDGE_PX },
    });
  });

  it('re-encodes large JPEGs and non-JPEG images only when needed', () => {
    expect(planCommunityPhotoUpload({
      width: 1280, height: 720, sizeBytes: 4_000_000, isJpeg: true,
    })).toMatchObject({ passthrough: false, resize: null });
    expect(planCommunityPhotoUpload({
      width: 600, height: 600, sizeBytes: 100_000, isJpeg: false,
    })).toMatchObject({ passthrough: false, resize: null });
  });

  it('does not upscale or crash on missing image dimensions', () => {
    expect(planCommunityPhotoUpload({
      width: null, height: null, sizeBytes: 2_000_000, isJpeg: true,
    })).toMatchObject({ passthrough: false, resize: null });
  });
});
