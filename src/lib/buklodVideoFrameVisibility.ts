/** A video frame begins playing when an actual edge of its media is visible. */
export function buklodVisibleVideoArea(
 rect:{x:number;y:number;width:number;height:number},
 screen:{width:number;height:number}
):number {
 const {x,y,width,height}=rect;
 if(![x,y,width,height,screen.width,screen.height].every(Number.isFinite)||
 width<=0||height<=0||screen.width<=0||screen.height<=0)return 0;
 const w=Math.max(0,Math.min(x+width,screen.width)-Math.max(0,x));
 const h=Math.max(0,Math.min(y+height,screen.height)-Math.max(0,y));
 return w>=Math.min(width*.15,24)&&h>=Math.min(height*.06,18)?w*h:0;
}
