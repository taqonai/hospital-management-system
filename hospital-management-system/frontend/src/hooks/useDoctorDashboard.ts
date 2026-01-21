import { useQuery } from '@tanstack/react-query';
import { doctorApi, opdApi, appointmentApi } from '../services/api';

export function useDoctorDashboard(doctorId: string | undefined) {
  // Doctor's dashboard stats
  const dashboardStats = useQuery({
    queryKey: ['doctor', 'dashboard', doctorId],
    queryFn: async () => {
      if (!doctorId) return null;
      const response = await doctorApi.getDashboard(doctorId);
      return response.data.data;
    },
    enabled: !!doctorId,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Today's appointments for the doctor
  const todayAppointments = useQuery({
    queryKey: ['doctor', 'appointments', doctorId, 'today'],
    queryFn: async () => {
      if (!doctorId) return null;
      const today = new Date().toISOString().split('T')[0];
      const response = await appointmentApi.getAll({
        doctorId,
        date: today,
        limit: 50,
      });
      return response.data.data;
    },
    enabled: !!doctorId,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Current queue
  const currentQueue = useQuery({
    queryKey: ['doctor', 'queue', doctorId],
    queryFn: async () => {
      if (!doctorId) return null;
      const response = await opdApi.getQueue(doctorId);
      return response.data.data;
    },
    enabled: !!doctorId,
    staleTime: 15000,
    refetchInterval: 15000,
  });

  // Weekly appointments for trend chart
  const weeklyAppointments = useQuery({
    queryKey: ['doctor', 'weekly', doctorId],
    queryFn: async () => {
      if (!doctorId) return null;
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);

      const response = await appointmentApi.getAll({
        doctorId,
        startDate: weekAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
        limit: 200,
      });
      return response.data.data;
    },
    enabled: !!doctorId,
    staleTime: 300000,
  });

  const isLoading = dashboardStats.isLoading || todayAppointments.isLoading;

  const refetchAll = () => {
    dashboardStats.refetch();
    todayAppointments.refetch();
    currentQueue.refetch();
    weeklyAppointments.refetch();
  };

  return {
    stats: dashboardStats.data,
    todayAppointments: todayAppointments.data,
    currentQueue: currentQueue.data,
    weeklyAppointments: weeklyAppointments.data,
    isLoading,
    errors: {
      stats: dashboardStats.error,
      appointments: todayAppointments.error,
      queue: currentQueue.error,
    },
    refetchAll,
  };
}
