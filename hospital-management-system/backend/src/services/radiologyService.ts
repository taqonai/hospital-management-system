import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { billingService } from './billingService';

export class RadiologyService {
  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `RAD-${timestamp}${random}`;
  }

  private generateStudyInstanceUID(): string {
    const root = '1.2.826.0.1.3680043.8.498';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return `${root}.${timestamp}.${random}`;
  }

  async createImagingOrder(hospitalId: string, data: {
    patientId: string;
    consultationId?: string;
    modalityType: 'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND' | 'MAMMOGRAPHY' | 'PET' | 'FLUOROSCOPY';
    bodyPart: string;
    priority?: 'STAT' | 'URGENT' | 'ROUTINE';
    clinicalHistory?: string;
    orderedBy: string;
    scheduledDate?: Date;
    notes?: string;
  }) {
    const orderNumber = this.generateOrderNumber();

    const order = await prisma.imagingOrder.create({
      data: {
        ...data,
        hospitalId,
        orderNumber,
        priority: data.priority || 'ROUTINE',
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      },
    });

    // Auto-add imaging charges to patient invoice
    try {
      await billingService.addImagingCharges(order.id, hospitalId, data.orderedBy);
    } catch (error) {
      console.error('[AUTO-BILLING] Failed to add imaging charges for order:', order.id, error);
    }

    return order;
  }

  async getImagingOrders(hospitalId: string, params: {
    page?: number;
    limit?: number;
    status?: string;
    modalityType?: string;
    priority?: string;
    patientId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page = 1, limit = 20, status, modalityType, priority, patientId, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (status) where.status = status;
    if (modalityType) where.modalityType = modalityType;
    if (priority) where.priority = priority;
    if (patientId) where.patientId = patientId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [orders, total] = await Promise.all([
      prisma.imagingOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          study: true,
          aiAnalysis: true,
        },
      }),
      prisma.imagingOrder.count({ where }),
    ]);

    // Transform AI analysis findings from JSON array to readable string
    const ordersWithFormattedFindings = orders.map(order => {
      if (order.aiAnalysis && order.aiAnalysis.findings) {
        try {
          const findingsArray = order.aiAnalysis.findings as Array<{ region?: string; finding?: string; confidence?: number }>;
          const findingsText = findingsArray
            .map((f, i) => `${i + 1}. ${f.region ? f.region + ': ' : ''}${f.finding || 'No findings'} (${Math.round((f.confidence || 0) * 100)}% confidence)`)
            .join('; ');

          return {
            ...order,
            aiAnalysis: {
              ...order.aiAnalysis,
              findings: findingsText || 'No significant findings detected',
            },
          };
        } catch (e) {
          // If parsing fails, return as-is
          return order;
        }
      }
      return order;
    });

    return { orders: ordersWithFormattedFindings, total, page, limit };
  }

  async getImagingOrderById(id: string, hospitalId: string) {
    const order = await prisma.imagingOrder.findFirst({
      where: { id, hospitalId },
      include: {
        patient: true,
        consultation: true,
        study: true,
        aiAnalysis: true,
      },
    });

    if (!order) throw new NotFoundError('Imaging order not found');

    // Transform AI analysis findings from JSON array to readable string
    if (order.aiAnalysis && order.aiAnalysis.findings) {
      try {
        const findingsArray = order.aiAnalysis.findings as Array<{ region?: string; finding?: string; confidence?: number }>;
        const findingsText = findingsArray
          .map((f, i) => `${i + 1}. ${f.region ? f.region + ': ' : ''}${f.finding || 'No findings'} (${Math.round((f.confidence || 0) * 100)}% confidence)`)
          .join('; ');

        return {
          ...order,
          aiAnalysis: {
            ...order.aiAnalysis,
            findings: findingsText || 'No significant findings detected',
          },
        };
      } catch (e) {
        // If parsing fails, return as-is
        return order;
      }
    }

    return order;
  }

  async updateOrderStatus(id: string, hospitalId: string, status: string) {
    const order = await prisma.imagingOrder.findFirst({ where: { id, hospitalId } });
    if (!order) throw new NotFoundError('Imaging order not found');

    const updateData: any = { status };
    if (status === 'IN_PROGRESS') updateData.performedDate = new Date();

    return prisma.imagingOrder.update({
      where: { id },
      data: updateData,
    });
  }

  async scheduleStudy(id: string, hospitalId: string, scheduledDate: Date) {
    return prisma.imagingOrder.update({
      where: { id },
      data: { scheduledDate, status: 'SCHEDULED' },
    });
  }

  async createStudy(orderId: string, data: {
    studyDescription?: string;
    numberOfSeries?: number;
    numberOfImages?: number;
    storageLocation: string;
  }) {
    const order = await prisma.imagingOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError('Imaging order not found');

    const studyInstanceUid = this.generateStudyInstanceUID();
    const accessionNumber = `ACC-${Date.now().toString(36).toUpperCase()}`;

    const study = await prisma.imagingStudy.create({
      data: {
        orderId,
        studyInstanceUid,
        accessionNumber,
        studyDate: new Date(),
        studyDescription: data.studyDescription,
        numberOfSeries: data.numberOfSeries || 1,
        numberOfImages: data.numberOfImages || 1,
        modality: order.modalityType,
        bodyPart: order.bodyPart,
        storageLocation: data.storageLocation,
      },
    });

    // Update order status
    await prisma.imagingOrder.update({
      where: { id: orderId },
      data: { status: 'COMPLETED', performedDate: new Date() },
    });

    return study;
  }

  async addReport(studyId: string, data: {
    findings: string;
    impression: string;
    radiologistId: string;
  }) {
    return prisma.imagingStudy.update({
      where: { id: studyId },
      data: {
        findings: data.findings,
        impression: data.impression,
        radiologistId: data.radiologistId,
        reportedAt: new Date(),
      },
    });
  }

  async addAIAnalysis(orderId: string, data: {
    findings: any[];
    impression?: string;
    heatmapUrl?: string;
    abnormalityDetected: boolean;
    confidence: number;
    modelVersion: string;
  }) {
    return prisma.aIImageAnalysis.create({
      data: {
        imagingOrderId: orderId,
        findings: data.findings,
        impression: data.impression,
        heatmapUrl: data.heatmapUrl,
        abnormalityDetected: data.abnormalityDetected,
        confidence: data.confidence,
        modelVersion: data.modelVersion,
      },
    });
  }

  async reviewAIAnalysis(analysisId: string, reviewedBy: string, feedback?: string) {
    return prisma.aIImageAnalysis.update({
      where: { id: analysisId },
      data: {
        isReviewed: true,
        reviewedBy,
        reviewedAt: new Date(),
        feedback,
      },
    });
  }

  async getWorklist(hospitalId: string, modalityType?: string) {
    const where: any = {
      hospitalId,
      status: { in: ['ORDERED', 'SCHEDULED'] },
    };
    if (modalityType) where.modalityType = modalityType;

    return prisma.imagingOrder.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { scheduledDate: 'asc' }, { createdAt: 'asc' }],
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true, dateOfBirth: true, gender: true } },
      },
    });
  }

  async getPendingReports(hospitalId: string) {
    return prisma.imagingStudy.findMany({
      where: {
        order: { hospitalId },
        reportedAt: null,
      },
      include: {
        order: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
          },
        },
      },
      orderBy: { studyDate: 'asc' },
    });
  }

  async getRadiologyStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalOrders, pendingOrders, completedToday, pendingReports, aiAnalyzed] = await Promise.all([
      prisma.imagingOrder.count({ where: { hospitalId } }),
      prisma.imagingOrder.count({
        where: { hospitalId, status: { in: ['ORDERED', 'SCHEDULED', 'IN_PROGRESS'] } },
      }),
      prisma.imagingOrder.count({
        where: { hospitalId, status: 'COMPLETED', performedDate: { gte: today } },
      }),
      prisma.imagingStudy.count({
        where: { order: { hospitalId }, reportedAt: null },
      }),
      prisma.aIImageAnalysis.count({
        where: { imagingOrder: { hospitalId } },
      }),
    ]);

    // Get modality breakdown
    const modalityStats = await prisma.imagingOrder.groupBy({
      by: ['modalityType'],
      where: { hospitalId },
      _count: true,
    });

    return {
      totalOrders,
      pendingOrders,
      completedToday,
      pendingReports,
      aiAnalyzed,
      byModality: modalityStats.reduce((acc, m) => {
        acc[m.modalityType] = m._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

export const radiologyService = new RadiologyService();
