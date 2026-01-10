import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { logout as logoutAction } from '../store/authSlice';

/**
 * Hook for accessing authentication state and actions
 * Wraps Redux store for cleaner component usage
 */
export const useAuth = () => {
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, isLoading, error } = useAppSelector(
    (state) => state.auth
  );

  const logout = useCallback(() => {
    dispatch(logoutAction());
  }, [dispatch]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    logout,
  };
};

export default useAuth;
