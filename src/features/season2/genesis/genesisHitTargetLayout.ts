/** Normalized art-coordinate targets, gently separated only where 44dp areas collide. */
export type HitCenter = {x:number;y:number};
export function layoutHotspotCenters(
  hotspots: readonly {x:number;y:number}[], width:number,height:number,diameter=44,
):HitCenter[]{
  const radius=diameter/2;
  const clamp=(value:number,max:number)=>Math.max(radius,Math.min(max-radius,value));
  const base=hotspots.map(h=>({x:clamp(h.x*width,width),y:clamp(h.y*height,height)}));
  const centers=base.map(p=>({...p}));
  // Bounded deterministic relaxation, never reorders/changes feature identity.
  for(let iteration=0;iteration<140;iteration++){
    const shift=centers.map(()=>({x:0,y:0}));
    for(let i=0;i<centers.length;i++){
      for(let j=i+1;j<centers.length;j++){
        const dx=centers[j].x-centers[i].x,dy=centers[j].y-centers[i].y;
        const distance=Math.sqrt(dx*dx+dy*dy);
        if(distance>=diameter+2)continue;
        const safe=distance>0.0001?distance:1;
        const fx=distance>0.0001?dx/safe:1;
        const fy=distance>0.0001?dy/safe:0;
        const magnitude=(diameter+2-distance)/2;
        shift[i].x-=fx*magnitude;shift[i].y-=fy*magnitude;
        shift[j].x+=fx*magnitude;shift[j].y+=fy*magnitude;
      }
    }
    for(let i=0;i<centers.length;i++){
      centers[i].x=clamp(centers[i].x+0.55*(shift[i].x+0.018*(base[i].x-centers[i].x)),width);
      centers[i].y=clamp(centers[i].y+0.55*(shift[i].y+0.018*(base[i].y-centers[i].y)),height);
    }
  }
  return centers;
}
