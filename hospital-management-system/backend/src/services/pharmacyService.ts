import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';

export class PharmacyService {
  // Drug Management
  async createDrug(data: {
    name: string;
    genericName: string;
    brandName?: string;
    code: string;
    category: string;
    dosageForm: string;
    strength: string;
    manufacturer?: string;
    price: number;
    reorderLevel?: number;
    isControlled?: boolean;
    requiresPrescription?: boolean;
    sideEffects?: string[];
    contraindications?: string[];
    interactions?: string[];
  }) {
    return prisma.drug.create({ data });
  }

  async getAllDrugs(params: { search?: string; category?: string; isActive?: boolean }) {
    const where: any = {};
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { genericName: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params.category) where.category = params.category;
    if (params.isActive !== undefined) where.isActive = params.isActive;

    return prisma.drug.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        inventory: { where: { quantity: { gt: 0 } } },
      },
    });
  }

  async getDrugById(id: string) {
    const drug = await prisma.drug.findUnique({
      where: { id },
      include: { inventory: true },
    });
    if (!drug) throw new NotFoundError('Drug not found');
    return drug;
  }

  async updateDrug(id: string, data: Partial<{
    name: string;
    genericName: string;
    brandName?: string;
    category: string;
    dosageForm: string;
    strength: string;
    manufacturer?: string;
    price: number;
    reorderLevel?: number;
    isControlled?: boolean;
    sideEffects?: string[];
    contraindications?: string[];
    interactions?: string[];
    isActive: boolean;
  }>) {
    return prisma.drug.update({ where: { id }, data });
  }

  // Inventory Management
  async addInventory(data: {
    drugId: string;
    batchNumber: string;
    quantity: number;
    expiryDate: Date;
    location: string;
    costPrice: number;
    sellingPrice: number;
    supplierId?: string;
  }) {
    return prisma.drugInventory.create({
      data: { ...data, receivedDate: new Date() },
      include: { drug: true },
    });
  }

  async updateInventoryQuantity(id: string, quantity: number) {
    return prisma.drugInventory.update({
      where: { id },
      data: { quantity },
    });
  }

  async getLowStockDrugs(threshold?: number) {
    const drugs = await prisma.drug.findMany({
      where: { isActive: true },
      include: {
        inventory: { where: { quantity: { gt: 0 }, expiryDate: { gt: new Date() } } },
      },
    });

    return drugs.filter(drug => {
      const totalStock = drug.inventory.reduce((sum, inv) => sum + inv.quantity, 0);
      return totalStock <= (threshold || drug.reorderLevel);
    });
  }

  async getExpiringDrugs(days: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return prisma.drugInventory.findMany({
      where: {
        expiryDate: { lte: futureDate, gt: new Date() },
        quantity: { gt: 0 },
      },
      include: { drug: true },
      orderBy: { expiryDate: 'asc' },
    });
  }

  // Prescription Dispensing
  async getPendingPrescriptions(hospitalId: string) {
    return prisma.prescription.findMany({
      where: {
        status: 'ACTIVE',
        patient: { hospitalId },
        medications: { some: { isDispensed: false } },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
        doctor: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        medications: {
          where: { isDispensed: false },
          include: { drug: true },
        },
      },
      orderBy: { prescriptionDate: 'asc' },
    });
  }

  async dispenseMedication(medicationId: string, dispensedBy: string) {
    return prisma.prescriptionMedication.update({
      where: { id: medicationId },
      data: { isDispensed: true, dispensedAt: new Date(), dispensedBy },
    });
  }

  async dispensePrescription(prescriptionId: string, dispensedBy: string) {
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { medications: { where: { isDispensed: false } } },
    });

    if (!prescription) throw new NotFoundError('Prescription not found');

    // Dispense all medications
    await prisma.prescriptionMedication.updateMany({
      where: { prescriptionId, isDispensed: false },
      data: { isDispensed: true, dispensedAt: new Date(), dispensedBy },
    });

    // Check if all medications are dispensed
    const remaining = await prisma.prescriptionMedication.count({
      where: { prescriptionId, isDispensed: false },
    });

    if (remaining === 0) {
      await prisma.prescription.update({
        where: { id: prescriptionId },
        data: { status: 'COMPLETED' },
      });
    }

    return prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: { medications: { include: { drug: true } } },
    });
  }

  // Comprehensive Drug Interaction Database
  private readonly interactionDatabase: Record<string, { interactsWith: string[]; severity: string; description: string }[]> = {
    'warfarin': [
      { interactsWith: ['aspirin', 'ibuprofen', 'naproxen'], severity: 'HIGH', description: 'Increased risk of bleeding' },
      { interactsWith: ['amiodarone'], severity: 'HIGH', description: 'Increased anticoagulant effect' },
      { interactsWith: ['vitamin k', 'phytonadione'], severity: 'HIGH', description: 'Reduced anticoagulant effect' },
      { interactsWith: ['fluconazole', 'metronidazole'], severity: 'MODERATE', description: 'Increased INR' },
    ],
    'metformin': [
      { interactsWith: ['contrast dye', 'iodinated contrast'], severity: 'HIGH', description: 'Risk of lactic acidosis' },
      { interactsWith: ['alcohol'], severity: 'MODERATE', description: 'Increased risk of hypoglycemia' },
    ],
    'lisinopril': [
      { interactsWith: ['potassium', 'spironolactone'], severity: 'HIGH', description: 'Risk of hyperkalemia' },
      { interactsWith: ['nsaids', 'ibuprofen', 'naproxen'], severity: 'MODERATE', description: 'Reduced antihypertensive effect' },
      { interactsWith: ['lithium'], severity: 'MODERATE', description: 'Increased lithium levels' },
    ],
    'simvastatin': [
      { interactsWith: ['erythromycin', 'clarithromycin'], severity: 'HIGH', description: 'Increased risk of rhabdomyolysis' },
      { interactsWith: ['grapefruit'], severity: 'MODERATE', description: 'Increased statin levels' },
      { interactsWith: ['gemfibrozil', 'fenofibrate'], severity: 'HIGH', description: 'Increased myopathy risk' },
    ],
    'amoxicillin': [
      { interactsWith: ['methotrexate'], severity: 'MODERATE', description: 'Increased methotrexate toxicity' },
      { interactsWith: ['warfarin'], severity: 'MODERATE', description: 'Increased INR' },
    ],
    'omeprazole': [
      { interactsWith: ['clopidogrel'], severity: 'HIGH', description: 'Reduced clopidogrel efficacy' },
      { interactsWith: ['methotrexate'], severity: 'MODERATE', description: 'Increased methotrexate levels' },
    ],
    'aspirin': [
      { interactsWith: ['warfarin', 'heparin'], severity: 'HIGH', description: 'Increased bleeding risk' },
      { interactsWith: ['ibuprofen'], severity: 'MODERATE', description: 'Reduced cardioprotective effect' },
      { interactsWith: ['methotrexate'], severity: 'HIGH', description: 'Increased methotrexate toxicity' },
    ],
    'ibuprofen': [
      { interactsWith: ['warfarin', 'aspirin'], severity: 'HIGH', description: 'Increased bleeding risk' },
      { interactsWith: ['lisinopril', 'losartan', 'ace inhibitors'], severity: 'MODERATE', description: 'Reduced BP control' },
      { interactsWith: ['lithium'], severity: 'MODERATE', description: 'Increased lithium levels' },
    ],
    'ciprofloxacin': [
      { interactsWith: ['theophylline'], severity: 'HIGH', description: 'Increased theophylline toxicity' },
      { interactsWith: ['antacids', 'calcium', 'iron'], severity: 'MODERATE', description: 'Reduced absorption' },
      { interactsWith: ['warfarin'], severity: 'MODERATE', description: 'Increased INR' },
    ],
    'digoxin': [
      { interactsWith: ['amiodarone', 'verapamil'], severity: 'HIGH', description: 'Increased digoxin toxicity' },
      { interactsWith: ['diuretics'], severity: 'MODERATE', description: 'Hypokalemia increases toxicity risk' },
    ],
    'fluoxetine': [
      { interactsWith: ['maoi', 'phenelzine', 'selegiline'], severity: 'CRITICAL', description: 'Serotonin syndrome risk' },
      { interactsWith: ['tramadol'], severity: 'HIGH', description: 'Increased seizure risk' },
      { interactsWith: ['warfarin'], severity: 'MODERATE', description: 'Increased bleeding risk' },
    ],
  };

  // Drug Interactions - Enhanced with comprehensive database
  async checkDrugInteractions(drugIds: string[]) {
    const drugs = await prisma.drug.findMany({
      where: { id: { in: drugIds } },
    });

    return this.analyzeDrugInteractions(drugs.map(d => ({
      name: d.name,
      genericName: d.genericName,
      storedInteractions: d.interactions,
    })));
  }

  // Analyze drug interactions by name
  analyzeDrugInteractions(drugs: { name: string; genericName: string; storedInteractions?: string[] }[]): {
    interactions: {
      drug1: string;
      drug2: string;
      severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
      description: string;
      recommendation: string;
    }[];
    summary: { critical: number; high: number; moderate: number; low: number; total: number };
    overallRisk: string;
  } {
    const interactions: {
      drug1: string;
      drug2: string;
      severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
      description: string;
      recommendation: string;
    }[] = [];

    const drugNames = drugs.map(d => [d.name.toLowerCase(), d.genericName.toLowerCase()]).flat();

    // Check each drug pair against the database
    for (let i = 0; i < drugs.length; i++) {
      const drug1 = drugs[i];
      const drug1Names = [drug1.name.toLowerCase(), drug1.genericName.toLowerCase()];

      for (let j = i + 1; j < drugs.length; j++) {
        const drug2 = drugs[j];
        const drug2Names = [drug2.name.toLowerCase(), drug2.genericName.toLowerCase()];

        // Check drug1 interactions
        for (const name1 of drug1Names) {
          const dbInteractions = this.interactionDatabase[name1];
          if (dbInteractions) {
            for (const interaction of dbInteractions) {
              if (interaction.interactsWith.some(iw => drug2Names.some(n2 => n2.includes(iw) || iw.includes(n2)))) {
                interactions.push({
                  drug1: drug1.name,
                  drug2: drug2.name,
                  severity: interaction.severity as any,
                  description: interaction.description,
                  recommendation: this.getInteractionRecommendation(interaction.severity),
                });
              }
            }
          }
        }

        // Check drug2 interactions
        for (const name2 of drug2Names) {
          const dbInteractions = this.interactionDatabase[name2];
          if (dbInteractions) {
            for (const interaction of dbInteractions) {
              if (interaction.interactsWith.some(iw => drug1Names.some(n1 => n1.includes(iw) || iw.includes(n1)))) {
                // Avoid duplicates
                if (!interactions.find(int => int.drug1 === drug2.name && int.drug2 === drug1.name)) {
                  interactions.push({
                    drug1: drug2.name,
                    drug2: drug1.name,
                    severity: interaction.severity as any,
                    description: interaction.description,
                    recommendation: this.getInteractionRecommendation(interaction.severity),
                  });
                }
              }
            }
          }
        }

        // Also check stored interactions from database
        if (drug1.storedInteractions?.some(int => drug2Names.some(n => int.toLowerCase().includes(n)))) {
          if (!interactions.find(int => int.drug1 === drug1.name && int.drug2 === drug2.name)) {
            interactions.push({
              drug1: drug1.name,
              drug2: drug2.name,
              severity: 'MODERATE',
              description: `${drug1.name} may interact with ${drug2.name}`,
              recommendation: 'Monitor patient closely',
            });
          }
        }
      }
    }

    // Calculate summary
    const summary = {
      critical: interactions.filter(i => i.severity === 'CRITICAL').length,
      high: interactions.filter(i => i.severity === 'HIGH').length,
      moderate: interactions.filter(i => i.severity === 'MODERATE').length,
      low: interactions.filter(i => i.severity === 'LOW').length,
      total: interactions.length,
    };

    // Determine overall risk
    let overallRisk = 'LOW';
    if (summary.critical > 0) overallRisk = 'CRITICAL - DO NOT COMBINE';
    else if (summary.high > 0) overallRisk = 'HIGH - Requires close monitoring or alternative';
    else if (summary.moderate > 0) overallRisk = 'MODERATE - Monitor patient';
    else if (summary.total === 0) overallRisk = 'NO INTERACTIONS FOUND';

    return { interactions, summary, overallRisk };
  }

  private getInteractionRecommendation(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return 'CONTRAINDICATED - Do not use together. Find alternative therapy.';
      case 'HIGH': return 'Consider alternative medication or close monitoring with dose adjustment.';
      case 'MODERATE': return 'Monitor patient for adverse effects. Adjust timing if possible.';
      default: return 'Be aware of potential interaction. Monitor as needed.';
    }
  }

  // ==================== DOSAGE CALCULATOR ====================
  calculateDosage(params: {
    drugName: string;
    indication: string;
    patientWeight?: number; // kg
    patientAge?: number; // years
    renalFunction?: 'normal' | 'mild' | 'moderate' | 'severe' | 'dialysis'; // eGFR based
    hepaticFunction?: 'normal' | 'mild' | 'moderate' | 'severe';
    isPregnant?: boolean;
    isBreastfeeding?: boolean;
  }): {
    recommendedDose: string;
    frequency: string;
    maxDailyDose: string;
    adjustments: string[];
    warnings: string[];
    calculations: string[];
  } {
    const adjustments: string[] = [];
    const warnings: string[] = [];
    const calculations: string[] = [];

    const drugLower = params.drugName.toLowerCase();
    const isChild = params.patientAge && params.patientAge < 18;
    const isElderly = params.patientAge && params.patientAge >= 65;
    const weight = params.patientWeight || 70; // Default adult weight

    // Drug-specific dosing
    let recommendedDose = '';
    let frequency = '';
    let maxDailyDose = '';

    // Common medications dosing database
    const dosingInfo = this.getDrugDosingInfo(drugLower);

    if (dosingInfo) {
      recommendedDose = dosingInfo.standardDose;
      frequency = dosingInfo.frequency;
      maxDailyDose = dosingInfo.maxDaily;

      // Pediatric dosing (weight-based)
      if (isChild && dosingInfo.pediatricDosePerKg) {
        const calculatedDose = weight * dosingInfo.pediatricDosePerKg;
        const adjustedDose = Math.min(calculatedDose, dosingInfo.pediatricMaxDose || calculatedDose);
        recommendedDose = `${adjustedDose.toFixed(1)} mg`;
        calculations.push(`Pediatric dose: ${weight}kg × ${dosingInfo.pediatricDosePerKg}mg/kg = ${calculatedDose.toFixed(1)}mg`);
        if (calculatedDose > (dosingInfo.pediatricMaxDose || Infinity)) {
          adjustments.push(`Capped at pediatric max dose of ${dosingInfo.pediatricMaxDose}mg`);
        }
      }

      // Elderly adjustments
      if (isElderly) {
        if (dosingInfo.elderlyAdjustment) {
          adjustments.push(dosingInfo.elderlyAdjustment);
        } else {
          adjustments.push('Consider starting at lower dose in elderly patients');
        }
      }

      // Renal adjustments
      if (params.renalFunction && params.renalFunction !== 'normal' && dosingInfo.renalAdjustments) {
        const renalAdj = dosingInfo.renalAdjustments[params.renalFunction];
        if (renalAdj) {
          adjustments.push(`Renal impairment (${params.renalFunction}): ${renalAdj}`);
        }
      }

      // Hepatic adjustments
      if (params.hepaticFunction && params.hepaticFunction !== 'normal' && dosingInfo.hepaticAdjustments) {
        const hepaticAdj = dosingInfo.hepaticAdjustments[params.hepaticFunction];
        if (hepaticAdj) {
          adjustments.push(`Hepatic impairment (${params.hepaticFunction}): ${hepaticAdj}`);
        }
      }

      // Pregnancy/Breastfeeding warnings
      if (params.isPregnant) {
        warnings.push(dosingInfo.pregnancyWarning || 'Consult with healthcare provider before use during pregnancy');
      }
      if (params.isBreastfeeding) {
        warnings.push(dosingInfo.lactationWarning || 'Consult with healthcare provider before use while breastfeeding');
      }

      // Additional warnings
      if (dosingInfo.warnings) {
        warnings.push(...dosingInfo.warnings);
      }
    } else {
      // Generic fallback
      recommendedDose = 'Consult drug reference';
      frequency = 'Per prescriber';
      maxDailyDose = 'Per drug guidelines';
      warnings.push('Drug not in dosing database - verify with official drug reference');

      if (isChild) {
        warnings.push('Pediatric dosing requires weight-based calculation - consult pediatric reference');
      }
    }

    return {
      recommendedDose,
      frequency,
      maxDailyDose,
      adjustments,
      warnings,
      calculations,
    };
  }

  private getDrugDosingInfo(drugName: string): {
    standardDose: string;
    frequency: string;
    maxDaily: string;
    pediatricDosePerKg?: number;
    pediatricMaxDose?: number;
    elderlyAdjustment?: string;
    renalAdjustments?: Record<string, string>;
    hepaticAdjustments?: Record<string, string>;
    pregnancyWarning?: string;
    lactationWarning?: string;
    warnings?: string[];
  } | null {
    const database: Record<string, any> = {
      'amoxicillin': {
        standardDose: '500mg',
        frequency: 'Every 8 hours',
        maxDaily: '3000mg',
        pediatricDosePerKg: 25,
        pediatricMaxDose: 500,
        renalAdjustments: {
          mild: 'No adjustment needed',
          moderate: 'Reduce to every 12 hours',
          severe: 'Reduce to every 24 hours or 250mg every 12 hours',
          dialysis: '250mg after dialysis session',
        },
        pregnancyWarning: 'Category B - Generally considered safe',
        lactationWarning: 'Compatible with breastfeeding',
      },
      'metformin': {
        standardDose: '500mg',
        frequency: 'Twice daily with meals',
        maxDaily: '2550mg',
        elderlyAdjustment: 'Start with 500mg once daily, titrate slowly',
        renalAdjustments: {
          mild: 'No adjustment needed (eGFR 45-60)',
          moderate: 'Max 1000mg/day (eGFR 30-45)',
          severe: 'CONTRAINDICATED (eGFR <30)',
          dialysis: 'CONTRAINDICATED',
        },
        hepaticAdjustments: {
          mild: 'Use with caution',
          moderate: 'Avoid use',
          severe: 'CONTRAINDICATED',
        },
        warnings: ['Hold before contrast procedures', 'Monitor for lactic acidosis'],
        pregnancyWarning: 'Category B - May be used with caution',
      },
      'lisinopril': {
        standardDose: '10mg',
        frequency: 'Once daily',
        maxDaily: '40mg',
        elderlyAdjustment: 'Start with 2.5-5mg once daily',
        renalAdjustments: {
          mild: 'Start with 5mg',
          moderate: 'Start with 2.5mg',
          severe: 'Start with 2.5mg, max 40mg',
          dialysis: '2.5mg on dialysis days',
        },
        pregnancyWarning: 'CONTRAINDICATED - Risk of fetal harm',
        lactationWarning: 'Not recommended during breastfeeding',
        warnings: ['Monitor potassium levels', 'Risk of angioedema'],
      },
      'ibuprofen': {
        standardDose: '400mg',
        frequency: 'Every 6-8 hours',
        maxDaily: '3200mg (prescription), 1200mg (OTC)',
        pediatricDosePerKg: 10,
        pediatricMaxDose: 400,
        elderlyAdjustment: 'Use lowest effective dose for shortest duration',
        renalAdjustments: {
          mild: 'Use with caution',
          moderate: 'Use with caution, lowest dose',
          severe: 'AVOID',
          dialysis: 'Not dialyzable, avoid if possible',
        },
        hepaticAdjustments: {
          mild: 'Use with caution',
          moderate: 'Reduce dose',
          severe: 'CONTRAINDICATED',
        },
        pregnancyWarning: 'AVOID in third trimester - risk of premature closure of ductus arteriosus',
        warnings: ['GI bleeding risk', 'Cardiovascular risk with prolonged use'],
      },
      'omeprazole': {
        standardDose: '20mg',
        frequency: 'Once daily before breakfast',
        maxDaily: '40mg',
        elderlyAdjustment: 'No routine adjustment needed',
        hepaticAdjustments: {
          mild: 'No adjustment',
          moderate: 'Max 20mg/day',
          severe: 'Max 10mg/day',
        },
        warnings: ['Long-term use: monitor magnesium, B12', 'Risk of C. diff infection'],
        pregnancyWarning: 'Category C - Use only if benefit outweighs risk',
      },
      'acetaminophen': {
        standardDose: '650-1000mg',
        frequency: 'Every 4-6 hours as needed',
        maxDaily: '4000mg (3000mg if liver disease or alcohol use)',
        pediatricDosePerKg: 15,
        pediatricMaxDose: 1000,
        elderlyAdjustment: 'Max 3000mg/day recommended',
        hepaticAdjustments: {
          mild: 'Max 3000mg/day',
          moderate: 'Max 2000mg/day',
          severe: 'AVOID or max 2000mg/day with close monitoring',
        },
        warnings: ['Hepatotoxicity risk with overdose', 'Check for acetaminophen in combination products'],
      },
      'atorvastatin': {
        standardDose: '10-20mg',
        frequency: 'Once daily (any time)',
        maxDaily: '80mg',
        elderlyAdjustment: 'No specific adjustment needed',
        renalAdjustments: {
          mild: 'No adjustment',
          moderate: 'No adjustment',
          severe: 'No adjustment needed',
        },
        hepaticAdjustments: {
          mild: 'Use with caution',
          moderate: 'CONTRAINDICATED',
          severe: 'CONTRAINDICATED',
        },
        pregnancyWarning: 'CONTRAINDICATED - Risk of fetal harm',
        lactationWarning: 'CONTRAINDICATED during breastfeeding',
        warnings: ['Monitor LFTs', 'Report muscle pain (myopathy risk)'],
      },
      'amlodipine': {
        standardDose: '5mg',
        frequency: 'Once daily',
        maxDaily: '10mg',
        elderlyAdjustment: 'Start with 2.5mg',
        hepaticAdjustments: {
          mild: 'Start with 2.5mg',
          moderate: 'Start with 2.5mg',
          severe: 'Start with 2.5mg, titrate slowly',
        },
        warnings: ['May cause peripheral edema', 'Avoid grapefruit juice'],
      },
    };

    // Check for exact match or partial match
    for (const [key, value] of Object.entries(database)) {
      if (drugName.includes(key) || key.includes(drugName)) {
        return value;
      }
    }

    return null;
  }

  async getPharmacyStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pendingPrescriptions, dispensedToday, lowStockCount, expiringCount] = await Promise.all([
      prisma.prescription.count({
        where: {
          status: 'ACTIVE',
          patient: { hospitalId },
          medications: { some: { isDispensed: false } },
        },
      }),
      prisma.prescriptionMedication.count({
        where: { dispensedAt: { gte: today } },
      }),
      this.getLowStockDrugs().then(drugs => drugs.length),
      this.getExpiringDrugs(30).then(inv => inv.length),
    ]);

    return { pendingPrescriptions, dispensedToday, lowStockCount, expiringCount };
  }
}

export const pharmacyService = new PharmacyService();
