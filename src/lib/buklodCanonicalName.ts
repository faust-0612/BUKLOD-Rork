/** BUKLOD real-name display identity. Never trust client-editable auth metadata. */
import { supabase } from '@/lib/supabase';

export async function loadBuklodCanonicalDisplayName(userId:string):Promise<string>{
 const {data,error}=await supabase.from('profiles')
  .select('full_name,is_active').eq('id',userId).maybeSingle();
 if(error || data?.is_active !== true) return 'BUKLOD Member';
 const legal=String(data.full_name||'').replace(/\s+/g,' ').trim();
 return legal ? legal.slice(0,120) : 'BUKLOD Member';
}
