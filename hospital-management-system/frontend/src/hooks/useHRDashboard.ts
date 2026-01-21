import { useQuery } from '@tanstack/react-query';
import { hrApi } from '../services/api';

export function useHRDashboard() {
  // HR Dashboard Stats
  const dashboardStats = useQuery({
    queryKey: ['hr', 'dashboard'],
    queryFn: async () => {
      const response = await hrApi.getDashboard();
      return response.data.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // Pending Leave Requests
  const pendingLeaves = useQuery({
    queryKey: ['hr', 'pendingLeaves'],
    queryFn: async () => {
      const response = await hrApi.getLeaveRequests({ status: 'PENDING', limit: 10 });
      return response.data.data;
    },
    staleTime: 60000,
  });

  // Today's Attendance
  const todayAttendance = useQuery({
    queryKey: ['hr', 'attendance', 'today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await hrApi.getAttendance({ date: today });
      return response.data.data;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Employees
  const employees = useQuery({
    queryKey: ['hr', 'employees'],
    queryFn: async () => {
      const response = await hrApi.getEmployees({ limit: 100 });
      return response.data.data;
    },
    staleTime: 300000,
  });

  const isLoading = dashboardStats.isLoading;

  const refetchAll = () => {
    dashboardStats.refetch();
    pendingLeaves.refetch();
    todayAttendance.refetch();
    employees.refetch();
  };

  return {
    dashboardStats: dashboardStats.data,
    pendingLeaves: pendingLeaves.data,
    todayAttendance: todayAttendance.data,
    employees: employees.data,
    isLoading,
    errors: {
      dashboardStats: dashboardStats.error,
      pendingLeaves: pendingLeaves.error,
    },
    refetchAll,
  };
}
