import { useState, useEffect, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { offlineActionQueue, QueuedAction } from '../services/offline';

interface UseOfflineDataOptions<T> {
  fetcher: (forceRefresh?: boolean) => Promise<{
    data: T;
    isFromCache: boolean;
    isStale: boolean;
  }>;
  enabled?: boolean;
  refetchOnMount?: boolean;
  refetchOnReconnect?: boolean;
}

interface UseOfflineDataResult<T> {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  isFromCache: boolean;
  isStale: boolean;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching data with offline support
 * Automatically handles caching and stale data display
 */
export function useOfflineData<T>({
  fetcher,
  enabled = true,
  refetchOnMount = true,
  refetchOnReconnect = true,
}: UseOfflineDataOptions<T>): UseOfflineDataResult<T> {
  const { isOnline } = useNetworkStatus();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  const fetchData = useCallback(
    async (forceRefresh = false) => {
      try {
        setError(null);
        const result = await fetcher(forceRefresh);
        setData(result.data);
        setIsFromCache(result.isFromCache);
        setIsStale(result.isStale);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      }
    },
    [fetcher]
  );

  // Initial fetch
  useEffect(() => {
    if (!enabled) return;

    const load = async () => {
      setIsLoading(true);
      await fetchData(false);
      setIsLoading(false);
    };

    if (refetchOnMount) {
      load();
    }
  }, [enabled, fetchData, refetchOnMount]);

  // Refetch when coming back online
  useEffect(() => {
    if (!enabled || !refetchOnReconnect) return;

    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline && isOnline) {
      setWasOffline(false);
      fetchData(true);
    }
  }, [isOnline, wasOffline, enabled, refetchOnReconnect, fetchData]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchData(true);
    setIsLoading(false);
  }, [fetchData]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchData(true);
    setIsRefreshing(false);
  }, [fetchData]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    isFromCache,
    isStale,
    refetch,
    refresh,
  };
}

/**
 * Hook for managing the offline action queue
 */
export function useOfflineQueue() {
  const { isOnline } = useNetworkStatus();
  const [pendingActions, setPendingActions] = useState<QueuedAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadPendingActions = useCallback(async () => {
    const actions = await offlineActionQueue.getQueue();
    setPendingActions(actions);
  }, []);

  useEffect(() => {
    loadPendingActions();

    // Subscribe to queue changes
    const unsubscribe = offlineActionQueue.onProcessComplete(() => {
      loadPendingActions();
    });

    return unsubscribe;
  }, [loadPendingActions]);

  // Process queue when coming online
  useEffect(() => {
    if (isOnline && pendingActions.length > 0) {
      processQueue();
    }
  }, [isOnline]);

  const processQueue = useCallback(async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    try {
      await offlineActionQueue.tryProcessQueue();
    } finally {
      setIsProcessing(false);
      await loadPendingActions();
    }
  }, [isProcessing, loadPendingActions]);

  const clearQueue = useCallback(async () => {
    await offlineActionQueue.clearQueue();
    setPendingActions([]);
  }, []);

  const removeAction = useCallback(
    async (actionId: string) => {
      await offlineActionQueue.remove(actionId);
      await loadPendingActions();
    },
    [loadPendingActions]
  );

  const getActionDescription = useCallback((action: QueuedAction) => {
    return offlineActionQueue.getActionDescription(action);
  }, []);

  return {
    pendingActions,
    pendingCount: pendingActions.length,
    hasPendingActions: pendingActions.length > 0,
    isProcessing,
    processQueue,
    clearQueue,
    removeAction,
    getActionDescription,
  };
}

export default useOfflineData;
