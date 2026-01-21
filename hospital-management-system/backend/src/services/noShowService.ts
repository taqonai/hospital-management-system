import prisma from '../config/database';
import { notificationService, NotificationChannel } from './notificationService';
import { slotService } from './slotService';
import { AppointmentStatus, NoShowReason, StageAlertType, StageAlertStatus, NotificationType } from '@prisma/client';

// Buffer times for stage alerts (in minutes)
const VITALS_ALERT_BUFFER = 5;   // Alert after slot interval + 5 mins if no vitals
const DOCTOR_ALERT_BUFFER = 10; // Alert after slot interval + 10 mins if no doctor seen

interface NoShowResult {
  appointmentId: string;
  patientName: string;
  doctorName: string;
  slotTime: string;
  timeoutMinutes: number;
  slotReleased: boolean;
  notificationSent: boolean;
}

interface StageAlertResult {
  appointmentId: string;
  alertType: StageAlertType;
  patientName: string;
  message: string;
}

export class NoShowService {
  /**
   * Parse time string "HH:MM" to minutes since midnight
   */
  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get current time in minutes since midnight
   */
  private getCurrentTimeMinutes(): number {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  /**
   * Check if a slot time is still valid for rebooking
   * A slot is valid if it's in the future (considering both date and time)
   */
  private isSlotStillValid(appointmentDate: Date, slotTime: string, bufferMinutes: number = 5): boolean {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const slotDate = new Date(appointmentDate);
    slotDate.setHours(0, 0, 0, 0);

    // Future dates are always valid for rebooking
    if (slotDate > today) {
      return true;
    }

    // Same day: check if slot time hasn't passed yet
    if (slotDate.getTime() === today.getTime()) {
      const slotMinutes = this.parseTime(slotTime);
      const currentMinutes = this.getCurrentTimeMinutes();
      return slotMinutes > currentMinutes + bufferMinutes;
    }

    // Past dates are never valid
    return false;
  }

  /**
   * Process auto NO_SHOW for appointments that haven't checked in
   * after their slot time + doctor's slot interval
   */
  async processAutoNoShows(): Promise<NoShowResult[]> {
    const results: NoShowResult[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentMinutes = this.getCurrentTimeMinutes();

    // Find appointments that are SCHEDULED or CONFIRMED for today
    // and haven't been checked in yet
    const appointments = await prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          in: ['SCHEDULED', 'CONFIRMED'],
        },
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            oderId: true,
          },
        },
        doctor: {
          select: {
            id: true,
            slotDuration: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        hospital: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    for (const appointment of appointments) {
      const slotStartMinutes = this.parseTime(appointment.startTime);
      const timeoutMinutes = appointment.doctor.slotDuration;
      const noShowThreshold = slotStartMinutes + timeoutMinutes;

      // Check if current time has exceeded the no-show threshold
      if (currentMinutes >= noShowThreshold) {
        try {
          // Mark appointment as NO_SHOW
          await prisma.appointment.update({
            where: { id: appointment.id },
            data: { status: 'NO_SHOW' },
          });

          // Check if slot can be released for rebooking
          const canReleaseSlot = this.isSlotStillValid(appointment.appointmentDate, appointment.startTime);
          let slotReleased = false;

          if (canReleaseSlot) {
            try {
              await slotService.releaseSlot(appointment.id);
              slotReleased = true;
            } catch (error) {
              console.error(`Failed to release slot for appointment ${appointment.id}:`, error);
            }
          }

          // Create NO_SHOW log
          await prisma.noShowLog.create({
            data: {
              hospitalId: appointment.hospitalId,
              appointmentId: appointment.id,
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              reason: 'AUTO_TIMEOUT',
              slotTime: appointment.startTime,
              timeoutMinutes,
              slotReleased,
              slotReleasedAt: slotReleased ? new Date() : null,
              notificationSent: false,
            },
          });

          // Send notification to patient
          let notificationSent = false;
          try {
            const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
            const doctorName = `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;

            if (appointment.patient.oderId) {
              await notificationService.sendNotification(
                appointment.patient.oderId,
                'APPOINTMENT' as NotificationType,
                {
                  title: 'Missed Appointment',
                  message: `You missed your ${appointment.startTime} appointment with ${doctorName}. Please contact us to reschedule.`,
                  priority: 'high',
                  metadata: {
                    appointmentId: appointment.id,
                    type: 'NO_SHOW',
                  },
                },
                ['sms', 'in_app'] as NotificationChannel[]
              );

              // Update log with notification status
              await prisma.noShowLog.updateMany({
                where: { appointmentId: appointment.id },
                data: { notificationSent: true },
              });
              notificationSent = true;
            }
          } catch (error) {
            console.error(`Failed to send NO_SHOW notification for appointment ${appointment.id}:`, error);
          }

          results.push({
            appointmentId: appointment.id,
            patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
            doctorName: `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
            slotTime: appointment.startTime,
            timeoutMinutes,
            slotReleased,
            notificationSent,
          });

          console.log(`[NO_SHOW] Auto-marked appointment ${appointment.id} - Patient: ${appointment.patient.firstName} ${appointment.patient.lastName}, Slot: ${appointment.startTime}, Timeout: ${timeoutMinutes}min, Slot Released: ${slotReleased}`);
        } catch (error) {
          console.error(`Failed to process NO_SHOW for appointment ${appointment.id}:`, error);
        }
      }
    }

    return results;
  }

  /**
   * Process stage alerts for checked-in patients
   * - NO_VITALS: Checked in but no vitals recorded after slot interval + 5 mins
   * - NO_DOCTOR: Vitals done but doctor not seen after slot interval + 10 mins
   */
  async processStageAlerts(): Promise<StageAlertResult[]> {
    const results: StageAlertResult[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentMinutes = this.getCurrentTimeMinutes();

    // Find checked-in appointments without vitals
    const checkedInNoVitals = await prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: today,
          lt: tomorrow,
        },
        status: 'CHECKED_IN',
        vitalsRecordedAt: null,
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
        doctor: {
          select: {
            id: true,
            slotDuration: true,
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        stageAlerts: {
          where: {
            alertType: 'NO_VITALS',
            status: 'ACTIVE',
          },
        },
      },
    });

    for (const appointment of checkedInNoVitals) {
      const slotStartMinutes = this.parseTime(appointment.startTime);
      const alertThreshold = slotStartMinutes + appointment.doctor.slotDuration + VITALS_ALERT_BUFFER;

      // Check if we should trigger an alert and haven't already
      if (currentMinutes >= alertThreshold && appointment.stageAlerts.length === 0) {
        const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
        const message = `Patient ${patientName} (${appointment.patient.mrn}) checked in at ${appointment.startTime} but vitals not recorded. Please attend.`;

        try {
          await prisma.stageAlert.create({
            data: {
              hospitalId: appointment.hospitalId,
              appointmentId: appointment.id,
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              alertType: 'NO_VITALS',
              message,
            },
          });

          // Notify nurses (in a real system, would target nurses on duty)
          // For now, create in-app notification
          console.log(`[STAGE_ALERT] NO_VITALS - ${message}`);

          results.push({
            appointmentId: appointment.id,
            alertType: 'NO_VITALS',
            patientName,
            message,
          });
        } catch (error) {
          console.error(`Failed to create NO_VITALS alert for appointment ${appointment.id}:`, error);
        }
      }
    }

    // Find appointments with vitals but not yet with doctor (still CHECKED_IN)
    const vitalsNoDoctor = await prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: today,
          lt: tomorrow,
        },
        status: 'CHECKED_IN',
        vitalsRecordedAt: { not: null },
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
        doctor: {
          select: {
            id: true,
            slotDuration: true,
            userId: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        stageAlerts: {
          where: {
            alertType: 'NO_DOCTOR',
            status: 'ACTIVE',
          },
        },
      },
    });

    for (const appointment of vitalsNoDoctor) {
      const slotStartMinutes = this.parseTime(appointment.startTime);
      const alertThreshold = slotStartMinutes + appointment.doctor.slotDuration + DOCTOR_ALERT_BUFFER;

      // Check if we should trigger an alert and haven't already
      if (currentMinutes >= alertThreshold && appointment.stageAlerts.length === 0) {
        const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
        const doctorName = `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;
        const message = `Patient ${patientName} (${appointment.patient.mrn}) has been waiting with vitals completed. Slot: ${appointment.startTime}`;

        try {
          await prisma.stageAlert.create({
            data: {
              hospitalId: appointment.hospitalId,
              appointmentId: appointment.id,
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              alertType: 'NO_DOCTOR',
              message,
            },
          });

          // Notify the doctor
          try {
            await notificationService.sendNotification(
              appointment.doctor.userId,
              'ALERT' as NotificationType,
              {
                title: 'Patient Waiting',
                message,
                priority: 'high',
                metadata: {
                  appointmentId: appointment.id,
                  alertType: 'NO_DOCTOR',
                },
              },
              ['in_app'] as NotificationChannel[]
            );
          } catch (error) {
            console.error(`Failed to notify doctor for appointment ${appointment.id}:`, error);
          }

          console.log(`[STAGE_ALERT] NO_DOCTOR - ${message}`);

          results.push({
            appointmentId: appointment.id,
            alertType: 'NO_DOCTOR',
            patientName,
            message,
          });
        } catch (error) {
          console.error(`Failed to create NO_DOCTOR alert for appointment ${appointment.id}:`, error);
        }
      }
    }

    return results;
  }

  /**
   * Manually mark an appointment as NO_SHOW
   */
  async manualNoShow(
    appointmentId: string,
    hospitalId: string,
    userId: string,
    reason: 'MANUAL_STAFF' | 'MANUAL_DOCTOR' | 'PATIENT_CALLED',
    notes?: string
  ): Promise<NoShowResult> {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            oderId: true,
          },
        },
        doctor: {
          select: {
            id: true,
            slotDuration: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status === 'NO_SHOW') {
      throw new Error('Appointment is already marked as NO_SHOW');
    }

    if (['COMPLETED', 'CANCELLED', 'IN_PROGRESS'].includes(appointment.status)) {
      throw new Error(`Cannot mark ${appointment.status} appointment as NO_SHOW`);
    }

    // Mark as NO_SHOW
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'NO_SHOW' },
    });

    // Check if slot can be released
    const canReleaseSlot = this.isSlotStillValid(appointment.appointmentDate, appointment.startTime);
    let slotReleased = false;

    if (canReleaseSlot) {
      try {
        await slotService.releaseSlot(appointmentId);
        slotReleased = true;
      } catch (error) {
        console.error(`Failed to release slot for appointment ${appointmentId}:`, error);
      }
    }

    // Create NO_SHOW log
    await prisma.noShowLog.create({
      data: {
        hospitalId,
        appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        reason: reason as NoShowReason,
        slotTime: appointment.startTime,
        timeoutMinutes: appointment.doctor.slotDuration,
        slotReleased,
        slotReleasedAt: slotReleased ? new Date() : null,
        notificationSent: false,
        notes,
        createdBy: userId,
      },
    });

    // Send notification
    let notificationSent = false;
    try {
      const doctorName = `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`;

      if (appointment.patient.oderId) {
        await notificationService.sendNotification(
          appointment.patient.oderId,
          'APPOINTMENT' as NotificationType,
          {
            title: 'Appointment Marked as Missed',
            message: `Your ${appointment.startTime} appointment with ${doctorName} has been marked as missed. Please contact us to reschedule.`,
            priority: 'normal',
            metadata: {
              appointmentId,
              type: 'NO_SHOW',
            },
          },
          ['sms', 'in_app'] as NotificationChannel[]
        );

        await prisma.noShowLog.updateMany({
          where: { appointmentId },
          data: { notificationSent: true },
        });
        notificationSent = true;
      }
    } catch (error) {
      console.error(`Failed to send notification for manual NO_SHOW:`, error);
    }

    return {
      appointmentId,
      patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      doctorName: `Dr. ${appointment.doctor.user.firstName} ${appointment.doctor.user.lastName}`,
      slotTime: appointment.startTime,
      timeoutMinutes: appointment.doctor.slotDuration,
      slotReleased,
      notificationSent,
    };
  }

  /**
   * Acknowledge a stage alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await prisma.stageAlert.update({
      where: { id: alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
    });
  }

  /**
   * Resolve a stage alert
   */
  async resolveAlert(alertId: string, userId: string): Promise<void> {
    await prisma.stageAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: userId,
      },
    });
  }

  /**
   * Get active stage alerts for a hospital
   */
  async getActiveAlerts(hospitalId: string) {
    return prisma.stageAlert.findMany({
      where: {
        hospitalId,
        status: 'ACTIVE',
      },
      include: {
        appointment: {
          select: {
            startTime: true,
            tokenNumber: true,
          },
        },
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
        doctor: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { triggeredAt: 'asc' },
    });
  }

  /**
   * Get NO_SHOW logs for reporting
   */
  async getNoShowLogs(
    hospitalId: string,
    params: {
      startDate?: Date;
      endDate?: Date;
      doctorId?: string;
      patientId?: string;
      reason?: NoShowReason;
      limit?: number;
      offset?: number;
    }
  ) {
    const { startDate, endDate, doctorId, patientId, reason, limit = 50, offset = 0 } = params;

    const where: any = { hospitalId };

    if (startDate && endDate) {
      where.triggeredAt = {
        gte: startDate,
        lte: endDate,
      };
    }
    if (doctorId) where.doctorId = doctorId;
    if (patientId) where.patientId = patientId;
    if (reason) where.reason = reason;

    const [logs, total] = await Promise.all([
      prisma.noShowLog.findMany({
        where,
        include: {
          patient: {
            select: {
              firstName: true,
              lastName: true,
              mrn: true,
            },
          },
          doctor: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { triggeredAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.noShowLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get NO_SHOW statistics for a hospital
   */
  async getNoShowStats(hospitalId: string, startDate: Date, endDate: Date) {
    const logs = await prisma.noShowLog.findMany({
      where: {
        hospitalId,
        triggeredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        reason: true,
        slotReleased: true,
      },
    });

    const totalNoShows = logs.length;
    const autoNoShows = logs.filter(l => l.reason === 'AUTO_TIMEOUT').length;
    const manualNoShows = totalNoShows - autoNoShows;
    const slotsReleased = logs.filter(l => l.slotReleased).length;

    // Get total appointments for rate calculation
    const totalAppointments = await prisma.appointment.count({
      where: {
        hospitalId,
        appointmentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return {
      totalNoShows,
      autoNoShows,
      manualNoShows,
      slotsReleased,
      noShowRate: totalAppointments > 0 ? ((totalNoShows / totalAppointments) * 100).toFixed(2) : '0',
      totalAppointments,
    };
  }
}

export const noShowService = new NoShowService();
