import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '../store';
import { updateTokens, logout } from '../store/authSlice';

const API_BASE_URL = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const state = store.getState();
    const token = state.auth.accessToken;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const state = store.getState();
        const refreshToken = state.auth.refreshToken;

        if (!refreshToken) {
          store.dispatch(logout());
          window.location.href = '/login';
          return Promise.reject(error);
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        store.dispatch(
          updateTokens({
            accessToken,
            refreshToken: newRefreshToken,
          })
        );

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        store.dispatch(logout());
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth APIs
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: any) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

// Patient APIs
export const patientApi = {
  getAll: (params?: any) => api.get('/patients', { params }),
  getById: (id: string) => api.get(`/patients/${id}`),
  getByMRN: (mrn: string) => api.get(`/patients/mrn/${mrn}`),
  create: (data: any) => api.post('/patients', data),
  update: (id: string, data: any) => api.put(`/patients/${id}`, data),
  delete: (id: string) => api.delete(`/patients/${id}`),
  getMedicalHistory: (id: string) => api.get(`/patients/${id}/medical-history`),
  updateMedicalHistory: (id: string, data: any) =>
    api.put(`/patients/${id}/medical-history`, data),
  addAllergy: (id: string, data: any) => api.post(`/patients/${id}/allergies`, data),
  removeAllergy: (patientId: string, allergyId: string) =>
    api.delete(`/patients/${patientId}/allergies/${allergyId}`),
  recordVitals: (id: string, data: any) => api.post(`/patients/${id}/vitals`, data),
  getVitals: (id: string, limit?: number) =>
    api.get(`/patients/${id}/vitals`, { params: { limit } }),
  addInsurance: (id: string, data: any) => api.post(`/patients/${id}/insurance`, data),
  getTimeline: (id: string) => api.get(`/patients/${id}/timeline`),
};

// Appointment APIs
export const appointmentApi = {
  getAll: (params?: any) => api.get('/appointments', { params }),
  getById: (id: string) => api.get(`/appointments/${id}`),
  create: (data: any) => api.post('/appointments', data),
  update: (id: string, data: any) => api.put(`/appointments/${id}`, data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/appointments/${id}/status`, { status }),
  cancel: (id: string, reason?: string) =>
    api.post(`/appointments/${id}/cancel`, { reason }),
  getSlots: (doctorId: string, date: string) =>
    api.get(`/appointments/slots/${doctorId}`, { params: { date } }),
  getQueue: (doctorId: string) => api.get(`/appointments/queue/${doctorId}`),
  getDashboardStats: (doctorId?: string) =>
    api.get('/appointments/stats/dashboard', { params: { doctorId } }),
};

// Doctor APIs
export const doctorApi = {
  getAll: (params?: any) => api.get('/doctors', { params }),
  getById: (id: string) => api.get(`/doctors/${id}`),
  create: (data: any) => api.post('/doctors', data),
  update: (id: string, data: any) => api.put(`/doctors/${id}`, data),
  delete: (id: string) => api.delete(`/doctors/${id}`),
  getSchedule: (id: string) => api.get(`/doctors/${id}/schedule`),
  updateSchedule: (id: string, schedules: any[]) =>
    api.put(`/doctors/${id}/schedule`, { schedules }),
  toggleAvailability: (id: string, isAvailable: boolean) =>
    api.patch(`/doctors/${id}/availability`, { isAvailable }),
  getDashboard: (id: string) => api.get(`/doctors/${id}/dashboard`),
};

// Department APIs
export const departmentApi = {
  getAll: () => api.get('/departments'),
  getById: (id: string) => api.get(`/departments/${id}`),
};

// AI APIs
export const aiApi = {
  // Health check
  getHealth: () => api.get('/ai/health'),

  // Chat endpoint
  chat: (data: { message: string; context?: Record<string, unknown> }) =>
    api.post('/ai/chat', data),

  // Voice command endpoint
  voiceCommand: (data: { transcript: string; context?: Record<string, unknown> }) =>
    api.post('/ai/voice-command', data),

  // Production endpoints (authenticated)
  analyzeDiagnosis: (data: {
    patientId?: string;
    symptoms: string[];
    patientAge?: number;
    gender?: string;
    medicalHistory?: string[];
    currentMedications?: string[];
    allergies?: string[];
  }) => api.post('/ai/diagnose', data),
  predictRisk: (data: {
    patientId?: string;
    predictionType: string;
    timeframe?: string;
    patientData?: {
      age?: number;
      gender?: string;
      chronicConditions?: string[];
      medications?: string[];
      recentAdmissions?: number;
      lengthOfStay?: number;
      vitals?: Record<string, any>;
    };
  }) => api.post('/ai/predict-risk', data),
  analyzeImage: (data: {
    imagingOrderId?: string;
    imageUrl: string;
    modalityType: string;
    bodyPart: string;
    patientAge?: number;
    patientGender?: string;
    clinicalHistory?: string;
  }) => api.post('/ai/analyze-image', data),
  getInsights: (patientId: string) => api.get(`/ai/insights/${patientId}`),
  provideFeedback: (type: string, id: string, feedback: any) =>
    api.post(`/ai/feedback/${type}/${id}`, feedback),

};

// Laboratory APIs
export const laboratoryApi = {
  // Lab Tests
  getTests: (params?: any) => api.get('/laboratory/tests', { params }),
  createTest: (data: any) => api.post('/laboratory/tests', data),
  getTestById: (id: string) => api.get(`/laboratory/tests/${id}`),
  updateTest: (id: string, data: any) => api.put(`/laboratory/tests/${id}`, data),
  // Lab Orders
  getOrders: (params?: any) => api.get('/laboratory/orders', { params }),
  createOrder: (data: any) => api.post('/laboratory/orders', data),
  getOrderById: (id: string) => api.get(`/laboratory/orders/${id}`),
  updateOrderStatus: (id: string, status: string) =>
    api.patch(`/laboratory/orders/${id}/status`, { status }),
  enterResult: (testId: string, data: any) => api.post(`/laboratory/results/${testId}`, data),
  verifyResult: (testId: string) => api.patch(`/laboratory/results/${testId}/verify`),
  getCriticalResults: () => api.get('/laboratory/critical'),
  getPendingOrders: () => api.get('/laboratory/pending'),
  getStats: () => api.get('/laboratory/stats'),
  // AI Smart Lab Features
  smartOrderRecommendation: (data: {
    symptoms?: string[];
    diagnosis?: string;
    chiefComplaint?: string;
    patientAge?: number;
    gender?: 'MALE' | 'FEMALE';
    existingConditions?: string[];
  }) => api.post('/laboratory/smart-order', data),
  interpretResult: (data: {
    testName: string;
    value: number;
    unit?: string;
    patientAge?: number;
    gender?: 'MALE' | 'FEMALE';
  }) => api.post('/laboratory/interpret-result', data),
};

// Pharmacy APIs
export const pharmacyApi = {
  // Drugs
  getDrugs: (params?: any) => api.get('/pharmacy/drugs', { params }),
  createDrug: (data: any) => api.post('/pharmacy/drugs', data),
  getDrugById: (id: string) => api.get(`/pharmacy/drugs/${id}`),
  updateDrug: (id: string, data: any) => api.put(`/pharmacy/drugs/${id}`, data),
  // Inventory
  addInventory: (data: any) => api.post('/pharmacy/inventory', data),
  updateInventoryQuantity: (id: string, quantity: number) =>
    api.patch(`/pharmacy/inventory/${id}/quantity`, { quantity }),
  getLowStock: (threshold?: number) => api.get('/pharmacy/low-stock', { params: { threshold } }),
  getExpiring: (days?: number) => api.get('/pharmacy/expiring', { params: { days } }),
  // Prescriptions
  getPendingPrescriptions: () => api.get('/pharmacy/prescriptions/pending'),
  dispenseMedication: (medicationId: string) => api.post(`/pharmacy/dispense/${medicationId}`),
  dispensePrescription: (prescriptionId: string) =>
    api.post(`/pharmacy/prescriptions/${prescriptionId}/dispense`),
  // Interactions
  checkInteractions: (drugIds: string[]) =>
    api.post('/pharmacy/interactions/check', { drugIds }),
  // AI-powered interaction analysis by drug names
  analyzeInteractions: (drugs: { name: string; genericName: string }[]) =>
    api.post('/pharmacy/interactions/analyze', { drugs }),
  // AI Dosage Calculator
  calculateDosage: (data: {
    drugName: string;
    indication: string;
    patientWeight?: number;
    patientAge?: number;
    renalFunction?: 'normal' | 'mild' | 'moderate' | 'severe' | 'dialysis';
    hepaticFunction?: 'normal' | 'mild' | 'moderate' | 'severe';
    isPregnant?: boolean;
    isBreastfeeding?: boolean;
  }) => api.post('/pharmacy/calculate-dosage', data),
  getStats: () => api.get('/pharmacy/stats'),
};

// IPD APIs
export const ipdApi = {
  // Wards
  getWards: () => api.get('/ipd/wards'),
  createWard: (data: any) => api.post('/ipd/wards', data),
  // Beds
  getBeds: (params?: any) => api.get('/ipd/beds', { params }),
  createBed: (data: any) => api.post('/ipd/beds', data),
  updateBedStatus: (id: string, status: string) =>
    api.patch(`/ipd/beds/${id}/status`, { status }),
  getAvailableBeds: (wardType?: string) =>
    api.get('/ipd/beds/available', { params: { wardType } }),
  // Admissions
  getAdmissions: (params?: any) => api.get('/ipd/admissions', { params }),
  createAdmission: (data: any) => api.post('/ipd/admissions', data),
  getAdmissionById: (id: string) => api.get(`/ipd/admissions/${id}`),
  updateAdmission: (id: string, data: any) => api.put(`/ipd/admissions/${id}`, data),
  transferBed: (id: string, newBedId: string) =>
    api.post(`/ipd/admissions/${id}/transfer`, { newBedId }),
  addNursingNote: (id: string, data: any) => api.post(`/ipd/admissions/${id}/nursing-notes`, data),
  discharge: (id: string, data: any) => api.post(`/ipd/admissions/${id}/discharge`, data),
  getStats: () => api.get('/ipd/stats'),
  getHighRiskPatients: () => api.get('/ipd/high-risk'),
  // Deterioration Monitoring (NEWS2)
  getDeteriorationDashboard: () => api.get('/ipd/deterioration-dashboard'),
  recordVitals: (admissionId: string, vitals: {
    respiratoryRate?: number;
    oxygenSaturation?: number;
    supplementalOxygen?: boolean;
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    heartRate?: number;
    temperature?: number;
    consciousness?: string;
  }) => api.post(`/ipd/admissions/${admissionId}/vitals`, vitals),
  calculateNEWS2: (vitals: {
    respiratoryRate?: number;
    oxygenSaturation?: number;
    supplementalOxygen?: boolean;
    bloodPressureSys?: number;
    heartRate?: number;
    temperature?: number;
    consciousness?: string;
  }) => api.post('/ipd/calculate-news2', vitals),
};

// OPD APIs
export const opdApi = {
  getQueue: (doctorId?: string) => api.get('/opd/queue', { params: { doctorId } }),
  checkIn: (appointmentId: string) => api.post(`/opd/check-in/${appointmentId}`),
  callNext: (doctorId: string) => api.post('/opd/call-next', { doctorId }),
  getCurrentToken: (doctorId: string) => api.get(`/opd/current-token/${doctorId}`),
  getWaitTime: (doctorId: string) => api.get(`/opd/wait-time/${doctorId}`),
  markNoShow: (appointmentId: string) => api.post(`/opd/no-show/${appointmentId}`),
  reschedule: (appointmentId: string, data: any) =>
    api.post(`/opd/reschedule/${appointmentId}`, data),
  getStats: () => api.get('/opd/stats'),
  getQueueDisplay: () => api.get('/opd/display'),
};

// Emergency APIs
export const emergencyApi = {
  registerPatient: (data: any) => api.post('/emergency/register', data),
  getPatients: () => api.get('/emergency/patients'),
  updateTriage: (appointmentId: string, esiLevel: number, notes?: string) =>
    api.patch(`/emergency/${appointmentId}/triage`, { esiLevel, notes }),
  assignDoctor: (appointmentId: string, doctorId: string) =>
    api.patch(`/emergency/${appointmentId}/assign-doctor`, { doctorId }),
  admit: (appointmentId: string, bedId: string) =>
    api.post(`/emergency/${appointmentId}/admit`, { bedId }),
  discharge: (appointmentId: string, notes?: string) =>
    api.post(`/emergency/${appointmentId}/discharge`, { notes }),
  getStats: () => api.get('/emergency/stats'),
  getResuscitation: () => api.get('/emergency/resuscitation'),
  // AI ESI Triage
  calculateESI: (data: {
    chiefComplaint: string;
    vitals?: {
      heartRate?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
      bloodPressureSys?: number;
      bloodPressureDia?: number;
      temperature?: number;
    };
    painScale?: number;
    mentalStatus?: 'alert' | 'voice' | 'pain' | 'unresponsive';
    age?: number;
    isPregnant?: boolean;
    symptoms?: string[];
  }) => api.post('/emergency/calculate-esi', data),
};

// Radiology APIs
export const radiologyApi = {
  getOrders: (params?: any) => api.get('/radiology/orders', { params }),
  createOrder: (data: any) => api.post('/radiology/orders', data),
  getOrderById: (id: string) => api.get(`/radiology/orders/${id}`),
  updateOrderStatus: (id: string, status: string) =>
    api.patch(`/radiology/orders/${id}/status`, { status }),
  scheduleStudy: (id: string, scheduledDate: string) =>
    api.patch(`/radiology/orders/${id}/schedule`, { scheduledDate }),
  createStudy: (orderId: string, data: any) => api.post(`/radiology/orders/${orderId}/study`, data),
  addReport: (studyId: string, data: any) => api.post(`/radiology/studies/${studyId}/report`, data),
  addAIAnalysis: (orderId: string, data: any) =>
    api.post(`/radiology/orders/${orderId}/ai-analysis`, data),
  reviewAIAnalysis: (analysisId: string, feedback?: string) =>
    api.patch(`/radiology/ai-analysis/${analysisId}/review`, { feedback }),
  getWorklist: (modalityType?: string) =>
    api.get('/radiology/worklist', { params: { modalityType } }),
  getPendingReports: () => api.get('/radiology/pending-reports'),
  getStats: () => api.get('/radiology/stats'),
};

// Surgery APIs
export const surgeryApi = {
  getAll: (params?: any) => api.get('/surgery', { params }),
  create: (data: any) => api.post('/surgery', data),
  getById: (id: string) => api.get(`/surgery/${id}`),
  updateStatus: (id: string, status: string, data?: any) =>
    api.patch(`/surgery/${id}/status`, { status, ...data }),
  start: (id: string) => api.post(`/surgery/${id}/start`),
  complete: (id: string, data: any) => api.post(`/surgery/${id}/complete`, data),
  cancel: (id: string, reason: string) => api.post(`/surgery/${id}/cancel`, { reason }),
  postpone: (id: string, newDate: string, reason?: string) =>
    api.post(`/surgery/${id}/postpone`, { newDate, reason }),
  getTodaySchedule: () => api.get('/surgery/schedule/today'),
  getOTStatus: () => api.get('/surgery/ot/status'),
  getPreOpChecklist: (id: string) => api.get(`/surgery/${id}/pre-op-checklist`),
  getStats: () => api.get('/surgery/stats/overview'),
  // AI Surgery Features
  predictDuration: (data: {
    procedureName: string;
    surgeryType: string;
    patientAge?: number;
    patientBMI?: number;
    isEmergency?: boolean;
    hasComorbidities?: boolean;
    previousSurgeries?: number;
    anesthesiaType?: string;
  }) => api.post('/surgery/predict-duration', data),
  assessRisk: (data: {
    procedureName: string;
    surgeryType: string;
    patientAge: number;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    asaScore?: number;
    bmi?: number;
    comorbidities?: string[];
    smokingStatus?: 'never' | 'former' | 'current';
    diabetesStatus?: 'none' | 'controlled' | 'uncontrolled';
    cardiacHistory?: boolean;
    renalFunction?: 'normal' | 'mild' | 'moderate' | 'severe' | 'dialysis';
    hepaticFunction?: 'normal' | 'mild' | 'moderate' | 'severe';
    isEmergency?: boolean;
    recentLabResults?: {
      hemoglobin?: number;
      platelets?: number;
      inr?: number;
      creatinine?: number;
      albumin?: number;
    };
  }) => api.post('/surgery/assess-risk', data),
};

// Billing APIs
export const billingApi = {
  // Invoices
  getInvoices: (params?: any) => api.get('/billing/invoices', { params }),
  createInvoice: (data: any) => api.post('/billing/invoices', data),
  getInvoiceById: (id: string) => api.get(`/billing/invoices/${id}`),
  cancelInvoice: (id: string) => api.delete(`/billing/invoices/${id}`),
  // Payments
  addPayment: (invoiceId: string, data: any) =>
    api.post(`/billing/invoices/${invoiceId}/payments`, data),
  // Claims
  getClaims: (params?: any) => api.get('/billing/claims', { params }),
  submitClaim: (invoiceId: string, data: any) =>
    api.post(`/billing/invoices/${invoiceId}/claims`, data),
  updateClaimStatus: (claimId: string, status: string, approvedAmount?: number) =>
    api.patch(`/billing/claims/${claimId}/status`, { status, approvedAmount }),
  // Reports
  getPatientStatement: (patientId: string) => api.get(`/billing/patients/${patientId}/statement`),
  getStats: () => api.get('/billing/stats'),
  getOutstanding: () => api.get('/billing/outstanding'),
  // AI Auto Charge Capture
  extractCharges: (notes: string) =>
    api.post('/billing/extract-charges', { notes }),
  suggestCodes: (data: {
    diagnosis?: string;
    procedures?: string[];
    isInpatient?: boolean;
    lengthOfStay?: number;
  }) => api.post('/billing/suggest-codes', data),
  estimateCost: (data: {
    procedureName: string;
    isInpatient?: boolean;
    expectedStay?: number;
    includeAnesthesia?: boolean;
    insuranceCoverage?: number;
  }) => api.post('/billing/estimate-cost', data),
};

// HR APIs
export const hrApi = {
  // Employees
  getEmployees: (params?: any) => api.get('/hr/employees', { params }),
  getEmployeeById: (id: string) => api.get(`/hr/employees/${id}`),
  createEmployee: (data: any) => api.post('/hr/employees', data),
  updateEmployee: (id: string, data: any) => api.put(`/hr/employees/${id}`, data),
  // Attendance
  checkIn: (employeeId: string, data?: any) => api.post('/hr/attendance/check-in', { employeeId, ...data }),
  checkOut: (employeeId: string, data?: any) => api.post('/hr/attendance/check-out', { employeeId, ...data }),
  getAttendance: (params?: any) => api.get('/hr/attendance', { params }),
  getAttendanceSummary: (employeeId: string, month?: number, year?: number) =>
    api.get(`/hr/attendance/summary/${employeeId}`, { params: { month, year } }),
  // Leave
  getLeaveTypes: () => api.get('/hr/leave-types'),
  createLeaveType: (data: any) => api.post('/hr/leave-types', data),
  applyLeave: (data: any) => api.post('/hr/leave/apply', data),
  processLeave: (id: string, action: string, rejectionReason?: string) =>
    api.patch(`/hr/leave/${id}/process`, { action, rejectionReason }),
  getLeaveRequests: (params?: any) => api.get('/hr/leave/requests', { params }),
  getLeaveBalance: (employeeId: string, year?: number) =>
    api.get(`/hr/leave/balance/${employeeId}`, { params: { year } }),
  // Payroll
  generatePayroll: (month: number, year: number) =>
    api.post('/hr/payroll/generate', { month, year }),
  getPayrolls: (params?: any) => api.get('/hr/payroll', { params }),
  processPayroll: (id: string, action: string, paymentMode?: string, transactionId?: string) =>
    api.patch(`/hr/payroll/${id}/process`, { action, paymentMode, transactionId }),
  // Shifts
  getShifts: () => api.get('/hr/shifts'),
  createShift: (data: any) => api.post('/hr/shifts', data),
  updateShift: (id: string, data: any) => api.put(`/hr/shifts/${id}`, data),
  assignShift: (employeeId: string, shiftId: string) =>
    api.post('/hr/shifts/assign', { employeeId, shiftId }),
  // Dashboard
  getDashboard: () => api.get('/hr/dashboard'),
};

// Housekeeping APIs
export const housekeepingApi = {
  // Zones
  getZones: () => api.get('/housekeeping/zones'),
  createZone: (data: any) => api.post('/housekeeping/zones', data),
  updateZone: (id: string, data: any) => api.put(`/housekeeping/zones/${id}`, data),
  // Tasks
  getTasks: (params?: any) => api.get('/housekeeping/tasks', { params }),
  getTaskById: (id: string) => api.get(`/housekeeping/tasks/${id}`),
  createTask: (data: any) => api.post('/housekeeping/tasks', data),
  updateTask: (id: string, data: any) => api.put(`/housekeeping/tasks/${id}`, data),
  assignTask: (id: string, employeeId: string, supervisorId?: string) =>
    api.post(`/housekeeping/tasks/${id}/assign`, { employeeId, supervisorId }),
  startTask: (id: string) => api.post(`/housekeeping/tasks/${id}/start`),
  completeTask: (id: string, data?: any) => api.post(`/housekeeping/tasks/${id}/complete`, data),
  verifyTask: (id: string, qualityScore: number) =>
    api.post(`/housekeeping/tasks/${id}/verify`, { qualityScore }),
  updateChecklistItem: (itemId: string, isCompleted: boolean, notes?: string) =>
    api.patch(`/housekeeping/tasks/checklist/${itemId}`, { isCompleted, notes }),
  getAIPrioritizedTasks: () => api.get('/housekeeping/tasks/ai/prioritized'),
  predictCleaningTime: (taskType: string, zoneId?: string) =>
    api.get('/housekeeping/tasks/ai/predict-time', { params: { taskType, zoneId } }),
  // Schedules
  getSchedules: (zoneId?: string) => api.get('/housekeeping/schedules', { params: { zoneId } }),
  createSchedule: (data: any) => api.post('/housekeeping/schedules', data),
  generateScheduledTasks: () => api.post('/housekeeping/schedules/generate-tasks'),
  // Inventory
  getInventory: (params?: any) => api.get('/housekeeping/inventory', { params }),
  getLowStockItems: () => api.get('/housekeeping/inventory/low-stock'),
  createInventoryItem: (data: any) => api.post('/housekeeping/inventory', data),
  updateInventoryStock: (id: string, quantity: number, action: string, taskId?: string, notes?: string) =>
    api.patch(`/housekeeping/inventory/${id}/stock`, { quantity, action, taskId, notes }),
  // Audits
  getAudits: (params?: any) => api.get('/housekeeping/audits', { params }),
  createAudit: (data: any) => api.post('/housekeeping/audits', data),
  resolveAudit: (id: string) => api.patch(`/housekeeping/audits/${id}/resolve`),
  // Checklists
  getChecklists: (taskType?: string) => api.get('/housekeeping/checklists', { params: { taskType } }),
  createChecklist: (data: any) => api.post('/housekeeping/checklists', data),
  updateChecklist: (id: string, data: any) => api.put(`/housekeeping/checklists/${id}`, data),
  // Dashboard
  getDashboard: () => api.get('/housekeeping/dashboard'),
};

// Blood Bank APIs
export const bloodBankApi = {
  // Donors
  registerDonor: (data: any) => api.post('/blood-bank/donors', data),
  getDonors: (params?: any) => api.get('/blood-bank/donors', { params }),
  getDonorById: (id: string) => api.get(`/blood-bank/donors/${id}`),
  checkEligibility: (data: any) => api.post('/blood-bank/donors/check-eligibility', data),
  // Donations
  recordDonation: (data: any) => api.post('/blood-bank/donations', data),
  getDonations: (params?: any) => api.get('/blood-bank/donations', { params }),
  updateTestResults: (id: string, data: any) =>
    api.patch(`/blood-bank/donations/${id}/test-results`, data),
  // Components
  processBloodComponents: (donationId: string, data: any) =>
    api.post(`/blood-bank/donations/${donationId}/process`, data),
  getInventory: (params?: any) => api.get('/blood-bank/inventory', { params }),
  // Requests
  createBloodRequest: (data: any) => api.post('/blood-bank/requests', data),
  getBloodRequests: (params?: any) => api.get('/blood-bank/requests', { params }),
  findCompatible: (requestId: string, data: any) =>
    api.post(`/blood-bank/requests/${requestId}/find-compatible`, data),
  performCrossMatch: (requestId: string, componentId: string, data: any) =>
    api.post(`/blood-bank/requests/${requestId}/crossmatch/${componentId}`, data),
  approveRequest: (id: string) => api.patch(`/blood-bank/requests/${id}/approve`),
  // Transfusion
  issueBlood: (requestId: string, componentId: string, data: any) =>
    api.post(`/blood-bank/requests/${requestId}/issue/${componentId}`, data),
  completeTransfusion: (id: string, data: any) =>
    api.patch(`/blood-bank/transfusions/${id}/complete`, data),
  recordReaction: (id: string, data: any) =>
    api.post(`/blood-bank/transfusions/${id}/reaction`, data),
  // AI Features
  smartBloodMatch: (data: any) => api.post('/blood-bank/ai/smart-match', data),
  predictDemand: (data: any) => api.post('/blood-bank/ai/predict-demand', data),
  predictReaction: (data: any) => api.post('/blood-bank/ai/predict-reaction', data),
  // Stats
  getStats: () => api.get('/blood-bank/stats'),
};

// Medical Records APIs
export const medicalRecordsApi = {
  // Documents
  uploadDocument: (data: any) => api.post('/medical-records/documents', data),
  getDocuments: (params?: any) => api.get('/medical-records/documents', { params }),
  getDocumentById: (id: string) => api.get(`/medical-records/documents/${id}`),
  verifyDocument: (id: string) => api.patch(`/medical-records/documents/${id}/verify`),
  smartSearch: (query: string, patientId?: string) =>
    api.post('/medical-records/documents/search', { query, patientId }),
  // Consents
  createConsent: (data: any) => api.post('/medical-records/consents', data),
  getPatientConsents: (patientId: string) =>
    api.get(`/medical-records/consents/patient/${patientId}`),
  signConsent: (id: string, data: any) =>
    api.patch(`/medical-records/consents/${id}/sign`, data),
  revokeConsent: (id: string, reason: string) =>
    api.patch(`/medical-records/consents/${id}/revoke`, { reason }),
  // Timeline & Summary
  getPatientTimeline: (patientId: string) =>
    api.get(`/medical-records/timeline/${patientId}`),
  getPatientSummary: (patientId: string) =>
    api.get(`/medical-records/summary/${patientId}`),
};

// Dietary APIs
export const dietaryApi = {
  // Diet Plans
  createDietPlan: (data: any) => api.post('/dietary/plans', data),
  getDietPlans: (params?: any) => api.get('/dietary/plans', { params }),
  getDietPlanById: (id: string) => api.get(`/dietary/plans/${id}`),
  updateDietPlan: (id: string, data: any) => api.put(`/dietary/plans/${id}`, data),
  // Patient Diets
  assignPatientDiet: (data: any) => api.post('/dietary/patient-diets', data),
  getPatientDiets: (params?: any) => api.get('/dietary/patient-diets', { params }),
  getPatientDietById: (id: string) => api.get(`/dietary/patient-diets/${id}`),
  updatePatientDiet: (id: string, data: any) =>
    api.patch(`/dietary/patient-diets/${id}`, data),
  // Meal Orders
  createMealOrder: (data: any) => api.post('/dietary/orders', data),
  getMealOrders: (params?: any) => api.get('/dietary/orders', { params }),
  updateMealOrderStatus: (id: string, status: string) =>
    api.patch(`/dietary/orders/${id}/status`, { status }),
  // AI Features
  getAIRecommendations: (data: any) => api.post('/dietary/ai/recommendations', data),
  suggestDietPlan: (data: any) => api.post('/dietary/ai/suggest-plan', data),
  analyzeNutritionIntake: (data: any) => api.post('/dietary/ai/analyze-intake', data),
  // Stats
  getStats: () => api.get('/dietary/stats'),
};

// Asset Management APIs
export const assetApi = {
  // Assets
  addAsset: (data: any) => api.post('/assets', data),
  getAssets: (params?: any) => api.get('/assets', { params }),
  getAssetById: (id: string) => api.get(`/assets/${id}`),
  updateAsset: (id: string, data: any) => api.put(`/assets/${id}`, data),
  updateAssetStatus: (id: string, status: string) =>
    api.patch(`/assets/${id}/status`, { status }),
  // Maintenance
  scheduleMaintenance: (assetId: string, data: any) =>
    api.post(`/assets/${assetId}/maintenance`, data),
  getMaintenanceRecords: (params?: any) => api.get('/assets/maintenance/all', { params }),
  startMaintenance: (id: string, technicianId: string) =>
    api.patch(`/assets/maintenance/${id}/start`, { technicianId }),
  completeMaintenance: (id: string, data: any) =>
    api.patch(`/assets/maintenance/${id}/complete`, data),
  // AI Features
  predictFailure: (data: any) => api.post('/assets/ai/predict-failure', data),
  optimizeSchedule: (data: any) => api.post('/assets/ai/optimize-schedule', data),
  analyzeLifecycle: (data: any) => api.post('/assets/ai/lifecycle-analysis', data),
  // Stats & Alerts
  getStats: () => api.get('/assets/stats/dashboard'),
  getCalibrationDue: (days?: number) =>
    api.get('/assets/calibration/due', { params: { days } }),
  getWarrantyExpiring: (days?: number) =>
    api.get('/assets/warranty/expiring', { params: { days } }),
};

// Ambulance APIs
export const ambulanceApi = {
  // Fleet
  addAmbulance: (data: any) => api.post('/ambulance', data),
  getAmbulances: (params?: any) => api.get('/ambulance', { params }),
  getAmbulanceById: (id: string) => api.get(`/ambulance/${id}`),
  updateAmbulanceStatus: (id: string, status: string) =>
    api.patch(`/ambulance/${id}/status`, { status }),
  updateAmbulanceLocation: (id: string, latitude: number, longitude: number) =>
    api.patch(`/ambulance/${id}/location`, { latitude, longitude }),
  // Trips
  createTrip: (data: any) => api.post('/ambulance/trips', data),
  getTrips: (params?: any) => api.get('/ambulance/trips', { params }),
  getTripById: (id: string) => api.get(`/ambulance/trips/${id}`),
  dispatchAmbulance: (tripId: string, data: any) =>
    api.post(`/ambulance/trips/${tripId}/dispatch`, data),
  updateTripStatus: (id: string, status: string, data?: any) =>
    api.patch(`/ambulance/trips/${id}/status`, { status, ...data }),
  completeTrip: (id: string, data: any) =>
    api.patch(`/ambulance/trips/${id}/complete`, data),
  cancelTrip: (id: string, reason: string) =>
    api.patch(`/ambulance/trips/${id}/cancel`, { reason }),
  // AI Features
  getOptimalAmbulance: (data: any) => api.post('/ambulance/ai/optimal-ambulance', data),
  optimizeDispatch: (data: any) => api.post('/ambulance/ai/optimize-dispatch', data),
  predictResponseTime: (data: any) => api.post('/ambulance/ai/predict-response', data),
  // Stats
  getStats: () => api.get('/ambulance/stats/dashboard'),
};

// CSSD APIs
export const cssdApi = {
  // Items
  addItem: (data: any) => api.post('/cssd/items', data),
  getItems: (params?: any) => api.get('/cssd/items', { params }),
  getItemById: (id: string) => api.get(`/cssd/items/${id}`),
  updateItemStatus: (id: string, status: string) =>
    api.patch(`/cssd/items/${id}/status`, { status }),
  trackItem: (barcode: string) => api.get(`/cssd/items/track/${barcode}`),
  // Cycles
  createCycle: (data: any) => api.post('/cssd/cycles', data),
  getCycles: (params?: any) => api.get('/cssd/cycles', { params }),
  getCycleById: (id: string) => api.get(`/cssd/cycles/${id}`),
  startCycle: (id: string) => api.patch(`/cssd/cycles/${id}/start`),
  completeCycle: (id: string, data: any) => api.patch(`/cssd/cycles/${id}/complete`, data),
  // Alerts
  getExpiringItems: (days?: number) => api.get('/cssd/expiring', { params: { days } }),
  // AI Features
  predictOutcome: (data: any) => api.post('/cssd/ai/predict-outcome', data),
  optimizeSchedule: (data: any) => api.post('/cssd/ai/optimize-schedule', data),
  analyzeQuality: (data: any) => api.post('/cssd/ai/quality-analysis', data),
  // Stats
  getStats: () => api.get('/cssd/stats'),
};

// Mortuary APIs
export const mortuaryApi = {
  // Records
  registerDeath: (data: any) => api.post('/mortuary/records', data),
  getRecords: (params?: any) => api.get('/mortuary/records', { params }),
  getRecordById: (id: string) => api.get(`/mortuary/records/${id}`),
  updateRecord: (id: string, data: any) => api.put(`/mortuary/records/${id}`, data),
  updateStatus: (id: string, status: string, data?: any) =>
    api.patch(`/mortuary/records/${id}/status`, { status, ...data }),
  // Certificate
  issueCertificate: (id: string, data: any) =>
    api.post(`/mortuary/records/${id}/certificate`, data),
  // Autopsy
  scheduleAutopsy: (id: string, data: any) =>
    api.post(`/mortuary/records/${id}/autopsy/schedule`, data),
  completeAutopsy: (id: string, data: any) =>
    api.patch(`/mortuary/records/${id}/autopsy/complete`, data),
  // Release
  releaseBody: (id: string, data: any) =>
    api.post(`/mortuary/records/${id}/release`, data),
  // Organ Donation
  registerOrganDonation: (id: string, data: any) =>
    api.post(`/mortuary/records/${id}/organ-donation`, data),
  // AI Features
  analyzeMortality: (data: any) => api.post('/mortuary/ai/mortality-analysis', data),
  generateDeathSummary: (data: any) => api.post('/mortuary/ai/death-summary', data),
  checkDocumentation: (data: any) => api.post('/mortuary/ai/check-documentation', data),
  // Stats
  getStats: () => api.get('/mortuary/stats'),
};

// Telemedicine APIs
export const telemedicineApi = {
  // Sessions
  createSession: (data: any) => api.post('/telemedicine/sessions', data),
  getSessions: (params?: any) => api.get('/telemedicine/sessions', { params }),
  getSessionById: (id: string) => api.get(`/telemedicine/sessions/${id}`),
  startSession: (id: string) => api.patch(`/telemedicine/sessions/${id}/start`),
  endSession: (id: string, data: any) =>
    api.patch(`/telemedicine/sessions/${id}/end`, data),
  cancelSession: (id: string, reason: string) =>
    api.patch(`/telemedicine/sessions/${id}/cancel`, { reason }),
  markNoShow: (id: string, party: string) =>
    api.patch(`/telemedicine/sessions/${id}/no-show`, { party }),
  updateNotes: (id: string, notes: string) =>
    api.patch(`/telemedicine/sessions/${id}/notes`, { notes }),
  recordVitals: (id: string, vitals: any) =>
    api.patch(`/telemedicine/sessions/${id}/vitals`, vitals),
  // AI Features
  performTriage: (data: any) => api.post('/telemedicine/ai/triage', data),
  generateSummary: (data: any) => api.post('/telemedicine/ai/summary', data),
  recommendFollowUp: (data: any) => api.post('/telemedicine/ai/recommend-followup', data),
  // Stats
  getStats: (doctorId?: string) =>
    api.get('/telemedicine/stats', { params: { doctorId } }),
};

// Quality Management APIs
export const qualityApi = {
  // Indicators
  createIndicator: (data: any) => api.post('/quality/indicators', data),
  getIndicators: (params?: any) => api.get('/quality/indicators', { params }),
  getIndicatorById: (id: string) => api.get(`/quality/indicators/${id}`),
  updateIndicator: (id: string, data: any) =>
    api.put(`/quality/indicators/${id}`, data),
  // Measurements
  recordMeasurement: (indicatorId: string, data: any) =>
    api.post(`/quality/indicators/${indicatorId}/measurements`, data),
  getMeasurements: (indicatorId: string, params?: any) =>
    api.get(`/quality/indicators/${indicatorId}/measurements`, { params }),
  // Incidents
  reportIncident: (data: any) => api.post('/quality/incidents', data),
  getIncidents: (params?: any) => api.get('/quality/incidents', { params }),
  getIncidentById: (id: string) => api.get(`/quality/incidents/${id}`),
  updateIncidentStatus: (id: string, status: string, data?: any) =>
    api.patch(`/quality/incidents/${id}/status`, { status, ...data }),
  investigateIncident: (id: string, data: any) =>
    api.post(`/quality/incidents/${id}/investigate`, data),
  closeIncident: (id: string, data: any) =>
    api.post(`/quality/incidents/${id}/close`, data),
  // AI Features
  analyzeTrends: (data: any) => api.post('/quality/ai/analyze-trends', data),
  rootCauseAnalysis: (data: any) => api.post('/quality/ai/root-cause', data),
  generateScorecard: (data: any) => api.post('/quality/ai/scorecard', data),
  predictRisk: (data: any) => api.post('/quality/ai/predict-risk', data),
  // Stats
  getStats: () => api.get('/quality/stats'),
};

// Reports & Analytics APIs
export const reportsApi = {
  // Executive Reports
  getExecutiveSummary: (params?: any) =>
    api.get('/reports/executive-summary', { params }),
  getComprehensiveReport: (params?: any) =>
    api.get('/reports/comprehensive', { params }),
  // Patient Analytics
  getPatientDemographics: () => api.get('/reports/patients/demographics'),
  getPatientTrends: (period?: string, months?: number) =>
    api.get('/reports/patients/trends', { params: { period, months } }),
  // Financial Analytics
  getRevenueAnalysis: (params?: any) =>
    api.get('/reports/financial/revenue', { params }),
  getRevenueTrends: (months?: number) =>
    api.get('/reports/financial/trends', { params: { months } }),
  // Operational Analytics
  getDepartmentPerformance: (params?: any) =>
    api.get('/reports/operations/departments', { params }),
  getDoctorProductivity: (params?: any) =>
    api.get('/reports/operations/doctors', { params }),
  getBedOccupancy: () => api.get('/reports/operations/beds'),
  // Clinical Analytics
  getDiagnosisDistribution: (params?: any) =>
    api.get('/reports/clinical/diagnoses', { params }),
  getPrescriptionAnalytics: (params?: any) =>
    api.get('/reports/clinical/prescriptions', { params }),
  // AI Analytics
  predictVolume: (data: any) => api.post('/reports/ai/predict-volume', data),
  identifyBottlenecks: (data: any) => api.post('/reports/ai/bottlenecks', data),
  generateInsights: (data: any) => api.post('/reports/ai/insights', data),
};

// Public APIs (no authentication required)
export const publicApi = {
  // Book appointment (for homepage)
  bookAppointment: (data: {
    fullName: string;
    email: string;
    phone: string;
    department: string;
    preferredDate: string;
    preferredTime: string;
    reason?: string;
  }) => api.post('/public/book-appointment', data),

  // Get available departments
  getDepartments: () => api.get('/public/departments'),

  // Get doctors by department
  getDoctorsByDepartment: (departmentId: string) =>
    api.get(`/public/doctors/${departmentId}`),

  // Get available time slots
  getAvailableSlots: (doctorId: string, date: string) =>
    api.get(`/public/slots/${doctorId}/${date}`),

  // Verify booking by confirmation code
  getBookingByCode: (confirmationCode: string) =>
    api.get(`/public/booking/${confirmationCode}`),

  // AI-powered booking assistant
  aiChat: (data: { message: string; context?: Record<string, unknown> }) =>
    api.post('/public/ai/chat', data),

  // Parse natural language booking intent
  aiParseIntent: (text: string) =>
    api.post('/public/ai/parse-intent', { text }),

  // Analyze symptoms and suggest department
  aiAnalyzeSymptoms: (symptoms: string[]) =>
    api.post('/public/ai/analyze-symptoms', { symptoms }),

  // Get departments with AI keywords
  aiGetDepartments: () => api.get('/public/ai/departments'),
};

// Symptom Checker APIs
export const symptomCheckerApi = {
  // Start a new symptom checker session
  startSession: (data?: {
    patientInfo?: {
      patientId?: string;
      age?: number;
      gender?: string;
      medicalHistory?: string[];
      currentMedications?: string[];
      allergies?: string[];
    };
    initialSymptoms?: string[];
    hospitalId?: string;
  }) => api.post('/ai/symptom-checker/start', data || {}),

  // Submit responses to get next questions
  respond: (data: {
    sessionId: string;
    responses: Array<{ questionId: string; answer: any }>;
  }) => api.post('/ai/symptom-checker/respond', data),

  // Complete assessment and get triage result
  complete: (sessionId: string) =>
    api.post('/ai/symptom-checker/complete', { sessionId }),

  // Get session details
  getSession: (sessionId: string) =>
    api.get(`/ai/symptom-checker/session/${sessionId}`),

  // Quick symptom check
  quickCheck: (symptoms: string[], patientAge?: number) =>
    api.post('/ai/symptom-checker/quick-check', { symptoms, patientAge }),

  // Get available departments
  getDepartments: () => api.get('/ai/symptom-checker/departments'),
};

// Medication Safety APIs
export const medSafetyApi = {
  // Get medication safety checks
  checkMedication: (data: {
    patientId: string;
    medications: string[];
    allergies?: string[];
  }) => api.post('/med-safety/check', data),

  // Verify medication administration
  verifyAdministration: (data: {
    patientId: string;
    medicationId: string;
    scannedCode?: string;
  }) => api.post('/med-safety/verify', data),

  // Verify five rights (patient, drug, dose, route, time)
  verifyFiveRights: (data: Record<string, any>) =>
    api.post('/med-safety/verify-five-rights', data),

  // Record override for safety alerts
  recordOverride: (data: Record<string, any>) =>
    api.post('/med-safety/record-override', data),

  // Get patient medication alerts
  getAlerts: (patientId: string) => api.get(`/med-safety/alerts/${patientId}`),

  // Check drug interactions
  checkInteractions: (medications: string[]) =>
    api.post('/med-safety/interactions', { medications }),

  // Get medication guidelines
  getGuidelines: (medicationId: string) =>
    api.get(`/med-safety/guidelines/${medicationId}`),

  // Get high alert drugs list
  getHighAlertDrugs: () => api.get('/med-safety/high-alert-drugs'),

  // Get patient medications
  getPatientMedications: (patientId: string) =>
    api.get(`/med-safety/patient/${patientId}/medications`),

  // Scan barcode
  scanBarcode: (barcode: string, type?: string) =>
    api.post('/med-safety/scan-barcode', { barcode, type }),

  // Check IV compatibility
  checkIVCompatibility: (data: any) =>
    api.post('/med-safety/check-iv-compatibility', data),

  // Calculate dose
  calculateDose: (data: Record<string, any>) =>
    api.post('/med-safety/calculate-dose', data),

  // Perform safety verification
  performSafetyVerification: (data: Record<string, any>) =>
    api.post('/med-safety/safety-verification', data),

  // Get due medications
  getDueMedications: (params: any) =>
    api.get('/med-safety/due-medications', { params }),

  // Record administration
  recordAdministration: (data: Record<string, any>) =>
    api.post('/med-safety/record-administration', data),
};

// Smart Order APIs
export const smartOrderApi = {
  // Get order recommendations
  getRecommendations: (data: {
    diagnosis: string;
    icdCode?: string;
    symptoms?: string[];
    patientId?: string;
    patientContext?: Record<string, any>;
    includeAlternatives?: boolean;
  }) => api.post('/smart-orders/recommend', data),

  // Get available bundles
  getBundles: () => api.get('/smart-orders/bundles'),

  // Get bundle details
  getBundleDetails: (bundleId: string) =>
    api.get(`/smart-orders/bundle/${bundleId}`),

  // Customize orders for patient
  customizeOrders: (data: {
    bundleId?: string;
    selectedOrders: any[];
    patientId?: string;
    patientContext: Record<string, any>;
    customizations?: Record<string, any>;
  }) => api.post('/smart-orders/customize', data),

  // Place orders
  placeOrders: (data: {
    patientId: string;
    orders: any[];
    notes?: string;
  }) => api.post('/smart-orders/place', data),

  // Get order history
  getOrderHistory: (patientId: string) =>
    api.get(`/smart-orders/history/${patientId}`),

  // Check drug interactions
  checkInteractions: (medications: string[]) =>
    api.post('/smart-orders/check-interactions', { medications }),

  // Health check
  getHealth: () => api.get('/smart-orders/health'),
};

export default api;
