import { useQuery } from '@tanstack/react-query';
import { billingApi, reportsApi } from '../services/api';

export function useAccountantDashboard() {
  // Billing Stats
  const billingStats = useQuery({
    queryKey: ['accountant', 'billingStats'],
    queryFn: async () => {
      const response = await billingApi.getStats();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Outstanding Payments
  const outstanding = useQuery({
    queryKey: ['accountant', 'outstanding'],
    queryFn: async () => {
      const response = await billingApi.getOutstanding();
      return response.data.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // Revenue Trends
  const revenueTrends = useQuery({
    queryKey: ['accountant', 'revenueTrends'],
    queryFn: async () => {
      const response = await reportsApi.getRevenueTrends(12);
      return response.data.data;
    },
    staleTime: 300000,
  });

  // Recent Invoices
  const recentInvoices = useQuery({
    queryKey: ['accountant', 'recentInvoices'],
    queryFn: async () => {
      const response = await billingApi.getInvoices({ limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
      return response.data.data;
    },
    staleTime: 60000,
  });

  // Claims
  const claims = useQuery({
    queryKey: ['accountant', 'claims'],
    queryFn: async () => {
      const response = await billingApi.getClaims({ limit: 10 });
      return response.data.data;
    },
    staleTime: 60000,
  });

  const isLoading = billingStats.isLoading;

  const refetchAll = () => {
    billingStats.refetch();
    outstanding.refetch();
    revenueTrends.refetch();
    recentInvoices.refetch();
    claims.refetch();
  };

  return {
    billingStats: billingStats.data,
    outstanding: outstanding.data,
    revenueTrends: revenueTrends.data,
    recentInvoices: recentInvoices.data,
    claims: claims.data,
    isLoading,
    errors: {
      billingStats: billingStats.error,
      outstanding: outstanding.error,
      revenueTrends: revenueTrends.error,
    },
    refetchAll,
  };
}
