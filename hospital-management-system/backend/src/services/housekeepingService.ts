import prisma from '../config/database';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import { Prisma } from '@prisma/client';

export class HousekeepingService {
  // ==================== ZONES ====================

  async getZones(hospitalId: string) {
    return prisma.housekeepingZone.findMany({
      where: { hospitalId, isActive: true },
      include: {
        _count: {
          select: { tasks: true, schedules: true },
        },
      },
      orderBy: [{ floor: 'asc' }, { name: 'asc' }],
    });
  }

  async createZone(data: any) {
    // Generate zone code
    const count = await prisma.housekeepingZone.count({ where: { hospitalId: data.hospitalId } });
    const code = `ZONE-${String(count + 1).padStart(3, '0')}`;

    return prisma.housekeepingZone.create({
      data: { ...data, code },
    });
  }

  async updateZone(id: string, data: any) {
    return prisma.housekeepingZone.update({ where: { id }, data });
  }

  // ==================== TASKS ====================

  async getTasks(params: {
    hospitalId: string;
    zoneId?: string;
    status?: string;
    priority?: string;
    assignedTo?: string;
    taskType?: string;
    date?: Date;
    page?: number;
    limit?: number;
  }) {
    const { hospitalId, zoneId, status, priority, assignedTo, taskType, date, page = 1, limit = 20 } = params;

    const where: Prisma.HousekeepingTaskWhereInput = {
      hospitalId,
      ...(zoneId && { zoneId }),
      ...(status && { status: status as any }),
      ...(priority && { priority: priority as any }),
      ...(assignedTo && { assignedTo }),
      ...(taskType && { taskType: taskType as any }),
      ...(date && {
        scheduledStart: {
          gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
          lt: new Date(new Date(date).setHours(23, 59, 59, 999)),
        },
      }),
    };

    const [tasks, total] = await Promise.all([
      prisma.housekeepingTask.findMany({
        where,
        include: {
          zone: { select: { id: true, name: true, floor: true } },
          assignee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
          supervisor: { select: { id: true, firstName: true, lastName: true } },
          checklistItems: true,
        },
        orderBy: [{ priority: 'desc' }, { scheduledStart: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.housekeepingTask.count({ where }),
    ]);

    return {
      tasks,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTaskById(id: string) {
    const task = await prisma.housekeepingTask.findUnique({
      where: { id },
      include: {
        zone: true,
        assignee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, phone: true } },
        supervisor: { select: { id: true, firstName: true, lastName: true } },
        checklistItems: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!task) throw new NotFoundError('Task not found');
    return task;
  }

  async createTask(data: any) {
    // Get checklist template if available
    const checklist = await prisma.cleaningChecklist.findFirst({
      where: { hospitalId: data.hospitalId, taskType: data.taskType, isActive: true },
    });

    const task = await prisma.housekeepingTask.create({
      data: {
        hospitalId: data.hospitalId,
        zoneId: data.zoneId,
        roomNumber: data.roomNumber,
        bedId: data.bedId,
        taskType: data.taskType,
        priority: data.priority || 'NORMAL',
        status: data.assignedTo ? 'ASSIGNED' : 'PENDING',
        assignedTo: data.assignedTo,
        assignedAt: data.assignedTo ? new Date() : null,
        supervisorId: data.supervisorId,
        scheduledStart: data.scheduledStart,
        scheduledEnd: data.scheduledEnd,
        estimatedMinutes: data.estimatedMinutes || 30,
        description: data.description,
        specialInstructions: data.specialInstructions,
        infectionControl: data.infectionControl || false,
        isDischargeClean: data.isDischargeClean || false,
        patientId: data.patientId,
      },
      include: { zone: true, assignee: true },
    });

    // Create checklist items from template
    if (checklist && checklist.items) {
      const items = checklist.items as any[];
      for (let i = 0; i < items.length; i++) {
        await prisma.taskChecklistItem.create({
          data: {
            taskId: task.id,
            itemName: items[i].name || items[i],
            sequence: i + 1,
          },
        });
      }
    }

    return this.getTaskById(task.id);
  }

  async updateTask(id: string, data: any) {
    return prisma.housekeepingTask.update({
      where: { id },
      data,
      include: { zone: true, assignee: true },
    });
  }

  async assignTask(taskId: string, employeeId: string, supervisorId?: string) {
    return prisma.housekeepingTask.update({
      where: { id: taskId },
      data: {
        assignedTo: employeeId,
        assignedAt: new Date(),
        supervisorId,
        status: 'ASSIGNED',
      },
      include: { zone: true, assignee: true },
    });
  }

  async startTask(taskId: string) {
    const task = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task not found');
    if (task.status !== 'ASSIGNED') {
      throw new AppError('Task must be assigned before starting');
    }

    return prisma.housekeepingTask.update({
      where: { id: taskId },
      data: {
        status: 'IN_PROGRESS',
        actualStart: new Date(),
      },
    });
  }

  async completeTask(taskId: string, data: { notes?: string; photosAfter?: string[] }) {
    const task = await prisma.housekeepingTask.findUnique({
      where: { id: taskId },
      include: { checklistItems: true },
    });

    if (!task) throw new NotFoundError('Task not found');
    if (task.status !== 'IN_PROGRESS') {
      throw new AppError('Task must be in progress to complete');
    }

    // Check if all checklist items are completed
    const incompleteItems = task.checklistItems.filter(item => !item.isCompleted);
    if (incompleteItems.length > 0) {
      throw new AppError(`Please complete all checklist items. ${incompleteItems.length} items remaining.`);
    }

    return prisma.housekeepingTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        actualEnd: new Date(),
        checklistCompleted: true,
        notes: data.notes,
        photosAfter: data.photosAfter || [],
      },
    });
  }

  async verifyTask(taskId: string, verifiedBy: string, qualityScore: number) {
    const task = await prisma.housekeepingTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundError('Task not found');
    if (task.status !== 'COMPLETED') {
      throw new AppError('Task must be completed to verify');
    }

    const status = qualityScore >= 7 ? 'VERIFIED' : 'REJECTED';

    return prisma.housekeepingTask.update({
      where: { id: taskId },
      data: {
        status,
        qualityScore,
        verifiedBy,
        verifiedAt: new Date(),
      },
    });
  }

  async updateChecklistItem(itemId: string, isCompleted: boolean, notes?: string) {
    return prisma.taskChecklistItem.update({
      where: { id: itemId },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        notes,
      },
    });
  }

  // ==================== SCHEDULES ====================

  async getSchedules(hospitalId: string, zoneId?: string) {
    return prisma.cleaningSchedule.findMany({
      where: {
        hospitalId,
        isActive: true,
        ...(zoneId && { zoneId }),
      },
      include: { zone: { select: { id: true, name: true, floor: true } } },
      orderBy: [{ scheduledTime: 'asc' }],
    });
  }

  async createSchedule(data: any) {
    const schedule = await prisma.cleaningSchedule.create({
      data: {
        hospitalId: data.hospitalId,
        zoneId: data.zoneId,
        roomNumber: data.roomNumber,
        taskType: data.taskType,
        frequency: data.frequency,
        dayOfWeek: data.dayOfWeek,
        dayOfMonth: data.dayOfMonth,
        scheduledTime: data.scheduledTime,
        duration: data.duration || 30,
        assignedTeam: data.assignedTeam,
      },
    });

    // Calculate next scheduled date
    await this.updateNextScheduled(schedule.id);

    return schedule;
  }

  async updateNextScheduled(scheduleId: string) {
    const schedule = await prisma.cleaningSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) return;

    const now = new Date();
    let nextDate = new Date();

    switch (schedule.frequency) {
      case 'HOURLY':
        nextDate.setHours(nextDate.getHours() + 1);
        break;
      case 'TWICE_DAILY':
        nextDate.setHours(nextDate.getHours() + 12);
        break;
      case 'DAILY':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'ALTERNATE_DAYS':
        nextDate.setDate(nextDate.getDate() + 2);
        break;
      case 'WEEKLY':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'BI_WEEKLY':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'QUARTERLY':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      default:
        return;
    }

    const [hour, min] = schedule.scheduledTime.split(':').map(Number);
    nextDate.setHours(hour, min, 0, 0);

    await prisma.cleaningSchedule.update({
      where: { id: scheduleId },
      data: { nextScheduled: nextDate },
    });
  }

  // Generate tasks from schedules
  async generateScheduledTasks(hospitalId: string) {
    const now = new Date();
    const schedules = await prisma.cleaningSchedule.findMany({
      where: {
        hospitalId,
        isActive: true,
        OR: [
          { nextScheduled: { lte: now } },
          { nextScheduled: null },
        ],
      },
    });

    const tasks = [];

    for (const schedule of schedules) {
      // Check if task already exists for today
      const existingTask = await prisma.housekeepingTask.findFirst({
        where: {
          hospitalId,
          zoneId: schedule.zoneId,
          roomNumber: schedule.roomNumber,
          taskType: schedule.taskType,
          scheduledStart: {
            gte: new Date(now.setHours(0, 0, 0, 0)),
            lt: new Date(now.setHours(23, 59, 59, 999)),
          },
        },
      });

      if (!existingTask) {
        const scheduledStart = new Date();
        const [hour, min] = schedule.scheduledTime.split(':').map(Number);
        scheduledStart.setHours(hour, min, 0, 0);

        const scheduledEnd = new Date(scheduledStart);
        scheduledEnd.setMinutes(scheduledEnd.getMinutes() + schedule.duration);

        const task = await this.createTask({
          hospitalId,
          zoneId: schedule.zoneId,
          roomNumber: schedule.roomNumber,
          taskType: schedule.taskType,
          priority: 'NORMAL',
          scheduledStart,
          scheduledEnd,
          estimatedMinutes: schedule.duration,
        });

        tasks.push(task);
      }

      // Update next scheduled and last executed
      await prisma.cleaningSchedule.update({
        where: { id: schedule.id },
        data: { lastExecuted: now },
      });
      await this.updateNextScheduled(schedule.id);
    }

    return tasks;
  }

  // ==================== INVENTORY ====================

  async getInventory(hospitalId: string, params?: { category?: string; lowStock?: boolean }) {
    const where: Prisma.HousekeepingInventoryWhereInput = {
      hospitalId,
      isActive: true,
      ...(params?.category && { category: params.category as any }),
      ...(params?.lowStock && {
        currentStock: { lte: prisma.housekeepingInventory.fields.reorderLevel },
      }),
    };

    return prisma.housekeepingInventory.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async getLowStockItems(hospitalId: string) {
    return prisma.$queryRaw`
      SELECT * FROM housekeeping_inventory
      WHERE hospital_id = ${hospitalId}
      AND is_active = true
      AND current_stock <= reorder_level
      ORDER BY current_stock ASC
    `;
  }

  async createInventoryItem(data: any) {
    const count = await prisma.housekeepingInventory.count({ where: { hospitalId: data.hospitalId } });
    const code = `HK-${String(count + 1).padStart(4, '0')}`;

    return prisma.housekeepingInventory.create({
      data: { ...data, code },
    });
  }

  async updateInventoryStock(id: string, quantity: number, action: 'ADD' | 'USE', usedBy?: string, taskId?: string, notes?: string) {
    const item = await prisma.housekeepingInventory.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Inventory item not found');

    const newStock = action === 'ADD'
      ? item.currentStock + quantity
      : item.currentStock - quantity;

    if (newStock < 0) {
      throw new AppError('Insufficient stock');
    }

    // Record usage if deducting
    if (action === 'USE' && usedBy) {
      await prisma.inventoryUsage.create({
        data: {
          inventoryId: id,
          usedBy,
          quantity,
          taskId,
          notes,
        },
      });
    }

    return prisma.housekeepingInventory.update({
      where: { id },
      data: {
        currentStock: newStock,
        ...(action === 'ADD' && { lastRestocked: new Date() }),
      },
    });
  }

  // ==================== QUALITY AUDITS ====================

  async getAudits(params: {
    hospitalId: string;
    zoneId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { hospitalId, zoneId, status, startDate, endDate, page = 1, limit = 20 } = params;

    const where: Prisma.QualityAuditWhereInput = {
      hospitalId,
      ...(zoneId && { zoneId }),
      ...(status && { status: status as any }),
      ...(startDate && endDate && {
        auditDate: { gte: startDate, lte: endDate },
      }),
    };

    const [audits, total] = await Promise.all([
      prisma.qualityAudit.findMany({
        where,
        include: {
          auditor: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { auditDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.qualityAudit.count({ where }),
    ]);

    return {
      audits,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createAudit(data: any) {
    const overallScore = (
      data.cleanlinessScore +
      data.sanitizationScore +
      data.organizationScore +
      data.safetyScore
    ) / 4;

    return prisma.qualityAudit.create({
      data: {
        hospitalId: data.hospitalId,
        zoneId: data.zoneId,
        roomNumber: data.roomNumber,
        auditType: data.auditType,
        auditorId: data.auditorId,
        auditDate: data.auditDate || new Date(),
        cleanlinessScore: data.cleanlinessScore,
        sanitizationScore: data.sanitizationScore,
        organizationScore: data.organizationScore,
        safetyScore: data.safetyScore,
        overallScore,
        findings: data.findings || [],
        recommendations: data.recommendations || [],
        photosUrl: data.photosUrl || [],
        status: overallScore < 7 ? 'REQUIRES_ACTION' : 'COMPLETED',
        followUpDate: overallScore < 7 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
      },
      include: { auditor: true },
    });
  }

  async resolveAudit(id: string, resolvedBy: string) {
    return prisma.qualityAudit.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy,
      },
    });
  }

  // ==================== CHECKLISTS ====================

  async getChecklists(hospitalId: string, taskType?: string) {
    return prisma.cleaningChecklist.findMany({
      where: {
        hospitalId,
        isActive: true,
        ...(taskType && { taskType: taskType as any }),
      },
    });
  }

  async createChecklist(data: any) {
    return prisma.cleaningChecklist.create({ data });
  }

  async updateChecklist(id: string, data: any) {
    return prisma.cleaningChecklist.update({ where: { id }, data });
  }

  // ==================== DASHBOARD ====================

  async getDashboardStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalZones,
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedToday,
      verifiedToday,
      lowStockItems,
      pendingAudits,
    ] = await Promise.all([
      prisma.housekeepingZone.count({ where: { hospitalId, isActive: true } }),
      prisma.housekeepingTask.count({ where: { hospitalId } }),
      prisma.housekeepingTask.count({ where: { hospitalId, status: 'PENDING' } }),
      prisma.housekeepingTask.count({ where: { hospitalId, status: 'IN_PROGRESS' } }),
      prisma.housekeepingTask.count({
        where: {
          hospitalId,
          status: 'COMPLETED',
          actualEnd: { gte: today, lt: tomorrow },
        },
      }),
      prisma.housekeepingTask.count({
        where: {
          hospitalId,
          status: 'VERIFIED',
          verifiedAt: { gte: today, lt: tomorrow },
        },
      }),
      prisma.$queryRaw<any[]>`
        SELECT COUNT(*) as count FROM housekeeping_inventory
        WHERE "hospitalId" = ${hospitalId}
        AND "isActive" = true
        AND "currentStock" <= "reorderLevel"
      `,
      prisma.qualityAudit.count({
        where: { hospitalId, status: 'REQUIRES_ACTION' },
      }),
    ]);

    // Task completion rate
    const completionRate = totalTasks > 0
      ? ((completedToday + verifiedToday) / totalTasks * 100).toFixed(1)
      : 0;

    // Tasks by priority
    const tasksByPriority = await prisma.housekeepingTask.groupBy({
      by: ['priority'],
      where: { hospitalId, status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } },
      _count: true,
    });

    // Tasks by zone
    const tasksByZone = await prisma.housekeepingTask.groupBy({
      by: ['zoneId'],
      where: { hospitalId, status: { in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } },
      _count: true,
    });

    // Average quality score this month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const avgQualityResult = await prisma.qualityAudit.aggregate({
      where: {
        hospitalId,
        auditDate: { gte: monthStart },
      },
      _avg: { overallScore: true },
    });

    return {
      totalZones,
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedToday,
      verifiedToday,
      lowStockItems: Number(lowStockItems[0]?.count || 0),
      pendingAudits,
      completionRate,
      avgQualityScore: avgQualityResult._avg.overallScore?.toFixed(1) || 0,
      tasksByPriority,
      tasksByZone,
    };
  }

  // ==================== AI FEATURES ====================

  // AI-based task prioritization
  async getAIPrioritizedTasks(hospitalId: string) {
    // Get all pending/assigned tasks
    const tasks = await prisma.housekeepingTask.findMany({
      where: {
        hospitalId,
        status: { in: ['PENDING', 'ASSIGNED'] },
      },
      include: { zone: true },
    });

    // AI prioritization factors:
    // 1. Infection control rooms get highest priority
    // 2. Discharge cleaning (bed turnaround)
    // 3. Emergency/Urgent priorities
    // 4. ICU/Critical care areas
    // 5. Overdue tasks

    const prioritizedTasks = tasks.map(task => {
      let aiScore = 0;

      // Infection control
      if (task.infectionControl) aiScore += 50;

      // Discharge cleaning
      if (task.isDischargeClean) aiScore += 40;

      // Priority level
      switch (task.priority) {
        case 'EMERGENCY': aiScore += 35; break;
        case 'URGENT': aiScore += 25; break;
        case 'HIGH': aiScore += 15; break;
        case 'NORMAL': aiScore += 5; break;
      }

      // Zone type (ICU, etc.)
      if (task.zone?.name?.toLowerCase().includes('icu')) aiScore += 20;
      if (task.zone?.name?.toLowerCase().includes('ot')) aiScore += 20;
      if (task.zone?.name?.toLowerCase().includes('emergency')) aiScore += 15;

      // Overdue tasks
      if (task.scheduledStart && new Date() > task.scheduledStart) {
        const hoursOverdue = (Date.now() - task.scheduledStart.getTime()) / (1000 * 60 * 60);
        aiScore += Math.min(hoursOverdue * 5, 30);
      }

      return { ...task, aiScore };
    });

    // Sort by AI score descending
    prioritizedTasks.sort((a, b) => b.aiScore - a.aiScore);

    // Save AI recommendation
    await prisma.aICleaningPriority.create({
      data: {
        hospitalId,
        date: new Date(),
        priorities: prioritizedTasks.slice(0, 20).map(t => ({ taskId: t.id, score: t.aiScore })),
        factors: {
          infectionControl: true,
          dischargeClean: true,
          priorityLevel: true,
          zoneType: true,
          overdue: true,
        },
        confidence: 0.85,
      },
    });

    return prioritizedTasks;
  }

  // Predict cleaning time based on task type and zone
  async predictCleaningTime(taskType: string, zoneId: string) {
    // Get historical data
    const completedTasks = await prisma.housekeepingTask.findMany({
      where: {
        taskType: taskType as any,
        zoneId,
        status: 'VERIFIED',
        actualStart: { not: null },
        actualEnd: { not: null },
      },
      take: 50,
      orderBy: { actualEnd: 'desc' },
    });

    if (completedTasks.length < 5) {
      // Not enough data, return default
      return { estimatedMinutes: 30, confidence: 0.5 };
    }

    // Calculate average duration
    const durations = completedTasks.map(t => {
      if (t.actualStart && t.actualEnd) {
        return (t.actualEnd.getTime() - t.actualStart.getTime()) / 60000;
      }
      return 30;
    });

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
    const confidence = Math.max(0.5, 1 - (Math.sqrt(variance) / avgDuration));

    return {
      estimatedMinutes: Math.round(avgDuration),
      confidence: Math.round(confidence * 100) / 100,
      sampleSize: completedTasks.length,
    };
  }
}

export const housekeepingService = new HousekeepingService();
