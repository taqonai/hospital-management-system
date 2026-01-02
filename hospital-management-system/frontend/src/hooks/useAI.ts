import { useMutation, useQuery } from '@tanstack/react-query';
import { aiApi } from '../services/api';
import {
  AIDiagnosisResponse,
  AIPrediction,
  AIImageAnalysis,
  AIHealthStatus,
} from '../types';
import toast from 'react-hot-toast';

// AI Health Check
export function useAIHealth() {
  return useQuery({
    queryKey: ['ai-health'],
    queryFn: async () => {
      const response = await aiApi.getHealth();
      return response.data.data as AIHealthStatus;
    },
    refetchInterval: 30000, // Check every 30 seconds
    staleTime: 10000,
  });
}

// Direct Diagnosis (no database required)
export function useDirectDiagnosis() {
  return useMutation({
    mutationFn: async (data: {
      symptoms: string[];
      patientAge: number;
      gender: 'MALE' | 'FEMALE' | 'OTHER';
      medicalHistory?: string[];
      currentMedications?: string[];
      allergies?: string[];
    }) => {
      const response = await aiApi.testDiagnose(data);
      return response.data.data as AIDiagnosisResponse;
    },
    onSuccess: () => {
      toast.success('AI diagnosis analysis complete');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Diagnosis analysis failed';
      toast.error(message);
    },
  });
}

// Direct Risk Prediction (no database required)
export function useDirectRiskPrediction() {
  return useMutation({
    mutationFn: async (data: {
      predictionType: string;
      timeframe?: string;
      patientData: {
        age: number;
        gender: string;
        chronicConditions?: string[];
        medications?: string[];
        recentAdmissions?: number;
        lengthOfStay?: number;
        vitals?: Record<string, any>;
      };
    }) => {
      const response = await aiApi.testPredictRisk(data);
      return response.data.data as AIPrediction;
    },
    onSuccess: () => {
      toast.success('Risk prediction complete');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Risk prediction failed';
      toast.error(message);
    },
  });
}

// Direct Image Analysis (no database required)
export function useDirectImageAnalysis() {
  return useMutation({
    mutationFn: async (data: {
      imageUrl: string;
      modalityType: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND';
      bodyPart: string;
      patientAge: number;
      patientGender: 'male' | 'female' | 'other';
      clinicalHistory?: string;
    }) => {
      const response = await aiApi.testAnalyzeImage(data);
      return response.data.data as AIImageAnalysis;
    },
    onSuccess: () => {
      toast.success('Image analysis complete');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Image analysis failed';
      toast.error(message);
    },
  });
}

// Patient-based Diagnosis (requires patient in database)
export function usePatientDiagnosis() {
  return useMutation({
    mutationFn: async (data: { patientId: string; symptoms: string[] }) => {
      const response = await aiApi.analyzeDiagnosis(data);
      return response.data.data;
    },
    onSuccess: () => {
      toast.success('Patient diagnosis analysis complete');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Diagnosis failed';
      toast.error(message);
    },
  });
}

// Patient-based Risk Prediction
export function usePatientRiskPrediction() {
  return useMutation({
    mutationFn: async (data: { patientId: string; predictionType: string }) => {
      const response = await aiApi.predictRisk(data);
      return response.data.data as AIPrediction;
    },
    onSuccess: () => {
      toast.success('Patient risk prediction complete');
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Risk prediction failed';
      toast.error(message);
    },
  });
}

// Patient AI Insights
export function usePatientAIInsights(patientId: string) {
  return useQuery({
    queryKey: ['ai-insights', patientId],
    queryFn: async () => {
      const response = await aiApi.getInsights(patientId);
      return response.data.data;
    },
    enabled: !!patientId,
  });
}

// AI Feedback
export function useAIFeedback() {
  return useMutation({
    mutationFn: async ({
      type,
      id,
      feedback,
    }: {
      type: 'diagnosis' | 'prediction' | 'image';
      id: string;
      feedback: { isAccepted?: boolean; feedback?: string };
    }) => {
      const response = await aiApi.provideFeedback(type, id, feedback);
      return response.data.data;
    },
    onSuccess: () => {
      toast.success('Feedback submitted');
    },
    onError: () => {
      toast.error('Failed to submit feedback');
    },
  });
}

// Helper functions
export function getRiskLevelColor(level: string): string {
  switch (level.toUpperCase()) {
    case 'LOW':
      return 'text-green-600 bg-green-100';
    case 'MODERATE':
      return 'text-yellow-600 bg-yellow-100';
    case 'HIGH':
      return 'text-orange-600 bg-orange-100';
    case 'CRITICAL':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

export function getUrgencyColor(urgency: string): string {
  switch (urgency.toLowerCase()) {
    case 'routine':
      return 'text-green-600 bg-green-100';
    case 'urgent':
      return 'text-yellow-600 bg-yellow-100';
    case 'emergent':
      return 'text-orange-600 bg-orange-100';
    case 'critical':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'mild':
      return 'text-green-700 bg-green-50 border-green-200';
    case 'moderate':
      return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'severe':
      return 'text-red-700 bg-red-50 border-red-200';
    default:
      return 'text-gray-700 bg-gray-50 border-gray-200';
  }
}
