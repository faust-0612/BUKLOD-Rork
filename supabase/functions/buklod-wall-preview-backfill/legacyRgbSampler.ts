/** Convert RGB camera pixels into a <=384px RGBA JPEG encoder input.
 * Source is decoded with 3 rather than 4 bytes per pixel to reduce peak RAM.
 */
export function sampleLegacyRgbPreview(input: {
  width: number; height: number; data: Uint8Array;
}): {width:number;height:number;data:Uint8Array} {
  const {width,height,data}=input;
  if (!Number.isInteger(width)||!Number.isInteger(height)||
      width<=0||height<=0||width*height>24_000_000||
      data.length!==width*height*3) throw new Error('invalid_rgb_dimensions');
  const ratio=Math.min(1,384/Math.max(width,height));
  const w=Math.max(1,Math.round(width*ratio));
  const h=Math.max(1,Math.round(height*ratio));
  const pixels=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++){
    const sy=Math.min(height-1,Math.floor(y*height/h));
    for(let x=0;x<w;x++){
      const sx=Math.min(width-1,Math.floor(x*width/w));
      const from=(sy*width+sx)*3,to=(y*w+x)*4;
      pixels[to]=data[from];
      pixels[to+1]=data[from+1];
      pixels[to+2]=data[from+2];
      pixels[to+3]=255;
    }
  }
  return {width:w,height:h,data:pixels};
}
