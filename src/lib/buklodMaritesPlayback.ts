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
  if (visibleHeight < Math.min(height * 0.08,24)) return -1;
  const left = Math.max(0, x);
  const right = Math.min(windowWidth, x + width);
  let best = -1;
  let bestWidth = Math.min(cardWidth * 0.08,20);
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

/** Prebuffer one video as the horizontal story strip nears the viewport. */
export function selectNearbyMaritesVideo(input:{
 x:number;y:number;width:number;height:number;windowWidth:number;windowHeight:number;
 offset:number;cardWidth:number;gap:number;videos:boolean[];
}):number {
 const {x,y,width,height,windowWidth,windowHeight,offset,cardWidth,gap,videos}=input;
 if(![x,y,width,height,windowWidth,windowHeight,offset,cardWidth].every(Number.isFinite) ||
   width<=0||height<=0||cardWidth<=0||y>windowHeight*1.65||y+height< -windowHeight*0.65)return -1;
 const left=Math.max(x,0),right=Math.min(x+width,windowWidth);
 let visible=-1,mostVisible=0;
 let next=-1,nextDistance=Number.POSITIVE_INFINITY;
 videos.forEach((video,i)=>{
   if(!video)return;
   const start=x+i*(cardWidth+gap)-offset;
   const overlap=Math.max(0,Math.min(start+cardWidth,right)-Math.max(start,left));
   if(overlap>mostVisible){mostVisible=overlap;visible=i;}
   // Warm a single next clip while the current one is still on screen.
   // Limit forward lookahead to two adjacent cards: no background download sweep.
   const distance=start-right;
   if(distance>=0 && distance<=cardWidth*2+gap*2 && distance<nextDistance){
     next=i;nextDistance=distance;
   }
 });
 return next>=0?next:visible;
}

/**
 * Select a story step without stealing a zoom gesture or horizontal photo paging.
 * A single deliberate horizontal swipe switches stories only at a gallery edge.
 */
export function maritesStorySwipeStep(input: {
  startX: number; startY: number; endX: number; endY: number;
  elapsedMs: number; photoCount: number; photoPage: number;
  zoomed: boolean; reacting: boolean; hasMultipleStories: boolean;
}): -1 | 0 | 1 {
  const {startX, startY, endX, endY, elapsedMs, photoCount, photoPage,
    zoomed, reacting, hasMultipleStories} = input;
  if (zoomed || reacting || !hasMultipleStories || ![startX, startY, endX, endY, elapsedMs].every(Number.isFinite)) return 0;
  if (elapsedMs < 0 || elapsedMs > 800) return 0;
  const dx = endX - startX;
  const dy = endY - startY;
  if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.35) return 0;
  if (photoCount > 1) {
    const page = Math.max(0, Math.min(photoCount - 1, Math.round(photoPage)));
    if ((dx < 0 && page < photoCount - 1) || (dx > 0 && page > 0)) return 0;
  }
  return dx < 0 ? 1 : -1;
}
