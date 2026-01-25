import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import {
  calculateNEWS2RiskLevel,
  getNEWS2ClinicalResponse,
} from '../utils/news2';

export class IPDService {
  // Ward Management
  async createWard(data: {
    name: string;
    floor: number;
    capacity: number;
    type: 'GENERAL' | 'PRIVATE' | 'SEMI_PRIVATE' | 'ICU' | 'NICU' | 'PICU' | 'CCU' | 'ISOLATION';
  }) {
    return prisma.ward.create({ data });
  }

  async getAllWards() {
    return prisma.ward.findMany({
      where: { isActive: true },
      include: {
        beds: { include: { admissions: { where: { status: 'ADMITTED' } } } },
      },
    });
  }

  // Bed Management
  async createBed(hospitalId: string, data: {
    departmentId: string;
    wardId: string;
    bedNumber: string;
    bedType: 'STANDARD' | 'ICU' | 'ELECTRIC' | 'PEDIATRIC' | 'BARIATRIC';
    dailyRate: number;
    features?: string[];
  }) {
    return prisma.bed.create({
      data: { ...data, hospitalId },
      include: { ward: true, department: true },
    });
  }

  async getAllBeds(hospitalId: string, params: {
    wardId?: string;
    status?: string;
    bedType?: string;
  }) {
    const where: any = { hospitalId };
    if (params.wardId) where.wardId = params.wardId;
    if (params.status) where.status = params.status;
    if (params.bedType) where.bedType = params.bedType;

    return prisma.bed.findMany({
      where,
      include: {
        ward: true,
        department: true,
        admissions: {
          where: { status: 'ADMITTED' },
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          },
        },
      },
      orderBy: [{ ward: { floor: 'asc' } }, { bedNumber: 'asc' }],
    });
  }

  async updateBedStatus(id: string, status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'CLEANING') {
    return prisma.bed.update({
      where: { id },
      data: { status },
    });
  }

  async getAvailableBeds(hospitalId: string, wardType?: string) {
    const where: any = { hospitalId, status: 'AVAILABLE' };
    if (wardType) {
      where.ward = { type: wardType };
    }

    return prisma.bed.findMany({
      where,
      include: { ward: true, department: true },
      orderBy: { dailyRate: 'asc' },
    });
  }

  // Admissions
  async createAdmission(hospitalId: string, data: {
    patientId: string;
    bedId: string;
    admissionType: 'EMERGENCY' | 'ELECTIVE' | 'TRANSFER' | 'MATERNITY';
    admittingDoctorId: string;
    chiefComplaint: string;
    diagnosis?: string[];
    icdCodes?: string[];
    treatmentPlan?: string;
    estimatedDays?: number;
    notes?: string;
  }) {
    // Update bed status
    await prisma.bed.update({
      where: { id: data.bedId },
      data: { status: 'OCCUPIED' },
    });

    return prisma.admission.create({
      data: {
        ...data,
        hospitalId,
        admissionDate: new Date(),
        diagnosis: data.diagnosis || [],
        icdCodes: data.icdCodes || [],
      },
      include: {
        patient: true,
        bed: { include: { ward: true } },
      },
    });
  }

  async getAdmissions(hospitalId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    wardId?: string;
    patientId?: string;
  }) {
    const { page = 1, limit = 20, status, wardId, patientId } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (status) where.status = status;
    if (wardId) where.bed = { wardId };
    if (patientId) where.patientId = patientId;

    const [admissions, total] = await Promise.all([
      prisma.admission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { admissionDate: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true, phone: true } },
          bed: { include: { ward: true } },
          nursingNotes: { take: 3, orderBy: { createdAt: 'desc' } },
        },
      }),
      prisma.admission.count({ where }),
    ]);

    return { admissions, total, page, limit };
  }

  async getAdmissionById(id: string, hospitalId: string) {
    const admission = await prisma.admission.findFirst({
      where: { id, hospitalId },
      include: {
        patient: true,
        bed: { include: { ward: true, department: true } },
        nursingNotes: {
          orderBy: { createdAt: 'desc' },
          include: { nurse: { include: { user: { select: { firstName: true, lastName: true } } } } },
        },
        prescriptions: {
          include: { medications: { include: { drug: true } } },
        },
        surgeries: true,
        dischargeSummary: true,
      },
    });

    if (!admission) throw new NotFoundError('Admission not found');
    return admission;
  }

  async updateAdmission(id: string, hospitalId: string, data: Partial<{
    diagnosis: string[];
    icdCodes: string[];
    treatmentPlan: string;
    estimatedDays: number;
    notes: string;
  }>) {
    const admission = await prisma.admission.findFirst({ where: { id, hospitalId } });
    if (!admission) throw new NotFoundError('Admission not found');

    return prisma.admission.update({
      where: { id },
      data,
    });
  }

  // Transfer bed
  async transferBed(admissionId: string, newBedId: string) {
    const admission = await prisma.admission.findUnique({ where: { id: admissionId } });
    if (!admission) throw new NotFoundError('Admission not found');

    // Free old bed
    await prisma.bed.update({
      where: { id: admission.bedId },
      data: { status: 'CLEANING' },
    });

    // Occupy new bed
    await prisma.bed.update({
      where: { id: newBedId },
      data: { status: 'OCCUPIED' },
    });

    return prisma.admission.update({
      where: { id: admissionId },
      data: { bedId: newBedId },
      include: { bed: { include: { ward: true } } },
    });
  }

  // Nursing Notes
  async addNursingNote(admissionId: string, nurseId: string, data: {
    noteType: string;
    content: string;
    vitals?: any;
  }) {
    return prisma.nursingNote.create({
      data: { admissionId, nurseId, ...data },
    });
  }

  // Discharge
  async createDischargeSummary(admissionId: string, data: {
    dischargeType: string;
    finalDiagnosis: string[];
    proceduresPerformed?: string[];
    conditionAtDischarge: string;
    medicationsOnDischarge?: string[];
    followUpInstructions?: string;
    followUpDate?: Date;
    dietaryInstructions?: string;
    activityRestrictions?: string;
    warningSignsToWatch?: string[];
    preparedBy: string;
  }) {
    const admission = await prisma.admission.findUnique({ where: { id: admissionId } });
    if (!admission) throw new NotFoundError('Admission not found');

    // Create discharge summary
    const summary = await prisma.dischargeSummary.create({
      data: {
        admissionId,
        dischargeDate: new Date(),
        ...data,
        proceduresPerformed: data.proceduresPerformed || [],
        medicationsOnDischarge: data.medicationsOnDischarge || [],
        warningSignsToWatch: data.warningSignsToWatch || [],
      },
    });

    // Update admission status
    await prisma.admission.update({
      where: { id: admissionId },
      data: { status: 'DISCHARGED', dischargeDate: new Date() },
    });

    // Free bed
    await prisma.bed.update({
      where: { id: admission.bedId },
      data: { status: 'CLEANING' },
    });

    return summary;
  }

  async getIPDStats(hospitalId: string) {
    const [totalBeds, occupiedBeds, admittedPatients, dischargesThisWeek] = await Promise.all([
      prisma.bed.count({ where: { hospitalId } }),
      prisma.bed.count({ where: { hospitalId, status: 'OCCUPIED' } }),
      prisma.admission.count({ where: { hospitalId, status: 'ADMITTED' } }),
      prisma.admission.count({
        where: {
          hospitalId,
          status: 'DISCHARGED',
          dischargeDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      totalBeds,
      occupiedBeds,
      availableBeds: totalBeds - occupiedBeds,
      occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      admittedPatients,
      dischargesThisWeek,
    };
  }

  async getHighRiskPatients(hospitalId: string) {
    // Get patients with critical vitals or specific conditions
    const admissions = await prisma.admission.findMany({
      where: { hospitalId, status: 'ADMITTED' },
      include: {
        patient: {
          include: {
            vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
            aiPredictions: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
        bed: { include: { ward: true } },
      },
    });

    // Filter high-risk based on vitals or AI predictions
    return admissions.filter(admission => {
      const latestVitals = admission.patient.vitals[0];
      const latestPrediction = admission.patient.aiPredictions[0];

      if (latestPrediction?.riskLevel === 'HIGH' || latestPrediction?.riskLevel === 'CRITICAL') {
        return true;
      }

      if (latestVitals) {
        // Check for critical vitals
        if (latestVitals.oxygenSaturation && Number(latestVitals.oxygenSaturation) < 90) return true;
        if (latestVitals.heartRate && (latestVitals.heartRate > 120 || latestVitals.heartRate < 50)) return true;
        if (latestVitals.bloodPressureSys && (latestVitals.bloodPressureSys > 180 || latestVitals.bloodPressureSys < 90)) return true;
      }

      return false;
    });
  }

  // Calculate NEWS2 score from vitals
  calculateNEWS2Score(vitals: {
    respiratoryRate?: number;
    oxygenSaturation?: number;
    supplementalOxygen?: boolean;
    bloodPressureSys?: number;
    heartRate?: number;
    temperature?: number;
    consciousness?: string;
  }): { score: number; riskLevel: string; components: string[]; clinicalResponse: string } {
    let score = 0;
    const components: string[] = [];

    // Respiratory rate (breaths/min)
    const rr = vitals.respiratoryRate || 16;
    let rrScore = 0;
    if (rr <= 8) rrScore = 3;
    else if (rr <= 11) rrScore = 1;
    else if (rr <= 20) rrScore = 0;
    else if (rr <= 24) rrScore = 2;
    else rrScore = 3;
    score += rrScore;
    if (rrScore > 0) components.push(`Respiratory rate (${rr}/min): +${rrScore}`);

    // Oxygen saturation (%)
    const spo2 = vitals.oxygenSaturation || 98;
    let spo2Score = 0;
    if (spo2 <= 91) spo2Score = 3;
    else if (spo2 <= 93) spo2Score = 2;
    else if (spo2 <= 95) spo2Score = 1;
    else spo2Score = 0;
    score += spo2Score;
    if (spo2Score > 0) components.push(`SpO2 (${spo2}%): +${spo2Score}`);

    // Supplemental oxygen
    if (vitals.supplementalOxygen) {
      score += 2;
      components.push('On supplemental O2: +2');
    }

    // Systolic BP (mmHg)
    const sbp = vitals.bloodPressureSys || 120;
    let sbpScore = 0;
    if (sbp <= 90) sbpScore = 3;
    else if (sbp <= 100) sbpScore = 2;
    else if (sbp <= 110) sbpScore = 1;
    else if (sbp <= 219) sbpScore = 0;
    else sbpScore = 3;
    score += sbpScore;
    if (sbpScore > 0) components.push(`Systolic BP (${sbp}mmHg): +${sbpScore}`);

    // Heart rate (bpm)
    const hr = vitals.heartRate || 80;
    let hrScore = 0;
    if (hr <= 40) hrScore = 3;
    else if (hr <= 50) hrScore = 1;
    else if (hr <= 90) hrScore = 0;
    else if (hr <= 110) hrScore = 1;
    else if (hr <= 130) hrScore = 2;
    else hrScore = 3;
    score += hrScore;
    if (hrScore > 0) components.push(`Heart rate (${hr}bpm): +${hrScore}`);

    // Temperature (°C)
    const temp = vitals.temperature || 37.0;
    let tempScore = 0;
    if (temp <= 35.0) tempScore = 3;
    else if (temp <= 36.0) tempScore = 1;
    else if (temp <= 38.0) tempScore = 0;
    else if (temp <= 39.0) tempScore = 1;
    else tempScore = 2;
    score += tempScore;
    if (tempScore > 0) components.push(`Temperature (${temp}°C): +${tempScore}`);

    // Consciousness (AVPU: Alert, Voice, Pain, Unresponsive)
    const consciousness = (vitals.consciousness || 'alert').toLowerCase();
    if (consciousness !== 'alert') {
      score += 3;
      components.push(`Consciousness (${consciousness.toUpperCase()}): +3`);
    }

    // Determine risk level using centralized NEWS2 utility (NHS guidelines)
    // Check if any parameter scored 3 (extreme value)
    const hasExtremeScore = components.some(c => c.includes('+3'));
    const riskLevel = calculateNEWS2RiskLevel(score, hasExtremeScore);
    const clinicalResponse = getNEWS2ClinicalResponse(score, hasExtremeScore);

    return { score, riskLevel, components, clinicalResponse };
  }

  // Record vitals and calculate NEWS2
  async recordVitals(admissionId: string, recordedBy: string, vitalsData: {
    respiratoryRate?: number;
    oxygenSaturation?: number;
    supplementalOxygen?: boolean;
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    heartRate?: number;
    temperature?: number;
    consciousness?: string;
  }) {
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      include: { patient: true },
    });
    if (!admission) throw new NotFoundError('Admission not found');

    // Calculate NEWS2 score
    const news2 = this.calculateNEWS2Score(vitalsData);

    // Record vitals
    const vitals = await prisma.vital.create({
      data: {
        patientId: admission.patientId,
        recordedBy,
        recordedAt: new Date(),
        respiratoryRate: vitalsData.respiratoryRate,
        oxygenSaturation: vitalsData.oxygenSaturation ? String(vitalsData.oxygenSaturation) : null,
        bloodPressureSys: vitalsData.bloodPressureSys,
        bloodPressureDia: vitalsData.bloodPressureDia,
        heartRate: vitalsData.heartRate,
        temperature: vitalsData.temperature,
        notes: vitalsData.consciousness ? `Consciousness: ${vitalsData.consciousness}` : null,
      },
    });

    // Map NEWS2 risk level to Prisma RiskLevel enum
    const riskLevelMap: Record<string, 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'> = {
      'LOW': 'LOW',
      'LOW-MEDIUM': 'LOW',
      'MEDIUM': 'MODERATE',
      'MEDIUM-HIGH': 'HIGH',
      'HIGH': 'CRITICAL',
    };

    // Create AI prediction for deterioration tracking
    await prisma.aIPrediction.create({
      data: {
        patientId: admission.patientId,
        predictionType: 'DETERIORATION',
        riskScore: news2.score / 20, // Normalize to 0-1
        riskLevel: riskLevelMap[news2.riskLevel] || 'LOW',
        factors: news2.components.map(c => ({ factor: c, contribution: 1 })),
        recommendations: [news2.clinicalResponse, ...news2.components],
        modelVersion: 'NEWS2-v1.0',
      },
    });

    return {
      vitals,
      news2Score: news2.score,
      riskLevel: news2.riskLevel,
      clinicalResponse: news2.clinicalResponse,
      components: news2.components,
    };
  }

  // Get deterioration monitoring dashboard data
  async getDeteriorationDashboard(hospitalId: string) {
    const admissions = await prisma.admission.findMany({
      where: { hospitalId, status: 'ADMITTED' },
      include: {
        patient: {
          include: {
            vitals: { orderBy: { recordedAt: 'desc' }, take: 5 },
            aiPredictions: {
              where: { predictionType: 'DETERIORATION' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        bed: { include: { ward: true } },
      },
    });

    // Calculate NEWS2 for each patient
    const patientsWithScores = admissions.map(admission => {
      const latestVitals = admission.patient.vitals[0];
      const latestPrediction = admission.patient.aiPredictions[0];

      let news2: { score: number; riskLevel: string; components: string[]; clinicalResponse: string } = { score: 0, riskLevel: 'LOW', components: [], clinicalResponse: 'Standard monitoring' };
      if (latestVitals) {
        news2 = this.calculateNEWS2Score({
          respiratoryRate: latestVitals.respiratoryRate || undefined,
          oxygenSaturation: latestVitals.oxygenSaturation ? Number(latestVitals.oxygenSaturation) : undefined,
          bloodPressureSys: latestVitals.bloodPressureSys || undefined,
          heartRate: latestVitals.heartRate || undefined,
          temperature: latestVitals.temperature ? Number(latestVitals.temperature) : undefined,
        });
      }

      // Determine trend from last 5 vitals
      let trend: 'improving' | 'stable' | 'worsening' = 'stable';
      if (admission.patient.vitals.length >= 2) {
        const scores = admission.patient.vitals.slice(0, 3).map(v => {
          const s = this.calculateNEWS2Score({
            respiratoryRate: v.respiratoryRate || undefined,
            oxygenSaturation: v.oxygenSaturation ? Number(v.oxygenSaturation) : undefined,
            bloodPressureSys: v.bloodPressureSys || undefined,
            heartRate: v.heartRate || undefined,
            temperature: v.temperature ? Number(v.temperature) : undefined,
          });
          return s.score;
        });
        if (scores[0] > scores[scores.length - 1] + 1) trend = 'worsening';
        else if (scores[0] < scores[scores.length - 1] - 1) trend = 'improving';
      }

      return {
        admissionId: admission.id,
        patientId: admission.patientId,
        patientName: `${admission.patient.firstName} ${admission.patient.lastName}`,
        ward: admission.bed?.ward?.name || 'Unknown',
        bedNumber: admission.bed?.bedNumber || 'N/A',
        news2Score: news2.score,
        riskLevel: news2.riskLevel,
        clinicalResponse: news2.clinicalResponse,
        components: news2.components,
        trend,
        lastVitalsTime: latestVitals?.recordedAt || null,
        vitalsOverdue: latestVitals
          ? (Date.now() - new Date(latestVitals.recordedAt).getTime()) > 4 * 60 * 60 * 1000
          : true,
      };
    });

    // Sort by NEWS2 score (highest first) and risk level
    // Risk levels now use NHS-compliant values: CRITICAL, MODERATE, LOW
    patientsWithScores.sort((a, b) => {
      const riskOrder = { 'CRITICAL': 0, 'MODERATE': 1, 'LOW': 2 };
      const aRisk = riskOrder[a.riskLevel as keyof typeof riskOrder] ?? 3;
      const bRisk = riskOrder[b.riskLevel as keyof typeof riskOrder] ?? 3;
      if (aRisk !== bRisk) return aRisk - bRisk;
      return b.news2Score - a.news2Score;
    });

    // Calculate summary stats
    const highRisk = patientsWithScores.filter(p => p.riskLevel === 'CRITICAL' || p.riskLevel === 'MODERATE').length;
    const vitalsOverdue = patientsWithScores.filter(p => p.vitalsOverdue).length;
    const worsening = patientsWithScores.filter(p => p.trend === 'worsening').length;

    return {
      summary: {
        totalPatients: patientsWithScores.length,
        highRisk,
        vitalsOverdue,
        worsening,
      },
      patients: patientsWithScores,
    };
  }
}

export const ipdService = new IPDService();
