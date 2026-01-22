import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import axios from 'axios';

const EWS_AI_SERVICE = process.env.EWS_AI_SERVICE_URL || 'http://localhost:8012';

// Types
interface VitalsInput {
  respiratoryRate?: number;
  oxygenSaturation?: number;
  supplementalOxygen?: boolean;
  isHypercapnic?: boolean;
  temperature?: number;
  systolicBP?: number;
  diastolicBP?: number;
  heartRate?: number;
  consciousness?: string;
  gcs?: number;
  // Patient details (filled during vital recording)
  isPregnant?: boolean;
  expectedDueDate?: string;
  currentMedications?: Array<{ name: string; dosage?: string; frequency?: string }>;
  currentTreatment?: string;
}

interface PatientData {
  age?: number;
  conditions?: string[];
  chronicConditions?: string[];
  medications?: string[];
  fallHistory?: boolean;
  recentFalls?: number;
  mobilityAid?: string;
  hasIV?: boolean;
  gait?: string;
  mentalStatus?: string;
  recentRapidResponse?: boolean;
  recentICUTransfer?: boolean;
}

interface NEWS2Result {
  totalScore: number;
  scores: Record<string, number>;
  components: string[];
  riskLevel: string;
  severity: string;
  clinicalResponse: string;
  hasExtremeScore: boolean;
  timeToReassessment: string;
  timestamp: string;
  modelVersion: string;
}

interface qSOFAResult {
  qsofaScore: number;
  scores: Record<string, number>;
  components: string[];
  sepsisRisk: string;
  sepsisProbability: number;
  recommendation: string;
  additionalIndicators: string[];
  requiresSepsisWorkup: boolean;
  timestamp: string;
  modelVersion: string;
}

interface FallRiskResult {
  fallRiskScore: number;
  riskLevel: string;
  factors: string[];
  interventions: string[];
  requiresFallProtocol: boolean;
  timestamp: string;
  modelVersion: string;
}

interface EWSAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  action: string;
  timestamp: string;
  patientId?: string;
  patientName?: string;
  ward?: string;
  bed?: string;
}

interface ComprehensiveAssessment {
  news2Score: number;
  riskLevel: string;
  alerts: EWSAlert[];
  deteriorationProbability: number;
  sepsisRisk: {
    qsofaScore: number;
    riskLevel: string;
    probability: number;
    requiresWorkup: boolean;
    components: string[];
    additionalIndicators: string[];
  };
  fallRisk: {
    score: number;
    riskLevel: string;
    factors: string[];
    interventions: string[];
  };
  recommendedActions: string[];
  escalationRequired: boolean;
  timeToReassessment: string;
  timestamp: string;
  modelVersion: string;
}

export class EarlyWarningService {
  /**
   * Calculate NEWS2 score from vitals via AI service
   */
  async calculateNEWS2(vitals: VitalsInput): Promise<NEWS2Result> {
    try {
      const response = await axios.post(`${EWS_AI_SERVICE}/api/ews/calculate`, {
        vitals,
      });
      return response.data;
    } catch (error) {
      // Fallback to local calculation if AI service unavailable
      return this.localCalculateNEWS2(vitals);
    }
  }

  /**
   * Calculate qSOFA score for sepsis screening via AI service
   */
  async calculateQSOFA(vitals: VitalsInput): Promise<qSOFAResult> {
    try {
      const response = await axios.post(`${EWS_AI_SERVICE}/api/ews/qsofa`, {
        vitals,
      });
      return response.data;
    } catch (error) {
      // Fallback to local calculation
      return this.localCalculateQSOFA(vitals);
    }
  }

  /**
   * Calculate fall risk score via AI service
   */
  async calculateFallRisk(vitals: VitalsInput, patientData?: PatientData): Promise<FallRiskResult> {
    try {
      const response = await axios.post(`${EWS_AI_SERVICE}/api/ews/fall-risk`, {
        vitals,
        patientData,
      });
      return response.data;
    } catch (error) {
      // Fallback to local calculation
      return this.localCalculateFallRisk(vitals, patientData);
    }
  }

  /**
   * Comprehensive assessment combining NEWS2, qSOFA, and fall risk
   */
  async comprehensiveAssessment(
    vitals: VitalsInput,
    vitalsHistory?: any[],
    patientData?: PatientData
  ): Promise<ComprehensiveAssessment> {
    try {
      const response = await axios.post(`${EWS_AI_SERVICE}/api/ews/assess`, {
        vitals,
        vitalsHistory,
        patientData,
      });
      return response.data;
    } catch (error) {
      // Fallback to local comprehensive assessment
      return this.localComprehensiveAssessment(vitals, vitalsHistory, patientData);
    }
  }

  /**
   * Real-time vital sign monitoring
   */
  async monitorVitals(
    patientId: string,
    vitals: VitalsInput,
    vitalsHistory?: any[],
    patientData?: PatientData
  ) {
    try {
      const response = await axios.post(`${EWS_AI_SERVICE}/api/ews/monitor`, {
        patientId,
        vitals,
        vitalsHistory,
        patientData,
      });
      return response.data;
    } catch (error) {
      // Fallback
      const assessment = await this.comprehensiveAssessment(vitals, vitalsHistory, patientData);
      return {
        patientId,
        assessment,
        alertsGenerated: assessment.alerts.length,
        requiresImmediateAction: assessment.escalationRequired,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Local NEWS2 calculation (fallback)
   */
  localCalculateNEWS2(vitals: VitalsInput): NEWS2Result {
    const scores: Record<string, number> = {};
    const components: string[] = [];

    // Respiration Rate
    const rr = vitals.respiratoryRate || 16;
    if (rr <= 8) {
      scores.respiratoryRate = 3;
      components.push(`Respiratory rate critically low (${rr}/min): +3`);
    } else if (rr <= 11) {
      scores.respiratoryRate = 1;
      components.push(`Respiratory rate low (${rr}/min): +1`);
    } else if (rr <= 20) {
      scores.respiratoryRate = 0;
    } else if (rr <= 24) {
      scores.respiratoryRate = 2;
      components.push(`Respiratory rate elevated (${rr}/min): +2`);
    } else {
      scores.respiratoryRate = 3;
      components.push(`Respiratory rate critically high (${rr}/min): +3`);
    }

    // SpO2
    const spo2 = vitals.oxygenSaturation || 98;
    if (spo2 <= 91) {
      scores.oxygenSaturation = 3;
      components.push(`SpO2 critically low (${spo2}%): +3`);
    } else if (spo2 <= 93) {
      scores.oxygenSaturation = 2;
      components.push(`SpO2 low (${spo2}%): +2`);
    } else if (spo2 <= 95) {
      scores.oxygenSaturation = 1;
      components.push(`SpO2 slightly low (${spo2}%): +1`);
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

    // Temperature
    const temp = vitals.temperature || 37.0;
    if (temp <= 35.0) {
      scores.temperature = 3;
      components.push(`Temperature critically low (${temp}C): +3`);
    } else if (temp <= 36.0) {
      scores.temperature = 1;
      components.push(`Temperature low (${temp}C): +1`);
    } else if (temp <= 38.0) {
      scores.temperature = 0;
    } else if (temp <= 39.0) {
      scores.temperature = 1;
      components.push(`Temperature elevated (${temp}C): +1`);
    } else {
      scores.temperature = 2;
      components.push(`Temperature high (${temp}C): +2`);
    }

    // Systolic BP
    const sbp = vitals.systolicBP || 120;
    if (sbp <= 90) {
      scores.systolicBP = 3;
      components.push(`Systolic BP critically low (${sbp}mmHg): +3`);
    } else if (sbp <= 100) {
      scores.systolicBP = 2;
      components.push(`Systolic BP low (${sbp}mmHg): +2`);
    } else if (sbp <= 110) {
      scores.systolicBP = 1;
      components.push(`Systolic BP slightly low (${sbp}mmHg): +1`);
    } else if (sbp <= 219) {
      scores.systolicBP = 0;
    } else {
      scores.systolicBP = 3;
      components.push(`Systolic BP critically high (${sbp}mmHg): +3`);
    }

    // Heart Rate
    const hr = vitals.heartRate || 80;
    if (hr <= 40) {
      scores.heartRate = 3;
      components.push(`Heart rate critically low (${hr}bpm): +3`);
    } else if (hr <= 50) {
      scores.heartRate = 1;
      components.push(`Heart rate low (${hr}bpm): +1`);
    } else if (hr <= 90) {
      scores.heartRate = 0;
    } else if (hr <= 110) {
      scores.heartRate = 1;
      components.push(`Heart rate elevated (${hr}bpm): +1`);
    } else if (hr <= 130) {
      scores.heartRate = 2;
      components.push(`Heart rate high (${hr}bpm): +2`);
    } else {
      scores.heartRate = 3;
      components.push(`Heart rate critically high (${hr}bpm): +3`);
    }

    // Consciousness
    const consciousness = (vitals.consciousness || 'alert').toLowerCase();
    if (consciousness === 'alert') {
      scores.consciousness = 0;
    } else {
      scores.consciousness = 3;
      components.push(`Altered consciousness (${consciousness}): +3`);
    }

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const hasExtremeScore = Object.values(scores).some(s => s === 3);

    let riskLevel: string;
    let clinicalResponse: string;
    let severity: string;
    let timeToReassessment: string;

    if (totalScore >= 7) {
      riskLevel = 'CRITICAL';
      severity = 'critical';
      clinicalResponse = 'Emergency response - continuous monitoring, immediate senior review, consider ICU';
      timeToReassessment = 'Continuous';
    } else if (totalScore >= 5 || hasExtremeScore) {
      riskLevel = 'HIGH';
      severity = 'high';
      clinicalResponse = 'Urgent response - increase monitoring to at least hourly, urgent clinical review within 30 minutes';
      timeToReassessment = '30 minutes';
    } else if (totalScore >= 3) {
      riskLevel = 'MEDIUM';
      severity = 'medium';
      clinicalResponse = 'Ward-based response - increase monitoring to 4-6 hourly, inform nurse-in-charge';
      timeToReassessment = '4 hours';
    } else {
      riskLevel = 'LOW';
      severity = 'low';
      clinicalResponse = 'Continue routine monitoring - minimum 12 hourly';
      timeToReassessment = '12 hours';
    }

    return {
      totalScore,
      scores,
      components,
      riskLevel,
      severity,
      clinicalResponse,
      hasExtremeScore,
      timeToReassessment,
      timestamp: new Date().toISOString(),
      modelVersion: '1.0.0-local',
    };
  }

  /**
   * Local qSOFA calculation (fallback)
   */
  localCalculateQSOFA(vitals: VitalsInput): qSOFAResult {
    const scores: Record<string, number> = {};
    const components: string[] = [];

    // Respiratory Rate >= 22
    const rr = vitals.respiratoryRate || 16;
    if (rr >= 22) {
      scores.respiratoryRate = 1;
      components.push(`Respiratory rate >= 22 (${rr}/min): +1`);
    } else {
      scores.respiratoryRate = 0;
    }

    // Altered mentation
    const consciousness = (vitals.consciousness || 'alert').toLowerCase();
    const gcs = vitals.gcs || 15;
    if (consciousness !== 'alert' || gcs < 15) {
      scores.alteredMentation = 1;
      if (consciousness !== 'alert') {
        components.push(`Altered mental status (${consciousness}): +1`);
      } else {
        components.push(`GCS < 15 (GCS: ${gcs}): +1`);
      }
    } else {
      scores.alteredMentation = 0;
    }

    // Systolic BP <= 100
    const sbp = vitals.systolicBP || 120;
    if (sbp <= 100) {
      scores.systolicBP = 1;
      components.push(`Systolic BP <= 100 (${sbp}mmHg): +1`);
    } else {
      scores.systolicBP = 0;
    }

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

    let sepsisRisk: string;
    let recommendation: string;
    let probability: number;

    if (totalScore >= 2) {
      sepsisRisk = 'HIGH';
      recommendation = 'qSOFA >= 2: High suspicion for sepsis. Initiate Sepsis-3 evaluation, consider lactate level, blood cultures before antibiotics, and urgent physician review.';
      probability = 0.7 + (totalScore - 2) * 0.15;
    } else if (totalScore === 1) {
      sepsisRisk = 'MODERATE';
      recommendation = 'qSOFA = 1: Monitor closely for signs of sepsis. Reassess vitals frequently and consider sepsis screening if clinical suspicion.';
      probability = 0.35;
    } else {
      sepsisRisk = 'LOW';
      recommendation = 'qSOFA = 0: Low current sepsis risk. Continue standard monitoring and reassess if clinical condition changes.';
      probability = 0.1;
    }

    // Additional indicators
    const additionalIndicators: string[] = [];
    const temp = vitals.temperature || 37.0;
    const hr = vitals.heartRate || 80;

    if (temp > 38.3 || temp < 36.0) {
      additionalIndicators.push(`Temperature abnormality (${temp}C)`);
      probability = Math.min(probability + 0.1, 0.95);
    }
    if (hr > 90) {
      additionalIndicators.push(`Tachycardia (${hr}bpm)`);
      probability = Math.min(probability + 0.05, 0.95);
    }

    return {
      qsofaScore: totalScore,
      scores,
      components,
      sepsisRisk,
      sepsisProbability: Math.round(probability * 1000) / 1000,
      recommendation,
      additionalIndicators,
      requiresSepsisWorkup: totalScore >= 2,
      timestamp: new Date().toISOString(),
      modelVersion: '1.0.0-local',
    };
  }

  /**
   * Local fall risk calculation (fallback)
   */
  localCalculateFallRisk(vitals: VitalsInput, patientData?: PatientData): FallRiskResult {
    patientData = patientData || {};
    let score = 0;
    const factors: string[] = [];
    const interventions: string[] = [];

    // History of falling
    if (patientData.fallHistory || (patientData.recentFalls && patientData.recentFalls > 0)) {
      score += 25;
      factors.push(`History of falling (recent falls: ${patientData.recentFalls || 0})`);
      interventions.push('Implement fall precautions protocol');
    }

    // Multiple conditions
    const conditions = patientData.conditions || patientData.chronicConditions || [];
    if (conditions.length >= 2) {
      score += 15;
      factors.push(`Multiple diagnoses (${conditions.length} conditions)`);
      interventions.push('Review medications for fall risk contributors');
    }

    // Ambulatory aid
    const mobilityAid = (patientData.mobilityAid || 'none').toLowerCase();
    if (['walker', 'cane', 'crutches'].includes(mobilityAid)) {
      score += 15;
      factors.push(`Uses ambulatory aid (${mobilityAid})`);
      interventions.push('Ensure mobility aid is within reach');
    }

    // IV therapy
    if (patientData.hasIV) {
      score += 20;
      factors.push('IV therapy in place');
      interventions.push('Ensure IV lines are secured and not a trip hazard');
    }

    // Gait assessment
    const gait = (patientData.gait || 'normal').toLowerCase();
    if (['impaired', 'weak', 'unsteady'].includes(gait)) {
      score += 20;
      factors.push(`Impaired gait (${gait})`);
      interventions.push('Assist with ambulation');
    }

    // Mental status
    const consciousness = (vitals.consciousness || 'alert').toLowerCase();
    const mentalStatus = (patientData.mentalStatus || 'oriented').toLowerCase();
    if (consciousness !== 'alert' || ['confused', 'disoriented', 'impaired'].includes(mentalStatus)) {
      score += 15;
      factors.push(`Altered mental status (${consciousness}/${mentalStatus})`);
      interventions.push('Frequent orientation checks and supervision');
    }

    // Age factor
    const age = patientData.age || 50;
    if (age >= 85) {
      score += 20;
      factors.push(`Advanced age (${age} years)`);
      interventions.push('Age-appropriate fall precautions');
    } else if (age >= 75) {
      score += 15;
      factors.push(`Elderly (${age} years)`);
      interventions.push('Consider age-related fall risks');
    } else if (age >= 65) {
      score += 10;
      factors.push(`Over 65 years (${age} years)`);
    }

    // Low blood pressure
    const sbp = vitals.systolicBP || 120;
    if (sbp < 100) {
      score += 10;
      factors.push(`Low blood pressure (${sbp}mmHg) - orthostatic risk`);
      interventions.push('Assist with position changes, assess for orthostatic hypotension');
    }

    // Determine risk level
    let riskLevel: string;
    let baseInterventions: string[];

    if (score >= 51) {
      riskLevel = 'HIGH';
      baseInterventions = [
        'Implement high fall risk protocol',
        'Bed in lowest position with brakes locked',
        'Non-skid footwear required',
        'Fall risk signage/bracelet',
        'Frequent rounding (every 1-2 hours)',
      ];
    } else if (score >= 25) {
      riskLevel = 'MEDIUM';
      baseInterventions = [
        'Implement moderate fall risk protocol',
        'Bed in low position',
        'Call bell within reach',
        'Toileting assistance offered',
      ];
    } else {
      riskLevel = 'LOW';
      baseInterventions = [
        'Standard fall precautions',
        'Educate patient on fall risks',
        'Ensure call bell accessible',
      ];
    }

    const allInterventions = [...new Set([...baseInterventions, ...interventions])].slice(0, 10);

    return {
      fallRiskScore: score,
      riskLevel,
      factors: factors.slice(0, 8),
      interventions: allInterventions,
      requiresFallProtocol: score >= 25,
      timestamp: new Date().toISOString(),
      modelVersion: '1.0.0-local',
    };
  }

  /**
   * Local comprehensive assessment (fallback)
   */
  localComprehensiveAssessment(
    vitals: VitalsInput,
    vitalsHistory?: any[],
    patientData?: PatientData
  ): ComprehensiveAssessment {
    const news2Result = this.localCalculateNEWS2(vitals);
    const qsofaResult = this.localCalculateQSOFA(vitals);
    const fallRiskResult = this.localCalculateFallRisk(vitals, patientData);

    // Generate alerts
    const alerts: EWSAlert[] = [];

    if (news2Result.totalScore >= 3) {
      alerts.push({
        id: `news2-${Date.now()}`,
        type: 'NEWS2',
        severity: news2Result.severity,
        message: `NEWS2 Score: ${news2Result.totalScore} - ${news2Result.riskLevel} Risk`,
        action: news2Result.clinicalResponse,
        timestamp: new Date().toISOString(),
      });
    }

    if (qsofaResult.qsofaScore >= 2) {
      alerts.push({
        id: `qsofa-${Date.now()}`,
        type: 'SEPSIS',
        severity: 'critical',
        message: `qSOFA Score: ${qsofaResult.qsofaScore} - Sepsis Risk: ${qsofaResult.sepsisRisk}`,
        action: qsofaResult.recommendation,
        timestamp: new Date().toISOString(),
      });
    }

    if (['HIGH', 'MEDIUM'].includes(fallRiskResult.riskLevel)) {
      alerts.push({
        id: `fall-${Date.now()}`,
        type: 'FALL_RISK',
        severity: fallRiskResult.riskLevel === 'HIGH' ? 'high' : 'medium',
        message: `Fall Risk: ${fallRiskResult.riskLevel} (Score: ${fallRiskResult.fallRiskScore})`,
        action: 'Implement fall precautions protocol',
        timestamp: new Date().toISOString(),
      });
    }

    // Determine escalation
    const escalationRequired =
      news2Result.totalScore >= 5 ||
      qsofaResult.qsofaScore >= 2 ||
      news2Result.hasExtremeScore;

    // Get recommendations
    const recommendedActions = this.getRecommendations(news2Result.riskLevel, news2Result);
    if (qsofaResult.qsofaScore >= 1) {
      recommendedActions.push(qsofaResult.recommendation);
    }
    recommendedActions.push(...fallRiskResult.interventions.slice(0, 2));

    // Calculate deterioration probability
    let deteriorationProbability = news2Result.totalScore / 15;
    if (patientData?.age && patientData.age >= 75) {
      deteriorationProbability = Math.min(deteriorationProbability + 0.1, 0.95);
    }

    return {
      news2Score: news2Result.totalScore,
      riskLevel: news2Result.riskLevel,
      alerts,
      deteriorationProbability: Math.round(deteriorationProbability * 1000) / 1000,
      sepsisRisk: {
        qsofaScore: qsofaResult.qsofaScore,
        riskLevel: qsofaResult.sepsisRisk,
        probability: qsofaResult.sepsisProbability,
        requiresWorkup: qsofaResult.requiresSepsisWorkup,
        components: qsofaResult.components,
        additionalIndicators: qsofaResult.additionalIndicators,
      },
      fallRisk: {
        score: fallRiskResult.fallRiskScore,
        riskLevel: fallRiskResult.riskLevel,
        factors: fallRiskResult.factors,
        interventions: fallRiskResult.interventions,
      },
      recommendedActions: [...new Set(recommendedActions)].slice(0, 8),
      escalationRequired,
      timeToReassessment: news2Result.timeToReassessment,
      timestamp: new Date().toISOString(),
      modelVersion: '1.0.0-local',
    };
  }

  /**
   * Get recommendations based on risk level
   */
  private getRecommendations(riskLevel: string, news2Result: NEWS2Result): string[] {
    const recommendations: Record<string, string[]> = {
      CRITICAL: [
        'Activate emergency/rapid response team immediately',
        'Continuous vital sign monitoring',
        'Notify senior physician/attending immediately',
        'Prepare for possible ICU transfer',
      ],
      HIGH: [
        'Increase monitoring frequency to at least hourly',
        'Urgent clinical review within 30 minutes',
        'Notify nurse-in-charge and primary physician',
        'Review current treatment plan',
      ],
      MEDIUM: [
        'Increase monitoring to 4-6 hourly',
        'Inform nurse-in-charge of NEWS2 score',
        'Clinical review within 4 hours',
        'Document trend observations',
      ],
      LOW: [
        'Continue routine monitoring (minimum 12 hourly)',
        'Reassess if clinical condition changes',
        'Document current stable status',
      ],
    };

    return recommendations[riskLevel] || recommendations.LOW;
  }

  /**
   * Record vitals for a patient and calculate NEWS2
   */
  async recordVitalsWithEWS(
    hospitalId: string,
    patientId: string,
    recordedBy: string,
    vitalsData: VitalsInput
  ) {
    // Find patient
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        medicalHistory: true,
      },
    });
    if (!patient) throw new NotFoundError('Patient not found');

    // Get patient data for comprehensive assessment
    const patientData: PatientData = {
      age: patient.dateOfBirth ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 31557600000) : undefined,
      chronicConditions: patient.medicalHistory?.chronicConditions as string[] || [],
    };

    // Get vitals history
    const vitalsHistory = await prisma.vital.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      take: 10,
    });

    // Format history for assessment
    const formattedHistory = vitalsHistory.map(v => ({
      respiratoryRate: v.respiratoryRate,
      oxygenSaturation: v.oxygenSaturation ? Number(v.oxygenSaturation) : undefined,
      systolicBP: v.bloodPressureSys,
      diastolicBP: v.bloodPressureDia,
      heartRate: v.heartRate,
      temperature: v.temperature ? Number(v.temperature) : undefined,
      timestamp: v.recordedAt.toISOString(),
    }));

    // Comprehensive assessment
    const assessment = await this.comprehensiveAssessment(vitalsData, formattedHistory, patientData);

    // Record vitals
    const vitals = await prisma.vital.create({
      data: {
        patientId,
        recordedBy,
        recordedAt: new Date(),
        respiratoryRate: vitalsData.respiratoryRate,
        oxygenSaturation: vitalsData.oxygenSaturation?.toString(),
        bloodPressureSys: vitalsData.systolicBP,
        bloodPressureDia: vitalsData.diastolicBP,
        heartRate: vitalsData.heartRate,
        temperature: vitalsData.temperature,
        notes: vitalsData.consciousness ? `Consciousness: ${vitalsData.consciousness}` : null,
        // Patient details
        isPregnant: vitalsData.isPregnant,
        expectedDueDate: vitalsData.expectedDueDate ? new Date(vitalsData.expectedDueDate) : null,
        currentMedications: vitalsData.currentMedications || null,
        currentTreatment: vitalsData.currentTreatment || null,
      },
    });

    // Map risk level to enum
    const riskLevelMap: Record<string, 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'> = {
      LOW: 'LOW',
      MEDIUM: 'MODERATE',
      HIGH: 'HIGH',
      CRITICAL: 'CRITICAL',
    };

    // Create EWS prediction record
    const prediction = await prisma.aIPrediction.create({
      data: {
        patientId,
        predictionType: 'DETERIORATION',
        riskScore: assessment.deteriorationProbability,
        riskLevel: riskLevelMap[assessment.riskLevel] || 'LOW',
        factors: assessment.recommendedActions.map(c => ({ factor: c, contribution: 1 })),
        recommendations: assessment.recommendedActions,
        modelVersion: assessment.modelVersion,
      },
    });

    // Create alert if NEWS2 >= 3 or high sepsis/fall risk
    let alert = null;
    if (assessment.news2Score >= 3 || assessment.escalationRequired) {
      alert = await this.createAlert(hospitalId, patientId, assessment);
    }

    return {
      vitals,
      assessment,
      prediction,
      alert,
    };
  }

  /**
   * Create an EWS alert
   */
  async createAlert(hospitalId: string, patientId: string, assessment: ComprehensiveAssessment) {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        admissions: {
          where: { status: 'ADMITTED' },
          include: { bed: { include: { ward: true } } },
          take: 1,
        },
      },
    });

    const admission = patient?.admissions[0];
    const ward = admission?.bed?.ward?.name || 'Unknown';
    const bed = admission?.bed?.bedNumber || 'N/A';

    const severityMap: Record<string, string> = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      CRITICAL: 'CRITICAL',
    };

    // Determine alert type and message
    let alertType = 'NEWS2';
    let alertMessage = `NEWS2 Score: ${assessment.news2Score} - ${assessment.riskLevel} Risk`;

    if (assessment.sepsisRisk.requiresWorkup) {
      alertType = 'SEPSIS';
      alertMessage = `qSOFA Score: ${assessment.sepsisRisk.qsofaScore} - High Sepsis Risk`;
    }

    // Use Notification model for alerts
    const alert = await prisma.notification.create({
      data: {
        userId: patientId, // Using patientId as reference
        title: `EWS Alert: ${assessment.riskLevel} Risk - ${alertType}`,
        message: alertMessage,
        type: 'ALERT',
        data: {
          priority: severityMap[assessment.riskLevel] || 'LOW',
          patientId,
          patientName: `${patient?.firstName} ${patient?.lastName}`,
          ward,
          bed,
          news2Score: assessment.news2Score,
          riskLevel: assessment.riskLevel,
          deteriorationProbability: assessment.deteriorationProbability,
          sepsisRisk: assessment.sepsisRisk,
          fallRisk: assessment.fallRisk,
          escalationRequired: assessment.escalationRequired,
          recommendedActions: assessment.recommendedActions,
          alertType: 'EWS',
          ewsAlertType: alertType,
        },
      },
    });

    return alert;
  }

  /**
   * Get patient's EWS history
   */
  async getPatientEWSHistory(patientId: string, limit: number = 20) {
    const vitals = await prisma.vital.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });

    const predictions = await prisma.aIPrediction.findMany({
      where: {
        patientId,
        predictionType: 'DETERIORATION',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Calculate NEWS2 for each vital reading
    const history = vitals.map(v => {
      const vitalsInput: VitalsInput = {
        respiratoryRate: v.respiratoryRate || undefined,
        oxygenSaturation: v.oxygenSaturation ? Number(v.oxygenSaturation) : undefined,
        systolicBP: v.bloodPressureSys || undefined,
        diastolicBP: v.bloodPressureDia || undefined,
        heartRate: v.heartRate || undefined,
        temperature: v.temperature ? Number(v.temperature) : undefined,
      };
      const news2 = this.localCalculateNEWS2(vitalsInput);
      const qsofa = this.localCalculateQSOFA(vitalsInput);

      return {
        id: v.id,
        recordedAt: v.recordedAt,
        vitals: {
          respiratoryRate: v.respiratoryRate,
          oxygenSaturation: v.oxygenSaturation,
          systolicBP: v.bloodPressureSys,
          diastolicBP: v.bloodPressureDia,
          heartRate: v.heartRate,
          temperature: v.temperature,
        },
        news2,
        qsofa,
      };
    });

    return {
      history,
      predictions,
      totalRecords: vitals.length,
    };
  }

  /**
   * Get all active alerts
   */
  async getActiveAlerts(hospitalId: string, filters?: {
    ward?: string;
    severity?: string;
    status?: string;
  }) {
    const where: any = {
      type: 'ALERT',
      read: false,
      metadata: {
        path: ['alertType'],
        equals: 'EWS',
      },
    };

    const alerts = await prisma.notification.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
      ],
      take: 100,
    });

    // Transform alerts
    const transformedAlerts = alerts.map(a => {
      const alertData = a.data as any;
      return {
        id: a.id,
        patientId: alertData?.patientId,
        patientName: alertData?.patientName,
        ward: alertData?.ward,
        bed: alertData?.bed,
        severity: alertData?.priority?.toLowerCase() || 'low',
        title: a.title,
        message: a.message,
        news2Score: alertData?.news2Score,
        riskLevel: alertData?.riskLevel,
        sepsisRisk: alertData?.sepsisRisk,
        fallRisk: alertData?.fallRisk,
        deteriorationProbability: alertData?.deteriorationProbability,
        escalationRequired: alertData?.escalationRequired,
        recommendedActions: alertData?.recommendedActions,
        alertType: alertData?.ewsAlertType,
        timestamp: a.createdAt,
        status: a.isRead ? 'acknowledged' : 'active',
      };
    });

    // Filter by severity if specified
    let filteredAlerts = transformedAlerts;
    if (filters?.severity) {
      filteredAlerts = transformedAlerts.filter(a => a.severity === filters.severity.toLowerCase());
    }

    // Filter by ward if specified
    if (filters?.ward) {
      return filteredAlerts.filter(a => a.ward === filters.ward);
    }

    return filteredAlerts;
  }

  /**
   * Get alerts for a specific patient
   */
  async getPatientAlerts(patientId: string) {
    const alerts = await prisma.notification.findMany({
      where: {
        type: 'ALERT',
        data: {
          path: ['patientId'],
          equals: patientId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return alerts.map(a => {
      const alertData = a.data as any;
      return {
        id: a.id,
        patientId: alertData?.patientId,
        patientName: alertData?.patientName,
        ward: alertData?.ward,
        bed: alertData?.bed,
        severity: alertData?.priority?.toLowerCase() || 'low',
        title: a.title,
        message: a.message,
        news2Score: alertData?.news2Score,
        riskLevel: alertData?.riskLevel,
        sepsisRisk: alertData?.sepsisRisk,
        fallRisk: alertData?.fallRisk,
        deteriorationProbability: alertData?.deteriorationProbability,
        escalationRequired: alertData?.escalationRequired,
        recommendedActions: alertData?.recommendedActions,
        alertType: alertData?.ewsAlertType,
        timestamp: a.createdAt,
        status: a.isRead ? 'acknowledged' : 'active',
        acknowledgedAt: alertData?.acknowledgedAt,
      };
    });
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string, notes?: string) {
    const existingAlert = await prisma.notification.findUnique({ where: { id: alertId } });

    const alert = await prisma.notification.update({
      where: { id: alertId },
      data: {
        isRead: true,
        data: {
          // Preserve existing data
          ...(existingAlert?.data as object || {}),
          acknowledgedBy,
          acknowledgedAt: new Date().toISOString(),
          acknowledgementNotes: notes,
        },
      },
    });

    const alertData = alert.data as any;
    return {
      alertId: alert.id,
      status: 'acknowledged',
      acknowledgedBy,
      acknowledgedAt: alertData?.acknowledgedAt,
      notes,
    };
  }

  /**
   * Get ward-level EWS dashboard
   */
  async getWardDashboard(hospitalId: string, wardId?: string) {
    // Get all admitted patients
    const admissions = await prisma.admission.findMany({
      where: {
        hospitalId,
        status: 'ADMITTED',
        ...(wardId && { bed: { wardId } }),
      },
      include: {
        patient: {
          include: {
            vitals: { orderBy: { recordedAt: 'desc' }, take: 5 },
            medicalHistory: true,
          },
        },
        bed: { include: { ward: true } },
      },
    });

    const patients = admissions.map(admission => {
      const latestVitals = admission.patient.vitals[0];
      let assessment: ComprehensiveAssessment | null = null;
      let trend = 'stable';

      if (latestVitals) {
        const vitalsInput: VitalsInput = {
          respiratoryRate: latestVitals.respiratoryRate || undefined,
          oxygenSaturation: latestVitals.oxygenSaturation ? Number(latestVitals.oxygenSaturation) : undefined,
          systolicBP: latestVitals.bloodPressureSys || undefined,
          diastolicBP: latestVitals.bloodPressureDia || undefined,
          heartRate: latestVitals.heartRate || undefined,
          temperature: latestVitals.temperature ? Number(latestVitals.temperature) : undefined,
        };

        const patientData: PatientData = {
          age: admission.patient.dateOfBirth
            ? Math.floor((Date.now() - new Date(admission.patient.dateOfBirth).getTime()) / 31557600000)
            : undefined,
          chronicConditions: admission.patient.medicalHistory?.chronicConditions as string[] || [],
        };

        assessment = this.localComprehensiveAssessment(vitalsInput, undefined, patientData);

        // Calculate trend from multiple readings
        if (admission.patient.vitals.length >= 2) {
          const scores = admission.patient.vitals.slice(0, 3).map(v => {
            const s = this.localCalculateNEWS2({
              respiratoryRate: v.respiratoryRate || undefined,
              oxygenSaturation: v.oxygenSaturation ? Number(v.oxygenSaturation) : undefined,
              systolicBP: v.bloodPressureSys || undefined,
              heartRate: v.heartRate || undefined,
              temperature: v.temperature ? Number(v.temperature) : undefined,
            });
            return s.totalScore;
          });

          if (scores[0] > scores[scores.length - 1] + 1) trend = 'worsening';
          else if (scores[0] < scores[scores.length - 1] - 1) trend = 'improving';
        }
      }

      const vitalsOverdue = latestVitals
        ? Date.now() - new Date(latestVitals.recordedAt).getTime() > 4 * 60 * 60 * 1000
        : true;

      return {
        patientId: admission.patientId,
        patientName: `${admission.patient.firstName} ${admission.patient.lastName}`,
        mrn: admission.patient.mrn,
        admissionId: admission.id,
        ward: admission.bed?.ward?.name || 'Unknown',
        wardId: admission.bed?.wardId,
        bed: admission.bed?.bedNumber || 'N/A',
        news2Score: assessment?.news2Score || 0,
        riskLevel: assessment?.riskLevel || 'LOW',
        deteriorationProbability: assessment?.deteriorationProbability || 0,
        sepsisRisk: assessment?.sepsisRisk || { qsofaScore: 0, riskLevel: 'LOW' },
        fallRisk: assessment?.fallRisk || { score: 0, riskLevel: 'LOW' },
        escalationRequired: assessment?.escalationRequired || false,
        recommendedActions: assessment?.recommendedActions || [],
        trend,
        lastVitalsTime: latestVitals?.recordedAt || null,
        vitalsOverdue,
        latestVitals: latestVitals ? {
          respiratoryRate: latestVitals.respiratoryRate,
          oxygenSaturation: latestVitals.oxygenSaturation,
          systolicBP: latestVitals.bloodPressureSys,
          diastolicBP: latestVitals.bloodPressureDia,
          heartRate: latestVitals.heartRate,
          temperature: latestVitals.temperature,
        } : null,
      };
    });

    // Sort by risk level and NEWS2 score
    patients.sort((a, b) => {
      const riskOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const aRisk = riskOrder[a.riskLevel] ?? 4;
      const bRisk = riskOrder[b.riskLevel] ?? 4;
      if (aRisk !== bRisk) return aRisk - bRisk;
      return b.news2Score - a.news2Score;
    });

    // Calculate stats
    const stats = {
      totalPatients: patients.length,
      criticalCount: patients.filter(p => p.riskLevel === 'CRITICAL').length,
      highCount: patients.filter(p => p.riskLevel === 'HIGH').length,
      mediumCount: patients.filter(p => p.riskLevel === 'MEDIUM').length,
      lowCount: patients.filter(p => p.riskLevel === 'LOW').length,
      vitalsOverdueCount: patients.filter(p => p.vitalsOverdue).length,
      worseningCount: patients.filter(p => p.trend === 'worsening').length,
      improvingCount: patients.filter(p => p.trend === 'improving').length,
      sepsisRiskCount: patients.filter(p => p.sepsisRisk.qsofaScore >= 2).length,
      highFallRiskCount: patients.filter(p => p.fallRisk.riskLevel === 'HIGH').length,
      escalationRequiredCount: patients.filter(p => p.escalationRequired).length,
    };

    // Get wards for filtering
    const wards = await prisma.ward.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true },
    });

    return {
      patients,
      stats,
      wards,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get vital signs trend data for charts
   */
  async getVitalsTrend(patientId: string, hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const vitals = await prisma.vital.findMany({
      where: {
        patientId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'asc' },
    });

    // Transform for charting
    const trendData = {
      labels: vitals.map(v => v.recordedAt.toISOString()),
      respiratoryRate: vitals.map(v => v.respiratoryRate),
      oxygenSaturation: vitals.map(v => v.oxygenSaturation ? Number(v.oxygenSaturation) : null),
      systolicBP: vitals.map(v => v.bloodPressureSys),
      diastolicBP: vitals.map(v => v.bloodPressureDia),
      heartRate: vitals.map(v => v.heartRate),
      temperature: vitals.map(v => v.temperature ? Number(v.temperature) : null),
      news2Scores: vitals.map(v => {
        const n = this.localCalculateNEWS2({
          respiratoryRate: v.respiratoryRate || undefined,
          oxygenSaturation: v.oxygenSaturation ? Number(v.oxygenSaturation) : undefined,
          systolicBP: v.bloodPressureSys || undefined,
          heartRate: v.heartRate || undefined,
          temperature: v.temperature ? Number(v.temperature) : undefined,
        });
        return n.totalScore;
      }),
      qsofaScores: vitals.map(v => {
        const q = this.localCalculateQSOFA({
          respiratoryRate: v.respiratoryRate || undefined,
          systolicBP: v.bloodPressureSys || undefined,
        });
        return q.qsofaScore;
      }),
    };

    return {
      patientId,
      hours,
      dataPoints: vitals.length,
      trendData,
    };
  }
}

export const earlyWarningService = new EarlyWarningService();
