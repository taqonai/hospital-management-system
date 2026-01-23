import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { store } from '../store';
import { updateTokens, logout } from '../store/authSlice';

// Use environment variable for API URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

// Direct API URL for long-running AI requests (bypasses Cloudflare's 100s timeout)
const AI_API_BASE_URL = import.meta.env.VITE_AI_API_URL || API_BASE_URL;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Separate axios instance for AI requests that may take longer than Cloudflare's 100s timeout
const aiAxiosClient = axios.create({
  baseURL: AI_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 300000, // 5 minutes for Ollama
});

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Check if this is a patient portal request
    // Include wellness routes as they use patient authentication
    const isPatientPortalRequest = config.url?.includes('/patient-portal') ||
                                    config.url?.includes('/patient-auth') ||
                                    config.url?.includes('/wellness');

    let token: string | null = null;

    if (isPatientPortalRequest) {
      // Use patient portal token for patient portal and wellness requests
      token = localStorage.getItem('patientPortalToken');
    }

    // If no patient token or not a patient request, use staff token
    if (!token) {
      const state = store.getState();
      token = state.auth.accessToken;
    }

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

    // Check if this is a patient portal request (including wellness routes)
    const isPatientPortalRequest = originalRequest.url?.includes('/patient-portal') ||
                                    originalRequest.url?.includes('/patient-auth') ||
                                    originalRequest.url?.includes('/wellness');

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isPatientPortalRequest) {
        // Handle patient portal authentication failure
        const patientRefreshToken = localStorage.getItem('patientRefreshToken');

        if (!patientRefreshToken) {
          localStorage.removeItem('patientPortalToken');
          localStorage.removeItem('patientRefreshToken');
          localStorage.removeItem('patientUser');
          window.location.href = '/patient-portal/login';
          return Promise.reject(error);
        }

        try {
          const response = await axios.post(`${API_BASE_URL}/patient-auth/refresh`, {
            refreshToken: patientRefreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;

          localStorage.setItem('patientPortalToken', accessToken);
          localStorage.setItem('patientRefreshToken', newRefreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }

          return api(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('patientPortalToken');
          localStorage.removeItem('patientRefreshToken');
          localStorage.removeItem('patientUser');
          window.location.href = '/patient-portal/login';
          return Promise.reject(refreshError);
        }
      } else {
        // Handle staff authentication failure
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
    }

    return Promise.reject(error);
  }
);

// Add auth interceptor to aiAxiosClient (for staff token)
aiAxiosClient.interceptors.request.use(
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

  // Absence management
  getAbsences: (doctorId: string, params?: { upcoming?: boolean; status?: string }) =>
    api.get(`/doctors/${doctorId}/absences`, { params }),
  getAbsenceSummary: (doctorId: string) =>
    api.get(`/doctors/${doctorId}/absences/summary`),
  createAbsence: (doctorId: string, data: {
    startDate: string;
    endDate: string;
    absenceType: 'ANNUAL_LEAVE' | 'SICK_LEAVE' | 'CONFERENCE' | 'TRAINING' | 'PERSONAL' | 'EMERGENCY' | 'OTHER';
    reason?: string;
    notes?: string;
    isFullDay?: boolean;
    startTime?: string;
    endTime?: string;
  }) => api.post(`/doctors/${doctorId}/absences`, data),
  updateAbsence: (doctorId: string, absenceId: string, data: {
    absenceType?: 'ANNUAL_LEAVE' | 'SICK_LEAVE' | 'CONFERENCE' | 'TRAINING' | 'PERSONAL' | 'EMERGENCY' | 'OTHER';
    reason?: string;
    notes?: string;
  }) => api.patch(`/doctors/${doctorId}/absences/${absenceId}`, data),
  cancelAbsence: (doctorId: string, absenceId: string) =>
    api.delete(`/doctors/${doctorId}/absences/${absenceId}`),
};

// Slot APIs (Doctor appointment slots)
export const slotApi = {
  getByDoctor: (doctorId: string) => api.get(`/slots/doctor/${doctorId}`),
  getByDoctorAndDate: (doctorId: string, date: string) =>
    api.get(`/slots/doctor/${doctorId}/date/${date}`),
  getByDateRange: (doctorId: string, startDate: string, endDate: string) =>
    api.get(`/slots/doctor/${doctorId}/range`, { params: { startDate, endDate } }),
  regenerate: (doctorId: string, daysAhead?: number) =>
    api.post(`/slots/generate/${doctorId}`, { daysAhead }),
  regenerateFromSchedule: (doctorId: string) =>
    api.post(`/slots/regenerate/${doctorId}`),
  toggleBlock: (slotId: string, isBlocked: boolean) =>
    api.patch(`/slots/${slotId}/block`, { isBlocked }),
};

// Department APIs
export const departmentApi = {
  getAll: (includeInactive = false) => api.get(`/departments${includeInactive ? '?includeInactive=true' : ''}`),
  getById: (id: string) => api.get(`/departments/${id}`),
  create: (data: { name: string; code: string; description?: string; floor?: string; phone?: string; email?: string }) =>
    api.post('/departments', data),
  update: (id: string, data: { name?: string; code?: string; description?: string; floor?: string; phone?: string; email?: string; isActive?: boolean }) =>
    api.put(`/departments/${id}`, data),
  delete: (id: string) => api.delete(`/departments/${id}`),

  // Specializations
  getAllSpecializations: () => api.get('/departments/specializations/all'),
  getSpecializations: (departmentId: string) => api.get(`/departments/${departmentId}/specializations`),
  createSpecialization: (departmentId: string, data: { name: string; code: string; description?: string }) =>
    api.post(`/departments/${departmentId}/specializations`, data),
  updateSpecialization: (departmentId: string, specId: string, data: { name?: string; code?: string; description?: string; isActive?: boolean }) =>
    api.put(`/departments/${departmentId}/specializations/${specId}`, data),
  deleteSpecialization: (departmentId: string, specId: string) =>
    api.delete(`/departments/${departmentId}/specializations/${specId}`),
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
  }) => aiAxiosClient.post('/ai/diagnose', data), // Uses aiAxiosClient to bypass Cloudflare timeout
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

// AI Consultation APIs - Enhanced AI throughout consultation flow
export const aiConsultationApi = {
  // Get AI-enhanced patient context before consultation
  getPatientContext: (patientId: string) =>
    api.get(`/ai-consultation/patient-context/${patientId}`),

  // Interpret vital signs with NEWS2 scoring
  interpretVitals: (data: {
    respiratoryRate?: number;
    oxygenSaturation?: number;
    temperature?: number;
    systolicBP?: number;
    heartRate?: number;
    consciousness?: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';
    patientId?: string;
  }) => api.post('/ai-consultation/interpret-vitals', data),

  // Get AI diagnosis suggestions
  suggestDiagnosis: (data: {
    symptoms: string[];
    patientId?: string;
    patientAge?: number;
    patientGender?: string;
    medicalHistory?: string[];
    vitalSigns?: Record<string, any>;
  }) => api.post('/ai-consultation/suggest-diagnosis', data),

  // Get recommended lab/imaging tests
  recommendTests: (data: {
    diagnosis: string;
    symptoms?: string[];
    patientId?: string;
  }) => api.post('/ai-consultation/recommend-tests', data),

  // Validate prescription in real-time
  validatePrescription: (data: {
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      route?: string;
      duration?: string;
    }>;
    patientId: string;
  }) => api.post('/ai-consultation/validate-prescription', data),

  // Generate SOAP notes from consultation data
  generateSOAP: (data: {
    consultationId?: string;
    symptoms: string[];
    vitals?: Record<string, any>;
    diagnosis?: string;
    treatment?: string;
    notes?: string;
    prescriptions?: Array<{
      medication: string;
      dosage: string;
      frequency: string;
      duration: string;
    }>;
  }) => api.post('/ai-consultation/generate-soap', data),

  // Get follow-up recommendations
  getFollowUp: (consultationId: string) =>
    api.get(`/ai-consultation/follow-up/${consultationId}`),

  // Complete consultation with all data
  complete: (data: {
    appointmentId: string;
    patientId: string;
    chiefComplaint: string;
    diagnosis: string[];
    icdCodes?: string[];
    historyOfIllness?: string;
    examination?: string;
    treatmentPlan?: string;
    advice?: string;
    followUpDate?: string;
    notes?: string;
  }) => api.post('/ai-consultation/complete', data),
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
  // Sample Tracking
  collectSample: (data: any) => api.post('/laboratory/samples/collect', data),
  getSampleByBarcode: (barcode: string) => api.get(`/laboratory/samples/${barcode}`),
  getSampleHistory: (barcode: string) => api.get(`/laboratory/samples/${barcode}/history`),
  updateSampleStatus: (barcode: string, data: any) =>
    api.patch(`/laboratory/samples/${barcode}/status`, data),
  verifySample: (barcode: string, data: any) =>
    api.post(`/laboratory/samples/${barcode}/verify`, data),
  getOrderSamples: (orderId: string) => api.get(`/laboratory/orders/${orderId}/samples`),
  getPendingSamples: () => api.get('/laboratory/samples/pending'),
  getColdChainSamples: () => api.get('/laboratory/samples/cold-chain'),
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

// Advanced Pharmacy AI APIs
export const advancedPharmacyAIApi = {
  // Therapeutic Drug Monitoring
  getTDMGuidance: (data: {
    drugName: string;
    patientWeight?: number;
    serumCreatinine?: number;
    currentLevel?: number;
    lastDoseTime?: string;
    patientAge?: number;
  }) => api.post('/advanced-pharmacy-ai/tdm/guidance', data),

  // CYP450 Enzyme Interactions
  checkCYP450Interactions: (medications: string[]) =>
    api.post('/advanced-pharmacy-ai/cyp450/check', { medications }),

  // Cost-Effective Alternatives
  getAlternatives: (data: {
    drugName: string;
    indication?: string;
    formularyOnly?: boolean;
  }) => api.post('/advanced-pharmacy-ai/alternatives', data),

  // Renal Dosing Calculator
  calculateRenalDose: (data: {
    drugName: string;
    serumCreatinine: number;
    age: number;
    weight: number;
    gender: 'male' | 'female';
    currentDose?: string;
  }) => api.post('/advanced-pharmacy-ai/renal-dosing', data),

  // IV Compatibility Check
  checkIVCompatibility: (data: {
    drugs: string[];
    solution?: string;
  }) => api.post('/advanced-pharmacy-ai/iv-compatibility', data),

  // Drug-Lab Interactions
  checkLabInteractions: (data: {
    medications: string[];
    labTests?: string[];
  }) => api.post('/advanced-pharmacy-ai/lab-interactions', data),

  // Polypharmacy Risk Assessment
  assessPolypharmacyRisk: (data: {
    medications: string[];
    patientAge: number;
    conditions?: string[];
  }) => api.post('/advanced-pharmacy-ai/polypharmacy-risk', data),

  // Enhanced Drug Info
  getDrugInfo: (drugName: string) =>
    api.get(`/advanced-pharmacy-ai/drug-info/${encodeURIComponent(drugName)}`),
};

// Python AI Pharmacy Endpoints (via AI service)
export const pharmacyAIServiceApi = {
  // AI-Enhanced Interaction Analysis
  analyzeWithAI: (data: {
    medications: string[];
    patientContext?: {
      age?: number;
      weight?: number;
      conditions?: string[];
      allergies?: string[];
      renal_function?: number;
      hepatic_function?: string;
    };
  }) => api.post('/ai/pharmacy/ai-analyze', data),

  // Medication Reconciliation
  reconcileMedications: (data: {
    currentMeds: Array<{ name: string; dose?: string; frequency?: string }>;
    newPrescription: { name: string; dose?: string };
    patientData?: {
      chronicConditions?: string[];
      admissionMedications?: Array<{ name: string }>;
    };
  }) => api.post('/ai/pharmacy/reconcile', data),

  // Adherence Risk Prediction
  predictAdherenceRisk: (data: {
    medications: Array<{ name: string; frequency?: string }>;
    patientDemographics?: {
      age?: number;
      cognitiveStatus?: string;
      costConcern?: string;
      previousNonAdherence?: boolean;
    };
  }) => api.post('/ai/pharmacy/adherence-risk', data),

  // Antimicrobial Stewardship Review
  reviewAntibiotic: (data: {
    antibiotic: string;
    indication: string;
    duration: number;
    cultures?: {
      organism?: string;
      sensitivities?: string[];
    };
    patientData?: {
      age?: number;
      renal_function?: number;
    };
  }) => api.post('/ai/pharmacy/antibiotic-review', data),
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
  getTodayAppointments: (doctorId?: string) => api.get('/opd/appointments/today', { params: { doctorId } }),
  checkIn: (appointmentId: string) => api.post(`/opd/check-in/${appointmentId}`),
  callNext: (doctorId: string) => api.post('/opd/call-next', { doctorId }),
  getCurrentToken: (doctorId: string) => api.get(`/opd/current-token/${doctorId}`),
  getWaitTime: (doctorId: string) => api.get(`/opd/wait-time/${doctorId}`),
  markNoShow: (appointmentId: string) => api.post(`/opd/no-show/${appointmentId}`),
  reschedule: (appointmentId: string, data: any) =>
    api.post(`/opd/reschedule/${appointmentId}`, data),
  getStats: () => api.get('/opd/stats'),
  getQueueDisplay: () => api.get('/opd/display'),
  // Pre-consultation vitals
  recordVitals: (appointmentId: string, vitalsData: {
    temperature?: number;
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
    height?: number;
    bloodSugar?: number;
    painLevel?: number;
    notes?: string;
  }) => api.post(`/opd/appointments/${appointmentId}/vitals`, vitalsData),
  getAppointmentVitals: (appointmentId: string) => api.get(`/opd/appointments/${appointmentId}/vitals`),
  // Unified booking ticket
  getBookingTicket: (appointmentId: string) => api.get(`/opd/booking-ticket/${appointmentId}`),
  getPatientHistory: (patientId: string, limit?: number) =>
    api.get(`/opd/patient-history/${patientId}`, { params: { limit } }),
  // Get patient's latest patient status (pregnancy, medications, treatment) from previous vitals
  getPatientStatus: (patientId: string) => api.get(`/opd/patient-status/${patientId}`),
  // Get patient's medical summary (medical history + allergies) for nurse vitals modal
  getPatientMedicalSummary: (patientId: string) => api.get(`/opd/patient-medical-summary/${patientId}`),
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
  // Employee Self-Service Leave
  getMyEmployee: () => api.get('/hr/leave/my-employee'),
  getMyLeaveBalance: (year?: number) =>
    api.get('/hr/leave/my-balance', { params: { year } }),
  getMyLeaveRequests: (params?: any) =>
    api.get('/hr/leave/my-requests', { params }),
  withdrawLeaveRequest: (id: string) =>
    api.patch(`/hr/leave/${id}/withdraw`),
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
  // Recording
  startRecording: (sessionId: string, type: 'VIDEO' | 'AUDIO' | 'SCREEN') =>
    api.post(`/telemedicine/sessions/${sessionId}/recording/start`, { type }),
  stopRecording: (sessionId: string, recordingId: string) =>
    api.post(`/telemedicine/sessions/${sessionId}/recording/stop`, { recordingId }),
  getSessionRecordings: (sessionId: string) =>
    api.get(`/telemedicine/sessions/${sessionId}/recordings`),
  deleteRecording: (recordingId: string) =>
    api.delete(`/telemedicine/recordings/${recordingId}`),
  getPatientRecordings: (patientId: string, params?: any) =>
    api.get(`/telemedicine/patients/${patientId}/recordings`, { params }),
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

// Patient Portal API
export const patientPortalApi = {
  // Dashboard
  getSummary: () => api.get('/patient-portal/summary'),

  // Profile
  getProfile: () => api.get('/patient-auth/profile'),
  updateProfile: (data: any) => api.put('/patient-auth/profile', data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/patient-auth/change-password', data),

  // Notification Preferences
  getNotificationPreferences: () => api.get('/patient-portal/settings/notifications'),
  updateNotificationPreferences: (data: any) =>
    api.put('/patient-portal/settings/notifications', data),

  // Communication Preferences
  getCommunicationPreferences: () => api.get('/patient-portal/settings/communication'),
  updateCommunicationPreferences: (data: any) =>
    api.put('/patient-portal/settings/communication', data),

  // Appointments
  getAppointments: (params?: {
    type?: string;
    status?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) => api.get('/patient-portal/appointments', { params }),
  getAppointmentById: (id: string) => api.get(`/patient-portal/appointments/${id}`),
  bookAppointment: (data: any) => api.post('/patient-portal/appointments', data),
  cancelAppointment: (id: string, reason?: string) =>
    api.post(`/patient-portal/appointments/${id}/cancel`, { reason }),
  rescheduleAppointment: (id: string, data: { appointmentDate: string; startTime: string }) =>
    api.put(`/patient-portal/appointments/${id}/reschedule`, data),
  getAvailableSlots: (doctorId: string, date: string) =>
    api.get(`/patient-portal/doctors/${doctorId}/slots`, { params: { date } }),

  // Medical Records
  getMedicalRecords: (params?: {
    type?: string;
    visitType?: string;
    search?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    doctorId?: string;
    departmentId?: string;
  }) => api.get('/patient-portal/records', { params }),
  getMedicalRecordById: (id: string) => api.get(`/patient-portal/records/${id}`),
  downloadMedicalRecord: (id: string) =>
    api.get(`/patient-portal/records/${id}/download`, { responseType: 'blob' }),

  // Prescriptions
  getPrescriptions: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/patient-portal/prescriptions', { params }),
  getPrescriptionById: (id: string) => api.get(`/patient-portal/prescriptions/${id}`),
  requestRefill: (id: string) => api.post(`/patient-portal/prescriptions/${id}/refill`),

  // Lab Results
  getLabResults: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/patient-portal/labs', { params }),
  getLabResultById: (id: string) => api.get(`/patient-portal/labs/${id}`),
  downloadLabReport: (id: string) =>
    api.get(`/patient-portal/labs/${id}/download`, { responseType: 'blob' }),

  // Messages
  getMessages: (params?: { filter?: 'all' | 'unread'; page?: number; limit?: number }) =>
    api.get('/patient-portal/messages', { params }),
  getMessageThread: (threadId: string) =>
    api.get(`/patient-portal/messages/${threadId}`),
  sendMessage: (data: {
    recipientId: string;
    subject: string;
    body: string;
    threadId?: string;
  }) => api.post('/patient-portal/messages', data),
  markMessageRead: (threadId: string) =>
    api.patch(`/patient-portal/messages/${threadId}/read`),
  markMessageUnread: (threadId: string) =>
    api.patch(`/patient-portal/messages/${threadId}/unread`),
  getProviders: (params?: { search?: string; departmentId?: string }) =>
    api.get('/patient-portal/providers', { params }),

  // Billing
  getBillingSummary: () => api.get('/patient-portal/billing/summary'),
  getBills: (params?: { type?: 'pending' | 'history' | 'all'; page?: number; limit?: number }) =>
    api.get('/patient-portal/bills', { params }),
  getBillById: (id: string) => api.get(`/patient-portal/bills/${id}`),
  makePayment: (data: {
    billId: string;
    amount: number;
    paymentMethod: string;
    cardLast4?: string;
  }) => api.post('/patient-portal/payments', data),
  getPaymentHistory: (params?: { page?: number; limit?: number }) =>
    api.get('/patient-portal/payments', { params }),
  downloadInvoice: (billId: string) =>
    api.get(`/patient-portal/bills/${billId}/download`, { responseType: 'blob' }),

  // Insurance Claims
  getInsuranceClaims: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/patient-portal/insurance-claims', { params }),

  // Reference data
  getDoctors: (params?: { departmentId?: string; search?: string }) =>
    api.get('/patient-portal/doctors', { params }),
  getDepartments: () => api.get('/patient-portal/departments'),

  // Medical History
  getMedicalHistory: () => api.get('/patient-portal/medical-history'),
  updateMedicalHistory: (data: {
    chronicConditions?: string[];
    pastSurgeries?: string[];
    familyHistory?: string[];
    currentMedications?: string[];
    immunizations?: string[];
    lifestyle?: {
      smoking?: string;
      alcohol?: string;
      exercise?: string;
      diet?: string;
    };
    notes?: string;
  }) => api.put('/patient-portal/medical-history', data),
  analyzeMedicalHistory: () => api.post('/patient-portal/medical-history/ai-analyze'),

  // Allergies
  getAllergies: () => api.get('/patient-portal/allergies'),
  addAllergy: (data: {
    allergen: string;
    type: 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER';
    severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
    reaction?: string;
    notes?: string;
  }) => api.post('/patient-portal/allergies', data),
  updateAllergy: (id: string, data: {
    allergen?: string;
    type?: 'DRUG' | 'FOOD' | 'ENVIRONMENTAL' | 'OTHER';
    severity?: 'MILD' | 'MODERATE' | 'SEVERE' | 'LIFE_THREATENING';
    reaction?: string;
    notes?: string;
  }) => api.put(`/patient-portal/allergies/${id}`, data),
  deleteAllergy: (id: string) => api.delete(`/patient-portal/allergies/${id}`),
  getAllergySuggestions: (data: {
    symptoms?: string[];
    medications?: string[];
    foods?: string[];
  }) => api.post('/patient-portal/allergies/ai-suggest', data),

  // AI Health Insights
  getHealthInsights: () => api.get('/patient-portal/health-insights'),
  aiChat: (data: { message: string; context?: string; history?: any[] }) =>
    api.post('/patient-portal/ai-chat', data),
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


// PDF Analysis API (AI-powered document analysis)
export const pdfApi = {
  // Check if PDF analysis service is available
  getStatus: () => api.get('/ai/pdf/status'),

  // Analyze uploaded PDF file
  analyze: (formData: FormData) =>
    api.post('/ai/pdf/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // Analyze PDF from URL
  analyzeUrl: (data: {
    url: string;
    documentType?: string;
    extractEntities?: boolean;
    patientContext?: Record<string, any>;
  }) => api.post('/ai/pdf/analyze-url', data),
};

// RBAC APIs
export const rbacApi = {
  // Permissions
  getPermissions: () => api.get('/rbac/permissions'),
  getAvailablePermissions: () => api.get('/rbac/permissions'),

  // Roles
  createRole: (data: any) => api.post('/rbac/roles', data),
  getRoles: (params?: any) => api.get('/rbac/roles', { params }),
  getRoleById: (id: string) => api.get(`/rbac/roles/${id}`),
  updateRole: (id: string, data: any) => api.put(`/rbac/roles/${id}`, data),
  deleteRole: (id: string) => api.delete(`/rbac/roles/${id}`),

  // User Roles - extended for RBAC management page
  getUsersWithRoles: (params?: { search?: string; role?: string; page?: number; limit?: number }) =>
    api.get('/rbac/users', { params }),
  assignRolesToUser: (userId: string, roleIds: string[]) =>
    api.post(`/rbac/users/${userId}/roles`, { roleIds }),
  assignRoleToUser: (userId: string, roleId: string) =>
    api.post(`/rbac/users/${userId}/roles`, { roleId }),
  removeRoleFromUser: (userId: string, roleId: string) =>
    api.delete(`/rbac/users/${userId}/roles/${roleId}`),
  getUserRoles: (userId: string) => api.get(`/rbac/users/${userId}/roles`),
  getUsersByRole: (roleId: string) => api.get(`/rbac/roles/${roleId}/users`),
  getUserEffectivePermissions: (userId: string) =>
    api.get(`/rbac/users/${userId}/effective-permissions`),

  // Direct Permissions
  grantPermission: (userId: string, permission: string) =>
    api.post(`/rbac/users/${userId}/permissions`, { permission }),
  revokePermission: (userId: string, permission: string) =>
    api.delete(`/rbac/users/${userId}/permissions/${permission}`),

  // My Permissions
  getMyPermissions: () => api.get('/rbac/my-permissions'),

  // Audit Logs
  getAuditLogs: (params?: {
    action?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) => api.get('/rbac/audit-logs', { params }),
};

// AI Settings APIs (Admin only)
export const aiSettingsApi = {
  // Get current AI provider settings
  getSettings: () => api.get('/ai-settings/settings'),

  // Update AI provider settings
  updateSettings: (data: {
    provider: 'openai' | 'ollama';
    ollamaEndpoint?: string;
    ollamaModels?: {
      complex?: string;
      simple?: string;
    };
  }) => api.put('/ai-settings/settings', data),

  // Fetch available models from Ollama endpoint
  getOllamaModels: (endpoint: string) =>
    api.get('/ai-settings/ollama/models', { params: { endpoint } }),

  // Check Ollama endpoint health
  checkOllamaHealth: (endpoint: string) =>
    api.get('/ai-settings/ollama/health', { params: { endpoint } }),

  // Test Ollama connection with a specific model
  testOllama: (endpoint: string, model: string) =>
    api.post('/ai-settings/ollama/test', { endpoint, model }),

  // Get current provider status
  getProviderStatus: () => api.get('/ai-settings/provider/status'),
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

  // Get order history with pagination and filters
  getOrderHistory: (params?: {
    patientId?: string;
    patientName?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  }) => api.get('/smart-orders/history', { params }),

  // Get order by ID
  getOrderById: (orderId: string) =>
    api.get(`/smart-orders/orders/${orderId}`),

  // Update order status
  updateOrderStatus: (orderId: string, status: string, executedBy?: string) =>
    api.patch(`/smart-orders/orders/${orderId}/status`, { status, executedBy }),

  // Cancel order
  cancelOrder: (orderId: string, reason?: string) =>
    api.post(`/smart-orders/orders/${orderId}/cancel`, { reason }),

  // Get order statistics
  getOrderStats: (params?: {
    startDate?: string;
    endDate?: string;
  }) => api.get('/smart-orders/stats', { params }),

  // Reorder - use existing order as template for new patient
  reorder: (orderId: string, newPatientId: string) =>
    api.post(`/smart-orders/orders/${orderId}/reorder`, { newPatientId }),

  // Check drug interactions
  checkInteractions: (medications: string[]) =>
    api.post('/smart-orders/check-interactions', { medications }),

  // Health check
  getHealth: () => api.get('/smart-orders/health'),
};

// Insurance Coding APIs (ICD-10 / CPT)
export const insuranceCodingApi = {
  // ICD-10 Codes
  getICD10Codes: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    dhaApproved?: boolean;
    isActive?: boolean;
    isBillable?: boolean;
    specificityLevel?: number;
  }) => api.get('/insurance-coding/icd10', { params }),

  searchICD10: (q: string, limit?: number) =>
    api.get('/insurance-coding/icd10/search', { params: { q, limit } }),

  getICD10Categories: () => api.get('/insurance-coding/icd10/categories'),

  getICD10ById: (id: string) => api.get(`/insurance-coding/icd10/${id}`),

  getICD10SpecificCodes: (id: string) => api.get(`/insurance-coding/icd10/${id}/specific-codes`),

  getICD10Stats: (id: string, startDate?: string, endDate?: string) =>
    api.get(`/insurance-coding/icd10/${id}/stats`, { params: { startDate, endDate } }),

  createICD10: (data: {
    code: string;
    description: string;
    shortDescription?: string;
    category: string;
    subcategory?: string;
    dhaApproved?: boolean;
    specificityLevel?: number;
    isUnspecified?: boolean;
    preferredCode?: string;
    isActive?: boolean;
    isBillable?: boolean;
    notes?: string;
  }) => api.post('/insurance-coding/icd10', data),

  updateICD10: (id: string, data: Partial<{
    code: string;
    description: string;
    shortDescription?: string;
    category: string;
    subcategory?: string;
    dhaApproved?: boolean;
    specificityLevel?: number;
    isUnspecified?: boolean;
    preferredCode?: string;
    isActive?: boolean;
    isBillable?: boolean;
    notes?: string;
  }>) => api.put(`/insurance-coding/icd10/${id}`, data),

  deleteICD10: (id: string) => api.delete(`/insurance-coding/icd10/${id}`),

  bulkImportICD10: (codes: Array<{
    code: string;
    description: string;
    category: string;
    [key: string]: any;
  }>) => api.post('/insurance-coding/icd10/bulk', { codes }),

  importICD10CSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/insurance-coding/icd10/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getICD10CSVTemplate: () => api.get('/insurance-coding/icd10/csv-template', { responseType: 'blob' }),

  getICD10CSVFields: () => api.get('/insurance-coding/icd10/csv-fields'),

  // CPT Codes
  getCPTCodes: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    requiresPreAuth?: boolean;
    isActive?: boolean;
    minPrice?: number;
    maxPrice?: number;
  }) => api.get('/insurance-coding/cpt', { params }),

  searchCPT: (q: string, limit?: number) =>
    api.get('/insurance-coding/cpt/search', { params: { q, limit } }),

  getCPTCategories: () => api.get('/insurance-coding/cpt/categories'),

  getCPTById: (id: string) => api.get(`/insurance-coding/cpt/${id}`),

  getCPTForICD: (icdCodeId: string) => api.get(`/insurance-coding/cpt/for-icd/${icdCodeId}`),

  checkCPTBundling: (cptCodes: string[]) =>
    api.post('/insurance-coding/cpt/check-bundling', { cptCodes }),

  getCPTStats: (id: string, startDate?: string, endDate?: string) =>
    api.get(`/insurance-coding/cpt/${id}/stats`, { params: { startDate, endDate } }),

  createCPT: (data: {
    code: string;
    description: string;
    shortDescription?: string;
    category: string;
    subcategory?: string;
    basePrice: number;
    dhaPrice?: number;
    cashPrice?: number;
    requiresPreAuth?: boolean;
    isActive?: boolean;
    notes?: string;
  }) => api.post('/insurance-coding/cpt', data),

  updateCPT: (id: string, data: Partial<{
    code: string;
    description: string;
    shortDescription?: string;
    category: string;
    subcategory?: string;
    basePrice: number;
    dhaPrice?: number;
    cashPrice?: number;
    requiresPreAuth?: boolean;
    isActive?: boolean;
    notes?: string;
  }>) => api.put(`/insurance-coding/cpt/${id}`, data),

  deleteCPT: (id: string) => api.delete(`/insurance-coding/cpt/${id}`),

  bulkImportCPT: (codes: Array<{
    code: string;
    description: string;
    category: string;
    basePrice: number;
    [key: string]: any;
  }>) => api.post('/insurance-coding/cpt/bulk', { codes }),

  importCPTCSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/insurance-coding/cpt/import-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getCPTCSVTemplate: () => api.get('/insurance-coding/cpt/csv-template', { responseType: 'blob' }),

  getCPTCSVFields: () => api.get('/insurance-coding/cpt/csv-fields'),

  // CPT Modifiers
  getModifiers: () => api.get('/insurance-coding/modifiers'),

  createModifier: (data: {
    code: string;
    description: string;
    priceImpact?: number;
    isActive?: boolean;
    notes?: string;
  }) => api.post('/insurance-coding/modifiers', data),

  updateModifier: (id: string, data: Partial<{
    code: string;
    description: string;
    priceImpact?: number;
    isActive?: boolean;
    notes?: string;
  }>) => api.put(`/insurance-coding/modifiers/${id}`, data),

  deleteModifier: (id: string) => api.delete(`/insurance-coding/modifiers/${id}`),

  bulkImportModifiers: (modifiers: Array<{
    code: string;
    description: string;
    priceImpact?: number;
  }>) => api.post('/insurance-coding/modifiers/bulk', { modifiers }),

  // ==================== Insurance Payers ====================
  getPayers: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    regulator?: string;
    isActive?: boolean;
  }) => api.get('/insurance-coding/payers', { params }),

  getRegulators: () => api.get('/insurance-coding/payers/regulators'),

  getPayerById: (id: string) => api.get(`/insurance-coding/payers/${id}`),

  createPayer: (data: {
    name: string;
    code: string;
    regulator?: string;
    claimPlatform?: string;
    claimSubmissionDeadline?: number;
    appealDeadline?: number;
    preAuthRequired?: boolean;
    preAuthPhone?: string;
    preAuthEmail?: string;
    preAuthPortal?: string;
    contactPhone?: string;
    contactEmail?: string;
    address?: string;
    paymentTerms?: number;
    isActive?: boolean;
    notes?: string;
  }) => api.post('/insurance-coding/payers', data),

  updatePayer: (id: string, data: Partial<{
    name: string;
    code: string;
    regulator?: string;
    claimPlatform?: string;
    claimSubmissionDeadline?: number;
    appealDeadline?: number;
    preAuthRequired?: boolean;
    preAuthPhone?: string;
    preAuthEmail?: string;
    preAuthPortal?: string;
    contactPhone?: string;
    contactEmail?: string;
    address?: string;
    paymentTerms?: number;
    isActive?: boolean;
    notes?: string;
  }>) => api.put(`/insurance-coding/payers/${id}`, data),

  deletePayer: (id: string) => api.delete(`/insurance-coding/payers/${id}`),

  // ==================== Payer ICD-10 Rules ====================
  getPayerICDRules: (payerId: string, params?: { search?: string; isActive?: boolean }) =>
    api.get(`/insurance-coding/payers/${payerId}/icd-rules`, { params }),

  getPayerICDRule: (payerId: string, icdCodeId: string) =>
    api.get(`/insurance-coding/payers/${payerId}/icd-rules/${icdCodeId}`),

  createPayerICDRule: (payerId: string, data: {
    icd10CodeId: string;
    isCovered?: boolean;
    requiresPreAuth?: boolean;
    maxVisitsPerYear?: number;
    waitingPeriodDays?: number;
    copayAmount?: number;
    copayPercentage?: number;
    deductibleApplies?: boolean;
    ageMinimum?: number;
    ageMaximum?: number;
    genderRestriction?: string;
    priorDiagRequired?: string;
    documentationNotes?: string;
    effectiveDate?: string;
    terminationDate?: string;
    isActive?: boolean;
  }) => api.post(`/insurance-coding/payers/${payerId}/icd-rules`, data),

  updatePayerICDRule: (payerId: string, ruleId: string, data: Partial<{
    isCovered?: boolean;
    requiresPreAuth?: boolean;
    maxVisitsPerYear?: number;
    waitingPeriodDays?: number;
    copayAmount?: number;
    copayPercentage?: number;
    deductibleApplies?: boolean;
    ageMinimum?: number;
    ageMaximum?: number;
    genderRestriction?: string;
    priorDiagRequired?: string;
    documentationNotes?: string;
    effectiveDate?: string;
    terminationDate?: string;
    isActive?: boolean;
  }>) => api.put(`/insurance-coding/payers/${payerId}/icd-rules/${ruleId}`, data),

  deletePayerICDRule: (payerId: string, ruleId: string) =>
    api.delete(`/insurance-coding/payers/${payerId}/icd-rules/${ruleId}`),

  bulkImportPayerICDRules: (payerId: string, rules: Array<{
    icd10CodeId: string;
    isCovered?: boolean;
    requiresPreAuth?: boolean;
    [key: string]: any;
  }>) => api.post(`/insurance-coding/payers/${payerId}/icd-rules/bulk`, { rules }),

  // ==================== Payer CPT Rules ====================
  getPayerCPTRules: (payerId: string, params?: { search?: string; isActive?: boolean }) =>
    api.get(`/insurance-coding/payers/${payerId}/cpt-rules`, { params }),

  getPayerCPTRule: (payerId: string, cptCodeId: string) =>
    api.get(`/insurance-coding/payers/${payerId}/cpt-rules/${cptCodeId}`),

  createPayerCPTRule: (payerId: string, data: {
    cptCodeId: string;
    isCovered?: boolean;
    requiresPreAuth?: boolean;
    priceOverride?: number;
    maxUnitsPerVisit?: number;
    maxUnitsPerYear?: number;
    frequencyLimit?: string;
    ageMinimum?: number;
    ageMaximum?: number;
    genderRestriction?: string;
    placeOfService?: string[];
    requiresModifier?: string[];
    documentationNotes?: string;
    effectiveDate?: string;
    terminationDate?: string;
    isActive?: boolean;
  }) => api.post(`/insurance-coding/payers/${payerId}/cpt-rules`, data),

  updatePayerCPTRule: (payerId: string, ruleId: string, data: Partial<{
    isCovered?: boolean;
    requiresPreAuth?: boolean;
    priceOverride?: number;
    maxUnitsPerVisit?: number;
    maxUnitsPerYear?: number;
    frequencyLimit?: string;
    ageMinimum?: number;
    ageMaximum?: number;
    genderRestriction?: string;
    placeOfService?: string[];
    requiresModifier?: string[];
    documentationNotes?: string;
    effectiveDate?: string;
    terminationDate?: string;
    isActive?: boolean;
  }>) => api.put(`/insurance-coding/payers/${payerId}/cpt-rules/${ruleId}`, data),

  deletePayerCPTRule: (payerId: string, ruleId: string) =>
    api.delete(`/insurance-coding/payers/${payerId}/cpt-rules/${ruleId}`),

  bulkImportPayerCPTRules: (payerId: string, rules: Array<{
    cptCodeId: string;
    isCovered?: boolean;
    requiresPreAuth?: boolean;
    [key: string]: any;
  }>) => api.post(`/insurance-coding/payers/${payerId}/cpt-rules/bulk`, { rules }),

  // ==================== Coverage Checks ====================
  checkICDCoverage: (data: {
    payerId: string;
    icdCode: string;
    patientAge?: number;
    patientGender?: string;
  }) => api.post('/insurance-coding/check-icd-coverage', data),

  checkCPTCoverage: (data: {
    payerId: string;
    cptCode: string;
    patientAge?: number;
    patientGender?: string;
    placeOfService?: string;
  }) => api.post('/insurance-coding/check-cpt-coverage', data),

  // ==================== Medical Necessity (ICD-CPT Mappings) ====================
  getICDCPTMappings: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    icd10CodeId?: string;
    cptCodeId?: string;
    isRequired?: boolean;
    isCommon?: boolean;
    isActive?: boolean;
  }) => api.get('/insurance-coding/icd-cpt-mappings', { params }),

  getValidCPTsForICD: (icdCodeId: string) =>
    api.get(`/insurance-coding/icd-cpt-mappings/for-icd/${icdCodeId}`),

  getValidICDsForCPT: (cptCodeId: string) =>
    api.get(`/insurance-coding/icd-cpt-mappings/for-cpt/${cptCodeId}`),

  createICDCPTMapping: (data: {
    icd10CodeId: string;
    cptCodeId: string;
    validityScore?: number;
    isRequired?: boolean;
    isCommon?: boolean;
    documentation?: string;
    notes?: string;
    isActive?: boolean;
  }) => api.post('/insurance-coding/icd-cpt-mappings', data),

  updateICDCPTMapping: (id: string, data: Partial<{
    validityScore?: number;
    isRequired?: boolean;
    isCommon?: boolean;
    documentation?: string;
    notes?: string;
    isActive?: boolean;
  }>) => api.put(`/insurance-coding/icd-cpt-mappings/${id}`, data),

  deleteICDCPTMapping: (id: string) => api.delete(`/insurance-coding/icd-cpt-mappings/${id}`),

  bulkImportICDCPTMappings: (mappings: Array<{
    icd10CodeId: string;
    cptCodeId: string;
    validityScore?: number;
    isRequired?: boolean;
    isCommon?: boolean;
    [key: string]: any;
  }>) => api.post('/insurance-coding/icd-cpt-mappings/bulk', { mappings }),

  validateICDCPTPair: (data: { icd10Code: string; cptCode: string }) =>
    api.post('/insurance-coding/validate-pair', data),

  getRequiredCPTsForICDs: (icd10CodeIds: string[]) =>
    api.post('/insurance-coding/required-cpts', { icd10CodeIds }),

  suggestCPTsForDiagnoses: (icdCodes: string[]) =>
    api.post('/insurance-coding/suggest-cpts', { icdCodes }),

  // Analytics
  getAnalyticsDashboard: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/insurance-coding/analytics/dashboard', { params }),

  getICD10Usage: (params?: { startDate?: string; endDate?: string; limit?: number }) =>
    api.get('/insurance-coding/analytics/icd-usage', { params }),

  getCPTUsage: (params?: { startDate?: string; endDate?: string; limit?: number }) =>
    api.get('/insurance-coding/analytics/cpt-usage', { params }),

  getRevenueByCategory: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/insurance-coding/analytics/revenue', { params }),

  getAIAdoptionMetrics: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/insurance-coding/analytics/ai-adoption', { params }),

  getCodingTrends: (params?: { startDate?: string; endDate?: string; granularity?: 'day' | 'week' | 'month' }) =>
    api.get('/insurance-coding/analytics/trends', { params }),

  getTopCodePairs: (params?: { startDate?: string; endDate?: string; limit?: number }) =>
    api.get('/insurance-coding/analytics/code-pairs', { params }),

  getSpecificityAnalysis: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/insurance-coding/analytics/specificity', { params }),

  getDischargeCodingAnalytics: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/insurance-coding/analytics/discharge', { params }),
};

// =============================================================================
// CLINICIAN DASHBOARD API (A'mad Precision Health Platform)
// =============================================================================

export const clinicianApi = {
  // Patient Roster
  getPatientRoster: (params?: {
    search?: string;
    hasGenomic?: boolean;
    hasWearable?: boolean;
    limit?: number;
    offset?: number;
  }) => api.get('/clinician/patients', { params }),

  // Patient Health Summary
  getPatientSummary: (patientId: string) =>
    api.get(`/clinician/patients/${patientId}/summary`),

  // Health Event Timeline
  getPatientTimeline: (patientId: string, params?: { days?: number }) =>
    api.get(`/clinician/patients/${patientId}/timeline`, { params }),

  // Clinical Notes
  getPatientNotes: (patientId: string, params?: {
    noteType?: string;
    limit?: number;
    offset?: number;
  }) => api.get(`/clinician/patients/${patientId}/notes`, { params }),

  addPatientNote: (patientId: string, data: {
    noteType: 'GENERAL' | 'GENOMIC_REVIEW' | 'WEARABLE_REVIEW' | 'LAB_INTERPRETATION' | 'RECOMMENDATION_OVERRIDE' | 'CARE_PLAN';
    content: string;
    isPrivate?: boolean;
  }) => api.post(`/clinician/patients/${patientId}/notes`, data),

  // Alerts
  getAlerts: (params?: { acknowledged?: boolean }) =>
    api.get('/clinician/alerts', { params }),

  // Reports
  generateReport: (data: {
    patientId: string;
    reportType?: 'summary' | 'genomic' | 'wearable' | 'comprehensive';
  }) => api.post('/clinician/reports/generate', data),

  // Patient Recommendations (from recommendationRoutes)
  getPatientRecommendations: (patientId: string, params?: {
    status?: string;
    category?: string;
  }) => api.get(`/recommendations/patients/${patientId}`, { params }),

  createPatientRecommendation: (patientId: string, data: {
    category?: string;
    priority?: string;
    title: string;
    description: string;
    reasoning?: string;
    validDays?: number;
  }) => api.post(`/recommendations/patients/${patientId}`, data),
};

// =============================================================================
// CRM API (Customer Relationship Management)
// =============================================================================

export const crmApi = {
  // Leads
  getLeads: (params?: any) => api.get('/crm/leads', { params }),
  createLead: (data: any) => api.post('/crm/leads', data),
  getLead: (id: string) => api.get(`/crm/leads/${id}`),
  updateLead: (id: string, data: any) => api.put(`/crm/leads/${id}`, data),
  deleteLead: (id: string) => api.delete(`/crm/leads/${id}`),
  updateLeadStatus: (id: string, status: string, reason?: string) =>
    api.patch(`/crm/leads/${id}/status`, { status, reason }),
  assignLead: (id: string, assignedToId: string) =>
    api.patch(`/crm/leads/${id}/assign`, { assignedToId }),
  convertLead: (id: string, patientData: any) =>
    api.post(`/crm/leads/${id}/convert`, patientData),
  getLeadTimeline: (id: string) => api.get(`/crm/leads/${id}/timeline`),
  getLeadStats: (params?: any) => api.get('/crm/leads/stats', { params }),

  // Communications
  getCommunications: (params?: any) => api.get('/crm/communications', { params }),
  logCommunication: (data: any) => api.post('/crm/communications', data),
  getCommunicationStats: () => api.get('/crm/communications/stats'),

  // Templates
  getTemplates: (params?: any) => api.get('/crm/templates', { params }),
  createTemplate: (data: any) => api.post('/crm/templates', data),
  updateTemplate: (id: string, data: any) => api.put(`/crm/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/crm/templates/${id}`),
  previewTemplate: (id: string, variables: Record<string, string>) =>
    api.post(`/crm/templates/${id}/preview`, variables),

  // Tasks
  getTasks: (params?: any) => api.get('/crm/tasks', { params }),
  createTask: (data: any) => api.post('/crm/tasks', data),
  updateTask: (id: string, data: any) => api.put(`/crm/tasks/${id}`, data),
  updateTaskStatus: (id: string, status: string, outcome?: string) =>
    api.patch(`/crm/tasks/${id}/status`, { status, outcome }),
  getMyTasks: () => api.get('/crm/tasks/my'),
  getOverdueTasks: () => api.get('/crm/tasks/overdue'),

  // Activities
  getActivities: (params?: any) => api.get('/crm/activities', { params }),
  logActivity: (data: any) => api.post('/crm/activities', data),

  // Campaigns
  getCampaigns: (params?: any) => api.get('/crm/campaigns', { params }),
  createCampaign: (data: any) => api.post('/crm/campaigns', data),
  getCampaign: (id: string) => api.get(`/crm/campaigns/${id}`),
  updateCampaign: (id: string, data: any) => api.put(`/crm/campaigns/${id}`, data),
  launchCampaign: (id: string) => api.post(`/crm/campaigns/${id}/launch`),
  pauseCampaign: (id: string) => api.patch(`/crm/campaigns/${id}/pause`),
  getCampaignAnalytics: (id: string) => api.get(`/crm/campaigns/${id}/analytics`),

  // Surveys
  getSurveys: (params?: any) => api.get('/crm/surveys', { params }),
  createSurvey: (data: any) => api.post('/crm/surveys', data),
  getSurvey: (id: string) => api.get(`/crm/surveys/${id}`),
  updateSurvey: (id: string, data: any) => api.put(`/crm/surveys/${id}`, data),
  getSurveyResponses: (id: string, params?: any) =>
    api.get(`/crm/surveys/${id}/responses`, { params }),
  getSurveyAnalytics: (id: string) => api.get(`/crm/surveys/${id}/analytics`),

  // Tags
  getTags: () => api.get('/crm/tags'),
  createTag: (data: any) => api.post('/crm/tags', data),
  updateTag: (id: string, data: any) => api.put(`/crm/tags/${id}`, data),
  deleteTag: (id: string) => api.delete(`/crm/tags/${id}`),

  // Reports
  getDashboard: (params?: any) => api.get('/crm/reports/dashboard', { params }),
  getLeadConversionReport: (params?: any) =>
    api.get('/crm/reports/lead-conversion', { params }),
  getStaffPerformanceReport: (params?: any) =>
    api.get('/crm/reports/staff-performance', { params }),

  // Settings
  getSettings: () => api.get('/crm/settings'),
  updateSettings: (data: any) => api.put('/crm/settings', data),
};

// =============================================================================
// Consultant Referral API
// =============================================================================

export const referralApi = {
  // Create a new referral
  create: (data: {
    sourceConsultationId?: string;
    sourceAppointmentId: string;
    referringDoctorId?: string;
    patientId: string;
    targetDepartmentId: string;
    targetDoctorId?: string;
    reason: string;
    urgency: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
    clinicalNotes?: string;
  }) => api.post('/referrals', data),

  // Get referrals created by the logged-in doctor
  getMyReferrals: (params?: { page?: number; limit?: number }) =>
    api.get('/referrals', { params }),

  // Get referral queue for receptionists
  getQueue: (params?: {
    urgency?: 'EMERGENCY' | 'URGENT' | 'ROUTINE';
    departmentId?: string;
    status?: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
    page?: number;
    limit?: number;
  }) => api.get('/referrals/queue', { params }),

  // Get referral statistics
  getStatistics: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/referrals/statistics', { params }),

  // Get referrals for a specific patient
  getPatientReferrals: (patientId: string) =>
    api.get(`/referrals/patient/${patientId}`),

  // Get a specific referral by ID
  getById: (id: string) => api.get(`/referrals/${id}`),

  // Get available slots for a referral (EMERGENCY flow)
  getSlots: (id: string, date?: string) =>
    api.get(`/referrals/${id}/slots`, { params: { date } }),

  // Schedule appointment for a referral (URGENT flow - by receptionist)
  schedule: (id: string, data: {
    appointmentDate: string;
    startTime: string;
    endTime: string;
    notes?: string;
  }) => api.post(`/referrals/${id}/schedule`, data),

  // Book appointment from patient portal (ROUTINE flow)
  bookFromPortal: (id: string, data: {
    appointmentDate: string;
    startTime: string;
    endTime: string;
  }) => api.post(`/referrals/${id}/book`, data),

  // Mark referral as completed
  complete: (id: string, notes?: string) =>
    api.patch(`/referrals/${id}/complete`, { notes }),

  // Cancel a referral
  cancel: (id: string, reason: string) =>
    api.patch(`/referrals/${id}/cancel`, { reason }),

  // Expire old referrals (admin)
  expireOld: () => api.post('/referrals/expire'),
};

export default api;
