import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';

export class LaboratoryService {
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `LAB-${timestamp}${random}`;
  }

  // Lab Tests CRUD
  async createLabTest(data: {
    name: string;
    code: string;
    category: string;
    description?: string;
    sampleType: string;
    normalRange?: string;
    unit?: string;
    price: number;
    turnaroundTime: number;
    instructions?: string;
  }) {
    return prisma.labTest.create({ data });
  }

  async getAllLabTests(params: { search?: string; category?: string; isActive?: boolean }) {
    const where: any = {};
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params.category) where.category = params.category;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    return prisma.labTest.findMany({ where, orderBy: { name: 'asc' } });
  }

  async getLabTestById(id: string) {
    const test = await prisma.labTest.findUnique({ where: { id } });
    if (!test) throw new NotFoundError('Lab test not found');
    return test;
  }

  async updateLabTest(id: string, data: Partial<{
    name: string;
    category: string;
    description?: string;
    sampleType: string;
    normalRange?: string;
    unit?: string;
    price: number;
    turnaroundTime: number;
    instructions?: string;
    isActive: boolean;
  }>) {
    return prisma.labTest.update({ where: { id }, data });
  }

  // Lab Orders
  async createLabOrder(hospitalId: string, data: {
    patientId: string;
    consultationId?: string;
    orderedBy: string;
    priority?: 'STAT' | 'URGENT' | 'ROUTINE';
    clinicalNotes?: string;
    specialInstructions?: string;
    testIds: string[];
  }) {
    const orderNumber = this.generateOrderNumber();

    return prisma.labOrder.create({
      data: {
        hospitalId,
        patientId: data.patientId,
        consultationId: data.consultationId,
        orderNumber,
        orderedBy: data.orderedBy,
        priority: data.priority || 'ROUTINE',
        clinicalNotes: data.clinicalNotes,
        specialInstructions: data.specialInstructions,
        tests: {
          create: data.testIds.map(testId => ({
            labTestId: testId,
            status: 'PENDING',
          })),
        },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
        tests: { include: { labTest: true } },
      },
    });
  }

  async getLabOrders(hospitalId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    patientId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page = 1, limit = 20, status, priority, patientId, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (patientId) where.patientId = patientId;
    if (startDate || endDate) {
      where.orderedAt = {};
      if (startDate) where.orderedAt.gte = new Date(startDate);
      if (endDate) where.orderedAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.labOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { orderedAt: 'desc' }],
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          tests: { include: { labTest: true } },
        },
      }),
      prisma.labOrder.count({ where }),
    ]);

    return { orders, total, page, limit };
  }

  async getLabOrderById(id: string, hospitalId: string) {
    const order = await prisma.labOrder.findFirst({
      where: { id, hospitalId },
      include: {
        patient: true,
        tests: { include: { labTest: true } },
        consultation: true,
      },
    });
    if (!order) throw new NotFoundError('Lab order not found');
    return order;
  }

  async updateLabOrderStatus(id: string, hospitalId: string, status: string) {
    const order = await prisma.labOrder.findFirst({ where: { id, hospitalId } });
    if (!order) throw new NotFoundError('Lab order not found');

    const updateData: any = { status };
    if (status === 'SAMPLE_COLLECTED') updateData.collectedAt = new Date();
    if (status === 'COMPLETED') updateData.completedAt = new Date();

    return prisma.labOrder.update({
      where: { id },
      data: updateData,
      include: { tests: { include: { labTest: true } } },
    });
  }

  async enterTestResult(labOrderTestId: string, data: {
    result: string;
    resultValue?: number;
    unit?: string;
    isAbnormal?: boolean;
    isCritical?: boolean;
    comments?: string;
    performedBy: string;
  }) {
    return prisma.labOrderTest.update({
      where: { id: labOrderTestId },
      data: {
        ...data,
        status: 'COMPLETED',
        performedAt: new Date(),
      },
    });
  }

  async verifyTestResult(labOrderTestId: string, verifiedBy: string) {
    return prisma.labOrderTest.update({
      where: { id: labOrderTestId },
      data: { verifiedBy, verifiedAt: new Date() },
    });
  }

  async getCriticalResults(hospitalId: string) {
    return prisma.labOrderTest.findMany({
      where: {
        isCritical: true,
        labOrder: { hospitalId },
        verifiedAt: null,
      },
      include: {
        labOrder: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, mrn: true, phone: true } },
          },
        },
        labTest: true,
      },
      orderBy: { performedAt: 'desc' },
    });
  }

  async getPendingOrders(hospitalId: string) {
    return prisma.labOrder.findMany({
      where: {
        hospitalId,
        status: { in: ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
        tests: { include: { labTest: true } },
      },
      orderBy: [{ priority: 'asc' }, { orderedAt: 'asc' }],
    });
  }

  async getLabStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, pendingOrders, completedToday, criticalResults] = await Promise.all([
      prisma.labOrder.count({ where: { hospitalId } }),
      prisma.labOrder.count({
        where: { hospitalId, status: { in: ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS'] } },
      }),
      prisma.labOrder.count({
        where: { hospitalId, completedAt: { gte: today } },
      }),
      prisma.labOrderTest.count({
        where: { isCritical: true, labOrder: { hospitalId }, verifiedAt: null },
      }),
    ]);

    return { totalOrders, pendingOrders, completedToday, criticalResults };
  }

  // ==================== AI SMART LAB ORDERING ====================

  // Test recommendation database based on clinical conditions
  private readonly testRecommendations: Record<string, {
    primaryTests: string[];
    secondaryTests: string[];
    panels: string[];
    rationale: string;
  }> = {
    'diabetes': {
      primaryTests: ['HbA1c', 'Fasting Glucose', 'Postprandial Glucose'],
      secondaryTests: ['Lipid Panel', 'Renal Function Panel', 'Urinalysis with Microalbumin'],
      panels: ['Diabetic Monitoring Panel'],
      rationale: 'Comprehensive diabetes assessment including glycemic control and complications screening',
    },
    'hypertension': {
      primaryTests: ['Basic Metabolic Panel', 'Lipid Panel'],
      secondaryTests: ['Urinalysis', 'TSH', 'ECG'],
      panels: ['Hypertension Workup Panel'],
      rationale: 'Evaluate target organ damage and secondary causes',
    },
    'anemia': {
      primaryTests: ['CBC with Differential', 'Reticulocyte Count', 'Iron Studies'],
      secondaryTests: ['Vitamin B12', 'Folate', 'Peripheral Smear'],
      panels: ['Anemia Panel'],
      rationale: 'Determine type and cause of anemia',
    },
    'infection': {
      primaryTests: ['CBC with Differential', 'CRP', 'Procalcitonin'],
      secondaryTests: ['Blood Culture', 'Urinalysis', 'Urine Culture'],
      panels: ['Sepsis Panel'],
      rationale: 'Assess infection severity and identify source',
    },
    'chest pain': {
      primaryTests: ['Troponin I/T', 'CK-MB', 'BNP/NT-proBNP'],
      secondaryTests: ['D-Dimer', 'CBC', 'Basic Metabolic Panel'],
      panels: ['Cardiac Markers Panel'],
      rationale: 'Rule out acute coronary syndrome and other cardiac conditions',
    },
    'liver disease': {
      primaryTests: ['Liver Function Tests (LFTs)', 'Albumin', 'PT/INR'],
      secondaryTests: ['Hepatitis Panel', 'Ammonia', 'AFP'],
      panels: ['Hepatic Function Panel'],
      rationale: 'Assess liver synthetic function and etiology',
    },
    'kidney disease': {
      primaryTests: ['Creatinine', 'BUN', 'eGFR', 'Urinalysis'],
      secondaryTests: ['Cystatin C', 'Urine Protein', 'Electrolytes'],
      panels: ['Renal Function Panel'],
      rationale: 'Evaluate kidney function and detect proteinuria',
    },
    'thyroid': {
      primaryTests: ['TSH', 'Free T4'],
      secondaryTests: ['Free T3', 'Thyroid Antibodies', 'Thyroglobulin'],
      panels: ['Thyroid Panel'],
      rationale: 'Assess thyroid function and autoimmune status',
    },
    'fever': {
      primaryTests: ['CBC with Differential', 'Blood Culture', 'CRP'],
      secondaryTests: ['Urinalysis', 'Chest X-ray', 'Malaria Smear'],
      panels: ['Fever Workup Panel'],
      rationale: 'Identify source of fever and infection markers',
    },
    'fatigue': {
      primaryTests: ['CBC', 'TSH', 'Iron Studies', 'Vitamin D'],
      secondaryTests: ['Vitamin B12', 'Cortisol', 'Liver Function'],
      panels: ['Fatigue Panel'],
      rationale: 'Screen for common causes of fatigue',
    },
    'pregnancy': {
      primaryTests: ['Beta-hCG', 'CBC', 'Blood Type & Rh'],
      secondaryTests: ['Rubella IgG', 'Hepatitis B', 'HIV', 'VDRL'],
      panels: ['Prenatal Panel'],
      rationale: 'Initial prenatal screening tests',
    },
    'pre-surgery': {
      primaryTests: ['CBC', 'PT/PTT/INR', 'Basic Metabolic Panel'],
      secondaryTests: ['Type & Screen', 'Urinalysis', 'Chest X-ray'],
      panels: ['Pre-Operative Panel'],
      rationale: 'Standard pre-surgical assessment',
    },
    'general wellness': {
      primaryTests: ['CBC', 'Comprehensive Metabolic Panel', 'Lipid Panel'],
      secondaryTests: ['TSH', 'Urinalysis', 'Vitamin D'],
      panels: ['Annual Wellness Panel'],
      rationale: 'Routine health screening',
    },
  };

  // Reference ranges with interpretation
  private readonly referenceRanges: Record<string, {
    normalRange: string;
    unit: string;
    criticalLow?: number;
    criticalHigh?: number;
    interpretation: Record<string, string>;
  }> = {
    'hemoglobin': {
      normalRange: 'Male: 13.5-17.5, Female: 12.0-16.0',
      unit: 'g/dL',
      criticalLow: 7,
      criticalHigh: 20,
      interpretation: {
        'very_low': 'Severe anemia - consider transfusion',
        'low': 'Anemia - investigate cause',
        'normal': 'Within normal limits',
        'high': 'Polycythemia - investigate cause',
      },
    },
    'glucose_fasting': {
      normalRange: '70-99',
      unit: 'mg/dL',
      criticalLow: 40,
      criticalHigh: 500,
      interpretation: {
        'very_low': 'Severe hypoglycemia - immediate treatment needed',
        'low': 'Hypoglycemia - monitor and treat',
        'normal': 'Normal fasting glucose',
        'prediabetes': 'Impaired fasting glucose (100-125)',
        'diabetes': 'Diabetic range (≥126)',
      },
    },
    'hba1c': {
      normalRange: '<5.7',
      unit: '%',
      interpretation: {
        'normal': '<5.7% - Normal',
        'prediabetes': '5.7-6.4% - Prediabetes',
        'diabetes': '≥6.5% - Diabetes',
        'well_controlled': '6.5-7.0% - Diabetes, well controlled',
        'poorly_controlled': '>7.0% - Diabetes, needs optimization',
      },
    },
    'creatinine': {
      normalRange: 'Male: 0.7-1.3, Female: 0.6-1.1',
      unit: 'mg/dL',
      criticalHigh: 10,
      interpretation: {
        'normal': 'Normal kidney function',
        'mild': 'Mildly elevated - check eGFR',
        'moderate': 'Moderately elevated - CKD likely',
        'severe': 'Severely elevated - urgent nephrology consult',
      },
    },
    'troponin': {
      normalRange: '<0.04',
      unit: 'ng/mL',
      criticalHigh: 0.4,
      interpretation: {
        'negative': '<0.04 - No myocardial injury',
        'elevated': '0.04-0.4 - Possible myocardial injury',
        'highly_elevated': '>0.4 - Significant myocardial injury/NSTEMI',
      },
    },
    'tsh': {
      normalRange: '0.4-4.0',
      unit: 'mIU/L',
      interpretation: {
        'low': '<0.4 - Hyperthyroidism suspected',
        'normal': 'Euthyroid',
        'high': '>4.0 - Hypothyroidism suspected',
      },
    },
    'wbc': {
      normalRange: '4,500-11,000',
      unit: '/μL',
      criticalLow: 2000,
      criticalHigh: 30000,
      interpretation: {
        'low': 'Leukopenia - infection risk, investigate cause',
        'normal': 'Within normal limits',
        'high': 'Leukocytosis - infection, inflammation, or malignancy',
        'very_high': 'Marked leukocytosis - consider leukemia',
      },
    },
    'potassium': {
      normalRange: '3.5-5.0',
      unit: 'mEq/L',
      criticalLow: 2.5,
      criticalHigh: 6.5,
      interpretation: {
        'critical_low': 'Severe hypokalemia - cardiac risk',
        'low': 'Hypokalemia - supplement potassium',
        'normal': 'Within normal limits',
        'high': 'Hyperkalemia - monitor ECG',
        'critical_high': 'Severe hyperkalemia - immediate treatment',
      },
    },
  };

  // Smart test ordering based on symptoms/diagnosis
  smartOrderRecommendation(params: {
    symptoms?: string[];
    diagnosis?: string;
    chiefComplaint?: string;
    patientAge?: number;
    gender?: 'MALE' | 'FEMALE';
    existingConditions?: string[];
  }): {
    recommendedTests: {
      name: string;
      priority: 'STAT' | 'URGENT' | 'ROUTINE';
      rationale: string;
    }[];
    recommendedPanels: string[];
    additionalTests: string[];
    clinicalGuidance: string[];
    estimatedTurnaround: string;
  } {
    const recommendedTests: { name: string; priority: 'STAT' | 'URGENT' | 'ROUTINE'; rationale: string }[] = [];
    const recommendedPanels: string[] = [];
    const additionalTests: string[] = [];
    const clinicalGuidance: string[] = [];

    // Combine all input text for keyword matching
    const allText = [
      ...(params.symptoms || []),
      params.diagnosis || '',
      params.chiefComplaint || '',
      ...(params.existingConditions || []),
    ].join(' ').toLowerCase();

    // Match against recommendation database
    const matchedConditions: string[] = [];
    for (const [condition, recommendations] of Object.entries(this.testRecommendations)) {
      if (allText.includes(condition)) {
        matchedConditions.push(condition);

        // Add primary tests with urgency
        recommendations.primaryTests.forEach(test => {
          const existingTest = recommendedTests.find(t => t.name === test);
          if (!existingTest) {
            recommendedTests.push({
              name: test,
              priority: condition === 'chest pain' || condition === 'infection' ? 'STAT' : 'ROUTINE',
              rationale: recommendations.rationale,
            });
          }
        });

        // Add panels
        recommendations.panels.forEach(panel => {
          if (!recommendedPanels.includes(panel)) {
            recommendedPanels.push(panel);
          }
        });

        // Add secondary tests
        recommendations.secondaryTests.forEach(test => {
          if (!additionalTests.includes(test) && !recommendedTests.find(t => t.name === test)) {
            additionalTests.push(test);
          }
        });

        clinicalGuidance.push(recommendations.rationale);
      }
    }

    // Age-specific recommendations
    if (params.patientAge) {
      if (params.patientAge >= 50 && params.gender === 'MALE') {
        additionalTests.push('PSA');
        clinicalGuidance.push('Consider PSA screening for males over 50');
      }
      if (params.patientAge >= 45) {
        if (!recommendedTests.find(t => t.name.includes('Lipid'))) {
          additionalTests.push('Lipid Panel');
          clinicalGuidance.push('Cardiovascular risk screening recommended');
        }
      }
      if (params.patientAge >= 65) {
        additionalTests.push('Vitamin D');
        clinicalGuidance.push('Vitamin D deficiency common in elderly');
      }
    }

    // Default recommendation if no matches
    if (recommendedTests.length === 0) {
      recommendedTests.push(
        { name: 'CBC with Differential', priority: 'ROUTINE', rationale: 'Basic hematologic assessment' },
        { name: 'Comprehensive Metabolic Panel', priority: 'ROUTINE', rationale: 'Metabolic and organ function screening' }
      );
      recommendedPanels.push('Basic Health Panel');
      clinicalGuidance.push('Standard initial workup - consider additional tests based on clinical presentation');
    }

    // Estimate turnaround
    const hasStat = recommendedTests.some(t => t.priority === 'STAT');
    const estimatedTurnaround = hasStat ? '1-2 hours for STAT, 4-6 hours for routine' : '4-24 hours';

    return {
      recommendedTests,
      recommendedPanels,
      additionalTests: additionalTests.slice(0, 5), // Limit to top 5
      clinicalGuidance: [...new Set(clinicalGuidance)],
      estimatedTurnaround,
    };
  }

  // Interpret lab result
  interpretResult(params: {
    testName: string;
    value: number;
    unit?: string;
    patientAge?: number;
    gender?: 'MALE' | 'FEMALE';
  }): {
    interpretation: string;
    status: 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_LOW' | 'CRITICAL_HIGH';
    referenceRange: string;
    clinicalSignificance: string;
    recommendedActions: string[];
    reflexTests: string[];
  } {
    const testKey = params.testName.toLowerCase().replace(/\s+/g, '_');
    const reference = this.referenceRanges[testKey];

    let status: 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_LOW' | 'CRITICAL_HIGH' = 'NORMAL';
    let interpretation = 'Unable to interpret - test not in database';
    let clinicalSignificance = '';
    const recommendedActions: string[] = [];
    const reflexTests: string[] = [];

    if (!reference) {
      return {
        interpretation,
        status,
        referenceRange: 'Not available',
        clinicalSignificance: 'Manual review required',
        recommendedActions: ['Consult reference laboratory manual'],
        reflexTests: [],
      };
    }

    // Determine status based on reference ranges
    if (reference.criticalLow && params.value < reference.criticalLow) {
      status = 'CRITICAL_LOW';
      interpretation = reference.interpretation['critical_low'] || reference.interpretation['very_low'] || 'Critically low value';
      recommendedActions.push('URGENT: Notify physician immediately');
      recommendedActions.push('Repeat test to confirm');
    } else if (reference.criticalHigh && params.value > reference.criticalHigh) {
      status = 'CRITICAL_HIGH';
      interpretation = reference.interpretation['critical_high'] || reference.interpretation['very_high'] || 'Critically high value';
      recommendedActions.push('URGENT: Notify physician immediately');
      recommendedActions.push('Repeat test to confirm');
    } else {
      // Parse normal range and compare
      const rangeMatch = reference.normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
      if (rangeMatch) {
        let lowNormal = parseFloat(rangeMatch[1]);
        let highNormal = parseFloat(rangeMatch[2]);

        // Adjust for gender if applicable
        if (reference.normalRange.includes('Male:') && params.gender === 'MALE') {
          const maleMatch = reference.normalRange.match(/Male:\s*(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
          if (maleMatch) {
            lowNormal = parseFloat(maleMatch[1]);
            highNormal = parseFloat(maleMatch[2]);
          }
        } else if (reference.normalRange.includes('Female:') && params.gender === 'FEMALE') {
          const femaleMatch = reference.normalRange.match(/Female:\s*(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
          if (femaleMatch) {
            lowNormal = parseFloat(femaleMatch[1]);
            highNormal = parseFloat(femaleMatch[2]);
          }
        }

        if (params.value < lowNormal) {
          status = 'LOW';
          interpretation = reference.interpretation['low'] || 'Below normal range';
        } else if (params.value > highNormal) {
          status = 'HIGH';
          interpretation = reference.interpretation['high'] || 'Above normal range';
        } else {
          status = 'NORMAL';
          interpretation = reference.interpretation['normal'] || 'Within normal limits';
        }
      }
    }

    // Add specific clinical significance and reflex tests
    switch (testKey) {
      case 'hemoglobin':
        if (status === 'LOW') {
          clinicalSignificance = 'Anemia detected - requires further workup';
          reflexTests.push('Reticulocyte Count', 'Iron Studies', 'Vitamin B12', 'Folate');
          recommendedActions.push('Order anemia workup panel');
        }
        break;
      case 'glucose_fasting':
        if (params.value >= 100 && params.value < 126) {
          interpretation = reference.interpretation['prediabetes'];
          clinicalSignificance = 'Prediabetes - lifestyle modifications recommended';
          reflexTests.push('HbA1c', 'Glucose Tolerance Test');
        } else if (params.value >= 126) {
          interpretation = reference.interpretation['diabetes'];
          clinicalSignificance = 'Diabetes likely - confirm with repeat testing';
          reflexTests.push('HbA1c', 'Lipid Panel', 'Kidney Function Panel');
        }
        break;
      case 'troponin':
        if (params.value > 0.04) {
          clinicalSignificance = 'Myocardial injury detected - cardiology evaluation needed';
          reflexTests.push('Serial Troponin (q3-6h)', 'CK-MB', 'BNP');
          recommendedActions.push('STAT cardiology consult');
          recommendedActions.push('Serial troponin measurement');
        }
        break;
      case 'tsh':
        if (status !== 'NORMAL') {
          reflexTests.push('Free T4', 'Free T3');
          if (status === 'HIGH') {
            clinicalSignificance = 'Hypothyroidism suspected';
            reflexTests.push('Thyroid Antibodies');
          } else {
            clinicalSignificance = 'Hyperthyroidism suspected';
          }
        }
        break;
    }

    return {
      interpretation,
      status,
      referenceRange: `${reference.normalRange} ${reference.unit}`,
      clinicalSignificance: clinicalSignificance || interpretation,
      recommendedActions: recommendedActions.length > 0 ? recommendedActions : ['Standard follow-up'],
      reflexTests,
    };
  }
}

export const laboratoryService = new LaboratoryService();
