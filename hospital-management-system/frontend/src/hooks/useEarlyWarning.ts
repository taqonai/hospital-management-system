import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

const API_BASE = 'http://localhost:3000/api/v1';

// Types
export interface CurrentMedication {
  name: string;
  dosage?: string;
  frequency?: string;
}

export interface VitalsInput {
  respiratoryRate: number;
  oxygenSaturation: number;
  supplementalOxygen: boolean;
  temperature: number;
  systolicBP: number;
  diastolicBP: number;
  heartRate: number;
  consciousness: 'alert' | 'voice' | 'pain' | 'unresponsive';
  // Patient details (filled during vital recording)
  isPregnant?: boolean;
  expectedDueDate?: string;
  currentMedications?: CurrentMedication[];
  currentTreatment?: string;
}

export interface NEWS2Result {
  totalScore: number;
  scores: Record<string, number>;
  components: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  severity: string;
  clinicalResponse: string;
  hasExtremeScore: boolean;
}

export interface Patient {
  patientId: string;
  patientName: string;
  mrn: string;
  admissionId: string;
  ward: string;
  wardId: string;
  bed: string;
  age?: number;
  gender?: string;
  dateOfBirth?: string;
  news2Score: number;
  riskLevel: string;
  severity: string;
  clinicalResponse: string;
  components: string[];
  trend: 'stable' | 'worsening' | 'improving';
  lastVitalsTime: string | null;
  vitalsOverdue: boolean;
  latestVitals: {
    respiratoryRate?: number;
    oxygenSaturation?: string;
    systolicBP?: number;
    diastolicBP?: number;
    heartRate?: number;
    temperature?: string;
    // Patient details from last vital
    isPregnant?: boolean;
    expectedDueDate?: string;
    currentMedications?: CurrentMedication[];
    currentTreatment?: string;
  } | null;
  qsofaScore?: number;
  fallRisk?: 'low' | 'medium' | 'high';
  sepsisAlert?: boolean;
}

export interface Alert {
  id: string;
  patientId: string;
  patientName: string;
  ward: string;
  bed: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  news2Score: number;
  riskLevel: string;
  scoreBreakdown?: Record<string, number>;
  components: string[];
  clinicalResponse: string;
  hasExtremeScore?: boolean;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'escalated';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  escalationLevel?: number;
}

export interface DashboardData {
  patients: Patient[];
  stats: {
    totalPatients: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    vitalsOverdueCount: number;
    worseningCount: number;
    improvingCount: number;
  };
  wards: { id: string; name: string; type: string }[];
  timestamp: string;
}

export interface TrendData {
  labels: string[];
  respiratoryRate: (number | null)[];
  oxygenSaturation: (number | null)[];
  systolicBP: (number | null)[];
  diastolicBP: (number | null)[];
  heartRate: (number | null)[];
  temperature: (number | null)[];
  news2Scores: number[];
}

// Helper to get auth token
const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

/**
 * Hook for calculating NEWS2 score from vitals
 */
export function useNEWS2Calculation() {
  const calculateNEWS2 = useCallback((vitals: VitalsInput): NEWS2Result => {
    const scores: Record<string, number> = {};
    const components: string[] = [];

    // Respiration Rate scoring
    if (vitals.respiratoryRate <= 8) {
      scores.respiratoryRate = 3;
      components.push(`Respiratory rate critically low (${vitals.respiratoryRate}/min): +3`);
    } else if (vitals.respiratoryRate <= 11) {
      scores.respiratoryRate = 1;
      components.push(`Respiratory rate low (${vitals.respiratoryRate}/min): +1`);
    } else if (vitals.respiratoryRate <= 20) {
      scores.respiratoryRate = 0;
    } else if (vitals.respiratoryRate <= 24) {
      scores.respiratoryRate = 2;
      components.push(`Respiratory rate elevated (${vitals.respiratoryRate}/min): +2`);
    } else {
      scores.respiratoryRate = 3;
      components.push(`Respiratory rate critically high (${vitals.respiratoryRate}/min): +3`);
    }

    // SpO2 scoring (Scale 1 - for non-hypercapnic patients)
    if (vitals.oxygenSaturation <= 91) {
      scores.oxygenSaturation = 3;
      components.push(`SpO2 critically low (${vitals.oxygenSaturation}%): +3`);
    } else if (vitals.oxygenSaturation <= 93) {
      scores.oxygenSaturation = 2;
      components.push(`SpO2 low (${vitals.oxygenSaturation}%): +2`);
    } else if (vitals.oxygenSaturation <= 95) {
      scores.oxygenSaturation = 1;
      components.push(`SpO2 slightly low (${vitals.oxygenSaturation}%): +1`);
    } else {
      scores.oxygenSaturation = 0;
    }

    // Supplemental Oxygen
    if (vitals.supplementalOxygen) {
      scores.supplementalOxygen = 2;
      components.push('On supplemental oxygen: +2');
    } else {
      scores.supplementalOxygen = 0;
    }

    // Temperature scoring
    if (vitals.temperature <= 35.0) {
      scores.temperature = 3;
      components.push(`Temperature critically low (${vitals.temperature}C): +3`);
    } else if (vitals.temperature <= 36.0) {
      scores.temperature = 1;
      components.push(`Temperature low (${vitals.temperature}C): +1`);
    } else if (vitals.temperature <= 38.0) {
      scores.temperature = 0;
    } else if (vitals.temperature <= 39.0) {
      scores.temperature = 1;
      components.push(`Temperature elevated (${vitals.temperature}C): +1`);
    } else {
      scores.temperature = 2;
      components.push(`Temperature high (${vitals.temperature}C): +2`);
    }

    // Systolic BP scoring
    if (vitals.systolicBP <= 90) {
      scores.systolicBP = 3;
      components.push(`Systolic BP critically low (${vitals.systolicBP}mmHg): +3`);
    } else if (vitals.systolicBP <= 100) {
      scores.systolicBP = 2;
      components.push(`Systolic BP low (${vitals.systolicBP}mmHg): +2`);
    } else if (vitals.systolicBP <= 110) {
      scores.systolicBP = 1;
      components.push(`Systolic BP slightly low (${vitals.systolicBP}mmHg): +1`);
    } else if (vitals.systolicBP <= 219) {
      scores.systolicBP = 0;
    } else {
      scores.systolicBP = 3;
      components.push(`Systolic BP critically high (${vitals.systolicBP}mmHg): +3`);
    }

    // Heart Rate scoring
    if (vitals.heartRate <= 40) {
      scores.heartRate = 3;
      components.push(`Heart rate critically low (${vitals.heartRate}bpm): +3`);
    } else if (vitals.heartRate <= 50) {
      scores.heartRate = 1;
      components.push(`Heart rate low (${vitals.heartRate}bpm): +1`);
    } else if (vitals.heartRate <= 90) {
      scores.heartRate = 0;
    } else if (vitals.heartRate <= 110) {
      scores.heartRate = 1;
      components.push(`Heart rate elevated (${vitals.heartRate}bpm): +1`);
    } else if (vitals.heartRate <= 130) {
      scores.heartRate = 2;
      components.push(`Heart rate high (${vitals.heartRate}bpm): +2`);
    } else {
      scores.heartRate = 3;
      components.push(`Heart rate critically high (${vitals.heartRate}bpm): +3`);
    }

    // Consciousness (AVPU) scoring
    if (vitals.consciousness === 'alert') {
      scores.consciousness = 0;
    } else {
      scores.consciousness = 3;
      components.push(`Altered consciousness (${vitals.consciousness}): +3`);
    }

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const hasExtremeScore = Object.values(scores).some((s) => s === 3);

    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    let clinicalResponse: string;
    let severity: string;

    if (totalScore >= 9 || (totalScore >= 7 && hasExtremeScore)) {
      riskLevel = 'critical';
      severity = 'critical';
      clinicalResponse =
        'EMERGENCY response - Continuous monitoring, immediate senior review, consider ICU/HDU';
    } else if (totalScore >= 7) {
      riskLevel = 'critical';
      severity = 'high';
      clinicalResponse =
        'Emergency response - Continuous monitoring, urgent senior clinical review';
    } else if (totalScore >= 5 || hasExtremeScore) {
      riskLevel = 'high';
      severity = 'high';
      clinicalResponse =
        'Urgent response - Increase monitoring to hourly minimum, urgent clinical review within 30 minutes';
    } else if (totalScore >= 3) {
      riskLevel = 'medium';
      severity = 'medium';
      clinicalResponse =
        'Ward-based response - Increase monitoring to 4-6 hourly, inform nurse-in-charge';
    } else {
      riskLevel = 'low';
      severity = 'low';
      clinicalResponse = 'Continue routine monitoring - Minimum 12 hourly observations';
    }

    return {
      totalScore,
      scores,
      components,
      riskLevel,
      severity,
      clinicalResponse,
      hasExtremeScore,
    };
  }, []);

  /**
   * Calculate qSOFA score for sepsis screening
   */
  const calculateQSOFA = useCallback(
    (vitals: { respiratoryRate: number; systolicBP: number; consciousness: string }): number => {
      let score = 0;
      if (vitals.respiratoryRate >= 22) score++;
      if (vitals.systolicBP <= 100) score++;
      if (vitals.consciousness !== 'alert') score++;
      return score;
    },
    []
  );

  return { calculateNEWS2, calculateQSOFA };
}

/**
 * Hook for fetching and managing patient alerts
 */
export function usePatientAlerts(wardId?: string) {
  const { data, isLoading, error, refetch } = useQuery<Alert[]>({
    queryKey: ['ews-alerts', wardId],
    queryFn: async () => {
      const params = wardId ? `?ward=${wardId}` : '';
      const response = await fetch(`${API_BASE}/early-warning/alerts${params}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }
      const result = await response.json();
      return result.data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000,
  });

  const alerts = data || [];

  const activeAlerts = useMemo(() => alerts.filter((a) => a.status === 'active'), [alerts]);
  const criticalAlerts = useMemo(() => alerts.filter((a) => a.severity === 'critical'), [alerts]);
  const highAlerts = useMemo(() => alerts.filter((a) => a.severity === 'high'), [alerts]);

  return {
    alerts,
    activeAlerts,
    criticalAlerts,
    highAlerts,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for ward overview dashboard data
 */
export function useWardOverview(wardId?: string) {
  const { data, isLoading, error, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ['ews-dashboard', wardId],
    queryFn: async () => {
      const params = wardId ? `?wardId=${wardId}` : '';
      const response = await fetch(`${API_BASE}/early-warning/dashboard${params}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      const result = await response.json();
      return result.data;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Sort patients by risk level
  const sortedPatients = useMemo(() => {
    if (!data?.patients) return [];
    const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...data.patients].sort((a, b) => {
      const orderDiff = (riskOrder[a.riskLevel] ?? 4) - (riskOrder[b.riskLevel] ?? 4);
      if (orderDiff !== 0) return orderDiff;
      return b.news2Score - a.news2Score;
    });
  }, [data?.patients]);

  // Get patients by risk level
  const patientsByRisk = useMemo(() => {
    const grouped: Record<string, Patient[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    sortedPatients.forEach((p) => {
      if (grouped[p.riskLevel]) {
        grouped[p.riskLevel].push(p);
      }
    });
    return grouped;
  }, [sortedPatients]);

  return {
    dashboard: data,
    patients: sortedPatients,
    patientsByRisk,
    stats: data?.stats,
    wards: data?.wards || [],
    isLoading,
    isFetching,
    error,
    refetch,
  };
}

/**
 * Hook for acknowledging alerts
 */
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  const mutation = useMutation<unknown, Error, { alertId: string; notes?: string }>({
    mutationFn: async ({ alertId, notes }: { alertId: string; notes?: string }) => {
      const response = await fetch(`${API_BASE}/early-warning/acknowledge/${alertId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) {
        throw new Error('Failed to acknowledge alert');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ews-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['ews-dashboard'] });
      toast.success('Alert acknowledged');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to acknowledge alert');
    },
  });

  return {
    acknowledgeAlert: mutation.mutate,
    isAcknowledging: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook for escalating alerts
 */
export function useEscalateAlert() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      alertId,
      escalationLevel,
      notes,
    }: {
      alertId: string;
      escalationLevel: number;
      notes?: string;
    }) => {
      const response = await fetch(`${API_BASE}/early-warning/escalate/${alertId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ escalationLevel, notes }),
      });
      if (!response.ok) {
        throw new Error('Failed to escalate alert');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ews-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['ews-dashboard'] });
      toast.success('Alert escalated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to escalate alert');
    },
  });

  return {
    escalateAlert: mutation.mutate,
    isEscalating: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Hook for submitting vitals
 */
export function useVitalsSubmission() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      patientId,
      vitals,
    }: {
      patientId: string;
      vitals: VitalsInput;
    }) => {
      const response = await fetch(`${API_BASE}/early-warning/vitals`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          patientId,
          ...vitals,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit vitals');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ews-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['ews-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['patient-trends'] });
      toast.success('Vitals recorded successfully');
      return data;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to record vitals');
    },
  });

  return {
    submitVitals: mutation.mutate,
    submitVitalsAsync: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
    error: mutation.error,
    data: mutation.data,
  };
}

/**
 * Hook for fetching patient vital trends
 */
export function usePatientTrends(patientId: string | null, hours: number = 24) {
  const { data, isLoading, error, refetch } = useQuery<{ trendData: TrendData }>({
    queryKey: ['patient-trends', patientId, hours],
    queryFn: async () => {
      if (!patientId) throw new Error('No patient ID provided');
      const response = await fetch(
        `${API_BASE}/early-warning/patient/${patientId}/trends?hours=${hours}`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch patient trends');
      }
      return response.json().then((r) => r.data);
    },
    enabled: !!patientId,
    staleTime: 60000,
  });

  return {
    trendData: data?.trendData,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for managing alert sound notifications
 */
export function useAlertSound() {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = localStorage.getItem('ews-sound-enabled');
    return stored !== null ? stored === 'true' : true;
  });

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  const initAudio = useCallback(() => {
    if (!audioContext) {
      const ctx = new AudioContext();
      setAudioContext(ctx);
      return ctx;
    }
    return audioContext;
  }, [audioContext]);

  const playAlertSound = useCallback(
    (severity: 'low' | 'medium' | 'high' | 'critical') => {
      if (!soundEnabled) return;

      const ctx = initAudio();
      if (!ctx) return;

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Different frequencies for different severities
      const frequencies: Record<string, number[]> = {
        low: [440],
        medium: [523, 659],
        high: [659, 784, 880],
        critical: [880, 1047, 880, 1047],
      };

      const freq = frequencies[severity] || [440];
      oscillator.type = severity === 'critical' ? 'square' : 'sine';

      let time = ctx.currentTime;
      freq.forEach((f, i) => {
        oscillator.frequency.setValueAtTime(f, time + i * 0.2);
      });

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + freq.length * 0.2);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + freq.length * 0.2);
    },
    [soundEnabled, initAudio]
  );

  const toggleSound = useCallback(() => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem('ews-sound-enabled', String(newValue));
  }, [soundEnabled]);

  return {
    soundEnabled,
    toggleSound,
    playAlertSound,
  };
}

/**
 * Hook for countdown timer since last assessment
 */
export function useAssessmentCountdown(lastAssessmentTime: string | null) {
  const [timeSince, setTimeSince] = useState<string>('--');
  const [isOverdue, setIsOverdue] = useState(false);

  const calculateTimeSince = useCallback(() => {
    if (!lastAssessmentTime) {
      setTimeSince('No data');
      setIsOverdue(true);
      return;
    }

    const lastTime = new Date(lastAssessmentTime).getTime();
    const now = Date.now();
    const diffMs = now - lastTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) {
      setTimeSince(`${diffMins}m ago`);
    } else if (diffHours < 24) {
      setTimeSince(`${diffHours}h ${diffMins % 60}m ago`);
    } else {
      const days = Math.floor(diffHours / 24);
      setTimeSince(`${days}d ${diffHours % 24}h ago`);
    }

    // Overdue if more than 4 hours for medium/high risk, 12 hours for low risk
    setIsOverdue(diffHours >= 4);
  }, [lastAssessmentTime]);

  // Update every minute
  useState(() => {
    calculateTimeSince();
    const interval = setInterval(calculateTimeSince, 60000);
    return () => clearInterval(interval);
  });

  return { timeSince, isOverdue };
}

export default {
  useNEWS2Calculation,
  usePatientAlerts,
  useWardOverview,
  useAcknowledgeAlert,
  useEscalateAlert,
  useVitalsSubmission,
  usePatientTrends,
  useAlertSound,
  useAssessmentCountdown,
};
