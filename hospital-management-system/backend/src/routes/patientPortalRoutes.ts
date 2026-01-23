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
 * Get appointment by ID
 * GET /api/v1/patient-portal/appointments/:id
 */
router.get(
  '/appointments/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const appointment = await patientPortalService.getAppointmentById(hospitalId, patientId, req.params.id);
    sendSuccess(res, appointment, 'Appointment retrieved');
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
      startTime: req.body.appointmentTime || req.body.startTime,
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
 * Reschedule appointment
 * PUT /api/v1/patient-portal/appointments/:id/reschedule
 */
router.put(
  '/appointments/:id/reschedule',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const { appointmentDate, startTime } = req.body;

    if (!appointmentDate || !startTime) {
      return res.status(400).json({
        success: false,
        message: 'appointmentDate and startTime are required',
      });
    }

    const appointment = await patientPortalService.rescheduleAppointment(
      hospitalId,
      patientId,
      req.params.id,
      {
        appointmentDate: new Date(appointmentDate),
        startTime,
      }
    );
    sendSuccess(res, appointment, 'Appointment rescheduled successfully');
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
 * Get medical record by ID
 * GET /api/v1/patient-portal/records/:id
 */
router.get(
  '/records/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const record = await patientPortalService.getMedicalRecordById(hospitalId, patientId, req.params.id);
    sendSuccess(res, record, 'Medical record retrieved');
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
 * Get prescription by ID
 * GET /api/v1/patient-portal/prescriptions/:id
 */
router.get(
  '/prescriptions/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const prescription = await patientPortalService.getPrescriptionById(hospitalId, patientId, req.params.id);
    sendSuccess(res, prescription, 'Prescription retrieved');
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
 * Get lab result by ID
 * GET /api/v1/patient-portal/labs/:id
 */
router.get(
  '/labs/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const labResult = await patientPortalService.getLabResultById(hospitalId, patientId, req.params.id);
    sendSuccess(res, labResult, 'Lab result retrieved');
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
 * Get bill by ID
 * GET /api/v1/patient-portal/bills/:id
 */
router.get(
  '/bills/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const patientId = req.patient?.patientId || '';
    const bill = await patientPortalService.getBillById(hospitalId, patientId, req.params.id);
    sendSuccess(res, bill, 'Bill retrieved');
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
 * Get available slots for a doctor on a specific date
 * GET /api/v1/patient-portal/doctors/:doctorId/slots
 */
router.get(
  '/doctors/:doctorId/slots',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const hospitalId = req.patient?.hospitalId || '';
    const { doctorId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: 'Date parameter is required' });
    }

    const dateStr = date as string;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const slots = await patientPortalService.getDoctorAvailableSlots(hospitalId, doctorId, dateStr);
    sendSuccess(res, slots, 'Available slots retrieved');
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

    // Try to use AI Health Assistant service for dynamic response
    try {
      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const aiResponse = await fetch(`${AI_SERVICE_URL}/api/health-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          context: `${context}. ${patientContext}`,
          patient_context: patientContext ? { raw_context: patientContext } : null,
          history: history || [],
          role: 'patient_health_assistant'
        })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json() as {
          response?: string;
          message?: string;
          suggestedActions?: Array<{ label: string; route: string }>;
          aiPowered?: boolean;
          model?: string;
        };
        sendSuccess(res, {
          response: aiData.response || aiData.message,
          suggestedActions: aiData.suggestedActions || getSuggestedActions(message),
          aiPowered: aiData.aiPowered || false,
          model: aiData.model
        }, 'AI response generated');
        return;
      }
    } catch (e) {
      console.error('AI Health Assistant error:', e);
      // Fall through to rule-based response
    }

    // Rule-based fallback response
    const response = generateLocalResponse(message);
    sendSuccess(res, {
      response,
      suggestedActions: getSuggestedActions(message),
      aiPowered: false
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
 * Get AI health insights - Comprehensive health analysis
 * GET /api/v1/patient-portal/health-insights
 */
router.get(
  '/health-insights',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';

    // Get comprehensive patient data for insights
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        bloodGroup: true,
        allergies: true,
        medicalHistory: {
          select: {
            chronicConditions: true,
          }
        },
        vitals: {
          take: 20,
          orderBy: { recordedAt: 'desc' },
          select: {
            bloodPressureSys: true,
            bloodPressureDia: true,
            heartRate: true,
            respiratoryRate: true,
            temperature: true,
            oxygenSaturation: true,
            weight: true,
            height: true,
            bmi: true,
            bloodSugar: true,
            painLevel: true,
            recordedAt: true,
          }
        },
        labOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          where: { status: 'COMPLETED' },
          select: {
            status: true,
            createdAt: true,
            tests: {
              select: {
                result: true,
                normalRange: true,
                status: true,
                isAbnormal: true,
                labTest: {
                  select: {
                    name: true,
                    category: true,
                  }
                }
              }
            }
          }
        },
        prescriptions: {
          take: 10,
          orderBy: { prescriptionDate: 'desc' },
          where: { status: 'ACTIVE' },
          select: {
            status: true,
            prescriptionDate: true,
            medications: {
              select: {
                drugName: true,
                dosage: true,
                frequency: true,
                duration: true,
                quantity: true,
              }
            }
          }
        },
        appointments: {
          take: 10,
          orderBy: { appointmentDate: 'desc' },
          select: {
            type: true,
            status: true,
            appointmentDate: true,
            vitalsRecordedAt: true,
          }
        },
        consultations: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            diagnosis: true,
            notes: true,
            createdAt: true,
          }
        }
      }
    });

    if (!patient) {
      sendSuccess(res, generateDefaultInsights(), 'Health insights generated');
      return;
    }

    // Initialize score and collections
    let healthScore = 65; // Base score
    const metrics: any[] = [];
    const insights: any[] = [];
    const labResults: any[] = [];

    // Helper to calculate trend
    const calculateTrend = (current: number | null, previous: number | null): 'up' | 'down' | 'stable' => {
      if (!current || !previous) return 'stable';
      const diff = current - previous;
      const threshold = previous * 0.05; // 5% change threshold
      if (diff > threshold) return 'up';
      if (diff < -threshold) return 'down';
      return 'stable';
    };

    // Process vitals if available
    if (patient.vitals && patient.vitals.length > 0) {
      const latestVitals = patient.vitals[0];
      const previousVitals = patient.vitals.length > 1 ? patient.vitals[1] : null;
      const dateStr = latestVitals.recordedAt?.toISOString().split('T')[0] || 'N/A';

      // Blood Pressure
      if (latestVitals.bloodPressureSys && latestVitals.bloodPressureDia) {
        const sys = latestVitals.bloodPressureSys;
        const dia = latestVitals.bloodPressureDia;
        const bpStatus = sys <= 120 && dia <= 80 ? 'normal' :
                        sys <= 140 && dia <= 90 ? 'attention' : 'critical';

        const prevSys = previousVitals?.bloodPressureSys;
        metrics.push({
          name: 'Blood Pressure',
          value: `${sys}/${dia}`,
          unit: 'mmHg',
          status: bpStatus,
          trend: calculateTrend(sys, prevSys),
          previousValue: prevSys && previousVitals?.bloodPressureDia ? `${prevSys}/${previousVitals.bloodPressureDia}` : undefined,
          date: dateStr
        });

        if (bpStatus === 'normal') healthScore += 5;
        else if (bpStatus === 'critical') {
          healthScore -= 10;
          insights.push({
            id: 'bp-alert',
            type: 'alert',
            title: 'High Blood Pressure Detected',
            description: `Your blood pressure (${sys}/${dia} mmHg) is elevated. This may increase risk of heart disease. Please consult your doctor.`,
            priority: 'high'
          });
        }
      }

      // Heart Rate
      if (latestVitals.heartRate) {
        const hr = latestVitals.heartRate;
        const hrStatus = hr >= 60 && hr <= 100 ? 'normal' : hr > 100 ? 'attention' : 'attention';
        const prevHr = previousVitals?.heartRate;

        metrics.push({
          name: 'Heart Rate',
          value: hr,
          unit: 'bpm',
          status: hrStatus,
          trend: calculateTrend(hr, prevHr),
          previousValue: prevHr,
          date: dateStr
        });
        if (hrStatus === 'normal') healthScore += 5;
      }

      // Respiratory Rate
      if (latestVitals.respiratoryRate) {
        const rr = latestVitals.respiratoryRate;
        const rrStatus = rr >= 12 && rr <= 20 ? 'normal' : 'attention';
        metrics.push({
          name: 'Respiratory Rate',
          value: rr,
          unit: '/min',
          status: rrStatus,
          trend: calculateTrend(rr, previousVitals?.respiratoryRate),
          previousValue: previousVitals?.respiratoryRate,
          date: dateStr
        });
        if (rrStatus === 'normal') healthScore += 3;
      }

      // Oxygen Saturation (SpO2)
      if (latestVitals.oxygenSaturation) {
        const spo2 = Number(latestVitals.oxygenSaturation);
        const spo2Status = spo2 >= 95 ? 'normal' : spo2 >= 90 ? 'attention' : 'critical';
        metrics.push({
          name: 'Oxygen Saturation',
          value: spo2,
          unit: '%',
          status: spo2Status,
          trend: calculateTrend(spo2, previousVitals?.oxygenSaturation ? Number(previousVitals.oxygenSaturation) : null),
          previousValue: previousVitals?.oxygenSaturation ? Number(previousVitals.oxygenSaturation) : undefined,
          date: dateStr
        });
        if (spo2Status === 'normal') healthScore += 5;
        else if (spo2Status === 'critical') {
          healthScore -= 15;
          insights.push({
            id: 'spo2-alert',
            type: 'alert',
            title: 'Low Oxygen Levels',
            description: `Your oxygen saturation (${spo2}%) is below normal. Please seek medical attention if you experience difficulty breathing.`,
            priority: 'high'
          });
        }
      }

      // Temperature
      if (latestVitals.temperature) {
        const temp = Number(latestVitals.temperature);
        const tempStatus = temp >= 36.1 && temp <= 37.5 ? 'normal' : temp > 38 ? 'critical' : 'attention';
        metrics.push({
          name: 'Temperature',
          value: temp.toFixed(1),
          unit: '°C',
          status: tempStatus,
          trend: 'stable',
          date: dateStr
        });
        if (tempStatus === 'critical') {
          insights.push({
            id: 'fever-alert',
            type: 'alert',
            title: 'Fever Detected',
            description: `Your temperature (${temp.toFixed(1)}°C) indicates a fever. Monitor your symptoms and consult a doctor if it persists.`,
            priority: 'high'
          });
        }
      }

      // BMI
      if (latestVitals.bmi || (latestVitals.weight && latestVitals.height)) {
        let bmiValue = latestVitals.bmi ? Number(latestVitals.bmi) : null;
        if (!bmiValue && latestVitals.weight && latestVitals.height) {
          const heightM = Number(latestVitals.height) / 100;
          bmiValue = Number(latestVitals.weight) / (heightM * heightM);
        }
        if (bmiValue) {
          const bmiStatus = bmiValue >= 18.5 && bmiValue < 25 ? 'normal' :
                           bmiValue >= 25 && bmiValue < 30 ? 'attention' : 'critical';
          metrics.push({
            name: 'BMI',
            value: bmiValue.toFixed(1),
            unit: 'kg/m²',
            status: bmiStatus,
            trend: 'stable',
            date: dateStr
          });
          if (bmiStatus === 'normal') healthScore += 5;
          else if (bmiStatus === 'attention') {
            insights.push({
              id: 'bmi-tip',
              type: 'tip',
              title: 'Weight Management',
              description: `Your BMI (${bmiValue.toFixed(1)}) is in the overweight range. Consider a balanced diet and regular exercise.`,
              priority: 'medium'
            });
          }
        }
      }

      // Blood Sugar
      if (latestVitals.bloodSugar) {
        const bs = Number(latestVitals.bloodSugar);
        const bsStatus = bs >= 70 && bs <= 100 ? 'normal' :
                        bs <= 125 ? 'attention' : 'critical';
        metrics.push({
          name: 'Blood Sugar',
          value: bs.toFixed(0),
          unit: 'mg/dL',
          status: bsStatus,
          trend: calculateTrend(bs, previousVitals?.bloodSugar ? Number(previousVitals.bloodSugar) : null),
          previousValue: previousVitals?.bloodSugar ? Number(previousVitals.bloodSugar).toFixed(0) : undefined,
          date: dateStr
        });
        if (bsStatus === 'critical') {
          healthScore -= 5;
          insights.push({
            id: 'blood-sugar-alert',
            type: 'alert',
            title: 'Blood Sugar Elevated',
            description: `Your blood sugar (${bs.toFixed(0)} mg/dL) is above normal. Monitor your diet and consult your doctor.`,
            priority: 'high'
          });
        }
      }
    }

    // Process Lab Results
    if (patient.labOrders && patient.labOrders.length > 0) {
      for (const order of patient.labOrders) {
        for (const test of order.tests || []) {
          if (test.result && test.labTest?.name) {
            const isAbnormal = test.isAbnormal === true;
            labResults.push({
              name: test.labTest.name,
              value: test.result,
              normalRange: test.normalRange || 'N/A',
              status: isAbnormal ? 'attention' : 'normal',
              date: order.createdAt?.toISOString().split('T')[0] || 'N/A'
            });
            if (isAbnormal) {
              healthScore -= 2;
            }
          }
        }
      }

      // Add abnormal lab result insight
      const abnormalCount = labResults.filter(r => r.status === 'attention').length;
      if (abnormalCount > 0) {
        insights.push({
          id: 'lab-results-alert',
          type: 'alert',
          title: `${abnormalCount} Abnormal Lab Result${abnormalCount > 1 ? 's' : ''}`,
          description: 'Some of your recent lab results are outside the normal range. Please review them with your healthcare provider.',
          priority: abnormalCount > 2 ? 'high' : 'medium',
          actionLabel: 'View Lab Results',
          actionRoute: '/patient-portal/labs'
        });
      }
    }

    // Process Prescriptions - Medication reminders
    if (patient.prescriptions && patient.prescriptions.length > 0) {
      const activeMeds = patient.prescriptions.filter(p => p.status === 'ACTIVE');
      const medicationCount = activeMeds.reduce((acc, p) => acc + (p.medications?.length || 0), 0);

      if (medicationCount > 0) {
        insights.push({
          id: 'medication-reminder',
          type: 'reminder',
          title: `${medicationCount} Active Medication${medicationCount > 1 ? 's' : ''}`,
          description: 'Remember to take your medications as prescribed. Set reminders if needed to stay on track.',
          priority: 'medium',
          actionLabel: 'View Prescriptions',
          actionRoute: '/patient-portal/prescriptions'
        });
      }
    }

    // Check for due appointments
    const hasRecentCheckup = patient.appointments?.some(apt =>
      apt.status === 'COMPLETED' &&
      apt.type === 'CONSULTATION' &&
      new Date(apt.appointmentDate).getTime() > Date.now() - 180 * 24 * 60 * 60 * 1000 // 6 months
    );

    if (!hasRecentCheckup) {
      insights.push({
        id: 'checkup-reminder',
        type: 'recommendation',
        title: 'Schedule a Health Check-up',
        description: 'Regular health check-ups help detect potential issues early. Consider scheduling your next visit.',
        priority: 'medium',
        actionLabel: 'Book Appointment',
        actionRoute: '/patient-portal/appointments'
      });
    }

    // Check for chronic conditions
    const chronicConditions = patient.medicalHistory?.chronicConditions || [];
    if (chronicConditions.length > 0) {
      insights.push({
        id: 'chronic-management',
        type: 'tip',
        title: 'Managing Chronic Conditions',
        description: 'Regular monitoring and follow-ups are important for managing chronic conditions effectively.',
        priority: 'medium'
      });
    }

    // Check for allergies reminder
    if (patient.allergies && patient.allergies.length > 0) {
      insights.push({
        id: 'allergy-reminder',
        type: 'reminder',
        title: 'Allergy Information on File',
        description: `You have ${patient.allergies.length} recorded allerg${patient.allergies.length > 1 ? 'ies' : 'y'}. Ensure your healthcare providers are aware.`,
        priority: 'low'
      });
    }

    // Add wellness tips based on data availability
    if (metrics.length === 0) {
      insights.push({
        id: 'record-vitals',
        type: 'recommendation',
        title: 'Get Your Vitals Checked',
        description: 'No recent vital signs recorded. Visit your doctor or use our symptom checker to start tracking your health.',
        priority: 'medium',
        actionLabel: 'Check Symptoms',
        actionRoute: '/patient-portal/symptom-checker'
      });
    }

    // General wellness tip
    insights.push({
      id: 'wellness-tip',
      type: 'tip',
      title: 'Stay Hydrated',
      description: 'Drinking enough water daily supports overall health. Aim for 8 glasses (64 oz) per day.',
      priority: 'low'
    });

    // Calculate final score
    const finalScore = Math.min(100, Math.max(0, healthScore));
    const scoreLabel = finalScore >= 85 ? 'Excellent' :
                       finalScore >= 70 ? 'Good' :
                       finalScore >= 55 ? 'Fair' : 'Needs Attention';

    // Sort insights by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    insights.sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]);

    // Try to get AI-powered analysis
    let aiAnalysis: any = null;
    try {
      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

      // Calculate patient age
      const birthDate = new Date(patient.dateOfBirth);
      const today = new Date();
      const patientAge = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

      // Get medication names from prescriptions
      const currentMedications = patient.prescriptions
        ?.flatMap(p => p.medications?.map(m => m.drugName) || [])
        .filter(Boolean) || [];

      // Get allergy names
      const allergyNames = patient.allergies?.map((a: any) => a.allergen || a.name || String(a)) || [];

      // Build AI analysis request
      const aiRequest = {
        patientAge,
        patientGender: patient.gender,
        bloodGroup: patient.bloodGroup,
        chronicConditions: chronicConditions,
        allergies: allergyNames,
        currentMedications,
        vitals: metrics.filter(m => m.value !== '--'),
        labResults: labResults,
        recentDiagnoses: patient.consultations?.map((c: any) => c.diagnosis).filter(Boolean) || [],
      };

      const aiResponse = await fetch(`${AI_SERVICE_URL}/api/health-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiRequest),
      });

      if (aiResponse.ok) {
        aiAnalysis = await aiResponse.json();

        // If AI analysis has insights, merge them with existing insights
        if (aiAnalysis?.insights && aiAnalysis.insights.length > 0) {
          // Add AI-generated insights that aren't duplicates
          const existingIds = new Set(insights.map(i => i.id));
          aiAnalysis.insights.forEach((aiInsight: any) => {
            if (!existingIds.has(aiInsight.id)) {
              insights.push({
                id: aiInsight.id,
                type: aiInsight.type,
                title: aiInsight.title,
                description: aiInsight.description,
                priority: aiInsight.priority,
                actionLabel: aiInsight.actionLabel,
                actionRoute: aiInsight.actionRoute,
              });
            }
          });

          // Re-sort after adding AI insights
          insights.sort((a, b) => priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder]);
        }
      }
    } catch (aiError) {
      console.error('AI health analysis error:', aiError);
      // Continue without AI analysis
    }

    sendSuccess(res, {
      overallScore: finalScore,
      scoreLabel,
      lastUpdated: new Date().toISOString(),
      metrics: metrics.length > 0 ? metrics : generateDefaultMetrics(),
      labResults: labResults.slice(0, 5), // Top 5 lab results
      insights: insights.slice(0, 8), // Top 8 insights
      patientInfo: {
        name: `${patient.firstName} ${patient.lastName}`,
        bloodGroup: patient.bloodGroup || 'Unknown',
        allergiesCount: patient.allergies?.length || 0,
        chronicConditionsCount: chronicConditions.length,
      },
      aiAnalysis: aiAnalysis ? {
        overallAssessment: aiAnalysis.overallAssessment,
        riskLevel: aiAnalysis.riskLevel,
        recommendations: aiAnalysis.recommendations,
        warningFlags: aiAnalysis.warningFlags,
        aiPowered: aiAnalysis.aiPowered,
        model: aiAnalysis.model,
      } : null,
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

// =============================================================================
// Medical History & Allergies Routes
// =============================================================================

/**
 * Get patient medical history
 * GET /api/v1/patient-portal/medical-history
 */
router.get(
  '/medical-history',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';

    const medicalHistory = await prisma.medicalHistory.findUnique({
      where: { patientId },
    });

    if (!medicalHistory) {
      // Create empty medical history if not exists
      const newHistory = await prisma.medicalHistory.create({
        data: {
          patientId,
          chronicConditions: [],
          pastSurgeries: [],
          familyHistory: [],
          currentMedications: [],
          immunizations: [],
        }
      });
      sendSuccess(res, newHistory, 'Medical history created');
      return;
    }

    sendSuccess(res, medicalHistory, 'Medical history retrieved');
  })
);

/**
 * Update patient medical history
 * PUT /api/v1/patient-portal/medical-history
 */
router.put(
  '/medical-history',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';
    const {
      chronicConditions,
      pastSurgeries,
      familyHistory,
      currentMedications,
      immunizations,
      lifestyle,
      notes,
      // New fields
      currentTreatment,
      isPregnant,
      expectedDueDate,
    } = req.body;

    // Helper to ensure array fields are valid arrays of strings
    const toStringArray = (value: any): string[] => {
      if (!value) return [];
      if (!Array.isArray(value)) return [];
      return value.filter((item: any) => typeof item === 'string' && item.trim().length > 0);
    };

    // Helper to handle lifestyle object
    const toLifestyleObject = (value: any): object | null => {
      if (!value || typeof value !== 'object') return null;
      if (Object.keys(value).length === 0) return null;
      return value;
    };

    // Build update data with proper type handling
    const updateData: any = {
      chronicConditions: toStringArray(chronicConditions),
      pastSurgeries: toStringArray(pastSurgeries),
      familyHistory: toStringArray(familyHistory),
      currentMedications: toStringArray(currentMedications),
      immunizations: toStringArray(immunizations),
      lifestyle: toLifestyleObject(lifestyle),
      notes: notes && typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      currentTreatment: currentTreatment && typeof currentTreatment === 'string' && currentTreatment.trim() ? currentTreatment.trim() : null,
    };

    // Handle pregnancy fields - only update if isPregnant is explicitly set
    if (isPregnant !== undefined) {
      updateData.isPregnant = isPregnant === true ? true : isPregnant === false ? false : null;
      updateData.lastPregnancyUpdate = new Date();

      // Handle expectedDueDate
      if (isPregnant === true && expectedDueDate) {
        try {
          const dueDate = new Date(expectedDueDate);
          updateData.expectedDueDate = isNaN(dueDate.getTime()) ? null : dueDate;
        } catch {
          updateData.expectedDueDate = null;
        }
      } else {
        updateData.expectedDueDate = null;
      }
    }

    // Upsert medical history
    const medicalHistory = await prisma.medicalHistory.upsert({
      where: { patientId },
      update: updateData,
      create: {
        patientId,
        ...updateData,
      }
    });

    sendSuccess(res, medicalHistory, 'Medical history updated successfully');
  })
);

/**
 * Get patient allergies
 * GET /api/v1/patient-portal/allergies
 */
router.get(
  '/allergies',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';

    const allergies = await prisma.allergy.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });

    sendSuccess(res, allergies, 'Allergies retrieved');
  })
);

/**
 * Add new allergy
 * POST /api/v1/patient-portal/allergies
 */
router.post(
  '/allergies',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';
    const { allergen, type, severity, reaction, notes } = req.body;

    if (!allergen || !type || !severity) {
      return res.status(400).json({
        success: false,
        message: 'Allergen, type, and severity are required',
      });
    }

    const allergy = await prisma.allergy.create({
      data: {
        patientId,
        allergen,
        type,
        severity,
        reaction: reaction || null,
        notes: notes || null,
      }
    });

    sendSuccess(res, allergy, 'Allergy added successfully');
  })
);

/**
 * Update allergy
 * PUT /api/v1/patient-portal/allergies/:id
 */
router.put(
  '/allergies/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';
    const allergyId = req.params.id;
    const { allergen, type, severity, reaction, notes } = req.body;

    // Verify ownership
    const existing = await prisma.allergy.findFirst({
      where: { id: allergyId, patientId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Allergy not found',
      });
    }

    const allergy = await prisma.allergy.update({
      where: { id: allergyId },
      data: {
        allergen: allergen || existing.allergen,
        type: type || existing.type,
        severity: severity || existing.severity,
        reaction: reaction !== undefined ? reaction : existing.reaction,
        notes: notes !== undefined ? notes : existing.notes,
      }
    });

    sendSuccess(res, allergy, 'Allergy updated successfully');
  })
);

/**
 * Delete allergy
 * DELETE /api/v1/patient-portal/allergies/:id
 */
router.delete(
  '/allergies/:id',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';
    const allergyId = req.params.id;

    // Verify ownership
    const existing = await prisma.allergy.findFirst({
      where: { id: allergyId, patientId }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Allergy not found',
      });
    }

    await prisma.allergy.delete({
      where: { id: allergyId }
    });

    sendSuccess(res, null, 'Allergy deleted successfully');
  })
);

/**
 * AI-powered allergy suggestions based on symptoms or conditions
 * POST /api/v1/patient-portal/allergies/ai-suggest
 */
router.post(
  '/allergies/ai-suggest',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const { symptoms, medications, foods } = req.body;
    const patientId = req.patient?.patientId || '';

    // Get patient's existing data
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        allergies: true,
        medicalHistory: true,
      }
    });

    // Try AI service first
    try {
      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const aiResponse = await fetch(`${AI_SERVICE_URL}/api/allergy-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms,
          medications,
          foods,
          existingAllergies: patient?.allergies || [],
          medicalHistory: patient?.medicalHistory || null,
        })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        sendSuccess(res, aiData, 'AI allergy suggestions generated');
        return;
      }
    } catch (e) {
      // Fall through to rule-based suggestions
    }

    // Rule-based suggestions
    const suggestions = generateAllergySuggestions(symptoms, medications, foods);
    sendSuccess(res, suggestions, 'Allergy suggestions generated');
  })
);

/**
 * AI-powered medical history analysis and recommendations
 * POST /api/v1/patient-portal/medical-history/ai-analyze
 */
router.post(
  '/medical-history/ai-analyze',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';

    // Get patient data
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        gender: true,
        medicalHistory: true,
        allergies: true,
        prescriptions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { medications: true }
        },
        vitals: {
          take: 10,
          orderBy: { recordedAt: 'desc' }
        },
        labOrders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { tests: { include: { labTest: true } } }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    // Calculate age
    const age = patient.dateOfBirth
      ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    // Try AI service first
    try {
      const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const aiResponse = await fetch(`${AI_SERVICE_URL}/api/health-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age,
          gender: patient.gender,
          medicalHistory: patient.medicalHistory,
          allergies: patient.allergies,
          recentMedications: patient.prescriptions?.flatMap(p => p.medications) || [],
          vitals: patient.vitals || [],
          labResults: patient.labOrders || [],
        })
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        sendSuccess(res, aiData, 'AI health analysis generated');
        return;
      }
    } catch (e) {
      // Fall through to rule-based analysis
    }

    // Generate rule-based analysis
    const analysis = generateHealthAnalysis(patient, age);
    sendSuccess(res, analysis, 'Health analysis generated');
  })
);

// Helper: Generate rule-based allergy suggestions
function generateAllergySuggestions(symptoms?: string[], medications?: string[], foods?: string[]) {
  const suggestions: any[] = [];

  // Common drug allergies
  const commonDrugAllergies = ['Penicillin', 'Aspirin', 'Ibuprofen', 'Sulfa drugs', 'Codeine'];

  // Common food allergies
  const commonFoodAllergies = ['Peanuts', 'Tree nuts', 'Shellfish', 'Eggs', 'Milk', 'Wheat', 'Soy', 'Fish'];

  // Environmental allergies
  const environmentalAllergies = ['Pollen', 'Dust mites', 'Pet dander', 'Mold', 'Latex'];

  // Based on symptoms
  if (symptoms?.some(s => s.toLowerCase().includes('rash') || s.toLowerCase().includes('hives'))) {
    suggestions.push({
      type: 'DRUG',
      possible: commonDrugAllergies.slice(0, 3),
      reason: 'Skin reactions like rash and hives are common signs of drug allergies'
    });
    suggestions.push({
      type: 'FOOD',
      possible: commonFoodAllergies.slice(0, 4),
      reason: 'Food allergies can also cause skin reactions'
    });
  }

  if (symptoms?.some(s => s.toLowerCase().includes('breath') || s.toLowerCase().includes('wheez'))) {
    suggestions.push({
      type: 'ENVIRONMENTAL',
      possible: environmentalAllergies,
      reason: 'Respiratory symptoms may indicate environmental allergies'
    });
  }

  // Common allergy info
  if (suggestions.length === 0) {
    suggestions.push({
      type: 'GENERAL',
      categories: [
        { type: 'DRUG', common: commonDrugAllergies },
        { type: 'FOOD', common: commonFoodAllergies },
        { type: 'ENVIRONMENTAL', common: environmentalAllergies }
      ],
      message: 'Consider these common allergens when adding your allergies'
    });
  }

  return { suggestions, disclaimer: 'These are suggestions only. Please consult with a healthcare provider for proper allergy testing.' };
}

// Helper: Generate rule-based health analysis
function generateHealthAnalysis(patient: any, age: number | null) {
  const recommendations: any[] = [];
  const riskFactors: any[] = [];
  const preventiveCare: any[] = [];

  const medicalHistory = patient.medicalHistory;

  // Analyze chronic conditions
  if (medicalHistory?.chronicConditions?.length > 0) {
    medicalHistory.chronicConditions.forEach((condition: string) => {
      const lowerCondition = condition.toLowerCase();

      if (lowerCondition.includes('diabetes')) {
        recommendations.push({
          title: 'Diabetes Management',
          description: 'Regular blood sugar monitoring and HbA1c tests are important. Maintain a healthy diet and exercise routine.',
          priority: 'high'
        });
        riskFactors.push({ factor: 'Diabetes', level: 'elevated' });
      }

      if (lowerCondition.includes('hypertension') || lowerCondition.includes('blood pressure')) {
        recommendations.push({
          title: 'Blood Pressure Monitoring',
          description: 'Regular BP checks are essential. Limit sodium intake and maintain regular physical activity.',
          priority: 'high'
        });
        riskFactors.push({ factor: 'Cardiovascular', level: 'elevated' });
      }

      if (lowerCondition.includes('asthma')) {
        recommendations.push({
          title: 'Asthma Management',
          description: 'Keep your inhaler accessible. Avoid known triggers and monitor air quality.',
          priority: 'medium'
        });
      }
    });
  }

  // Age-based preventive care
  if (age) {
    if (age >= 40) {
      preventiveCare.push({
        test: 'Annual Physical Exam',
        frequency: 'Yearly',
        importance: 'Essential for monitoring overall health'
      });
      preventiveCare.push({
        test: 'Cholesterol Check',
        frequency: 'Every 4-6 years (more often if elevated)',
        importance: 'Cardiovascular health monitoring'
      });
    }

    if (age >= 45) {
      preventiveCare.push({
        test: 'Diabetes Screening',
        frequency: 'Every 3 years',
        importance: 'Early detection of prediabetes/diabetes'
      });
    }

    if (age >= 50) {
      preventiveCare.push({
        test: 'Colonoscopy',
        frequency: 'Every 10 years',
        importance: 'Colorectal cancer screening'
      });
    }

    if (patient.gender === 'FEMALE') {
      if (age >= 21) {
        preventiveCare.push({
          test: 'Pap Smear',
          frequency: 'Every 3 years (21-65)',
          importance: 'Cervical cancer screening'
        });
      }
      if (age >= 40) {
        preventiveCare.push({
          test: 'Mammogram',
          frequency: 'Every 1-2 years',
          importance: 'Breast cancer screening'
        });
      }
    }

    if (patient.gender === 'MALE' && age >= 50) {
      preventiveCare.push({
        test: 'Prostate Screening',
        frequency: 'Discuss with doctor',
        importance: 'Prostate health monitoring'
      });
    }
  }

  // Default recommendations
  if (recommendations.length === 0) {
    recommendations.push({
      title: 'Maintain Healthy Lifestyle',
      description: 'Regular exercise, balanced diet, adequate sleep, and stress management are key to good health.',
      priority: 'medium'
    });
  }

  return {
    summary: {
      totalConditions: medicalHistory?.chronicConditions?.length || 0,
      totalAllergies: patient.allergies?.length || 0,
      riskLevel: riskFactors.length > 1 ? 'elevated' : 'normal'
    },
    recommendations,
    riskFactors,
    preventiveCare,
    lastAnalyzed: new Date().toISOString()
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

// =============================================================================
// Settings Routes - Notification and Communication Preferences
// =============================================================================

/**
 * Get notification preferences
 * GET /api/v1/patient-portal/settings/notifications
 */
router.get(
  '/settings/notifications',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';

    // Get or create notification preferences
    let prefs = await prisma.patientNotificationPreference.findUnique({
      where: { patientId },
    });

    if (!prefs) {
      // Create default preferences
      prefs = await prisma.patientNotificationPreference.create({
        data: {
          patientId,
          emailNotifications: true,
          smsNotifications: true,
          whatsappNotifications: false,
          appointmentReminders: true,
          labResultsReady: true,
          prescriptionReminders: true,
          billingAlerts: true,
          promotionalEmails: false,
          reminderTime: '1_DAY',
        },
      });
    }

    sendSuccess(res, prefs, 'Notification preferences retrieved');
  })
);

/**
 * Update notification preferences
 * PUT /api/v1/patient-portal/settings/notifications
 */
router.put(
  '/settings/notifications',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';
    const {
      emailNotifications,
      smsNotifications,
      whatsappNotifications,
      appointmentReminders,
      labResultsReady,
      prescriptionReminders,
      billingAlerts,
      promotionalEmails,
      reminderTime,
    } = req.body;

    const prefs = await prisma.patientNotificationPreference.upsert({
      where: { patientId },
      update: {
        emailNotifications: emailNotifications ?? undefined,
        smsNotifications: smsNotifications ?? undefined,
        whatsappNotifications: whatsappNotifications ?? undefined,
        appointmentReminders: appointmentReminders ?? undefined,
        labResultsReady: labResultsReady ?? undefined,
        prescriptionReminders: prescriptionReminders ?? undefined,
        billingAlerts: billingAlerts ?? undefined,
        promotionalEmails: promotionalEmails ?? undefined,
        reminderTime: reminderTime ?? undefined,
        updatedAt: new Date(),
      },
      create: {
        patientId,
        emailNotifications: emailNotifications ?? true,
        smsNotifications: smsNotifications ?? true,
        whatsappNotifications: whatsappNotifications ?? false,
        appointmentReminders: appointmentReminders ?? true,
        labResultsReady: labResultsReady ?? true,
        prescriptionReminders: prescriptionReminders ?? true,
        billingAlerts: billingAlerts ?? true,
        promotionalEmails: promotionalEmails ?? false,
        reminderTime: reminderTime ?? '1_DAY',
      },
    });

    sendSuccess(res, prefs, 'Notification preferences updated');
  })
);

/**
 * Get communication preferences
 * GET /api/v1/patient-portal/settings/communication
 */
router.get(
  '/settings/communication',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';

    // Get or create communication preferences
    let prefs = await prisma.patientCommunicationPreference.findUnique({
      where: { patientId },
    });

    if (!prefs) {
      // Create default preferences
      prefs = await prisma.patientCommunicationPreference.create({
        data: {
          patientId,
          preferredContactMethod: 'EMAIL',
          preferredLanguage: 'en',
          preferredTimeForCalls: 'MORNING',
          allowMarketingCommunications: false,
        },
      });
    }

    sendSuccess(res, prefs, 'Communication preferences retrieved');
  })
);

/**
 * Update communication preferences
 * PUT /api/v1/patient-portal/settings/communication
 */
router.put(
  '/settings/communication',
  patientAuthenticate,
  asyncHandler(async (req: PatientAuthenticatedRequest, res: Response) => {
    const patientId = req.patient?.patientId || '';
    const {
      preferredContactMethod,
      preferredLanguage,
      preferredTimeForCalls,
      allowMarketingCommunications,
    } = req.body;

    const prefs = await prisma.patientCommunicationPreference.upsert({
      where: { patientId },
      update: {
        preferredContactMethod: preferredContactMethod ?? undefined,
        preferredLanguage: preferredLanguage ?? undefined,
        preferredTimeForCalls: preferredTimeForCalls ?? undefined,
        allowMarketingCommunications: allowMarketingCommunications ?? undefined,
        updatedAt: new Date(),
      },
      create: {
        patientId,
        preferredContactMethod: preferredContactMethod ?? 'EMAIL',
        preferredLanguage: preferredLanguage ?? 'en',
        preferredTimeForCalls: preferredTimeForCalls ?? 'MORNING',
        allowMarketingCommunications: allowMarketingCommunications ?? false,
      },
    });

    sendSuccess(res, prefs, 'Communication preferences updated');
  })
);

export default router;
