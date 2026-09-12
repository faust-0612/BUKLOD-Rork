import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

type RuntimeConfigCacheEnvelope = {
  schema: 1;
  user_id: string;
  environment: string;
  saved_at: number;
  config: RuntimeConfig;
};

type ParsedRuntimeCache = {
  config: RuntimeConfig;
  savedAt: number;
};

const RuntimeContext = createContext<RuntimeContextValue>({
  loading: true,
  config: null,
  refresh: async () => {},
  featureEnabled: () => true,
});

const RUNTIME_CONFIG_TIMEOUT_MS = 4000;
const RUNTIME_CONFIG_CACHE_TTL_MS = 5 * 60 * 1000;

function parseRuntimeCache(
  raw: string,
  userId: string,
): ParsedRuntimeCache | null {
  try {
    const parsed = JSON.parse(raw) as
      | RuntimeConfigCacheEnvelope
      | RuntimeConfig;

    if (
      'schema' in parsed &&
      parsed.schema === 1 &&
      parsed.user_id === userId &&
      parsed.environment === appEnvironment &&
      parsed.config
    ) {
      return {
        config: parsed.config,
        savedAt: parsed.saved_at,
      };
    }

    /*
     * Backward compatibility for the pre-hardening cache shape, where the
     * RuntimeConfig object itself was stored directly. Treat it as expired so
     * it can only be used as an offline fallback and will be replaced after a
     * successful online refresh.
     */
    if (
      'features' in parsed &&
      typeof parsed.features === 'object' &&
      'environment' in parsed
    ) {
      return {
        config: parsed as RuntimeConfig,
        savedAt: 0,
      };
    }
  } catch {
    // Ignore malformed cache. The server refresh below remains authoritative.
  }

  return null;
}

export function RuntimeConfigProvider({children}:{children:React.ReactNode}){
  const {user}=useAuth();
  const {isConnected,isInternetReachable}=useNetwork();
  const [loading,setLoading]=useState(true);
  const [config,setConfig]=useState<RuntimeConfig|null>(null);

  const online=isConnected && isInternetReachable!==false;
  const version=Constants.expoConfig?.version ?? '0.0.0';
  const identityKey=user ? `${user.id}:${appEnvironment}` : null;
  const cacheKey=user ? `buklod:runtime:${user.id}:${appEnvironment}` : null;
  const activeIdentityRef=useRef<string|null>(identityKey);
  const previousIdentityRef=useRef<string|null>(identityKey);
  const requestSerialRef=useRef(0);

  /*
   * Keep the async request guard synchronized with the latest render. A late
   * response from a previous account must never overwrite the current user's
   * runtime state.
   */
  activeIdentityRef.current=identityKey;

  const refresh=async()=>{
    const requestIdentity=identityKey;
    const requestUserId=user?.id ?? null;
    const requestCacheKey=cacheKey;
    const requestSerial=++requestSerialRef.current;

    const requestIsCurrent=()=>(
      activeIdentityRef.current===requestIdentity &&
      requestSerialRef.current===requestSerial
    );

    if(!requestUserId || !requestIdentity){
      if(requestIsCurrent()){
        setConfig(null);
        setLoading(false);
      }
      return;
    }

    let parsedCache:ParsedRuntimeCache|null=null;
    let publishedCache=false;

    if(requestCacheKey){
      try{
        const cached=await AsyncStorage.getItem(requestCacheKey);

        if(!requestIsCurrent()) return;

        if(cached){
          parsedCache=parseRuntimeCache(cached,requestUserId);

          if(parsedCache){
            const cacheAge=Date.now()-parsedCache.savedAt;
            const cacheIsFresh=(
              parsedCache.savedAt>0 &&
              cacheAge>=0 &&
              cacheAge<=RUNTIME_CONFIG_CACHE_TTL_MS
            );

            /*
             * Online boots only trust a short-lived cache. Expired/legacy
             * runtime state must not make one account look "older" than
             * another. Offline mode may still use the same-user cache as a
             * continuity fallback.
             */
            if(cacheIsFresh || !online){
              setConfig(parsedCache.config);
              setLoading(false);
              publishedCache=true;
            }
          }
        }
      }catch(error){
        console.warn(
          'BUKLOD runtime cache:',
          String((error as Error)?.message ?? error)
        );
      }
    }

    if(!requestIsCurrent()) return;

    if(!online){
      setLoading(false);
      return;
    }

    if(!publishedCache){
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

      if(!requestIsCurrent()) return;

      if(error){
        console.warn('BUKLOD runtime config:',error.message);
        return;
      }

      const next=data as RuntimeConfig;
      setConfig(next);

      if(requestCacheKey){
        const envelope:RuntimeConfigCacheEnvelope={
          schema:1,
          user_id:requestUserId,
          environment:appEnvironment,
          saved_at:Date.now(),
          config:next,
        };

        void AsyncStorage
          .setItem(requestCacheKey,JSON.stringify(envelope))
          .catch((error)=>{
            console.warn(
              'BUKLOD runtime cache save:',
              String((error as Error)?.message ?? error)
            );
          });
      }
    }catch(error){
      if(requestIsCurrent()){
        console.warn(
          'BUKLOD runtime config:',
          String((error as Error)?.message ?? error)
        );
      }
    }finally{
      if(requestIsCurrent()){
        setLoading(false);
      }
    }
  };

  useEffect(()=>{
    const identityChanged=previousIdentityRef.current!==identityKey;
    previousIdentityRef.current=identityKey;

    if(identityChanged){
      /*
       * Account/environment switches are hard boundaries. Clear the previous
       * runtime state before reading the new account's cache or server config.
       */
      setConfig(null);
      setLoading(Boolean(identityKey));
    }

    void refresh();
  },[identityKey,online]);

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
