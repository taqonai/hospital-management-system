import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';

export class SurgeryService {
  async scheduleSurgery(data: {
    admissionId: string;
    patientId: string;
    surgeonId: string;
    surgeryType: string;
    procedureName: string;
    cptCode?: string;
    scheduledDate: Date;
    operationTheatre: string;
    anesthesiaType?: string;
    preOpDiagnosis: string;
    notes?: string;
  }) {
    // Check OT availability
    const existing = await prisma.surgery.findFirst({
      where: {
        operationTheatre: data.operationTheatre,
        scheduledDate: data.scheduledDate,
        status: { in: ['SCHEDULED', 'IN_PREPARATION', 'IN_PROGRESS'] },
      },
    });

    if (existing) {
      throw new Error('Operation theatre not available at this time');
    }

    return prisma.surgery.create({
      data,
      include: {
        admission: {
          include: { patient: { select: { id: true, firstName: true, lastName: true, mrn: true } } },
        },
        surgeon: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }

  async getSurgeries(hospitalId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    surgeonId?: string;
    operationTheatre?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page = 1, limit = 20, status, surgeonId, operationTheatre, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { admission: { hospitalId } };
    if (status) where.status = status;
    if (surgeonId) where.surgeonId = surgeonId;
    if (operationTheatre) where.operationTheatre = operationTheatre;
    if (startDate || endDate) {
      where.scheduledDate = {};
      if (startDate) where.scheduledDate.gte = new Date(startDate);
      if (endDate) where.scheduledDate.lte = new Date(endDate);
    }

    const [surgeries, total] = await Promise.all([
      prisma.surgery.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledDate: 'asc' },
        include: {
          admission: {
            include: { patient: { select: { id: true, firstName: true, lastName: true, mrn: true } } },
          },
          surgeon: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
      prisma.surgery.count({ where }),
    ]);

    return { surgeries, total, page, limit };
  }

  async getSurgeryById(id: string) {
    const surgery = await prisma.surgery.findUnique({
      where: { id },
      include: {
        admission: {
          include: {
            patient: true,
            bed: { include: { ward: true } },
          },
        },
        surgeon: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!surgery) throw new NotFoundError('Surgery not found');
    return surgery;
  }

  async updateSurgeryStatus(id: string, status: string, data?: {
    actualStartTime?: Date;
    actualEndTime?: Date;
    postOpDiagnosis?: string;
    findings?: string;
    complications?: string;
    notes?: string;
  }) {
    const updateData: any = { status };
    if (data) Object.assign(updateData, data);

    if (status === 'IN_PROGRESS' && !data?.actualStartTime) {
      updateData.actualStartTime = new Date();
    }
    if (status === 'COMPLETED' && !data?.actualEndTime) {
      updateData.actualEndTime = new Date();
    }

    return prisma.surgery.update({
      where: { id },
      data: updateData,
    });
  }

  async startSurgery(id: string) {
    return this.updateSurgeryStatus(id, 'IN_PROGRESS', { actualStartTime: new Date() });
  }

  async completeSurgery(id: string, data: {
    postOpDiagnosis: string;
    findings?: string;
    complications?: string;
    notes?: string;
  }) {
    return this.updateSurgeryStatus(id, 'COMPLETED', {
      ...data,
      actualEndTime: new Date(),
    });
  }

  async cancelSurgery(id: string, reason: string) {
    return prisma.surgery.update({
      where: { id },
      data: { status: 'CANCELLED', notes: reason },
    });
  }

  async postponeSurgery(id: string, newDate: Date, reason?: string) {
    const surgery = await prisma.surgery.findUnique({ where: { id } });
    if (!surgery) throw new NotFoundError('Surgery not found');

    return prisma.surgery.update({
      where: { id },
      data: {
        scheduledDate: newDate,
        status: 'SCHEDULED',
        notes: reason ? `${surgery.notes || ''}\nPostponed: ${reason}` : surgery.notes,
      },
    });
  }

  async getTodaySchedule(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return prisma.surgery.findMany({
      where: {
        admission: { hospitalId },
        scheduledDate: { gte: today, lt: tomorrow },
        status: { in: ['SCHEDULED', 'IN_PREPARATION', 'IN_PROGRESS'] },
      },
      orderBy: { scheduledDate: 'asc' },
      include: {
        admission: {
          include: { patient: { select: { id: true, firstName: true, lastName: true, mrn: true } } },
        },
        surgeon: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }

  async getOTStatus(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const surgeries = await prisma.surgery.findMany({
      where: {
        admission: { hospitalId },
        scheduledDate: { gte: today, lt: tomorrow },
      },
      include: {
        admission: {
          include: { patient: { select: { firstName: true, lastName: true, mrn: true } } },
        },
        surgeon: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Initialize default OTs (OT-1 through OT-4)
    const defaultOTs = ['OT-1', 'OT-2', 'OT-3', 'OT-4'];
    const otStatus: Record<string, any> = {};

    defaultOTs.forEach(otName => {
      otStatus[otName] = {
        id: otName,
        name: otName,
        status: 'AVAILABLE',
        currentSurgery: null,
        upcomingSurgeries: [],
        completedSurgeries: [],
      };
    });

    // Update OT status based on surgeries
    surgeries.forEach(s => {
      if (!otStatus[s.operationTheatre]) {
        otStatus[s.operationTheatre] = {
          id: s.operationTheatre,
          name: s.operationTheatre,
          status: 'AVAILABLE',
          currentSurgery: null,
          upcomingSurgeries: [],
          completedSurgeries: [],
        };
      }

      if (s.status === 'IN_PROGRESS') {
        otStatus[s.operationTheatre].status = 'IN_USE';
        otStatus[s.operationTheatre].currentSurgery = s;
      } else if (s.status === 'COMPLETED') {
        otStatus[s.operationTheatre].completedSurgeries.push(s);
      } else if (['SCHEDULED', 'IN_PREPARATION'].includes(s.status)) {
        otStatus[s.operationTheatre].upcomingSurgeries.push(s);
        if (otStatus[s.operationTheatre].status === 'AVAILABLE') {
          otStatus[s.operationTheatre].status = 'PREPARING';
        }
      }
    });

    return Object.values(otStatus);
  }

  async getPreOpChecklist(surgeryId: string) {
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      include: {
        admission: {
          include: {
            patient: {
              include: {
                allergies: true,
                vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
                medicalHistory: true,
              },
            },
          },
        },
      },
    });

    if (!surgery) throw new NotFoundError('Surgery not found');

    const patient = surgery.admission.patient;
    const latestVitals = patient.vitals[0];

    return {
      surgery,
      patient: {
        name: `${patient.firstName} ${patient.lastName}`,
        mrn: patient.mrn,
        bloodGroup: patient.bloodGroup,
        allergies: patient.allergies,
        medicalHistory: patient.medicalHistory,
      },
      checklist: {
        patientIdentified: false,
        consentSigned: false,
        npoDuration: null,
        bloodTyped: patient.bloodGroup !== null,
        allergiesReviewed: true,
        medicationsReviewed: true,
        vitalsRecorded: latestVitals !== undefined,
        ivAccess: false,
        preOpMedicationsGiven: false,
        surgicalSiteMarked: false,
        antibioticsProphylaxis: false,
      },
      vitals: latestVitals,
    };
  }

  async getSurgeryStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [scheduledToday, completedToday, inProgress, thisWeek] = await Promise.all([
      prisma.surgery.count({
        where: {
          admission: { hospitalId },
          scheduledDate: { gte: today, lt: tomorrow },
          status: { in: ['SCHEDULED', 'IN_PREPARATION'] },
        },
      }),
      prisma.surgery.count({
        where: {
          admission: { hospitalId },
          scheduledDate: { gte: today, lt: tomorrow },
          status: 'COMPLETED',
        },
      }),
      prisma.surgery.count({
        where: {
          admission: { hospitalId },
          status: 'IN_PROGRESS',
        },
      }),
      prisma.surgery.count({
        where: {
          admission: { hospitalId },
          scheduledDate: { gte: weekAgo },
          status: 'COMPLETED',
        },
      }),
    ]);

    return {
      scheduledToday,
      completedToday,
      inProgress,
      completedThisWeek: thisWeek,
    };
  }

  // ==================== AI SURGERY RISK ASSESSMENT ====================

  // Surgery duration database (in minutes) based on procedure type
  private readonly surgeryDurationDB: Record<string, { avgDuration: number; minDuration: number; maxDuration: number; complexity: string }> = {
    'appendectomy': { avgDuration: 60, minDuration: 30, maxDuration: 120, complexity: 'MODERATE' },
    'laparoscopic appendectomy': { avgDuration: 45, minDuration: 25, maxDuration: 90, complexity: 'MODERATE' },
    'cholecystectomy': { avgDuration: 75, minDuration: 45, maxDuration: 150, complexity: 'MODERATE' },
    'laparoscopic cholecystectomy': { avgDuration: 60, minDuration: 30, maxDuration: 120, complexity: 'MODERATE' },
    'hernia repair': { avgDuration: 60, minDuration: 30, maxDuration: 120, complexity: 'LOW' },
    'inguinal hernia repair': { avgDuration: 45, minDuration: 30, maxDuration: 90, complexity: 'LOW' },
    'hip replacement': { avgDuration: 120, minDuration: 90, maxDuration: 180, complexity: 'HIGH' },
    'total hip replacement': { avgDuration: 150, minDuration: 120, maxDuration: 240, complexity: 'HIGH' },
    'knee replacement': { avgDuration: 120, minDuration: 90, maxDuration: 180, complexity: 'HIGH' },
    'total knee replacement': { avgDuration: 150, minDuration: 120, maxDuration: 210, complexity: 'HIGH' },
    'cabg': { avgDuration: 240, minDuration: 180, maxDuration: 360, complexity: 'CRITICAL' },
    'coronary artery bypass': { avgDuration: 240, minDuration: 180, maxDuration: 360, complexity: 'CRITICAL' },
    'valve replacement': { avgDuration: 210, minDuration: 150, maxDuration: 300, complexity: 'CRITICAL' },
    'cesarean section': { avgDuration: 45, minDuration: 25, maxDuration: 90, complexity: 'MODERATE' },
    'c-section': { avgDuration: 45, minDuration: 25, maxDuration: 90, complexity: 'MODERATE' },
    'hysterectomy': { avgDuration: 90, minDuration: 60, maxDuration: 180, complexity: 'MODERATE' },
    'laparoscopic hysterectomy': { avgDuration: 120, minDuration: 60, maxDuration: 180, complexity: 'MODERATE' },
    'prostatectomy': { avgDuration: 150, minDuration: 90, maxDuration: 240, complexity: 'HIGH' },
    'mastectomy': { avgDuration: 90, minDuration: 60, maxDuration: 150, complexity: 'MODERATE' },
    'lumpectomy': { avgDuration: 45, minDuration: 30, maxDuration: 90, complexity: 'LOW' },
    'thyroidectomy': { avgDuration: 120, minDuration: 90, maxDuration: 180, complexity: 'MODERATE' },
    'spinal fusion': { avgDuration: 240, minDuration: 180, maxDuration: 360, complexity: 'HIGH' },
    'laminectomy': { avgDuration: 120, minDuration: 60, maxDuration: 180, complexity: 'MODERATE' },
    'craniotomy': { avgDuration: 300, minDuration: 180, maxDuration: 480, complexity: 'CRITICAL' },
    'colectomy': { avgDuration: 180, minDuration: 120, maxDuration: 300, complexity: 'HIGH' },
    'gastric bypass': { avgDuration: 150, minDuration: 120, maxDuration: 240, complexity: 'HIGH' },
    'bariatric surgery': { avgDuration: 150, minDuration: 90, maxDuration: 240, complexity: 'HIGH' },
  };

  // Predict surgery duration based on procedure and patient factors
  predictSurgeryDuration(params: {
    procedureName: string;
    surgeryType: string;
    patientAge?: number;
    patientBMI?: number;
    isEmergency?: boolean;
    hasComorbidities?: boolean;
    previousSurgeries?: number;
    anesthesiaType?: string;
  }): {
    predictedDuration: number;
    durationRange: { min: number; max: number };
    confidence: string;
    complexity: string;
    factors: string[];
    otPreparationTime: number;
    totalBlockTime: number;
  } {
    const factors: string[] = [];
    let baseDuration = 90; // Default duration
    let minDuration = 60;
    let maxDuration = 180;
    let complexity = 'MODERATE';
    let confidence = 'MEDIUM';

    // Find matching procedure in database
    const procedureLower = params.procedureName.toLowerCase();
    const surgeryTypeLower = params.surgeryType.toLowerCase();

    let foundMatch = false;
    for (const [key, value] of Object.entries(this.surgeryDurationDB)) {
      if (procedureLower.includes(key) || surgeryTypeLower.includes(key) || key.includes(procedureLower)) {
        baseDuration = value.avgDuration;
        minDuration = value.minDuration;
        maxDuration = value.maxDuration;
        complexity = value.complexity;
        confidence = 'HIGH';
        foundMatch = true;
        factors.push(`Base duration from ${key}: ${baseDuration} minutes`);
        break;
      }
    }

    if (!foundMatch) {
      factors.push('Using default estimates - procedure not in database');
      confidence = 'LOW';
    }

    // Adjust for patient age
    if (params.patientAge) {
      if (params.patientAge >= 70) {
        baseDuration *= 1.2;
        maxDuration *= 1.3;
        factors.push('Elderly patient (+20% duration): additional care required');
      } else if (params.patientAge >= 60) {
        baseDuration *= 1.1;
        factors.push('Senior patient (+10% duration)');
      }
    }

    // Adjust for BMI
    if (params.patientBMI) {
      if (params.patientBMI >= 40) {
        baseDuration *= 1.3;
        maxDuration *= 1.4;
        factors.push('Morbidly obese patient (+30% duration): surgical complexity increased');
      } else if (params.patientBMI >= 35) {
        baseDuration *= 1.2;
        factors.push('Obese patient (+20% duration)');
      } else if (params.patientBMI >= 30) {
        baseDuration *= 1.1;
        factors.push('Overweight patient (+10% duration)');
      }
    }

    // Adjust for emergency
    if (params.isEmergency) {
      baseDuration *= 1.15;
      minDuration *= 0.8; // Emergency might be faster in some cases
      maxDuration *= 1.3;
      factors.push('Emergency surgery: variable timing');
      confidence = confidence === 'HIGH' ? 'MEDIUM' : 'LOW';
    }

    // Adjust for comorbidities
    if (params.hasComorbidities) {
      baseDuration *= 1.15;
      maxDuration *= 1.2;
      factors.push('Patient has comorbidities (+15% duration): additional monitoring');
    }

    // Adjust for previous surgeries (adhesions/scarring)
    if (params.previousSurgeries && params.previousSurgeries > 0) {
      const adhesionFactor = Math.min(params.previousSurgeries * 0.05, 0.2);
      baseDuration *= (1 + adhesionFactor);
      factors.push(`Previous surgeries (${params.previousSurgeries}): possible adhesions (+${Math.round(adhesionFactor * 100)}%)`);
    }

    // Calculate OT preparation time
    const otPreparationTime = complexity === 'CRITICAL' ? 45 : complexity === 'HIGH' ? 30 : 20;
    const recoveryRoomTime = complexity === 'CRITICAL' ? 60 : complexity === 'HIGH' ? 45 : 30;
    const totalBlockTime = Math.round(baseDuration) + otPreparationTime + recoveryRoomTime;

    return {
      predictedDuration: Math.round(baseDuration),
      durationRange: { min: Math.round(minDuration), max: Math.round(maxDuration) },
      confidence,
      complexity,
      factors,
      otPreparationTime,
      totalBlockTime,
    };
  }

  // Assess surgical risk based on patient factors
  assessSurgicalRisk(params: {
    procedureName: string;
    surgeryType: string;
    patientAge: number;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    asaScore?: number; // ASA Physical Status (1-6)
    bmi?: number;
    comorbidities?: string[];
    smokingStatus?: 'never' | 'former' | 'current';
    diabetesStatus?: 'none' | 'controlled' | 'uncontrolled';
    cardiacHistory?: boolean;
    renalFunction?: 'normal' | 'mild' | 'moderate' | 'severe' | 'dialysis';
    hepaticFunction?: 'normal' | 'mild' | 'moderate' | 'severe';
    medications?: string[];
    recentLabResults?: {
      hemoglobin?: number;
      platelets?: number;
      inr?: number;
      creatinine?: number;
      albumin?: number;
    };
    isEmergency?: boolean;
  }): {
    overallRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    riskScore: number; // 0-100
    mortalityRisk: string;
    complicationRisk: string;
    components: {
      patientFactors: number;
      surgicalFactors: number;
      anesthesiaFactors: number;
    };
    riskFactors: { factor: string; impact: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'; description: string }[];
    recommendations: string[];
    preOpRequirements: string[];
  } {
    let riskScore = 0;
    const riskFactors: { factor: string; impact: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'; description: string }[] = [];
    const recommendations: string[] = [];
    const preOpRequirements: string[] = [];

    // --- PATIENT FACTORS ---
    let patientFactorScore = 0;

    // Age risk
    if (params.patientAge >= 80) {
      patientFactorScore += 20;
      riskFactors.push({ factor: 'Advanced age (80+)', impact: 'HIGH', description: 'Significantly increased perioperative risk' });
      recommendations.push('Consider geriatric consultation');
    } else if (params.patientAge >= 70) {
      patientFactorScore += 12;
      riskFactors.push({ factor: 'Elderly (70+)', impact: 'MODERATE', description: 'Increased recovery time and complications' });
    } else if (params.patientAge >= 60) {
      patientFactorScore += 6;
      riskFactors.push({ factor: 'Senior (60+)', impact: 'LOW', description: 'Minor increased risk' });
    }

    // ASA Score
    if (params.asaScore) {
      const asaRisk: Record<number, { score: number; impact: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' }> = {
        1: { score: 0, impact: 'LOW' },
        2: { score: 5, impact: 'LOW' },
        3: { score: 15, impact: 'MODERATE' },
        4: { score: 30, impact: 'HIGH' },
        5: { score: 50, impact: 'CRITICAL' },
        6: { score: 100, impact: 'CRITICAL' },
      };
      const asaData = asaRisk[params.asaScore] || asaRisk[3];
      patientFactorScore += asaData.score;
      if (params.asaScore >= 3) {
        riskFactors.push({ factor: `ASA Score ${params.asaScore}`, impact: asaData.impact, description: 'Patient physical status classification' });
      }
    }

    // BMI risk
    if (params.bmi) {
      if (params.bmi >= 40) {
        patientFactorScore += 15;
        riskFactors.push({ factor: 'Morbid obesity (BMI 40+)', impact: 'HIGH', description: 'High risk for respiratory, cardiac, and wound complications' });
        recommendations.push('Optimize weight before elective surgery if possible');
        preOpRequirements.push('Pulmonary function tests');
      } else if (params.bmi >= 35) {
        patientFactorScore += 10;
        riskFactors.push({ factor: 'Severe obesity (BMI 35-40)', impact: 'MODERATE', description: 'Increased anesthetic and surgical risk' });
      } else if (params.bmi >= 30) {
        patientFactorScore += 5;
        riskFactors.push({ factor: 'Obesity (BMI 30-35)', impact: 'LOW', description: 'Minor increased surgical risk' });
      }
    }

    // Cardiac history
    if (params.cardiacHistory) {
      patientFactorScore += 15;
      riskFactors.push({ factor: 'Cardiac history', impact: 'HIGH', description: 'Increased cardiovascular perioperative risk' });
      recommendations.push('Cardiology clearance recommended');
      preOpRequirements.push('ECG', 'Echocardiogram if not recent');
    }

    // Diabetes
    if (params.diabetesStatus === 'uncontrolled') {
      patientFactorScore += 12;
      riskFactors.push({ factor: 'Uncontrolled diabetes', impact: 'MODERATE', description: 'Higher infection and healing risk' });
      recommendations.push('Optimize glycemic control before surgery');
      preOpRequirements.push('HbA1c', 'Fasting glucose');
    } else if (params.diabetesStatus === 'controlled') {
      patientFactorScore += 5;
      riskFactors.push({ factor: 'Controlled diabetes', impact: 'LOW', description: 'Minor increased risk' });
    }

    // Smoking
    if (params.smokingStatus === 'current') {
      patientFactorScore += 10;
      riskFactors.push({ factor: 'Current smoker', impact: 'MODERATE', description: 'Higher respiratory and wound healing complications' });
      recommendations.push('Strongly advise smoking cessation 4+ weeks before surgery');
    } else if (params.smokingStatus === 'former') {
      patientFactorScore += 3;
    }

    // Renal function
    if (params.renalFunction === 'dialysis' || params.renalFunction === 'severe') {
      patientFactorScore += 20;
      riskFactors.push({ factor: 'Severe renal impairment', impact: 'HIGH', description: 'Significant anesthetic and medication concerns' });
      recommendations.push('Nephrology consultation');
      preOpRequirements.push('Renal panel', 'Dialysis schedule coordination');
    } else if (params.renalFunction === 'moderate') {
      patientFactorScore += 10;
      riskFactors.push({ factor: 'Moderate renal impairment', impact: 'MODERATE', description: 'Drug dosing adjustments needed' });
    }

    // Hepatic function
    if (params.hepaticFunction === 'severe') {
      patientFactorScore += 20;
      riskFactors.push({ factor: 'Severe hepatic impairment', impact: 'HIGH', description: 'Coagulation and drug metabolism concerns' });
      preOpRequirements.push('Liver panel', 'Coagulation profile');
    } else if (params.hepaticFunction === 'moderate') {
      patientFactorScore += 10;
      riskFactors.push({ factor: 'Moderate hepatic impairment', impact: 'MODERATE', description: 'Monitor liver function' });
    }

    // Lab abnormalities
    if (params.recentLabResults) {
      if (params.recentLabResults.hemoglobin && params.recentLabResults.hemoglobin < 10) {
        patientFactorScore += 10;
        riskFactors.push({ factor: 'Anemia (Hgb < 10)', impact: 'MODERATE', description: 'May need transfusion, optimize before surgery' });
        preOpRequirements.push('Type and screen', 'Consider iron therapy');
      }
      if (params.recentLabResults.inr && params.recentLabResults.inr > 1.5) {
        patientFactorScore += 12;
        riskFactors.push({ factor: 'Elevated INR', impact: 'HIGH', description: 'Bleeding risk - may need reversal' });
        recommendations.push('Review anticoagulation management plan');
      }
      if (params.recentLabResults.albumin && params.recentLabResults.albumin < 3.0) {
        patientFactorScore += 8;
        riskFactors.push({ factor: 'Low albumin', impact: 'MODERATE', description: 'Malnutrition - poor wound healing' });
        recommendations.push('Nutritional optimization');
      }
    }

    // --- SURGICAL FACTORS ---
    let surgicalFactorScore = 0;
    const procedureLower = params.procedureName.toLowerCase();
    const surgeryTypeLower = params.surgeryType.toLowerCase();

    // Determine surgery complexity
    let surgeryComplexity = 'MODERATE';
    for (const [key, value] of Object.entries(this.surgeryDurationDB)) {
      if (procedureLower.includes(key) || surgeryTypeLower.includes(key)) {
        surgeryComplexity = value.complexity;
        break;
      }
    }

    if (surgeryComplexity === 'CRITICAL') {
      surgicalFactorScore += 25;
      riskFactors.push({ factor: 'Critical complexity surgery', impact: 'CRITICAL', description: 'Major surgery with significant risk' });
      preOpRequirements.push('ICU bed reservation');
    } else if (surgeryComplexity === 'HIGH') {
      surgicalFactorScore += 15;
      riskFactors.push({ factor: 'High complexity surgery', impact: 'HIGH', description: 'Complex procedure' });
    } else if (surgeryComplexity === 'MODERATE') {
      surgicalFactorScore += 8;
    }

    // Emergency surgery
    if (params.isEmergency) {
      surgicalFactorScore += 15;
      riskFactors.push({ factor: 'Emergency surgery', impact: 'HIGH', description: 'Limited time for optimization' });
    }

    // --- ANESTHESIA FACTORS ---
    let anesthesiaFactorScore = 0;

    // General anesthesia risk factors based on patient conditions
    if (params.bmi && params.bmi >= 35) {
      anesthesiaFactorScore += 10;
      riskFactors.push({ factor: 'Difficult airway risk', impact: 'MODERATE', description: 'Obesity increases intubation difficulty' });
    }

    // Calculate total score
    riskScore = Math.min(100, patientFactorScore + surgicalFactorScore + anesthesiaFactorScore);

    // Determine overall risk level
    let overallRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    let mortalityRisk: string;
    let complicationRisk: string;

    if (riskScore >= 60) {
      overallRisk = 'CRITICAL';
      mortalityRisk = '>5%';
      complicationRisk = '>30%';
    } else if (riskScore >= 40) {
      overallRisk = 'HIGH';
      mortalityRisk = '2-5%';
      complicationRisk = '15-30%';
    } else if (riskScore >= 20) {
      overallRisk = 'MODERATE';
      mortalityRisk = '0.5-2%';
      complicationRisk = '5-15%';
    } else {
      overallRisk = 'LOW';
      mortalityRisk = '<0.5%';
      complicationRisk = '<5%';
    }

    // Standard pre-op requirements
    if (preOpRequirements.length === 0) {
      preOpRequirements.push('Basic metabolic panel', 'CBC', 'Type and screen');
    }
    if (params.patientAge >= 50 && !preOpRequirements.includes('ECG')) {
      preOpRequirements.push('ECG');
    }
    if (params.patientAge >= 40) {
      preOpRequirements.push('Chest X-ray');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Standard pre-operative instructions');
    }
    recommendations.push('NPO after midnight before surgery');

    return {
      overallRisk,
      riskScore,
      mortalityRisk,
      complicationRisk,
      components: {
        patientFactors: patientFactorScore,
        surgicalFactors: surgicalFactorScore,
        anesthesiaFactors: anesthesiaFactorScore,
      },
      riskFactors,
      recommendations,
      preOpRequirements,
    };
  }
}

export const surgeryService = new SurgeryService();
