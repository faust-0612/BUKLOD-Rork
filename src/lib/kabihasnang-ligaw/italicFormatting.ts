import { KL_RELEASED_ITALIC_RULES } from './releasedItalicRules';

export type KlItalicRun = { text: string; italic: boolean };

function append(runs: KlItalicRun[], text: string, italic: boolean) {
  if (!text) return;
  const last = runs[runs.length - 1];
  if (last && last.italic === italic) last.text += text;
  else runs.push({ text, italic });
}

/** Parse single Markdown emphasis markers. Double/triple markers and unmatched
 * markers remain literal; no HTML is rendered in the reader. */
export function splitKlItalics(source: string, season?: number, chapter?: number): KlItalicRun[] {
  const runs: KlItalicRun[] = [];
  const raw = source.trim();
  if (/^>\s+/.test(raw)) return [{ text: raw.replace(/^>\s+/, ''), italic: true }];
  const rule = season === 1 && chapter != null
    ? KL_RELEASED_ITALIC_RULES[chapter]?.find(row => row.paragraph === raw)
    : undefined;
  if (rule) {
    const ranges = rule.spans.map(span => ({ start: source.indexOf(span), length: span.length }))
      .filter(range => range.start >= 0).sort((a,b) => a.start-b.start);
    let cursor = 0;
    for (const range of ranges) {
      if (range.start < cursor) continue;
      append(runs, source.slice(cursor, range.start), false);
      append(runs, source.slice(range.start, range.start+range.length), true);
      cursor = range.start+range.length;
    }
    append(runs, source.slice(cursor), false);
    return runs;
  }
  let cursor = 0;
  for (let i=0; i<source.length; i++) {
    const marker = source[i];
    if (marker !== '*' && marker !== '_') continue;
    if (source[i-1] === marker || source[i+1] === marker || source[i-1] === '\\' ||
        !source[i+1] || /\s/.test(source[i+1])) continue;
    if (marker === '_' && /[\p{L}\p{N}]/u.test(source[i-1] || '')) continue;
    let end = i+1;
    while (end<source.length && source[end]!==marker && source[end]!=='\n') end++;
    if (source[end]!==marker || source[end+1]===marker || /\s/.test(source[end-1]) ||
        (marker==='_' && /[\p{L}\p{N}]/u.test(source[end+1]||''))) continue;
    append(runs,source.slice(cursor,i),false);
    append(runs,source.slice(i+1,end),true);
    cursor=end+1; i=end;
  }
  append(runs,source.slice(cursor),false);
  return runs.length ? runs : [{text:source,italic:false}];
}

const ENTITIES: Record<string,string> = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',hellip:'…',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”'};
function decodeHtml(text:string):string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(full,key:string)=>{
    if(key[0]==='#') {
      const cp = key[1].toLowerCase()==='x' ? parseInt(key.slice(2),16) : parseInt(key.slice(1),10);
      return Number.isInteger(cp)&&cp>=0&&cp<=0x10ffff&&!(cp>=0xd800&&cp<=0xdfff) ? String.fromCodePoint(cp) : full;
    }
    return ENTITIES[key.toLowerCase()] ?? full;
  });
}
const normalizeClipboard=(s:string)=>s.replace(/\s+/g,' ').trim();

/** Convert only text and italic semantics from clipboard HTML. Never execute HTML.
 * On ambiguous conversion or lost content, keep the exact original plain text. */
export function importKlClipboard(plain:string,html:string):{text:string;formatted:boolean} {
  if (!html || html.length>2_000_000 || !/<(?:i|em|span|p|div)\b/i.test(html)) return {text:plain,formatted:false};
  const body = html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(head|script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const stack:{tag:string;italic:boolean}[]=[];
  const runs:KlItalicRun[]=[];
  let plainText='';
  function emit(value:string,italic:boolean){
    plainText+=value;append(runs,value,italic);
  }
  for(const token of body.match(/<[^>]*>|[^<]+|</g)??[]){
    if(token[0]!=='<' || token==='<'){emit(decodeHtml(token),stack.at(-1)?.italic??false);continue;}
    const m=token.match(/^<\s*(\/?)\s*([a-z][a-z0-9:-]*)\b/i);
    if(!m)continue;
    const tag=m[2].toLowerCase(), closing=Boolean(m[1]);
    const block=/^(p|div|li|h[1-6]|blockquote|section|article)$/.test(tag);
    if(closing){
      const index=stack.map(item=>item.tag).lastIndexOf(tag);
      if(index>=0)stack.splice(index);
      if(block)emit('\n\n',false);
    }else if(tag==='br'){emit('\n',false);}
    else if(!/^(img|hr|meta|link|input|wbr|col|area|base|embed|source|track)$/.test(tag)&&!token.endsWith('/>')){
      const parent=stack.at(-1)?.italic??false;
      const style=token.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const css=style?.[1]??style?.[2]??'';
      const italic=/font-style\s*:\s*(?:italic|oblique)\b/i.test(css)||tag==='i'||tag==='em'||(parent&&!/font-style\s*:\s*normal\b/i.test(css));
      stack.push({tag,italic});
    }
  }
  if(normalizeClipboard(plainText)!==normalizeClipboard(plain))return {text:plain,formatted:false};
  // Use source plain text as authority for exact paragraph breaks and spacing.
  // Map non-whitespace characters to italic flags, refusing unsafe ambiguous markers.
  const flags:boolean[]=[];
  for(const run of runs)for(const char of run.text)if(!/\s/u.test(char))flags.push(run.italic);
  let offset=0, active=false, output='', formatted=false;
  const chars=Array.from(plain);
  for(let i=0;i<chars.length;i++){
    const char=chars[i];
    if(/\s/u.test(char)){
      if(active && (char==='\n'||char==='\r'||!flags[offset])){output+='*';active=false;}
      output+=char;continue;
    }
    const desired=flags[offset++]??false;
    if(desired!==active){output+='*';active=desired;formatted=true;}
    if(active&&char==='*')return {text:plain,formatted:false};
    output+=char;
  }
  if(active)output+='*';
  if(!formatted || offset!==flags.length)return {text:plain,formatted:false};
  // Ensure Markdown conversion round-trips every visible character.
  const rendered=output.split('\n').map(line=>splitKlItalics(line).map(run=>run.text).join('')).join('\n');
  return rendered===plain ? {text:output,formatted:true} : {text:plain,formatted:false};
}

export function toggleKlItalic(source:string,start:number,end:number):string {
  if(start<0||end>source.length||start>=end)return source;
  const picked=source.slice(start,end);
  if(picked.includes('\n')||picked.includes('*')||!picked.trim()||picked!==picked.trim())return source;
  if(source[start-1]==='*'&&source[end]==='*'&&source[start-2]!=='*'&&source[end+1]!=='*')
    return source.slice(0,start-1)+picked+source.slice(end+1);
  return source.slice(0,start)+'*'+picked+'*'+source.slice(end);
}
