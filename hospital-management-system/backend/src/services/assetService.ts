import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Maintenance intervals by equipment type (in days)
const MAINTENANCE_INTERVALS: Record<string, number> = {
  VENTILATOR: 90,
  DEFIBRILLATOR: 30,
  INFUSION_PUMP: 180,
  PATIENT_MONITOR: 90,
  ECG_MACHINE: 180,
  XRAY_MACHINE: 365,
  CT_SCANNER: 365,
  MRI_MACHINE: 365,
  ULTRASOUND: 180,
  AUTOCLAVE: 30,
  DIALYSIS_MACHINE: 30,
  ANESTHESIA_MACHINE: 90,
  DEFAULT: 365,
};

// Calibration requirements
const CALIBRATION_REQUIRED: string[] = [
  'PATIENT_MONITOR', 'ECG_MACHINE', 'DEFIBRILLATOR', 'INFUSION_PUMP',
  'VENTILATOR', 'DIALYSIS_MACHINE', 'ANESTHESIA_MACHINE', 'GLUCOMETER',
  'BLOOD_GAS_ANALYZER', 'XRAY_MACHINE', 'CT_SCANNER', 'MRI_MACHINE',
];

class AssetService {
  // ==================== ASSET MANAGEMENT ====================

  async createAsset(hospitalId: string, data: any) {
    const assetCode = `AST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    // Calculate next maintenance date
    const interval = MAINTENANCE_INTERVALS[data.subCategory] || MAINTENANCE_INTERVALS.DEFAULT;
    const nextMaintenanceDate = new Date();
    nextMaintenanceDate.setDate(nextMaintenanceDate.getDate() + interval);

    // Check if calibration required
    const requiresCalibration = CALIBRATION_REQUIRED.includes(data.subCategory || '');

    const asset = await prisma.asset.create({
      data: {
        hospitalId,
        assetCode,
        name: data.name,
        category: data.category,
        subCategory: data.subCategory,
        description: data.description,
        manufacturer: data.manufacturer,
        model: data.model,
        serialNumber: data.serialNumber,
        barcode: data.barcode,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchasePrice: data.purchasePrice,
        vendor: data.vendor,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : null,
        department: data.department,
        building: data.building,
        floor: data.floor,
        room: data.room,
        usefulLife: data.usefulLife,
        depreciationRate: data.depreciationRate,
        currentValue: data.purchasePrice,
        hasAMC: data.hasAMC || false,
        amcVendor: data.amcVendor,
        amcStartDate: data.amcStartDate ? new Date(data.amcStartDate) : null,
        amcEndDate: data.amcEndDate ? new Date(data.amcEndDate) : null,
        amcCost: data.amcCost,
        requiresCalibration,
        notes: data.notes,
      },
    });

    // Schedule first maintenance
    await this.scheduleMaintenanceInternal(hospitalId, asset.id, {
      maintenanceType: 'PREVENTIVE',
      scheduledDate: nextMaintenanceDate,
      description: 'Initial preventive maintenance',
    });

    return asset;
  }

  async getAssets(hospitalId: string, params: any) {
    const { page = 1, limit = 20, category, status, department, search } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (category) where.category = category;
    if (status) where.status = status;
    if (department) where.department = department;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { assetCode: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          maintenanceRecords: {
            take: 1,
            orderBy: { scheduledDate: 'desc' },
          },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    return { assets, total, page, limit };
  }

  async getAssetById(id: string) {
    return prisma.asset.findUnique({
      where: { id },
      include: {
        maintenanceRecords: {
          orderBy: { scheduledDate: 'desc' },
          take: 10,
        },
      },
    });
  }

  async updateAsset(id: string, data: any) {
    return prisma.asset.update({
      where: { id },
      data: {
        name: data.name,
        department: data.department,
        building: data.building,
        floor: data.floor,
        room: data.room,
        status: data.status,
        condition: data.condition,
        currentValue: data.currentValue,
        notes: data.notes,
        lastUsedAt: data.lastUsedAt ? new Date(data.lastUsedAt) : undefined,
      },
    });
  }

  async updateAssetStatus(id: string, status: string, reason?: string) {
    return prisma.asset.update({
      where: { id },
      data: {
        status,
        notes: reason,
      },
    });
  }

  // ==================== MAINTENANCE MANAGEMENT ====================

  async scheduleMaintenance(hospitalId: string, assetId: string, data: any) {
    return this.scheduleMaintenanceInternal(hospitalId, assetId, data);
  }

  private async scheduleMaintenanceInternal(hospitalId: string, assetId: string, data: any) {
    const maintenanceNumber = `MAINT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    return prisma.assetMaintenance.create({
      data: {
        hospitalId,
        maintenanceNumber,
        assetId,
        maintenanceType: data.maintenanceType,
        priority: data.priority || 'MEDIUM',
        scheduledDate: new Date(data.scheduledDate),
        description: data.description,
        vendorName: data.vendorName,
        vendorContact: data.vendorContact,
      },
    });
  }

  async getMaintenanceSchedule(hospitalId: string, params: any) {
    const { page = 1, limit = 20, status, maintenanceType, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (status) where.status = status;
    if (maintenanceType) where.maintenanceType = maintenanceType;
    if (startDate || endDate) {
      where.scheduledDate = {};
      if (startDate) where.scheduledDate.gte = new Date(startDate);
      if (endDate) where.scheduledDate.lte = new Date(endDate);
    }

    const [records, total] = await Promise.all([
      prisma.assetMaintenance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledDate: 'asc' },
        include: { asset: true },
      }),
      prisma.assetMaintenance.count({ where }),
    ]);

    return { records, total, page, limit };
  }

  async startMaintenance(id: string, data: any) {
    const maintenance = await prisma.assetMaintenance.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startDate: new Date(),
        performedBy: data.performedBy,
      },
    });

    // Update asset status
    await prisma.asset.update({
      where: { id: maintenance.assetId },
      data: { status: 'UNDER_MAINTENANCE' },
    });

    return maintenance;
  }

  async completeMaintenance(id: string, data: any) {
    const maintenance = await prisma.assetMaintenance.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completionDate: new Date(),
        findings: data.findings,
        actionTaken: data.actionTaken,
        partsReplaced: data.partsReplaced || [],
        laborCost: data.laborCost,
        partsCost: data.partsCost,
        totalCost: (data.laborCost || 0) + (data.partsCost || 0),
        nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate) : null,
      },
    });

    // Update asset status and calibration date if applicable
    const updateData: any = { status: 'ACTIVE', condition: data.newCondition || 'GOOD' };

    if (maintenance.maintenanceType === 'CALIBRATION') {
      updateData.lastCalibrationDate = new Date();
      const nextCal = new Date();
      nextCal.setFullYear(nextCal.getFullYear() + 1);
      updateData.nextCalibrationDate = nextCal;
    }

    await prisma.asset.update({
      where: { id: maintenance.assetId },
      data: updateData,
    });

    return maintenance;
  }

  // ==================== AI FEATURES ====================

  // AI: Predict equipment failure
  predictEquipmentFailure(params: {
    assetAge: number; // years
    usageHours?: number;
    lastMaintenanceDate?: Date;
    maintenanceHistory?: { date: Date; type: string; findings?: string }[];
    currentCondition?: string;
    category?: string;
  }): {
    failureProbability: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    predictedFailureWindow?: string;
    contributingFactors: string[];
    recommendations: string[];
    urgency: string;
  } {
    const {
      assetAge,
      usageHours = 0,
      lastMaintenanceDate,
      maintenanceHistory = [],
      currentCondition = 'GOOD',
      category = 'MEDICAL_EQUIPMENT',
    } = params;

    let riskScore = 0;
    const contributingFactors: string[] = [];
    const recommendations: string[] = [];

    // Age factor (0-30 points)
    if (assetAge > 10) {
      riskScore += 30;
      contributingFactors.push('Equipment age exceeds 10 years');
      recommendations.push('Consider replacement planning');
    } else if (assetAge > 7) {
      riskScore += 20;
      contributingFactors.push('Equipment approaching end of useful life');
    } else if (assetAge > 5) {
      riskScore += 10;
      contributingFactors.push('Equipment in mid-life phase');
    }

    // Maintenance history factor (0-25 points)
    if (lastMaintenanceDate) {
      const daysSinceMaintenance = (Date.now() - lastMaintenanceDate.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceMaintenance > 365) {
        riskScore += 25;
        contributingFactors.push('No maintenance in over 1 year');
        recommendations.push('Schedule immediate maintenance inspection');
      } else if (daysSinceMaintenance > 180) {
        riskScore += 15;
        contributingFactors.push('Maintenance overdue');
        recommendations.push('Schedule preventive maintenance');
      }
    } else {
      riskScore += 20;
      contributingFactors.push('No maintenance history available');
    }

    // Condition factor (0-25 points)
    const conditionScores: Record<string, number> = {
      EXCELLENT: 0,
      GOOD: 5,
      FAIR: 15,
      POOR: 25,
      CONDEMNED: 30,
    };
    riskScore += conditionScores[currentCondition] || 10;
    if (currentCondition === 'POOR' || currentCondition === 'FAIR') {
      contributingFactors.push(`Current condition is ${currentCondition.toLowerCase()}`);
    }

    // Usage factor (0-20 points)
    if (usageHours > 20000) {
      riskScore += 20;
      contributingFactors.push('High usage hours (>20,000)');
    } else if (usageHours > 10000) {
      riskScore += 10;
      contributingFactors.push('Moderate usage hours');
    }

    // Previous failure history
    const failureEvents = maintenanceHistory.filter(
      (m) => m.type === 'CORRECTIVE' || m.type === 'EMERGENCY'
    );
    if (failureEvents.length >= 3) {
      riskScore += 15;
      contributingFactors.push('Multiple previous failure events');
      recommendations.push('Review for recurring issues pattern');
    }

    // Calculate final metrics
    const failureProbability = Math.min(riskScore, 100);

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    let urgency: string;
    let predictedFailureWindow: string | undefined;

    if (failureProbability >= 75) {
      riskLevel = 'CRITICAL';
      urgency = 'Immediate action required';
      predictedFailureWindow = 'Within 30 days';
      recommendations.push('Immediate inspection required');
      recommendations.push('Have backup equipment ready');
    } else if (failureProbability >= 50) {
      riskLevel = 'HIGH';
      urgency = 'Action required within 1 week';
      predictedFailureWindow = 'Within 90 days';
      recommendations.push('Schedule maintenance within 2 weeks');
    } else if (failureProbability >= 25) {
      riskLevel = 'MEDIUM';
      urgency = 'Schedule review';
      predictedFailureWindow = 'Within 6 months';
      recommendations.push('Continue regular monitoring');
    } else {
      riskLevel = 'LOW';
      urgency = 'Normal monitoring';
      recommendations.push('Maintain regular maintenance schedule');
    }

    return {
      failureProbability,
      riskLevel,
      predictedFailureWindow,
      contributingFactors,
      recommendations,
      urgency,
    };
  }

  // AI: Optimize maintenance schedule
  optimizeMaintenanceSchedule(assets: any[]): {
    schedule: {
      assetId: string;
      assetName: string;
      suggestedDate: Date;
      maintenanceType: string;
      priority: string;
      reason: string;
    }[];
    resourceAllocation: {
      week: string;
      maintenanceCount: number;
      estimatedHours: number;
    }[];
    recommendations: string[];
  } {
    const schedule: any[] = [];
    const recommendations: string[] = [];

    assets.forEach((asset) => {
      // Calculate priority based on multiple factors
      const prediction = this.predictEquipmentFailure({
        assetAge: asset.age || 0,
        lastMaintenanceDate: asset.lastMaintenanceDate,
        currentCondition: asset.condition,
        category: asset.category,
      });

      let maintenanceType = 'PREVENTIVE';
      let priority = 'MEDIUM';
      let suggestedDate = new Date();

      if (prediction.riskLevel === 'CRITICAL') {
        priority = 'HIGH';
        suggestedDate.setDate(suggestedDate.getDate() + 3);
        maintenanceType = 'INSPECTION';
      } else if (prediction.riskLevel === 'HIGH') {
        priority = 'HIGH';
        suggestedDate.setDate(suggestedDate.getDate() + 14);
      } else if (prediction.riskLevel === 'MEDIUM') {
        suggestedDate.setDate(suggestedDate.getDate() + 30);
      } else {
        priority = 'LOW';
        suggestedDate.setDate(suggestedDate.getDate() + 90);
      }

      // Check calibration requirement
      if (asset.requiresCalibration && asset.nextCalibrationDate) {
        const calDate = new Date(asset.nextCalibrationDate);
        if (calDate < suggestedDate) {
          suggestedDate = calDate;
          maintenanceType = 'CALIBRATION';
          priority = 'HIGH';
        }
      }

      schedule.push({
        assetId: asset.id,
        assetName: asset.name,
        suggestedDate,
        maintenanceType,
        priority,
        reason: prediction.contributingFactors.join('; ') || 'Regular maintenance',
      });
    });

    // Sort by date and priority
    schedule.sort((a, b) => {
      const priorityOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.suggestedDate.getTime() - b.suggestedDate.getTime();
    });

    // Calculate weekly resource allocation
    const weeklyData: Record<string, number> = {};
    schedule.forEach((item) => {
      const weekStart = new Date(item.suggestedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      weeklyData[weekKey] = (weeklyData[weekKey] || 0) + 1;
    });

    const resourceAllocation = Object.entries(weeklyData).map(([week, count]) => ({
      week,
      maintenanceCount: count,
      estimatedHours: count * 2, // Assume 2 hours per maintenance
    }));

    // Generate recommendations
    const highPriorityCount = schedule.filter((s) => s.priority === 'HIGH').length;
    if (highPriorityCount > 5) {
      recommendations.push(`${highPriorityCount} high-priority items need immediate attention`);
    }

    const overloadedWeeks = resourceAllocation.filter((w) => w.maintenanceCount > 10);
    if (overloadedWeeks.length > 0) {
      recommendations.push('Some weeks have high maintenance load - consider distributing');
    }

    return { schedule: schedule.slice(0, 50), resourceAllocation, recommendations };
  }

  // ==================== STATISTICS ====================

  async getAssetStats(hospitalId: string) {
    const [
      totalAssets,
      activeAssets,
      underMaintenance,
      upcomingMaintenance,
      overdueCalibration,
      expiringWarranty,
      expiringAMC,
    ] = await Promise.all([
      prisma.asset.count({ where: { hospitalId } }),
      prisma.asset.count({ where: { hospitalId, status: 'ACTIVE' } }),
      prisma.asset.count({ where: { hospitalId, status: 'UNDER_MAINTENANCE' } }),
      prisma.assetMaintenance.count({
        where: {
          hospitalId,
          status: 'SCHEDULED',
          scheduledDate: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.asset.count({
        where: {
          hospitalId,
          requiresCalibration: true,
          nextCalibrationDate: { lte: new Date() },
        },
      }),
      prisma.asset.count({
        where: {
          hospitalId,
          warrantyExpiry: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.asset.count({
        where: {
          hospitalId,
          hasAMC: true,
          amcEndDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Asset value by category
    const valueByCategory = await prisma.asset.groupBy({
      by: ['category'],
      where: { hospitalId },
      _sum: { currentValue: true },
      _count: true,
    });

    return {
      totalAssets,
      activeAssets,
      underMaintenance,
      upcomingMaintenance,
      overdueCalibration,
      expiringWarranty,
      expiringAMC,
      valueByCategory: valueByCategory.map((v) => ({
        category: v.category,
        count: v._count,
        totalValue: v._sum.currentValue || 0,
      })),
    };
  }
}

export const assetService = new AssetService();
