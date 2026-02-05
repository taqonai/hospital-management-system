import prisma from '../config/database';
import { NotFoundError, ConflictError } from '../middleware/errorHandler';

// Lead Service
export class CRMLeadService {
  private generateLeadNumber(hospitalCode: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `LEAD-${hospitalCode}-${timestamp}${random}`;
  }

  async create(hospitalId: string, userId: string, data: any) {
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      throw new NotFoundError('Hospital not found');
    }

    const leadNumber = this.generateLeadNumber(hospital.code);

    // Calculate initial lead score
    const score = this.calculateLeadScore(data);

    const lead = await prisma.cRMLead.create({
      data: {
        ...data,
        hospitalId,
        leadNumber,
        score,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        preferredDate: data.preferredDate ? new Date(data.preferredDate) : null,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Log activity
    await this.logActivity(hospitalId, userId, lead.id, null, 'NOTE_ADDED', 'Lead Created', `New lead created: ${data.firstName} ${data.lastName}`);

    return lead;
  }

  async findAll(hospitalId: string, params: any) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      source,
      priority,
      assignedToId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { hospitalId };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { leadNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (source) {
      where.source = source;
    }

    if (priority) {
      where.priority = priority;
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    const [leads, total] = await Promise.all([
      prisma.cRMLead.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          _count: {
            select: {
              activities: true,
              communications: true,
              tasks: true,
            },
          },
        },
      }),
      prisma.cRMLead.count({ where }),
    ]);

    return {
      data: leads,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async findById(hospitalId: string, id: string) {
    const lead = await prisma.cRMLead.findFirst({
      where: { id, hospitalId },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        convertedPatient: {
          select: { id: true, mrn: true, firstName: true, lastName: true },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        activities: {
          orderBy: { activityDate: 'desc' },
          take: 10,
          include: {
            performedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        communications: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        tasks: {
          orderBy: { dueDate: 'asc' },
          take: 5,
          include: {
            assignedTo: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    return lead;
  }

  async update(hospitalId: string, userId: string, id: string, data: any) {
    const existingLead = await prisma.cRMLead.findFirst({
      where: { id, hospitalId },
    });

    if (!existingLead) {
      throw new NotFoundError('Lead not found');
    }

    const lead = await prisma.cRMLead.update({
      where: { id },
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        preferredDate: data.preferredDate ? new Date(data.preferredDate) : undefined,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // Log activity
    await this.logActivity(hospitalId, userId, id, null, 'NOTE_ADDED', 'Lead Updated', 'Lead information was updated');

    return lead;
  }

  async delete(hospitalId: string, id: string) {
    const lead = await prisma.cRMLead.findFirst({
      where: { id, hospitalId },
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    await prisma.cRMLead.delete({ where: { id } });
    return { message: 'Lead deleted successfully' };
  }

  async updateStatus(hospitalId: string, userId: string, id: string, status: string, reason?: string) {
    const lead = await prisma.cRMLead.findFirst({
      where: { id, hospitalId },
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    const updateData: any = {
      status,
      lastContactedAt: new Date(),
    };

    if (status === 'LOST' && reason) {
      updateData.lostReason = reason;
    }

    const updatedLead = await prisma.cRMLead.update({
      where: { id },
      data: updateData,
    });

    // Log activity
    await this.logActivity(hospitalId, userId, id, null, 'STATUS_CHANGED', 'Status Changed', `Lead status changed to ${status}`);

    return updatedLead;
  }

  async assignLead(hospitalId: string, userId: string, id: string, assignedToId: string) {
    const lead = await prisma.cRMLead.findFirst({
      where: { id, hospitalId },
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    const updatedLead = await prisma.cRMLead.update({
      where: { id },
      data: {
        assignedToId,
        assignedAt: new Date(),
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Log activity
    await this.logActivity(hospitalId, userId, id, null, 'NOTE_ADDED', 'Lead Assigned', `Lead assigned to ${updatedLead.assignedTo?.firstName} ${updatedLead.assignedTo?.lastName}`);

    return updatedLead;
  }

  async convertToPatient(hospitalId: string, userId: string, id: string, patientData: any) {
    const lead = await prisma.cRMLead.findFirst({
      where: { id, hospitalId },
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    if (lead.convertedToPatientId) {
      throw new ConflictError('Lead already converted to patient');
    }

    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    // Generate MRN
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const mrn = `${hospital?.code}-${timestamp}${random}`;

    // Separate lead-specific fields from patient-compatible fields
    const { conversionReason, notes, ...patientFields } = patientData || {};

    // Create patient from lead data
    const patient = await prisma.patient.create({
      data: {
        hospitalId,
        mrn,
        firstName: lead.firstName,
        lastName: lead.lastName,
        dateOfBirth: lead.dateOfBirth || new Date(),
        gender: lead.gender || 'OTHER',
        phone: lead.phone,
        email: lead.email,
        address: lead.address || '',
        city: lead.city || '',
        state: lead.state || '',
        zipCode: lead.zipCode || '',
        ...patientFields,
      },
    });

    // Update lead as converted
    await prisma.cRMLead.update({
      where: { id },
      data: {
        status: 'CONVERTED',
        convertedToPatientId: patient.id,
        convertedAt: new Date(),
        conversionReason: conversionReason || 'Manual conversion',
      },
    });

    // Create medical history for patient
    await prisma.medicalHistory.create({
      data: {
        patientId: patient.id,
        chronicConditions: [],
        pastSurgeries: [],
        familyHistory: [],
        currentMedications: [],
        immunizations: [],
      },
    });

    // Log activity
    await this.logActivity(hospitalId, userId, id, null, 'APPOINTMENT_BOOKED', 'Lead Converted', `Lead converted to patient: ${patient.mrn}`);

    return { lead, patient };
  }

  async getTimeline(hospitalId: string, id: string) {
    const lead = await prisma.cRMLead.findFirst({
      where: { id, hospitalId },
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    const activities = await prisma.cRMActivity.findMany({
      where: { leadId: id },
      orderBy: { activityDate: 'desc' },
      include: {
        performedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return activities;
  }

  async getStats(hospitalId: string, params?: any) {
    const { startDate, endDate } = params || {};

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    const where: any = { hospitalId };
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }

    const [
      totalLeads,
      newLeads,
      contactedLeads,
      qualifiedLeads,
      convertedLeads,
      lostLeads,
      leadsBySource,
      leadsByPriority,
    ] = await Promise.all([
      prisma.cRMLead.count({ where }),
      prisma.cRMLead.count({ where: { ...where, status: 'NEW' } }),
      prisma.cRMLead.count({ where: { ...where, status: 'CONTACTED' } }),
      prisma.cRMLead.count({ where: { ...where, status: 'QUALIFIED' } }),
      prisma.cRMLead.count({ where: { ...where, status: 'CONVERTED' } }),
      prisma.cRMLead.count({ where: { ...where, status: 'LOST' } }),
      prisma.cRMLead.groupBy({
        by: ['source'],
        where,
        _count: { source: true },
      }),
      prisma.cRMLead.groupBy({
        by: ['priority'],
        where,
        _count: { priority: true },
      }),
    ]);

    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    return {
      totalLeads,
      newLeads,
      contactedLeads,
      qualifiedLeads,
      convertedLeads,
      lostLeads,
      conversionRate: conversionRate.toFixed(2),
      bySource: leadsBySource,
      byPriority: leadsByPriority,
    };
  }

  private calculateLeadScore(lead: any): number {
    let score = 0;

    // Source quality (0-20)
    const sourceScores: Record<string, number> = {
      REFERRAL_DOCTOR: 20,
      REFERRAL_PATIENT: 18,
      WEBSITE: 15,
      PHONE_CALL: 12,
      WALK_IN: 10,
      SOCIAL_MEDIA: 8,
      OTHER: 5,
    };
    score += sourceScores[lead.source] || 5;

    // Interest signals (0-30)
    if (lead.interestedIn && lead.interestedIn.length > 0) score += 10;
    if (lead.preferredDoctor) score += 10;
    if (lead.preferredDate) score += 10;

    // Contact info quality (0-20)
    if (lead.email) score += 10;
    if (lead.alternatePhone) score += 5;
    if (lead.address) score += 5;

    // Priority bonus (0-15)
    const priorityScores: Record<string, number> = {
      URGENT: 15,
      HIGH: 10,
      MEDIUM: 5,
      LOW: 0,
    };
    score += priorityScores[lead.priority] || 5;

    return Math.min(score, 100);
  }

  private async logActivity(
    hospitalId: string,
    userId: string,
    leadId: string | null,
    taskId: string | null,
    activityType: any,
    title: string,
    description: string
  ) {
    await prisma.cRMActivity.create({
      data: {
        hospitalId,
        leadId,
        taskId,
        activityType,
        title,
        description,
        performedById: userId,
      },
    });
  }
}

// Communication Service
export class CRMCommunicationService {
  async create(hospitalId: string, userId: string, data: any) {
    // Extract known fields and put extra fields (like outcome) into metadata
    const {
      leadId,
      patientId,
      channel,
      direction,
      subject,
      content,
      templateId,
      status,
      scheduledAt,
      campaignId,
      outcome,
      ...extraData
    } = data;

    // Build metadata with outcome and any extra fields
    const metadata = {
      ...(outcome && { outcome }),
      ...extraData,
    };

    const communication = await prisma.cRMCommunication.create({
      data: {
        hospitalId,
        initiatedById: userId,
        leadId,
        patientId,
        channel,
        direction,
        subject: subject || null,
        content,
        templateId,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        campaignId,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
      include: {
        lead: {
          select: { id: true, firstName: true, lastName: true, leadNumber: true },
        },
        patient: {
          select: { id: true, firstName: true, lastName: true, mrn: true },
        },
        template: true,
      },
    });

    // Log activity if lead
    if (leadId) {
      await prisma.cRMActivity.create({
        data: {
          hospitalId,
          leadId,
          activityType: this.getActivityType(channel, direction),
          title: `${channel} ${direction}`,
          description: subject || content.substring(0, 100),
          outcome: outcome || null,
          performedById: userId,
        },
      });

      // Update lead's last contacted
      await prisma.cRMLead.update({
        where: { id: leadId },
        data: { lastContactedAt: new Date() },
      });
    }

    return communication;
  }

  async findAll(hospitalId: string, params: any) {
    const {
      page = 1,
      limit = 10,
      leadId,
      patientId,
      channel,
      status,
      direction,
    } = params;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { hospitalId };

    if (leadId) where.leadId = leadId;
    if (patientId) where.patientId = patientId;
    if (channel) where.channel = channel;
    if (status) where.status = status;
    if (direction) where.direction = direction;

    const [communications, total] = await Promise.all([
      prisma.cRMCommunication.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          lead: {
            select: { id: true, firstName: true, lastName: true, leadNumber: true },
          },
          patient: {
            select: { id: true, firstName: true, lastName: true, mrn: true },
          },
          initiatedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          template: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.cRMCommunication.count({ where }),
    ]);

    return {
      data: communications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getStats(hospitalId: string) {
    const [total, byChannel, byStatus] = await Promise.all([
      prisma.cRMCommunication.count({ where: { hospitalId } }),
      prisma.cRMCommunication.groupBy({
        by: ['channel'],
        where: { hospitalId },
        _count: { channel: true },
      }),
      prisma.cRMCommunication.groupBy({
        by: ['status'],
        where: { hospitalId },
        _count: { status: true },
      }),
    ]);

    return { total, byChannel, byStatus };
  }

  private getActivityType(channel: string, direction: string): any {
    const activityMap: Record<string, any> = {
      'PHONE_CALL_OUTBOUND': 'CALL_MADE',
      'PHONE_CALL_INBOUND': 'CALL_RECEIVED',
      'EMAIL_OUTBOUND': 'EMAIL_SENT',
      'EMAIL_INBOUND': 'EMAIL_RECEIVED',
      'SMS_OUTBOUND': 'SMS_SENT',
      'WHATSAPP_OUTBOUND': 'WHATSAPP_SENT',
    };
    return activityMap[`${channel}_${direction}`] || 'NOTE_ADDED';
  }
}

// Template Service
export class CRMTemplateService {
  async create(hospitalId: string, userId: string, data: any) {
    // Check for existing template with same name
    const existing = await prisma.cRMTemplate.findFirst({
      where: { hospitalId, name: data.name },
    });

    if (existing) {
      throw new ConflictError('Template with this name already exists');
    }

    return prisma.cRMTemplate.create({
      data: {
        ...data,
        hospitalId,
        createdById: userId,
      },
    });
  }

  async findAll(hospitalId: string, params?: any) {
    const { channel, category, isActive } = params || {};

    const where: any = { hospitalId };
    if (channel) where.channel = channel;
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    return prisma.cRMTemplate.findMany({
      where,
      orderBy: { usageCount: 'desc' },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async update(hospitalId: string, id: string, data: any) {
    const template = await prisma.cRMTemplate.findFirst({
      where: { id, hospitalId },
    });

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    return prisma.cRMTemplate.update({
      where: { id },
      data,
    });
  }

  async delete(hospitalId: string, id: string) {
    const template = await prisma.cRMTemplate.findFirst({
      where: { id, hospitalId },
    });

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    await prisma.cRMTemplate.delete({ where: { id } });
    return { message: 'Template deleted successfully' };
  }

  async preview(hospitalId: string, id: string, variables: Record<string, string>) {
    const template = await prisma.cRMTemplate.findFirst({
      where: { id, hospitalId },
    });

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    let content = template.content;
    let subject = template.subject || '';

    // Replace variables in content and subject
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, value);
      subject = subject.replace(regex, value);
    });

    return { subject, content };
  }
}

// Task Service
export class CRMTaskService {
  async create(hospitalId: string, userId: string, data: any) {
    const task = await prisma.cRMTask.create({
      data: {
        ...data,
        hospitalId,
        assignedById: userId,
        dueDate: new Date(data.dueDate),
        reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        lead: {
          select: { id: true, firstName: true, lastName: true, leadNumber: true },
        },
      },
    });

    // Log activity
    if (data.leadId) {
      await prisma.cRMActivity.create({
        data: {
          hospitalId,
          leadId: data.leadId,
          taskId: task.id,
          activityType: 'FOLLOW_UP_SCHEDULED',
          title: 'Task Created',
          description: data.title,
          performedById: userId,
        },
      });
    }

    return task;
  }

  async findAll(hospitalId: string, params: any) {
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      assignedToId,
      leadId,
      taskType,
    } = params;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { hospitalId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = assignedToId;
    if (leadId) where.leadId = leadId;
    if (taskType) where.taskType = taskType;

    const [tasks, total] = await Promise.all([
      prisma.cRMTask.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { dueDate: 'asc' },
        include: {
          assignedTo: {
            select: { id: true, firstName: true, lastName: true },
          },
          lead: {
            select: { id: true, firstName: true, lastName: true, leadNumber: true },
          },
        },
      }),
      prisma.cRMTask.count({ where }),
    ]);

    return {
      data: tasks,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async update(hospitalId: string, id: string, data: any) {
    const task = await prisma.cRMTask.findFirst({
      where: { id, hospitalId },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    return prisma.cRMTask.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        reminderAt: data.reminderAt ? new Date(data.reminderAt) : undefined,
      },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
        lead: {
          select: { id: true, firstName: true, lastName: true, leadNumber: true },
        },
      },
    });
  }

  async updateStatus(hospitalId: string, userId: string, id: string, status: string, outcome?: string) {
    const task = await prisma.cRMTask.findFirst({
      where: { id, hospitalId },
    });

    if (!task) {
      throw new NotFoundError('Task not found');
    }

    const updateData: any = { status };
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
      updateData.outcome = outcome;
    }

    const updatedTask = await prisma.cRMTask.update({
      where: { id },
      data: updateData,
    });

    // Log activity if lead
    if (task.leadId && status === 'COMPLETED') {
      await prisma.cRMActivity.create({
        data: {
          hospitalId,
          leadId: task.leadId,
          taskId: task.id,
          activityType: 'TASK_COMPLETED',
          title: 'Task Completed',
          description: task.title,
          outcome,
          performedById: userId,
        },
      });
    }

    return updatedTask;
  }

  async getMyTasks(hospitalId: string, userId: string) {
    return prisma.cRMTask.findMany({
      where: {
        hospitalId,
        assignedToId: userId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        lead: {
          select: { id: true, firstName: true, lastName: true, leadNumber: true, phone: true },
        },
      },
    });
  }

  async getOverdueTasks(hospitalId: string) {
    return prisma.cRMTask.findMany({
      where: {
        hospitalId,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
        dueDate: { lt: new Date() },
      },
      orderBy: { dueDate: 'asc' },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
        lead: {
          select: { id: true, firstName: true, lastName: true, leadNumber: true },
        },
      },
    });
  }
}

// Campaign Service
export class CRMCampaignService {
  async create(hospitalId: string, userId: string, data: any) {
    // Check for existing campaign with same name
    const existing = await prisma.cRMCampaign.findFirst({
      where: { hospitalId, name: data.name },
    });

    if (existing) {
      throw new ConflictError('Campaign with this name already exists');
    }

    return prisma.cRMCampaign.create({
      data: {
        ...data,
        hospitalId,
        createdById: userId,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      },
      include: {
        template: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async findAll(hospitalId: string, params?: any) {
    const { status, campaignType } = params || {};

    const where: any = { hospitalId };
    if (status) where.status = status;
    if (campaignType) where.campaignType = campaignType;

    return prisma.cRMCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        template: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { communications: true },
        },
      },
    });
  }

  async findById(hospitalId: string, id: string) {
    const campaign = await prisma.cRMCampaign.findFirst({
      where: { id, hospitalId },
      include: {
        template: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        communications: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    return campaign;
  }

  async update(hospitalId: string, id: string, data: any) {
    const campaign = await prisma.cRMCampaign.findFirst({
      where: { id, hospitalId },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.status !== 'DRAFT') {
      throw new ConflictError('Can only update draft campaigns');
    }

    return prisma.cRMCampaign.update({
      where: { id },
      data: {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
      },
    });
  }

  async launch(hospitalId: string, id: string) {
    const campaign = await prisma.cRMCampaign.findFirst({
      where: { id, hospitalId },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      throw new ConflictError('Campaign cannot be launched');
    }

    // Update campaign status
    return prisma.cRMCampaign.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
  }

  async pause(hospitalId: string, id: string) {
    const campaign = await prisma.cRMCampaign.findFirst({
      where: { id, hospitalId },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    if (campaign.status !== 'RUNNING') {
      throw new ConflictError('Campaign is not running');
    }

    return prisma.cRMCampaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }

  async getAnalytics(hospitalId: string, id: string) {
    const campaign = await prisma.cRMCampaign.findFirst({
      where: { id, hospitalId },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    const communications = await prisma.cRMCommunication.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: { status: true },
    });

    return {
      campaign,
      metrics: {
        totalRecipients: campaign.totalRecipients,
        sentCount: campaign.sentCount,
        deliveredCount: campaign.deliveredCount,
        openedCount: campaign.openedCount,
        clickedCount: campaign.clickedCount,
        respondedCount: campaign.respondedCount,
        failedCount: campaign.failedCount,
        openRate: campaign.sentCount > 0 ? ((campaign.openedCount / campaign.sentCount) * 100).toFixed(2) : 0,
        clickRate: campaign.openedCount > 0 ? ((campaign.clickedCount / campaign.openedCount) * 100).toFixed(2) : 0,
        responseRate: campaign.deliveredCount > 0 ? ((campaign.respondedCount / campaign.deliveredCount) * 100).toFixed(2) : 0,
      },
      communicationsByStatus: communications,
    };
  }
}

// Survey Service
export class CRMSurveyService {
  async create(hospitalId: string, userId: string, data: any) {
    return prisma.cRMSurvey.create({
      data: {
        ...data,
        hospitalId,
        createdById: userId,
      },
    });
  }

  async findAll(hospitalId: string, params?: any) {
    const { surveyType, isActive } = params || {};

    const where: any = { hospitalId };
    if (surveyType) where.surveyType = surveyType;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    return prisma.cRMSurvey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { responses: true },
        },
      },
    });
  }

  async findById(hospitalId: string, id: string) {
    const survey = await prisma.cRMSurvey.findFirst({
      where: { id, hospitalId },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    return survey;
  }

  async update(hospitalId: string, id: string, data: any) {
    const survey = await prisma.cRMSurvey.findFirst({
      where: { id, hospitalId },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    return prisma.cRMSurvey.update({
      where: { id },
      data,
    });
  }

  async getResponses(hospitalId: string, surveyId: string, params?: any) {
    const survey = await prisma.cRMSurvey.findFirst({
      where: { id: surveyId, hospitalId },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    const { page = 1, limit = 20 } = params || {};
    const skip = (Number(page) - 1) * Number(limit);

    const [responses, total] = await Promise.all([
      prisma.cRMSurveyResponse.findMany({
        where: { surveyId },
        skip,
        take: Number(limit),
        orderBy: { submittedAt: 'desc' },
        include: {
          patient: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
      prisma.cRMSurveyResponse.count({ where: { surveyId } }),
    ]);

    return {
      data: responses,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getAnalytics(hospitalId: string, surveyId: string) {
    const survey = await prisma.cRMSurvey.findFirst({
      where: { id: surveyId, hospitalId },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    const responses = await prisma.cRMSurveyResponse.findMany({
      where: { surveyId },
    });

    const totalResponses = responses.length;
    const avgRating = responses.filter(r => r.overallRating).reduce((sum, r) => sum + (r.overallRating || 0), 0) / (responses.filter(r => r.overallRating).length || 1);
    const avgNPS = responses.filter(r => r.npsScore !== null).reduce((sum, r) => sum + (r.npsScore || 0), 0) / (responses.filter(r => r.npsScore !== null).length || 1);

    // NPS calculation (promoters - detractors)
    const promoters = responses.filter(r => (r.npsScore || 0) >= 9).length;
    const detractors = responses.filter(r => (r.npsScore || 0) <= 6).length;
    const npsScore = totalResponses > 0 ? ((promoters - detractors) / totalResponses) * 100 : 0;

    return {
      survey,
      metrics: {
        totalResponses,
        avgRating: avgRating.toFixed(2),
        avgNPS: avgNPS.toFixed(2),
        npsScore: npsScore.toFixed(0),
        requiresFollowUp: responses.filter(r => r.requiresFollowUp).length,
      },
    };
  }

  async submitResponse(surveyId: string, data: any) {
    const survey = await prisma.cRMSurvey.findUnique({
      where: { id: surveyId },
    });

    if (!survey) {
      throw new NotFoundError('Survey not found');
    }

    if (!survey.isActive) {
      throw new ConflictError('Survey is not active');
    }

    const response = await prisma.cRMSurveyResponse.create({
      data: {
        surveyId,
        ...data,
      },
    });

    // Update survey response count and averages
    await prisma.cRMSurvey.update({
      where: { id: surveyId },
      data: {
        responseCount: { increment: 1 },
      },
    });

    return response;
  }
}

// Tag Service
export class CRMTagService {
  async create(hospitalId: string, data: any) {
    const existing = await prisma.cRMTag.findFirst({
      where: { hospitalId, name: data.name },
    });

    if (existing) {
      throw new ConflictError('Tag with this name already exists');
    }

    return prisma.cRMTag.create({
      data: {
        ...data,
        hospitalId,
      },
    });
  }

  async findAll(hospitalId: string) {
    return prisma.cRMTag.findMany({
      where: { hospitalId },
      include: {
        _count: {
          select: { leadTags: true },
        },
      },
    });
  }

  async update(hospitalId: string, id: string, data: any) {
    const tag = await prisma.cRMTag.findFirst({
      where: { id, hospitalId },
    });

    if (!tag) {
      throw new NotFoundError('Tag not found');
    }

    return prisma.cRMTag.update({
      where: { id },
      data,
    });
  }

  async delete(hospitalId: string, id: string) {
    const tag = await prisma.cRMTag.findFirst({
      where: { id, hospitalId },
    });

    if (!tag) {
      throw new NotFoundError('Tag not found');
    }

    await prisma.cRMTag.delete({ where: { id } });
    return { message: 'Tag deleted successfully' };
  }

  async addTagToLead(leadId: string, tagId: string) {
    return prisma.cRMLeadTag.create({
      data: { leadId, tagId },
    });
  }

  async removeTagFromLead(leadId: string, tagId: string) {
    await prisma.cRMLeadTag.delete({
      where: { leadId_tagId: { leadId, tagId } },
    });
    return { message: 'Tag removed from lead' };
  }
}

// Activity Service
export class CRMActivityService {
  async create(hospitalId: string, userId: string, data: any) {
    return prisma.cRMActivity.create({
      data: {
        ...data,
        hospitalId,
        performedById: userId,
        activityDate: data.activityDate ? new Date(data.activityDate) : new Date(),
      },
      include: {
        performedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        lead: {
          select: { id: true, firstName: true, lastName: true, leadNumber: true },
        },
      },
    });
  }

  async findAll(hospitalId: string, params: any) {
    const { page = 1, limit = 20, leadId, activityType, startDate, endDate } = params;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { hospitalId };
    if (leadId) where.leadId = leadId;
    if (activityType) where.activityType = activityType;

    if (startDate || endDate) {
      where.activityDate = {};
      if (startDate) where.activityDate.gte = new Date(startDate);
      if (endDate) where.activityDate.lte = new Date(endDate);
    }

    const [activities, total] = await Promise.all([
      prisma.cRMActivity.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { activityDate: 'desc' },
        include: {
          performedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          lead: {
            select: { id: true, firstName: true, lastName: true, leadNumber: true },
          },
        },
      }),
      prisma.cRMActivity.count({ where }),
    ]);

    return {
      data: activities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }
}

// Settings Service
export class CRMSettingsService {
  async get(hospitalId: string) {
    let settings = await prisma.cRMSettings.findUnique({
      where: { hospitalId },
    });

    if (!settings) {
      settings = await prisma.cRMSettings.create({
        data: { hospitalId },
      });
    }

    return settings;
  }

  async update(hospitalId: string, data: any) {
    return prisma.cRMSettings.upsert({
      where: { hospitalId },
      create: { hospitalId, ...data },
      update: data,
    });
  }
}

// Reports Service
export class CRMReportsService {
  async getDashboard(hospitalId: string, params?: any) {
    const leadService = new CRMLeadService();
    const taskService = new CRMTaskService();

    const [leadStats, overdueTasks, recentLeads, communicationStats] = await Promise.all([
      leadService.getStats(hospitalId, params),
      taskService.getOverdueTasks(hospitalId),
      prisma.cRMLead.findMany({
        where: { hospitalId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedTo: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
      prisma.cRMCommunication.groupBy({
        by: ['channel'],
        where: { hospitalId },
        _count: { channel: true },
      }),
    ]);

    return {
      leadStats,
      overdueTasks: overdueTasks.slice(0, 5),
      recentLeads,
      communicationStats,
    };
  }

  async getLeadConversionReport(hospitalId: string, params?: any) {
    const { startDate, endDate, groupBy = 'source' } = params || {};

    const where: any = { hospitalId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const leads = await prisma.cRMLead.groupBy({
      by: [groupBy as any],
      where,
      _count: { id: true },
    });

    const convertedLeads = await prisma.cRMLead.groupBy({
      by: [groupBy as any],
      where: { ...where, status: 'CONVERTED' },
      _count: { id: true },
    });

    // Calculate conversion rates
    const report = leads.map((item: any) => {
      const converted = convertedLeads.find((c: any) => c[groupBy] === item[groupBy]);
      const conversionRate = item._count.id > 0 ? ((converted?._count?.id || 0) / item._count.id) * 100 : 0;
      return {
        [groupBy]: item[groupBy],
        totalLeads: item._count.id,
        convertedLeads: converted?._count?.id || 0,
        conversionRate: conversionRate.toFixed(2),
      };
    });

    return report;
  }

  async getStaffPerformance(hospitalId: string, params?: any) {
    const { startDate, endDate } = params || {};

    const where: any = { hospitalId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const staffStats = await prisma.cRMLead.groupBy({
      by: ['assignedToId'],
      where: { ...where, assignedToId: { not: null } },
      _count: { id: true },
    });

    const conversions = await prisma.cRMLead.groupBy({
      by: ['assignedToId'],
      where: { ...where, assignedToId: { not: null }, status: 'CONVERTED' },
      _count: { id: true },
    });

    // Get staff details
    const staffIds = staffStats.map((s: any) => s.assignedToId).filter(Boolean);
    const staffUsers = await prisma.user.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    return staffStats.map((stat: any) => {
      const staff = staffUsers.find(u => u.id === stat.assignedToId);
      const converted = conversions.find((c: any) => c.assignedToId === stat.assignedToId);
      return {
        staffId: stat.assignedToId,
        staffName: staff ? `${staff.firstName} ${staff.lastName}` : 'Unknown',
        totalLeads: stat._count.id,
        convertedLeads: converted?._count?.id || 0,
        conversionRate: stat._count.id > 0 ? (((converted?._count?.id || 0) / stat._count.id) * 100).toFixed(2) : 0,
      };
    });
  }
}

// Export service instances
export const crmLeadService = new CRMLeadService();
export const crmCommunicationService = new CRMCommunicationService();
export const crmTemplateService = new CRMTemplateService();
export const crmTaskService = new CRMTaskService();
export const crmCampaignService = new CRMCampaignService();
export const crmSurveyService = new CRMSurveyService();
export const crmTagService = new CRMTagService();
export const crmActivityService = new CRMActivityService();
export const crmSettingsService = new CRMSettingsService();
export const crmReportsService = new CRMReportsService();
