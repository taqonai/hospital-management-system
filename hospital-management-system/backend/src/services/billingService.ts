import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { Decimal } from '@prisma/client/runtime/library';

export class BillingService {
  private generateInvoiceNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `INV-${timestamp}${random}`;
  }

  private generateClaimNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `CLM-${timestamp}${random}`;
  }

  async createInvoice(hospitalId: string, data: {
    patientId: string;
    items: Array<{
      description: string;
      category: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
    }>;
    discount?: number;
    tax?: number;
    dueDate?: Date;
    notes?: string;
  }) {
    const invoiceNumber = this.generateInvoiceNumber();

    // Calculate totals
    let subtotal = 0;
    const itemsWithTotal = data.items.map(item => {
      const itemDiscount = item.discount || 0;
      const totalPrice = (item.unitPrice * item.quantity) - itemDiscount;
      subtotal += totalPrice;
      return { ...item, totalPrice, discount: itemDiscount };
    });

    const discount = data.discount || 0;
    const tax = data.tax || 0;
    const totalAmount = subtotal - discount + tax;

    return prisma.invoice.create({
      data: {
        hospitalId,
        patientId: data.patientId,
        invoiceNumber,
        dueDate: data.dueDate,
        subtotal,
        discount,
        tax,
        totalAmount,
        balanceAmount: totalAmount,
        notes: data.notes,
        items: {
          create: itemsWithTotal,
        },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
        items: true,
      },
    });
  }

  async getInvoices(hospitalId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    patientId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page = 1, limit = 20, status, patientId, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;
    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = new Date(startDate);
      if (endDate) where.invoiceDate.lte = new Date(endDate);
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          items: true,
          payments: true,
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return { invoices, total, page, limit };
  }

  async getInvoiceById(id: string, hospitalId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id, hospitalId },
      include: {
        patient: true,
        items: true,
        payments: true,
        claims: true,
      },
    });

    if (!invoice) throw new NotFoundError('Invoice not found');
    return invoice;
  }

  async addPayment(invoiceId: string, data: {
    amount: number;
    paymentMethod: 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'UPI' | 'NET_BANKING' | 'INSURANCE' | 'CHEQUE';
    referenceNumber?: string;
    notes?: string;
    receivedBy: string;
  }) {
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Invoice not found');

    const payment = await prisma.payment.create({
      data: { invoiceId, ...data },
    });

    // Update invoice balance
    const newPaidAmount = Number(invoice.paidAmount) + data.amount;
    const newBalance = Number(invoice.totalAmount) - newPaidAmount;

    let newStatus = invoice.status;
    if (newBalance <= 0) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIALLY_PAID';
    }

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: newBalance > 0 ? newBalance : 0,
        status: newStatus,
      },
    });

    return payment;
  }

  async submitInsuranceClaim(invoiceId: string, data: {
    insuranceProvider: string;
    policyNumber: string;
    claimAmount: number;
    notes?: string;
  }) {
    const claimNumber = this.generateClaimNumber();

    return prisma.insuranceClaim.create({
      data: {
        invoiceId,
        claimNumber,
        ...data,
      },
      include: { invoice: true },
    });
  }

  async updateClaimStatus(claimId: string, status: string, approvedAmount?: number) {
    const updateData: any = { status, processedAt: new Date() };
    if (approvedAmount !== undefined) {
      updateData.approvedAmount = approvedAmount;
    }

    const claim = await prisma.insuranceClaim.update({
      where: { id: claimId },
      data: updateData,
      include: { invoice: true },
    });

    // If claim approved, add as payment
    if (status === 'APPROVED' || status === 'PAID') {
      await this.addPayment(claim.invoiceId, {
        amount: approvedAmount || Number(claim.claimAmount),
        paymentMethod: 'INSURANCE',
        referenceNumber: claim.claimNumber,
        notes: `Insurance claim ${claim.claimNumber}`,
        receivedBy: 'SYSTEM',
      });
    }

    return claim;
  }

  async getClaims(hospitalId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const { page = 1, limit = 20, status } = params;
    const skip = (page - 1) * limit;

    const where: any = { invoice: { hospitalId } };
    if (status) where.status = status;

    const [claims, total] = await Promise.all([
      prisma.insuranceClaim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          invoice: {
            include: {
              patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
            },
          },
        },
      }),
      prisma.insuranceClaim.count({ where }),
    ]);

    return { claims, total, page, limit };
  }

  async cancelInvoice(id: string, hospitalId: string) {
    const invoice = await prisma.invoice.findFirst({ where: { id, hospitalId } });
    if (!invoice) throw new NotFoundError('Invoice not found');

    if (Number(invoice.paidAmount) > 0) {
      throw new Error('Cannot cancel invoice with payments');
    }

    return prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async generatePatientStatement(patientId: string, hospitalId: string) {
    const [patient, invoices] = await Promise.all([
      prisma.patient.findFirst({ where: { id: patientId, hospitalId } }),
      prisma.invoice.findMany({
        where: { patientId, hospitalId },
        orderBy: { invoiceDate: 'desc' },
        include: { items: true, payments: true },
      }),
    ]);

    if (!patient) throw new NotFoundError('Patient not found');

    const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount), 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + Number(inv.balanceAmount), 0);

    return {
      patient,
      invoices,
      summary: {
        totalBilled,
        totalPaid,
        totalOutstanding,
        invoiceCount: invoices.length,
      },
    };
  }

  async getBillingStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [totalRevenue, pendingAmount, todayRevenue, monthRevenue, pendingClaims] = await Promise.all([
      prisma.invoice.aggregate({
        where: { hospitalId, status: 'PAID' },
        _sum: { totalAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { hospitalId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
        _sum: { balanceAmount: true },
      }),
      prisma.payment.aggregate({
        where: { invoice: { hospitalId }, paymentDate: { gte: today } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { invoice: { hospitalId }, paymentDate: { gte: thisMonth } },
        _sum: { amount: true },
      }),
      prisma.insuranceClaim.count({
        where: { invoice: { hospitalId }, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      }),
    ]);

    return {
      totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
      pendingAmount: Number(pendingAmount._sum.balanceAmount || 0),
      todayRevenue: Number(todayRevenue._sum.amount || 0),
      monthRevenue: Number(monthRevenue._sum.amount || 0),
      pendingClaims,
    };
  }

  async getOutstandingPayments(hospitalId: string) {
    return prisma.invoice.findMany({
      where: {
        hospitalId,
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
      },
      orderBy: [
        { dueDate: 'asc' },
        { balanceAmount: 'desc' },
      ],
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true, phone: true } },
      },
    });
  }

  // ==================== AI AUTO CHARGE CAPTURE ====================

  // Standard price database (in currency units)
  private readonly chargeDatabase: Record<string, {
    code: string;
    description: string;
    category: string;
    price: number;
    keywords: string[];
  }> = {
    // Consultations
    'initial_consultation': { code: '99201', description: 'Initial Office Visit', category: 'CONSULTATION', price: 150, keywords: ['initial visit', 'new patient', 'first visit'] },
    'follow_up': { code: '99211', description: 'Follow-up Visit', category: 'CONSULTATION', price: 75, keywords: ['follow up', 'review', 'check up', 'return visit'] },
    'emergency_consult': { code: '99281', description: 'Emergency Consultation', category: 'EMERGENCY', price: 250, keywords: ['emergency', 'er visit', 'urgent'] },
    'specialist_consult': { code: '99241', description: 'Specialist Consultation', category: 'CONSULTATION', price: 200, keywords: ['specialist', 'referral', 'second opinion'] },

    // Procedures
    'wound_care': { code: '97602', description: 'Wound Care Management', category: 'PROCEDURE', price: 100, keywords: ['wound dressing', 'wound care', 'debridement'] },
    'suturing': { code: '12001', description: 'Simple Wound Repair', category: 'PROCEDURE', price: 150, keywords: ['suture', 'stitches', 'laceration repair'] },
    'iv_infusion': { code: '96365', description: 'IV Infusion Therapy', category: 'PROCEDURE', price: 80, keywords: ['iv', 'infusion', 'drip', 'intravenous'] },
    'catheterization': { code: '51702', description: 'Bladder Catheterization', category: 'PROCEDURE', price: 75, keywords: ['catheter', 'foley', 'urinary catheter'] },
    'nebulization': { code: '94640', description: 'Nebulizer Treatment', category: 'PROCEDURE', price: 50, keywords: ['nebulizer', 'nebulization', 'inhaler treatment'] },
    'ecg': { code: '93000', description: 'Electrocardiogram', category: 'DIAGNOSTIC', price: 100, keywords: ['ecg', 'ekg', 'electrocardiogram'] },
    'blood_draw': { code: '36415', description: 'Venipuncture', category: 'LAB', price: 25, keywords: ['blood draw', 'venipuncture', 'blood collection'] },

    // Imaging
    'xray_chest': { code: '71046', description: 'Chest X-Ray', category: 'IMAGING', price: 150, keywords: ['chest x-ray', 'cxr', 'chest radiograph'] },
    'xray_extremity': { code: '73030', description: 'Extremity X-Ray', category: 'IMAGING', price: 100, keywords: ['x-ray arm', 'x-ray leg', 'bone x-ray'] },
    'ct_scan': { code: '70450', description: 'CT Scan', category: 'IMAGING', price: 500, keywords: ['ct scan', 'ct', 'cat scan'] },
    'mri': { code: '70551', description: 'MRI Scan', category: 'IMAGING', price: 800, keywords: ['mri', 'magnetic resonance'] },
    'ultrasound': { code: '76700', description: 'Ultrasound', category: 'IMAGING', price: 200, keywords: ['ultrasound', 'sonogram', 'usg'] },

    // Lab
    'cbc': { code: '85025', description: 'Complete Blood Count', category: 'LAB', price: 30, keywords: ['cbc', 'complete blood count', 'blood count'] },
    'metabolic_panel': { code: '80053', description: 'Comprehensive Metabolic Panel', category: 'LAB', price: 50, keywords: ['metabolic panel', 'cmp', 'chemistry'] },
    'lipid_panel': { code: '80061', description: 'Lipid Panel', category: 'LAB', price: 40, keywords: ['lipid panel', 'cholesterol'] },
    'urinalysis': { code: '81003', description: 'Urinalysis', category: 'LAB', price: 20, keywords: ['urinalysis', 'urine test', 'ua'] },
    'blood_culture': { code: '87040', description: 'Blood Culture', category: 'LAB', price: 75, keywords: ['blood culture', 'culture'] },

    // Medications
    'injection_im': { code: '96372', description: 'Intramuscular Injection', category: 'MEDICATION', price: 25, keywords: ['im injection', 'intramuscular'] },
    'injection_iv': { code: '96374', description: 'IV Push Medication', category: 'MEDICATION', price: 35, keywords: ['iv push', 'iv medication'] },

    // Room Charges
    'room_general': { code: 'ROOM-GEN', description: 'General Ward (per day)', category: 'ACCOMMODATION', price: 300, keywords: ['admitted', 'ward', 'general bed'] },
    'room_private': { code: 'ROOM-PVT', description: 'Private Room (per day)', category: 'ACCOMMODATION', price: 600, keywords: ['private room', 'single room'] },
    'room_icu': { code: 'ROOM-ICU', description: 'ICU (per day)', category: 'ACCOMMODATION', price: 1500, keywords: ['icu', 'intensive care'] },

    // Surgery
    'surgery_minor': { code: 'SURG-MIN', description: 'Minor Surgical Procedure', category: 'SURGERY', price: 1000, keywords: ['minor surgery', 'minor procedure'] },
    'surgery_major': { code: 'SURG-MAJ', description: 'Major Surgical Procedure', category: 'SURGERY', price: 5000, keywords: ['major surgery', 'operation'] },
    'anesthesia_local': { code: '00300', description: 'Local Anesthesia', category: 'ANESTHESIA', price: 100, keywords: ['local anesthesia', 'local anaesthesia'] },
    'anesthesia_general': { code: '00100', description: 'General Anesthesia', category: 'ANESTHESIA', price: 800, keywords: ['general anesthesia', 'ga'] },
  };

  // Extract charges from clinical notes
  extractChargesFromNotes(notes: string): {
    capturedCharges: {
      code: string;
      description: string;
      category: string;
      price: number;
      matchedKeyword: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    }[];
    subtotal: number;
    suggestions: string[];
  } {
    const capturedCharges: {
      code: string;
      description: string;
      category: string;
      price: number;
      matchedKeyword: string;
      confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    }[] = [];
    const suggestions: string[] = [];

    const notesLower = notes.toLowerCase();

    // Search for matching charges
    for (const [key, charge] of Object.entries(this.chargeDatabase)) {
      for (const keyword of charge.keywords) {
        if (notesLower.includes(keyword)) {
          // Check if this charge is already captured
          const exists = capturedCharges.find(c => c.code === charge.code);
          if (!exists) {
            capturedCharges.push({
              ...charge,
              matchedKeyword: keyword,
              confidence: notesLower.includes(keyword) ? 'HIGH' : 'MEDIUM',
            });
          }
          break;
        }
      }
    }

    // Add suggestions based on patterns
    if (notesLower.includes('admit') && !capturedCharges.find(c => c.category === 'ACCOMMODATION')) {
      suggestions.push('Patient appears to be admitted - add room charges');
    }
    if (notesLower.includes('blood') && !capturedCharges.find(c => c.code === '36415')) {
      suggestions.push('Blood work mentioned - verify venipuncture charge');
    }
    if ((notesLower.includes('antibiotic') || notesLower.includes('injection')) && !capturedCharges.find(c => c.code === '96372' || c.code === '96374')) {
      suggestions.push('Medication administration mentioned - verify injection charges');
    }
    if (notesLower.includes('surgery') && !capturedCharges.find(c => c.category === 'SURGERY')) {
      suggestions.push('Surgery mentioned - verify surgical procedure charges');
    }

    const subtotal = capturedCharges.reduce((sum, c) => sum + c.price, 0);

    return { capturedCharges, subtotal, suggestions };
  }

  // Get billing code suggestions for diagnosis
  suggestBillingCodes(params: {
    diagnosis?: string;
    procedures?: string[];
    isInpatient?: boolean;
    lengthOfStay?: number;
  }): {
    suggestedCodes: {
      code: string;
      description: string;
      category: string;
      price: number;
      reason: string;
    }[];
    estimatedTotal: number;
    missingCharges: string[];
  } {
    const suggestedCodes: {
      code: string;
      description: string;
      category: string;
      price: number;
      reason: string;
    }[] = [];
    const missingCharges: string[] = [];

    // Add consultation charge
    suggestedCodes.push({
      code: '99201',
      description: 'Initial Office Visit',
      category: 'CONSULTATION',
      price: 150,
      reason: 'Standard consultation fee',
    });

    // Add procedure-based codes
    if (params.procedures) {
      for (const proc of params.procedures) {
        const procLower = proc.toLowerCase();
        for (const [, charge] of Object.entries(this.chargeDatabase)) {
          for (const keyword of charge.keywords) {
            if (procLower.includes(keyword)) {
              if (!suggestedCodes.find(c => c.code === charge.code)) {
                suggestedCodes.push({
                  ...charge,
                  reason: `Procedure: ${proc}`,
                });
              }
              break;
            }
          }
        }
      }
    }

    // Add diagnosis-based codes
    if (params.diagnosis) {
      const diagLower = params.diagnosis.toLowerCase();

      // Common diagnosis-based suggestions
      if (diagLower.includes('diabetes')) {
        suggestedCodes.push({ ...this.chargeDatabase['metabolic_panel'], reason: 'Diabetic monitoring' });
        suggestedCodes.push({ code: '82947', description: 'Glucose Test', category: 'LAB', price: 15, reason: 'Diabetes management' });
      }
      if (diagLower.includes('heart') || diagLower.includes('cardiac') || diagLower.includes('chest pain')) {
        suggestedCodes.push({ ...this.chargeDatabase['ecg'], reason: 'Cardiac evaluation' });
        suggestedCodes.push({ code: '82553', description: 'Troponin', category: 'LAB', price: 45, reason: 'Cardiac markers' });
      }
      if (diagLower.includes('infection') || diagLower.includes('fever')) {
        suggestedCodes.push({ ...this.chargeDatabase['cbc'], reason: 'Infection workup' });
        suggestedCodes.push({ ...this.chargeDatabase['blood_culture'], reason: 'Infection identification' });
      }
      if (diagLower.includes('fracture') || diagLower.includes('injury')) {
        suggestedCodes.push({ ...this.chargeDatabase['xray_extremity'], reason: 'Injury assessment' });
      }
    }

    // Add inpatient charges
    if (params.isInpatient && params.lengthOfStay) {
      const los = params.lengthOfStay;
      suggestedCodes.push({
        code: 'ROOM-GEN',
        description: `General Ward (${los} days)`,
        category: 'ACCOMMODATION',
        price: 300 * los,
        reason: `Room charges for ${los} days`,
      });
      missingCharges.push('Verify nursing care charges');
      missingCharges.push('Verify daily physician visit charges');
    }

    // Check for missing common charges
    if (!suggestedCodes.find(c => c.category === 'LAB')) {
      missingCharges.push('No lab tests captured - verify if any were ordered');
    }

    const estimatedTotal = suggestedCodes.reduce((sum, c) => sum + c.price, 0);

    return { suggestedCodes, estimatedTotal, missingCharges };
  }

  // Estimate costs for procedure
  estimateCost(params: {
    procedureName: string;
    isInpatient?: boolean;
    expectedStay?: number;
    includeAnesthesia?: boolean;
    insuranceCoverage?: number; // percentage
  }): {
    breakdown: { item: string; quantity: number; unitPrice: number; total: number }[];
    subtotal: number;
    insuranceCoverage: number;
    patientResponsibility: number;
    disclaimer: string;
  } {
    const breakdown: { item: string; quantity: number; unitPrice: number; total: number }[] = [];
    const procLower = params.procedureName.toLowerCase();

    // Find matching procedure
    let procedureCharge = 2000; // Default
    for (const [, charge] of Object.entries(this.chargeDatabase)) {
      for (const keyword of charge.keywords) {
        if (procLower.includes(keyword)) {
          procedureCharge = charge.price;
          breakdown.push({
            item: charge.description,
            quantity: 1,
            unitPrice: charge.price,
            total: charge.price,
          });
          break;
        }
      }
    }

    // If no match, add generic procedure
    if (breakdown.length === 0) {
      breakdown.push({
        item: `Procedure: ${params.procedureName}`,
        quantity: 1,
        unitPrice: procedureCharge,
        total: procedureCharge,
      });
    }

    // Add anesthesia if applicable
    if (params.includeAnesthesia) {
      const anesthesiaPrice = procLower.includes('major') ? 800 : 200;
      breakdown.push({
        item: 'Anesthesia Services',
        quantity: 1,
        unitPrice: anesthesiaPrice,
        total: anesthesiaPrice,
      });
    }

    // Add room charges for inpatient
    if (params.isInpatient && params.expectedStay) {
      const roomRate = 400; // Average
      breakdown.push({
        item: 'Hospital Stay (per day)',
        quantity: params.expectedStay,
        unitPrice: roomRate,
        total: roomRate * params.expectedStay,
      });

      // Add nursing care
      breakdown.push({
        item: 'Nursing Care',
        quantity: params.expectedStay,
        unitPrice: 100,
        total: 100 * params.expectedStay,
      });
    }

    // Add standard charges
    breakdown.push({
      item: 'Pre-operative Assessment',
      quantity: 1,
      unitPrice: 200,
      total: 200,
    });

    breakdown.push({
      item: 'Lab Tests (estimated)',
      quantity: 1,
      unitPrice: 150,
      total: 150,
    });

    const subtotal = breakdown.reduce((sum, item) => sum + item.total, 0);
    const coveragePercent = params.insuranceCoverage || 0;
    const insuranceCoverage = (subtotal * coveragePercent) / 100;
    const patientResponsibility = subtotal - insuranceCoverage;

    return {
      breakdown,
      subtotal,
      insuranceCoverage,
      patientResponsibility,
      disclaimer: 'This is an estimate only. Actual charges may vary based on clinical needs and complications.',
    };
  }
}

export const billingService = new BillingService();
