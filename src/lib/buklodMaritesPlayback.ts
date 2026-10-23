/** ImagePicker duration is milliseconds, including sub-second clips. */
export function quickVideoDurationSeconds(milliseconds: number): number {
  return milliseconds / 1000;
}

/** Select at most one substantially visible video; never play a clipped/offscreen card. */
export function selectVisibleMaritesVideo(input: {
  x: number; y: number; width: number; height: number;
  windowWidth: number; windowHeight: number;
  topInset: number; bottomInset: number;
  offset: number; cardWidth: number; gap: number; videos: boolean[];
}): number {
  const { x, y, width, height, windowWidth, windowHeight, topInset, bottomInset,
    offset, cardWidth, gap, videos } = input;
  if (![x, y, width, height, windowWidth, windowHeight, offset].every(Number.isFinite)
    || width <= 0 || height <= 0 || cardWidth <= 0) return -1;
  const visibleHeight = Math.max(0, Math.min(y + height, windowHeight - bottomInset) - Math.max(y, topInset));
  if (visibleHeight < height / 2) return -1;
  const left = Math.max(0, x);
  const right = Math.min(windowWidth, x + width);
  let best = -1;
  let bestWidth = cardWidth / 2;
  videos.forEach((video, index) => {
    if (!video) return;
    const start = x + index * (cardWidth + gap) - offset;
    const visibleWidth = Math.max(0, Math.min(start + cardWidth, right) - Math.max(start, left));
    if (visibleWidth >= bestWidth && (best < 0 || visibleWidth > bestWidth)) {
      best = index;
      bestWidth = visibleWidth;
    }
  });
  return best;
}
