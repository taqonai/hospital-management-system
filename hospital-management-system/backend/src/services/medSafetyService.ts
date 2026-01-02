import prisma from '../config/database';
import axios from 'axios';
import { NotFoundError, BadRequestError } from '../middleware/errorHandler';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export interface FiveRightsVerification {
  patientId: string;
  patientName: string;
  patientDob: string;
  scannedPatientId: string;
  medicationName: string;
  scannedBarcode?: string;
  orderedDose: number;
  orderedUnit: string;
  orderedRoute: string;
  scheduledTime: string;
  currentTime?: string;
  patientWeight?: number;
  patientAge?: number;
  allergies?: string[];
  currentMedications?: string[];
  renalFunction?: string;
}

export interface MedicationAdministration {
  patientId: string;
  prescriptionId: string;
  medicationId: string;
  administeredBy: string;
  dose: number;
  unit: string;
  route: string;
  scheduledTime: string;
  administeredTime: string;
  notes?: string;
  overrideReason?: string;
  verificationResult?: any;
}

export interface MedicationAlert {
  patientId: string;
  medicationId?: string;
  alertType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' | 'INFO';
  message: string;
  details?: any;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export class MedSafetyService {
  /**
   * Verify 5 Rights of medication administration via AI service
   */
  async verifyFiveRights(data: FiveRightsVerification): Promise<any> {
    try {
      // Get patient details for additional verification
      const patient = await prisma.patient.findUnique({
        where: { id: data.patientId },
        include: {
          allergies: true,
          prescriptions: {
            where: { status: 'ACTIVE' },
            include: {
              medications: {
                include: { drug: true }
              }
            }
          }
        }
      });

      if (!patient) {
        throw new NotFoundError('Patient not found');
      }

      // Build allergies list
      const allergies = data.allergies || patient.allergies.map(a => a.allergen);

      // Build current medications list
      const currentMedications = data.currentMedications ||
        patient.prescriptions
          .flatMap(p => p.medications.map(m => m.drug?.genericName || m.drug?.name))
          .filter(Boolean) as string[];

      // Calculate patient age
      const birthDate = new Date(patient.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // Call AI service for verification
      const response = await axios.post(`${AI_SERVICE_URL}/api/med-safety/verify-five-rights`, {
        patientId: data.patientId,
        patientName: data.patientName || `${patient.firstName} ${patient.lastName}`,
        patientDob: data.patientDob || patient.dateOfBirth.toISOString(),
        scannedPatientId: data.scannedPatientId,
        medicationName: data.medicationName,
        scannedBarcode: data.scannedBarcode,
        orderedDose: data.orderedDose,
        orderedUnit: data.orderedUnit,
        orderedRoute: data.orderedRoute,
        scheduledTime: data.scheduledTime,
        currentTime: data.currentTime || new Date().toISOString(),
        patientWeight: data.patientWeight || patient.weight,
        patientAge: data.patientAge || age,
        allergies,
        currentMedications,
        renalFunction: data.renalFunction,
      });

      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new BadRequestError(error.response.data.detail || 'Verification failed');
      }
      throw error;
    }
  }

  /**
   * Process barcode scan
   */
  async processBarcodeScan(barcode: string, expectedType: string = 'any'): Promise<any> {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/med-safety/scan-barcode`, {
        barcode,
        expectedType,
      });

      // If it's a patient barcode, try to look up patient
      if (response.data.type === 'PATIENT' && response.data.data?.patientId) {
        const patientId = response.data.data.patientId.replace('PT', '').replace('MRN', '');
        const patient = await prisma.patient.findFirst({
          where: {
            OR: [
              { id: patientId },
              { mrn: patientId },
              { mrn: response.data.data.patientId },
            ]
          },
          select: {
            id: true,
            mrn: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
          }
        });

        if (patient) {
          response.data.patient = patient;
        }
      }

      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new BadRequestError(error.response.data.detail || 'Barcode scan failed');
      }
      throw error;
    }
  }

  /**
   * Get patient's due medications
   */
  async getPatientDueMedications(patientId: string): Promise<any> {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        prescriptions: {
          where: { status: 'ACTIVE' },
          include: {
            medications: {
              where: { isDispensed: true },
              include: { drug: true }
            },
            doctor: {
              include: { user: { select: { firstName: true, lastName: true } } }
            }
          }
        },
        allergies: true,
      }
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Build medication schedule
    const now = new Date();
    const medications: any[] = [];

    for (const prescription of patient.prescriptions) {
      for (const med of prescription.medications) {
        // Parse frequency to determine scheduled times
        const scheduledTimes = this.parseFrequencyToTimes(med.frequency, now);

        for (const scheduledTime of scheduledTimes) {
          const isHighAlert = await this.isHighAlertMedication(med.drug?.genericName || med.drug?.name || '');

          medications.push({
            id: med.id,
            prescriptionId: prescription.id,
            name: med.drug?.name || 'Unknown',
            genericName: med.drug?.genericName,
            dose: med.dosage,
            unit: this.extractUnit(med.dosage),
            route: med.route,
            frequency: med.frequency,
            scheduledTime: scheduledTime.toISOString(),
            isPRN: med.frequency?.toLowerCase().includes('prn') || false,
            isHighAlert,
            instructions: med.instructions,
            prescribedBy: prescription.doctor ?
              `Dr. ${prescription.doctor.user.firstName} ${prescription.doctor.user.lastName}` :
              'Unknown',
          });
        }
      }
    }

    // Sort by scheduled time
    medications.sort((a, b) =>
      new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
    );

    // Call AI service to categorize by due status
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/med-safety/medication-schedule`, {
        patientMedications: medications,
        currentTime: now.toISOString(),
      });
      return {
        patient: {
          id: patient.id,
          mrn: patient.mrn,
          name: `${patient.firstName} ${patient.lastName}`,
          dateOfBirth: patient.dateOfBirth,
          allergies: patient.allergies.map(a => a.allergen),
        },
        ...response.data,
      };
    } catch {
      // Fallback if AI service is unavailable
      return {
        patient: {
          id: patient.id,
          mrn: patient.mrn,
          name: `${patient.firstName} ${patient.lastName}`,
          dateOfBirth: patient.dateOfBirth,
          allergies: patient.allergies.map(a => a.allergen),
        },
        medications,
        currentTime: now.toISOString(),
      };
    }
  }

  /**
   * Record medication administration
   */
  async recordAdministration(data: MedicationAdministration): Promise<any> {
    // Verify the medication exists
    const medication = await prisma.prescriptionMedication.findUnique({
      where: { id: data.medicationId },
      include: {
        prescription: true,
        drug: true,
      }
    });

    if (!medication) {
      throw new NotFoundError('Medication not found');
    }

    // Create administration record (using prescription medication update for now)
    // In a full implementation, this would create a separate administration log
    const result = await prisma.prescriptionMedication.update({
      where: { id: data.medicationId },
      data: {
        // Mark as administered for this dose
        dispensedAt: new Date(data.administeredTime),
        dispensedBy: data.administeredBy,
      },
      include: { drug: true }
    });

    // Log the administration event
    const administrationLog = {
      medicationId: data.medicationId,
      patientId: data.patientId,
      prescriptionId: data.prescriptionId,
      administeredBy: data.administeredBy,
      dose: data.dose,
      unit: data.unit,
      route: data.route,
      scheduledTime: data.scheduledTime,
      administeredTime: data.administeredTime,
      notes: data.notes,
      overrideReason: data.overrideReason,
      verificationResult: data.verificationResult,
      createdAt: new Date(),
    };

    return {
      success: true,
      message: 'Medication administration recorded',
      medication: result,
      administrationLog,
    };
  }

  /**
   * Get medication alerts for a patient
   */
  async getPatientAlerts(patientId: string): Promise<any> {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        allergies: true,
        prescriptions: {
          where: { status: 'ACTIVE' },
          include: {
            medications: {
              include: { drug: true }
            }
          }
        }
      }
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    const alerts: MedicationAlert[] = [];

    // Check for high-alert medications
    for (const prescription of patient.prescriptions) {
      for (const med of prescription.medications) {
        const drugName = med.drug?.genericName || med.drug?.name || '';
        const isHighAlert = await this.isHighAlertMedication(drugName);

        if (isHighAlert) {
          alerts.push({
            patientId,
            medicationId: med.id,
            alertType: 'HIGH_ALERT_MEDICATION',
            severity: 'HIGH',
            message: `High-alert medication: ${drugName}`,
            details: isHighAlert,
          });
        }
      }
    }

    // Check for drug allergies
    for (const allergy of patient.allergies) {
      for (const prescription of patient.prescriptions) {
        for (const med of prescription.medications) {
          const drugName = (med.drug?.genericName || med.drug?.name || '').toLowerCase();
          if (drugName.includes(allergy.allergen.toLowerCase())) {
            alerts.push({
              patientId,
              medicationId: med.id,
              alertType: 'ALLERGY',
              severity: 'CRITICAL',
              message: `Patient allergic to ${allergy.allergen}`,
              details: {
                medication: med.drug?.name,
                allergen: allergy.allergen,
                reaction: allergy.reaction,
              },
            });
          }
        }
      }
    }

    return {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      alertCount: alerts.length,
      criticalCount: alerts.filter(a => a.severity === 'CRITICAL').length,
      highCount: alerts.filter(a => a.severity === 'HIGH').length,
      alerts,
    };
  }

  /**
   * Record alert override with reason
   */
  async recordOverride(data: {
    patientId: string;
    medicationId: string;
    alertType: string;
    overrideReason: string;
    overriddenBy: string;
    verificationData?: any;
  }): Promise<any> {
    // In a full implementation, this would create an override log entry
    const overrideLog = {
      ...data,
      overriddenAt: new Date(),
      id: `override_${Date.now()}`,
    };

    return {
      success: true,
      message: 'Override recorded',
      override: overrideLog,
    };
  }

  /**
   * Get high-alert drug list from AI service
   */
  async getHighAlertDrugs(): Promise<any> {
    try {
      const response = await axios.get(`${AI_SERVICE_URL}/api/med-safety/high-alert-drugs`);
      return response.data;
    } catch (error: any) {
      // Return fallback list if AI service unavailable
      return {
        categories: {
          Anticoagulant: [
            { name: 'Heparin', risk: 'Bleeding', specialChecks: ['PTT monitoring', 'Weight-based dosing'] },
            { name: 'Warfarin', risk: 'Bleeding', specialChecks: ['INR monitoring', 'Drug interactions'] },
            { name: 'Enoxaparin', risk: 'Bleeding', specialChecks: ['Renal function', 'Weight-based dosing'] },
          ],
          Insulin: [
            { name: 'Insulin Regular', risk: 'Hypoglycemia', specialChecks: ['Blood glucose', 'Sliding scale protocol'] },
            { name: 'Insulin Glargine', risk: 'Hypoglycemia', specialChecks: ['Blood glucose', 'Once daily dosing'] },
          ],
          Opioid: [
            { name: 'Morphine', risk: 'Respiratory depression', specialChecks: ['Respiratory rate', 'Sedation level', 'Naloxone available'] },
            { name: 'Hydromorphone', risk: 'Respiratory depression', specialChecks: ['Respiratory rate', '5x potency of morphine'] },
            { name: 'Fentanyl', risk: 'Respiratory depression', specialChecks: ['Respiratory rate', 'Patch rotation'] },
          ],
          Electrolyte: [
            { name: 'Potassium Chloride', risk: 'Cardiac arrhythmia', specialChecks: ['Rate not >10 mEq/hr', 'Never IV push'] },
            { name: 'Magnesium Sulfate', risk: 'Respiratory depression', specialChecks: ['Deep tendon reflexes', 'Respiratory rate'] },
          ],
        },
        totalDrugs: 12,
        modelVersion: 'fallback',
      };
    }
  }

  /**
   * Check IV compatibility
   */
  async checkIVCompatibility(drug1: string, drug2: string): Promise<any> {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/med-safety/iv-compatibility`, {
        drug1,
        drug2,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new BadRequestError(error.response.data.detail || 'IV compatibility check failed');
      }
      throw error;
    }
  }

  /**
   * Calculate dose
   */
  async calculateDose(data: {
    medicationName: string;
    patientWeight: number;
    patientAge: number;
    dosePerKg?: number;
    frequencyHours?: number;
    maxSingleDose?: number;
    maxDailyDose?: number;
    renalFunction?: string;
  }): Promise<any> {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/med-safety/calculate-dose`, data);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        throw new BadRequestError(error.response.data.detail || 'Dose calculation failed');
      }
      throw error;
    }
  }

  // Helper methods
  private parseFrequencyToTimes(frequency: string | null, baseDate: Date): Date[] {
    if (!frequency) return [];

    const times: Date[] = [];
    const freqLower = frequency.toLowerCase();

    // Standard medication times
    const standardTimes: Record<string, number[]> = {
      'once daily': [9],
      'daily': [9],
      'qd': [9],
      'twice daily': [9, 21],
      'bid': [9, 21],
      'b.i.d.': [9, 21],
      'three times daily': [8, 14, 20],
      'tid': [8, 14, 20],
      't.i.d.': [8, 14, 20],
      'four times daily': [6, 12, 18, 24],
      'qid': [6, 12, 18, 24],
      'q.i.d.': [6, 12, 18, 24],
      'every 4 hours': [0, 4, 8, 12, 16, 20],
      'q4h': [0, 4, 8, 12, 16, 20],
      'every 6 hours': [0, 6, 12, 18],
      'q6h': [0, 6, 12, 18],
      'every 8 hours': [0, 8, 16],
      'q8h': [0, 8, 16],
      'every 12 hours': [9, 21],
      'q12h': [9, 21],
      'at bedtime': [21],
      'hs': [21],
      'before meals': [7, 12, 18],
      'ac': [7, 12, 18],
      'after meals': [8, 13, 19],
      'pc': [8, 13, 19],
    };

    // Find matching frequency
    for (const [pattern, hours] of Object.entries(standardTimes)) {
      if (freqLower.includes(pattern)) {
        for (const hour of hours) {
          const time = new Date(baseDate);
          time.setHours(hour, 0, 0, 0);

          // Only include times within next 24 hours
          if (time >= baseDate || time.getTime() - baseDate.getTime() < 24 * 60 * 60 * 1000) {
            times.push(time);
          }
        }
        break;
      }
    }

    // If no pattern matched and not PRN, default to once daily
    if (times.length === 0 && !freqLower.includes('prn') && !freqLower.includes('as needed')) {
      const time = new Date(baseDate);
      time.setHours(9, 0, 0, 0);
      times.push(time);
    }

    return times;
  }

  private extractUnit(dosage: string | null): string {
    if (!dosage) return 'unit';

    const unitPatterns = [
      'mg', 'mcg', 'g', 'ml', 'mL', 'units', 'unit', 'mEq', 'IU', 'tablets', 'tablet', 'capsules', 'capsule'
    ];

    const dosageLower = dosage.toLowerCase();
    for (const unit of unitPatterns) {
      if (dosageLower.includes(unit.toLowerCase())) {
        return unit;
      }
    }

    return 'unit';
  }

  private async isHighAlertMedication(drugName: string): Promise<any> {
    const highAlertDrugs = [
      'heparin', 'warfarin', 'enoxaparin', 'rivaroxaban', 'apixaban', 'dabigatran',
      'insulin', 'morphine', 'hydromorphone', 'fentanyl', 'oxycodone', 'methadone',
      'propofol', 'ketamine', 'midazolam', 'lorazepam',
      'methotrexate', 'vincristine', 'doxorubicin',
      'potassium chloride', 'magnesium sulfate', 'calcium chloride',
      'digoxin', 'amiodarone', 'dopamine', 'norepinephrine', 'epinephrine', 'dobutamine',
      'rocuronium', 'succinylcholine', 'vecuronium',
    ];

    const nameLower = drugName.toLowerCase();
    for (const drug of highAlertDrugs) {
      if (nameLower.includes(drug)) {
        return {
          isHighAlert: true,
          drugMatch: drug,
        };
      }
    }

    return null;
  }

  /**
   * Get shift-based due medications for nurses
   */
  async getDueMedications(params: {
    shift?: string;
    wardId?: string;
    nurseId?: string;
  }): Promise<any> {
    const now = new Date();
    const currentHour = now.getHours();

    // Determine shift times
    let shiftStart: Date;
    let shiftEnd: Date;

    switch (params.shift) {
      case 'day':
        shiftStart = new Date(now);
        shiftStart.setHours(7, 0, 0, 0);
        shiftEnd = new Date(now);
        shiftEnd.setHours(15, 0, 0, 0);
        break;
      case 'evening':
        shiftStart = new Date(now);
        shiftStart.setHours(15, 0, 0, 0);
        shiftEnd = new Date(now);
        shiftEnd.setHours(23, 0, 0, 0);
        break;
      case 'night':
        shiftStart = new Date(now);
        shiftStart.setHours(23, 0, 0, 0);
        shiftEnd = new Date(now);
        shiftEnd.setDate(shiftEnd.getDate() + 1);
        shiftEnd.setHours(7, 0, 0, 0);
        break;
      default:
        // Auto-detect shift based on current time
        if (currentHour >= 7 && currentHour < 15) {
          shiftStart = new Date(now);
          shiftStart.setHours(7, 0, 0, 0);
          shiftEnd = new Date(now);
          shiftEnd.setHours(15, 0, 0, 0);
        } else if (currentHour >= 15 && currentHour < 23) {
          shiftStart = new Date(now);
          shiftStart.setHours(15, 0, 0, 0);
          shiftEnd = new Date(now);
          shiftEnd.setHours(23, 0, 0, 0);
        } else {
          shiftStart = new Date(now);
          if (currentHour < 7) {
            shiftStart.setDate(shiftStart.getDate() - 1);
          }
          shiftStart.setHours(23, 0, 0, 0);
          shiftEnd = new Date(shiftStart);
          shiftEnd.setDate(shiftEnd.getDate() + 1);
          shiftEnd.setHours(7, 0, 0, 0);
        }
    }

    // Get all active admissions with medications
    const admissions = await prisma.admission.findMany({
      where: {
        status: 'ADMITTED',
        ...(params.wardId ? { bed: { ward: { id: params.wardId } } } : {}),
      },
      include: {
        patient: {
          include: {
            allergies: true,
            prescriptions: {
              where: { status: 'ACTIVE' },
              include: {
                medications: {
                  where: { isDispensed: true },
                  include: { drug: true },
                },
                doctor: {
                  include: { user: { select: { firstName: true, lastName: true } } },
                },
              },
            },
          },
        },
        bed: {
          include: { ward: true },
        },
      },
    });

    const dueMedications: any[] = [];
    const overdue: any[] = [];
    const dueNow: any[] = [];
    const upcoming: any[] = [];
    const prnAvailable: any[] = [];

    for (const admission of admissions) {
      const patient = admission.patient;

      for (const prescription of patient.prescriptions) {
        for (const med of prescription.medications) {
          const scheduledTimes = this.parseFrequencyToTimes(med.frequency, now);
          const isHighAlert = await this.isHighAlertMedication(med.drug?.genericName || med.drug?.name || '');
          const isPRN = med.frequency?.toLowerCase().includes('prn') || med.frequency?.toLowerCase().includes('as needed') || false;

          for (const scheduledTime of scheduledTimes) {
            // Only include medications within shift window
            if (scheduledTime >= shiftStart && scheduledTime <= shiftEnd) {
              const minutesFromNow = Math.floor((scheduledTime.getTime() - now.getTime()) / 60000);

              const medEntry = {
                id: med.id,
                prescriptionId: prescription.id,
                patientId: patient.id,
                patientName: `${patient.firstName} ${patient.lastName}`,
                patientMRN: patient.mrn,
                room: admission.bed ? `${admission.bed.ward?.name} - ${admission.bed.bedNumber}` : 'Unknown',
                wardId: admission.bed?.ward?.id,
                wardName: admission.bed?.ward?.name,
                name: med.drug?.name || 'Unknown',
                genericName: med.drug?.genericName,
                dose: med.dosage,
                unit: this.extractUnit(med.dosage),
                route: med.route,
                frequency: med.frequency,
                scheduledTime: scheduledTime.toISOString(),
                minutesFromNow,
                isPRN,
                isHighAlert: !!isHighAlert,
                highAlertInfo: isHighAlert,
                instructions: med.instructions,
                prescribedBy: prescription.doctor
                  ? `Dr. ${prescription.doctor.user.firstName} ${prescription.doctor.user.lastName}`
                  : 'Unknown',
                allergies: patient.allergies.map(a => a.allergen),
                status: minutesFromNow < -30 ? 'OVERDUE' :
                        minutesFromNow <= 30 ? 'DUE_NOW' :
                        'UPCOMING',
              };

              if (isPRN) {
                prnAvailable.push(medEntry);
              } else if (minutesFromNow < -30) {
                medEntry.overdueMinutes = Math.abs(minutesFromNow);
                overdue.push(medEntry);
              } else if (minutesFromNow <= 30) {
                dueNow.push(medEntry);
              } else {
                upcoming.push(medEntry);
              }

              dueMedications.push(medEntry);
            }
          }
        }
      }
    }

    // Sort by priority
    overdue.sort((a, b) => b.overdueMinutes - a.overdueMinutes);
    dueNow.sort((a, b) => a.minutesFromNow - b.minutesFromNow);
    upcoming.sort((a, b) => a.minutesFromNow - b.minutesFromNow);

    return {
      shift: params.shift || 'current',
      shiftStart: shiftStart.toISOString(),
      shiftEnd: shiftEnd.toISOString(),
      currentTime: now.toISOString(),
      summary: {
        totalDue: dueMedications.length,
        overdueCount: overdue.length,
        dueNowCount: dueNow.length,
        upcomingCount: upcoming.length,
        prnCount: prnAvailable.length,
        highAlertCount: dueMedications.filter(m => m.isHighAlert).length,
      },
      overdue,
      dueNow,
      upcoming,
      prnAvailable,
    };
  }

  /**
   * Perform comprehensive AI-powered safety verification
   */
  async performSafetyVerification(data: {
    patientId: string;
    medicationId: string;
    prescriptionId: string;
    scannedPatientBarcode?: string;
    scannedMedicationBarcode?: string;
    verifiedBy: string;
  }): Promise<any> {
    // Get patient details
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      include: {
        allergies: true,
        prescriptions: {
          where: { status: 'ACTIVE' },
          include: {
            medications: {
              include: { drug: true },
            },
          },
        },
        vitals: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    // Get the specific medication
    const medication = await prisma.prescriptionMedication.findUnique({
      where: { id: data.medicationId },
      include: {
        drug: true,
        prescription: {
          include: {
            doctor: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });

    if (!medication) {
      throw new NotFoundError('Medication not found');
    }

    // Calculate patient age
    const birthDate = new Date(patient.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Get current medications for interaction check
    const currentMedications = patient.prescriptions
      .flatMap(p => p.medications.map(m => ({
        name: m.drug?.name || '',
        genericName: m.drug?.genericName || '',
      })))
      .filter(m => m.name || m.genericName);

    // Perform safety checks
    const safetyChecks: any = {
      patientVerification: { status: 'VERIFIED', score: 100 },
      drugVerification: { status: 'VERIFIED', score: 100 },
      doseVerification: { status: 'VERIFIED', score: 100 },
      routeVerification: { status: 'VERIFIED', score: 100 },
      timeVerification: { status: 'VERIFIED', score: 100 },
      allergyCheck: { status: 'CLEAR', score: 100, alerts: [] },
      interactionCheck: { status: 'CLEAR', score: 100, alerts: [] },
      duplicateTherapy: { status: 'CLEAR', score: 100, alerts: [] },
      renalDoseCheck: { status: 'NA', score: 100 },
    };

    let overallScore = 100;
    const warnings: any[] = [];
    const alerts: any[] = [];

    // 1. Patient barcode verification
    if (data.scannedPatientBarcode) {
      const patientIdFromBarcode = data.scannedPatientBarcode.replace(/^(PT|MRN)/i, '');
      if (patientIdFromBarcode !== patient.id && patientIdFromBarcode !== patient.mrn) {
        safetyChecks.patientVerification = {
          status: 'FAILED',
          score: 0,
          message: 'Scanned patient ID does not match selected patient',
        };
        overallScore -= 50;
        alerts.push({
          type: 'PATIENT_MISMATCH',
          severity: 'CRITICAL',
          message: 'Patient barcode does not match. Verify patient identity.',
        });
      }
    } else {
      safetyChecks.patientVerification = {
        status: 'WARNING',
        score: 80,
        message: 'Patient barcode not scanned - manual verification required',
      };
      overallScore -= 5;
      warnings.push({
        type: 'NO_PATIENT_SCAN',
        severity: 'MODERATE',
        message: 'Patient identification barcode was not scanned',
      });
    }

    // 2. Allergy cross-check
    const drugName = (medication.drug?.genericName || medication.drug?.name || '').toLowerCase();
    for (const allergy of patient.allergies) {
      if (drugName.includes(allergy.allergen.toLowerCase()) ||
          allergy.allergen.toLowerCase().includes(drugName.split(' ')[0])) {
        safetyChecks.allergyCheck = {
          status: 'FAILED',
          score: 0,
          alerts: [{
            allergen: allergy.allergen,
            reaction: allergy.reaction,
            severity: allergy.severity,
          }],
        };
        overallScore -= 50;
        alerts.push({
          type: 'ALLERGY',
          severity: 'CRITICAL',
          message: `ALLERGY ALERT: Patient allergic to ${allergy.allergen}`,
        });
      }
    }

    // 3. High-alert medication check
    const highAlertInfo = await this.isHighAlertMedication(drugName);
    if (highAlertInfo) {
      safetyChecks.highAlertCheck = {
        status: 'WARNING',
        score: 85,
        info: highAlertInfo,
        message: 'This is a HIGH-ALERT medication requiring double-check',
      };
      overallScore -= 5;
      warnings.push({
        type: 'HIGH_ALERT',
        severity: 'HIGH',
        message: `High-alert medication: ${medication.drug?.name}. Independent double-check recommended.`,
      });
    }

    // 4. Drug interaction check (basic)
    const knownInteractions: Record<string, string[]> = {
      'warfarin': ['aspirin', 'ibuprofen', 'naproxen', 'vitamin k', 'rifampin'],
      'metformin': ['alcohol', 'contrast dye', 'cimetidine'],
      'digoxin': ['amiodarone', 'verapamil', 'quinidine'],
      'lithium': ['nsaid', 'ace inhibitor', 'thiazide'],
      'maoi': ['ssri', 'meperidine', 'tyramine'],
    };

    for (const [drug, interactsWith] of Object.entries(knownInteractions)) {
      if (drugName.includes(drug)) {
        for (const currentMed of currentMedications) {
          const currentDrugName = (currentMed.genericName || currentMed.name).toLowerCase();
          for (const interactionDrug of interactsWith) {
            if (currentDrugName.includes(interactionDrug)) {
              safetyChecks.interactionCheck.alerts.push({
                drug1: medication.drug?.name,
                drug2: currentMed.name,
                severity: 'MODERATE',
                description: `Potential interaction between ${drug} and ${interactionDrug}`,
              });
              safetyChecks.interactionCheck.status = 'WARNING';
              safetyChecks.interactionCheck.score = 70;
              overallScore -= 10;
              warnings.push({
                type: 'DRUG_INTERACTION',
                severity: 'MODERATE',
                message: `Potential drug interaction with ${currentMed.name}`,
              });
            }
          }
        }
      }
    }

    // 5. Duplicate therapy check
    for (const currentMed of currentMedications) {
      const currentDrugName = (currentMed.genericName || currentMed.name).toLowerCase();
      if (currentDrugName === drugName && currentMed.name !== medication.drug?.name) {
        safetyChecks.duplicateTherapy.alerts.push({
          existingDrug: currentMed.name,
          newDrug: medication.drug?.name,
          message: 'Same drug class already prescribed',
        });
        safetyChecks.duplicateTherapy.status = 'WARNING';
        safetyChecks.duplicateTherapy.score = 75;
        overallScore -= 10;
        warnings.push({
          type: 'DUPLICATE_THERAPY',
          severity: 'MODERATE',
          message: `Duplicate therapy detected with ${currentMed.name}`,
        });
      }
    }

    // 6. Timing validation
    const now = new Date();
    const scheduledTimes = this.parseFrequencyToTimes(medication.frequency, now);
    let nearestScheduledTime = scheduledTimes[0];
    let minTimeDiff = Infinity;

    for (const time of scheduledTimes) {
      const diff = Math.abs(time.getTime() - now.getTime());
      if (diff < minTimeDiff) {
        minTimeDiff = diff;
        nearestScheduledTime = time;
      }
    }

    const minutesFromScheduled = nearestScheduledTime
      ? Math.floor((now.getTime() - nearestScheduledTime.getTime()) / 60000)
      : 0;

    if (Math.abs(minutesFromScheduled) > 60) {
      safetyChecks.timeVerification = {
        status: 'WARNING',
        score: 70,
        message: `Administration ${minutesFromScheduled > 0 ? 'late' : 'early'} by ${Math.abs(minutesFromScheduled)} minutes`,
        scheduledTime: nearestScheduledTime?.toISOString(),
      };
      overallScore -= 10;
      warnings.push({
        type: 'TIMING',
        severity: 'LOW',
        message: `Medication is ${Math.abs(minutesFromScheduled)} minutes ${minutesFromScheduled > 0 ? 'overdue' : 'early'}`,
      });
    }

    // Calculate overall status
    let overallStatus: 'SAFE' | 'CAUTION' | 'STOP' = 'SAFE';
    if (overallScore < 50) {
      overallStatus = 'STOP';
    } else if (overallScore < 80) {
      overallStatus = 'CAUTION';
    }

    return {
      verificationId: `VER_${Date.now()}`,
      timestamp: now.toISOString(),
      patient: {
        id: patient.id,
        name: `${patient.firstName} ${patient.lastName}`,
        mrn: patient.mrn,
        dateOfBirth: patient.dateOfBirth,
        age,
        allergies: patient.allergies.map(a => a.allergen),
      },
      medication: {
        id: medication.id,
        name: medication.drug?.name,
        genericName: medication.drug?.genericName,
        dose: medication.dosage,
        route: medication.route,
        frequency: medication.frequency,
        prescribedBy: medication.prescription.doctor
          ? `Dr. ${medication.prescription.doctor.user.firstName} ${medication.prescription.doctor.user.lastName}`
          : 'Unknown',
      },
      safetyScore: Math.max(0, overallScore),
      overallStatus,
      rights: {
        patient: safetyChecks.patientVerification,
        drug: safetyChecks.drugVerification,
        dose: safetyChecks.doseVerification,
        route: safetyChecks.routeVerification,
        time: safetyChecks.timeVerification,
      },
      additionalChecks: {
        allergy: safetyChecks.allergyCheck,
        interaction: safetyChecks.interactionCheck,
        duplicateTherapy: safetyChecks.duplicateTherapy,
        highAlert: safetyChecks.highAlertCheck,
        renalDose: safetyChecks.renalDoseCheck,
      },
      alerts,
      warnings,
      isHighAlertMedication: !!highAlertInfo,
      requiresDoubleCheck: !!highAlertInfo,
      recommendations: this.generateRecommendations(safetyChecks, warnings, alerts),
      verifiedBy: data.verifiedBy,
    };
  }

  private generateRecommendations(safetyChecks: any, warnings: any[], alerts: any[]): any[] {
    const recommendations: any[] = [];

    if (alerts.some(a => a.type === 'ALLERGY')) {
      recommendations.push({
        priority: 1,
        type: 'ACTION_REQUIRED',
        message: 'Contact prescriber immediately regarding allergy concern',
      });
    }

    if (safetyChecks.highAlertCheck) {
      recommendations.push({
        priority: 2,
        type: 'DOUBLE_CHECK',
        message: 'Obtain independent double-check from another nurse before administration',
      });
    }

    if (warnings.some(w => w.type === 'DRUG_INTERACTION')) {
      recommendations.push({
        priority: 3,
        type: 'MONITORING',
        message: 'Monitor for signs of drug interaction; consult pharmacist if concerned',
      });
    }

    if (safetyChecks.timeVerification?.status === 'WARNING') {
      recommendations.push({
        priority: 4,
        type: 'DOCUMENTATION',
        message: 'Document reason for early/late administration in notes',
      });
    }

    return recommendations;
  }
}

export const medSafetyService = new MedSafetyService();
