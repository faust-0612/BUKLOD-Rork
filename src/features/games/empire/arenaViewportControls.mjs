/** Camera gestures only: never writes Arena game state, BP, diamonds or inventory. */
const val=(x,f=0)=>Number.isFinite(Number(x))?Number(x):f;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function arenaZoom(x){return clamp(val(x,1),0.6,2.4)}
export function arenaZoomSpan(base,zoom){return Math.max(12,val(base,70))/arenaZoom(zoom)}
export function arenaTouchCenter(touches){
 if(!Array.isArray(touches)||!touches.length)return {x:0,y:0};
 const a=touches.slice(0,2);return {x:a.reduce((s,t)=>s+val(t.pageX),0)/a.length,
 y:a.reduce((s,t)=>s+val(t.pageY),0)/a.length};
}
export function arenaTouchDistance(touches){
 if(!Array.isArray(touches)||touches.length<2)return 0;
 return Math.hypot(val(touches[0].pageX)-val(touches[1].pageX),val(touches[0].pageY)-val(touches[1].pageY));
}
export function arenaDragPan(start,dx,dy,camera,sw,sh){
 return {x:val(start?.x)-val(dx)*val(camera?.width,70)/Math.max(1,val(sw,1)),
 y:val(start?.y)-val(dy)*val(camera?.height,50)/Math.max(1,val(sh,1))};
}
export function arenaMinimapPan(x,y,w,h,worldW,worldH,player){
 return {x:clamp(val(x)/Math.max(1,val(w,1)),0,1)*val(worldW,1)-val(player?.x),
 y:clamp(val(y)/Math.max(1,val(h,1)),0,1)*val(worldH,1)-val(player?.y)};
}
