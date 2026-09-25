import { useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import {
  attachPendingBuklodReferral,
  ensureBuklodProfitFirstIdentity,
} from '@/lib/buklodReferralV2';

export default function BuklodProfitFirstIdentityBootstrap(){
  const { user }=useAuth();
  useEffect(()=>{
    if(!user?.id)return;
    let alive=true;
    const timer=setTimeout(()=>{
      void (async()=>{
        try{
          await ensureBuklodProfitFirstIdentity();
          if(alive)await attachPendingBuklodReferral();
        }catch(error){
          console.warn('BUKLOD Profit-First identity:',error instanceof Error?error.message:error);
        }
      })();
    },700);
    return()=>{alive=false;clearTimeout(timer)};
  },[user?.id]);
  return null;
}
