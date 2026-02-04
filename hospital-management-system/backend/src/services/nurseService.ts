import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';

export class NurseService {
  // ==================== DASHBOARD ====================

  async getDashboard(hospitalId: string, nurseId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get assigned patients for current shift
    const currentHour = new Date().getHours();
    let currentShift: 'MORNING' | 'AFTERNOON' | 'NIGHT' = 'MORNING';
    if (currentHour >= 14 && currentHour < 22) currentShift = 'AFTERNOON';
    else if (currentHour >= 22 || currentHour < 6) currentShift = 'NIGHT';

    const myPatients = await prisma.nurseAssignment.count({
      where: {
        hospitalId,
        nurseId,
        shiftDate: today,
        shift: currentShift,
      },
    });

    // Get pending tasks
    const pendingTasks = await prisma.nurseTask.count({
      where: {
        hospitalId,
        nurseId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });

    // Get overdue medications
    const overdueMeds = await prisma.medicationAdministration.count({
      where: {
        hospitalId,
        nurseId,
        status: 'OVERDUE',
      },
    });

    // Get active alerts (patients needing attention)
    const alerts = await prisma.stageAlert.count({
      where: {
        hospitalId,
        status: 'ACTIVE',
      },
    });

    return {
      myPatients,
      pendingTasks,
      overdueMeds,
      alerts,
    };
  }

  async getUnitOverview(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all assignments by shift
    const assignments = await prisma.nurseAssignment.groupBy({
      by: ['shift', 'nurseId'],
      where: {
        hospitalId,
        shiftDate: today,
      },
      _count: true,
    });

    // Count overdue tasks and medications
    const overdueTasks = await prisma.nurseTask.count({
      where: {
        hospitalId,
        status: 'PENDING',
        dueAt: { lt: new Date() },
      },
    });

    const overdueMeds = await prisma.medicationAdministration.count({
      where: {
        hospitalId,
        status: 'OVERDUE',
      },
    });

    return {
      assignments,
      overdueTasks,
      overdueMeds,
    };
  }

  // ==================== ASSIGNMENTS ====================

  async assignPatient(data: {
    hospitalId: string;
    nurseId: string;
    admissionId: string;
    shiftDate: Date;
    shift: 'MORNING' | 'AFTERNOON' | 'NIGHT';
    isPrimary?: boolean;
    assignedBy: string;
  }) {
    return prisma.nurseAssignment.create({
      data,
      include: {
        nurse: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        admission: {
          include: {
            patient: { select: { firstName: true, lastName: true, mrn: true } },
          },
        },
      },
    });
  }

  async getMyPatients(hospitalId: string, nurseId: string, shift?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentHour = new Date().getHours();
    let currentShift: 'MORNING' | 'AFTERNOON' | 'NIGHT' = 'MORNING';
    if (currentHour >= 14 && currentHour < 22) currentShift = 'AFTERNOON';
    else if (currentHour >= 22 || currentHour < 6) currentShift = 'NIGHT';

    const assignments = await prisma.nurseAssignment.findMany({
      where: {
        hospitalId,
        nurseId,
        shiftDate: today,
        shift: (shift as any) || currentShift,
      },
      include: {
        admission: {
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                mrn: true,
                dateOfBirth: true,
                gender: true,
                bloodGroup: true,
              },
            },
            bed: {
              include: {
                ward: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get latest vitals and NEWS2 score for each patient
    const patientsWithVitals = await Promise.all(
      assignments.map(async (assignment) => {
        const latestVital = await prisma.vital.findFirst({
          where: { patientId: assignment.admission.patient.id },
          orderBy: { recordedAt: 'desc' },
        });

        // Get NEWS2 score from the admission record
        const admissionNews2Score = assignment.admission.news2Score;

        // Derive risk level from NEWS2 score
        let riskLevel: string | null = null;
        if (admissionNews2Score != null) {
          if (admissionNews2Score >= 7) riskLevel = 'HIGH';
          else if (admissionNews2Score >= 5) riskLevel = 'MEDIUM';
          else if (admissionNews2Score >= 3) riskLevel = 'LOW_MEDIUM';
          else riskLevel = 'LOW';
        }

        return {
          assignmentId: assignment.id,
          patient: assignment.admission.patient,
          bed: assignment.admission.bed,
          diagnosis: assignment.admission.diagnosis,
          admissionDate: assignment.admission.admissionDate,
          admission: { id: assignment.admissionId }, // Add admission ID for eMAR
          latestVital,
          news2Score: admissionNews2Score || null,
          riskLevel,
        };
      })
    );

    return patientsWithVitals;
  }

  async getAssignments(hospitalId: string, date?: Date) {
    const shiftDate = date || new Date();
    shiftDate.setHours(0, 0, 0, 0);

    return prisma.nurseAssignment.findMany({
      where: {
        hospitalId,
        shiftDate,
      },
      include: {
        nurse: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        admission: {
          include: {
            patient: { select: { firstName: true, lastName: true, mrn: true } },
            bed: { select: { bedNumber: true } },
          },
        },
      },
      orderBy: [{ shift: 'asc' }, { nurse: { user: { firstName: 'asc' } } }],
    });
  }

  async removeAssignment(assignmentId: string) {
    return prisma.nurseAssignment.delete({
      where: { id: assignmentId },
    });
  }

  // ==================== eMAR ====================

  async getEMAR(admissionId: string) {
    const medications = await prisma.medicationAdministration.findMany({
      where: { admissionId },
      orderBy: { scheduledTime: 'asc' },
      include: {
        nurse: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    return medications;
  }

  async administerMedication(data: {
    id: string;
    administeredBy: string;
    administeredAt?: Date;
    notes?: string;
    sideEffects?: string;
    vitalsBefore?: any;
    vitalsAfter?: any;
  }) {
    return prisma.medicationAdministration.update({
      where: { id: data.id },
      data: {
        status: 'ADMINISTERED',
        administeredAt: data.administeredAt || new Date(),
        administeredBy: data.administeredBy,
        notes: data.notes,
        sideEffects: data.sideEffects,
        vitalsBefore: data.vitalsBefore,
        vitalsAfter: data.vitalsAfter,
      },
    });
  }

  async verifyMedication(data: {
    id: string;
    patientScanned: boolean;
    medScanned: boolean;
    verifiedRights: any;
  }) {
    return prisma.medicationAdministration.update({
      where: { id: data.id },
      data: {
        patientScanned: data.patientScanned,
        medScanned: data.medScanned,
        verifiedRights: data.verifiedRights,
      },
    });
  }

  async recordNotGiven(id: string, reason: string, notes?: string) {
    return prisma.medicationAdministration.update({
      where: { id },
      data: {
        status: 'NOT_GIVEN',
        notGivenReason: reason,
        notes,
      },
    });
  }

  async getOverdueMedications(hospitalId: string, nurseId?: string) {
    return prisma.medicationAdministration.findMany({
      where: {
        hospitalId,
        nurseId: nurseId || undefined,
        status: 'OVERDUE',
      },
      include: {
        admission: {
          include: {
            patient: { select: { firstName: true, lastName: true, mrn: true } },
          },
        },
      },
      orderBy: { scheduledTime: 'asc' },
    });
  }

  // ==================== VITALS ====================

  async recordVitals(data: {
    patientId: string;
    temperature?: number;
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    heartRate?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    painLevel?: number;
    recordedBy: string;
    notes?: string;
  }) {
    const vital = await prisma.vital.create({
      data: {
        ...data,
        recordedAt: new Date(),
      },
    });

    // Auto-calculate NEWS2 if we have enough data
    if (
      data.respiratoryRate &&
      data.oxygenSaturation &&
      data.bloodPressureSys &&
      data.heartRate &&
      data.temperature
    ) {
      // Calculate NEWS2 score
      const news2Data = {
        respiratoryRate: data.respiratoryRate,
        oxygenSaturation: data.oxygenSaturation,
        systolicBP: data.bloodPressureSys,
        heartRate: data.heartRate,
        temperature: data.temperature,
        consciousness: 'ALERT', // Default, should be passed in
        supplementalOxygen: false, // Should be passed in
      };

      // Calculate score (simplified - use actual NEWS2 calculation in production)
      let score = 0;
      let riskLevel = 'LOW';

      // Respiratory rate
      if (news2Data.respiratoryRate <= 8) score += 3;
      else if (news2Data.respiratoryRate <= 11) score += 1;
      else if (news2Data.respiratoryRate >= 25) score += 3;
      else if (news2Data.respiratoryRate >= 21) score += 2;

      // Oxygen saturation
      if (news2Data.oxygenSaturation <= 91) score += 3;
      else if (news2Data.oxygenSaturation <= 93) score += 2;
      else if (news2Data.oxygenSaturation <= 95) score += 1;

      // Blood pressure
      if (news2Data.systolicBP <= 90) score += 3;
      else if (news2Data.systolicBP <= 100) score += 2;
      else if (news2Data.systolicBP <= 110) score += 1;
      else if (news2Data.systolicBP >= 220) score += 3;

      // Heart rate
      if (news2Data.heartRate <= 40) score += 3;
      else if (news2Data.heartRate <= 50) score += 1;
      else if (news2Data.heartRate >= 131) score += 3;
      else if (news2Data.heartRate >= 111) score += 2;
      else if (news2Data.heartRate >= 91) score += 1;

      // Temperature
      if (news2Data.temperature <= 35.0) score += 3;
      else if (news2Data.temperature <= 36.0) score += 1;
      else if (news2Data.temperature >= 39.1) score += 2;
      else if (news2Data.temperature >= 38.1) score += 1;

      if (score >= 7) riskLevel = 'HIGH';
      else if (score >= 5) riskLevel = 'MEDIUM';
      else if (score >= 3) riskLevel = 'LOW_MEDIUM';

      // Store NEWS2 score on the patient's active admission
      await prisma.admission.updateMany({
        where: {
          patientId: data.patientId,
          status: 'ADMITTED',
        },
        data: {
          news2Score: score,
        },
      });
    }

    return vital;
  }

  async getVitalsHistory(patientId: string, limit = 20) {
    return prisma.vital.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      take: limit,
    });
  }

  async getVitalsTrends(patientId: string, hours = 24) {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return prisma.vital.findMany({
      where: {
        patientId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'asc' },
    });
  }

  // ==================== I&O ====================

  async recordIntakeOutput(data: {
    hospitalId: string;
    admissionId: string;
    nurseId: string;
    recordedAt: Date;
    type: 'INTAKE' | 'OUTPUT';
    category: string;
    amount: number;
    notes?: string;
  }) {
    return prisma.intakeOutput.create({
      data,
    });
  }

  async getIntakeOutput(admissionId: string, hours = 24) {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return prisma.intakeOutput.findMany({
      where: {
        admissionId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async getIOBalance(admissionId: string, hours = 24) {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const records = await prisma.intakeOutput.findMany({
      where: {
        admissionId,
        recordedAt: { gte: since },
      },
    });

    const intake = records
      .filter((r) => r.type === 'INTAKE')
      .reduce((sum, r) => sum + r.amount, 0);

    const output = records
      .filter((r) => r.type === 'OUTPUT')
      .reduce((sum, r) => sum + r.amount, 0);

    const balance = intake - output;

    return { intake, output, balance, records };
  }

  // ==================== ASSESSMENTS ====================

  async createAssessment(data: {
    hospitalId: string;
    admissionId: string;
    nurseId: string;
    assessmentType: string;
    data: any;
    score?: number;
    riskLevel?: string;
    notes?: string;
  }) {
    return prisma.nursingAssessment.create({
      data: {
        ...data,
        assessmentType: data.assessmentType as any,
      },
      include: {
        nurse: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }

  async getAssessments(admissionId: string, type?: string) {
    return prisma.nursingAssessment.findMany({
      where: {
        admissionId,
        assessmentType: type ? (type as any) : undefined,
      },
      include: {
        nurse: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAssessmentTypes() {
    return [
      { value: 'ADMISSION', label: 'Admission Assessment' },
      { value: 'HEAD_TO_TOE', label: 'Head-to-Toe Assessment' },
      { value: 'PAIN', label: 'Pain Assessment' },
      { value: 'FALL_RISK', label: 'Fall Risk (Morse Scale)' },
      { value: 'SKIN_INTEGRITY', label: 'Skin Integrity (Braden Scale)' },
      { value: 'NEUROLOGICAL', label: 'Neurological (GCS)' },
      { value: 'RESPIRATORY', label: 'Respiratory Assessment' },
      { value: 'CARDIOVASCULAR', label: 'Cardiovascular Assessment' },
      { value: 'GASTROINTESTINAL', label: 'GI Assessment' },
      { value: 'MUSCULOSKELETAL', label: 'Musculoskeletal Assessment' },
      { value: 'PSYCHOSOCIAL', label: 'Psychosocial Screening' },
      { value: 'DISCHARGE_READINESS', label: 'Discharge Readiness' },
    ];
  }

  // ==================== HANDOFF ====================

  async createHandoff(data: {
    hospitalId: string;
    admissionId: string;
    outgoingNurseId: string;
    incomingNurseId?: string;
    shift: 'MORNING' | 'AFTERNOON' | 'NIGHT';
    handoffDate: Date;
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
    pendingTasks?: any;
    pendingMeds?: any;
    alerts?: any;
  }) {
    return prisma.shiftHandoff.create({
      data,
      include: {
        outgoingNurse: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        incomingNurse: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        admission: {
          include: {
            patient: { select: { firstName: true, lastName: true, mrn: true } },
          },
        },
      },
    });
  }

  async getHandoffHistory(admissionId: string) {
    return prisma.shiftHandoff.findMany({
      where: { admissionId },
      include: {
        outgoingNurse: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        incomingNurse: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { handoffDate: 'desc' },
    });
  }

  async getPendingHandoffs(hospitalId: string, nurseId: string) {
    return prisma.shiftHandoff.findMany({
      where: {
        hospitalId,
        incomingNurseId: nurseId,
        status: 'PENDING',
      },
      include: {
        outgoingNurse: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        admission: {
          include: {
            patient: { select: { firstName: true, lastName: true, mrn: true } },
          },
        },
      },
      orderBy: { handoffDate: 'desc' },
    });
  }

  async acceptHandoff(handoffId: string) {
    return prisma.shiftHandoff.update({
      where: { id: handoffId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });
  }

  // ==================== TASKS ====================

  async createTask(data: {
    hospitalId: string;
    admissionId?: string;
    nurseId: string;
    title: string;
    description?: string;
    category: string;
    priority?: string;
    dueAt?: Date;
    sourceType?: string;
    sourceId?: string;
  }) {
    return prisma.nurseTask.create({
      data: {
        ...data,
        category: data.category as any,
        priority: (data.priority as any) || 'ROUTINE',
      },
    });
  }

  async getTasks(hospitalId: string, nurseId: string, filters?: {
    status?: string;
    category?: string;
    admissionId?: string;
  }) {
    return prisma.nurseTask.findMany({
      where: {
        hospitalId,
        nurseId,
        status: filters?.status ? (filters.status as any) : undefined,
        category: filters?.category ? (filters.category as any) : undefined,
        admissionId: filters?.admissionId || undefined,
      },
      include: {
        admission: {
          include: {
            patient: { select: { firstName: true, lastName: true, mrn: true } },
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { dueAt: 'asc' }],
    });
  }

  async updateTask(taskId: string, data: {
    status?: string;
    notes?: string;
    completedAt?: Date;
  }) {
    return prisma.nurseTask.update({
      where: { id: taskId },
      data: {
        status: data.status ? (data.status as any) : undefined,
        notes: data.notes,
        completedAt: data.completedAt,
      },
    });
  }

  async getOverdueTasks(hospitalId: string, nurseId?: string) {
    return prisma.nurseTask.findMany({
      where: {
        hospitalId,
        nurseId: nurseId || undefined,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueAt: { lt: new Date() },
      },
      include: {
        admission: {
          include: {
            patient: { select: { firstName: true, lastName: true, mrn: true } },
          },
        },
      },
      orderBy: { dueAt: 'asc' },
    });
  }
}

export const nurseService = new NurseService();
