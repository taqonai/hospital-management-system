import { useQuery } from '@tanstack/react-query';
import { reportsApi, appointmentApi, departmentApi } from '../services/api';

export function useAdminDashboard() {
  // Executive summary
  const executiveSummary = useQuery({
    queryKey: ['admin', 'executiveSummary'],
    queryFn: async () => {
      const response = await reportsApi.getExecutiveSummary();
      return response.data.data;
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 60000,
  });

  // Weekly activity (appointments per day)
  const weeklyActivity = useQuery({
    queryKey: ['admin', 'weeklyActivity'],
    queryFn: async () => {
      const response = await reportsApi.getPatientTrends('daily', 7);
      return response.data.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // Today's appointments list
  const todayAppointments = useQuery({
    queryKey: ['admin', 'todayAppointments'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await appointmentApi.getAll({ date: today, limit: 10 });
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Department stats for patient distribution
  const departmentStats = useQuery({
    queryKey: ['admin', 'departmentStats'],
    queryFn: async () => {
      const response = await departmentApi.getAll();
      return response.data.data;
    },
    staleTime: 300000,
  });

  // Patient trends (6 months)
  const patientTrends = useQuery({
    queryKey: ['admin', 'patientTrends'],
    queryFn: async () => {
      const response = await reportsApi.getPatientTrends('monthly', 6);
      return response.data.data;
    },
    staleTime: 300000, // 5 minutes
  });

  // Revenue trends (12 months)
  const revenueTrends = useQuery({
    queryKey: ['admin', 'revenueTrends'],
    queryFn: async () => {
      const response = await reportsApi.getRevenueTrends(12);
      return response.data.data;
    },
    staleTime: 300000,
  });

  // Revenue by category
  const revenueByCategory = useQuery({
    queryKey: ['admin', 'revenueByCategory'],
    queryFn: async () => {
      const response = await reportsApi.getRevenueAnalysis();
      return response.data.data;
    },
    staleTime: 300000,
  });

  // Department performance
  const departmentPerformance = useQuery({
    queryKey: ['admin', 'departmentPerformance'],
    queryFn: async () => {
      const response = await reportsApi.getDepartmentPerformance();
      return response.data.data;
    },
    staleTime: 300000,
  });

  // Patient demographics
  const patientDemographics = useQuery({
    queryKey: ['admin', 'patientDemographics'],
    queryFn: async () => {
      const response = await reportsApi.getPatientDemographics();
      return response.data.data;
    },
    staleTime: 600000, // 10 minutes
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

  // Today's stats (from existing API)
  const todayStats = useQuery({
    queryKey: ['admin', 'todayStats'],
    queryFn: async () => {
      const response = await appointmentApi.getDashboardStats();
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const isLoading =
    executiveSummary.isLoading ||
    patientTrends.isLoading ||
    revenueTrends.isLoading ||
    departmentPerformance.isLoading ||
    todayStats.isLoading ||
    weeklyActivity.isLoading;

  const refetchAll = () => {
    executiveSummary.refetch();
    patientTrends.refetch();
    revenueTrends.refetch();
    revenueByCategory.refetch();
    departmentPerformance.refetch();
    patientDemographics.refetch();
    bedOccupancy.refetch();
    todayStats.refetch();
    weeklyActivity.refetch();
    todayAppointments.refetch();
    departmentStats.refetch();
  };

  return {
    executiveSummary: executiveSummary.data,
    patientTrends: patientTrends.data,
    revenueTrends: revenueTrends.data,
    revenueByCategory: revenueByCategory.data,
    departmentPerformance: departmentPerformance.data,
    patientDemographics: patientDemographics.data,
    bedOccupancy: bedOccupancy.data,
    todayStats: todayStats.data,
    weeklyActivity: weeklyActivity.data,
    todayAppointments: todayAppointments.data,
    departmentStats: departmentStats.data,
    isLoading,
    errors: {
      executiveSummary: executiveSummary.error,
      patientTrends: patientTrends.error,
      revenueTrends: revenueTrends.error,
      revenueByCategory: revenueByCategory.error,
      departmentPerformance: departmentPerformance.error,
      patientDemographics: patientDemographics.error,
      bedOccupancy: bedOccupancy.error,
      todayStats: todayStats.error,
      weeklyActivity: weeklyActivity.error,
      todayAppointments: todayAppointments.error,
    },
    refetchAll,
  };
}
