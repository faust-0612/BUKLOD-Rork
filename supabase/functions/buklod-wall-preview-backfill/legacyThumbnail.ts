/** Safely inspect only APP1 EXIF IFD1, never decode the full camera JPEG. */
export function findEmbeddedLegacyJpegPreview(src: Uint8Array): Uint8Array | null {
  if (src.length < 24 || src[0] !== 255 || src[1] !== 216) return null;
  let p = 2;
  while (p + 4 <= src.length) {
    if (src[p++] !== 255) return null;
    const marker = src[p++];
    if (marker === 218 || marker === 217) return null;
    if (p+2 > src.length) return null;
    const n = src[p]*256 + src[p+1];
    if (n < 2 || p+n > src.length) return null;
    const begin = p+2, end = p+n;
    p = end;
    if (marker !== 225 || begin+14 > end ||
      src[begin]!==69 || src[begin+1]!==120 || src[begin+2]!==105 ||
      src[begin+3]!==102 || src[begin+4]!==0 || src[begin+5]!==0) continue;
    const t = begin+6;
    const le=src[t]===73 && src[t+1]===73, be=src[t]===77 && src[t+1]===77;
    if (!le && !be) continue;
    const rd16=(i:number)=>i>=t&&i+2<=end?(le?src[i]+src[i+1]*256:src[i]*256+src[i+1]):-1;
    const rd32=(i:number)=>i>=t&&i+4<=end?(le?
      src[i]+src[i+1]*256+src[i+2]*65536+src[i+3]*16777216:
      src[i]*16777216+src[i+1]*65536+src[i+2]*256+src[i+3]):-1;
    if (rd16(t+2)!==42) continue;
    const zero=t+rd32(t+4);
    if (zero<t+8||zero+2>end) continue;
    const count0=rd16(zero);
    if(count0<0||count0>128) continue;
    const next=zero+2+count0*12;
    if(next+4>end) continue;
    const one=t+rd32(next);
    if(one<t+8||one+2>end) continue;
    const count1=rd16(one);
    if(count1<1||count1>128||one+2+count1*12>end) continue;
    let offset=-1, size=-1;
    for(let i=0;i<count1;i++){
      const at=one+2+12*i;
      if(rd16(at+2)!==4||rd32(at+4)!==1) continue;
      if(rd16(at)===513) offset=rd32(at+8);
      if(rd16(at)===514) size=rd32(at+8);
    }
    if(offset<8||size<1000||size>125000) continue;
    const from=t+offset;
    if(from<t||from+size>end) continue;
    if(src[from]===255&&src[from+1]===216&&src[from+size-2]===255&&src[from+size-1]===217)
      return src.slice(from,from+size);
  }
  return null;
}
