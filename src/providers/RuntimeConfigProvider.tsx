import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { appEnvironment } from '@/lib/environment';
import { withBuklodTimeout } from '@/lib/buklodAsyncTimeout';
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

const RUNTIME_CONFIG_TIMEOUT_MS = 4000;
/*
 * PERF_MAIN_BOOT_R3
 *
 * Runtime config changes rarely compared with app opens / network reconnects.
 * Reuse a recently fetched per-user snapshot so mass login does not create a
 * thundering herd against the API gateway. Manual refresh() still forces a
 * server read.
 */
const RUNTIME_CONFIG_FRESH_MS = 2 * 60 * 1000;

export function RuntimeConfigProvider({children}:{children:React.ReactNode}){
  const {user}=useAuth();
  const {isConnected,isInternetReachable}=useNetwork();
  const [loading,setLoading]=useState(true);
  const [config,setConfig]=useState<RuntimeConfig|null>(null);

  const online=isConnected && isInternetReachable!==false;
  const version=Constants.expoConfig?.version ?? '0.0.0';
  const cacheKey=user ? `buklod:runtime:${user.id}:${appEnvironment}` : null;
  const cacheFreshKey=cacheKey ? `${cacheKey}:fetched-at` : null;

  const refresh=async(force=true)=>{
    if(!user){
      setConfig(null);
      setLoading(false);
      return;
    }

    let cachedConfig:RuntimeConfig|null=null;
    let cachedFetchedAt=0;

    if(cacheKey){
      try{
        const [cached,cachedAtRaw]=await Promise.all([
          AsyncStorage.getItem(cacheKey),
          cacheFreshKey
            ? AsyncStorage.getItem(cacheFreshKey)
            : Promise.resolve(null),
        ]);

        cachedFetchedAt=Number(cachedAtRaw ?? 0) || 0;

        if(cached){
          try{
            cachedConfig=JSON.parse(cached) as RuntimeConfig;
            setConfig(cachedConfig);
            /*
             * BUKLOD_GLOBAL_BOOT_R20:
             * Cached runtime config is enough to release the shell.
             */
            setLoading(false);
          }catch{}
        }
      }catch(error){
        console.warn(
          'BUKLOD runtime cache:',
          String((error as Error)?.message ?? error)
        );
      }
    }

    if(!online){
      setLoading(false);
      return;
    }

    if(
      !force &&
      cachedConfig &&
      cachedFetchedAt > 0 &&
      Date.now() - cachedFetchedAt < RUNTIME_CONFIG_FRESH_MS
    ){
      setLoading(false);
      return;
    }

    if(!cachedConfig && !config){
      setLoading(true);
    }

    try{
      const {data,error}=await withBuklodTimeout(
        supabase.rpc('get_client_runtime_config',{
          p_environment:appEnvironment,
          p_app_version:version,
        }),
        RUNTIME_CONFIG_TIMEOUT_MS,
        'BUKLOD runtime config'
      );

      if(error){
        console.warn('BUKLOD runtime config:',error.message);
        return;
      }

      const next=data as RuntimeConfig;
      setConfig(next);

      if(cacheKey){
        void Promise.all([
          AsyncStorage.setItem(
            cacheKey,
            JSON.stringify(next)
          ),
          cacheFreshKey
            ? AsyncStorage.setItem(
                cacheFreshKey,
                String(Date.now())
              )
            : Promise.resolve(),
        ]).catch((error)=>{
          console.warn(
            'BUKLOD runtime cache save:',
            String((error as Error)?.message ?? error)
          );
        });
      }
    }catch(error){
      console.warn(
        'BUKLOD runtime config:',
        String((error as Error)?.message ?? error)
      );
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{void refresh(false)},[user?.id,online,appEnvironment]);

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
