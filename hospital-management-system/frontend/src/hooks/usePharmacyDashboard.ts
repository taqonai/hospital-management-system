import { useQuery } from '@tanstack/react-query';
import { pharmacyApi } from '../services/api';

export function usePharmacyDashboard() {
  // Pharmacy Stats
  const pharmacyStats = useQuery({
    queryKey: ['pharmacy', 'stats'],
    queryFn: async () => {
      const response = await pharmacyApi.getStats();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Pending Prescriptions
  const pendingPrescriptions = useQuery({
    queryKey: ['pharmacy', 'pending'],
    queryFn: async () => {
      const response = await pharmacyApi.getPendingPrescriptions();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Low Stock Items
  const lowStock = useQuery({
    queryKey: ['pharmacy', 'lowStock'],
    queryFn: async () => {
      const response = await pharmacyApi.getLowStock();
      return response.data.data;
    },
    staleTime: 60000,
  });

  // Expiring Items
  const expiring = useQuery({
    queryKey: ['pharmacy', 'expiring'],
    queryFn: async () => {
      const response = await pharmacyApi.getExpiring(30);
      return response.data.data;
    },
    staleTime: 300000,
  });

  const isLoading = pharmacyStats.isLoading;

  const refetchAll = () => {
    pharmacyStats.refetch();
    pendingPrescriptions.refetch();
    lowStock.refetch();
    expiring.refetch();
  };

  return {
    pharmacyStats: pharmacyStats.data,
    pendingPrescriptions: pendingPrescriptions.data,
    lowStock: lowStock.data,
    expiring: expiring.data,
    isLoading,
    errors: {
      pharmacyStats: pharmacyStats.error,
      pendingPrescriptions: pendingPrescriptions.error,
      lowStock: lowStock.error,
    },
    refetchAll,
  };
}
