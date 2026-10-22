import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';

export type RequiredPolicy = {
  policy_version_id: string;
  policy_type: 'privacy_notice'|'community_guidelines'|'pastoral_care_notice';
  version: string;
  title: string;
  summary: string;
  acceptance_kind: 'acknowledgement'|'agreement';
  accepted: boolean;
};

type ComplianceValue = {
  loading: boolean;
  policies: RequiredPolicy[];
  requiresAcceptance: boolean;
  refresh: () => Promise<void>;
  acceptAll: () => Promise<{ error?: string }>;
};

const ComplianceContext = createContext<ComplianceValue>({
  loading: true,
  policies: [],
  requiresAcceptance: false,
  refresh: async () => {},
  acceptAll: async () => ({}),
});

const COMPLIANCE_TIMEOUT_MS = 4000;

function offlinePolicy(): RequiredPolicy {
  return {
    policy_version_id:'offline',
    policy_type:'privacy_notice',
    version:'offline',
    title:'Privacy notice review required',
    summary:'Connect to the internet to review and save required policy acknowledgements.',
    acceptance_kind:'acknowledgement',
    accepted:false,
  };
}

export function ComplianceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { online } = useNetwork();
  const [loading,setLoading]=useState(true);
  const [policies,setPolicies]=useState<RequiredPolicy[]>([]);

  const cacheKey = user ? `buklod:policy-ok:${user.id}` : null;

  const refresh=async()=>{
    if(!user){
      setPolicies([]);
      setLoading(false);
      return;
    }

    let cachedOk=false;

    if(cacheKey){
      try{
        cachedOk=
          (await AsyncStorage.getItem(cacheKey)) === 'true';
      }catch(error){
        console.warn(
          'BUKLOD compliance cache:',
          String((error as Error)?.message ?? error)
        );
      }
    }

    /*
     * BUKLOD_GLOBAL_BOOT_R20:
     * A previously accepted policy cache can release the shell
     * immediately while the server verifies current policy state.
     */
    if(cachedOk){
      setPolicies([]);
      setLoading(false);
    }

    if(!online){
      setPolicies(
        cachedOk
          ? []
          : [offlinePolicy()]
      );
      setLoading(false);
      return;
    }

    if(!cachedOk){
      setLoading(true);
    }

    try{
      const {data,error}=await withBuklodTimeout(
        supabase.rpc('current_required_policies'),
        COMPLIANCE_TIMEOUT_MS,
        'BUKLOD required policies'
      );

      if(error){
        throw error;
      }

      const rows=(data??[]) as RequiredPolicy[];
      setPolicies(rows);

      const ok=rows.every(p=>p.accepted);

      if(cacheKey){
        void AsyncStorage
          .setItem(cacheKey,ok?'true':'false')
          .catch((error)=>{
            console.warn(
              'BUKLOD compliance cache save:',
              String((error as Error)?.message ?? error)
            );
          });
      }
    }catch(error){
      console.warn(
        'BUKLOD required policies:',
        String((error as Error)?.message ?? error)
      );

      /*
       * Never spin forever and never silently bypass a policy
       * that has not previously been accepted on this device.
       */
      setPolicies(
        cachedOk
          ? []
          : [offlinePolicy()]
      );
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{void refresh()},[user?.id,online]);

  const acceptAll=async()=>{
    if(!user) return {error:'Authentication required.'};
    if(!online) return {error:'Connect to the internet to save your acknowledgement.'};

    const appVersion=Constants.expoConfig?.version ?? null;
    const missing=policies.filter(
      p=>!p.accepted && p.policy_version_id!=='offline'
    );

    for(const p of missing){
      try{
        const {error}=await withBuklodTimeout(
          supabase.rpc('accept_required_policy',{
            p_policy_version_id:p.policy_version_id,
            p_app_version:appVersion,
          }),
          COMPLIANCE_TIMEOUT_MS,
          'BUKLOD policy acceptance'
        );

        if(error) return {error:error.message};
      }catch(error){
        return {
          error:String(
            (error as Error)?.message ??
              error ??
              'Policy acceptance timed out.'
          ),
        };
      }
    }

    if(cacheKey){
      await AsyncStorage.setItem(cacheKey,'true');
    }

    await refresh();
    return {};
  };

  const value=useMemo(()=>({
    loading,
    policies,
    requiresAcceptance:policies.some(p=>!p.accepted),
    refresh,
    acceptAll,
  }),[loading,policies]);

  return <ComplianceContext.Provider value={value}>{children}</ComplianceContext.Provider>;
}

export function useCompliance(){
  return useContext(ComplianceContext);
}
