import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { rbacApi } from '../services/api';

interface PermissionContextType {
  permissions: string[];
  loading: boolean;
  loaded: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  refetch: () => void;
}

const PermissionContext = createContext<PermissionContextType>({
  permissions: [],
  loading: false,
  loaded: false,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  refetch: () => {},
});

const STORAGE_KEY = 'rbac_permissions';
const STORAGE_USER_KEY = 'rbac_permissions_user';
const REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutes

function getStoredPermissions(userId: string): string[] | null {
  try {
    const storedUser = localStorage.getItem(STORAGE_USER_KEY);
    if (storedUser !== userId) return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function storePermissions(userId: string, permissions: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(permissions));
    localStorage.setItem(STORAGE_USER_KEY, userId);
  } catch {
    // localStorage might be full or disabled
  }
}

function clearStoredPermissions() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
  } catch {
    // ignore
  }
}

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setPermissions([]);
      setLoaded(false);
      clearStoredPermissions();
      return;
    }

    try {
      setLoading(true);
      const response = await rbacApi.getMyPermissions();
      const data = response.data?.data;
      const perms: string[] = Array.isArray(data?.permissions) ? data.permissions : [];
      setPermissions(perms);
      setLoaded(true);
      storePermissions(user.id, perms);
    } catch (error) {
      // On error, keep existing permissions (from localStorage or previous fetch)
      // This ensures the sidebar doesn't break if the API is temporarily down
      console.warn('Failed to fetch permissions, using cached data:', error);
      if (!loaded) {
        // Try loading from localStorage as fallback
        const stored = getStoredPermissions(user.id);
        if (stored) {
          setPermissions(stored);
          setLoaded(true);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, loaded]);

  // Hydrate from localStorage on mount / user change
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setPermissions([]);
      setLoaded(false);
      prevUserIdRef.current = null;
      return;
    }

    // If user changed, reset
    if (prevUserIdRef.current !== user.id) {
      prevUserIdRef.current = user.id;
      const stored = getStoredPermissions(user.id);
      if (stored) {
        setPermissions(stored);
        setLoaded(true);
      } else {
        setLoaded(false);
      }
      // Always fetch fresh permissions
      fetchPermissions();
    }
  }, [user, isAuthenticated, fetchPermissions]);

  // Re-fetch every 5 minutes
  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(fetchPermissions, REFETCH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, user, fetchPermissions]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      // SUPER_ADMIN has all permissions
      if (user.role === 'SUPER_ADMIN') return true;
      return permissions.includes(permission);
    },
    [permissions, user]
  );

  const hasAnyPermission = useCallback(
    (perms: string[]): boolean => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN') return true;
      return perms.some((p) => permissions.includes(p));
    },
    [permissions, user]
  );

  const hasAllPermissions = useCallback(
    (perms: string[]): boolean => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN') return true;
      return perms.every((p) => permissions.includes(p));
    },
    [permissions, user]
  );

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        loading,
        loaded,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        refetch: fetchPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

export default PermissionContext;
