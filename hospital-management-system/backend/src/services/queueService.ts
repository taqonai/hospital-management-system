import prisma from '../config/database';
import { AppError, NotFoundError } from '../middleware/errorHandler';

// ==================== QUEUE TICKET MANAGEMENT ====================

interface IssueTicketDto {
  patientId?: string;
  patientName: string;
  patientPhone?: string;
  appointmentId?: string;
  departmentId?: string;
  serviceType: string;
  priority?: string;
  notes?: string;
  urgencyLevel?: string;
}

interface CallNextDto {
  counterId: string;
  staffId: string;
}

export const queueService = {
  // Issue a new queue ticket - ATOMIC operation to prevent race conditions
  async issueTicket(hospitalId: string, data: IssueTicketDto) {
    // Get queue config for this service type
    const config = await prisma.queueConfig.findFirst({
      where: {
        hospitalId,
        serviceType: data.serviceType,
        isActive: true,
      },
    });

    // Default config if none exists
    const prefix = config?.prefix || this.getDefaultPrefix(data.serviceType);

    // Get today's date boundary
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use transaction to ensure atomic ticket number generation
    const result = await prisma.$transaction(async (tx) => {
      // Get the last ticket number for today using MAX approach (atomic)
      const lastTicket = await tx.queueTicket.findFirst({
        where: {
          hospitalId,
          serviceType: data.serviceType,
          issuedAt: { gte: today },
        },
        orderBy: { issuedAt: 'desc' },
        select: { ticketNumber: true },
      });

      // Extract the number from the last ticket or start at 0
      let lastNumber = 0;
      if (lastTicket?.ticketNumber) {
        const match = lastTicket.ticketNumber.match(/\d+$/);
        if (match) {
          lastNumber = parseInt(match[0], 10);
        }
      }

      const nextNumber = lastNumber + 1;
      const ticketNumber = `${prefix}${String(nextNumber).padStart(3, '0')}`;
      const tokenDisplay = `${prefix}-${String(nextNumber).padStart(3, '0')}`;

      // Get current queue position
      const waitingCount = await tx.queueTicket.count({
        where: {
          hospitalId,
          serviceType: data.serviceType,
          status: { in: ['WAITING', 'CALLED'] },
          issuedAt: { gte: today },
        },
      });

      // Calculate AI priority score
      const aiPriorityScore = this.calculatePriorityScore(
        data.priority || 'NORMAL',
        data.urgencyLevel
      );

      // Create the ticket within the transaction
      const ticket = await tx.queueTicket.create({
        data: {
          hospitalId,
          ticketNumber,
          tokenDisplay,
          patientId: data.patientId,
          patientName: data.patientName,
          patientPhone: data.patientPhone,
          appointmentId: data.appointmentId,
          departmentId: data.departmentId,
          serviceType: data.serviceType,
          priority: data.priority as any || 'NORMAL',
          status: 'WAITING',
          queuePosition: waitingCount + 1,
          initialPosition: waitingCount + 1,
          estimatedWaitTime: 10, // Will be calculated outside transaction
          aiPriorityScore,
          aiRecommendedCounter: null, // Will be set outside transaction
          urgencyLevel: data.urgencyLevel,
          notes: data.notes,
        },
      });

      return { ticket, waitingCount };
    });

    const { ticket, waitingCount } = result;

    // Calculate estimated wait time (outside transaction for performance)
    const estimatedWaitTime = await this.calculateEstimatedWaitTime(
      hospitalId,
      data.serviceType,
      waitingCount,
      data.priority || 'NORMAL'
    );

    // Find optimal counter (outside transaction)
    const aiRecommendedCounter = await this.findOptimalCounter(
      hospitalId,
      data.serviceType
    );

    // Update ticket with calculated values
    const updatedTicket = await prisma.queueTicket.update({
      where: { id: ticket.id },
      data: {
        estimatedWaitTime,
        aiRecommendedCounter,
      },
    });

    // Update analytics
    await this.updateAnalytics(hospitalId, data.serviceType, data.departmentId);

    return {
      ...updatedTicket,
      estimatedWaitTime,
      queuePosition: waitingCount + 1,
      totalWaiting: waitingCount + 1,
    };
  },

  // Get default prefix for service type
  getDefaultPrefix(serviceType: string): string {
    const prefixes: Record<string, string> = {
      registration: 'R',
      consultation: 'C',
      billing: 'B',
      pharmacy: 'P',
      laboratory: 'L',
      radiology: 'X',
      vaccination: 'V',
      blood_collection: 'BC',
      report_collection: 'RC',
      opd: 'O',
      emergency: 'E',
      general: 'G',
    };
    return prefixes[serviceType.toLowerCase()] || 'T';
  },

  // Calculate estimated wait time using AI/ML approach
  async calculateEstimatedWaitTime(
    hospitalId: string,
    serviceType: string,
    queuePosition: number,
    priority: string
  ): Promise<number> {
    // Get average service time from recent data
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    const recentTickets = await prisma.queueTicket.findMany({
      where: {
        hospitalId,
        serviceType,
        status: 'COMPLETED',
        completedAt: { gte: lastHour },
      },
      select: { serviceTime: true },
    });

    // Calculate average service time
    let avgServiceTime = 10; // default 10 minutes
    if (recentTickets.length > 0) {
      const totalTime = recentTickets.reduce((sum, t) => sum + (t.serviceTime || 10), 0);
      avgServiceTime = Math.round(totalTime / recentTickets.length);
    }

    // Get active counters for this service
    const counterType = this.mapServiceToCounterType(serviceType);
    const activeCounters = await prisma.queueCounter.count({
      where: {
        hospitalId,
        isActive: true,
        OR: [
          { counterType: counterType as any },
          { servicesOffered: { has: serviceType } },
        ],
      },
    });

    const countersServing = Math.max(activeCounters, 1);

    // Priority multiplier (higher priority = less wait)
    const priorityMultiplier = this.getPriorityMultiplier(priority);

    // Calculate wait time
    const baseWaitTime = (queuePosition * avgServiceTime) / countersServing;
    const adjustedWaitTime = Math.round(baseWaitTime * priorityMultiplier);

    return Math.max(adjustedWaitTime, 1);
  },

  mapServiceToCounterType(serviceType: string): string {
    const mapping: Record<string, string> = {
      registration: 'REGISTRATION',
      consultation: 'CONSULTATION',
      billing: 'BILLING',
      pharmacy: 'PHARMACY',
      laboratory: 'LABORATORY',
      radiology: 'RADIOLOGY',
      vaccination: 'VACCINATION',
      blood_collection: 'BLOOD_COLLECTION',
      report_collection: 'REPORT_COLLECTION',
    };
    return mapping[serviceType.toLowerCase()] || 'GENERAL';
  },

  getPriorityMultiplier(priority: string): number {
    const multipliers: Record<string, number> = {
      EMERGENCY: 0.1,
      HIGH: 0.3,
      VIP: 0.4,
      PREGNANT: 0.5,
      DISABLED: 0.5,
      SENIOR_CITIZEN: 0.6,
      CHILD: 0.7,
      NORMAL: 1.0,
      LOW: 1.2,
    };
    return multipliers[priority] || 1.0;
  },

  calculatePriorityScore(priority: string, urgencyLevel?: string): number {
    let score = 50; // Base score

    // Priority contribution
    const priorityScores: Record<string, number> = {
      EMERGENCY: 100,
      HIGH: 80,
      VIP: 75,
      PREGNANT: 70,
      DISABLED: 70,
      SENIOR_CITIZEN: 65,
      CHILD: 60,
      NORMAL: 50,
      LOW: 30,
    };
    score = priorityScores[priority] || 50;

    // Urgency level contribution
    if (urgencyLevel) {
      const urgencyScores: Record<string, number> = {
        critical: 30,
        high: 20,
        medium: 10,
        low: 0,
      };
      score += urgencyScores[urgencyLevel.toLowerCase()] || 0;
    }

    return Math.min(score, 100);
  },

  async findOptimalCounter(hospitalId: string, serviceType: string): Promise<string | null> {
    const counters = await prisma.queueCounter.findMany({
      where: {
        hospitalId,
        isActive: true,
        OR: [
          { counterType: this.mapServiceToCounterType(serviceType) as any },
          { servicesOffered: { has: serviceType } },
        ],
      },
      include: {
        tickets: {
          where: { status: { in: ['WAITING', 'CALLED', 'SERVING'] } },
        },
      },
    });

    if (counters.length === 0) return null;

    // Find counter with least queue
    let optimalCounter = counters[0];
    let minQueue = optimalCounter.tickets.length;

    for (const counter of counters) {
      if (counter.tickets.length < minQueue) {
        minQueue = counter.tickets.length;
        optimalCounter = counter;
      }
    }

    return optimalCounter.id;
  },

  // Call next patient
  async callNext(hospitalId: string, data: CallNextDto) {
    const counter = await prisma.queueCounter.findUnique({
      where: { id: data.counterId },
    });

    if (!counter || counter.hospitalId !== hospitalId) {
      throw new NotFoundError('Counter not found');
    }

    // Complete current ticket if any
    if (counter.currentTicketId) {
      await prisma.queueTicket.update({
        where: { id: counter.currentTicketId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          serviceTime: this.calculateServiceTime(counter.currentTicketId),
        },
      });
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find next ticket (prioritized)
    const nextTicket = await prisma.queueTicket.findFirst({
      where: {
        hospitalId,
        status: 'WAITING',
        issuedAt: { gte: today },
        OR: [
          { counterId: data.counterId },
          { counterId: null },
        ],
      },
      orderBy: [
        { aiPriorityScore: 'desc' },
        { issuedAt: 'asc' },
      ],
    });

    if (!nextTicket) {
      // Update counter to idle
      await prisma.queueCounter.update({
        where: { id: data.counterId },
        data: {
          currentTicketId: null,
          currentStaffId: data.staffId,
        },
      });
      return null;
    }

    // Update ticket
    const updatedTicket = await prisma.queueTicket.update({
      where: { id: nextTicket.id },
      data: {
        status: 'CALLED',
        calledAt: new Date(),
        counterId: data.counterId,
        callCount: { increment: 1 },
        lastCalledAt: new Date(),
        actualWaitTime: Math.round(
          (Date.now() - nextTicket.issuedAt.getTime()) / 60000
        ),
      },
    });

    // Update counter
    await prisma.queueCounter.update({
      where: { id: data.counterId },
      data: {
        currentTicketId: updatedTicket.id,
        currentStaffId: data.staffId,
      },
    });

    // Create announcement
    await prisma.queueAnnouncement.create({
      data: {
        hospitalId,
        ticketId: updatedTicket.id,
        ticketNumber: updatedTicket.ticketNumber,
        counterNumber: counter.counterNumber,
        counterName: counter.counterName,
        patientName: updatedTicket.patientName,
        announcementText: `Token number ${updatedTicket.tokenDisplay}, please proceed to ${counter.counterName}`,
      },
    });

    // Update queue positions for remaining tickets
    await this.updateQueuePositions(hospitalId, updatedTicket.serviceType);

    return updatedTicket;
  },

  calculateServiceTime(ticketId: string): number {
    // This would calculate actual service time
    return 10; // Placeholder
  },

  async updateQueuePositions(hospitalId: string, serviceType: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const waitingTickets = await prisma.queueTicket.findMany({
      where: {
        hospitalId,
        serviceType,
        status: 'WAITING',
        issuedAt: { gte: today },
      },
      orderBy: [
        { aiPriorityScore: 'desc' },
        { issuedAt: 'asc' },
      ],
    });

    for (let i = 0; i < waitingTickets.length; i++) {
      await prisma.queueTicket.update({
        where: { id: waitingTickets[i].id },
        data: { queuePosition: i + 1 },
      });
    }
  },

  // Start serving a patient
  async startServing(hospitalId: string, ticketId: string, staffId: string) {
    const ticket = await prisma.queueTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.hospitalId !== hospitalId) {
      throw new NotFoundError('Ticket not found');
    }

    if (ticket.status !== 'CALLED') {
      throw new AppError('Ticket must be in CALLED status to start serving');
    }

    return prisma.queueTicket.update({
      where: { id: ticketId },
      data: {
        status: 'SERVING',
        servedAt: new Date(),
        servedBy: staffId,
      },
    });
  },

  // Complete a ticket
  async completeTicket(hospitalId: string, ticketId: string) {
    const ticket = await prisma.queueTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.hospitalId !== hospitalId) {
      throw new NotFoundError('Ticket not found');
    }

    const serviceTime = ticket.servedAt
      ? Math.round((Date.now() - ticket.servedAt.getTime()) / 60000)
      : 10;

    const updated = await prisma.queueTicket.update({
      where: { id: ticketId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        serviceTime,
      },
    });

    // Update counter
    if (ticket.counterId) {
      await prisma.queueCounter.update({
        where: { id: ticket.counterId },
        data: { currentTicketId: null },
      });
    }

    // Update analytics
    await this.updateAnalytics(hospitalId, ticket.serviceType, ticket.departmentId);

    return updated;
  },

  // Mark as no-show
  async markNoShow(hospitalId: string, ticketId: string) {
    const ticket = await prisma.queueTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.hospitalId !== hospitalId) {
      throw new NotFoundError('Ticket not found');
    }

    const updated = await prisma.queueTicket.update({
      where: { id: ticketId },
      data: {
        status: 'NO_SHOW',
        noShowAt: new Date(),
      },
    });

    // Update counter
    if (ticket.counterId) {
      await prisma.queueCounter.update({
        where: { id: ticket.counterId },
        data: { currentTicketId: null },
      });
    }

    await this.updateQueuePositions(hospitalId, ticket.serviceType);

    return updated;
  },

  // Cancel ticket
  async cancelTicket(hospitalId: string, ticketId: string, reason?: string) {
    const ticket = await prisma.queueTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.hospitalId !== hospitalId) {
      throw new NotFoundError('Ticket not found');
    }

    const updated = await prisma.queueTicket.update({
      where: { id: ticketId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
    });

    await this.updateQueuePositions(hospitalId, ticket.serviceType);

    return updated;
  },

  // Transfer ticket to another counter
  async transferTicket(hospitalId: string, ticketId: string, newCounterId: string) {
    const ticket = await prisma.queueTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.hospitalId !== hospitalId) {
      throw new NotFoundError('Ticket not found');
    }

    const newCounter = await prisma.queueCounter.findUnique({
      where: { id: newCounterId },
    });

    if (!newCounter || newCounter.hospitalId !== hospitalId) {
      throw new NotFoundError('Counter not found');
    }

    // Release from current counter
    if (ticket.counterId) {
      await prisma.queueCounter.update({
        where: { id: ticket.counterId },
        data: { currentTicketId: null },
      });
    }

    return prisma.queueTicket.update({
      where: { id: ticketId },
      data: {
        status: 'TRANSFERRED',
        counterId: newCounterId,
      },
    });
  },

  // Get current queue status
  async getQueueStatus(hospitalId: string, serviceType?: string, departmentId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {
      hospitalId,
      issuedAt: { gte: today },
    };

    if (serviceType) where.serviceType = serviceType;
    if (departmentId) where.departmentId = departmentId;

    const [waiting, called, serving, completed, noShow, cancelled] = await Promise.all([
      prisma.queueTicket.count({ where: { ...where, status: 'WAITING' } }),
      prisma.queueTicket.count({ where: { ...where, status: 'CALLED' } }),
      prisma.queueTicket.count({ where: { ...where, status: 'SERVING' } }),
      prisma.queueTicket.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.queueTicket.count({ where: { ...where, status: 'NO_SHOW' } }),
      prisma.queueTicket.count({ where: { ...where, status: 'CANCELLED' } }),
    ]);

    // Calculate average wait time for completed tickets
    const completedTickets = await prisma.queueTicket.findMany({
      where: { ...where, status: 'COMPLETED', actualWaitTime: { not: null } },
      select: { actualWaitTime: true },
    });

    const avgWaitTime = completedTickets.length > 0
      ? Math.round(completedTickets.reduce((sum, t) => sum + (t.actualWaitTime || 0), 0) / completedTickets.length)
      : 0;

    // Get currently serving tickets
    const currentlyServing = await prisma.queueTicket.findMany({
      where: { ...where, status: { in: ['CALLED', 'SERVING'] } },
      include: { counter: true },
      orderBy: { calledAt: 'desc' },
    });

    return {
      summary: {
        waiting,
        called,
        serving,
        completed,
        noShow,
        cancelled,
        total: waiting + called + serving + completed + noShow + cancelled,
      },
      avgWaitTime,
      currentlyServing,
      estimatedWaitForNew: waiting > 0 ? Math.round(avgWaitTime * waiting / Math.max(currentlyServing.length, 1)) : 0,
    };
  },

  // Get queue display data
  async getQueueDisplay(hospitalId: string, boardId?: string) {
    let departmentIds: string[] = [];
    let counterIds: string[] = [];
    let ticketsToShow = 10;

    if (boardId) {
      const board = await prisma.queueDisplayBoard.findUnique({
        where: { id: boardId },
      });
      if (board) {
        departmentIds = board.departmentIds || [];
        counterIds = board.counterIds || [];
        ticketsToShow = board.ticketsToShow;
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {
      hospitalId,
      issuedAt: { gte: today },
    };

    if (departmentIds.length > 0) {
      where.departmentId = { in: departmentIds };
    }

    // Get waiting tickets
    const waitingTickets = await prisma.queueTicket.findMany({
      where: { ...where, status: 'WAITING' },
      orderBy: [
        { aiPriorityScore: 'desc' },
        { issuedAt: 'asc' },
      ],
      take: ticketsToShow,
      select: {
        id: true,
        ticketNumber: true,
        tokenDisplay: true,
        patientName: true,
        serviceType: true,
        priority: true,
        queuePosition: true,
        estimatedWaitTime: true,
        issuedAt: true,
      },
    });

    // Get currently being served
    const servingTickets = await prisma.queueTicket.findMany({
      where: { ...where, status: { in: ['CALLED', 'SERVING'] } },
      include: {
        counter: {
          select: {
            counterNumber: true,
            counterName: true,
            location: true,
          },
        },
      },
      orderBy: { calledAt: 'desc' },
    });

    // Get recent completed (last 5)
    const recentCompleted = await prisma.queueTicket.findMany({
      where: { ...where, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 5,
      select: {
        ticketNumber: true,
        tokenDisplay: true,
        completedAt: true,
      },
    });

    return {
      waiting: waitingTickets,
      serving: servingTickets,
      recentCompleted,
      lastUpdated: new Date(),
    };
  },

  // Get patient's ticket status
  async getPatientTicketStatus(hospitalId: string, ticketId?: string, phone?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let ticket;

    if (ticketId) {
      ticket = await prisma.queueTicket.findUnique({
        where: { id: ticketId },
        include: { counter: true },
      });
    } else if (phone) {
      ticket = await prisma.queueTicket.findFirst({
        where: {
          hospitalId,
          patientPhone: phone,
          issuedAt: { gte: today },
          status: { in: ['WAITING', 'CALLED', 'SERVING'] },
        },
        include: { counter: true },
        orderBy: { issuedAt: 'desc' },
      });
    }

    if (!ticket || ticket.hospitalId !== hospitalId) {
      throw new NotFoundError('Ticket not found');
    }

    // Recalculate estimated wait time if waiting
    let estimatedWaitTime = ticket.estimatedWaitTime;
    if (ticket.status === 'WAITING') {
      estimatedWaitTime = await this.calculateEstimatedWaitTime(
        hospitalId,
        ticket.serviceType,
        ticket.queuePosition,
        ticket.priority
      );
    }

    return {
      ...ticket,
      estimatedWaitTime,
      waitingSince: Math.round((Date.now() - ticket.issuedAt.getTime()) / 60000),
    };
  },

  // Update analytics
  async updateAnalytics(hospitalId: string, serviceType: string, departmentId?: string | null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentHour = new Date().getHours();

    const where: any = {
      hospitalId,
      serviceType,
      issuedAt: { gte: today },
    };
    if (departmentId) where.departmentId = departmentId;

    const tickets = await prisma.queueTicket.findMany({ where });

    const completed = tickets.filter(t => t.status === 'COMPLETED');
    const noShow = tickets.filter(t => t.status === 'NO_SHOW');
    const cancelled = tickets.filter(t => t.status === 'CANCELLED');

    const waitTimes = completed
      .filter(t => t.actualWaitTime)
      .map(t => t.actualWaitTime as number);

    const serviceTimes = completed
      .filter(t => t.serviceTime)
      .map(t => t.serviceTime as number);

    const analyticsData = {
      totalTickets: tickets.length,
      servedTickets: completed.length,
      noShowTickets: noShow.length,
      cancelledTickets: cancelled.length,
      avgWaitTime: waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0,
      minWaitTime: waitTimes.length > 0 ? Math.min(...waitTimes) : 0,
      maxWaitTime: waitTimes.length > 0 ? Math.max(...waitTimes) : 0,
      avgServiceTime: serviceTimes.length > 0 ? serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length : 0,
      minServiceTime: serviceTimes.length > 0 ? Math.min(...serviceTimes) : 0,
      maxServiceTime: serviceTimes.length > 0 ? Math.max(...serviceTimes) : 0,
    };

    // Upsert daily analytics
    await prisma.queueAnalytics.upsert({
      where: {
        hospitalId_departmentId_serviceType_date_hour: {
          hospitalId,
          departmentId: departmentId || '',
          serviceType,
          date: today,
          hour: currentHour,
        },
      },
      create: {
        hospitalId,
        departmentId,
        serviceType,
        date: today,
        hour: currentHour,
        ...analyticsData,
      },
      update: analyticsData,
    });
  },

  // ==================== COUNTER MANAGEMENT ====================

  async createCounter(hospitalId: string, data: {
    counterNumber: number;
    counterName: string;
    counterType: string;
    departmentId?: string;
    location?: string;
    floor?: string;
    servicesOffered?: string[];
  }) {
    return prisma.queueCounter.create({
      data: {
        hospitalId,
        ...data,
        counterType: data.counterType as any,
        servicesOffered: data.servicesOffered || [],
      },
    });
  },

  async getCounters(hospitalId: string, filters?: {
    counterType?: string;
    isActive?: boolean;
  }) {
    const where: any = { hospitalId };
    if (filters?.counterType) where.counterType = filters.counterType;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return prisma.queueCounter.findMany({
      where,
      include: {
        tickets: {
          where: { status: { in: ['WAITING', 'CALLED', 'SERVING'] } },
          orderBy: { issuedAt: 'asc' },
        },
      },
      orderBy: { counterNumber: 'asc' },
    });
  },

  async updateCounter(id: string, data: Partial<{
    counterName: string;
    counterType: string;
    location: string;
    floor: string;
    isActive: boolean;
    servicesOffered: string[];
  }>) {
    return prisma.queueCounter.update({
      where: { id },
      data: data as any,
    });
  },

  // ==================== QUEUE CONFIG ====================

  async getQueueConfig(hospitalId: string, serviceType: string) {
    return prisma.queueConfig.findFirst({
      where: { hospitalId, serviceType },
    });
  },

  async upsertQueueConfig(hospitalId: string, data: {
    serviceType: string;
    prefix: string;
    avgServiceTime?: number;
    maxWaitTime?: number;
    priorityEnabled?: boolean;
    smsAlertEnabled?: boolean;
    alertBeforePosition?: number;
  }) {
    return prisma.queueConfig.upsert({
      where: { serviceType: data.serviceType },
      create: {
        hospitalId,
        ...data,
      },
      update: data,
    });
  },

  // ==================== DISPLAY BOARD ====================

  async createDisplayBoard(hospitalId: string, data: {
    boardName: string;
    location: string;
    boardType: string;
    departmentIds?: string[];
    counterIds?: string[];
    ticketsToShow?: number;
    theme?: string;
  }) {
    return prisma.queueDisplayBoard.create({
      data: {
        hospitalId,
        ...data,
        boardType: data.boardType as any,
      },
    });
  },

  async getDisplayBoards(hospitalId: string) {
    return prisma.queueDisplayBoard.findMany({
      where: { hospitalId, isActive: true },
    });
  },

  // ==================== ANALYTICS ====================

  async getAnalytics(hospitalId: string, filters: {
    dateFrom: Date;
    dateTo: Date;
    serviceType?: string;
    departmentId?: string;
  }) {
    const where: any = {
      hospitalId,
      date: {
        gte: filters.dateFrom,
        lte: filters.dateTo,
      },
    };
    if (filters.serviceType) where.serviceType = filters.serviceType;
    if (filters.departmentId) where.departmentId = filters.departmentId;

    const analytics = await prisma.queueAnalytics.findMany({
      where,
      orderBy: [{ date: 'asc' }, { hour: 'asc' }],
    });

    // Aggregate data
    const totalTickets = analytics.reduce((sum, a) => sum + a.totalTickets, 0);
    const servedTickets = analytics.reduce((sum, a) => sum + a.servedTickets, 0);
    const noShowTickets = analytics.reduce((sum, a) => sum + a.noShowTickets, 0);
    const cancelledTickets = analytics.reduce((sum, a) => sum + a.cancelledTickets, 0);

    const avgWaitTime = analytics.length > 0
      ? analytics.reduce((sum, a) => sum + a.avgWaitTime, 0) / analytics.length
      : 0;

    const avgServiceTime = analytics.length > 0
      ? analytics.reduce((sum, a) => sum + a.avgServiceTime, 0) / analytics.length
      : 0;

    // Find peak hours
    const hourlyData = analytics.filter(a => a.hour !== null);
    const peakHour = hourlyData.length > 0
      ? hourlyData.reduce((max, a) => a.totalTickets > max.totalTickets ? a : max, hourlyData[0])
      : null;

    return {
      summary: {
        totalTickets,
        servedTickets,
        noShowTickets,
        cancelledTickets,
        completionRate: totalTickets > 0 ? (servedTickets / totalTickets * 100).toFixed(1) : 0,
        noShowRate: totalTickets > 0 ? (noShowTickets / totalTickets * 100).toFixed(1) : 0,
      },
      waitTime: {
        average: Math.round(avgWaitTime),
        min: Math.min(...analytics.map(a => a.minWaitTime)),
        max: Math.max(...analytics.map(a => a.maxWaitTime)),
      },
      serviceTime: {
        average: Math.round(avgServiceTime),
        min: Math.min(...analytics.map(a => a.minServiceTime)),
        max: Math.max(...analytics.map(a => a.maxServiceTime)),
      },
      peakHour: peakHour ? { hour: peakHour.hour, tickets: peakHour.totalTickets } : null,
      dailyData: analytics,
    };
  },

  // Get pending announcements
  async getPendingAnnouncements(hospitalId: string) {
    return prisma.queueAnnouncement.findMany({
      where: {
        hospitalId,
        status: 'pending',
      },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
  },

  // Mark announcement as played
  async markAnnouncementPlayed(id: string) {
    return prisma.queueAnnouncement.update({
      where: { id },
      data: {
        status: 'played',
        playedAt: new Date(),
      },
    });
  },
};

export default queueService;
