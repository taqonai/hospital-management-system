import { useQuery } from '@tanstack/react-query';
import { opdApi, ipdApi } from '../services/api';

export function useNurseDashboard() {
  // OPD Stats
  const opdStats = useQuery({
    queryKey: ['nurse', 'opdStats'],
    queryFn: async () => {
      const response = await opdApi.getStats();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // OPD Queue (patients waiting for vitals)
  const opdQueue = useQuery({
    queryKey: ['nurse', 'opdQueue'],
    queryFn: async () => {
      const response = await opdApi.getQueue();
      return response.data.data;
    },
    staleTime: 15000,
    refetchInterval: 15000,
  });

  // IPD Deterioration Dashboard
  const deteriorationDashboard = useQuery({
    queryKey: ['nurse', 'deterioration'],
    queryFn: async () => {
      const response = await ipdApi.getDeteriorationDashboard();
      return response.data.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // IPD Stats
  const ipdStats = useQuery({
    queryKey: ['nurse', 'ipdStats'],
    queryFn: async () => {
      const response = await ipdApi.getStats();
      return response.data.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // High Risk Patients
  const highRiskPatients = useQuery({
    queryKey: ['nurse', 'highRisk'],
    queryFn: async () => {
      const response = await ipdApi.getHighRiskPatients();
      return response.data.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const isLoading = opdStats.isLoading || deteriorationDashboard.isLoading;

  const refetchAll = () => {
    opdStats.refetch();
    opdQueue.refetch();
    deteriorationDashboard.refetch();
    ipdStats.refetch();
    highRiskPatients.refetch();
  };

  return {
    opdStats: opdStats.data,
    opdQueue: opdQueue.data,
    deteriorationDashboard: deteriorationDashboard.data,
    ipdStats: ipdStats.data,
    highRiskPatients: highRiskPatients.data,
    isLoading,
    errors: {
      opdStats: opdStats.error,
      opdQueue: opdQueue.error,
      deterioration: deteriorationDashboard.error,
      ipdStats: ipdStats.error,
      highRisk: highRiskPatients.error,
    },
    refetchAll,
  };
}
