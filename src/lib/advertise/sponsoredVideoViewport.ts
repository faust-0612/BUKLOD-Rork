/**
 * Sponsored player activation: prewarm shortly before exposure, play as soon
 * as the card is visibly entering view, unload again when far away.
 * All decisions are geometry-only (no network, no user identity, no quality
 * reduction), and treat invalid/out-of-window measurements as not visible.
 */
export const SPONSORED_VIDEO_CHECK_MS = 120;
export type SponsorRect = {x:number;y:number;width:number;height:number};
export type SponsorScreen = {width:number;height:number};
export function sponsoredVideoViewport(rect:SponsorRect,screen:SponsorScreen) {
  const {x,y,width,height} = rect;
  const {width:screenWidth,height:screenHeight} = screen;
  if (![x,y,width,height,screenWidth,screenHeight].every(Number.isFinite)
      || width <= 40 || height <= 40 || screenWidth <= 0 || screenHeight <= 0) {
    return {visible:false,near:false};
  }
  const horizontal = x < screenWidth && x+width > 0;
  const overlap = Math.max(0,Math.min(y+height,screenHeight)-Math.max(y,0));
  const visible = horizontal && overlap >= Math.min(height*0.18,72);
  // Bound passive preloading to 0.6 viewport above/below the screen.
  const near = horizontal && y < screenHeight*1.6 && y+height > -screenHeight*0.6;
  return {visible,near};
}
