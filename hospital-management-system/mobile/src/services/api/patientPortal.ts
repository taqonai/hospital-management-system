import api from './client';
import {
  ApiResponse,
  DashboardSummary,
  Appointment,
  MedicalRecord,
  Prescription,
  LabResult,
  Bill,
  HealthInsight,
  MedicalHistory,
  Allergy,
  ImmunizationRecord,
  PastSurgeryRecord,
  InsurancePolicy,
  InsuranceFormData,
  InsuranceClaim,
  Doctor,
  Department,
  TimeSlot,
} from '../../types';

export const patientPortalApi = {
  // Dashboard
  getSummary: async () => {
    const response = await api.get<ApiResponse<any>>('/patient-portal/summary');
    const raw = response.data?.data || response.data;

    // Transform backend response to expected DashboardSummary format
    // Backend returns: { upcomingAppointments: [{date, time, doctorName, status}], activePrescriptions, pendingLabResults }
    // We need: { upcomingAppointments: [{appointmentDate, startTime, doctor:{user:{}}}], quickStats:{} }
    const transformed: DashboardSummary = {
      upcomingAppointments: (raw?.upcomingAppointments || []).map((apt: any) => ({
        id: apt.id,
        appointmentDate: apt.appointmentDate || apt.date,
        startTime: apt.startTime || apt.time,
        endTime: apt.endTime,
        type: apt.type,
        reason: apt.reason,
        status: apt.status,
        doctor: apt.doctor || {
          user: {
            firstName: apt.doctorName?.replace('Dr. ', '').split(' ')[0] || '',
            lastName: apt.doctorName?.replace('Dr. ', '').split(' ').slice(1).join(' ') || '',
          },
          specialization: apt.doctorSpecialty || '',
          department: { id: '', name: apt.departmentName || '' },
        },
      })),
      recentPrescriptions: raw?.recentPrescriptions || [],
      pendingLabResults: raw?.pendingLabResults || [],
      pendingBills: raw?.pendingBills || [],
      healthScore: raw?.healthScore,
      reminders: raw?.healthReminders?.map((r: string, i: number) => ({
        id: `reminder-${i}`,
        type: 'FOLLOW_UP' as const,
        title: 'Health Reminder',
        description: r,
        dueDate: new Date().toISOString(),
        isRead: false,
      })) || [],
      quickStats: {
        // Use totalUpcomingAppointments from backend (accurate count), fallback to array length
        totalAppointments: raw?.totalUpcomingAppointments ?? raw?.upcomingAppointments?.length ?? 0,
        activePrescriptions: raw?.activePrescriptions || 0,
        pendingLabs: typeof raw?.pendingLabResults === 'number' ? raw.pendingLabResults : (raw?.pendingLabResults?.length || 0),
        unreadMessages: raw?.unreadMessages || 0,
      },
    };

    return { ...response, data: { ...response.data, data: transformed } };
  },

  // Appointments
  getAppointments: (params?: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) =>
    api.get<ApiResponse<Appointment[]>>('/patient-portal/appointments', { params }),

  getAppointmentById: (id: string) =>
    api.get<ApiResponse<Appointment>>(`/patient-portal/appointments/${id}`),

  bookAppointment: (data: {
    doctorId: string;
    appointmentDate: string;
    startTime: string;
    type: string;
    reason?: string;
  }) =>
    api.post<ApiResponse<Appointment>>('/patient-portal/appointments', data),

  cancelAppointment: (id: string, reason?: string) =>
    api.post<ApiResponse<Appointment>>(`/patient-portal/appointments/${id}/cancel`, { reason }),

  rescheduleAppointment: (id: string, data: { appointmentDate: string; startTime: string }) =>
    api.put<ApiResponse<Appointment>>(`/patient-portal/appointments/${id}/reschedule`, data),

  getAvailableSlots: (doctorId: string, date: string) =>
    api.get<ApiResponse<TimeSlot[]>>(`/patient-portal/doctors/${doctorId}/slots`, { params: { date } }),

  // Doctors and Departments
  getDoctors: (params?: { departmentId?: string; search?: string }) =>
    api.get<ApiResponse<Doctor[]>>('/patient-portal/doctors', { params }),

  getDepartments: () =>
    api.get<ApiResponse<Department[]>>('/patient-portal/departments'),

  // Medical Records
  getMedicalRecords: (params?: {
    type?: string;
    visitType?: string;
    search?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) =>
    api.get<ApiResponse<MedicalRecord[]>>('/patient-portal/records', { params }),

  getMedicalRecordById: (id: string) =>
    api.get<ApiResponse<MedicalRecord>>(`/patient-portal/records/${id}`),

  // Prescriptions
  getPrescriptions: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<Prescription[]>>('/patient-portal/prescriptions', { params }),

  getPrescriptionById: (id: string) =>
    api.get<ApiResponse<Prescription>>(`/patient-portal/prescriptions/${id}`),

  requestRefill: (id: string) =>
    api.post<ApiResponse<{ message: string }>>(`/patient-portal/prescriptions/${id}/refill`),

  // Lab Results
  getLabResults: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<LabResult[]>>('/patient-portal/labs', { params }),

  getLabResultById: (id: string) =>
    api.get<ApiResponse<LabResult>>(`/patient-portal/labs/${id}`),

  // Billing
  getBillingSummary: () =>
    api.get<ApiResponse<{ totalDue: number; lastPaymentDate?: string; pendingBills: number }>>('/patient-portal/billing/summary'),

  getBills: (params?: { type?: 'pending' | 'history' | 'all'; page?: number; limit?: number }) =>
    api.get<ApiResponse<Bill[]>>('/patient-portal/bills', { params }),

  getBillById: (id: string) =>
    api.get<ApiResponse<Bill>>(`/patient-portal/bills/${id}`),

  // Health Insights
  getHealthInsights: () =>
    api.get<ApiResponse<HealthInsight>>('/patient-portal/health-insights'),

  // AI Chat
  aiChat: (data: { message: string; context?: string; history?: any[] }) =>
    api.post<ApiResponse<{ response: string; suggestions?: string[] }>>('/patient-portal/ai-chat', data),

  // Medical History
  getMedicalHistory: () =>
    api.get<ApiResponse<MedicalHistory>>('/patient-portal/medical-history'),

  updateMedicalHistory: (data: Partial<MedicalHistory>) =>
    api.put<ApiResponse<MedicalHistory>>('/patient-portal/medical-history', data),

  analyzeMedicalHistory: () =>
    api.post<ApiResponse<{ insights: string[]; recommendations: string[] }>>('/patient-portal/medical-history/ai-analyze'),

  // Allergies
  getAllergies: () =>
    api.get<ApiResponse<Allergy[]>>('/patient-portal/allergies'),

  addAllergy: (data: Omit<Allergy, 'id'>) =>
    api.post<ApiResponse<Allergy>>('/patient-portal/allergies', data),

  updateAllergy: (id: string, data: Partial<Allergy>) =>
    api.put<ApiResponse<Allergy>>(`/patient-portal/allergies/${id}`, data),

  deleteAllergy: (id: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/patient-portal/allergies/${id}`),

  suggestAllergies: (symptoms?: string) =>
    api.post<ApiResponse<{ suggestions: Array<{
      allergen: string;
      type: 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER';
      confidence: number;
      reason: string;
    }> }>>('/patient-portal/allergies/ai-suggest', { symptoms }),

  // Immunizations
  getImmunizations: () =>
    api.get<ApiResponse<ImmunizationRecord[]>>('/patient-portal/immunizations'),

  addImmunization: (data: Omit<ImmunizationRecord, 'id'>) =>
    api.post<ApiResponse<ImmunizationRecord>>('/patient-portal/immunizations', data),

  updateImmunization: (id: string, data: Partial<ImmunizationRecord>) =>
    api.put<ApiResponse<ImmunizationRecord>>(`/patient-portal/immunizations/${id}`, data),

  deleteImmunization: (id: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/patient-portal/immunizations/${id}`),

  // Past Surgeries
  getPastSurgeries: () =>
    api.get<ApiResponse<PastSurgeryRecord[]>>('/patient-portal/past-surgeries'),

  addPastSurgery: (data: Omit<PastSurgeryRecord, 'id'>) =>
    api.post<ApiResponse<PastSurgeryRecord>>('/patient-portal/past-surgeries', data),

  updatePastSurgery: (id: string, data: Partial<PastSurgeryRecord>) =>
    api.put<ApiResponse<PastSurgeryRecord>>(`/patient-portal/past-surgeries/${id}`, data),

  deletePastSurgery: (id: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/patient-portal/past-surgeries/${id}`),

  // Insurance
  getInsurance: () =>
    api.get<ApiResponse<InsurancePolicy[]>>('/patient-portal/insurance'),

  addInsurance: (data: InsuranceFormData) =>
    api.post<ApiResponse<InsurancePolicy>>('/patient-portal/insurance', data),

  updateInsurance: (id: string, data: InsuranceFormData) =>
    api.put<ApiResponse<InsurancePolicy>>(`/patient-portal/insurance/${id}`, data),

  deleteInsurance: (id: string) =>
    api.delete<ApiResponse<{ message: string }>>(`/patient-portal/insurance/${id}`),

  setPrimaryInsurance: (id: string) =>
    api.put<ApiResponse<InsurancePolicy>>(`/patient-portal/insurance/${id}/primary`),

  // Insurance Claims
  getInsuranceClaims: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get<ApiResponse<InsuranceClaim[]>>('/patient-portal/insurance/claims', { params }),

  // Settings
  getNotificationPreferences: () =>
    api.get<ApiResponse<{
      appointmentReminders: boolean;
      labResultsReady: boolean;
      prescriptionReminders: boolean;
      healthTips: boolean;
      billingAlerts: boolean;
    }>>('/patient-portal/settings/notifications'),

  updateNotificationPreferences: (data: {
    appointmentReminders?: boolean;
    labResultsReady?: boolean;
    prescriptionReminders?: boolean;
    healthTips?: boolean;
    billingAlerts?: boolean;
  }) =>
    api.put<ApiResponse<any>>('/patient-portal/settings/notifications', data),

  getCommunicationPreferences: () =>
    api.get<ApiResponse<{
      emailNotifications: boolean;
      smsNotifications: boolean;
      pushNotifications: boolean;
      preferredLanguage: string;
    }>>('/patient-portal/settings/communication'),

  updateCommunicationPreferences: (data: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    pushNotifications?: boolean;
    preferredLanguage?: string;
  }) =>
    api.put<ApiResponse<any>>('/patient-portal/settings/communication', data),

  // Push Notifications
  registerPushToken: (token: string, platform?: 'ios' | 'android') =>
    api.post<ApiResponse<{ success: boolean }>>('/patient-portal/settings/push-token', {
      token,
      platform: platform || (require('react-native').Platform.OS as 'ios' | 'android'),
    }),

  unregisterPushToken: () =>
    api.delete<ApiResponse<{ success: boolean }>>('/patient-portal/settings/push-token'),

  // Messages
  getMessages: (params?: { status?: 'unread' | 'read' | 'all'; page?: number; limit?: number }) =>
    api.get<ApiResponse<MessageThread[]>>('/patient-portal/messages', { params }),

  getThread: (threadId: string) =>
    api.get<ApiResponse<MessageThread>>(`/patient-portal/messages/thread/${threadId}`),

  sendMessage: (data: { recipientId: string; subject: string; body: string; threadId?: string }) =>
    api.post<ApiResponse<Message>>('/patient-portal/messages', data),

  markAsRead: (messageId: string) =>
    api.put<ApiResponse<Message>>(`/patient-portal/messages/${messageId}/read`),

  deleteMessage: (messageId: string) =>
    api.delete<ApiResponse<void>>(`/patient-portal/messages/${messageId}`),

  getUnreadCount: () =>
    api.get<ApiResponse<{ count: number }>>('/patient-portal/messages/unread-count'),

  getProviders: () =>
    api.get<ApiResponse<MessageProvider[]>>('/patient-portal/messages/providers'),
};

// Message types
export interface Message {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: 'patient' | 'doctor' | 'nurse' | 'staff';
  senderAvatar?: string;
  recipientId: string;
  recipientName: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
  }>;
}

export interface MessageThread {
  id: string;
  subject: string;
  participants: Array<{
    id: string;
    name: string;
    role: string;
    avatar?: string;
  }>;
  messages: Message[];
  lastMessage?: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessageProvider {
  id: string;
  name: string;
  role: string;
  department?: string;
  avatar?: string;
  isAvailable: boolean;
}

export default patientPortalApi;
