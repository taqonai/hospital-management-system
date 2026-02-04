import { useQuery } from '@tanstack/react-query';
import { reportsApi, appointmentApi } from '../services/api';

export function useAdminDashboard() {
  // Executive summary (includes KPI trends)
  const executiveSummary = useQuery({
    queryKey: ['admin', 'executiveSummary'],
    queryFn: async () => {
      const response = await reportsApi.getExecutiveSummary();
      return response.data.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // Weekly activity (appointments per day for last 7 days)
  const weeklyActivity = useQuery({
    queryKey: ['admin', 'weeklyActivity'],
    queryFn: async () => {
      const response = await reportsApi.getPatientTrends('daily', 0, 7);
      return response.data.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // Today's appointments list
  const todayAppointments = useQuery({
    queryKey: ['admin', 'todayAppointments'],
    queryFn: async () => {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const response = await appointmentApi.getAll({ date: today, limit: 10 });
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Today's stats
  const todayStats = useQuery({
    queryKey: ['admin', 'todayStats'],
    queryFn: async () => {
      const response = await appointmentApi.getDashboardStats();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Department performance (for pie chart)
  const departmentPerformance = useQuery({
    queryKey: ['admin', 'departmentPerformance'],
    queryFn: async () => {
      const response = await reportsApi.getDepartmentPerformance();
      return response.data.data;
    },
    staleTime: 300000,
  });

  // Bed occupancy
  const bedOccupancy = useQuery({
    queryKey: ['admin', 'bedOccupancy'],
    queryFn: async () => {
      const response = await reportsApi.getBedOccupancy();
      return response.data.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const isLoading =
    executiveSummary.isLoading ||
    todayStats.isLoading ||
    weeklyActivity.isLoading;

  const refetchAll = () => {
    executiveSummary.refetch();
    departmentPerformance.refetch();
    bedOccupancy.refetch();
    todayStats.refetch();
    weeklyActivity.refetch();
    todayAppointments.refetch();
  };

  return {
    executiveSummary: executiveSummary.data,
    departmentPerformance: departmentPerformance.data,
    bedOccupancy: bedOccupancy.data,
    todayStats: todayStats.data,
    weeklyActivity: weeklyActivity.data,
    todayAppointments: todayAppointments.data,
    isLoading,
    errors: {
      executiveSummary: executiveSummary.error,
      departmentPerformance: departmentPerformance.error,
      bedOccupancy: bedOccupancy.error,
      todayStats: todayStats.error,
      weeklyActivity: weeklyActivity.error,
      todayAppointments: todayAppointments.error,
    },
    refetchAll,
  };
}
