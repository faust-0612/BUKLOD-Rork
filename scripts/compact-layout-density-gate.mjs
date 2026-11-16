#!/usr/bin/env node
// Enforce future compact presentation without flagging unrelated legacy values.
// Screen/media geometry, scaled typography and accessible touch target sizes
// are intentionally outside this decorative margin/padding-only rule.
const EXT=/\.([cm]?[jt]sx?)$/i;
const EXCEPTION=/layout-density-exception:\s*(.{12,})/i;
export function scanAddedSpacingDiff(diff) {
 const failures=[]; let file='',prior='';
 for(const line of String(diff??'').split(/\r?\n/)) {
  if(line.startsWith('+++ b/')){file=line.slice(6);prior='';continue;}
  if(line.startsWith('@@')){prior='';continue;}
  if(!line.startsWith('+')||line.startsWith('+++')){prior='';continue;}
  const added=line.slice(1);
  if(!file.startsWith('src/')||!EXT.test(file)){prior=added;continue;}
  const re=/\b(padding(?:Horizontal|Vertical|Top|Bottom|Left|Right)?|margin(?:Horizontal|Vertical|Top|Bottom|Left|Right)?|gap)\s*:\s*(\d+(?:\.\d+)?)(?![\d.])/g;
  for(const match of added.matchAll(re)) {
   const prop=match[1],size=Number(match[2]);
   const max=prop.startsWith('padding')?24:prop.startsWith('margin')?20:16;
   if(size<=max||EXCEPTION.test(added)||EXCEPTION.test(prior))continue;
   failures.push(file+': oversized new '+prop+'='+size+'dp; use compact tokens or document layout-density-exception: <specific reason> here or on preceding added comment');
  }
  prior=added;
 }
 return failures;
}
