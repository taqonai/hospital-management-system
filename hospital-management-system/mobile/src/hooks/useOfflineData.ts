import { useState, useEffect, useCallback, useRef } from 'react';
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

// Maximum time to wait for refresh before auto-resetting (safety mechanism)
const MAX_REFRESH_TIMEOUT = 10000; // 10 seconds

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

  // Refs to track ongoing operations and prevent race conditions
  const isRefreshingRef = useRef(false);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

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

  // Initial fetch - use ref to prevent re-running
  const hasFetched = useRef(false);
  useEffect(() => {
    if (!enabled || hasFetched.current) return;

    const load = async () => {
      hasFetched.current = true;
      setIsLoading(true);
      try {
        await fetchData(false);
      } finally {
        // Always stop loading, even if there's an error
        setIsLoading(false);
      }
    };

    if (refetchOnMount) {
      load();
    }
  }, [enabled, refetchOnMount]); // Removed fetchData from deps to prevent re-fetching

  // Refetch when coming back online (silent refresh without UI indicator)
  useEffect(() => {
    if (!enabled || !refetchOnReconnect) return;

    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline && isOnline) {
      setWasOffline(false);
      // Silent refresh - don't show refreshing indicator for background reconnection
      fetchData(true).catch(() => {
        // Silently handle errors for background refresh
      });
    }
  }, [isOnline, wasOffline, enabled, refetchOnReconnect, fetchData]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchData(true);
    } finally {
      // Always stop loading, even if there's an error
      setIsLoading(false);
    }
  }, [fetchData]);

  const refresh = useCallback(async () => {
    // Prevent multiple simultaneous refresh calls
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    // Safety timeout to prevent infinite refresh state
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      if (isRefreshingRef.current) {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
    }, MAX_REFRESH_TIMEOUT);

    try {
      await fetchData(true);
    } finally {
      // Clear the safety timeout since we completed normally
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      // Always stop refreshing, even if there's an error
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
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
