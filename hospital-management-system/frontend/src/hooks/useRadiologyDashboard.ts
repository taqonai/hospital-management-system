import { useQuery } from '@tanstack/react-query';
import { radiologyApi } from '../services/api';

export function useRadiologyDashboard() {
  // Radiology Stats
  const radiologyStats = useQuery({
    queryKey: ['radiology', 'stats'],
    queryFn: async () => {
      const response = await radiologyApi.getStats();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Worklist
  const worklist = useQuery({
    queryKey: ['radiology', 'worklist'],
    queryFn: async () => {
      const response = await radiologyApi.getWorklist();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Pending Reports
  const pendingReports = useQuery({
    queryKey: ['radiology', 'pendingReports'],
    queryFn: async () => {
      const response = await radiologyApi.getPendingReports();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const isLoading = radiologyStats.isLoading;

  const refetchAll = () => {
    radiologyStats.refetch();
    worklist.refetch();
    pendingReports.refetch();
  };

  return {
    radiologyStats: radiologyStats.data,
    worklist: worklist.data,
    pendingReports: pendingReports.data,
    isLoading,
    errors: {
      radiologyStats: radiologyStats.error,
      worklist: worklist.error,
      pendingReports: pendingReports.error,
    },
    refetchAll,
  };
}
