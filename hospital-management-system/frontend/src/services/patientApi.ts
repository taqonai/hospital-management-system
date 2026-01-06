import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = '/api/v1';

// Separate axios instance for patient portal (uses patient tokens, not staff tokens)
export const patientApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - uses patient token from localStorage
patientApi.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('patientAccessToken');

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handles token refresh for patient tokens
patientApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('patientRefreshToken');

        if (!refreshToken) {
          // Clear patient tokens and redirect to patient login
          localStorage.removeItem('patientAccessToken');
          localStorage.removeItem('patientRefreshToken');
          localStorage.removeItem('patientUser');
          window.location.href = '/patient-portal/login';
          return Promise.reject(error);
        }

        const response = await axios.post(`${API_BASE_URL}/patient-auth/refresh-token`, {
          refreshToken,
        });

        const { accessToken } = response.data.data;

        localStorage.setItem('patientAccessToken', accessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        return patientApi(originalRequest);
      } catch (refreshError) {
        // Clear patient tokens and redirect to patient login
        localStorage.removeItem('patientAccessToken');
        localStorage.removeItem('patientRefreshToken');
        localStorage.removeItem('patientUser');
        window.location.href = '/patient-portal/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Patient Authentication APIs
export const patientAuthApi = {
  // Register new patient
  register: (data: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    mobile: string;
    dateOfBirth: string;
    gender: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    hospitalId?: string;
  }) => patientApi.post('/patient-auth/register', data),

  // Login with email/password
  login: (email: string, password: string) =>
    patientApi.post('/patient-auth/login', { email, password }),

  // Send OTP to mobile
  sendOTP: (mobile: string, hospitalId?: string) =>
    patientApi.post('/patient-auth/send-otp', { mobile, hospitalId }),

  // Verify OTP and login
  verifyOTP: (mobile: string, otp: string, hospitalId?: string) =>
    patientApi.post('/patient-auth/verify-otp', { mobile, otp, hospitalId }),

  // Send WhatsApp OTP
  sendWhatsAppOTP: (mobile: string, hospitalId?: string) =>
    patientApi.post('/patient-auth/send-whatsapp-otp', { mobile, hospitalId }),

  // Refresh token
  refreshToken: (refreshToken: string) =>
    patientApi.post('/patient-auth/refresh-token', { refreshToken }),

  // Get patient profile
  getProfile: () => patientApi.get('/patient-auth/profile'),

  // Update patient profile
  updateProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
  }) => patientApi.put('/patient-auth/profile', data),

  // Change password
  changePassword: (oldPassword: string, newPassword: string) =>
    patientApi.post('/patient-auth/change-password', { oldPassword, newPassword }),

  // Logout
  logout: () => patientApi.post('/patient-auth/logout'),
};

// Patient Portal Dashboard APIs
export const patientDashboardApi = {
  // Get dashboard summary
  getSummary: () => patientApi.get('/patient-portal/summary'),

  // Get upcoming appointments
  getUpcomingAppointments: (limit?: number) =>
    patientApi.get('/patient-portal/appointments', {
      params: { type: 'upcoming', limit: limit || 3 },
    }),

  // Get recent prescriptions
  getRecentPrescriptions: (limit?: number) =>
    patientApi.get('/patient-portal/prescriptions', {
      params: { status: 'active', limit: limit || 3 },
    }),

  // Get recent lab results
  getRecentLabResults: (limit?: number) =>
    patientApi.get('/patient-portal/labs', {
      params: { limit: limit || 3 },
    }),

  // Get outstanding bills summary
  getBillingSummary: () => patientApi.get('/patient-portal/billing/summary'),

  // Get health reminders
  getHealthReminders: () => patientApi.get('/patient-portal/reminders'),

  // Get unread messages count
  getUnreadMessagesCount: () => patientApi.get('/patient-portal/messages/unread-count'),
};

// Patient Appointments APIs
export const patientAppointmentsApi = {
  // Get all appointments
  getAll: (params?: {
    type?: 'upcoming' | 'past' | 'all';
    status?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) => patientApi.get('/patient-portal/appointments', { params }),

  // Get appointment by ID
  getById: (id: string) => patientApi.get(`/patient-portal/appointments/${id}`),

  // Book new appointment
  book: (data: {
    doctorId: string;
    departmentId: string;
    appointmentDate: string;
    startTime: string;
    type: string;
    reason?: string;
    notes?: string;
  }) => patientApi.post('/patient-portal/appointments', data),

  // Cancel appointment
  cancel: (id: string, reason?: string) =>
    patientApi.post(`/patient-portal/appointments/${id}/cancel`, { reason }),

  // Reschedule appointment
  reschedule: (id: string, data: { appointmentDate: string; startTime: string }) =>
    patientApi.post(`/patient-portal/appointments/${id}/reschedule`, data),

  // Get available time slots
  getAvailableSlots: (doctorId: string, date: string) =>
    patientApi.get(`/patient-portal/doctors/${doctorId}/slots`, { params: { date } }),

  // Get departments
  getDepartments: () => patientApi.get('/patient-portal/departments'),

  // Get doctors by department
  getDoctors: (params?: { departmentId?: string; search?: string }) =>
    patientApi.get('/patient-portal/doctors', { params }),
};

// Patient Medical Records APIs
export const patientMedicalRecordsApi = {
  // Get all medical records
  getAll: (params?: {
    type?: string;
    search?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    doctorId?: string;
    departmentId?: string;
  }) => patientApi.get('/patient-portal/records', { params }),

  // Get medical record by ID
  getById: (id: string) => patientApi.get(`/patient-portal/records/${id}`),

  // Download medical record as PDF
  download: (id: string) =>
    patientApi.get(`/patient-portal/records/${id}/download`, { responseType: 'blob' }),

  // Get health summary
  getHealthSummary: () => patientApi.get('/patient-portal/health-summary'),
};

// Patient Prescriptions APIs
export const patientPrescriptionsApi = {
  // Get all prescriptions
  getAll: (params?: {
    status?: 'active' | 'expired' | 'all';
    page?: number;
    limit?: number;
  }) => patientApi.get('/patient-portal/prescriptions', { params }),

  // Get prescription by ID
  getById: (id: string) => patientApi.get(`/patient-portal/prescriptions/${id}`),

  // Request prescription refill
  requestRefill: (id: string, notes?: string) =>
    patientApi.post(`/patient-portal/prescriptions/${id}/refill`, { notes }),

  // Get refill history
  getRefillHistory: (id: string) =>
    patientApi.get(`/patient-portal/prescriptions/${id}/refills`),
};

// Patient Lab Results APIs
export const patientLabResultsApi = {
  // Get all lab results
  getAll: (params?: {
    status?: 'ready' | 'pending' | 'all';
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) => patientApi.get('/patient-portal/labs', { params }),

  // Get lab result by ID
  getById: (id: string) => patientApi.get(`/patient-portal/labs/${id}`),

  // Download lab report as PDF
  download: (id: string) =>
    patientApi.get(`/patient-portal/labs/${id}/download`, { responseType: 'blob' }),

  // Get pending tests
  getPendingTests: () => patientApi.get('/patient-portal/labs/pending'),
};

// Patient Billing APIs
export const patientBillingApi = {
  // Get billing summary
  getSummary: () => patientApi.get('/patient-portal/billing/summary'),

  // Get all bills
  getAll: (params?: {
    type?: 'pending' | 'paid' | 'all';
    page?: number;
    limit?: number;
  }) => patientApi.get('/patient-portal/bills', { params }),

  // Get bill by ID
  getById: (id: string) => patientApi.get(`/patient-portal/bills/${id}`),

  // Make payment
  makePayment: (data: {
    billId: string;
    amount: number;
    paymentMethod: string;
    cardLast4?: string;
  }) => patientApi.post('/patient-portal/payments', data),

  // Get payment history
  getPaymentHistory: (params?: { page?: number; limit?: number }) =>
    patientApi.get('/patient-portal/payments', { params }),

  // Download invoice
  downloadInvoice: (billId: string) =>
    patientApi.get(`/patient-portal/bills/${billId}/download`, { responseType: 'blob' }),

  // Get insurance claims
  getInsuranceClaims: (params?: { status?: string; page?: number; limit?: number }) =>
    patientApi.get('/patient-portal/insurance-claims', { params }),
};

// Patient Messages APIs
export const patientMessagesApi = {
  // Get all messages
  getAll: (params?: {
    filter?: 'all' | 'unread';
    page?: number;
    limit?: number;
  }) => patientApi.get('/patient-portal/messages', { params }),

  // Get message thread
  getThread: (threadId: string) => patientApi.get(`/patient-portal/messages/${threadId}`),

  // Send message
  send: (data: {
    recipientId: string;
    subject: string;
    body: string;
    threadId?: string;
  }) => patientApi.post('/patient-portal/messages', data),

  // Mark message as read
  markRead: (threadId: string) =>
    patientApi.patch(`/patient-portal/messages/${threadId}/read`),

  // Mark message as unread
  markUnread: (threadId: string) =>
    patientApi.patch(`/patient-portal/messages/${threadId}/unread`),

  // Get providers (doctors) for messaging
  getProviders: (params?: { search?: string; departmentId?: string }) =>
    patientApi.get('/patient-portal/providers', { params }),

  // Get unread count
  getUnreadCount: () => patientApi.get('/patient-portal/messages/unread-count'),
};

// Patient Settings APIs
export const patientSettingsApi = {
  // Get notification preferences
  getNotificationPreferences: () =>
    patientApi.get('/patient-portal/settings/notifications'),

  // Update notification preferences
  updateNotificationPreferences: (data: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    whatsappNotifications?: boolean;
    appointmentReminders?: boolean;
    labResultsReady?: boolean;
    prescriptionRefills?: boolean;
    billingAlerts?: boolean;
  }) => patientApi.put('/patient-portal/settings/notifications', data),

  // Get communication preferences
  getCommunicationPreferences: () =>
    patientApi.get('/patient-portal/settings/communication'),

  // Update communication preferences
  updateCommunicationPreferences: (data: {
    preferredContactMethod?: 'email' | 'phone' | 'sms' | 'whatsapp';
    preferredLanguage?: string;
    preferredCallTime?: string;
  }) => patientApi.put('/patient-portal/settings/communication', data),
};

export default patientApi;
