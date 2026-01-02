import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { RootState, AppDispatch } from '../store';
import { setCredentials, logout as logoutAction, setLoading } from '../store/authSlice';
import { authApi } from '../services/api';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useSelector(
    (state: RootState) => state.auth
  );

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onMutate: () => {
      dispatch(setLoading(true));
    },
    onSuccess: (response) => {
      const { user, tokens } = response.data.data;
      dispatch(
        setCredentials({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        })
      );
      toast.success('Login successful!');
      navigate('/dashboard');
    },
    onError: (error: any) => {
      dispatch(setLoading(false));
      toast.error(error.response?.data?.message || 'Login failed');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      dispatch(logoutAction());
      toast.success('Logged out successfully');
      navigate('/login');
    },
    onError: () => {
      dispatch(logoutAction());
      navigate('/login');
    },
  });

  const login = (email: string, password: string) => {
    loginMutation.mutate({ email, password });
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  const hasRole = (roles: string | string[]) => {
    if (!user) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.role);
  };

  const isAdmin = () => hasRole(['SUPER_ADMIN', 'HOSPITAL_ADMIN']);
  const isDoctor = () => hasRole('DOCTOR');
  const isNurse = () => hasRole('NURSE');
  const isClinicalStaff = () => hasRole(['DOCTOR', 'NURSE']);

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    hasRole,
    isAdmin,
    isDoctor,
    isNurse,
    isClinicalStaff,
    loginMutation,
    logoutMutation,
  };
};

export default useAuth;
