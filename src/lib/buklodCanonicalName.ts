/** Resolve call identity from protected BUKLOD profiles, not editable auth metadata. */
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';

const lastGood = new Map<string,{name:string;at:number}>();
const CACHE_MS = 90_000;

export async function loadBuklodCanonicalDisplayName(userId:string):Promise<string>{
 const cached=lastGood.get(userId);
 if(cached && Date.now()-cached.at < CACHE_MS) return cached.name;
 try{
  // Call setup must not hang on 3G. Generic fallback cannot be an alias.
  const result=await withBuklodTimeout<{data:any;error:any}>(
   Promise.resolve(supabase.from('profiles').select('full_name,is_active').eq('id',userId).maybeSingle()),
   1200,'BUKLOD call identity'
  );
  if(!result.error && result.data?.is_active===true){
   const name=String(result.data.full_name||'').replace(/\s+/g,' ').trim().slice(0,120);
   if(name){lastGood.set(userId,{name,at:Date.now()});return name;}
  }
 }catch{/* Canonical read may be offline; never fall back to editable auth metadata. */}
 return cached?.name || 'BUKLOD Member';
}
