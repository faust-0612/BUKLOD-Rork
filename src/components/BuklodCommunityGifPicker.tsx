import { useEffect } from 'react';

/**
 * COMMUNITY GIF RETIRED (2026-09-04)
 *
 * Community Wall now supports text + photos + video only.
 * This compatibility stub intentionally renders nothing so an older Community
 * composer bundle cannot reopen the retired/broken hard-coded GIF picker.
 *
 * Connect GIF behavior is separate and continues to use
 * src/lib/buklodConnectGifCatalog.ts directly.
 */
export type BuklodCommunityGifFile = {
  uri: string;
  name: string;
  mimeType: 'image/gif';
  size: number;
};

export function BuklodCommunityGifPreview(_props: {
  file: BuklodCommunityGifFile;
  onRemove: () => void;
}) {
  return null;
}

export function BuklodCommunityGifPicker({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (file: BuklodCommunityGifFile) => void;
}) {
  useEffect(() => {
    if (visible) {
      onClose();
    }
  }, [visible, onClose]);

  return null;
}

export default BuklodCommunityGifPicker;
