import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getApiError } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import type { LoginInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput } from '@resumeiq/shared';

export function useMe() {
  const { isAuthenticated } = useAuthStore();
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get('/auth/me');
      return data.data;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });
}

export function useLogin() {
  const { login } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (credentials: LoginInput) => {
      const { data } = await api.post('/auth/login', credentials);
      return data.data;
    },
    onSuccess: (data) => {
      login(data.user, data.accessToken);
      toast.success(`Welcome back, ${data.user.firstName}!`);
      navigate('/dashboard');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
}

export function useRegister() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (data: RegisterInput) => {
      const res = await api.post('/auth/register', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Account created! Please check your email to verify.');
      navigate('/login?registered=true');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      logout();
      queryClient.clear();
      navigate('/');
    },
    onError: () => {
      logout();
      queryClient.clear();
      navigate('/');
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput) => {
      const { data } = await api.post('/auth/forgot-password', input);
      return data;
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
}

export function useResetPassword() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      const { data } = await api.post('/auth/reset-password', input);
      return data;
    },
    onSuccess: () => {
      toast.success('Password reset successfully. Please log in.');
      navigate('/login');
    },
    onError: (err) => {
      toast.error(getApiError(err));
    },
  });
}
