import {useCallback,useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';

export function usePaidFeature(code:string){
  const [loading,setLoading]=useState(true);
  const [hasAccess,setHasAccess]=useState(false);
  const refresh=useCallback(async()=>{
    setLoading(true);
    const {data,error}=await supabase.rpc('buklod_has_paid_feature',{_feature_code:code});
    if(error) console.warn('Paid feature:',error.message);
    setHasAccess(!error && data===true);
    setLoading(false);
  },[code]);
  useEffect(()=>{void refresh();},[refresh]);
  return {loading,hasAccess,refresh};
}
