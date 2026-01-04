import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/response';
import { z } from 'zod';
import { validate } from '../middleware/validation';
import logger from '../utils/logger';
import { symptomCheckerService, TriageLevel } from '../services/symptomCheckerService';
import { authenticate, optionalAuth } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const startSessionSchema = z.object({
  body: z.object({
    patientInfo: z.object({
      patientId: z.string().optional(),
      age: z.number().int().min(0).max(150).optional(),
      gender: z.string().optional(),
      medicalHistory: z.array(z.string()).optional(),
      currentMedications: z.array(z.string()).optional(),
      allergies: z.array(z.string()).optional(),
    }).optional(),
    initialSymptoms: z.array(z.string()).optional(),
    hospitalId: z.string().optional(),
  }),
});

const respondSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    responses: z.array(z.object({
      questionId: z.string().min(1, 'Question ID is required'),
      answer: z.any(),
    })).min(1, 'At least one response is required'),
  }),
});

const completeSchema = z.object({
  body: z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
  }),
});

const quickCheckSchema = z.object({
  body: z.object({
    symptoms: z.array(z.string()).min(1, 'At least one symptom is required'),
  }),
});

const analyzeSchema = z.object({
  body: z.object({
    bodyPart: z.string().min(1, 'Body part is required'),
    symptoms: z.array(z.string()).min(1, 'At least one symptom is required'),
    duration: z.string().optional(),
    severity: z.enum(['mild', 'moderate', 'severe', 'very_severe']).optional(),
    additionalSymptoms: z.array(z.string()).optional(),
    patientAge: z.number().int().min(0).max(150).optional(),
    patientGender: z.enum(['male', 'female', 'other']).optional(),
  }),
});

// =============================================================================
// Local Symptom Analysis Logic (Fallback)
// =============================================================================

interface TriageResult {
  session_id: string;
  urgency: 'self-care' | 'schedule-appointment' | 'urgent-care' | 'emergency';
  urgency_level: 1 | 2 | 3 | 4;
  urgency_color: string;
  primary_concern: string;
  body_part: string;
  severity: string;
  symptoms_summary: string[];
  possible_conditions: Array<{ name: string; likelihood: string; note: string }>;
  recommended_department: string;
  follow_up_questions: string[];
  self_care_advice: string[];
  when_to_seek_help: string[];
  red_flags_present: boolean;
  red_flag_symptoms: string[];
  disclaimer: string;
}

const SYMPTOM_CONDITION_MAP: Record<string, {
  conditions: Array<{ name: string; likelihood: string; note: string }>;
  department: string;
  urgencyBase: 'self-care' | 'schedule-appointment' | 'urgent-care' | 'emergency';
  selfCare: string[];
  seekHelp: string[];
}> = {
  head: {
    conditions: [
      { name: 'Tension Headache', likelihood: 'High', note: 'Common, often stress-related' },
      { name: 'Migraine', likelihood: 'Moderate', note: 'May include nausea, light sensitivity' },
      { name: 'Sinusitis', likelihood: 'Moderate', note: 'Often accompanies congestion' },
    ],
    department: 'General Medicine',
    urgencyBase: 'schedule-appointment',
    selfCare: ['Rest in a quiet, dark room', 'Stay hydrated', 'Over-the-counter pain relief (follow package directions)', 'Apply cold compress to forehead'],
    seekHelp: ['Sudden severe headache (worst of your life)', 'Headache with fever and stiff neck', 'Headache after head injury', 'Vision changes or confusion'],
  },
  chest: {
    conditions: [
      { name: 'Musculoskeletal Pain', likelihood: 'Moderate', note: 'Often worse with movement' },
      { name: 'Acid Reflux/GERD', likelihood: 'Moderate', note: 'May worsen after eating' },
      { name: 'Respiratory Infection', likelihood: 'Moderate', note: 'Often with cough' },
    ],
    department: 'Cardiology / General Medicine',
    urgencyBase: 'urgent-care',
    selfCare: ['Avoid heavy meals', 'Rest in comfortable position', 'Antacids for reflux symptoms'],
    seekHelp: ['Crushing or squeezing chest pain', 'Pain radiating to arm, jaw, or back', 'Shortness of breath at rest', 'Sweating with chest discomfort'],
  },
  abdomen: {
    conditions: [
      { name: 'Gastritis', likelihood: 'Moderate', note: 'Pain often after eating' },
      { name: 'Irritable Bowel Syndrome', likelihood: 'Moderate', note: 'May have bloating, changed bowel habits' },
      { name: 'Gastroenteritis', likelihood: 'Moderate', note: 'Often with nausea, vomiting, or diarrhea' },
    ],
    department: 'Gastroenterology',
    urgencyBase: 'schedule-appointment',
    selfCare: ['Eat bland foods', 'Stay hydrated', 'Avoid spicy or fatty foods', 'Rest'],
    seekHelp: ['Severe abdominal pain', 'Blood in stool or vomit', 'High fever with abdominal pain', 'Unable to keep fluids down for 24 hours'],
  },
  back: {
    conditions: [
      { name: 'Muscle Strain', likelihood: 'High', note: 'Common, often from activity' },
      { name: 'Disc Problem', likelihood: 'Moderate', note: 'May have radiating pain to legs' },
      { name: 'Poor Posture', likelihood: 'Moderate', note: 'Often chronic, worse with sitting' },
    ],
    department: 'Orthopedics',
    urgencyBase: 'schedule-appointment',
    selfCare: ['Apply ice for first 48 hours, then heat', 'Gentle stretching', 'Over-the-counter pain relief', 'Maintain good posture'],
    seekHelp: ['Numbness or weakness in legs', 'Loss of bladder/bowel control', 'Severe pain after injury', 'Pain with fever'],
  },
  throat_neck: {
    conditions: [
      { name: 'Pharyngitis', likelihood: 'High', note: 'Common viral or bacterial infection' },
      { name: 'Tonsillitis', likelihood: 'Moderate', note: 'May have swollen tonsils' },
      { name: 'Laryngitis', likelihood: 'Moderate', note: 'Often with hoarseness' },
    ],
    department: 'ENT / General Medicine',
    urgencyBase: 'schedule-appointment',
    selfCare: ['Warm salt water gargles', 'Stay hydrated', 'Rest your voice', 'Lozenges for comfort'],
    seekHelp: ['Difficulty breathing or swallowing', 'Unable to open mouth fully', 'High fever (over 101F/38.3C)', 'Symptoms lasting more than a week'],
  },
  skin: {
    conditions: [
      { name: 'Dermatitis', likelihood: 'Moderate', note: 'May be contact or allergic' },
      { name: 'Eczema', likelihood: 'Moderate', note: 'Often itchy, may be chronic' },
      { name: 'Allergic Reaction', likelihood: 'Moderate', note: 'May have specific trigger' },
    ],
    department: 'Dermatology',
    urgencyBase: 'schedule-appointment',
    selfCare: ['Keep skin moisturized', 'Avoid scratching', 'Use mild, fragrance-free products', 'Cool compresses for itching'],
    seekHelp: ['Rapidly spreading rash', 'Difficulty breathing with rash', 'Blisters or open sores', 'Signs of infection (pus, increasing redness)'],
  },
  general: {
    conditions: [
      { name: 'Viral Infection', likelihood: 'High', note: 'Common, self-limiting' },
      { name: 'Fatigue Syndrome', likelihood: 'Moderate', note: 'May need further evaluation' },
      { name: 'Stress-Related Symptoms', likelihood: 'Moderate', note: 'Often multisystem' },
    ],
    department: 'General Medicine',
    urgencyBase: 'schedule-appointment',
    selfCare: ['Get adequate rest', 'Stay hydrated', 'Maintain balanced nutrition', 'Manage stress'],
    seekHelp: ['High fever lasting more than 3 days', 'Severe or worsening symptoms', 'Unable to perform daily activities', 'New or unusual symptoms'],
  },
};

const RED_FLAG_SYMPTOMS = [
  'chest pain',
  'difficulty breathing',
  'severe bleeding',
  'sudden severe headache',
  'confusion',
  'loss of consciousness',
  'severe allergic reaction',
  'stroke symptoms',
  'severe abdominal pain',
  'suicidal thoughts',
];

const DURATION_URGENCY_MODIFIER: Record<string, number> = {
  'less_than_24h': 0,
  '1_3_days': 0,
  '4_7_days': 0,
  '1_2_weeks': 1,
  '2_4_weeks': 1,
  'more_than_month': 0,
};

const SEVERITY_URGENCY_MODIFIER: Record<string, number> = {
  'mild': -1,
  'moderate': 0,
  'severe': 1,
  'very_severe': 2,
};

function analyzeSymptoms(data: {
  bodyPart: string;
  symptoms: string[];
  duration?: string;
  severity?: string;
  additionalSymptoms?: string[];
  patientAge?: number;
  patientGender?: string;
}): TriageResult {
  const {
    bodyPart,
    symptoms,
    duration = '1_3_days',
    severity = 'moderate',
    additionalSymptoms = [],
    patientAge,
  } = data;

  const bodyPartKey = bodyPart.toLowerCase().replace(/\s+/g, '_');
  const bodyPartData = SYMPTOM_CONDITION_MAP[bodyPartKey] || SYMPTOM_CONDITION_MAP['general'];

  const allSymptoms = [...symptoms, ...additionalSymptoms].map(s => s.toLowerCase());
  const redFlagsFound = RED_FLAG_SYMPTOMS.filter(rf =>
    allSymptoms.some(s => s.includes(rf))
  );
  const hasRedFlags = redFlagsFound.length > 0;

  let urgencyScore = 2;

  if (hasRedFlags) {
    urgencyScore = 4;
  } else {
    urgencyScore += DURATION_URGENCY_MODIFIER[duration] || 0;
    urgencyScore += SEVERITY_URGENCY_MODIFIER[severity] || 0;

    if (patientAge !== undefined) {
      if (patientAge < 5 || patientAge > 70) {
        urgencyScore += 1;
      }
    }
  }

  urgencyScore = Math.max(1, Math.min(4, urgencyScore));

  const urgencyMap: Record<number, 'self-care' | 'schedule-appointment' | 'urgent-care' | 'emergency'> = {
    1: 'self-care',
    2: 'schedule-appointment',
    3: 'urgent-care',
    4: 'emergency',
  };

  const urgencyColorMap: Record<number, string> = {
    1: 'green',
    2: 'blue',
    3: 'orange',
    4: 'red',
  };

  const urgency = urgencyMap[urgencyScore];
  const urgencyColor = urgencyColorMap[urgencyScore];

  const result: TriageResult = {
    session_id: `analyze-${Date.now()}`,
    urgency,
    urgency_level: urgencyScore as 1 | 2 | 3 | 4,
    urgency_color: urgencyColor,
    primary_concern: symptoms[0] || 'General discomfort',
    body_part: bodyPartData === SYMPTOM_CONDITION_MAP['general'] ? 'General' : bodyPart,
    severity: severity,
    symptoms_summary: allSymptoms.slice(0, 5),
    possible_conditions: bodyPartData.conditions,
    recommended_department: hasRedFlags ? 'Emergency Department' : bodyPartData.department,
    follow_up_questions: [
      'Have you taken any medications for this?',
      'Do symptoms worsen at specific times?',
      'Have you experienced this before?',
    ],
    self_care_advice: urgencyScore <= 2 ? bodyPartData.selfCare : ['Seek medical attention as recommended'],
    when_to_seek_help: bodyPartData.seekHelp,
    red_flags_present: hasRedFlags,
    red_flag_symptoms: redFlagsFound,
    disclaimer: 'This is a general health guidance tool and does not replace professional medical advice. Always consult a healthcare provider for proper diagnosis and treatment.',
  };

  return result;
}

// =============================================================================
// Conversational API Routes (v2)
// =============================================================================

/**
 * @route   POST /api/v1/symptom-checker/start
 * @desc    Start a new symptom checking session
 * @access  Public (optionally authenticated)
 */
router.post(
  '/start',
  optionalAuth,
  validate(startSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { patientInfo, initialSymptoms, hospitalId } = req.body;
    const userId = (req as AuthenticatedRequest).user?.userId;

    logger.info('Starting new symptom checker session', {
      hasPatientInfo: !!patientInfo,
      initialSymptomCount: initialSymptoms?.length || 0,
      hospitalId,
    });

    const result = await symptomCheckerService.startSession(
      { patientInfo, initialSymptoms, hospitalId },
      userId
    );

    if (result.redFlagDetected && result.status === 'RED_FLAG_DETECTED') {
      logger.warn('Red flag detected during session start', {
        sessionId: result.sessionId,
        message: result.redFlagMessage,
      });
    }

    sendSuccess(res, result, 'Symptom checker session started');
  })
);

/**
 * @route   POST /api/v1/symptom-checker/respond
 * @desc    Submit responses and continue the conversation
 * @access  Public (optionally authenticated)
 */
router.post(
  '/respond',
  optionalAuth,
  validate(respondSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, responses } = req.body;

    logger.info('Processing symptom checker responses', {
      sessionId,
      responseCount: responses.length,
    });

    const result = await symptomCheckerService.submitResponse({ sessionId, responses });

    if (result.redFlagDetected) {
      logger.warn('Red flag detected during response processing', {
        sessionId,
        triageLevel: result.triageLevel,
        message: result.redFlagMessage,
      });
    }

    sendSuccess(res, result, result.isComplete
      ? 'Assessment complete - ready for triage result'
      : 'Response recorded'
    );
  })
);

/**
 * @route   GET /api/v1/symptom-checker/session/:sessionId
 * @desc    Get session status and details
 * @access  Public (optionally authenticated)
 */
router.get(
  '/session/:sessionId',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    logger.info('Retrieving symptom checker session', { sessionId });

    const result = await symptomCheckerService.getSession(sessionId);

    sendSuccess(res, result, 'Session retrieved');
  })
);

/**
 * @route   POST /api/v1/symptom-checker/complete
 * @desc    Complete the assessment and get final triage result
 * @access  Public (optionally authenticated)
 */
router.post(
  '/complete',
  optionalAuth,
  validate(completeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.body;

    logger.info('Completing symptom checker session', { sessionId });

    const result = await symptomCheckerService.completeSession(sessionId);

    logger.info('Symptom checker session completed', {
      sessionId,
      triageLevel: result.triageLevel,
      urgencyScore: result.urgencyScore,
      recommendedDepartment: result.recommendedDepartment,
      redFlagsCount: result.redFlags.length,
    });

    sendSuccess(res, result, 'Assessment completed');
  })
);

/**
 * @route   POST /api/v1/symptom-checker/quick-check
 * @desc    Quick emergency symptom check (no conversation)
 * @access  Public
 */
router.post(
  '/quick-check',
  validate(quickCheckSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { symptoms } = req.body;

    logger.info('Quick symptom check', { symptomCount: symptoms.length });

    const result = await symptomCheckerService.quickCheck(symptoms);

    if (result.redFlagsDetected) {
      logger.warn('Red flags detected in quick check', {
        triageLevel: result.triageLevel,
        redFlags: result.redFlags,
      });
    }

    sendSuccess(res, result, 'Quick check completed');
  })
);

// =============================================================================
// Utility Routes
// =============================================================================

/**
 * @route   GET /api/v1/symptom-checker/health
 * @desc    Check symptom checker service health
 * @access  Public
 */
router.get(
  '/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await symptomCheckerService.checkHealth();

    sendSuccess(res, {
      ...health,
      timestamp: new Date().toISOString(),
    }, 'Symptom Checker service health');
  })
);

/**
 * @route   GET /api/v1/symptom-checker/body-parts
 * @desc    Get available body parts for selection
 * @access  Public
 */
router.get(
  '/body-parts',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await symptomCheckerService.getBodyParts();
    sendSuccess(res, result, 'Body parts retrieved');
  })
);

/**
 * @route   GET /api/v1/symptom-checker/departments
 * @desc    Get list of available departments
 * @access  Public
 */
router.get(
  '/departments',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await symptomCheckerService.getDepartments();
    sendSuccess(res, result, 'Departments retrieved');
  })
);

/**
 * @route   GET /api/v1/symptom-checker/history
 * @desc    Get symptom check history
 * @access  Public (optionally authenticated)
 */
router.get(
  '/history',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const patientId = req.query.patientId as string | undefined;
    const hospitalId = req.query.hospitalId as string | undefined;

    logger.info('Retrieving symptom check history', { patientId, hospitalId });

    const result = await symptomCheckerService.getHistory(patientId, hospitalId);

    sendSuccess(res, result, 'History retrieved');
  })
);

/**
 * @route   GET /api/v1/symptom-checker/severity-options
 * @desc    Get severity options for symptom rating
 * @access  Public
 */
router.get(
  '/severity-options',
  asyncHandler(async (req: Request, res: Response) => {
    const severityOptions = [
      { value: 'mild', label: 'Mild', description: 'Noticeable but not affecting daily activities', score: 1 },
      { value: 'moderate', label: 'Moderate', description: 'Affecting some daily activities', score: 5 },
      { value: 'severe', label: 'Severe', description: 'Significantly impacting daily life', score: 8 },
      { value: 'very_severe', label: 'Very Severe', description: 'Unable to perform normal activities', score: 10 },
    ];

    sendSuccess(res, { severity_options: severityOptions }, 'Severity options retrieved');
  })
);

/**
 * @route   GET /api/v1/symptom-checker/duration-options
 * @desc    Get duration options for symptom timing
 * @access  Public
 */
router.get(
  '/duration-options',
  asyncHandler(async (req: Request, res: Response) => {
    const durationOptions = [
      { value: 'just_started', label: 'Just started (minutes to hours)' },
      { value: 'today', label: 'Started today' },
      { value: '1-3_days', label: '1-3 days' },
      { value: '4-7_days', label: '4-7 days' },
      { value: '1-2_weeks', label: '1-2 weeks' },
      { value: '2-4_weeks', label: '2-4 weeks' },
      { value: 'more_than_month', label: 'More than a month' },
      { value: 'chronic', label: 'Chronic (recurring over months/years)' },
    ];

    sendSuccess(res, { duration_options: durationOptions }, 'Duration options retrieved');
  })
);

/**
 * @route   GET /api/v1/symptom-checker/triage-levels
 * @desc    Get information about triage levels
 * @access  Public
 */
router.get(
  '/triage-levels',
  asyncHandler(async (req: Request, res: Response) => {
    const triageLevels = [
      {
        level: TriageLevel.EMERGENCY,
        name: 'Emergency',
        color: 'red',
        description: 'Requires immediate emergency medical attention',
        action: 'Call 911 or go to nearest Emergency Room immediately',
        urgencyScore: { min: 9, max: 10 },
      },
      {
        level: TriageLevel.URGENT,
        name: 'Urgent',
        color: 'orange',
        description: 'Requires prompt medical attention within hours',
        action: 'Seek medical care within the next few hours at urgent care or ER',
        urgencyScore: { min: 6, max: 8 },
      },
      {
        level: TriageLevel.ROUTINE,
        name: 'Routine',
        color: 'blue',
        description: 'Requires medical evaluation but not urgent',
        action: 'Schedule an appointment within the next few days',
        urgencyScore: { min: 4, max: 5 },
      },
      {
        level: TriageLevel.SELF_CARE,
        name: 'Self-Care',
        color: 'green',
        description: 'May be manageable with self-care at home',
        action: 'Monitor symptoms and follow self-care advice; seek care if worsening',
        urgencyScore: { min: 1, max: 3 },
      },
    ];

    sendSuccess(res, { triage_levels: triageLevels }, 'Triage levels retrieved');
  })
);

// =============================================================================
// Legacy Routes (backward compatibility)
// =============================================================================

/**
 * @route   POST /api/v1/symptom-checker/analyze
 * @desc    Analyze symptoms and provide triage recommendation (legacy)
 * @access  Public
 */
router.post(
  '/analyze',
  validate(analyzeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const {
      bodyPart,
      symptoms,
      duration,
      severity,
      additionalSymptoms,
      patientAge,
      patientGender,
    } = req.body;

    logger.info('Legacy symptom analysis request', {
      bodyPart,
      symptomCount: symptoms.length,
      severity,
      duration,
    });

    // Use local analysis for legacy endpoint
    const result = analyzeSymptoms({
      bodyPart,
      symptoms,
      duration,
      severity,
      additionalSymptoms,
      patientAge,
      patientGender,
    });

    logger.info('Legacy symptom analysis completed', {
      urgency: result.urgency,
      urgencyLevel: result.urgency_level,
      redFlagsPresent: result.red_flags_present,
    });

    sendSuccess(res, result, 'Symptom analysis completed');
  })
);

export default router;
