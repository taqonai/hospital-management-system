import { Router, Response, Request } from 'express';
import { queueService } from '../services/queueService';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess, sendCreated, sendNotFound } from '../utils/response';
import prisma from '../config/database';

const router = Router();

/**
 * Kiosk Routes - Public endpoints for self-service check-in kiosks
 * All endpoints require hospitalId in URL as they are unauthenticated
 */

// ==================== PATIENT LOOKUP ====================

// Lookup patient by phone number
router.get(
  '/:hospitalId/lookup/phone/:phone',
  asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId, phone } = req.params;

    // Find patient by phone
    const patient = await prisma.patient.findFirst({
      where: {
        hospitalId,
        phone: { contains: phone },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        mrn: true,
        dateOfBirth: true,
        gender: true,
      },
    });

    if (!patient) {
      return sendNotFound(res, 'No patient record found');
    }

    // Check for today's appointment
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointment = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        hospitalId,
        appointmentDate: {
          gte: today,
          lt: tomorrow,
        },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { appointmentDate: 'asc' },
    });

    sendSuccess(res, {
      patient,
      appointment: appointment
        ? {
            id: appointment.id,
            doctorName: `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
            department: appointment.doctor.specialization,
            scheduledTime: `${appointment.appointmentDate.toISOString().split('T')[0]} ${appointment.startTime}`,
            reason: appointment.reason,
          }
        : null,
    });
  })
);

// Lookup by MRN
router.get(
  '/:hospitalId/lookup/mrn/:mrn',
  asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId, mrn } = req.params;

    const patient = await prisma.patient.findFirst({
      where: {
        hospitalId,
        mrn,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        mrn: true,
        dateOfBirth: true,
        gender: true,
      },
    });

    if (!patient) {
      return sendNotFound(res, 'No patient record found');
    }

    sendSuccess(res, { patient });
  })
);

// ==================== APPOINTMENT LOOKUP ====================

// Lookup appointment by QR code data (appointment ID)
router.get(
  '/:hospitalId/appointment/:appointmentId',
  asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId, appointmentId } = req.params;

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        hospitalId,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            mrn: true,
          },
        },
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      return sendNotFound(res, 'Appointment not found');
    }

    sendSuccess(res, {
      appointment: {
        id: appointment.id,
        status: appointment.status,
        scheduledTime: `${appointment.appointmentDate.toISOString().split('T')[0]} ${appointment.startTime}`,
        reason: appointment.reason,
        doctorName: `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
        department: appointment.doctor.specialization,
      },
      patient: appointment.patient,
    });
  })
);

// ==================== SELF CHECK-IN ====================

// Issue ticket from kiosk (public endpoint)
router.post(
  '/:hospitalId/check-in',
  asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId } = req.params;
    const {
      patientName,
      patientPhone,
      serviceType = 'consultation',
      priority = 'NORMAL',
      appointmentId,
      symptoms,
      departmentId,
    } = req.body;

    // Verify hospital exists
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      return sendNotFound(res, 'Invalid hospital');
    }

    // If appointmentId provided, update appointment status
    if (appointmentId) {
      await prisma.appointment.updateMany({
        where: {
          id: appointmentId,
          hospitalId,
        },
        data: {
          status: 'CHECKED_IN' as any,
          checkedInAt: new Date(),
        },
      });
    }

    // Issue queue ticket
    const ticket = await queueService.issueTicket(hospitalId, {
      patientName,
      patientPhone,
      serviceType,
      priority,
      appointmentId,
      departmentId,
      notes: symptoms ? `[KIOSK] ${symptoms}` : '[KIOSK Check-in]',
    });

    sendCreated(res, ticket, 'Check-in successful');
  })
);

// ==================== WALK-IN REGISTRATION ====================

// Quick registration for new walk-in patients from kiosk
router.post(
  '/:hospitalId/register-walkin',
  asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId } = req.params;
    const {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      gender,
      serviceType = 'consultation',
      priority = 'NORMAL',
      symptoms,
      departmentId,
    } = req.body;

    // Verify hospital exists
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      return sendNotFound(res, 'Invalid hospital');
    }

    // Check if patient already exists
    let patient = await prisma.patient.findFirst({
      where: {
        hospitalId,
        phone,
      },
    });

    // Create patient if not exists
    if (!patient) {
      // Generate MRN
      const patientCount = await prisma.patient.count({ where: { hospitalId } });
      const mrn = `KIOSK${String(patientCount + 1).padStart(6, '0')}`;

      patient = await prisma.patient.create({
        data: {
          hospitalId,
          firstName,
          lastName,
          phone,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date('1990-01-01'),
          gender: (gender as any) || 'OTHER',
          mrn,
          // Required fields with defaults for kiosk walk-ins
          address: 'To be updated',
          city: 'To be updated',
          state: 'To be updated',
          zipCode: '00000',
        },
      });
    }

    // Issue queue ticket
    const ticket = await queueService.issueTicket(hospitalId, {
      patientId: patient.id,
      patientName: `${firstName} ${lastName}`,
      patientPhone: phone,
      serviceType,
      priority,
      departmentId,
      notes: symptoms ? `[KIOSK] ${symptoms}` : '[KIOSK Check-in]',
    });

    sendCreated(res, {
      patient: {
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        mrn: patient.mrn,
      },
      ticket,
    }, 'Registration and check-in successful');
  })
);

// ==================== DEPARTMENT INFO ====================

// Get departments with current wait times
router.get(
  '/:hospitalId/departments',
  asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId } = req.params;

    // Get departments
    const departments = await prisma.department.findMany({
      where: { hospitalId },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    // Get current wait times per department
    const departmentsWithWaitTime = await Promise.all(
      departments.map(async (dept) => {
        const waitingCount = await prisma.queueTicket.count({
          where: {
            hospitalId,
            departmentId: dept.id,
            status: 'WAITING',
          },
        });

        // Estimate 10 minutes per patient
        const estimatedWaitTime = waitingCount * 10;

        return {
          ...dept,
          waitingPatients: waitingCount,
          estimatedWaitTime,
        };
      })
    );

    sendSuccess(res, departmentsWithWaitTime);
  })
);

// ==================== AI SYMPTOM TRIAGE ====================

// AI symptom assessment for priority scoring
router.post(
  '/:hospitalId/symptom-triage',
  asyncHandler(async (req: Request, res: Response) => {
    const { symptoms, age, gender } = req.body;

    // Simple keyword-based triage (would integrate with AI service in production)
    const urgentKeywords = [
      'chest pain', 'difficulty breathing', 'severe bleeding',
      'unconscious', 'stroke', 'heart attack', 'seizure',
      'severe allergic', 'choking', 'poisoning',
    ];

    const moderateKeywords = [
      'high fever', 'vomiting blood', 'severe pain',
      'fracture', 'burn', 'deep cut', 'head injury',
    ];

    const symptomsLower = (symptoms || '').toLowerCase();

    let priority = 'NORMAL';
    let triageLevel = 'GREEN'; // GREEN, YELLOW, ORANGE, RED
    let recommendations: string[] = [];

    // Check for urgent symptoms
    if (urgentKeywords.some(kw => symptomsLower.includes(kw))) {
      priority = 'EMERGENCY';
      triageLevel = 'RED';
      recommendations = [
        'Please proceed to Emergency Department immediately',
        'Alert staff if symptoms worsen',
        'Do not wait in regular queue',
      ];
    } else if (moderateKeywords.some(kw => symptomsLower.includes(kw))) {
      priority = 'HIGH';
      triageLevel = 'ORANGE';
      recommendations = [
        'You will be seen with priority',
        'Please inform staff of any changes',
      ];
    } else if (age && age > 65) {
      priority = 'SENIOR_CITIZEN';
      triageLevel = 'YELLOW';
      recommendations = [
        'Senior citizen priority applied',
        'Wheelchair assistance available if needed',
      ];
    } else if (age && age < 5) {
      priority = 'CHILD';
      triageLevel = 'YELLOW';
      recommendations = [
        'Pediatric priority applied',
        'Child-friendly waiting area available',
      ];
    }

    sendSuccess(res, {
      priority,
      triageLevel,
      recommendations,
      estimatedPriorityScore: priority === 'EMERGENCY' ? 100 :
                              priority === 'HIGH' ? 80 :
                              priority === 'SENIOR_CITIZEN' ? 60 :
                              priority === 'CHILD' ? 55 : 50,
    });
  })
);

// ==================== KIOSK STATUS ====================

// Get kiosk-specific information (services available, etc.)
router.get(
  '/:hospitalId/info',
  asyncHandler(async (req: Request, res: Response) => {
    const { hospitalId } = req.params;

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
      },
    });

    if (!hospital) {
      return sendNotFound(res, 'Hospital not found');
    }

    // Get active counters count
    const activeCounters = await prisma.queueCounter.count({
      where: { hospitalId, isActive: true },
    });

    // Get current queue stats
    const waitingTickets = await prisma.queueTicket.count({
      where: {
        hospitalId,
        status: 'WAITING',
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });

    // Average wait time
    const avgWaitTime = waitingTickets > 0 ? Math.ceil(waitingTickets / Math.max(activeCounters, 1) * 8) : 5;

    sendSuccess(res, {
      hospital,
      kioskInfo: {
        activeCounters,
        currentWaiting: waitingTickets,
        averageWaitTime: avgWaitTime,
        servicesAvailable: ['consultation', 'laboratory', 'pharmacy', 'radiology', 'billing'],
      },
    });
  })
);

export default router;
