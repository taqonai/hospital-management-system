import prisma from '../config/database';

// ==================== STERILIZATION ITEM MANAGEMENT ====================

export const cssdService = {
  // Add sterilization item
  async addItem(hospitalId: string, data: {
    name: string;
    category: string;
    barcode?: string;
    description?: string;
    sterilizationMethod: string;
    cycleTimeMinutes: number;
    temperatureCelsius?: number;
    pressureKpa?: number;
    shelfLifeDays: number;
  }) {
    return prisma.sterilizationItem.create({
      data: {
        ...data,
        hospitalId,
        status: 'AVAILABLE',
      },
    });
  },

  // Get items
  async getItems(hospitalId: string, filters: {
    status?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { barcode: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.sterilizationItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.sterilizationItem.count({ where }),
    ]);

    return { items, total, page, limit };
  },

  // Get item by ID
  async getItemById(id: string) {
    return prisma.sterilizationItem.findUnique({
      where: { id },
      include: {
        cycleItems: {
          include: { cycle: true },
          orderBy: { cycle: { startTime: 'desc' } },
          take: 10,
        },
      },
    });
  },

  // Update item status
  async updateItemStatus(id: string, status: string) {
    return prisma.sterilizationItem.update({
      where: { id },
      data: { status },
    });
  },

  // ==================== STERILIZATION CYCLE MANAGEMENT ====================

  // Create sterilization cycle
  async createCycle(hospitalId: string, data: {
    cycleNumber: string;
    machineId: string;
    machineName: string;
    method: string;
    operatorId: string;
    itemIds: string[];
    parameters?: any;
  }) {
    const { itemIds, ...cycleData } = data;

    // Create cycle with items
    const cycle = await prisma.sterilizationCycle.create({
      data: {
        ...cycleData,
        hospitalId,
        status: 'PENDING',
        cycleItems: {
          create: itemIds.map(itemId => ({
            itemId,
            status: 'PENDING',
          })),
        },
      },
      include: {
        cycleItems: { include: { item: true } },
      },
    });

    // Update item statuses
    await prisma.sterilizationItem.updateMany({
      where: { id: { in: itemIds } },
      data: { status: 'IN_STERILIZATION' },
    });

    return cycle;
  },

  // Start cycle
  async startCycle(cycleId: string) {
    return prisma.sterilizationCycle.update({
      where: { id: cycleId },
      data: {
        status: 'IN_PROGRESS',
        startTime: new Date(),
      },
      include: {
        cycleItems: { include: { item: true } },
      },
    });
  },

  // Complete cycle
  async completeCycle(cycleId: string, data: {
    passed: boolean;
    actualParameters?: any;
    biologicalIndicator?: string;
    chemicalIndicator?: string;
    notes?: string;
  }) {
    const cycle = await prisma.sterilizationCycle.findUnique({
      where: { id: cycleId },
      include: { cycleItems: { include: { item: true } } },
    });

    if (!cycle) throw new Error('Cycle not found');

    const now = new Date();
    const status = data.passed ? 'COMPLETED' : 'FAILED';
    const itemStatus = data.passed ? 'STERILE' : 'FAILED';

    // Update cycle
    const updatedCycle = await prisma.sterilizationCycle.update({
      where: { id: cycleId },
      data: {
        status,
        endTime: now,
        ...data,
      },
      include: {
        cycleItems: { include: { item: true } },
      },
    });

    // Update cycle items and items
    for (const cycleItem of cycle.cycleItems) {
      await prisma.sterilizationCycleItem.update({
        where: { id: cycleItem.id },
        data: {
          status: itemStatus,
          sterilizedAt: data.passed ? now : null,
          expiresAt: data.passed
            ? new Date(now.getTime() + cycleItem.item.shelfLifeDays * 24 * 60 * 60 * 1000)
            : null,
        },
      });

      await prisma.sterilizationItem.update({
        where: { id: cycleItem.itemId },
        data: {
          status: data.passed ? 'STERILE' : 'AVAILABLE',
          lastSterilizedAt: data.passed ? now : undefined,
          sterilizationCount: data.passed ? { increment: 1 } : undefined,
        },
      });
    }

    return updatedCycle;
  },

  // Get cycles
  async getCycles(hospitalId: string, filters: {
    status?: string;
    machineId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (filters.status) where.status = filters.status;
    if (filters.machineId) where.machineId = filters.machineId;
    if (filters.dateFrom || filters.dateTo) {
      where.startTime = {};
      if (filters.dateFrom) where.startTime.gte = filters.dateFrom;
      if (filters.dateTo) where.startTime.lte = filters.dateTo;
    }

    const [cycles, total] = await Promise.all([
      prisma.sterilizationCycle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          cycleItems: { include: { item: true } },
        },
      }),
      prisma.sterilizationCycle.count({ where }),
    ]);

    return { cycles, total, page, limit };
  },

  // Get cycle by ID
  async getCycleById(id: string) {
    return prisma.sterilizationCycle.findUnique({
      where: { id },
      include: {
        cycleItems: { include: { item: true } },
      },
    });
  },

  // ==================== TRACKING & TRACEABILITY ====================

  // Track item by barcode
  async trackItem(barcode: string) {
    const item = await prisma.sterilizationItem.findFirst({
      where: { barcode },
      include: {
        cycleItems: {
          include: { cycle: true },
          orderBy: { cycle: { startTime: 'desc' } },
          take: 20,
        },
      },
    });

    if (!item) return null;

    return {
      item,
      history: item.cycleItems.map(ci => ({
        cycleNumber: ci.cycle.cycleNumber,
        machine: ci.cycle.machineName,
        method: ci.cycle.method,
        date: ci.cycle.startTime,
        status: ci.status,
        sterilizedAt: ci.sterilizedAt,
        expiresAt: ci.expiresAt,
      })),
      currentStatus: item.status,
      lastSterilized: item.lastSterilizedAt,
      totalCycles: item.sterilizationCount,
    };
  },

  // Get expiring items
  async getExpiringItems(hospitalId: string, daysAhead: number = 7) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysAhead);

    const cycleItems = await prisma.sterilizationCycleItem.findMany({
      where: {
        cycle: { hospitalId },
        status: 'STERILE',
        expiresAt: {
          lte: expiryDate,
          gte: new Date(),
        },
      },
      include: {
        item: true,
        cycle: true,
      },
      orderBy: { expiresAt: 'asc' },
    });

    return cycleItems.map(ci => ({
      item: ci.item,
      sterilizedAt: ci.sterilizedAt,
      expiresAt: ci.expiresAt,
      daysUntilExpiry: Math.ceil(
        ((ci.expiresAt as Date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      ),
      cycleNumber: ci.cycle.cycleNumber,
    }));
  },

  // ==================== AI FEATURES ====================

  // AI: Predict cycle outcome
  predictCycleOutcome(data: {
    method: string;
    temperature: number;
    pressure: number;
    duration: number;
    itemCount: number;
    machineAge: number;
    lastMaintenanceDays: number;
  }): {
    predictedSuccess: boolean;
    confidence: number;
    riskFactors: string[];
    recommendations: string[];
  } {
    const riskFactors: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // Temperature analysis
    const optimalTemp: Record<string, { min: number; max: number }> = {
      'STEAM': { min: 121, max: 134 },
      'ETO': { min: 37, max: 63 },
      'PLASMA': { min: 45, max: 55 },
      'DRY_HEAT': { min: 160, max: 180 },
    };

    const tempRange = optimalTemp[data.method];
    if (tempRange) {
      if (data.temperature < tempRange.min) {
        riskFactors.push(`Temperature below optimal (${tempRange.min}°C minimum)`);
        riskScore += 30;
        recommendations.push(`Increase temperature to at least ${tempRange.min}°C`);
      } else if (data.temperature > tempRange.max) {
        riskFactors.push(`Temperature above optimal (${tempRange.max}°C maximum)`);
        riskScore += 10;
      }
    }

    // Pressure analysis (for steam)
    if (data.method === 'STEAM') {
      if (data.pressure < 103) {
        riskFactors.push('Pressure below required level for steam sterilization');
        riskScore += 25;
        recommendations.push('Ensure pressure reaches at least 103 kPa');
      }
    }

    // Duration analysis
    const minDuration: Record<string, number> = {
      'STEAM': 15,
      'ETO': 120,
      'PLASMA': 45,
      'DRY_HEAT': 60,
    };

    if (data.duration < (minDuration[data.method] || 30)) {
      riskFactors.push('Cycle duration may be insufficient');
      riskScore += 20;
      recommendations.push(`Extend cycle time to at least ${minDuration[data.method]} minutes`);
    }

    // Load analysis
    if (data.itemCount > 50) {
      riskFactors.push('High item load may affect sterilization efficacy');
      riskScore += 15;
      recommendations.push('Consider splitting into multiple cycles');
    }

    // Machine maintenance
    if (data.lastMaintenanceDays > 30) {
      riskFactors.push('Machine maintenance overdue');
      riskScore += 15;
      recommendations.push('Schedule preventive maintenance');
    }

    if (data.machineAge > 10) {
      riskFactors.push('Aging equipment may have reduced reliability');
      riskScore += 10;
    }

    const confidence = Math.max(0.6, 1 - (riskScore / 200));
    const predictedSuccess = riskScore < 40;

    if (riskFactors.length === 0) {
      recommendations.push('Parameters are within optimal range');
    }

    return {
      predictedSuccess,
      confidence,
      riskFactors,
      recommendations,
    };
  },

  // AI: Optimize sterilization schedule
  optimizeSterilizationSchedule(data: {
    pendingItems: { id: string; method: string; priority: string; department: string }[];
    machines: { id: string; method: string; capacity: number; available: boolean }[];
    urgentSurgeries: { time: Date; instrumentsNeeded: string[] }[];
  }): {
    schedule: { machineId: string; items: string[]; startTime: Date; priority: string }[];
    recommendations: string[];
  } {
    const schedule: { machineId: string; items: string[]; startTime: Date; priority: string }[] = [];
    const recommendations: string[] = [];

    // Group items by method
    const itemsByMethod: Record<string, typeof data.pendingItems> = {};
    data.pendingItems.forEach(item => {
      if (!itemsByMethod[item.method]) {
        itemsByMethod[item.method] = [];
      }
      itemsByMethod[item.method].push(item);
    });

    // Sort by priority
    Object.values(itemsByMethod).forEach(items => {
      items.sort((a, b) => {
        const priorityOrder: Record<string, number> = { 'EMERGENCY': 0, 'URGENT': 1, 'ROUTINE': 2 };
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      });
    });

    // Assign to machines
    const availableMachines = data.machines.filter(m => m.available);
    let currentTime = new Date();

    Object.entries(itemsByMethod).forEach(([method, items]) => {
      const compatibleMachines = availableMachines.filter(m => m.method === method);

      if (compatibleMachines.length === 0) {
        recommendations.push(`No available ${method} sterilizer for ${items.length} items`);
        return;
      }

      let itemIndex = 0;
      compatibleMachines.forEach(machine => {
        const batchItems = items.slice(itemIndex, itemIndex + machine.capacity);
        if (batchItems.length > 0) {
          schedule.push({
            machineId: machine.id,
            items: batchItems.map(i => i.id),
            startTime: new Date(currentTime),
            priority: batchItems[0].priority,
          });
          itemIndex += machine.capacity;
        }
      });

      if (itemIndex < items.length) {
        recommendations.push(`${items.length - itemIndex} ${method} items pending - insufficient capacity`);
      }
    });

    // Check urgent surgeries
    data.urgentSurgeries.forEach(surgery => {
      const timeUntilSurgery = (surgery.time.getTime() - currentTime.getTime()) / (1000 * 60);
      if (timeUntilSurgery < 120) {
        recommendations.push(`Urgent: Surgery in ${Math.round(timeUntilSurgery)} minutes needs instruments`);
      }
    });

    return { schedule, recommendations };
  },

  // AI: Quality analysis
  analyzeQualityMetrics(hospitalId: string, data: {
    totalCycles: number;
    failedCycles: number;
    biologicalFailures: number;
    chemicalFailures: number;
    machineDowntime: number;
    averageTurnaround: number;
  }): {
    score: number;
    grade: string;
    metrics: { name: string; value: number; benchmark: number; status: string }[];
    recommendations: string[];
  } {
    const metrics: { name: string; value: number; benchmark: number; status: string }[] = [];
    const recommendations: string[] = [];

    // Success rate
    const successRate = data.totalCycles > 0
      ? ((data.totalCycles - data.failedCycles) / data.totalCycles) * 100
      : 100;
    metrics.push({
      name: 'Cycle Success Rate',
      value: successRate,
      benchmark: 99,
      status: successRate >= 99 ? 'GOOD' : successRate >= 97 ? 'WARNING' : 'CRITICAL',
    });

    if (successRate < 99) {
      recommendations.push('Review sterilization protocols and equipment calibration');
    }

    // Biological indicator pass rate
    const bioPassRate = data.totalCycles > 0
      ? ((data.totalCycles - data.biologicalFailures) / data.totalCycles) * 100
      : 100;
    metrics.push({
      name: 'Biological Indicator Pass Rate',
      value: bioPassRate,
      benchmark: 100,
      status: bioPassRate === 100 ? 'GOOD' : 'CRITICAL',
    });

    if (bioPassRate < 100) {
      recommendations.push('Immediate investigation required for biological indicator failures');
    }

    // Machine uptime
    const uptime = 100 - data.machineDowntime;
    metrics.push({
      name: 'Equipment Uptime',
      value: uptime,
      benchmark: 95,
      status: uptime >= 95 ? 'GOOD' : uptime >= 90 ? 'WARNING' : 'CRITICAL',
    });

    if (uptime < 95) {
      recommendations.push('Schedule preventive maintenance to improve equipment reliability');
    }

    // Turnaround time
    metrics.push({
      name: 'Average Turnaround (minutes)',
      value: data.averageTurnaround,
      benchmark: 60,
      status: data.averageTurnaround <= 60 ? 'GOOD' : data.averageTurnaround <= 90 ? 'WARNING' : 'CRITICAL',
    });

    if (data.averageTurnaround > 60) {
      recommendations.push('Optimize workflow to reduce instrument turnaround time');
    }

    // Calculate overall score
    const scores = metrics.map(m => {
      if (m.status === 'GOOD') return 100;
      if (m.status === 'WARNING') return 70;
      return 40;
    });
    const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    let grade: string;
    if (score >= 95) grade = 'A';
    else if (score >= 85) grade = 'B';
    else if (score >= 75) grade = 'C';
    else if (score >= 65) grade = 'D';
    else grade = 'F';

    return { score, grade, metrics, recommendations };
  },

  // Get CSSD dashboard stats
  async getDashboardStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalItems,
      sterileItems,
      inSterilization,
      todayCycles,
      pendingCycles,
      expiringItems,
    ] = await Promise.all([
      prisma.sterilizationItem.count({ where: { hospitalId } }),
      prisma.sterilizationItem.count({ where: { hospitalId, status: 'STERILE' } }),
      prisma.sterilizationItem.count({ where: { hospitalId, status: 'IN_STERILIZATION' } }),
      prisma.sterilizationCycle.count({
        where: { hospitalId, startTime: { gte: today } },
      }),
      prisma.sterilizationCycle.count({
        where: { hospitalId, status: 'PENDING' },
      }),
      prisma.sterilizationCycleItem.count({
        where: {
          cycle: { hospitalId },
          status: 'STERILE',
          expiresAt: {
            lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
            gte: today,
          },
        },
      }),
    ]);

    return {
      totalItems,
      sterileItems,
      inSterilization,
      todayCycles,
      pendingCycles,
      expiringItems,
      sterilePercentage: totalItems > 0 ? Math.round((sterileItems / totalItems) * 100) : 0,
    };
  },
};
