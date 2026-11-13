/** Server-only policy for Himig Studio. NEVER import from client UI. */
export const MODEL = 'fal-ai/sam-audio/separate' as const;
const CDN='v3.fal.media';
export function configured(): boolean {
  return Boolean(process.env.FAL_KEY && process.env.HIMIG_OWNER_TOKEN &&
    process.env.HIMIG_OWNER_TOKEN.length>=32 &&
    process.env.HIMIG_ENABLE_PAID_AI==='true');
}
function json(body: unknown,status=200):Response {
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export {json};
export async function authorize(req:Request):Promise<Response|null>{
  if(!configured()) return json({error:'AI_BACKEND_DISABLED',message:'External model calls are locked. Configure private EAS server variables FAL_KEY, HIMIG_OWNER_TOKEN (32+ chars) and HIMIG_ENABLE_PAID_AI=true. No provider billing is attempted.'},503);
  const given=req.headers.get('Authorization')||'';
  const secret=process.env.HIMIG_OWNER_TOKEN!;
  const expected='Bearer '+secret;
  // Compare digests to avoid length- or first-mismatch dependent comparisons.
  const encoder=new TextEncoder();
  const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(given)),crypto.subtle.digest('SHA-256',encoder.encode(expected))]);
  const ab=new Uint8Array(a),bb=new Uint8Array(b);
  let mismatch=0;for(let i=0;i<ab.length;i++)mismatch|=ab[i]^bb[i];
  if(mismatch || !given.startsWith('Bearer '))return json({error:'UNAUTHORIZED'},401);
  return null;
}
export async function readJson(req:Request,max=8192):Promise<Record<string,unknown>>{
  if(req.headers.get('Content-Type')?.split(';')[0].trim()!=='application/json') throw new Error('Only application/json is accepted');
  const length=Number(req.headers.get('content-length')||0);
  if(length>max)throw new Error('Request body too large');
  const raw=await req.text();
  if(raw.length>max)throw new Error('Request body too large');
  const obj=JSON.parse(raw);
  if(!obj || typeof obj!=='object'||Array.isArray(obj))throw new Error('Invalid JSON object');
  return obj as Record<string,unknown>;
}
export function isFalAudioUrl(s:unknown):s is string {
  if(typeof s!=='string'||s.length>2048)return false;
  try {const u=new URL(s);return u.protocol==='https:' && u.hostname===CDN && u.pathname.startsWith('/files/')&&!u.username&&!u.password;}catch{return false;}
}
export function isFalUploadUrl(s:unknown):s is string {
  if(typeof s!=='string'||s.length>4096)return false;
  try {const u=new URL(s);return u.protocol==='https:'&&['v3-uploads.fal.media','v3.fal.media'].includes(u.hostname) && !u.username&&!u.password;}catch{return false;}
}
export function isQueueUrl(s:unknown,id:string):s is string{
  if(typeof s!=='string'||s.length>4096||!isUuid(id))return false;
  try{
    const u=new URL(s);
    return u.protocol==='https:'&&u.hostname==='queue.fal.run'&&!u.username&&!u.password&&
      u.pathname.startsWith('/fal-ai/sam-audio/') &&
      u.pathname.includes('/requests/'+id) &&
      !u.pathname.includes('..');
  }catch{return false;}
}
export function isUuid(s:unknown):s is string {
  return typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
export async function provider(url:string,options:RequestInit={}):Promise<Response>{
  // Callers pass only constant endpoints or paths validated by isQueueUrl.
  const ctrl=new AbortController();
  const stop=setTimeout(()=>ctrl.abort(),25000);
  try{
    const r=await fetch(url,{...options,signal:ctrl.signal,headers:{
      'Authorization':'Key '+process.env.FAL_KEY!,
      'X-Fal-Store-IO':'0',
      ...(options.body?{'Content-Type':'application/json'}:{}),
      ...options.headers
    }});
    return r;
  }finally{clearTimeout(stop);}
}
export async function safeUpstream(r:Response):Promise<unknown>{
  const textBody=(await r.text()).slice(0,12000);
  try{return JSON.parse(textBody);}catch{return {error:'PROVIDER_INVALID_JSON',status:r.status};}
}
export function rejectInvalid(e:unknown):Response{
  return json({error:'INVALID_REQUEST',message:e instanceof Error?e.message:'Invalid request'},400);
}
