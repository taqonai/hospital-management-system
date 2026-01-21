import { useQuery } from '@tanstack/react-query';
import { crmApi } from '../services/api';

export function useMarketingDashboard() {
  // Lead Stats
  const leadStats = useQuery({
    queryKey: ['marketing', 'leadStats'],
    queryFn: async () => {
      const response = await crmApi.getLeadStats();
      return response.data.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // Lead Conversion Report
  const leadConversion = useQuery({
    queryKey: ['marketing', 'leadConversion'],
    queryFn: async () => {
      const response = await crmApi.getLeadConversionReport();
      return response.data.data;
    },
    staleTime: 300000,
  });

  // CRM Dashboard
  const crmDashboard = useQuery({
    queryKey: ['marketing', 'dashboard'],
    queryFn: async () => {
      const response = await crmApi.getDashboard();
      return response.data.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // Recent Leads
  const recentLeads = useQuery({
    queryKey: ['marketing', 'recentLeads'],
    queryFn: async () => {
      const response = await crmApi.getLeads({ limit: 10, sortBy: 'createdAt', sortOrder: 'desc' });
      return response.data.data;
    },
    staleTime: 30000,
  });

  // Active Campaigns
  const campaigns = useQuery({
    queryKey: ['marketing', 'campaigns'],
    queryFn: async () => {
      const response = await crmApi.getCampaigns({ status: 'ACTIVE', limit: 5 });
      return response.data.data;
    },
    staleTime: 60000,
  });

  // Staff Performance
  const staffPerformance = useQuery({
    queryKey: ['marketing', 'staffPerformance'],
    queryFn: async () => {
      const response = await crmApi.getStaffPerformanceReport();
      return response.data.data;
    },
    staleTime: 300000,
  });

  // Overdue Tasks
  const overdueTasks = useQuery({
    queryKey: ['marketing', 'overdueTasks'],
    queryFn: async () => {
      const response = await crmApi.getOverdueTasks();
      return response.data.data;
    },
    staleTime: 60000,
  });

  const isLoading = leadStats.isLoading || crmDashboard.isLoading;

  const refetchAll = () => {
    leadStats.refetch();
    leadConversion.refetch();
    crmDashboard.refetch();
    recentLeads.refetch();
    campaigns.refetch();
    staffPerformance.refetch();
    overdueTasks.refetch();
  };

  return {
    leadStats: leadStats.data,
    leadConversion: leadConversion.data,
    crmDashboard: crmDashboard.data,
    recentLeads: recentLeads.data,
    campaigns: campaigns.data,
    staffPerformance: staffPerformance.data,
    overdueTasks: overdueTasks.data,
    isLoading,
    errors: {
      leadStats: leadStats.error,
      leadConversion: leadConversion.error,
      crmDashboard: crmDashboard.error,
    },
    refetchAll,
  };
}
