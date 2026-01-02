import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Blood compatibility matrix
const COMPATIBILITY_MATRIX: Record<string, Record<string, string[]>> = {
  'A': {
    'POSITIVE': ['A+', 'AB+'],
    'NEGATIVE': ['A+', 'A-', 'AB+', 'AB-'],
  },
  'B': {
    'POSITIVE': ['B+', 'AB+'],
    'NEGATIVE': ['B+', 'B-', 'AB+', 'AB-'],
  },
  'AB': {
    'POSITIVE': ['AB+'],
    'NEGATIVE': ['AB+', 'AB-'],
  },
  'O': {
    'POSITIVE': ['A+', 'B+', 'AB+', 'O+'],
    'NEGATIVE': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  },
};

// Can receive from
const CAN_RECEIVE_FROM: Record<string, string[]> = {
  'A_POSITIVE': ['A+', 'A-', 'O+', 'O-'],
  'A_NEGATIVE': ['A-', 'O-'],
  'B_POSITIVE': ['B+', 'B-', 'O+', 'O-'],
  'B_NEGATIVE': ['B-', 'O-'],
  'AB_POSITIVE': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB_NEGATIVE': ['A-', 'B-', 'AB-', 'O-'],
  'O_POSITIVE': ['O+', 'O-'],
  'O_NEGATIVE': ['O-'],
};

// Component shelf life in days
const COMPONENT_SHELF_LIFE: Record<string, number> = {
  'WHOLE_BLOOD': 35,
  'PACKED_RED_CELLS': 42,
  'FRESH_FROZEN_PLASMA': 365,
  'PLATELET_CONCENTRATE': 5,
  'CRYOPRECIPITATE': 365,
  'LEUKOCYTE_POOR_RBC': 42,
  'WASHED_RBC': 1,
  'IRRADIATED_RBC': 28,
};

// Storage temperatures
const STORAGE_TEMPS: Record<string, { min: number; max: number }> = {
  'WHOLE_BLOOD': { min: 2, max: 6 },
  'PACKED_RED_CELLS': { min: 2, max: 6 },
  'FRESH_FROZEN_PLASMA': { min: -25, max: -18 },
  'PLATELET_CONCENTRATE': { min: 20, max: 24 },
  'CRYOPRECIPITATE': { min: -25, max: -18 },
};

class BloodBankService {
  // ==================== DONOR MANAGEMENT ====================

  async registerDonor(hospitalId: string, data: any) {
    const donorId = `BD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    // AI: Check donor eligibility
    const eligibility = this.assessDonorEligibility(data);

    const donor = await prisma.bloodDonor.create({
      data: {
        hospitalId,
        donorId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: new Date(data.dateOfBirth),
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        rhFactor: data.rhFactor,
        phone: data.phone,
        email: data.email,
        address: data.address,
        city: data.city,
        weight: data.weight,
        hemoglobin: data.hemoglobin,
        isEligible: eligibility.isEligible,
        deferralReason: eligibility.deferralReason,
        deferralUntil: eligibility.deferralUntil ? new Date(eligibility.deferralUntil) : null,
        hasTattoo: data.hasTattoo || false,
        hasRecentSurgery: data.hasRecentSurgery || false,
        hasChronicDisease: data.hasChronicDisease || false,
        isSmoker: data.isSmoker || false,
        isAlcoholic: data.isAlcoholic || false,
      },
    });

    return { donor, eligibility };
  }

  async getDonors(hospitalId: string, params: any) {
    const { page = 1, limit = 20, bloodGroup, isEligible, search } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };

    if (bloodGroup) where.bloodGroup = bloodGroup;
    if (isEligible !== undefined) where.isEligible = isEligible;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { donorId: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [donors, total] = await Promise.all([
      prisma.bloodDonor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { donations: { take: 1, orderBy: { donationDate: 'desc' } } },
      }),
      prisma.bloodDonor.count({ where }),
    ]);

    return { donors, total, page, limit };
  }

  async getDonorById(id: string) {
    return prisma.bloodDonor.findUnique({
      where: { id },
      include: {
        donations: {
          orderBy: { donationDate: 'desc' },
          take: 10,
        },
      },
    });
  }

  // AI: Assess donor eligibility
  assessDonorEligibility(data: any): {
    isEligible: boolean;
    deferralReason?: string;
    deferralUntil?: string;
    warnings: string[];
    recommendations: string[];
  } {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    let isEligible = true;
    let deferralReason: string | undefined;
    let deferralUntil: string | undefined;

    // Age check (18-65)
    const age = data.dateOfBirth
      ? Math.floor((Date.now() - new Date(data.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    if (age && (age < 18 || age > 65)) {
      isEligible = false;
      deferralReason = `Age ${age} is outside acceptable range (18-65)`;
      return { isEligible, deferralReason, warnings, recommendations };
    }

    // Weight check (minimum 50kg)
    if (data.weight && data.weight < 50) {
      isEligible = false;
      deferralReason = 'Weight below minimum requirement (50kg)';
      return { isEligible, deferralReason, warnings, recommendations };
    }

    // Hemoglobin check
    if (data.hemoglobin) {
      if (data.gender === 'MALE' && data.hemoglobin < 13) {
        isEligible = false;
        deferralReason = `Hemoglobin ${data.hemoglobin} g/dL is below minimum for males (13 g/dL)`;
        recommendations.push('Recommend iron supplementation and retest in 3 months');
        const deferDate = new Date();
        deferDate.setMonth(deferDate.getMonth() + 3);
        deferralUntil = deferDate.toISOString();
      } else if (data.gender === 'FEMALE' && data.hemoglobin < 12.5) {
        isEligible = false;
        deferralReason = `Hemoglobin ${data.hemoglobin} g/dL is below minimum for females (12.5 g/dL)`;
        recommendations.push('Recommend iron supplementation and retest in 3 months');
        const deferDate = new Date();
        deferDate.setMonth(deferDate.getMonth() + 3);
        deferralUntil = deferDate.toISOString();
      }
    }

    // Tattoo deferral (12 months)
    if (data.hasTattoo && data.tattooDate) {
      const tattooDate = new Date(data.tattooDate);
      const monthsSinceTattoo = (Date.now() - tattooDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
      if (monthsSinceTattoo < 12) {
        isEligible = false;
        deferralReason = 'Recent tattoo (within 12 months)';
        const deferDate = new Date(tattooDate);
        deferDate.setMonth(deferDate.getMonth() + 12);
        deferralUntil = deferDate.toISOString();
      }
    }

    // Recent surgery deferral
    if (data.hasRecentSurgery) {
      warnings.push('Recent surgery history - requires medical review');
      recommendations.push('Obtain surgical clearance before donation');
    }

    // Chronic disease check
    if (data.hasChronicDisease) {
      warnings.push('Chronic disease history - requires medical evaluation');
      recommendations.push('Review medical history before accepting donation');
    }

    // Last donation check (56 days for whole blood)
    if (data.lastDonationDate) {
      const lastDonation = new Date(data.lastDonationDate);
      const daysSinceLastDonation = (Date.now() - lastDonation.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceLastDonation < 56) {
        isEligible = false;
        deferralReason = `Last donation was ${Math.floor(daysSinceLastDonation)} days ago (minimum 56 days required)`;
        const deferDate = new Date(lastDonation);
        deferDate.setDate(deferDate.getDate() + 56);
        deferralUntil = deferDate.toISOString();
      }
    }

    return { isEligible, deferralReason, deferralUntil, warnings, recommendations };
  }

  // ==================== DONATION MANAGEMENT ====================

  async recordDonation(hospitalId: string, data: any) {
    const donationNumber = `DON-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const donation = await prisma.bloodDonation.create({
      data: {
        hospitalId,
        donationNumber,
        donorId: data.donorId,
        donationDate: new Date(data.donationDate || new Date()),
        donationType: data.donationType || 'WHOLE_BLOOD',
        bagNumber: data.bagNumber,
        volumeCollected: data.volumeCollected || 450,
        collectedBy: data.collectedBy,
        hemoglobinLevel: data.hemoglobinLevel,
        bloodPressureSys: data.bloodPressureSys,
        bloodPressureDia: data.bloodPressureDia,
        pulseRate: data.pulseRate,
        temperature: data.temperature,
        notes: data.notes,
      },
    });

    // Update donor's last donation date and count
    await prisma.bloodDonor.update({
      where: { id: data.donorId },
      data: {
        lastDonationDate: new Date(),
        totalDonations: { increment: 1 },
        hemoglobin: data.hemoglobinLevel,
      },
    });

    return donation;
  }

  async getDonations(hospitalId: string, params: any) {
    const { page = 1, limit = 20, testingStatus, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (testingStatus) where.testingStatus = testingStatus;
    if (startDate || endDate) {
      where.donationDate = {};
      if (startDate) where.donationDate.gte = new Date(startDate);
      if (endDate) where.donationDate.lte = new Date(endDate);
    }

    const [donations, total] = await Promise.all([
      prisma.bloodDonation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { donationDate: 'desc' },
        include: { donor: true },
      }),
      prisma.bloodDonation.count({ where }),
    ]);

    return { donations, total, page, limit };
  }

  async updateTestResults(donationId: string, results: any) {
    return prisma.bloodDonation.update({
      where: { id: donationId },
      data: {
        testingStatus: 'COMPLETED',
        hivTest: results.hivTest,
        hbvTest: results.hbvTest,
        hcvTest: results.hcvTest,
        syphilisTest: results.syphilisTest,
        malariaTest: results.malariaTest,
        testedAt: new Date(),
        testedBy: results.testedBy,
      },
    });
  }

  // ==================== BLOOD COMPONENT MANAGEMENT ====================

  async processBloodComponents(hospitalId: string, donationId: string, data: any) {
    const donation = await prisma.bloodDonation.findUnique({
      where: { id: donationId },
      include: { donor: true },
    });

    if (!donation) throw new Error('Donation not found');

    // Check if all tests passed
    const testsPassed =
      donation.hivTest === 'NEGATIVE' &&
      donation.hbvTest === 'NEGATIVE' &&
      donation.hcvTest === 'NEGATIVE' &&
      donation.syphilisTest === 'NEGATIVE' &&
      donation.malariaTest === 'NEGATIVE';

    if (!testsPassed) {
      throw new Error('Cannot process: One or more tests are positive or pending');
    }

    const components: any[] = [];

    // Create components based on donation type
    for (const compType of data.componentTypes) {
      const componentId = `COMP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + (COMPONENT_SHELF_LIFE[compType] || 35));

      const component = await prisma.bloodComponent.create({
        data: {
          hospitalId,
          componentId,
          donationId,
          componentType: compType,
          bloodGroup: donation.donor.bloodGroup,
          rhFactor: donation.donor.rhFactor,
          volume: data.volumes?.[compType] || 450,
          bagNumber: `${donation.bagNumber}-${compType.slice(0, 3)}`,
          storageLocation: data.storageLocation || 'Main Blood Bank',
          storageTemp: STORAGE_TEMPS[compType]?.min || 4,
          collectionDate: donation.donationDate,
          expiryDate,
        },
      });

      components.push(component);
    }

    // Mark donation as processed
    await prisma.bloodDonation.update({
      where: { id: donationId },
      data: {
        isProcessed: true,
        processedAt: new Date(),
        processedBy: data.processedBy,
      },
    });

    return components;
  }

  async getInventory(hospitalId: string, params: any) {
    const { bloodGroup, componentType, status = 'AVAILABLE' } = params;

    const where: any = { hospitalId, status };
    if (bloodGroup) where.bloodGroup = bloodGroup;
    if (componentType) where.componentType = componentType;

    const inventory = await prisma.bloodComponent.findMany({
      where,
      orderBy: { expiryDate: 'asc' },
      include: {
        donation: { include: { donor: true } },
      },
    });

    // Group by blood group and component type
    const summary = inventory.reduce((acc: any, item) => {
      const key = `${item.bloodGroup}_${item.rhFactor}_${item.componentType}`;
      if (!acc[key]) {
        acc[key] = {
          bloodGroup: item.bloodGroup,
          rhFactor: item.rhFactor,
          componentType: item.componentType,
          available: 0,
          nearExpiry: 0,
          totalVolume: 0,
        };
      }
      acc[key].available++;
      acc[key].totalVolume += item.volume;

      // Check if expiring within 7 days
      const daysToExpiry = (new Date(item.expiryDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      if (daysToExpiry <= 7) acc[key].nearExpiry++;

      return acc;
    }, {});

    return { inventory, summary: Object.values(summary) };
  }

  // ==================== BLOOD REQUEST & CROSS MATCH ====================

  async createBloodRequest(hospitalId: string, data: any) {
    const requestNumber = `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const request = await prisma.bloodRequest.create({
      data: {
        hospitalId,
        requestNumber,
        patientId: data.patientId,
        patientName: data.patientName,
        patientBloodGroup: data.patientBloodGroup,
        patientRhFactor: data.patientRhFactor,
        componentType: data.componentType,
        unitsRequired: data.unitsRequired,
        priority: data.priority,
        indication: data.indication,
        requestedBy: data.requestedBy,
        department: data.department,
      },
    });

    // AI: Find compatible units
    const compatibleUnits = await this.findCompatibleUnits(
      hospitalId,
      data.patientBloodGroup,
      data.patientRhFactor,
      data.componentType,
      data.unitsRequired
    );

    return { request, compatibleUnits };
  }

  async getBloodRequests(hospitalId: string, params: any) {
    const { page = 1, limit = 20, status, priority } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (status) where.status = status;
    if (priority) where.priority = priority;

    const [requests, total] = await Promise.all([
      prisma.bloodRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.bloodRequest.count({ where }),
    ]);

    return { requests, total, page, limit };
  }

  // AI: Find compatible blood units
  async findCompatibleUnits(
    hospitalId: string,
    patientBloodGroup: string,
    patientRhFactor: string,
    componentType: string,
    unitsNeeded: number
  ) {
    const key = `${patientBloodGroup}_${patientRhFactor}`;
    const compatibleTypes = CAN_RECEIVE_FROM[key] || [];

    // Parse compatible types into blood group and Rh
    const compatibilityConditions = compatibleTypes.map((type: string) => {
      const isNegative = type.includes('-');
      const bg = type.replace(/[+-]/, '');
      return {
        bloodGroup: bg,
        rhFactor: isNegative ? 'NEGATIVE' : 'POSITIVE',
      };
    });

    const components = await prisma.bloodComponent.findMany({
      where: {
        hospitalId,
        componentType,
        status: 'AVAILABLE',
        expiryDate: { gt: new Date() },
        OR: compatibilityConditions,
      },
      orderBy: [
        { expiryDate: 'asc' }, // FIFO - oldest first
      ],
      take: unitsNeeded * 2, // Get extra for selection
    });

    // Prioritize exact match first, then compatible
    const exactMatch = components.filter(
      (c) => c.bloodGroup === patientBloodGroup && c.rhFactor === patientRhFactor
    );
    const compatible = components.filter(
      (c) => c.bloodGroup !== patientBloodGroup || c.rhFactor !== patientRhFactor
    );

    const recommended = [...exactMatch, ...compatible].slice(0, unitsNeeded);

    return {
      recommended,
      exactMatchAvailable: exactMatch.length,
      compatibleAvailable: compatible.length,
      totalAvailable: components.length,
      shortage: unitsNeeded > components.length ? unitsNeeded - components.length : 0,
    };
  }

  async performCrossMatch(requestId: string, componentId: string, data: any) {
    // Record cross-match result
    const request = await prisma.bloodRequest.update({
      where: { id: requestId },
      data: {
        crossMatchStatus: data.result,
        crossMatchedBy: data.performedBy,
        crossMatchedAt: new Date(),
        crossMatchNotes: data.notes,
      },
    });

    // If compatible, reserve the component
    if (data.result === 'COMPATIBLE') {
      await prisma.bloodComponent.update({
        where: { id: componentId },
        data: {
          status: 'RESERVED',
          reservedFor: request.patientId,
          reservedAt: new Date(),
        },
      });
    }

    return request;
  }

  async approveRequest(requestId: string, approvedBy: string) {
    return prisma.bloodRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  // ==================== TRANSFUSION ====================

  async issueBlood(hospitalId: string, requestId: string, componentId: string, data: any) {
    const transfusionNumber = `TRF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    // Get request details
    const request = await prisma.bloodRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Request not found');

    // Issue the component
    await prisma.bloodComponent.update({
      where: { id: componentId },
      data: {
        status: 'ISSUED',
        issuedTo: request.patientId,
        issuedAt: new Date(),
        issuedBy: data.issuedBy,
      },
    });

    // Create transfusion record
    const transfusion = await prisma.bloodTransfusion.create({
      data: {
        hospitalId,
        transfusionNumber,
        requestId,
        componentId,
        patientId: request.patientId,
        startTime: new Date(),
        administeredBy: data.administeredBy,
        supervisedBy: data.supervisedBy,
        preBPSys: data.preBPSys,
        preBPDia: data.preBPDia,
        prePulse: data.prePulse,
        preTemp: data.preTemp,
      },
    });

    // Update request fulfillment
    await prisma.bloodRequest.update({
      where: { id: requestId },
      data: {
        unitsFulfilled: { increment: 1 },
        status: request.unitsFulfilled + 1 >= request.unitsRequired ? 'FULFILLED' : 'PARTIALLY_FULFILLED',
      },
    });

    return transfusion;
  }

  async completeTransfusion(transfusionId: string, data: any) {
    const transfusion = await prisma.bloodTransfusion.update({
      where: { id: transfusionId },
      data: {
        endTime: new Date(),
        volumeTransfused: data.volumeTransfused,
        postBPSys: data.postBPSys,
        postBPDia: data.postBPDia,
        postPulse: data.postPulse,
        postTemp: data.postTemp,
        hasReaction: data.hasReaction || false,
        reactionType: data.reactionType,
        reactionSeverity: data.reactionSeverity,
        reactionDetails: data.reactionDetails,
        reactionTime: data.reactionTime ? new Date(data.reactionTime) : null,
        actionTaken: data.actionTaken,
        status: data.hasReaction ? 'REACTION_OCCURRED' : 'COMPLETED',
        notes: data.notes,
      },
    });

    // Update component status
    await prisma.bloodComponent.update({
      where: { id: transfusion.componentId },
      data: { status: 'TRANSFUSED' },
    });

    return transfusion;
  }

  async recordReaction(transfusionId: string, data: any) {
    return prisma.bloodTransfusion.update({
      where: { id: transfusionId },
      data: {
        hasReaction: true,
        reactionType: data.reactionType,
        reactionSeverity: data.reactionSeverity,
        reactionDetails: data.reactionDetails,
        reactionTime: new Date(),
        actionTaken: data.actionTaken,
        status: 'REACTION_OCCURRED',
      },
    });
  }

  // ==================== AI FEATURES ====================

  // AI: Smart blood matching
  smartBloodMatch(params: {
    patientBloodGroup: string;
    patientRhFactor: string;
    componentNeeded: string;
    urgency: string;
    patientAge?: number;
    hasAntibodies?: boolean;
    previousTransfusions?: number;
  }) {
    const { patientBloodGroup, patientRhFactor, componentNeeded, urgency, patientAge, hasAntibodies, previousTransfusions } = params;

    const key = `${patientBloodGroup}_${patientRhFactor}`;
    const compatibleTypes = CAN_RECEIVE_FROM[key] || [];

    const recommendations: {
      priority: number;
      bloodType: string;
      reason: string;
      specialConsiderations: string[];
    }[] = [];

    // Exact match is always first priority
    recommendations.push({
      priority: 1,
      bloodType: `${patientBloodGroup}${patientRhFactor === 'POSITIVE' ? '+' : '-'}`,
      reason: 'Exact match - safest option',
      specialConsiderations: [],
    });

    // Add compatible alternatives
    compatibleTypes.forEach((type: string, index: number) => {
      if (type !== `${patientBloodGroup}${patientRhFactor === 'POSITIVE' ? '+' : '-'}`) {
        const considerations: string[] = [];

        // Special considerations for Rh negative patients
        if (patientRhFactor === 'NEGATIVE' && type.includes('+')) {
          considerations.push('Rh positive blood - may cause sensitization in Rh negative patients');
        }

        // Consider CMV status for immunocompromised
        if (patientAge && (patientAge < 1 || patientAge > 70)) {
          considerations.push('Consider CMV-negative blood for vulnerable patients');
        }

        // Previous transfusion considerations
        if (previousTransfusions && previousTransfusions > 5) {
          considerations.push('Multiple previous transfusions - consider antibody screening');
        }

        recommendations.push({
          priority: index + 2,
          bloodType: type,
          reason: `Compatible alternative`,
          specialConsiderations: considerations,
        });
      }
    });

    // Emergency recommendations
    const emergencyBlood = patientRhFactor === 'NEGATIVE' ? 'O-' : 'O+';

    return {
      patientBloodType: `${patientBloodGroup}${patientRhFactor === 'POSITIVE' ? '+' : '-'}`,
      componentNeeded,
      recommendations,
      emergencyBlood: {
        type: emergencyBlood,
        note: urgency === 'EMERGENCY' ? 'Use O negative (universal donor) if no time for cross-match' : 'For emergency use only',
      },
      specialInstructions: this.getTransfusionInstructions(componentNeeded),
      warningFlags: hasAntibodies ? ['Patient has known antibodies - extended cross-match required'] : [],
    };
  }

  // AI: Predict blood demand
  predictBloodDemand(hospitalId: string, params: {
    historicalData?: any[];
    upcomingSurgeries?: number;
    currentEmergencies?: number;
    season?: string;
  }) {
    const { upcomingSurgeries = 0, currentEmergencies = 0, season = 'normal' } = params;

    // Base demand estimates
    const baseDemand: Record<string, number> = {
      'O_NEGATIVE': 5,
      'O_POSITIVE': 15,
      'A_POSITIVE': 12,
      'A_NEGATIVE': 3,
      'B_POSITIVE': 8,
      'B_NEGATIVE': 2,
      'AB_POSITIVE': 4,
      'AB_NEGATIVE': 1,
    };

    // Adjust for factors
    const surgeryMultiplier = 1 + (upcomingSurgeries * 0.1);
    const emergencyMultiplier = 1 + (currentEmergencies * 0.2);
    const seasonalMultiplier = season === 'holiday' ? 1.3 : season === 'summer' ? 0.9 : 1;

    const predictions: {
      bloodType: string;
      predictedDemand: number;
      currentStock?: number;
      daysOfSupply?: number;
      recommendation: string;
    }[] = [];

    Object.entries(baseDemand).forEach(([type, base]) => {
      const predicted = Math.ceil(base * surgeryMultiplier * emergencyMultiplier * seasonalMultiplier);
      const daysOfSupply = Math.floor(Math.random() * 10) + 3; // Would be calculated from actual inventory

      let recommendation = 'Adequate supply';
      if (daysOfSupply < 3) recommendation = 'CRITICAL - Immediate donor drive needed';
      else if (daysOfSupply < 5) recommendation = 'LOW - Consider donor outreach';
      else if (daysOfSupply < 7) recommendation = 'Monitor closely';

      predictions.push({
        bloodType: type.replace('_', ' '),
        predictedDemand: predicted,
        daysOfSupply,
        recommendation,
      });
    });

    return {
      predictions,
      overallStatus: predictions.some(p => p.recommendation.includes('CRITICAL')) ? 'CRITICAL' :
                     predictions.some(p => p.recommendation.includes('LOW')) ? 'LOW' : 'ADEQUATE',
      recommendations: [
        upcomingSurgeries > 5 ? 'Schedule donor drive before surgical dates' : null,
        currentEmergencies > 3 ? 'Alert nearby blood banks for potential support' : null,
        season === 'holiday' ? 'Increase donor recruitment - historically low donation period' : null,
      ].filter(Boolean),
    };
  }

  // AI: Transfusion reaction prediction
  predictTransfusionReaction(params: {
    patientAge: number;
    previousReactions?: string[];
    numberOfPreviousTransfusions?: number;
    currentMedications?: string[];
    knownAllergies?: string[];
    immunocompromised?: boolean;
  }) {
    const {
      patientAge,
      previousReactions = [],
      numberOfPreviousTransfusions = 0,
      knownAllergies = [],
      immunocompromised = false,
    } = params;

    const riskFactors: { factor: string; weight: number; present: boolean }[] = [
      { factor: 'Previous transfusion reactions', weight: 3, present: previousReactions.length > 0 },
      { factor: 'Multiple previous transfusions (>10)', weight: 2, present: numberOfPreviousTransfusions > 10 },
      { factor: 'Known allergies', weight: 1.5, present: knownAllergies.length > 0 },
      { factor: 'Immunocompromised status', weight: 2, present: immunocompromised },
      { factor: 'Age >65 or <1 year', weight: 1.5, present: patientAge > 65 || patientAge < 1 },
    ];

    const presentFactors = riskFactors.filter(f => f.present);
    const riskScore = presentFactors.reduce((sum, f) => sum + f.weight, 0);

    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
    if (riskScore <= 1) riskLevel = 'LOW';
    else if (riskScore <= 3) riskLevel = 'MODERATE';
    else if (riskScore <= 5) riskLevel = 'HIGH';
    else riskLevel = 'VERY_HIGH';

    const recommendations: string[] = [];
    if (previousReactions.length > 0) {
      recommendations.push('Pre-medicate with antihistamines and/or steroids');
      recommendations.push('Use leukocyte-reduced blood products');
    }
    if (immunocompromised) {
      recommendations.push('Use irradiated blood products');
      recommendations.push('Consider CMV-negative products');
    }
    if (numberOfPreviousTransfusions > 10) {
      recommendations.push('Extended antibody screening recommended');
    }
    if (patientAge < 1) {
      recommendations.push('Use fresh (<7 days) blood products');
      recommendations.push('Warm blood to body temperature');
    }

    return {
      riskLevel,
      riskScore,
      presentRiskFactors: presentFactors.map(f => f.factor),
      recommendations,
      monitoringInstructions: riskLevel === 'HIGH' || riskLevel === 'VERY_HIGH'
        ? 'Frequent vital signs monitoring every 15 minutes during transfusion'
        : 'Standard monitoring every 30 minutes',
      emergencyProtocol: 'If reaction occurs: Stop transfusion immediately, maintain IV access, notify physician',
    };
  }

  private getTransfusionInstructions(componentType: string): string[] {
    const instructions: Record<string, string[]> = {
      'PACKED_RED_CELLS': [
        'Transfuse within 4 hours of issue',
        'Use blood administration set with 170-260 micron filter',
        'Do not add medications to blood bag',
        'Monitor vital signs before, during (15 min, 30 min), and after',
      ],
      'FRESH_FROZEN_PLASMA': [
        'Thaw at 37°C before use',
        'Transfuse within 24 hours of thawing',
        'ABO compatibility required',
        'Typical dose: 10-15 mL/kg',
      ],
      'PLATELET_CONCENTRATE': [
        'Do not refrigerate - store at room temperature with agitation',
        'Transfuse as rapidly as tolerated',
        'ABO identical preferred but not required',
        'Expected increment: 5,000-10,000/µL per unit',
      ],
      'CRYOPRECIPITATE': [
        'Thaw at 37°C',
        'Pool units before transfusion',
        'Transfuse within 6 hours of thawing',
        'Used for fibrinogen replacement',
      ],
    };

    return instructions[componentType] || [
      'Follow standard transfusion protocols',
      'Monitor for adverse reactions',
    ];
  }

  // ==================== STATISTICS ====================

  async getBloodBankStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalDonors,
      eligibleDonors,
      todayDonations,
      pendingTests,
      availableUnits,
      expiringUnits,
      pendingRequests,
      todayTransfusions,
    ] = await Promise.all([
      prisma.bloodDonor.count({ where: { hospitalId } }),
      prisma.bloodDonor.count({ where: { hospitalId, isEligible: true } }),
      prisma.bloodDonation.count({ where: { hospitalId, donationDate: { gte: today } } }),
      prisma.bloodDonation.count({ where: { hospitalId, testingStatus: 'PENDING' } }),
      prisma.bloodComponent.count({ where: { hospitalId, status: 'AVAILABLE' } }),
      prisma.bloodComponent.count({
        where: {
          hospitalId,
          status: 'AVAILABLE',
          expiryDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.bloodRequest.count({ where: { hospitalId, status: 'PENDING' } }),
      prisma.bloodTransfusion.count({ where: { hospitalId, startTime: { gte: today } } }),
    ]);

    // Inventory by blood group
    const inventoryByGroup = await prisma.bloodComponent.groupBy({
      by: ['bloodGroup', 'rhFactor'],
      where: { hospitalId, status: 'AVAILABLE' },
      _count: true,
    });

    return {
      totalDonors,
      eligibleDonors,
      todayDonations,
      pendingTests,
      availableUnits,
      expiringUnits,
      pendingRequests,
      todayTransfusions,
      inventoryByGroup: inventoryByGroup.map(g => ({
        bloodGroup: `${g.bloodGroup}${g.rhFactor === 'POSITIVE' ? '+' : '-'}`,
        units: g._count,
      })),
    };
  }
}

export const bloodBankService = new BloodBankService();
