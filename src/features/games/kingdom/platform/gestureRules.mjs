/** Pure game-gesture adapter; engine, scoring, retry and reward authority stay unchanged. */
export function kingdomSwipeDirection(dx,dy,minimum=27){
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(minimum)||
     minimum<12||minimum>200)return null;
  const x=Math.abs(dx),y=Math.abs(dy);
  if(Math.max(x,y)<minimum||Math.max(x,y)<Math.min(x,y)*1.22)return null;
  return x>y?(dx>0?'right':'left'):(dy>0?'down':'up');
}
