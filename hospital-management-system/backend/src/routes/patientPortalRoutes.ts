import { Router, Request, Response } from 'express';
import { patientPortalService } from '../services/patientPortalService';
import { patientAuthenticate, PatientAuthenticatedRequest } from '../middleware/patientAuth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import prisma from '../config/database';

const router = Router();

// =============================================================================
// Patient Portal Dashboard Routes (Authenticated with Patient Token)
// =============================================================================

/**
 * Get patient summary/dashboard
 * GET /api/v1/patient-portal/summary
 */
router.get(
  '/summary',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const summary = await patientPortalService.getDashboardSummary(hospitalId, patientId);
    sendSuccess(res, summary, 'Patient summary retrieved');
  })
);

/**
 * Get patient appointments
 * GET /api/v1/patient-portal/appointments
 */
router.get(
  '/appointments',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const { type, status, page, limit } = req.query;
    const appointments = await patientPortalService.getAppointments(hospitalId, patientId, {
      type: type as 'upcoming' | 'past' | 'all',
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, appointments, 'Appointments retrieved');
  })
);

/**
 * Book new appointment
 * POST /api/v1/patient-portal/appointments
 */
router.post(
  '/appointments',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';

    // Validate that patient exists before booking
    if (!patientId) {
      return res.status(400).json({
        success: false,
        message: 'Patient profile not found. Please complete your registration first.',
        error: 'PATIENT_NOT_FOUND'
      });
    }

    const appointment = await patientPortalService.bookAppointment(hospitalId, patientId, {
      ...req.body,
      appointmentDate: new Date(req.body.appointmentDate),
    });
    sendSuccess(res, appointment, 'Appointment booked successfully');
  })
);

/**
 * Cancel appointment
 * POST /api/v1/patient-portal/appointments/:id/cancel
 */
router.post(
  '/appointments/:id/cancel',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    await patientPortalService.cancelAppointment(hospitalId, patientId, req.params.id, req.body.reason);
    sendSuccess(res, null, 'Appointment cancelled');
  })
);

/**
 * Get medical records
 * GET /api/v1/patient-portal/records
 */
router.get(
  '/records',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const { type, page, limit } = req.query;
    const records = await patientPortalService.getMedicalRecords(hospitalId, patientId, {
      type: type as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, records, 'Medical records retrieved');
  })
);

/**
 * Get prescriptions
 * GET /api/v1/patient-portal/prescriptions
 */
router.get(
  '/prescriptions',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const { status, page, limit } = req.query;
    const prescriptions = await patientPortalService.getPrescriptions(hospitalId, patientId, {
      status: (status as 'active' | 'expired' | 'all') || 'all',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, prescriptions, 'Prescriptions retrieved');
  })
);

/**
 * Request prescription refill (placeholder - returns success)
 * POST /api/v1/patient-portal/prescriptions/:id/refill
 */
router.post(
  '/prescriptions/:id/refill',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    // Simplified: Just return success - full implementation pending
    sendSuccess(res, { requested: true, prescriptionId: req.params.id }, 'Refill request submitted');
  })
);

/**
 * Get lab results
 * GET /api/v1/patient-portal/labs
 */
router.get(
  '/labs',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const { status, page, limit } = req.query;
    const labs = await patientPortalService.getLabResults(hospitalId, patientId, {
      status: (status as 'ready' | 'pending' | 'all') || 'all',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, labs, 'Lab results retrieved');
  })
);

/**
 * Get messages (placeholder - returns empty)
 * GET /api/v1/patient-portal/messages
 */
router.get(
  '/messages',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    // Simplified: Return empty messages - messaging feature pending
    sendSuccess(res, { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }, 'Messages retrieved');
  })
);

/**
 * Send message (placeholder - returns success)
 * POST /api/v1/patient-portal/messages
 */
router.post(
  '/messages',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    // Simplified: Just return success - messaging feature pending
    sendSuccess(res, { sent: true }, 'Message sent');
  })
);

/**
 * Get billing summary
 * GET /api/v1/patient-portal/billing/summary
 */
router.get(
  '/billing/summary',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const summary = await patientPortalService.getBillingSummary(hospitalId, patientId);
    sendSuccess(res, summary, 'Billing summary retrieved');
  })
);

/**
 * Get bills
 * GET /api/v1/patient-portal/bills
 */
router.get(
  '/bills',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const { type, page, limit } = req.query;
    const bills = await patientPortalService.getBills(hospitalId, patientId, {
      type: (type === 'pending' || type === 'paid') ? type : 'all',
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 10,
    });
    sendSuccess(res, bills, 'Bills retrieved');
  })
);

/**
 * Get available doctors for booking
 * GET /api/v1/patient-portal/doctors
 */
router.get(
  '/doctors',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const { departmentId, search } = req.query;
    const doctors = await patientPortalService.getDoctors(hospitalId, {
      departmentId: departmentId as string,
      search: search as string,
    });
    sendSuccess(res, doctors, 'Available doctors retrieved');
  })
);

/**
 * Get departments
 * GET /api/v1/patient-portal/departments
 */
router.get(
  '/departments',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const departments = await patientPortalService.getDepartments(hospitalId);
    sendSuccess(res, departments, 'Departments retrieved');
  })
);

/**
 * Get health reminders
 * GET /api/v1/patient-portal/reminders
 */
router.get(
  '/reminders',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const reminders = await patientPortalService.getHealthReminders(hospitalId, patientId);
    sendSuccess(res, reminders, 'Health reminders retrieved');
  })
);

// =============================================================================
// AI Health Assistant Routes
// =============================================================================

/**
 * AI Chat for patient health questions
 * POST /api/v1/patient-portal/ai-chat
 */
router.post(
  '/ai-chat',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { message, context, history } = req.body;
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';

    // Get patient context for personalized responses
    let patientContext = '';
    try {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        select: { firstName: true, lastName: true, dateOfBirth: true, gender: true }
      });
      if (patient) {
        const age = patient.dateOfBirth
          ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : null;
        patientContext = `Patient: ${patient.firstName} ${patient.lastName}, ${age ? `Age: ${age}` : ''}, Gender: ${patient.gender || 'Not specified'}`;
      }
    } catch (e) {
      // Continue without patient context
    }

    // Try to use AI service for response
    try {
      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const aiResponse = await fetch(`${AI_SERVICE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context: `${context}. ${patientContext}`,
          history: history || [],
          role: 'patient_health_assistant'
        })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        sendSuccess(res, {
          response: aiData.response || aiData.message,
          suggestedActions: getSuggestedActions(message)
        }, 'AI response generated');
        return;
      }
    } catch (e) {
      // Fall through to rule-based response
    }

    // Rule-based fallback response
    const response = generateLocalResponse(message);
    sendSuccess(res, {
      response,
      suggestedActions: getSuggestedActions(message)
    }, 'Response generated');
  })
);

// Helper function to generate local response
function generateLocalResponse(query: string): string {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('appointment') || lowerQuery.includes('book') || lowerQuery.includes('schedule')) {
    return "I can help you book an appointment! You can use our Symptom Checker for AI-guided booking recommendations, or book directly if you know which department you need. Go to My Appointments to get started.";
  }

  if (lowerQuery.includes('symptom') || lowerQuery.includes('feel') || lowerQuery.includes('pain') || lowerQuery.includes('sick')) {
    return "I understand you're experiencing symptoms. For a proper assessment, I recommend using our AI Symptom Checker. It will ask you detailed questions and provide personalized recommendations including which department to visit.";
  }

  if (lowerQuery.includes('lab') || lowerQuery.includes('test') || lowerQuery.includes('result')) {
    return "You can view your lab results in the Lab Results section of your patient portal. Each result includes reference ranges to help you understand your values. If you have specific questions about your results, I recommend discussing them with your doctor during your next visit.";
  }

  if (lowerQuery.includes('medication') || lowerQuery.includes('prescription') || lowerQuery.includes('medicine') || lowerQuery.includes('drug')) {
    return "Your current prescriptions are available in the Prescriptions section. Always take medications exactly as prescribed by your doctor. If you're experiencing side effects or have questions about your medications, please contact your healthcare provider.";
  }

  if (lowerQuery.includes('emergency') || lowerQuery.includes('urgent') || lowerQuery.includes('serious')) {
    return "If you're experiencing a medical emergency, please call 911 immediately. Signs of emergency include severe chest pain, difficulty breathing, severe bleeding, sudden weakness or numbness, or signs of a stroke (face drooping, arm weakness, speech difficulty). Don't delay seeking emergency care.";
  }

  if (lowerQuery.includes('billing') || lowerQuery.includes('payment') || lowerQuery.includes('invoice') || lowerQuery.includes('bill')) {
    return "You can view and manage your bills in the Bills & Payments section. There you'll find your invoices, payment history, and options for online payment. If you have questions about specific charges, please contact our billing department.";
  }

  if (lowerQuery.includes('record') || lowerQuery.includes('history') || lowerQuery.includes('medical')) {
    return "Your medical records are available in the Medical Records section. There you can view your visit history, diagnoses, procedures, and other health information. If you need official copies of your records, please contact the medical records department.";
  }

  return "I'm your AI Health Assistant, here to help with your health questions. I can assist you with:\n\n• Understanding symptoms and when to seek care\n• Managing your medications and prescriptions\n• Explaining lab results\n• Booking appointments\n• General health and wellness tips\n\nHow can I help you today?";
}

/**
 * Get AI health insights
 * GET /api/v1/patient-portal/health-insights
 */
router.get(
  '/health-insights',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';

    // Get patient data for insights
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        vitals: {
          take: 10,
          orderBy: { recordedAt: 'desc' },
          select: {
            bloodPressureSys: true,
            bloodPressureDia: true,
            heartRate: true,
            temperature: true,
            weight: true,
            height: true,
            recordedAt: true,
          }
        },
        labOrders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            status: true,
            createdAt: true,
            tests: {
              select: {
                result: true,
                normalRange: true,
                status: true,
                labTest: {
                  select: {
                    name: true,
                  }
                }
              }
            }
          }
        },
        appointments: {
          take: 5,
          orderBy: { appointmentDate: 'desc' },
          select: {
            type: true,
            status: true,
            appointmentDate: true,
          }
        }
      }
    });

    if (!patient) {
      sendSuccess(res, generateDefaultInsights(), 'Health insights generated');
      return;
    }

    // Calculate health score based on available data
    let healthScore = 70; // Base score
    const metrics: any[] = [];
    const insights: any[] = [];

    // Process vitals if available
    if (patient.vitals && patient.vitals.length > 0) {
      const latestVitals = patient.vitals[0];

      if (latestVitals.bloodPressureSys && latestVitals.bloodPressureDia) {
        const bpStatus = latestVitals.bloodPressureSys <= 120 && latestVitals.bloodPressureDia <= 80
          ? 'normal'
          : latestVitals.bloodPressureSys <= 140 ? 'attention' : 'critical';

        metrics.push({
          name: 'Blood Pressure',
          value: `${latestVitals.bloodPressureSys}/${latestVitals.bloodPressureDia}`,
          unit: 'mmHg',
          status: bpStatus,
          trend: 'stable',
          date: latestVitals.recordedAt?.toISOString().split('T')[0] || 'N/A'
        });

        if (bpStatus === 'normal') healthScore += 5;
        if (bpStatus === 'critical') {
          healthScore -= 10;
          insights.push({
            id: 'bp-alert',
            type: 'alert',
            title: 'Blood Pressure Requires Attention',
            description: 'Your recent blood pressure reading is elevated. Please consult with your healthcare provider.',
            priority: 'high'
          });
        }
      }

      if (latestVitals.heartRate) {
        const hrStatus = latestVitals.heartRate >= 60 && latestVitals.heartRate <= 100 ? 'normal' : 'attention';
        metrics.push({
          name: 'Heart Rate',
          value: latestVitals.heartRate,
          unit: 'bpm',
          status: hrStatus,
          trend: 'stable',
          date: latestVitals.recordedAt?.toISOString().split('T')[0] || 'N/A'
        });
        if (hrStatus === 'normal') healthScore += 5;
      }
    }

    // Check for due appointments
    const hasRecentAppointment = patient.appointments?.some(apt =>
      apt.status === 'COMPLETED' &&
      new Date(apt.appointmentDate).getTime() > Date.now() - 365 * 24 * 60 * 60 * 1000
    );

    if (!hasRecentAppointment) {
      insights.push({
        id: 'checkup-reminder',
        type: 'recommendation',
        title: 'Schedule Your Annual Check-up',
        description: 'Regular health check-ups help detect potential issues early. It\'s been a while since your last visit.',
        priority: 'medium',
        actionLabel: 'Book Appointment',
        actionRoute: '/patient-portal/appointments'
      });
    }

    // Add general wellness tips
    insights.push({
      id: 'wellness-tip',
      type: 'tip',
      title: 'Stay Active',
      description: 'Regular physical activity can improve your overall health. Aim for at least 30 minutes of moderate exercise daily.',
      priority: 'low'
    });

    const scoreLabel = healthScore >= 80 ? 'Excellent' :
                       healthScore >= 70 ? 'Good' :
                       healthScore >= 60 ? 'Fair' : 'Needs Attention';

    sendSuccess(res, {
      overallScore: Math.min(100, Math.max(0, healthScore)),
      scoreLabel,
      lastUpdated: new Date().toISOString(),
      metrics: metrics.length > 0 ? metrics : generateDefaultMetrics(),
      insights: insights.length > 0 ? insights : generateDefaultInsights().insights
    }, 'Health insights generated');
  })
);

// Helper: Generate default metrics when no data available
function generateDefaultMetrics() {
  return [
    { name: 'Blood Pressure', value: '--', unit: 'mmHg', status: 'normal', trend: 'stable', date: 'No data' },
    { name: 'Heart Rate', value: '--', unit: 'bpm', status: 'normal', trend: 'stable', date: 'No data' },
  ];
}

// Helper: Generate default insights when no data available
function generateDefaultInsights() {
  return {
    overallScore: 75,
    scoreLabel: 'Good',
    lastUpdated: new Date().toISOString(),
    metrics: generateDefaultMetrics(),
    insights: [
      {
        id: 'welcome',
        type: 'recommendation',
        title: 'Complete Your Health Profile',
        description: 'Add your health information to receive personalized insights and recommendations.',
        priority: 'medium',
        actionLabel: 'Update Profile',
        actionRoute: '/patient-portal/settings'
      },
      {
        id: 'checkup',
        type: 'recommendation',
        title: 'Schedule a Check-up',
        description: 'Regular health check-ups help monitor your health and catch potential issues early.',
        priority: 'medium',
        actionLabel: 'Book Appointment',
        actionRoute: '/patient-portal/appointments'
      },
      {
        id: 'symptom-tip',
        type: 'tip',
        title: 'Use the Symptom Checker',
        description: 'Feeling unwell? Our AI Symptom Checker can help you understand your symptoms and get care recommendations.',
        priority: 'low',
        actionLabel: 'Check Symptoms',
        actionRoute: '/patient-portal/symptom-checker'
      }
    ]
  };
}

// Helper function to get suggested actions based on query
function getSuggestedActions(query: string): Array<{ label: string; route: string }> {
  const lowerQuery = query.toLowerCase();
  const actions: Array<{ label: string; route: string }> = [];

  if (lowerQuery.includes('appointment') || lowerQuery.includes('book')) {
    actions.push({ label: 'Book Appointment', route: '/patient-portal/appointments' });
    actions.push({ label: 'Symptom Checker', route: '/patient-portal/symptom-checker' });
  }

  if (lowerQuery.includes('symptom') || lowerQuery.includes('pain') || lowerQuery.includes('sick')) {
    actions.push({ label: 'Start Symptom Check', route: '/patient-portal/symptom-checker' });
  }

  if (lowerQuery.includes('lab') || lowerQuery.includes('test') || lowerQuery.includes('result')) {
    actions.push({ label: 'View Lab Results', route: '/patient-portal/labs' });
  }

  if (lowerQuery.includes('medication') || lowerQuery.includes('prescription')) {
    actions.push({ label: 'View Prescriptions', route: '/patient-portal/prescriptions' });
  }

  if (lowerQuery.includes('bill') || lowerQuery.includes('payment')) {
    actions.push({ label: 'View Bills', route: '/patient-portal/billing' });
  }

  return actions;
}

export default router;
