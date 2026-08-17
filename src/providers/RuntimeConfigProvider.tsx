import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { appEnvironment } from '@/lib/environment';
import { useAuth } from '@/providers/AuthProvider';
import { useNetwork } from '@/providers/NetworkProvider';

export type RuntimeConfig = {
  environment: string;
  maintenance_mode: boolean;
  maintenance_message?: string | null;
  minimum_supported_version: string;
  recommended_version: string;
  update_required: boolean;
  update_recommended: boolean;
  update_message?: string | null;
  pilot_access_required: boolean;
  pilot_access_granted: boolean;
  admin_bypass: boolean;
  release_title?: string | null;
  release_notes?: string | null;
  features: Record<string, boolean>;
};

type RuntimeContextValue = {
  loading: boolean;
  config: RuntimeConfig | null;
  refresh: () => Promise<void>;
  featureEnabled: (key: string) => boolean;
};

const RuntimeContext = createContext<RuntimeContextValue>({
  loading: true,
  config: null,
  refresh: async () => {},
  featureEnabled: () => true,
});

export function RuntimeConfigProvider({children}:{children:React.ReactNode}){
  const {user}=useAuth();
  const {isConnected,isInternetReachable}=useNetwork();
  const [loading,setLoading]=useState(true);
  const [config,setConfig]=useState<RuntimeConfig|null>(null);

  const online=isConnected && isInternetReachable!==false;
  const version=Constants.expoConfig?.version ?? '0.0.0';
  const cacheKey=user ? `buklod:runtime:${user.id}:${appEnvironment}` : null;

  const refresh=async()=>{
    if(!user){
      setConfig(null);
      setLoading(false);
      return;
    }

    if(!online){
      if(cacheKey){
        const cached=await AsyncStorage.getItem(cacheKey);
        if(cached){
          try{ setConfig(JSON.parse(cached)); }catch{}
        }
      }
      setLoading(false);
      return;
    }

    const {data,error}=await supabase.rpc('get_client_runtime_config',{
      p_environment:appEnvironment,
      p_app_version:version,
    });

    if(error){
      console.warn('BUKLOD runtime config:',error.message);
      setLoading(false);
      return;
    }

    const next=data as RuntimeConfig;
    setConfig(next);
    if(cacheKey)await AsyncStorage.setItem(cacheKey,JSON.stringify(next));
    setLoading(false);
  };

  useEffect(()=>{refresh()},[user?.id,online,appEnvironment]);

  const value=useMemo(()=>({
    loading,
    config,
    refresh,
    featureEnabled:(key:string)=>config?.features?.[key] !== false,
  }),[loading,config]);

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
}

export function useRuntimeConfig(){
  return useContext(RuntimeContext);
}
