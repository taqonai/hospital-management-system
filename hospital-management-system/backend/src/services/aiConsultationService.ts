import axios from 'axios';
import prisma from '../config/database';
import { config } from '../config';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

// ============= TypeScript Interfaces =============

export interface VitalsInput {
  respiratoryRate: number;
  oxygenSaturation: number;
  temperature: number;
  systolicBP: number;
  diastolicBP?: number;
  heartRate: number;
  consciousness: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE';
  supplementalOxygen?: boolean;
  previousVitals?: VitalsInput[];
}

export interface VitalsInterpretation {
  news2Score: number;
  riskLevel: 'LOW' | 'LOW_MEDIUM' | 'MEDIUM' | 'HIGH';
  clinicalRisk: string;
  interpretation: string;
  alerts: VitalAlert[];
  recommendations: string[];
  componentScores: NEWS2ComponentScores;
  trend?: VitalsTrend;
}

export interface NEWS2ComponentScores {
  respiratoryRate: number;
  oxygenSaturation: number;
  supplementalOxygen: number;
  temperature: number;
  systolicBP: number;
  heartRate: number;
  consciousness: number;
}

export interface VitalAlert {
  parameter: string;
  value: number | string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  message: string;
}

export interface VitalsTrend {
  direction: 'IMPROVING' | 'STABLE' | 'WORSENING';
  parameters: {
    name: string;
    currentValue: number;
    previousValue: number;
    change: number;
    trend: 'UP' | 'DOWN' | 'STABLE';
  }[];
  summary: string;
}

export interface DiagnosisInput {
  symptoms: string[];
  patientAge: number;
  patientGender: string;
  duration?: string;
  severity?: string;
  medicalHistory?: string[];
  currentMedications?: string[];
  allergies?: string[];
  vitalSigns?: {
    temperature?: number;
    bloodPressure?: string;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
}

export interface DiagnosisSuggestion {
  icd10Code: string;
  name: string;
  confidence: number;
  description?: string;
  differentialReason?: string;
}

export interface DiagnosisSuggestionsResponse {
  differentialDiagnoses: DiagnosisSuggestion[];
  redFlags: string[];
  urgentConsiderations: string[];
  recommendedTests: string[];
  modelVersion: string;
  disclaimer: string;
}

export interface PrescriptionValidationInput {
  patientId: string;
  medications: {
    drugName: string;
    genericName?: string;
    dose: number;
    unit: string;
    frequency: string;
    route: string;
    duration?: string;
  }[];
  patientAge?: number;
  patientWeight?: number;
  allergies?: string[];
  currentMedications?: string[];
  renalFunction?: 'NORMAL' | 'MILD' | 'MODERATE' | 'SEVERE';
  hepaticFunction?: 'NORMAL' | 'MILD' | 'MODERATE' | 'SEVERE';
}

export interface PrescriptionValidationResult {
  isValid: boolean;
  overallRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  medications: {
    drugName: string;
    validations: {
      doseValidation: {
        isValid: boolean;
        message?: string;
        suggestedDose?: string;
      };
      interactionCheck: {
        hasInteractions: boolean;
        interactions: DrugInteraction[];
      };
      allergyCheck: {
        isContraindicated: boolean;
        allergenMatches: string[];
      };
      renalDoseAdjustment?: {
        required: boolean;
        suggestion?: string;
      };
    };
  }[];
  warnings: string[];
  contraindications: string[];
  suggestions: string[];
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  description: string;
  recommendation: string;
}

export interface ConsultationData {
  patientId: string;
  doctorId: string;
  chiefComplaint: string;
  symptoms: string[];
  historyOfPresentIllness?: string;
  pastMedicalHistory?: string[];
  physicalExamination?: string;
  vitalSigns?: VitalsInput;
  diagnosis: string[];
  icdCodes: string[];
  treatmentPlan?: string;
  prescriptions?: {
    drugName: string;
    dose: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }[];
  labOrdersRequested?: string[];
  imagingOrdersRequested?: string[];
  followUpPlan?: string;
}

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  icd10Codes: { code: string; description: string }[];
  cptCodes: { code: string; description: string }[];
  formattedNote: string;
  generatedAt: string;
  modelVersion: string;
}

export interface PatientAIContext {
  patient: {
    id: string;
    name: string;
    age: number;
    gender: string;
    bloodGroup?: string;
    mrn: string;
  };
  riskAssessment?: {
    overallRisk: string;
    riskScore: number;
    factors: string[];
    recommendations: string[];
  };
  medicationAlerts: {
    type: string;
    severity: string;
    message: string;
    medication?: string;
  }[];
  allergyWarnings: {
    allergen: string;
    severity: string;
    reaction?: string;
    isHighRisk: boolean;
  }[];
  recentConsultations: {
    id: string;
    date: string;
    chiefComplaint: string;
    diagnosis: string[];
    doctorName: string;
  }[];
  lastVitals?: {
    recordedAt: string;
    temperature?: number;
    bloodPressure?: string;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
}

export interface FollowUpRecommendation {
  consultationId: string;
  diagnosis: string[];
  recommendedFollowUp: {
    timeframe: string;
    reason: string;
    urgency: 'ROUTINE' | 'SOON' | 'URGENT';
  };
  warningSignsToWatch: string[];
  patientInstructions: string[];
  suggestedTests?: string[];
  lifestyleRecommendations?: string[];
}

export interface RecommendedTest {
  testName: string;
  category: 'LABORATORY' | 'IMAGING' | 'OTHER';
  priority: 'STAT' | 'URGENT' | 'ROUTINE';
  rationale: string;
  expectedFindings?: string;
}

// ============= AI Consultation Service Class =============

export class AIConsultationService {
  private aiClient = axios.create({
    baseURL: config.ai.serviceUrl,
    timeout: 30000,
    headers: {
      'Authorization': `Bearer ${config.ai.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  /**
   * Fetches patient data and returns AI-enhanced context including risk assessment,
   * medication alerts, allergy warnings, and recent consultation history
   */
  async getPatientAIContext(hospitalId: string, patientId: string): Promise<PatientAIContext> {
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        hospitalId,
      },
      include: {
        medicalHistory: true,
        allergies: true,
        vitals: {
          orderBy: { recordedAt: 'desc' },
          take: 5,
        },
        consultations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            doctor: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        prescriptions: {
          where: { status: 'ACTIVE' },
          include: {
            medications: {
              include: { drug: true },
            },
          },
        },
        admissions: {
          orderBy: { admissionDate: 'desc' },
          take: 3,
        },
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const age = this.calculateAge(patient.dateOfBirth);

    // Build medication alerts
    const medicationAlerts: PatientAIContext['medicationAlerts'] = [];
    const currentMedications: string[] = [];

    for (const prescription of patient.prescriptions) {
      for (const med of prescription.medications) {
        const drugName = med.drug?.genericName || med.drug?.name || '';
        currentMedications.push(drugName);

        // Check for high-alert medications
        if (this.isHighAlertMedication(drugName)) {
          medicationAlerts.push({
            type: 'HIGH_ALERT',
            severity: 'HIGH',
            message: `Patient is on high-alert medication: ${drugName}`,
            medication: drugName,
          });
        }
      }
    }

    // Build allergy warnings with risk classification
    const allergyWarnings: PatientAIContext['allergyWarnings'] = patient.allergies.map(allergy => ({
      allergen: allergy.allergen,
      severity: allergy.severity || 'UNKNOWN',
      reaction: allergy.reaction || undefined,
      isHighRisk: this.isHighRiskAllergy(allergy.allergen, allergy.severity),
    }));

    // Build recent consultations summary
    const recentConsultations: PatientAIContext['recentConsultations'] = patient.consultations.map(consult => ({
      id: consult.id,
      date: consult.createdAt.toISOString(),
      chiefComplaint: consult.chiefComplaint,
      diagnosis: consult.diagnosis,
      doctorName: consult.doctor?.user
        ? `Dr. ${consult.doctor.user.firstName} ${consult.doctor.user.lastName}`
        : 'Unknown',
    }));

    // Get latest vitals
    const latestVitals = patient.vitals[0];
    const lastVitals = latestVitals ? {
      recordedAt: latestVitals.recordedAt.toISOString(),
      temperature: latestVitals.temperature ? Number(latestVitals.temperature) : undefined,
      bloodPressure: latestVitals.bloodPressureSys && latestVitals.bloodPressureDia
        ? `${latestVitals.bloodPressureSys}/${latestVitals.bloodPressureDia}`
        : undefined,
      heartRate: latestVitals.heartRate || undefined,
      respiratoryRate: latestVitals.respiratoryRate || undefined,
      oxygenSaturation: latestVitals.oxygenSaturation ? Number(latestVitals.oxygenSaturation) : undefined,
    } : undefined;

    // Get AI risk assessment
    let riskAssessment: PatientAIContext['riskAssessment'];
    try {
      logger.info(`Fetching AI risk assessment for patient ${patientId}`);
      const response = await this.aiClient.post('/api/predict-risk', {
        patientId,
        predictionType: 'general',
        timeframe: '30 days',
        patientData: {
          age,
          gender: patient.gender,
          medicalHistory: patient.medicalHistory?.chronicConditions || [],
          vitalsHistory: patient.vitals,
          admissionHistory: patient.admissions,
          consultationCount: patient.consultations.length,
        },
      });

      riskAssessment = {
        overallRisk: response.data.riskLevel || 'UNKNOWN',
        riskScore: response.data.riskScore || 0,
        factors: response.data.factors || [],
        recommendations: response.data.recommendations || [],
      };
    } catch (error) {
      logger.warn('AI risk assessment unavailable, using fallback calculation');
      riskAssessment = this.calculateFallbackRisk(patient, age);
    }

    return {
      patient: {
        id: patient.id,
        name: `${patient.firstName} ${patient.lastName}`,
        age,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup || undefined,
        mrn: patient.mrn,
      },
      riskAssessment,
      medicationAlerts,
      allergyWarnings,
      recentConsultations,
      lastVitals,
    };
  }

  /**
   * Interprets vital signs using NEWS2 scoring system
   * Returns interpretation, alerts, and recommendations with trend analysis
   */
  interpretVitals(vitals: VitalsInput): VitalsInterpretation {
    const componentScores = this.calculateNEWS2Components(vitals);
    const news2Score = Object.values(componentScores).reduce((sum, score) => sum + score, 0);

    // Determine risk level based on NEWS2 aggregate score and individual parameters
    const hasExtreme = Object.values(componentScores).some(score => score === 3);
    let riskLevel: VitalsInterpretation['riskLevel'];
    let clinicalRisk: string;

    if (news2Score >= 7 || hasExtreme) {
      riskLevel = 'HIGH';
      clinicalRisk = 'High clinical risk - Urgent/emergency response required';
    } else if (news2Score >= 5) {
      riskLevel = 'MEDIUM';
      clinicalRisk = 'Medium clinical risk - Urgent response threshold';
    } else if (news2Score >= 1) {
      riskLevel = 'LOW_MEDIUM';
      clinicalRisk = 'Low-medium clinical risk - Ward-based response';
    } else {
      riskLevel = 'LOW';
      clinicalRisk = 'Low clinical risk - Continue routine monitoring';
    }

    // Generate alerts for abnormal values
    const alerts = this.generateVitalAlerts(vitals, componentScores);

    // Generate recommendations based on score and specific abnormalities
    const recommendations = this.generateVitalRecommendations(news2Score, riskLevel, alerts, vitals);

    // Generate interpretation summary
    const interpretation = this.generateVitalsInterpretation(vitals, news2Score, riskLevel);

    // Calculate trend if previous vitals available
    let trend: VitalsTrend | undefined;
    if (vitals.previousVitals && vitals.previousVitals.length > 0) {
      trend = this.calculateVitalsTrend(vitals, vitals.previousVitals);
    }

    return {
      news2Score,
      riskLevel,
      clinicalRisk,
      interpretation,
      alerts,
      recommendations,
      componentScores,
      trend,
    };
  }

  /**
   * Get AI diagnosis suggestions based on symptoms and patient context
   * Returns differential diagnoses with ICD-10 codes and confidence scores
   */
  async getDiagnosisSuggestions(input: DiagnosisInput): Promise<DiagnosisSuggestionsResponse> {
    try {
      logger.info(`Getting AI diagnosis suggestions for ${input.symptoms.length} symptoms`);

      const response = await this.aiClient.post('/api/diagnose', {
        symptoms: input.symptoms,
        patientAge: input.patientAge,
        gender: input.patientGender,
        duration: input.duration,
        severity: input.severity,
        medicalHistory: input.medicalHistory || [],
        currentMedications: input.currentMedications || [],
        allergies: input.allergies || [],
        vitalSigns: input.vitalSigns,
      });

      const aiResult = response.data;

      // Transform response to standard format
      const differentialDiagnoses: DiagnosisSuggestion[] = (aiResult.diagnoses || []).map((d: any) => ({
        icd10Code: d.icd10 || d.icd10Code || '',
        name: d.name || d.diagnosis || '',
        confidence: d.confidence || 0,
        description: d.description,
        differentialReason: d.reason || d.differentialReason,
      }));

      return {
        differentialDiagnoses,
        redFlags: aiResult.redFlags || this.identifyRedFlags(input.symptoms, input.vitalSigns),
        urgentConsiderations: aiResult.urgentConsiderations || [],
        recommendedTests: aiResult.recommendedTests || [],
        modelVersion: aiResult.modelVersion || '2.0.0',
        disclaimer: 'AI-generated suggestions. Clinical judgment required for final diagnosis.',
      };
    } catch (error) {
      logger.error('AI diagnosis service error:', error);
      if (axios.isAxiosError(error) && !error.response) {
        logger.warn('AI service unreachable, using fallback diagnosis suggestions');
        return this.getFallbackDiagnosisSuggestions(input);
      }
      throw new AppError('AI diagnosis service temporarily unavailable', 503);
    }
  }

  /**
   * Recommend lab tests based on suspected diagnosis and patient context
   */
  async getRecommendedTests(
    diagnosis: string,
    patientContext: {
      age?: number;
      gender?: string;
      symptoms?: string[];
      medicalHistory?: string[];
      currentMedications?: string[];
    }
  ): Promise<RecommendedTest[]> {
    // Map diagnoses to recommended tests
    const diagnosisTestMap: Record<string, RecommendedTest[]> = {
      'fever': [
        { testName: 'Complete Blood Count (CBC)', category: 'LABORATORY', priority: 'URGENT', rationale: 'Evaluate for infection, check WBC count and differential' },
        { testName: 'Blood Culture', category: 'LABORATORY', priority: 'URGENT', rationale: 'Identify potential bacteremia' },
        { testName: 'Urinalysis', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Rule out urinary tract infection' },
        { testName: 'C-Reactive Protein (CRP)', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Assess inflammatory response' },
      ],
      'chest pain': [
        { testName: 'ECG/EKG', category: 'OTHER', priority: 'STAT', rationale: 'Evaluate for cardiac ischemia or arrhythmia' },
        { testName: 'Troponin', category: 'LABORATORY', priority: 'STAT', rationale: 'Detect myocardial injury' },
        { testName: 'Chest X-Ray', category: 'IMAGING', priority: 'URGENT', rationale: 'Evaluate cardiac silhouette and lung fields' },
        { testName: 'D-Dimer', category: 'LABORATORY', priority: 'URGENT', rationale: 'Screen for pulmonary embolism if suspected' },
        { testName: 'Basic Metabolic Panel', category: 'LABORATORY', priority: 'URGENT', rationale: 'Evaluate electrolytes and renal function' },
      ],
      'shortness of breath': [
        { testName: 'Chest X-Ray', category: 'IMAGING', priority: 'URGENT', rationale: 'Evaluate for pneumonia, effusion, or heart failure' },
        { testName: 'Arterial Blood Gas (ABG)', category: 'LABORATORY', priority: 'STAT', rationale: 'Assess oxygenation and acid-base status' },
        { testName: 'BNP/NT-proBNP', category: 'LABORATORY', priority: 'URGENT', rationale: 'Evaluate for heart failure' },
        { testName: 'D-Dimer', category: 'LABORATORY', priority: 'URGENT', rationale: 'Screen for pulmonary embolism' },
        { testName: 'Complete Blood Count', category: 'LABORATORY', priority: 'URGENT', rationale: 'Check for anemia or infection' },
      ],
      'abdominal pain': [
        { testName: 'Complete Blood Count', category: 'LABORATORY', priority: 'URGENT', rationale: 'Evaluate for infection or bleeding' },
        { testName: 'Comprehensive Metabolic Panel', category: 'LABORATORY', priority: 'URGENT', rationale: 'Assess liver and kidney function' },
        { testName: 'Lipase/Amylase', category: 'LABORATORY', priority: 'URGENT', rationale: 'Evaluate for pancreatitis' },
        { testName: 'Abdominal Ultrasound', category: 'IMAGING', priority: 'URGENT', rationale: 'Visualize gallbladder, liver, and kidneys' },
        { testName: 'Urinalysis', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Rule out kidney stones or UTI' },
      ],
      'headache': [
        { testName: 'CT Head (without contrast)', category: 'IMAGING', priority: 'URGENT', rationale: 'Rule out intracranial hemorrhage or mass' },
        { testName: 'Complete Blood Count', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Check for infection or anemia' },
        { testName: 'Basic Metabolic Panel', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Evaluate electrolytes' },
        { testName: 'Erythrocyte Sedimentation Rate (ESR)', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Screen for temporal arteritis in elderly' },
      ],
      'diabetes': [
        { testName: 'HbA1c', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Assess long-term glycemic control' },
        { testName: 'Fasting Blood Glucose', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Current glucose level' },
        { testName: 'Comprehensive Metabolic Panel', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Renal function and electrolytes' },
        { testName: 'Lipid Panel', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Cardiovascular risk assessment' },
        { testName: 'Urinalysis with Microalbumin', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Screen for diabetic nephropathy' },
      ],
      'hypertension': [
        { testName: 'Comprehensive Metabolic Panel', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Renal function and electrolytes' },
        { testName: 'Lipid Panel', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Cardiovascular risk assessment' },
        { testName: 'ECG', category: 'OTHER', priority: 'ROUTINE', rationale: 'Evaluate for left ventricular hypertrophy' },
        { testName: 'Urinalysis', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Screen for proteinuria' },
        { testName: 'Thyroid Function Tests', category: 'LABORATORY', priority: 'ROUTINE', rationale: 'Rule out secondary causes' },
      ],
    };

    // Find matching tests based on diagnosis keywords
    const diagnosisLower = diagnosis.toLowerCase();
    let recommendedTests: RecommendedTest[] = [];

    for (const [condition, tests] of Object.entries(diagnosisTestMap)) {
      if (diagnosisLower.includes(condition)) {
        recommendedTests = [...recommendedTests, ...tests];
      }
    }

    // Add age-specific recommendations
    if (patientContext.age) {
      if (patientContext.age >= 65) {
        recommendedTests.push({
          testName: 'Basic Metabolic Panel',
          category: 'LABORATORY',
          priority: 'ROUTINE',
          rationale: 'Baseline renal function monitoring in elderly',
        });
      }
      if (patientContext.age >= 50 && patientContext.gender?.toLowerCase() === 'male') {
        recommendedTests.push({
          testName: 'PSA (if indicated)',
          category: 'LABORATORY',
          priority: 'ROUTINE',
          rationale: 'Consider prostate cancer screening per guidelines',
        });
      }
    }

    // Remove duplicates based on test name
    const uniqueTests = recommendedTests.filter(
      (test, index, self) => index === self.findIndex(t => t.testName === test.testName)
    );

    // Sort by priority
    const priorityOrder: Record<string, number> = { 'STAT': 0, 'URGENT': 1, 'ROUTINE': 2 };
    uniqueTests.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return uniqueTests;
  }

  /**
   * Real-time prescription validation including drug interactions,
   * allergy checks, and dosage validation
   */
  async validatePrescription(input: PrescriptionValidationInput): Promise<PrescriptionValidationResult> {
    // Fetch patient data if patientId provided
    let patientAllergies: string[] = input.allergies || [];
    let patientCurrentMeds: string[] = input.currentMedications || [];
    let patientAge = input.patientAge;
    let patientWeight = input.patientWeight;

    if (input.patientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: input.patientId },
        include: {
          allergies: true,
          prescriptions: {
            where: { status: 'ACTIVE' },
            include: {
              medications: { include: { drug: true } },
            },
          },
        },
      });

      if (patient) {
        patientAllergies = patient.allergies.map(a => a.allergen.toLowerCase());
        patientCurrentMeds = patient.prescriptions
          .flatMap(p => p.medications.map(m => m.drug?.genericName || m.drug?.name || ''))
          .filter(Boolean);
        patientAge = patientAge || this.calculateAge(patient.dateOfBirth);
      }
    }

    const medicationValidations: PrescriptionValidationResult['medications'] = [];
    const warnings: string[] = [];
    const contraindications: string[] = [];
    const suggestions: string[] = [];
    let overallRisk: PrescriptionValidationResult['overallRisk'] = 'LOW';

    // Build list of all medications (new + current)
    const allMedications = [
      ...input.medications.map(m => m.genericName || m.drugName),
      ...patientCurrentMeds,
    ];

    for (const medication of input.medications) {
      const drugName = (medication.genericName || medication.drugName).toLowerCase();
      const validations: PrescriptionValidationResult['medications'][0]['validations'] = {
        doseValidation: { isValid: true },
        interactionCheck: { hasInteractions: false, interactions: [] },
        allergyCheck: { isContraindicated: false, allergenMatches: [] },
      };

      // 1. Check for allergies
      const allergyMatches = patientAllergies.filter(
        allergen => drugName.includes(allergen) || allergen.includes(drugName)
      );

      if (allergyMatches.length > 0) {
        validations.allergyCheck = {
          isContraindicated: true,
          allergenMatches: allergyMatches,
        };
        contraindications.push(
          `ALLERGY: Patient allergic to ${allergyMatches.join(', ')} - ${medication.drugName} contraindicated`
        );
        overallRisk = 'CRITICAL';
      }

      // 2. Check drug interactions via AI service
      try {
        const interactionResponse = await this.aiClient.post('/api/pharmacy/check-interactions', {
          medications: allMedications,
          patient_age: patientAge,
          allergies: patientAllergies,
        });

        const interactions = interactionResponse.data.interactions || [];
        const relevantInteractions = interactions.filter(
          (i: any) =>
            i.drug1?.toLowerCase().includes(drugName) ||
            i.drug2?.toLowerCase().includes(drugName)
        );

        if (relevantInteractions.length > 0) {
          validations.interactionCheck = {
            hasInteractions: true,
            interactions: relevantInteractions.map((i: any) => ({
              drug1: i.drug1,
              drug2: i.drug2,
              severity: i.severity || 'MODERATE',
              description: i.description,
              recommendation: i.recommendation,
            })),
          };

          for (const interaction of relevantInteractions) {
            if (interaction.severity === 'CRITICAL') {
              overallRisk = 'CRITICAL';
              contraindications.push(
                `CRITICAL INTERACTION: ${interaction.drug1} with ${interaction.drug2} - ${interaction.description}`
              );
            } else if (interaction.severity === 'HIGH' && overallRisk !== 'CRITICAL') {
              overallRisk = 'HIGH';
              warnings.push(
                `HIGH INTERACTION: ${interaction.drug1} with ${interaction.drug2} - ${interaction.description}`
              );
            } else if (overallRisk === 'LOW') {
              overallRisk = 'MODERATE';
              warnings.push(
                `MODERATE INTERACTION: ${interaction.drug1} with ${interaction.drug2}`
              );
            }
          }
        }
      } catch (error) {
        logger.warn('Drug interaction check via AI service failed, using local check');
        // Fallback to local interaction check
        const localInteractions = this.checkLocalDrugInteractions(drugName, allMedications);
        if (localInteractions.length > 0) {
          validations.interactionCheck = { hasInteractions: true, interactions: localInteractions };
          for (const interaction of localInteractions) {
            warnings.push(`${interaction.severity} INTERACTION: ${interaction.description}`);
            if (interaction.severity === 'CRITICAL') overallRisk = 'CRITICAL';
            else if (interaction.severity === 'HIGH' && overallRisk !== 'CRITICAL') overallRisk = 'HIGH';
            else if (overallRisk === 'LOW') overallRisk = 'MODERATE';
          }
        }
      }

      // 3. Validate dosage
      const doseValidation = this.validateDosage(
        drugName,
        medication.dose,
        medication.unit,
        medication.frequency,
        patientAge,
        patientWeight
      );

      validations.doseValidation = doseValidation;
      if (!doseValidation.isValid) {
        warnings.push(doseValidation.message || `Dosage warning for ${medication.drugName}`);
        if (overallRisk === 'LOW') overallRisk = 'MODERATE';
      }

      // 4. Check renal dose adjustment
      if (input.renalFunction && input.renalFunction !== 'NORMAL') {
        const renalAdjustment = this.checkRenalDoseAdjustment(drugName, input.renalFunction);
        if (renalAdjustment.required) {
          validations.renalDoseAdjustment = renalAdjustment;
          suggestions.push(
            `${medication.drugName}: ${renalAdjustment.suggestion}`
          );
        }
      }

      medicationValidations.push({
        drugName: medication.drugName,
        validations,
      });
    }

    return {
      isValid: overallRisk !== 'CRITICAL',
      overallRisk,
      medications: medicationValidations,
      warnings,
      contraindications,
      suggestions,
    };
  }

  /**
   * Generate SOAP notes from consultation data using AI
   */
  async generateSOAPNotes(consultationData: ConsultationData): Promise<SOAPNote> {
    try {
      logger.info(`Generating SOAP notes for consultation`);

      // Try AI service first
      const response = await this.aiClient.post('/api/notes/generate', {
        template_type: 'soap',
        patient_data: {
          patientId: consultationData.patientId,
          chiefComplaint: consultationData.chiefComplaint,
          symptoms: consultationData.symptoms,
          vitalSigns: consultationData.vitalSigns,
        },
        encounter_data: {
          historyOfPresentIllness: consultationData.historyOfPresentIllness,
          pastMedicalHistory: consultationData.pastMedicalHistory,
          physicalExamination: consultationData.physicalExamination,
          diagnosis: consultationData.diagnosis,
          icdCodes: consultationData.icdCodes,
          treatmentPlan: consultationData.treatmentPlan,
          prescriptions: consultationData.prescriptions,
          labOrdersRequested: consultationData.labOrdersRequested,
          imagingOrdersRequested: consultationData.imagingOrdersRequested,
          followUpPlan: consultationData.followUpPlan,
        },
      });

      return {
        subjective: response.data.subjective || response.data.note?.subjective || '',
        objective: response.data.objective || response.data.note?.objective || '',
        assessment: response.data.assessment || response.data.note?.assessment || '',
        plan: response.data.plan || response.data.note?.plan || '',
        icd10Codes: response.data.icd10Codes || [],
        cptCodes: response.data.cptCodes || [],
        formattedNote: response.data.formattedNote || response.data.note?.formattedNote || '',
        generatedAt: new Date().toISOString(),
        modelVersion: response.data.modelVersion || '2.0.0',
      };
    } catch (error) {
      logger.warn('AI SOAP note generation failed, using template-based generation');
      return this.generateFallbackSOAPNote(consultationData);
    }
  }

  /**
   * Generate follow-up recommendations based on consultation diagnosis and treatment
   */
  async getFollowUpRecommendations(consultationId: string): Promise<FollowUpRecommendation> {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: {
          include: {
            medicalHistory: true,
            allergies: true,
          },
        },
        prescriptions: {
          include: { medications: { include: { drug: true } } },
        },
        labOrders: true,
        imagingOrders: true,
      },
    });

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    const diagnosis = consultation.diagnosis || [];
    const patientAge = this.calculateAge(consultation.patient.dateOfBirth);
    const hasPrescriptions = consultation.prescriptions.length > 0;
    const hasLabOrders = consultation.labOrders.length > 0;
    const hasImagingOrders = consultation.imagingOrders.length > 0;

    // Determine follow-up timeframe based on diagnosis and treatment
    let timeframe = '2-4 weeks';
    let urgency: FollowUpRecommendation['recommendedFollowUp']['urgency'] = 'ROUTINE';
    let reason = 'Routine follow-up for treatment evaluation';

    const diagnosisLower = diagnosis.join(' ').toLowerCase();

    // Acute conditions requiring sooner follow-up
    const acuteConditions = ['pneumonia', 'infection', 'acute', 'exacerbation', 'cellulitis'];
    const chronicConditions = ['diabetes', 'hypertension', 'heart failure', 'copd', 'asthma'];
    const urgentConditions = ['chest pain', 'stroke', 'mi', 'pulmonary embolism', 'dvt'];

    if (urgentConditions.some(c => diagnosisLower.includes(c))) {
      timeframe = '24-48 hours or as directed';
      urgency = 'URGENT';
      reason = 'Close monitoring required for high-risk condition';
    } else if (acuteConditions.some(c => diagnosisLower.includes(c))) {
      timeframe = '3-7 days';
      urgency = 'SOON';
      reason = 'Early follow-up to assess treatment response';
    } else if (chronicConditions.some(c => diagnosisLower.includes(c))) {
      timeframe = '1-3 months';
      urgency = 'ROUTINE';
      reason = 'Regular monitoring of chronic condition';
    }

    // Adjust if new medications prescribed
    if (hasPrescriptions && urgency === 'ROUTINE') {
      timeframe = '2 weeks';
      reason = 'Follow-up to assess medication efficacy and side effects';
    }

    // Generate warning signs based on diagnosis
    const warningSignsToWatch = this.getWarningSignsForDiagnosis(diagnosis);

    // Generate patient instructions
    const patientInstructions = this.getPatientInstructions(diagnosis, consultation.treatmentPlan);

    // Suggest additional tests if needed
    const suggestedTests: string[] = [];
    if (hasLabOrders) {
      suggestedTests.push('Review pending laboratory results at follow-up');
    }
    if (hasImagingOrders) {
      suggestedTests.push('Review pending imaging results at follow-up');
    }

    // Add lifestyle recommendations
    const lifestyleRecommendations = this.getLifestyleRecommendations(diagnosis);

    return {
      consultationId,
      diagnosis,
      recommendedFollowUp: {
        timeframe,
        reason,
        urgency,
      },
      warningSignsToWatch,
      patientInstructions,
      suggestedTests: suggestedTests.length > 0 ? suggestedTests : undefined,
      lifestyleRecommendations: lifestyleRecommendations.length > 0 ? lifestyleRecommendations : undefined,
    };
  }

  // ============= Private Helper Methods =============

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  private isHighAlertMedication(drugName: string): boolean {
    const highAlertDrugs = [
      'heparin', 'warfarin', 'enoxaparin', 'rivaroxaban', 'apixaban', 'dabigatran',
      'insulin', 'morphine', 'hydromorphone', 'fentanyl', 'oxycodone', 'methadone',
      'propofol', 'ketamine', 'midazolam', 'lorazepam', 'digoxin', 'amiodarone',
      'dopamine', 'norepinephrine', 'epinephrine', 'dobutamine', 'potassium chloride',
      'magnesium sulfate', 'methotrexate', 'vincristine', 'doxorubicin',
    ];

    const nameLower = drugName.toLowerCase();
    return highAlertDrugs.some(drug => nameLower.includes(drug));
  }

  private isHighRiskAllergy(allergen: string, severity?: string | null): boolean {
    const highRiskAllergens = ['penicillin', 'sulfa', 'nsaid', 'aspirin', 'iodine', 'latex', 'egg', 'shellfish'];
    const severityIsHigh = severity && ['SEVERE', 'LIFE_THREATENING', 'ANAPHYLAXIS'].includes(severity.toUpperCase());
    const allergenIsHighRisk = highRiskAllergens.some(hr => allergen.toLowerCase().includes(hr));
    return severityIsHigh || allergenIsHighRisk;
  }

  private calculateFallbackRisk(patient: any, age: number): PatientAIContext['riskAssessment'] {
    let riskScore = 0.2;
    const factors: string[] = [];

    if (age >= 65) {
      riskScore += 0.15;
      factors.push('Age 65 or older');
    } else if (age >= 50) {
      riskScore += 0.1;
      factors.push('Age 50 or older');
    }

    const chronicConditions = patient.medicalHistory?.chronicConditions || [];
    if (chronicConditions.length > 0) {
      riskScore += 0.1 * Math.min(chronicConditions.length, 3);
      factors.push(`${chronicConditions.length} chronic condition(s)`);
    }

    if (patient.admissions?.length > 2) {
      riskScore += 0.15;
      factors.push('Multiple previous admissions');
    }

    if (patient.allergies?.length > 3) {
      riskScore += 0.05;
      factors.push('Multiple allergies documented');
    }

    riskScore = Math.min(riskScore, 0.95);

    let overallRisk: string;
    if (riskScore < 0.3) overallRisk = 'LOW';
    else if (riskScore < 0.5) overallRisk = 'MODERATE';
    else if (riskScore < 0.7) overallRisk = 'HIGH';
    else overallRisk = 'CRITICAL';

    return {
      overallRisk,
      riskScore,
      factors,
      recommendations: ['Regular follow-up recommended', 'Monitor vital signs'],
    };
  }

  private calculateNEWS2Components(vitals: VitalsInput): NEWS2ComponentScores {
    // NEWS2 scoring based on Royal College of Physicians guidelines

    // Respiratory rate scoring
    let respiratoryRateScore = 0;
    if (vitals.respiratoryRate <= 8) respiratoryRateScore = 3;
    else if (vitals.respiratoryRate <= 11) respiratoryRateScore = 1;
    else if (vitals.respiratoryRate <= 20) respiratoryRateScore = 0;
    else if (vitals.respiratoryRate <= 24) respiratoryRateScore = 2;
    else respiratoryRateScore = 3;

    // Oxygen saturation scoring (Scale 1 - for most patients)
    let oxygenSaturationScore = 0;
    if (vitals.oxygenSaturation <= 91) oxygenSaturationScore = 3;
    else if (vitals.oxygenSaturation <= 93) oxygenSaturationScore = 2;
    else if (vitals.oxygenSaturation <= 95) oxygenSaturationScore = 1;
    else oxygenSaturationScore = 0;

    // Supplemental oxygen scoring
    const supplementalOxygenScore = vitals.supplementalOxygen ? 2 : 0;

    // Temperature scoring
    let temperatureScore = 0;
    if (vitals.temperature <= 35.0) temperatureScore = 3;
    else if (vitals.temperature <= 36.0) temperatureScore = 1;
    else if (vitals.temperature <= 38.0) temperatureScore = 0;
    else if (vitals.temperature <= 39.0) temperatureScore = 1;
    else temperatureScore = 2;

    // Systolic BP scoring
    let systolicBPScore = 0;
    if (vitals.systolicBP <= 90) systolicBPScore = 3;
    else if (vitals.systolicBP <= 100) systolicBPScore = 2;
    else if (vitals.systolicBP <= 110) systolicBPScore = 1;
    else if (vitals.systolicBP <= 219) systolicBPScore = 0;
    else systolicBPScore = 3;

    // Heart rate scoring
    let heartRateScore = 0;
    if (vitals.heartRate <= 40) heartRateScore = 3;
    else if (vitals.heartRate <= 50) heartRateScore = 1;
    else if (vitals.heartRate <= 90) heartRateScore = 0;
    else if (vitals.heartRate <= 110) heartRateScore = 1;
    else if (vitals.heartRate <= 130) heartRateScore = 2;
    else heartRateScore = 3;

    // Consciousness scoring (AVPU)
    let consciousnessScore = 0;
    switch (vitals.consciousness) {
      case 'ALERT':
        consciousnessScore = 0;
        break;
      case 'VOICE':
      case 'PAIN':
      case 'UNRESPONSIVE':
        consciousnessScore = 3;
        break;
    }

    return {
      respiratoryRate: respiratoryRateScore,
      oxygenSaturation: oxygenSaturationScore,
      supplementalOxygen: supplementalOxygenScore,
      temperature: temperatureScore,
      systolicBP: systolicBPScore,
      heartRate: heartRateScore,
      consciousness: consciousnessScore,
    };
  }

  private generateVitalAlerts(vitals: VitalsInput, componentScores: NEWS2ComponentScores): VitalAlert[] {
    const alerts: VitalAlert[] = [];

    if (componentScores.respiratoryRate === 3) {
      alerts.push({
        parameter: 'Respiratory Rate',
        value: vitals.respiratoryRate,
        severity: 'CRITICAL',
        message: vitals.respiratoryRate <= 8
          ? 'Critical bradypnea - immediate intervention required'
          : 'Critical tachypnea - assess for respiratory distress',
      });
    } else if (componentScores.respiratoryRate >= 2) {
      alerts.push({
        parameter: 'Respiratory Rate',
        value: vitals.respiratoryRate,
        severity: 'HIGH',
        message: 'Elevated respiratory rate - monitor closely',
      });
    }

    if (componentScores.oxygenSaturation === 3) {
      alerts.push({
        parameter: 'Oxygen Saturation',
        value: vitals.oxygenSaturation,
        severity: 'CRITICAL',
        message: 'Severe hypoxemia - consider supplemental oxygen or escalation',
      });
    } else if (componentScores.oxygenSaturation >= 1) {
      alerts.push({
        parameter: 'Oxygen Saturation',
        value: vitals.oxygenSaturation,
        severity: 'MODERATE',
        message: 'Hypoxemia detected - monitor and assess cause',
      });
    }

    if (componentScores.systolicBP === 3) {
      alerts.push({
        parameter: 'Systolic Blood Pressure',
        value: vitals.systolicBP,
        severity: 'CRITICAL',
        message: vitals.systolicBP <= 90
          ? 'Hypotension - assess for shock, consider fluid resuscitation'
          : 'Hypertensive crisis - immediate evaluation required',
      });
    }

    if (componentScores.heartRate === 3) {
      alerts.push({
        parameter: 'Heart Rate',
        value: vitals.heartRate,
        severity: 'CRITICAL',
        message: vitals.heartRate <= 40
          ? 'Severe bradycardia - evaluate for heart block or medication effect'
          : 'Severe tachycardia - assess for arrhythmia, sepsis, or hypovolemia',
      });
    }

    if (componentScores.temperature === 3) {
      alerts.push({
        parameter: 'Temperature',
        value: vitals.temperature,
        severity: 'CRITICAL',
        message: 'Hypothermia - initiate warming measures, assess underlying cause',
      });
    } else if (vitals.temperature >= 39) {
      alerts.push({
        parameter: 'Temperature',
        value: vitals.temperature,
        severity: 'HIGH',
        message: 'High fever - assess for infection, consider antipyretics',
      });
    }

    if (componentScores.consciousness === 3) {
      alerts.push({
        parameter: 'Consciousness',
        value: vitals.consciousness,
        severity: 'CRITICAL',
        message: 'Altered level of consciousness - immediate neurological evaluation required',
      });
    }

    return alerts;
  }

  private generateVitalRecommendations(
    score: number,
    riskLevel: string,
    alerts: VitalAlert[],
    vitals: VitalsInput
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'HIGH') {
      recommendations.push('Immediate clinical review by senior clinician');
      recommendations.push('Consider escalation to critical care team');
      recommendations.push('Continuous monitoring recommended');
    } else if (riskLevel === 'MEDIUM') {
      recommendations.push('Urgent clinical review within 1 hour');
      recommendations.push('Increase monitoring frequency to every 30 minutes');
      recommendations.push('Consider escalation if no improvement');
    } else if (riskLevel === 'LOW_MEDIUM') {
      recommendations.push('Review by registered nurse within 1 hour');
      recommendations.push('Monitoring every 4-6 hours');
      recommendations.push('Document response to any interventions');
    } else {
      recommendations.push('Continue routine monitoring every 12 hours');
    }

    // Specific recommendations based on abnormal values
    if (alerts.some(a => a.parameter === 'Oxygen Saturation')) {
      recommendations.push('Assess airway and breathing');
      if (!vitals.supplementalOxygen) {
        recommendations.push('Consider supplemental oxygen');
      }
    }

    if (alerts.some(a => a.parameter === 'Systolic Blood Pressure' && a.severity === 'CRITICAL')) {
      if (vitals.systolicBP <= 90) {
        recommendations.push('Assess fluid status and consider IV fluid bolus');
        recommendations.push('Check for sources of blood loss');
      } else {
        recommendations.push('Assess for end-organ damage');
        recommendations.push('Consider IV antihypertensive therapy');
      }
    }

    return recommendations;
  }

  private generateVitalsInterpretation(
    vitals: VitalsInput,
    score: number,
    riskLevel: string
  ): string {
    let interpretation = `NEWS2 Score: ${score} (${riskLevel} risk). `;

    const abnormalities: string[] = [];

    if (vitals.respiratoryRate < 12 || vitals.respiratoryRate > 20) {
      abnormalities.push(`respiratory rate ${vitals.respiratoryRate}/min`);
    }
    if (vitals.oxygenSaturation < 96) {
      abnormalities.push(`SpO2 ${vitals.oxygenSaturation}%`);
    }
    if (vitals.temperature < 36 || vitals.temperature > 38) {
      abnormalities.push(`temperature ${vitals.temperature}C`);
    }
    if (vitals.systolicBP < 110 || vitals.systolicBP > 140) {
      abnormalities.push(`BP ${vitals.systolicBP}/${vitals.diastolicBP || '-'} mmHg`);
    }
    if (vitals.heartRate < 60 || vitals.heartRate > 100) {
      abnormalities.push(`HR ${vitals.heartRate}/min`);
    }
    if (vitals.consciousness !== 'ALERT') {
      abnormalities.push(`consciousness ${vitals.consciousness}`);
    }

    if (abnormalities.length === 0) {
      interpretation += 'All vital signs within normal limits.';
    } else {
      interpretation += `Abnormal parameters: ${abnormalities.join(', ')}.`;
    }

    return interpretation;
  }

  private calculateVitalsTrend(current: VitalsInput, previous: VitalsInput[]): VitalsTrend {
    const latestPrevious = previous[0];
    const parameters: VitalsTrend['parameters'] = [];

    const comparisons = [
      { name: 'Respiratory Rate', currentValue: current.respiratoryRate, previousValue: latestPrevious.respiratoryRate },
      { name: 'Oxygen Saturation', currentValue: current.oxygenSaturation, previousValue: latestPrevious.oxygenSaturation },
      { name: 'Temperature', currentValue: current.temperature, previousValue: latestPrevious.temperature },
      { name: 'Systolic BP', currentValue: current.systolicBP, previousValue: latestPrevious.systolicBP },
      { name: 'Heart Rate', currentValue: current.heartRate, previousValue: latestPrevious.heartRate },
    ];

    let improving = 0;
    let worsening = 0;

    for (const comp of comparisons) {
      const change = comp.currentValue - comp.previousValue;
      let trend: 'UP' | 'DOWN' | 'STABLE' = 'STABLE';

      if (Math.abs(change) > 0.5) {
        trend = change > 0 ? 'UP' : 'DOWN';

        // Determine if change is improvement or worsening
        const isImproving = this.isVitalChangeImproving(comp.name, change, comp.currentValue);
        if (isImproving) improving++;
        else worsening++;
      }

      parameters.push({
        name: comp.name,
        currentValue: comp.currentValue,
        previousValue: comp.previousValue,
        change,
        trend,
      });
    }

    let direction: VitalsTrend['direction'];
    let summary: string;

    if (improving > worsening) {
      direction = 'IMPROVING';
      summary = 'Vital signs showing improvement from previous measurement';
    } else if (worsening > improving) {
      direction = 'WORSENING';
      summary = 'Vital signs showing deterioration - close monitoring recommended';
    } else {
      direction = 'STABLE';
      summary = 'Vital signs relatively stable from previous measurement';
    }

    return { direction, parameters, summary };
  }

  private isVitalChangeImproving(parameter: string, change: number, currentValue: number): boolean {
    // Define normal ranges and assess if change moves toward normal
    switch (parameter) {
      case 'Respiratory Rate':
        return (currentValue > 20 && change < 0) || (currentValue < 12 && change > 0);
      case 'Oxygen Saturation':
        return change > 0; // Higher is generally better
      case 'Temperature':
        return (currentValue > 38 && change < 0) || (currentValue < 36 && change > 0);
      case 'Systolic BP':
        return (currentValue > 140 && change < 0) || (currentValue < 100 && change > 0);
      case 'Heart Rate':
        return (currentValue > 100 && change < 0) || (currentValue < 60 && change > 0);
      default:
        return false;
    }
  }

  private identifyRedFlags(symptoms: string[], vitalSigns?: DiagnosisInput['vitalSigns']): string[] {
    const redFlags: string[] = [];
    const symptomsLower = symptoms.map(s => s.toLowerCase()).join(' ');

    // Symptom-based red flags
    if (symptomsLower.includes('chest pain')) {
      redFlags.push('Chest pain - rule out cardiac etiology');
    }
    if (symptomsLower.includes('shortness of breath') || symptomsLower.includes('difficulty breathing')) {
      redFlags.push('Respiratory distress - assess oxygenation');
    }
    if (symptomsLower.includes('worst headache') || symptomsLower.includes('thunderclap')) {
      redFlags.push('Severe headache - consider subarachnoid hemorrhage');
    }
    if (symptomsLower.includes('altered mental') || symptomsLower.includes('confusion')) {
      redFlags.push('Altered mental status - requires urgent evaluation');
    }
    if (symptomsLower.includes('blood') && (symptomsLower.includes('vomit') || symptomsLower.includes('stool'))) {
      redFlags.push('GI bleeding - assess hemodynamic stability');
    }
    if (symptomsLower.includes('weakness') && symptomsLower.includes('one side')) {
      redFlags.push('Unilateral weakness - stroke evaluation needed');
    }

    // Vital sign-based red flags
    if (vitalSigns) {
      if (vitalSigns.temperature && vitalSigns.temperature >= 39.5) {
        redFlags.push('High fever - evaluate for serious infection');
      }
      if (vitalSigns.heartRate && vitalSigns.heartRate > 120) {
        redFlags.push('Tachycardia - assess for underlying cause');
      }
      if (vitalSigns.oxygenSaturation && vitalSigns.oxygenSaturation < 92) {
        redFlags.push('Hypoxemia - immediate respiratory assessment needed');
      }
    }

    return redFlags;
  }

  private getFallbackDiagnosisSuggestions(input: DiagnosisInput): DiagnosisSuggestionsResponse {
    const symptomDiagnosisMap: Record<string, DiagnosisSuggestion[]> = {
      'fever': [
        { icd10Code: 'R50.9', name: 'Fever, unspecified', confidence: 0.6 },
        { icd10Code: 'J06.9', name: 'Upper respiratory infection', confidence: 0.5 },
        { icd10Code: 'N39.0', name: 'Urinary tract infection', confidence: 0.4 },
      ],
      'cough': [
        { icd10Code: 'R05.9', name: 'Cough, unspecified', confidence: 0.6 },
        { icd10Code: 'J06.9', name: 'Upper respiratory infection', confidence: 0.5 },
        { icd10Code: 'J18.9', name: 'Pneumonia, unspecified', confidence: 0.4 },
      ],
      'headache': [
        { icd10Code: 'R51.9', name: 'Headache, unspecified', confidence: 0.6 },
        { icd10Code: 'G43.909', name: 'Migraine', confidence: 0.5 },
        { icd10Code: 'G44.1', name: 'Tension-type headache', confidence: 0.4 },
      ],
      'chest pain': [
        { icd10Code: 'R07.9', name: 'Chest pain, unspecified', confidence: 0.5 },
        { icd10Code: 'I25.9', name: 'Chronic ischemic heart disease', confidence: 0.4 },
        { icd10Code: 'R07.1', name: 'Chest pain on breathing', confidence: 0.3 },
      ],
      'abdominal pain': [
        { icd10Code: 'R10.9', name: 'Abdominal pain, unspecified', confidence: 0.5 },
        { icd10Code: 'K30', name: 'Dyspepsia', confidence: 0.4 },
        { icd10Code: 'K29.70', name: 'Gastritis', confidence: 0.3 },
      ],
    };

    const differentialDiagnoses: DiagnosisSuggestion[] = [];
    const seenCodes = new Set<string>();

    for (const symptom of input.symptoms) {
      const symptomLower = symptom.toLowerCase();
      for (const [key, diagnoses] of Object.entries(symptomDiagnosisMap)) {
        if (symptomLower.includes(key)) {
          for (const diagnosis of diagnoses) {
            if (!seenCodes.has(diagnosis.icd10Code)) {
              seenCodes.add(diagnosis.icd10Code);
              differentialDiagnoses.push(diagnosis);
            }
          }
        }
      }
    }

    return {
      differentialDiagnoses: differentialDiagnoses.slice(0, 5),
      redFlags: this.identifyRedFlags(input.symptoms, input.vitalSigns),
      urgentConsiderations: [],
      recommendedTests: ['Complete Blood Count', 'Basic Metabolic Panel'],
      modelVersion: 'fallback-1.0',
      disclaimer: 'AI service unavailable. Basic suggestions provided. Clinical judgment required.',
    };
  }

  private checkLocalDrugInteractions(drugName: string, allMedications: string[]): DrugInteraction[] {
    const interactions: DrugInteraction[] = [];
    const drugLower = drugName.toLowerCase();

    const interactionDatabase: Record<string, { drugs: string[]; severity: DrugInteraction['severity']; description: string }[]> = {
      'warfarin': [
        { drugs: ['aspirin', 'ibuprofen', 'naproxen'], severity: 'HIGH', description: 'Increased bleeding risk' },
        { drugs: ['fluconazole', 'metronidazole'], severity: 'MODERATE', description: 'Increased INR' },
      ],
      'metformin': [
        { drugs: ['contrast dye'], severity: 'HIGH', description: 'Risk of lactic acidosis' },
      ],
      'digoxin': [
        { drugs: ['amiodarone', 'verapamil'], severity: 'HIGH', description: 'Increased digoxin toxicity' },
      ],
      'lisinopril': [
        { drugs: ['potassium', 'spironolactone'], severity: 'HIGH', description: 'Risk of hyperkalemia' },
      ],
      'simvastatin': [
        { drugs: ['erythromycin', 'clarithromycin'], severity: 'HIGH', description: 'Increased rhabdomyolysis risk' },
      ],
    };

    for (const [drug, drugInteractions] of Object.entries(interactionDatabase)) {
      if (drugLower.includes(drug)) {
        for (const interaction of drugInteractions) {
          for (const otherMed of allMedications) {
            const otherMedLower = otherMed.toLowerCase();
            if (otherMedLower !== drugLower && interaction.drugs.some(d => otherMedLower.includes(d))) {
              interactions.push({
                drug1: drugName,
                drug2: otherMed,
                severity: interaction.severity,
                description: interaction.description,
                recommendation: 'Review necessity of combination therapy',
              });
            }
          }
        }
      }
    }

    return interactions;
  }

  private validateDosage(
    drugName: string,
    dose: number,
    unit: string,
    frequency: string,
    patientAge?: number,
    patientWeight?: number
  ): { isValid: boolean; message?: string; suggestedDose?: string } {
    // Common drug dosing limits
    const dosingLimits: Record<string, { maxSingle: number; maxDaily: number; unit: string }> = {
      'acetaminophen': { maxSingle: 1000, maxDaily: 4000, unit: 'mg' },
      'paracetamol': { maxSingle: 1000, maxDaily: 4000, unit: 'mg' },
      'ibuprofen': { maxSingle: 800, maxDaily: 3200, unit: 'mg' },
      'omeprazole': { maxSingle: 40, maxDaily: 80, unit: 'mg' },
      'metformin': { maxSingle: 1000, maxDaily: 2550, unit: 'mg' },
      'lisinopril': { maxSingle: 40, maxDaily: 80, unit: 'mg' },
      'metoprolol': { maxSingle: 200, maxDaily: 400, unit: 'mg' },
    };

    const drugLower = drugName.toLowerCase();
    const matchedDrug = Object.keys(dosingLimits).find(d => drugLower.includes(d));

    if (matchedDrug && unit.toLowerCase() === 'mg') {
      const limits = dosingLimits[matchedDrug];

      if (dose > limits.maxSingle) {
        return {
          isValid: false,
          message: `Dose exceeds maximum single dose of ${limits.maxSingle}${limits.unit}`,
          suggestedDose: `${limits.maxSingle}${limits.unit}`,
        };
      }

      // Estimate daily dose based on frequency
      let dosesPerDay = 1;
      const freqLower = frequency.toLowerCase();
      if (freqLower.includes('bid') || freqLower.includes('twice')) dosesPerDay = 2;
      else if (freqLower.includes('tid') || freqLower.includes('three')) dosesPerDay = 3;
      else if (freqLower.includes('qid') || freqLower.includes('four')) dosesPerDay = 4;
      else if (freqLower.includes('q4h')) dosesPerDay = 6;
      else if (freqLower.includes('q6h')) dosesPerDay = 4;
      else if (freqLower.includes('q8h')) dosesPerDay = 3;

      const estimatedDaily = dose * dosesPerDay;
      if (estimatedDaily > limits.maxDaily) {
        return {
          isValid: false,
          message: `Estimated daily dose (${estimatedDaily}${limits.unit}) exceeds maximum of ${limits.maxDaily}${limits.unit}`,
        };
      }
    }

    // Elderly dose consideration
    if (patientAge && patientAge >= 65) {
      const elderlyReducedDoseDrugs = ['benzodiazepine', 'opioid', 'nsaid'];
      if (elderlyReducedDoseDrugs.some(d => drugLower.includes(d))) {
        return {
          isValid: true,
          message: 'Consider reduced dose in elderly patient (age >= 65)',
        };
      }
    }

    return { isValid: true };
  }

  private checkRenalDoseAdjustment(
    drugName: string,
    renalFunction: 'MILD' | 'MODERATE' | 'SEVERE'
  ): { required: boolean; suggestion?: string } {
    const renalAdjustedDrugs: Record<string, Record<string, string>> = {
      'metformin': {
        'MILD': 'No adjustment needed (eGFR > 45)',
        'MODERATE': 'Reduce to max 1000mg/day (eGFR 30-45)',
        'SEVERE': 'CONTRAINDICATED (eGFR < 30)',
      },
      'gabapentin': {
        'MILD': 'Reduce dose by 25%',
        'MODERATE': 'Reduce dose by 50%',
        'SEVERE': 'Reduce dose by 75%',
      },
      'enoxaparin': {
        'MILD': 'No adjustment',
        'MODERATE': 'Monitor anti-Xa levels',
        'SEVERE': 'Reduce dose by 50%',
      },
      'lisinopril': {
        'MILD': 'Start low (5mg)',
        'MODERATE': 'Start low (2.5mg)',
        'SEVERE': 'Start very low (2.5mg), monitor closely',
      },
    };

    const drugLower = drugName.toLowerCase();
    for (const [drug, adjustments] of Object.entries(renalAdjustedDrugs)) {
      if (drugLower.includes(drug)) {
        const suggestion = adjustments[renalFunction];
        if (suggestion) {
          return { required: true, suggestion };
        }
      }
    }

    return { required: false };
  }

  private generateFallbackSOAPNote(data: ConsultationData): SOAPNote {
    const subjective = [
      `Chief Complaint: ${data.chiefComplaint}`,
      data.symptoms.length > 0 ? `Symptoms: ${data.symptoms.join(', ')}` : '',
      data.historyOfPresentIllness ? `HPI: ${data.historyOfPresentIllness}` : '',
      data.pastMedicalHistory?.length ? `PMH: ${data.pastMedicalHistory.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const objectiveParts: string[] = [];
    if (data.vitalSigns) {
      const vitals = [];
      if (data.vitalSigns.temperature) vitals.push(`Temp: ${data.vitalSigns.temperature}C`);
      if (data.vitalSigns.systolicBP) vitals.push(`BP: ${data.vitalSigns.systolicBP}/${data.vitalSigns.diastolicBP || '-'}`);
      if (data.vitalSigns.heartRate) vitals.push(`HR: ${data.vitalSigns.heartRate}`);
      if (data.vitalSigns.respiratoryRate) vitals.push(`RR: ${data.vitalSigns.respiratoryRate}`);
      if (data.vitalSigns.oxygenSaturation) vitals.push(`SpO2: ${data.vitalSigns.oxygenSaturation}%`);
      if (vitals.length > 0) objectiveParts.push(`Vitals: ${vitals.join(', ')}`);
    }
    if (data.physicalExamination) objectiveParts.push(`Physical Exam: ${data.physicalExamination}`);
    const objective = objectiveParts.join('\n') || 'See examination notes.';

    const assessment = [
      data.diagnosis.length > 0 ? `Diagnosis: ${data.diagnosis.join('; ')}` : '',
      data.icdCodes.length > 0 ? `ICD-10: ${data.icdCodes.join(', ')}` : '',
    ].filter(Boolean).join('\n') || 'Assessment pending further evaluation.';

    const planParts: string[] = [];
    if (data.treatmentPlan) planParts.push(data.treatmentPlan);
    if (data.prescriptions?.length) {
      planParts.push('Medications:');
      data.prescriptions.forEach(rx => {
        planParts.push(`  - ${rx.drugName} ${rx.dose} ${rx.frequency} x ${rx.duration}`);
      });
    }
    if (data.labOrdersRequested?.length) planParts.push(`Labs: ${data.labOrdersRequested.join(', ')}`);
    if (data.imagingOrdersRequested?.length) planParts.push(`Imaging: ${data.imagingOrdersRequested.join(', ')}`);
    if (data.followUpPlan) planParts.push(`Follow-up: ${data.followUpPlan}`);
    const plan = planParts.join('\n') || 'Plan to be determined.';

    const formattedNote = `SUBJECTIVE:\n${subjective}\n\nOBJECTIVE:\n${objective}\n\nASSESSMENT:\n${assessment}\n\nPLAN:\n${plan}`;

    return {
      subjective,
      objective,
      assessment,
      plan,
      icd10Codes: data.icdCodes.map(code => ({ code, description: 'See diagnosis' })),
      cptCodes: [{ code: '99213', description: 'Office visit, established patient' }],
      formattedNote,
      generatedAt: new Date().toISOString(),
      modelVersion: 'template-1.0',
    };
  }

  private getWarningSignsForDiagnosis(diagnosis: string[]): string[] {
    const warningSignsMap: Record<string, string[]> = {
      'pneumonia': [
        'Worsening shortness of breath',
        'High fever (>39C/102F) not responding to medication',
        'Confusion or altered mental status',
        'Chest pain that worsens',
        'Coughing up blood',
      ],
      'infection': [
        'Fever not improving after 48-72 hours',
        'Spreading redness or swelling',
        'New or worsening pain',
        'Confusion or drowsiness',
      ],
      'chest pain': [
        'Return of chest pain or pressure',
        'Pain spreading to arm, jaw, or back',
        'Shortness of breath',
        'Sweating, nausea, or dizziness',
        'Loss of consciousness',
      ],
      'diabetes': [
        'Blood sugar consistently above 300 mg/dL',
        'Fruity breath odor',
        'Excessive thirst or urination',
        'Nausea, vomiting, or abdominal pain',
        'Confusion or difficulty staying awake',
      ],
      'hypertension': [
        'Severe headache',
        'Vision changes',
        'Chest pain or shortness of breath',
        'Numbness or weakness',
        'Difficulty speaking',
      ],
    };

    const warningsSigns: string[] = [];
    const diagnosisLower = diagnosis.join(' ').toLowerCase();

    for (const [condition, signs] of Object.entries(warningSignsMap)) {
      if (diagnosisLower.includes(condition)) {
        warningsSigns.push(...signs);
      }
    }

    // Default warning signs if none matched
    if (warningsSigns.length === 0) {
      return [
        'Worsening of symptoms',
        'New or unexplained symptoms',
        'High fever (>39C/102F)',
        'Difficulty breathing',
        'Severe pain',
        'Confusion or altered mental status',
      ];
    }

    // Remove duplicates
    return [...new Set(warningsSigns)];
  }

  private getPatientInstructions(diagnosis: string[], treatmentPlan?: string | null): string[] {
    const instructions: string[] = [
      'Take all medications as prescribed',
      'Complete the full course of any antibiotics',
      'Keep all follow-up appointments',
      'Seek emergency care if warning signs occur',
    ];

    const diagnosisLower = diagnosis.join(' ').toLowerCase();

    if (diagnosisLower.includes('fever') || diagnosisLower.includes('infection')) {
      instructions.push('Stay well hydrated');
      instructions.push('Rest as much as possible');
      instructions.push('Monitor temperature regularly');
    }

    if (diagnosisLower.includes('respiratory') || diagnosisLower.includes('pneumonia') || diagnosisLower.includes('cough')) {
      instructions.push('Avoid smoking and secondhand smoke');
      instructions.push('Use humidifier if helpful');
      instructions.push('Practice good hand hygiene');
    }

    if (diagnosisLower.includes('diabetes')) {
      instructions.push('Monitor blood glucose as directed');
      instructions.push('Follow prescribed diet plan');
      instructions.push('Check feet daily for any changes');
    }

    if (diagnosisLower.includes('hypertension')) {
      instructions.push('Monitor blood pressure at home');
      instructions.push('Reduce sodium intake');
      instructions.push('Continue regular exercise as tolerated');
    }

    return instructions;
  }

  private getLifestyleRecommendations(diagnosis: string[]): string[] {
    const recommendations: string[] = [];
    const diagnosisLower = diagnosis.join(' ').toLowerCase();

    if (diagnosisLower.includes('hypertension') || diagnosisLower.includes('cardiac') || diagnosisLower.includes('heart')) {
      recommendations.push('Maintain a heart-healthy diet (low sodium, low saturated fat)');
      recommendations.push('Engage in regular moderate exercise (150 min/week)');
      recommendations.push('Limit alcohol consumption');
      recommendations.push('Maintain healthy weight');
      recommendations.push('Manage stress through relaxation techniques');
    }

    if (diagnosisLower.includes('diabetes')) {
      recommendations.push('Follow a balanced diet with controlled carbohydrate intake');
      recommendations.push('Exercise regularly (at least 30 min most days)');
      recommendations.push('Maintain healthy weight');
      recommendations.push('Quit smoking if applicable');
      recommendations.push('Limit alcohol consumption');
    }

    if (diagnosisLower.includes('respiratory') || diagnosisLower.includes('asthma') || diagnosisLower.includes('copd')) {
      recommendations.push('Avoid smoking and secondhand smoke');
      recommendations.push('Avoid known respiratory irritants');
      recommendations.push('Stay up to date with vaccinations (flu, pneumonia)');
      recommendations.push('Practice breathing exercises');
    }

    if (diagnosisLower.includes('gastro') || diagnosisLower.includes('reflux') || diagnosisLower.includes('gerd')) {
      recommendations.push('Eat smaller, more frequent meals');
      recommendations.push('Avoid lying down after eating');
      recommendations.push('Limit spicy, acidic, and fatty foods');
      recommendations.push('Maintain healthy weight');
      recommendations.push('Elevate head of bed if nighttime symptoms');
    }

    return recommendations;
  }
}

// Export singleton instance
export const aiConsultationService = new AIConsultationService();
