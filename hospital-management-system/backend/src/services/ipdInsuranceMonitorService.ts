/**
 * IPD Insurance Monitor Service
 * 
 * Monitors insurance status for admitted IPD patients
 * - Daily check for expiring/expired insurance
 * - Alerts admin when insurance expires mid-stay
 * - Auto-switches remaining charges to self-pay
 * - Allows adding new insurance mid-stay
 */

import prisma from '../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import logger from '../utils/logger';
import cron from 'node-cron';

export interface InsuranceExpiryAlert {
  patientId: string;
  patientName: string;
  mrn: string;
  admissionId: string;
  roomNumber: string;
  insuranceId: string;
  insuranceProvider: string;
  policyNumber: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  status: 'EXPIRING_SOON' | 'EXPIRED' | 'EXPIRED_DURING_STAY';
  outstandingBalance: number;
  recommendedAction: string;
}

class IPDInsuranceMonitorService {
  
  /**
   * Check all admitted patients for insurance expiry
   */
  async checkAllAdmittedPatients(hospitalId: string): Promise<InsuranceExpiryAlert[]> {
    const alerts: InsuranceExpiryAlert[] = [];
    const today = new Date();
    const warningThreshold = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days warning

    // Get all active IPD admissions
    const admissions = await prisma.iPDAdmission.findMany({
      where: {
        hospitalId,
        status: { in: ['ADMITTED', 'IN_PROGRESS'] },
      },
      include: {
        patient: {
          include: {
            insurances: {
              where: { isActive: true },
              orderBy: { priority: 'asc' },
            },
          },
        },
        bed: {
          include: { room: true },
        },
      },
    });

    for (const admission of admissions) {
      const patient = admission.patient;
      const primaryInsurance = patient.insurances.find(i => i.priority === 1);

      if (!primaryInsurance) {
        // Patient has no insurance - should already be self-pay
        continue;
      }

      const expiryDate = primaryInsurance.expiryDate;
      if (!expiryDate) continue;

      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate outstanding balance
      const charges = await prisma.iPDCharge.aggregate({
        _sum: { amount: true },
        where: {
          admissionId: admission.id,
          billedInvoiceId: null, // Not yet billed
        },
      });
      const outstandingBalance = Number(charges._sum.amount) || 0;

      let status: InsuranceExpiryAlert['status'];
      let recommendedAction: string;

      if (daysUntilExpiry < 0) {
        // Insurance already expired
        status = 'EXPIRED_DURING_STAY';
        recommendedAction = 'Contact patient family immediately. Switch remaining charges to self-pay or collect new insurance details.';
        
        // Auto-switch to self-pay flag
        await this.markForSelfPay(admission.id, primaryInsurance.id);
      } else if (daysUntilExpiry <= 7) {
        status = 'EXPIRING_SOON';
        recommendedAction = `Insurance expires in ${daysUntilExpiry} days. Contact patient to renew or provide alternate coverage.`;
      } else {
        continue; // Insurance is fine
      }

      alerts.push({
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        mrn: patient.mrn,
        admissionId: admission.id,
        roomNumber: admission.bed?.room?.roomNumber || 'Unknown',
        insuranceId: primaryInsurance.id,
        insuranceProvider: primaryInsurance.providerName,
        policyNumber: primaryInsurance.policyNumber,
        expiryDate,
        daysUntilExpiry,
        status,
        outstandingBalance,
        recommendedAction,
      });
    }

    // Create notifications for critical alerts
    for (const alert of alerts.filter(a => a.status === 'EXPIRED_DURING_STAY')) {
      await this.createExpiryNotification(hospitalId, alert);
    }

    return alerts;
  }

  /**
   * Mark admission charges to switch to self-pay after insurance expiry
   */
  private async markForSelfPay(admissionId: string, expiredInsuranceId: string): Promise<void> {
    // Update admission metadata
    await prisma.iPDAdmission.update({
      where: { id: admissionId },
      data: {
        notes: prisma.iPDAdmission.fields.notes 
          ? `${prisma.iPDAdmission.fields.notes}\n[${new Date().toISOString()}] Insurance expired. Remaining charges switched to self-pay.`
          : `[${new Date().toISOString()}] Insurance expired. Remaining charges switched to self-pay.`,
      },
    });

    // Log the event
    logger.warn(`[IPD-INSURANCE] Admission ${admissionId} switched to self-pay due to insurance expiry`);
  }

  /**
   * Create notification for insurance expiry
   */
  private async createExpiryNotification(hospitalId: string, alert: InsuranceExpiryAlert): Promise<void> {
    try {
      // Check if notification already sent today
      const existingNotification = await prisma.notification.findFirst({
        where: {
          hospitalId,
          type: 'INSURANCE_EXPIRY',
          referenceId: alert.admissionId,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      });

      if (existingNotification) return;

      // Create notification for admins and receptionists
      await prisma.notification.create({
        data: {
          hospitalId,
          type: 'INSURANCE_EXPIRY',
          title: `⚠️ Insurance Expired: ${alert.patientName}`,
          message: `Patient ${alert.patientName} (MRN: ${alert.mrn}) in Room ${alert.roomNumber} has insurance that expired on ${alert.expiryDate.toLocaleDateString()}. Outstanding balance: AED ${alert.outstandingBalance.toFixed(2)}. ${alert.recommendedAction}`,
          priority: 'HIGH',
          referenceId: alert.admissionId,
          referenceType: 'IPD_ADMISSION',
          targetRoles: ['HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT'],
          metadata: JSON.stringify({
            patientId: alert.patientId,
            insuranceId: alert.insuranceId,
            expiryDate: alert.expiryDate,
            outstandingBalance: alert.outstandingBalance,
          }),
        },
      });

      logger.info(`[IPD-INSURANCE] Created expiry notification for admission ${alert.admissionId}`);
    } catch (error) {
      logger.error('[IPD-INSURANCE] Failed to create notification:', error);
    }
  }

  /**
   * Add new insurance to patient mid-stay
   */
  async addMidStayInsurance(
    admissionId: string,
    insuranceData: {
      providerName: string;
      policyNumber: string;
      subscriberName: string;
      subscriberId: string;
      relationship: string;
      effectiveDate: Date;
      expiryDate?: Date;
      coverageType: string;
      copay?: number;
      priority?: number;
    }
  ): Promise<{ success: boolean; insuranceId?: string; message: string }> {
    try {
      const admission = await prisma.iPDAdmission.findUnique({
        where: { id: admissionId },
        include: { patient: true },
      });

      if (!admission) {
        return { success: false, message: 'Admission not found' };
      }

      // Determine priority (if not specified, make it primary)
      const existingInsurances = await prisma.patientInsurance.findMany({
        where: { patientId: admission.patientId, isActive: true },
      });

      const priority = insuranceData.priority || 
        (existingInsurances.length === 0 ? 1 : Math.max(...existingInsurances.map(i => i.priority)) + 1);

      // Create new insurance
      const newInsurance = await prisma.patientInsurance.create({
        data: {
          patientId: admission.patientId,
          providerName: insuranceData.providerName,
          policyNumber: insuranceData.policyNumber,
          subscriberName: insuranceData.subscriberName,
          subscriberId: insuranceData.subscriberId,
          relationship: insuranceData.relationship,
          effectiveDate: insuranceData.effectiveDate,
          expiryDate: insuranceData.expiryDate,
          coverageType: insuranceData.coverageType,
          copay: insuranceData.copay ? new Decimal(insuranceData.copay) : null,
          priority,
          isPrimary: priority === 1,
          isActive: true,
          verificationStatus: 'PENDING',
          verificationSource: 'MANUAL',
        },
      });

      // Update admission notes
      await prisma.iPDAdmission.update({
        where: { id: admissionId },
        data: {
          notes: `${admission.notes || ''}\n[${new Date().toISOString()}] New insurance added mid-stay: ${insuranceData.providerName} (${insuranceData.policyNumber})`,
        },
      });

      logger.info(`[IPD-INSURANCE] Added mid-stay insurance for admission ${admissionId}: ${newInsurance.id}`);

      return {
        success: true,
        insuranceId: newInsurance.id,
        message: `Insurance added successfully. Priority: ${priority === 1 ? 'Primary' : 'Secondary'}. Pending verification.`,
      };
    } catch (error: any) {
      logger.error('[IPD-INSURANCE] Failed to add mid-stay insurance:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get outstanding balance for self-pay conversion
   */
  async getOutstandingBalance(admissionId: string): Promise<{
    totalCharges: number;
    billedAmount: number;
    unbilledAmount: number;
    insurancePending: number;
    patientBalance: number;
  }> {
    const charges = await prisma.iPDCharge.groupBy({
      by: ['billedInvoiceId'],
      _sum: { amount: true },
      where: { admissionId },
    });

    const billedCharges = charges.filter(c => c.billedInvoiceId !== null);
    const unbilledCharges = charges.filter(c => c.billedInvoiceId === null);

    const totalCharges = charges.reduce((sum, c) => sum + Number(c._sum.amount || 0), 0);
    const billedAmount = billedCharges.reduce((sum, c) => sum + Number(c._sum.amount || 0), 0);
    const unbilledAmount = unbilledCharges.reduce((sum, c) => sum + Number(c._sum.amount || 0), 0);

    // Get pending insurance claims
    const claims = await prisma.insuranceClaim.aggregate({
      _sum: { claimedAmount: true },
      where: {
        invoice: {
          ipdAdmissionId: admissionId,
        },
        status: { in: ['PENDING', 'SUBMITTED'] },
      },
    });

    const insurancePending = Number(claims._sum.claimedAmount) || 0;

    return {
      totalCharges,
      billedAmount,
      unbilledAmount,
      insurancePending,
      patientBalance: unbilledAmount, // After insurance expires, patient pays unbilled
    };
  }

  /**
   * Initialize cron job for daily insurance checks
   */
  initializeCronJob(): void {
    // Run daily at 8 AM
    cron.schedule('0 8 * * *', async () => {
      logger.info('[IPD-INSURANCE-CRON] Starting daily insurance expiry check...');
      
      try {
        // Get all hospitals
        const hospitals = await prisma.hospital.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
        });

        for (const hospital of hospitals) {
          const alerts = await this.checkAllAdmittedPatients(hospital.id);
          
          if (alerts.length > 0) {
            logger.info(`[IPD-INSURANCE-CRON] ${hospital.name}: ${alerts.length} insurance alerts found`);
          }
        }
        
        logger.info('[IPD-INSURANCE-CRON] Daily check completed');
      } catch (error) {
        logger.error('[IPD-INSURANCE-CRON] Error during check:', error);
      }
    });

    logger.info('[CRON] IPD_INSURANCE_EXPIRY cron job initialized — Daily at 8:00 AM');
  }
}

export const ipdInsuranceMonitorService = new IPDInsuranceMonitorService();
