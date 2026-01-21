import { useQuery } from '@tanstack/react-query';
import { laboratoryApi } from '../services/api';

export function useLabDashboard() {
  // Lab Stats
  const labStats = useQuery({
    queryKey: ['lab', 'stats'],
    queryFn: async () => {
      const response = await laboratoryApi.getStats();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Pending Orders
  const pendingOrders = useQuery({
    queryKey: ['lab', 'pending'],
    queryFn: async () => {
      const response = await laboratoryApi.getPendingOrders();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Critical Results
  const criticalResults = useQuery({
    queryKey: ['lab', 'critical'],
    queryFn: async () => {
      const response = await laboratoryApi.getCriticalResults();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Pending Samples
  const pendingSamples = useQuery({
    queryKey: ['lab', 'pendingSamples'],
    queryFn: async () => {
      const response = await laboratoryApi.getPendingSamples();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const isLoading = labStats.isLoading;

  const refetchAll = () => {
    labStats.refetch();
    pendingOrders.refetch();
    criticalResults.refetch();
    pendingSamples.refetch();
  };

  return {
    labStats: labStats.data,
    pendingOrders: pendingOrders.data,
    criticalResults: criticalResults.data,
    pendingSamples: pendingSamples.data,
    isLoading,
    errors: {
      labStats: labStats.error,
      pendingOrders: pendingOrders.error,
      criticalResults: criticalResults.error,
    },
    refetchAll,
  };
}
