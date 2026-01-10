import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

/**
 * Hook to monitor network connectivity status
 * Returns current network state and provides offline detection
 */
export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  });
  const [isOffline, setIsOffline] = useState(false);

  const handleNetworkChange = useCallback((state: NetInfoState) => {
    const connected = state.isConnected ?? false;
    const reachable = state.isInternetReachable;

    setNetworkStatus({
      isConnected: connected,
      isInternetReachable: reachable,
      type: state.type,
    });

    // Consider offline if not connected or internet is not reachable
    setIsOffline(!connected || reachable === false);
  }, []);

  useEffect(() => {
    // Get initial network state
    NetInfo.fetch().then(handleNetworkChange);

    // Subscribe to network state changes
    const unsubscribe: NetInfoSubscription = NetInfo.addEventListener(handleNetworkChange);

    return () => {
      unsubscribe();
    };
  }, [handleNetworkChange]);

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    handleNetworkChange(state);
    return !state.isConnected || state.isInternetReachable === false;
  }, [handleNetworkChange]);

  return {
    networkStatus,
    isOffline,
    isOnline: !isOffline,
    refresh,
  };
}

export default useNetworkStatus;
