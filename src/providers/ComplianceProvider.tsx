import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
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

export function ComplianceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isConnected, isInternetReachable } = useNetwork();
  const [loading,setLoading]=useState(true);
  const [policies,setPolicies]=useState<RequiredPolicy[]>([]);
  const online = isConnected && isInternetReachable !== false;

  const cacheKey = user ? `buklod:policy-ok:${user.id}` : null;

  const refresh=async()=>{
    if(!user){
      setPolicies([]);
      setLoading(false);
      return;
    }

    if(!online){
      const cached = cacheKey ? await AsyncStorage.getItem(cacheKey) : null;
      setPolicies(cached === 'true' ? [] : [{
        policy_version_id:'offline',
        policy_type:'privacy_notice',
        version:'offline',
        title:'Privacy notice review required',
        summary:'Connect to the internet to review and save required policy acknowledgements.',
        acceptance_kind:'acknowledgement',
        accepted:false,
      }]);
      setLoading(false);
      return;
    }

    const {data,error}=await supabase.rpc('current_required_policies');
    if(error){
      const cached = cacheKey ? await AsyncStorage.getItem(cacheKey) : null;
      setPolicies(cached === 'true' ? [] : []);
      setLoading(false);
      return;
    }

    const rows=(data??[]) as RequiredPolicy[];
    setPolicies(rows);
    const ok=rows.every(p=>p.accepted);
    if(cacheKey) await AsyncStorage.setItem(cacheKey,ok?'true':'false');
    setLoading(false);
  };

  useEffect(()=>{ refresh(); },[user?.id,online]);

  const acceptAll=async()=>{
    if(!user) return {error:'Authentication required.'};
    if(!online) return {error:'Connect to the internet to save your acknowledgement.'};

    const appVersion=Constants.expoConfig?.version ?? null;
    const missing=policies.filter(p=>!p.accepted && p.policy_version_id!=='offline');

    for(const p of missing){
      const {error}=await supabase.rpc('accept_required_policy',{
        p_policy_version_id:p.policy_version_id,
        p_app_version:appVersion,
      });
      if(error) return {error:error.message};
    }

    if(cacheKey) await AsyncStorage.setItem(cacheKey,'true');
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
