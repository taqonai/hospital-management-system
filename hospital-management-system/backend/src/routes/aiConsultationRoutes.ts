import { Router, Response } from 'express';
import { authenticate, authorize, authorizeWithPermission, authorizeHospital } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { AuthenticatedRequest } from '../types';
import { aiConsultationService } from '../services/aiConsultationService';
import { consultationService } from '../services/consultationService';

const router = Router();

/**
 * AI Consultation Routes
 *
 * These routes expose AI-powered clinical decision support features
 * for doctors and nurses during patient consultations.
 */

// ============= Patient Context =============

/**
 * GET /patient-context/:patientId
 * Get AI-enhanced patient context with insights
 *
 * Returns comprehensive patient summary including:
 * - Demographics and vital information
 * - Medical history summary
 * - Active medications and allergies
 * - AI-generated insights and recommendations
 */
router.get(
  '/patient-context/:patientId',
  authenticate,
  authorizeWithPermission('ai:diagnostic', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
  authorizeHospital,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { patientId } = req.params;

    if (!patientId) {
      return sendError(res, 'Patient ID is required', 400);
    }

    const result = await aiConsultationService.getPatientAIContext(
      req.user!.hospitalId,
      patientId
    );

    sendSuccess(res, result, 'Patient context retrieved successfully');
  })
);

// ============= Vital Signs Interpretation =============

/**
 * POST /interpret-vitals
 * Interpret vital signs using NEWS2 scoring
 *
 * Request body:
 * - respiratoryRate: number (breaths per minute)
 * - oxygenSaturation: number (SpO2 percentage)
 * - temperature: number (Celsius)
 * - systolicBP: number (mmHg)
 * - heartRate: number (beats per minute)
 * - consciousness: string ('alert' | 'verbal' | 'pain' | 'unresponsive')
 * - patientId?: string (optional, for contextual analysis)
 *
 * Returns:
 * - NEWS2 score and interpretation
 * - Clinical alerts and warnings
 * - Recommended actions
 */
router.post(
  '/interpret-vitals',
  authenticate,
  authorizeWithPermission('ai:diagnostic', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      respiratoryRate,
      oxygenSaturation,
      temperature,
      systolicBP,
      heartRate,
      consciousness,
      patientId,
    } = req.body;

    // Validate required vital signs
    if (
      respiratoryRate === undefined ||
      oxygenSaturation === undefined ||
      temperature === undefined ||
      systolicBP === undefined ||
      heartRate === undefined ||
      consciousness === undefined
    ) {
      return sendError(
        res,
        'All vital signs are required: respiratoryRate, oxygenSaturation, temperature, systolicBP, heartRate, consciousness',
        400
      );
    }

    const result = aiConsultationService.interpretVitals({
      respiratoryRate: Number(respiratoryRate),
      oxygenSaturation: Number(oxygenSaturation),
      temperature: Number(temperature),
      systolicBP: Number(systolicBP),
      heartRate: Number(heartRate),
      consciousness: consciousness.toUpperCase() as 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE',
    });

    sendSuccess(res, result, 'Vital signs interpreted successfully');
  })
);

// ============= Diagnosis Suggestions =============

/**
 * POST /suggest-diagnosis
 * Get AI-powered diagnosis suggestions
 *
 * Request body:
 * - symptoms: string[] (list of presenting symptoms)
 * - patientId?: string (optional, for patient history context)
 * - patientAge?: number (age in years)
 * - patientGender?: string ('male' | 'female' | 'other')
 * - medicalHistory?: string[] (optional, relevant medical history)
 *
 * Returns:
 * - Differential diagnoses with ICD-10 codes
 * - Confidence scores
 * - Supporting evidence
 */
router.post(
  '/suggest-diagnosis',
  authenticate,
  authorizeWithPermission('ai:diagnostic', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { symptoms, patientId, patientAge, patientGender, medicalHistory } = req.body;

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return sendError(res, 'At least one symptom is required', 400);
    }

    const result = await aiConsultationService.getDiagnosisSuggestions({
      symptoms,
      patientAge: patientAge ? Number(patientAge) : 30,
      patientGender: patientGender || 'unknown',
      medicalHistory,
    });

    sendSuccess(res, result, 'Diagnosis suggestions generated successfully');
  })
);

// ============= Test Recommendations =============

/**
 * POST /recommend-tests
 * Get recommended laboratory and imaging tests
 *
 * Request body:
 * - diagnosis: string (primary or suspected diagnosis)
 * - patientId?: string (optional, for patient context)
 * - symptoms?: string[] (optional, presenting symptoms)
 *
 * Returns:
 * - Prioritized test recommendations
 * - Rationale for each test
 * - Urgency indicators
 */
router.post(
  '/recommend-tests',
  authenticate,
  authorizeWithPermission('ai:diagnostic', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { diagnosis, patientId, symptoms } = req.body;

    if (!diagnosis) {
      return sendError(res, 'Diagnosis is required', 400);
    }

    const result = await aiConsultationService.getRecommendedTests(
      diagnosis,
      { symptoms }
    );

    sendSuccess(res, result, 'Test recommendations generated successfully');
  })
);

// ============= Prescription Validation =============

/**
 * POST /validate-prescription
 * Validate prescription in real-time
 *
 * Request body:
 * - medications: Array<{ name: string, dosage: string, frequency: string, route: string }>
 * - patientId: string (required for patient-specific checks)
 *
 * Returns:
 * - Drug-drug interaction warnings
 * - Allergy alerts
 * - Dosage validation results
 * - Contraindication warnings
 */
router.post(
  '/validate-prescription',
  authenticate,
  authorizeWithPermission('ai:diagnostic', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { medications, patientId } = req.body;

    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      return sendError(res, 'At least one medication is required', 400);
    }

    if (!patientId) {
      return sendError(res, 'Patient ID is required for prescription validation', 400);
    }

    // Validate medication objects
    for (const med of medications) {
      if (!med.name || !med.dosage || !med.frequency || !med.route) {
        return sendError(
          res,
          'Each medication must have name, dosage, frequency, and route',
          400
        );
      }
    }

    const result = await aiConsultationService.validatePrescription({
      patientId,
      medications: medications.map((med: any) => ({
        drugName: med.name,
        dose: parseFloat(med.dosage) || 0,
        unit: 'mg',
        frequency: med.frequency,
        route: med.route,
      })),
    });

    sendSuccess(res, result, 'Prescription validated successfully');
  })
);

// ============= SOAP Note Generation =============

/**
 * POST /generate-soap
 * Generate SOAP (Subjective, Objective, Assessment, Plan) notes
 *
 * Request body:
 * - consultationId?: string (optional, link to existing consultation)
 * - symptoms: string | string[] (patient's chief complaints and symptoms)
 * - vitals: object (vital signs recorded during visit)
 * - diagnosis: string | string[] (clinical diagnosis)
 * - treatment: string | string[] (treatment plan)
 * - notes?: string (additional clinical notes)
 *
 * Returns:
 * - Formatted SOAP note
 * - Structured sections (Subjective, Objective, Assessment, Plan)
 */
router.post(
  '/generate-soap',
  authenticate,
  authorizeWithPermission('ai:diagnostic', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { consultationId, symptoms, vitals, diagnosis, treatment, notes } = req.body;

    if (!symptoms) {
      return sendError(res, 'Symptoms are required', 400);
    }

    if (!diagnosis) {
      return sendError(res, 'Diagnosis is required', 400);
    }

    if (!treatment) {
      return sendError(res, 'Treatment plan is required', 400);
    }

    const result = await aiConsultationService.generateSOAPNotes({
      patientId: '',
      doctorId: req.user!.userId,
      chiefComplaint: Array.isArray(symptoms) ? symptoms.join(', ') : symptoms,
      symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
      vitalSigns: vitals || undefined,
      diagnosis: Array.isArray(diagnosis) ? diagnosis : [diagnosis],
      icdCodes: [],
      treatmentPlan: Array.isArray(treatment) ? treatment.join('; ') : treatment,
      followUpPlan: notes,
    });

    sendSuccess(res, result, 'SOAP note generated successfully');
  })
);

// ============= Follow-up Recommendations =============

/**
 * GET /follow-up/:consultationId
 * Get follow-up recommendations for a consultation
 *
 * Returns:
 * - Recommended follow-up timeline
 * - Warning signs to monitor
 * - Lifestyle and care recommendations
 * - Medication adherence reminders
 */
router.get(
  '/follow-up/:consultationId',
  authenticate,
  authorizeWithPermission('ai:diagnostic', ['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']),
  authorizeHospital,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { consultationId } = req.params;

    if (!consultationId) {
      return sendError(res, 'Consultation ID is required', 400);
    }

    const result = await aiConsultationService.getFollowUpRecommendations(
      consultationId
    );

    sendSuccess(res, result, 'Follow-up recommendations retrieved successfully');
  })
);

// ============= Complete Consultation =============

/**
 * POST /complete
 * Save and complete a consultation with all data
 *
 * Request body:
 * - appointmentId: string (required)
 * - patientId: string (required)
 * - chiefComplaint: string (required)
 * - diagnosis: string[] (required - at least one)
 * - icdCodes: string[] (optional)
 * - historyOfIllness: string (optional)
 * - examination: string (optional)
 * - treatmentPlan: string (optional)
 * - advice: string (optional)
 * - followUpDate: Date (optional)
 * - notes: string (optional)
 *
 * Returns:
 * - Created/updated consultation record
 * - Appointment is marked as COMPLETED
 */
router.post(
  '/complete',
  authenticate,
  authorizeWithPermission('ai:diagnostic', ['DOCTOR', 'HOSPITAL_ADMIN']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const {
      appointmentId,
      patientId,
      chiefComplaint,
      diagnosis,
      icdCodes,
      historyOfIllness,
      examination,
      treatmentPlan,
      advice,
      followUpDate,
      notes,
    } = req.body;

    if (!appointmentId) {
      return sendError(res, 'Appointment ID is required', 400);
    }

    if (!patientId) {
      return sendError(res, 'Patient ID is required', 400);
    }

    if (!chiefComplaint || chiefComplaint.trim() === '') {
      return sendError(res, 'Chief complaint is required', 400);
    }

    if (!diagnosis || !Array.isArray(diagnosis) || diagnosis.length === 0) {
      return sendError(res, 'At least one diagnosis is required', 400);
    }

    // Get doctorId from the logged-in user
    const doctor = await import('../config/database').then(db =>
      db.default.doctor.findFirst({
        where: { userId: req.user!.userId },
        select: { id: true },
      })
    );

    if (!doctor) {
      return sendError(res, 'Doctor profile not found for this user', 400);
    }

    const result = await consultationService.saveAndComplete({
      appointmentId,
      patientId,
      doctorId: doctor.id,
      hospitalId: req.user!.hospitalId,
      chiefComplaint,
      diagnosis,
      icdCodes: icdCodes || [],
      historyOfIllness,
      examination,
      treatmentPlan,
      advice,
      followUpDate: followUpDate ? new Date(followUpDate) : undefined,
      notes,
    });

    sendSuccess(res, result, 'Consultation completed successfully');
  })
);

export default router;
