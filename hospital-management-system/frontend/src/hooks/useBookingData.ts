import { useQuery } from '@tanstack/react-query';
import { opdApi } from '../services/api';

// Types for booking ticket data
export interface BookingTicketData {
  appointment: {
    id: string;
    tokenNumber: number | null;
    status: string;
    type: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    reason: string | null;
    notes: string | null;
    checkedInAt: string | null;
    vitalsRecordedAt: string | null;
    isFollowUp: boolean;
    parentAppointmentId: string | null;
    createdAt: string;
  };
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    phone: string;
    email: string | null;
    dateOfBirth: string;
    gender: string;
    bloodGroup: string | null;
    allergies: Array<{
      id: string;
      allergen: string;
      severity: string;
      reaction: string | null;
    }>;
    medicalHistory: Array<{
      id: string;
      condition: string;
      diagnosedDate: string;
      status: string | null;
    }>;
  };
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
    specialization: string;
    department: {
      id: string;
      name: string;
    };
  };
  vitals: {
    id: string;
    temperature: number | null;
    bloodPressureSys: number | null;
    bloodPressureDia: number | null;
    heartRate: number | null;
    respiratoryRate: number | null;
    oxygenSaturation: number | null;
    weight: number | null;
    height: number | null;
    bmi: number | null;
    bloodSugar: number | null;
    painLevel: number | null;
    notes: string | null;
    recordedBy: string;
    recordedAt: string;
  } | null;
  riskPrediction: {
    riskScore: number;
    riskLevel: string;
    predictionType: string;
    factors: any;
    recommendations: string[];
    createdAt: string;
  } | null;
  consultation: {
    id: string;
    chiefComplaint: string;
    historyOfIllness: string | null;
    examination: string | null;
    diagnosis: string[];
    icdCodes: string[];
    treatmentPlan: string | null;
    advice: string | null;
    followUpDate: string | null;
    prescriptions: any[];
    createdAt: string;
  } | null;
  labOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    priority: string;
    orderedAt: string;
    completedAt: string | null;
    tests: Array<{
      id: string;
      name: string;
      category: string;
      status: string;
      result: string | null;
      resultValue: number | null;
      unit: string | null;
      normalRange: string | null;
      isAbnormal: boolean;
      isCritical: boolean;
      comments: string | null;
      performedAt: string | null;
    }>;
  }>;
  imagingOrders: Array<{
    id: string;
    orderNumber: string;
    modalityType: string;
    bodyPart: string;
    status: string;
    priority: string;
    orderedAt: string;
  }>;
  clinicalNotes: Array<{
    id: string;
    noteType: string;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    status: string;
    author: string | null;
    createdAt: string;
  }>;
  timeline: Array<{
    timestamp: string;
    event: string;
    actor?: string;
    details?: string;
  }>;
}

export interface PatientHistoryData {
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
  };
  bookings: Array<{
    id: string;
    appointmentDate: string;
    type: string;
    doctor: {
      name: string;
      specialization: string;
      department: string;
    };
    vitals: {
      bloodPressureSys: number | null;
      bloodPressureDia: number | null;
      heartRate: number | null;
      temperature: number | null;
      oxygenSaturation: number | null;
      weight: number | null;
      recordedAt: string;
    } | null;
    consultation: {
      chiefComplaint: string;
      diagnosis: string[];
      icdCodes: string[];
      treatmentPlan: string | null;
      followUpDate: string | null;
      prescriptionCount: number;
      labOrderCount: number;
      labResults: Array<{
        testName: string;
        result: string | null;
        isAbnormal: boolean;
        isCritical: boolean;
      }>;
    } | null;
  }>;
}

/**
 * Hook to fetch unified booking ticket data with polling
 * @param appointmentId - The appointment/booking ID to fetch data for
 * @param pollingInterval - Polling interval in milliseconds (default 15000ms = 15s)
 * @param enabled - Whether the query should be enabled (default true when appointmentId is provided)
 */
export function useBookingData(
  appointmentId: string | null,
  pollingInterval: number = 15000,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['booking-ticket', appointmentId],
    queryFn: async () => {
      const response = await opdApi.getBookingTicket(appointmentId!);
      return response.data.data as BookingTicketData;
    },
    enabled: !!appointmentId && enabled,
    refetchInterval: pollingInterval,
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Hook to fetch patient booking history for follow-up context
 * @param patientId - The patient ID to fetch history for
 * @param limit - Maximum number of past bookings to fetch (default 10)
 * @param enabled - Whether the query should be enabled
 */
export function usePatientHistory(
  patientId: string | null,
  limit: number = 10,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['patient-history', patientId, limit],
    queryFn: async () => {
      const response = await opdApi.getPatientHistory(patientId!, limit);
      return response.data.data as PatientHistoryData;
    },
    enabled: !!patientId && enabled,
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Helper function to get status color based on appointment status
 */
export function getStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'SCHEDULED':
      return 'text-blue-600 bg-blue-100';
    case 'CONFIRMED':
      return 'text-indigo-600 bg-indigo-100';
    case 'CHECKED_IN':
      return 'text-yellow-600 bg-yellow-100';
    case 'IN_PROGRESS':
      return 'text-orange-600 bg-orange-100';
    case 'COMPLETED':
      return 'text-green-600 bg-green-100';
    case 'CANCELLED':
      return 'text-gray-600 bg-gray-100';
    case 'NO_SHOW':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

/**
 * Helper function to get lab order status color
 */
export function getLabOrderStatusColor(status: string): string {
  switch (status.toUpperCase()) {
    case 'ORDERED':
      return 'text-blue-600 bg-blue-100';
    case 'SAMPLE_COLLECTED':
      return 'text-yellow-600 bg-yellow-100';
    case 'IN_PROGRESS':
      return 'text-orange-600 bg-orange-100';
    case 'COMPLETED':
      return 'text-green-600 bg-green-100';
    case 'CANCELLED':
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

/**
 * Helper function to format timeline event
 */
export function formatTimelineEvent(event: string): string {
  switch (event) {
    case 'APPOINTMENT_CREATED':
      return 'Appointment Scheduled';
    case 'CHECKED_IN':
      return 'Patient Checked In';
    case 'VITALS_RECORDED':
      return 'Vitals Recorded';
    case 'CONSULTATION_STARTED':
      return 'Consultation Started';
    case 'LAB_ORDERED':
      return 'Lab Tests Ordered';
    case 'LAB_COMPLETED':
      return 'Lab Results Ready';
    case 'CONSULTATION_COMPLETED':
      return 'Consultation Completed';
    default:
      return event.replace(/_/g, ' ');
  }
}
