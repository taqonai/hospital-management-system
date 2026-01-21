import { useQuery } from '@tanstack/react-query';
import { opdApi, appointmentApi } from '../services/api';

export function useReceptionistDashboard() {
  // OPD Stats
  const opdStats = useQuery({
    queryKey: ['receptionist', 'opdStats'],
    queryFn: async () => {
      const response = await opdApi.getStats();
      return response.data.data;
    },
    staleTime: 15000,
    refetchInterval: 15000,
  });

  // Queue Display
  const queueDisplay = useQuery({
    queryKey: ['receptionist', 'queueDisplay'],
    queryFn: async () => {
      const response = await opdApi.getQueueDisplay();
      return response.data.data;
    },
    staleTime: 10000,
    refetchInterval: 10000,
  });

  // OPD Queue
  const opdQueue = useQuery({
    queryKey: ['receptionist', 'opdQueue'],
    queryFn: async () => {
      const response = await opdApi.getQueue();
      return response.data.data;
    },
    staleTime: 15000,
    refetchInterval: 15000,
  });

  // Today's Appointments
  const todayAppointments = useQuery({
    queryKey: ['receptionist', 'appointments', 'today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await appointmentApi.getAll({
        date: today,
        limit: 100,
      });
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const isLoading = opdStats.isLoading || queueDisplay.isLoading;

  const refetchAll = () => {
    opdStats.refetch();
    queueDisplay.refetch();
    opdQueue.refetch();
    todayAppointments.refetch();
  };

  return {
    opdStats: opdStats.data,
    queueDisplay: queueDisplay.data,
    opdQueue: opdQueue.data,
    todayAppointments: todayAppointments.data,
    isLoading,
    errors: {
      opdStats: opdStats.error,
      queueDisplay: queueDisplay.error,
      opdQueue: opdQueue.error,
      appointments: todayAppointments.error,
    },
    refetchAll,
  };
}
