import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type NetworkValue = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
};

const NetworkContext = createContext<NetworkValue>({
  isConnected: true,
  isInternetReachable: null,
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NetInfoState | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(setState);
    NetInfo.fetch().then(setState).catch(() => {});
    return unsubscribe;
  }, []);

  const value = useMemo(() => ({
    isConnected: state?.isConnected !== false,
    isInternetReachable: state?.isInternetReachable ?? null,
  }), [state?.isConnected, state?.isInternetReachable]);

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  return useContext(NetworkContext);
}
