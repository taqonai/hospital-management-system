/**
 * GAP 7: Insurance Verification Audit Service
 *
 * Fire-and-forget audit logging for insurance decisions during check-in.
 * All methods are non-blocking — if audit logging fails, the main action
 * proceeds without interruption.
 */

import prisma from '../config/database';

export interface InsuranceAuditEntry {
  hospitalId: string;
  patientId?: string;
  appointmentId?: string;
  action: string;
  previousData?: Record<string, any>;
  newData?: Record<string, any>;
  dhaResponse?: Record<string, any>;
  reason?: string;
  performedBy: string;
  ipAddress?: string;
}

export interface AuditListFilters {
  page?: number;
  limit?: number;
  patientId?: string;
  appointmentId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  performedBy?: string;
}

class InsuranceAuditService {
  /**
   * Log an insurance verification audit entry.
   * Fire-and-forget: never throws, never blocks the caller.
   */
  async logAudit(entry: InsuranceAuditEntry): Promise<void> {
    try {
      await (prisma as any).insuranceVerificationAudit.create({
        data: {
          hospitalId: entry.hospitalId,
          patientId: entry.patientId || null,
          appointmentId: entry.appointmentId || null,
          action: entry.action,
          previousData: entry.previousData || undefined,
          newData: entry.newData || undefined,
          dhaResponse: entry.dhaResponse || undefined,
          reason: entry.reason || null,
          performedBy: entry.performedBy,
          ipAddress: entry.ipAddress || null,
          performedAt: new Date(),
        },
      });
    } catch (error) {
      // GAP 7: Fire-and-forget — log error but never block
      console.error('[AUDIT] Failed to log insurance audit entry:', error);
    }
  }

  /**
   * Get audit entries with filters (admin view).
   */
  async getAuditList(hospitalId: string, filters: AuditListFilters) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };

    if (filters.patientId) {
      where.patientId = filters.patientId;
    }
    if (filters.appointmentId) {
      where.appointmentId = filters.appointmentId;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.performedBy) {
      where.performedBy = filters.performedBy;
    }
    if (filters.startDate || filters.endDate) {
      where.performedAt = {};
      if (filters.startDate) {
        where.performedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.performedAt.lte = new Date(filters.endDate);
      }
    }

    const [entries, total] = await Promise.all([
      (prisma as any).insuranceVerificationAudit.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        skip,
        take: limit,
        include: {
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              mrn: true,
            },
          },
        },
      }),
      (prisma as any).insuranceVerificationAudit.count({ where }),
    ]);

    return {
      entries,
      total,
      page,
      limit,
    };
  }

  /**
   * Get audit entries for CSV export (no pagination).
   */
  async getAuditExport(hospitalId: string, filters: AuditListFilters) {
    const where: any = { hospitalId };

    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.action) where.action = filters.action;
    if (filters.startDate || filters.endDate) {
      where.performedAt = {};
      if (filters.startDate) where.performedAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.performedAt.lte = new Date(filters.endDate);
    }

    const entries = await (prisma as any).insuranceVerificationAudit.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      take: 10000, // Safety limit
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
      },
    });

    // Convert to CSV rows
    const headers = [
      'Date/Time',
      'Action',
      'Patient Name',
      'MRN',
      'Appointment ID',
      'Reason',
      'Performed By',
      'IP Address',
    ];

    const rows = entries.map((e: any) => [
      e.performedAt?.toISOString() || '',
      e.action || '',
      e.patient ? `${e.patient.firstName} ${e.patient.lastName}` : '',
      e.patient?.mrn || '',
      e.appointmentId || '',
      e.reason || '',
      e.performedBy || '',
      e.ipAddress || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: string[]) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    return csvContent;
  }
}

export const insuranceAuditService = new InsuranceAuditService();
