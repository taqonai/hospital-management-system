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

    try {
      // Get all active admissions (using correct model name: admission)
      const admissions = await prisma.admission.findMany({
        where: {
          hospitalId,
          status: 'ADMITTED',
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
            include: { ward: true },
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

        // Calculate outstanding balance from invoices
        const invoices = await prisma.invoice.aggregate({
          _sum: { balanceAmount: true },
          where: {
            admissionId: admission.id,
            status: { in: ['PENDING', 'PARTIALLY_PAID'] },
          },
        });
        const outstandingBalance = Number(invoices._sum.balanceAmount) || 0;

        let status: InsuranceExpiryAlert['status'];
        let recommendedAction: string;

        if (daysUntilExpiry < 0) {
          // Insurance already expired
          status = 'EXPIRED_DURING_STAY';
          recommendedAction = 'Contact patient family immediately. Switch remaining charges to self-pay or collect new insurance details.';
          
          // Log the expiry event
          await this.logExpiryEvent(admission.id, primaryInsurance.id);
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
          roomNumber: admission.bed?.ward?.name || 'Unknown',
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
    } catch (error: any) {
      logger.error('[IPD-INSURANCE] Error checking admissions:', error);
      // Return empty array with graceful handling
      return [];
    }
  }

  /**
   * Log insurance expiry event
   */
  private async logExpiryEvent(admissionId: string, expiredInsuranceId: string): Promise<void> {
    try {
      const admission = await prisma.admission.findUnique({
        where: { id: admissionId },
      });
      
      if (admission) {
        const currentNotes = admission.notes || '';
        const newNote = `[${new Date().toISOString()}] Insurance expired. Remaining charges switched to self-pay.`;
        
        await prisma.admission.update({
          where: { id: admissionId },
          data: {
            notes: currentNotes ? `${currentNotes}\n${newNote}` : newNote,
          },
        });
      }

      logger.warn(`[IPD-INSURANCE] Admission ${admissionId} switched to self-pay due to insurance expiry`);
    } catch (error) {
      logger.error('[IPD-INSURANCE] Failed to log expiry event:', error);
    }
  }

  /**
   * Create notification for insurance expiry
   */
  private async createExpiryNotification(hospitalId: string, alert: InsuranceExpiryAlert): Promise<void> {
    try {
      // Find a hospital admin to assign the notification to
      const hospitalAdmin = await prisma.user.findFirst({
        where: { hospitalId, role: 'HOSPITAL_ADMIN' },
        select: { id: true },
      });

      if (!hospitalAdmin) {
        logger.warn(`[IPD-INSURANCE] No hospital admin found for hospital ${hospitalId}, skipping notification`);
        return;
      }

      // Check if notification already sent today
      const existingNotification = await prisma.notification.findFirst({
        where: {
          userId: hospitalAdmin.id,
          type: 'ALERT',
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          data: { path: ['admissionId'], equals: alert.admissionId },
        },
      });

      if (existingNotification) return;

      // Create notification for hospital admin
      await prisma.notification.create({
        data: {
          userId: hospitalAdmin.id,
          type: 'ALERT',
          title: `Insurance Expired: ${alert.patientName}`,
          message: `Patient ${alert.patientName} (MRN: ${alert.mrn}) in ${alert.roomNumber} has insurance that expired on ${alert.expiryDate.toLocaleDateString()}. Outstanding balance: AED ${alert.outstandingBalance.toFixed(2)}. ${alert.recommendedAction}`,
          data: {
            admissionId: alert.admissionId,
            patientId: alert.patientId,
            insuranceId: alert.insuranceId,
            expiryDate: alert.expiryDate,
            outstandingBalance: alert.outstandingBalance,
          },
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
      const admission = await prisma.admission.findUnique({
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
      const currentNotes = admission.notes || '';
      const newNote = `[${new Date().toISOString()}] New insurance added mid-stay: ${insuranceData.providerName} (${insuranceData.policyNumber})`;
      
      await prisma.admission.update({
        where: { id: admissionId },
        data: {
          notes: currentNotes ? `${currentNotes}\n${newNote}` : newNote,
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
   * Get outstanding balance for an admission
   */
  async getOutstandingBalance(admissionId: string): Promise<{
    totalCharges: number;
    billedAmount: number;
    unbilledAmount: number;
    insurancePending: number;
    patientBalance: number;
  }> {
    try {
      // Get all invoices for this admission
      const invoices = await prisma.invoice.findMany({
        where: { admissionId },
        select: {
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true,
          status: true,
        },
      });

      const totalCharges = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);
      const billedAmount = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0);
      const unbilledAmount = invoices.reduce((sum, inv) => sum + Number(inv.balanceAmount || 0), 0);

      // Get pending insurance claims
      const claims = await prisma.insuranceClaim.aggregate({
        _sum: { claimAmount: true },
        where: {
          invoice: { admissionId },
          status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        },
      });

      const insurancePending = Number(claims._sum.claimAmount) || 0;

      return {
        totalCharges,
        billedAmount,
        unbilledAmount,
        insurancePending,
        patientBalance: unbilledAmount - insurancePending,
      };
    } catch (error: any) {
      logger.error('[IPD-INSURANCE] Error calculating balance:', error);
      return {
        totalCharges: 0,
        billedAmount: 0,
        unbilledAmount: 0,
        insurancePending: 0,
        patientBalance: 0,
      };
    }
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
