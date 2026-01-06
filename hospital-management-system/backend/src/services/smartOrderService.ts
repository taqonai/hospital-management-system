import axios from 'axios';
import prisma from '../config/database';
import { config } from '../config';
import { NotFoundError, AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import {
  SmartOrderStatus,
  SmartOrderPriority,
  SmartOrderItemType,
  SmartOrderItemStatus,
  Prisma,
} from '@prisma/client';

// Smart Order AI Service URL
const SMART_ORDER_SERVICE_URL = process.env.SMART_ORDER_SERVICE_URL || 'http://localhost:8013';

interface PatientContext {
  age?: number;
  weight?: number;
  gender?: string;
  allergies?: string[];
  currentMedications?: string[];
  renalFunction?: string;
  hepaticFunction?: string;
  pregnancyStatus?: string;
  comorbidities?: string[];
  recentLabResults?: Record<string, any>;
}

interface OrderRecommendation {
  id: string;
  name: string;
  category: string;
  urgency: string;
  confidence: number;
  rationale: string;
  warnings?: string[];
  dosing?: Record<string, any>;
  estimatedCost?: number;
  code?: string;
}

interface RecommendationRequest {
  diagnosis: string;
  icdCode?: string;
  symptoms?: string[];
  patientContext?: PatientContext;
  includeAlternatives?: boolean;
}

interface CustomizeRequest {
  bundleId?: string;
  selectedOrders: any[];
  patientContext: PatientContext;
  customizations?: Record<string, any>;
}

interface OrderItem {
  id?: string;
  name: string;
  category: string;
  urgency?: string;
  confidence?: number;
  rationale?: string;
  warnings?: string[];
  dosing?: Record<string, any>;
  estimatedCost?: number;
  code?: string;
  notes?: string;
}

interface PlaceOrdersRequest {
  patientId: string;
  hospitalId: string;
  orders: OrderItem[];
  providerId: string;
  notes?: string;
  diagnosis?: string;
  icdCode?: string;
  symptoms?: string[];
  bundleId?: string;
  bundleName?: string;
  priority?: SmartOrderPriority;
  aiRecommendationId?: string;
  aiConfidenceScore?: number;
  evidenceLevel?: string;
}

interface OrderHistoryFilters {
  status?: SmartOrderStatus;
  orderType?: SmartOrderItemType;
  startDate?: Date;
  endDate?: Date;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
}

export class SmartOrderService {
  private aiClient = axios.create({
    baseURL: SMART_ORDER_SERVICE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  /**
   * Generate a unique order number
   */
  private async generateOrderNumber(hospitalId: string): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Count orders for today in this hospital
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const count = await prisma.smartOrder.count({
      where: {
        hospitalId,
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const sequenceNumber = (count + 1).toString().padStart(4, '0');
    return `SO-${datePrefix}-${sequenceNumber}`;
  }

  /**
   * Map category string to SmartOrderItemType enum
   */
  private mapCategoryToOrderType(category: string): SmartOrderItemType {
    const categoryMap: Record<string, SmartOrderItemType> = {
      laboratory: SmartOrderItemType.LABORATORY,
      lab: SmartOrderItemType.LABORATORY,
      imaging: SmartOrderItemType.IMAGING,
      radiology: SmartOrderItemType.IMAGING,
      medication: SmartOrderItemType.MEDICATION,
      med: SmartOrderItemType.MEDICATION,
      procedure: SmartOrderItemType.PROCEDURE,
      nursing: SmartOrderItemType.NURSING,
      consult: SmartOrderItemType.CONSULT,
      consultation: SmartOrderItemType.CONSULT,
    };

    return categoryMap[category.toLowerCase()] || SmartOrderItemType.OTHER;
  }

  /**
   * Get AI-powered order recommendations for a diagnosis
   */
  async getRecommendations(request: RecommendationRequest, patientId?: string) {
    // If patientId provided, fetch patient context from database
    let patientContext = request.patientContext;

    if (patientId && !patientContext) {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          allergies: true,
          medicalHistory: true,
          vitals: {
            orderBy: { recordedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (patient) {
        patientContext = {
          age: this.calculateAge(patient.dateOfBirth),
          weight: patient.vitals[0]?.weight ? Number(patient.vitals[0].weight) : undefined,
          gender: patient.gender,
          allergies: patient.allergies.map(a => a.allergen),
          currentMedications: patient.medicalHistory?.currentMedications || [],
          comorbidities: patient.medicalHistory?.chronicConditions || [],
        };
      }
    }

    try {
      logger.info(`Calling Smart Order AI for diagnosis: ${request.diagnosis}`);

      const response = await this.aiClient.post('/api/recommend', {
        diagnosis: request.diagnosis,
        icdCode: request.icdCode,
        symptoms: request.symptoms,
        patientContext,
        includeAlternatives: request.includeAlternatives ?? true,
      });

      logger.info(`Smart Order AI returned recommendations for: ${request.diagnosis}`);

      return {
        ...response.data,
        patientId,
      };
    } catch (error) {
      logger.error('Smart Order AI service error:', error);

      if (axios.isAxiosError(error) && !error.response) {
        // Service unreachable - use fallback
        logger.warn('Smart Order AI service unreachable, using fallback recommendations');
        return this.fallbackRecommendations(request, patientContext);
      }

      throw new AppError('Smart Order AI service temporarily unavailable', 503);
    }
  }

  /**
   * Get all available order bundles
   */
  async getBundles() {
    try {
      const response = await this.aiClient.get('/api/bundles');
      return response.data;
    } catch (error) {
      logger.error('Error fetching bundles:', error);

      if (axios.isAxiosError(error) && !error.response) {
        return this.fallbackBundles();
      }

      throw new AppError('Smart Order AI service temporarily unavailable', 503);
    }
  }

  /**
   * Get details of a specific bundle
   */
  async getBundleDetails(bundleId: string) {
    try {
      const response = await this.aiClient.get(`/api/bundles/${bundleId}`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching bundle details:', error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new NotFoundError('Bundle not found');
        }
        if (!error.response) {
          throw new AppError('Smart Order AI service temporarily unavailable', 503);
        }
      }

      throw new AppError('Failed to fetch bundle details', 500);
    }
  }

  /**
   * Customize orders for a specific patient
   */
  async customizeBundle(request: CustomizeRequest, patientId?: string) {
    // Enrich patient context from database if patientId provided
    let enrichedContext = request.patientContext;

    if (patientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: {
          allergies: true,
          medicalHistory: true,
          vitals: {
            orderBy: { recordedAt: 'desc' },
            take: 1,
          },
        },
      });

      if (patient) {
        enrichedContext = {
          ...request.patientContext,
          age: request.patientContext.age || this.calculateAge(patient.dateOfBirth),
          weight: request.patientContext.weight || (patient.vitals[0]?.weight ? Number(patient.vitals[0].weight) : undefined),
          gender: request.patientContext.gender || patient.gender,
          allergies: [
            ...(request.patientContext.allergies || []),
            ...patient.allergies.map(a => a.allergen),
          ],
          currentMedications: [
            ...(request.patientContext.currentMedications || []),
            ...(patient.medicalHistory?.currentMedications || []),
          ],
        };
      }
    }

    try {
      const response = await this.aiClient.post('/api/customize', {
        bundleId: request.bundleId,
        selectedOrders: request.selectedOrders,
        patientContext: enrichedContext,
        customizations: request.customizations,
      });

      return response.data;
    } catch (error) {
      logger.error('Error customizing bundle:', error);
      throw new AppError('Failed to customize orders', 500);
    }
  }

  /**
   * Place selected orders with database persistence
   */
  async placeOrders(request: PlaceOrdersRequest) {
    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: request.patientId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Validate provider exists
    const provider = await prisma.user.findUnique({
      where: { id: request.providerId },
    });

    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber(request.hospitalId);

    // Calculate total estimated cost
    const totalEstimatedCost = request.orders.reduce((sum, order) => {
      return sum + (order.estimatedCost || 0);
    }, 0);

    try {
      // Create SmartOrder and SmartOrderItems in a transaction
      const smartOrder = await prisma.$transaction(async (tx) => {
        // Create the SmartOrder
        const order = await tx.smartOrder.create({
          data: {
            hospitalId: request.hospitalId,
            patientId: request.patientId,
            orderedById: request.providerId,
            orderNumber,
            diagnosis: request.diagnosis,
            icdCode: request.icdCode,
            symptoms: request.symptoms || [],
            bundleId: request.bundleId,
            bundleName: request.bundleName,
            status: SmartOrderStatus.PENDING,
            priority: request.priority || SmartOrderPriority.ROUTINE,
            totalEstimatedCost: totalEstimatedCost > 0 ? totalEstimatedCost : null,
            notes: request.notes,
            aiRecommendationId: request.aiRecommendationId,
            aiConfidenceScore: request.aiConfidenceScore,
            evidenceLevel: request.evidenceLevel,
          },
        });

        // Create SmartOrderItems
        const orderItems = await Promise.all(
          request.orders.map((item) =>
            tx.smartOrderItem.create({
              data: {
                smartOrderId: order.id,
                orderType: this.mapCategoryToOrderType(item.category),
                name: item.name,
                category: item.category,
                code: item.code,
                urgency: item.urgency || 'routine',
                confidence: item.confidence,
                rationale: item.rationale,
                warnings: item.warnings || [],
                dosing: item.dosing as Prisma.InputJsonValue,
                status: SmartOrderItemStatus.PENDING,
                estimatedCost: item.estimatedCost,
                notes: item.notes,
              },
            })
          )
        );

        return { ...order, items: orderItems };
      });

      // Optionally notify AI service about the order placement
      try {
        await this.aiClient.post('/api/place', {
          ...request,
          orderId: smartOrder.id,
          orderNumber: smartOrder.orderNumber,
        });
      } catch (aiError) {
        // Log but don't fail - the order is already persisted
        logger.warn('Failed to notify AI service about order placement:', aiError);
      }

      logger.info(`Placed smart order ${smartOrder.orderNumber} with ${smartOrder.items.length} items for patient ${request.patientId}`);

      return {
        success: true,
        message: `Successfully placed ${smartOrder.items.length} orders`,
        orderId: smartOrder.id,
        orderNumber: smartOrder.orderNumber,
        patientId: request.patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        providerId: request.providerId,
        providerName: `${provider.firstName} ${provider.lastName}`,
        totalEstimatedCost: smartOrder.totalEstimatedCost,
        placedAt: smartOrder.orderedAt.toISOString(),
        items: smartOrder.items,
      };
    } catch (error) {
      logger.error('Error placing orders:', error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('Failed to place orders', 500);
    }
  }

  /**
   * Get order history from database with filtering and pagination
   */
  async getOrderHistory(
    patientId: string,
    filters?: OrderHistoryFilters,
    pagination?: PaginationOptions
  ) {
    // Validate patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.SmartOrderWhereInput = {
      patientId,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.orderedAt = {};
      if (filters.startDate) {
        where.orderedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.orderedAt.lte = filters.endDate;
      }
    }

    // If filtering by order type, we need to filter by items
    if (filters?.orderType) {
      where.items = {
        some: {
          orderType: filters.orderType,
        },
      };
    }

    // Get total count for pagination
    const totalCount = await prisma.smartOrder.count({ where });

    // Fetch orders with related data
    const orders = await prisma.smartOrder.findMany({
      where,
      include: {
        items: {
          include: {
            executedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
        orderedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: {
        orderedAt: 'desc',
      },
      skip,
      take: limit,
    });

    return {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      orders,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: skip + orders.length < totalCount,
      },
    };
  }

  /**
   * Get a single order by ID with all details
   */
  async getOrderById(orderId: string) {
    const order = await prisma.smartOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            executedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
            dateOfBirth: true,
            gender: true,
            phone: true,
          },
        },
        orderedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
            email: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Smart order not found');
    }

    return order;
  }

  /**
   * Update the status of a SmartOrder
   */
  async updateOrderStatus(
    orderId: string,
    status: SmartOrderStatus,
    notes?: string
  ) {
    const order = await prisma.smartOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundError('Smart order not found');
    }

    const updateData: Prisma.SmartOrderUpdateInput = {
      status,
    };

    if (notes) {
      updateData.notes = notes;
    }

    // Set timestamp based on status
    if (status === SmartOrderStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (status === SmartOrderStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    const updatedOrder = await prisma.smartOrder.update({
      where: { id: orderId },
      data: updateData,
      include: {
        items: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        orderedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    logger.info(`Updated smart order ${orderId} status to ${status}`);

    return updatedOrder;
  }

  /**
   * Update the status of a SmartOrderItem
   */
  async updateOrderItemStatus(
    itemId: string,
    status: SmartOrderItemStatus,
    executedById?: string,
    notes?: string,
    cancellationReason?: string
  ) {
    const item = await prisma.smartOrderItem.findUnique({
      where: { id: itemId },
      include: {
        smartOrder: true,
      },
    });

    if (!item) {
      throw new NotFoundError('Smart order item not found');
    }

    const updateData: Prisma.SmartOrderItemUpdateInput = {
      status,
    };

    if (notes) {
      updateData.notes = notes;
    }

    if (cancellationReason && status === SmartOrderItemStatus.CANCELLED) {
      updateData.cancellationReason = cancellationReason;
    }

    // Set execution details if completed
    if (status === SmartOrderItemStatus.COMPLETED) {
      updateData.executedAt = new Date();
      if (executedById) {
        updateData.executedBy = { connect: { id: executedById } };
      }
    }

    const updatedItem = await prisma.smartOrderItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Check if we need to update parent order status
    await this.updateParentOrderStatusIfNeeded(item.smartOrderId);

    logger.info(`Updated smart order item ${itemId} status to ${status}`);

    return updatedItem;
  }

  /**
   * Update parent order status based on item statuses
   */
  private async updateParentOrderStatusIfNeeded(orderId: string) {
    const order = await prisma.smartOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      return;
    }

    const totalItems = order.items.length;
    const completedItems = order.items.filter(
      (item) => item.status === SmartOrderItemStatus.COMPLETED
    ).length;
    const cancelledItems = order.items.filter(
      (item) => item.status === SmartOrderItemStatus.CANCELLED
    ).length;
    const pendingItems = order.items.filter(
      (item) =>
        item.status === SmartOrderItemStatus.PENDING ||
        item.status === SmartOrderItemStatus.IN_PROGRESS
    ).length;

    let newStatus: SmartOrderStatus | null = null;

    if (completedItems + cancelledItems === totalItems && completedItems > 0) {
      // All items are either completed or cancelled, and at least one completed
      newStatus = SmartOrderStatus.COMPLETED;
    } else if (cancelledItems === totalItems) {
      // All items are cancelled
      newStatus = SmartOrderStatus.CANCELLED;
    } else if (completedItems > 0 && pendingItems > 0) {
      // Some completed, some still pending
      newStatus = SmartOrderStatus.PARTIALLY_COMPLETED;
    }

    if (newStatus && newStatus !== order.status) {
      await this.updateOrderStatus(orderId, newStatus);
    }
  }

  /**
   * Get order statistics for a hospital
   */
  async getOrderStats(
    hospitalId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const dateFilter: Prisma.SmartOrderWhereInput = {
      hospitalId,
    };

    if (startDate || endDate) {
      dateFilter.orderedAt = {};
      if (startDate) {
        dateFilter.orderedAt.gte = startDate;
      }
      if (endDate) {
        dateFilter.orderedAt.lte = endDate;
      }
    }

    // Get counts by status
    const [
      totalOrders,
      pendingOrders,
      completedOrders,
      cancelledOrders,
      partiallyCompletedOrders,
    ] = await Promise.all([
      prisma.smartOrder.count({ where: dateFilter }),
      prisma.smartOrder.count({
        where: { ...dateFilter, status: SmartOrderStatus.PENDING },
      }),
      prisma.smartOrder.count({
        where: { ...dateFilter, status: SmartOrderStatus.COMPLETED },
      }),
      prisma.smartOrder.count({
        where: { ...dateFilter, status: SmartOrderStatus.CANCELLED },
      }),
      prisma.smartOrder.count({
        where: { ...dateFilter, status: SmartOrderStatus.PARTIALLY_COMPLETED },
      }),
    ]);

    // Get counts by category (from items)
    const categoryStats = await prisma.smartOrderItem.groupBy({
      by: ['orderType'],
      where: {
        smartOrder: dateFilter,
      },
      _count: {
        id: true,
      },
    });

    // Get counts by priority
    const priorityStats = await prisma.smartOrder.groupBy({
      by: ['priority'],
      where: dateFilter,
      _count: {
        id: true,
      },
    });

    // Calculate average items per order
    const totalItems = await prisma.smartOrderItem.count({
      where: {
        smartOrder: dateFilter,
      },
    });

    // Get total estimated cost
    const costAggregation = await prisma.smartOrder.aggregate({
      where: dateFilter,
      _sum: {
        totalEstimatedCost: true,
      },
      _avg: {
        totalEstimatedCost: true,
      },
    });

    // Get recent orders trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyTrend = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE(ordered_at) as date, COUNT(*) as count
      FROM smart_orders
      WHERE hospital_id = ${hospitalId}
        AND ordered_at >= ${sevenDaysAgo}
      GROUP BY DATE(ordered_at)
      ORDER BY date ASC
    `;

    return {
      summary: {
        totalOrders,
        pendingOrders,
        completedOrders,
        cancelledOrders,
        partiallyCompletedOrders,
        completionRate: totalOrders > 0
          ? ((completedOrders / totalOrders) * 100).toFixed(2)
          : '0.00',
      },
      byCategory: categoryStats.reduce((acc, stat) => {
        acc[stat.orderType] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      byPriority: priorityStats.reduce((acc, stat) => {
        acc[stat.priority] = stat._count.id;
        return acc;
      }, {} as Record<string, number>),
      itemStats: {
        totalItems,
        averageItemsPerOrder: totalOrders > 0
          ? (totalItems / totalOrders).toFixed(2)
          : '0.00',
      },
      costStats: {
        totalEstimatedCost: costAggregation._sum.totalEstimatedCost
          ? Number(costAggregation._sum.totalEstimatedCost).toFixed(2)
          : '0.00',
        averageOrderCost: costAggregation._avg.totalEstimatedCost
          ? Number(costAggregation._avg.totalEstimatedCost).toFixed(2)
          : '0.00',
      },
      dailyTrend: dailyTrend.map((day) => ({
        date: day.date,
        count: Number(day.count),
      })),
      dateRange: {
        startDate: startDate?.toISOString() || null,
        endDate: endDate?.toISOString() || null,
      },
    };
  }

  /**
   * Reorder from an existing order - copy order as template for new patient
   */
  async reorderFromExisting(
    hospitalId: string,
    orderId: string,
    newPatientId: string,
    providerId: string
  ) {
    // Get the original order
    const originalOrder = await prisma.smartOrder.findFirst({
      where: {
        id: orderId,
        hospitalId,
      },
      include: {
        items: true,
      },
    });

    if (!originalOrder) {
      throw new NotFoundError('Original order not found');
    }

    // Verify new patient exists
    const patient = await prisma.patient.findFirst({
      where: {
        id: newPatientId,
        hospitalId,
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Generate new order number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `SO-${dateStr}-${randomSuffix}`;

    // Create new order with same items
    const newOrder = await prisma.smartOrder.create({
      data: {
        hospitalId,
        patientId: newPatientId,
        orderedById: providerId,
        orderNumber,
        diagnosis: originalOrder.diagnosis,
        icdCode: originalOrder.icdCode,
        symptoms: originalOrder.symptoms,
        bundleId: originalOrder.bundleId,
        bundleName: originalOrder.bundleName,
        totalEstimatedCost: originalOrder.totalEstimatedCost,
        notes: `Reordered from ${originalOrder.orderNumber}`,
        items: {
          create: originalOrder.items.map((item) => ({
            orderType: item.orderType,
            name: item.name,
            category: item.category,
            code: item.code,
            urgency: item.urgency,
            confidence: item.confidence,
            rationale: item.rationale,
            dosing: item.dosing,
            warnings: item.warnings,
            estimatedCost: item.estimatedCost,
          })),
        },
      },
      include: {
        items: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        orderedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    logger.info(`Reordered from ${orderId} to new order ${newOrder.id} for patient ${newPatientId}`);

    return newOrder;
  }

  /**
   * Check drug interactions
   */
  async checkInteractions(medications: string[]) {
    try {
      const response = await this.aiClient.post('/api/check-interactions', medications);
      return response.data;
    } catch (error) {
      logger.error('Error checking interactions:', error);
      return {
        interactions: [],
        hasInteractions: false,
        criticalCount: 0,
        highCount: 0,
      };
    }
  }

  /**
   * Check AI service health
   */
  async checkHealth() {
    try {
      const response = await this.aiClient.get('/health');
      return {
        status: 'connected',
        aiService: response.data,
        serviceUrl: SMART_ORDER_SERVICE_URL,
      };
    } catch (error) {
      logger.error('Smart Order AI health check failed:', error);
      return {
        status: 'disconnected',
        error: axios.isAxiosError(error) ? error.message : 'Unknown error',
        serviceUrl: SMART_ORDER_SERVICE_URL,
      };
    }
  }

  // Helper methods

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Fallback recommendations when AI service is unavailable
   */
  private fallbackRecommendations(request: RecommendationRequest, patientContext?: PatientContext) {
    const diagnosis = request.diagnosis.toLowerCase();

    // Basic fallback recommendations
    const baseOrders: Record<string, any> = {
      laboratory: [
        { id: 'lab-1', name: 'CBC with Differential', category: 'laboratory', urgency: 'stat', confidence: 0.9, rationale: 'Standard baseline evaluation' },
        { id: 'lab-2', name: 'Comprehensive Metabolic Panel', category: 'laboratory', urgency: 'stat', confidence: 0.9, rationale: 'Assess electrolytes and organ function' },
      ],
      imaging: [],
      medication: [],
      procedure: [],
      nursing: [],
      consult: [],
    };

    // Add diagnosis-specific orders
    if (diagnosis.includes('sepsis')) {
      baseOrders.laboratory.push(
        { id: 'lab-3', name: 'Blood Cultures x2', category: 'laboratory', urgency: 'stat', confidence: 0.95, rationale: 'Identify causative organism' },
        { id: 'lab-4', name: 'Lactate Level', category: 'laboratory', urgency: 'stat', confidence: 0.98, rationale: 'Assess tissue perfusion' }
      );
      baseOrders.imaging.push(
        { id: 'img-1', name: 'Chest X-Ray', category: 'imaging', urgency: 'stat', confidence: 0.85, rationale: 'Evaluate for source' }
      );
      baseOrders.medication.push(
        { id: 'med-1', name: 'Broad-spectrum Antibiotics', category: 'medication', urgency: 'stat', confidence: 0.95, rationale: 'Empiric coverage' }
      );
    } else if (diagnosis.includes('chest pain') || diagnosis.includes('mi')) {
      baseOrders.laboratory.push(
        { id: 'lab-5', name: 'Troponin (Serial)', category: 'laboratory', urgency: 'stat', confidence: 0.99, rationale: 'Cardiac biomarker' }
      );
      baseOrders.imaging.push(
        { id: 'img-2', name: '12-Lead ECG', category: 'imaging', urgency: 'stat', confidence: 0.99, rationale: 'Assess for ischemia' }
      );
    } else if (diagnosis.includes('pneumonia')) {
      baseOrders.laboratory.push(
        { id: 'lab-6', name: 'Blood Cultures x2', category: 'laboratory', urgency: 'stat', confidence: 0.85, rationale: 'Identify bacteremia' }
      );
      baseOrders.imaging.push(
        { id: 'img-3', name: 'Chest X-Ray PA/Lateral', category: 'imaging', urgency: 'stat', confidence: 0.95, rationale: 'Confirm diagnosis' }
      );
    }

    return {
      diagnosisCode: null,
      diagnosisName: request.diagnosis,
      recommendations: baseOrders,
      bundleSuggestion: null,
      warnings: [],
      totalEstimatedCost: 250.0,
      evidenceLevel: 'Fallback - AI Service Unavailable',
      modelVersion: 'fallback-1.0.0',
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Fallback bundles when AI service is unavailable
   */
  private fallbackBundles() {
    return {
      bundles: [
        {
          id: 'sepsis-bundle',
          name: 'Sepsis Bundle (SEP-1)',
          description: 'Evidence-based sepsis management bundle',
          category: 'critical-care',
          componentCount: 6,
          evidenceLevel: 'Level 1A',
        },
        {
          id: 'acs-bundle',
          name: 'Acute Coronary Syndrome Bundle',
          description: 'Evidence-based ACS management',
          category: 'cardiology',
          componentCount: 7,
          evidenceLevel: 'Level 1A',
        },
        {
          id: 'stroke-bundle',
          name: 'Acute Stroke Bundle',
          description: 'Evidence-based stroke management',
          category: 'neurology',
          componentCount: 7,
          evidenceLevel: 'Level 1A',
        },
        {
          id: 'cap-bundle',
          name: 'Community-Acquired Pneumonia Bundle',
          description: 'Evidence-based CAP management',
          category: 'pulmonology',
          componentCount: 6,
          evidenceLevel: 'Level 1A',
        },
      ],
    };
  }
}

export const smartOrderService = new SmartOrderService();
