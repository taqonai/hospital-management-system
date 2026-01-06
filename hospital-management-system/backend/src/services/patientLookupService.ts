import prisma from '../config/database';
import { NotFoundError, ConflictError, AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';
import { Patient, Gender } from '@prisma/client';

// ==================== Type Definitions ====================

/**
 * Patient creation source - tracks where the patient record originated
 */
export type PatientCreationSource = 'PORTAL' | 'BOOKING' | 'STAFF';

/**
 * Match type for patient lookup results
 */
export type PatientMatchType = 'email' | 'phone' | 'name_dob';

/**
 * Input data for patient lookup operations
 */
export interface PatientLookupData {
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date | string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

/**
 * Result of patient lookup or creation
 */
export interface PatientLookupResult {
  patient: Patient;
  isExisting: boolean;
  matchedBy?: PatientMatchType;
}

/**
 * Criteria for finding existing patients
 */
export interface PatientSearchCriteria {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date | string;
}

/**
 * Result of patient claim eligibility check
 */
export interface PatientClaimResult {
  canClaim: boolean;
  reason?: string;
  patient?: Patient;
}

/**
 * Result of patient merge operation
 */
export interface PatientMergeResult {
  success: boolean;
  primaryPatient: Patient;
  mergedRecords: {
    appointments: number;
    prescriptions: number;
    labOrders: number;
    imagingOrders: number;
    admissions: number;
    consultations: number;
    vitals: number;
    invoices: number;
  };
}

/**
 * Potential duplicate patient with match information
 */
export interface PotentialDuplicate {
  patient: Patient;
  matchScore: number;
  matchedFields: string[];
}

// ==================== Service Implementation ====================

export class PatientLookupService {
  /**
   * Generates a unique Medical Record Number (MRN) for new patients
   */
  private generateMRN(hospitalCode: string): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${hospitalCode}-${timestamp}${random}`;
  }

  /**
   * Normalizes phone number for consistent comparison
   * Removes all non-numeric characters
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Normalizes email for consistent comparison
   * Converts to lowercase and trims whitespace
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Normalizes date for comparison
   * Converts string dates to Date objects and sets time to midnight UTC
   */
  private normalizeDate(date: Date | string | undefined): Date | undefined {
    if (!date) return undefined;
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Finds an existing patient by various criteria
   * Search priority: email > phone > name + DOB combination
   *
   * @param hospitalId - The hospital tenant ID
   * @param criteria - Search criteria including email, phone, name, and DOB
   * @returns The patient with match type, or null if not found
   */
  async findExistingPatient(
    hospitalId: string,
    criteria: PatientSearchCriteria
  ): Promise<{ patient: Patient; matchedBy: PatientMatchType } | null> {
    logger.debug(`[PatientLookup] Searching for existing patient in hospital ${hospitalId}`, {
      hasEmail: !!criteria.email,
      hasPhone: !!criteria.phone,
      hasNameDob: !!(criteria.firstName && criteria.lastName && criteria.dateOfBirth),
    });

    // Priority 1: Search by email (primary identifier)
    if (criteria.email) {
      const normalizedEmail = this.normalizeEmail(criteria.email);
      const patientByEmail = await prisma.patient.findFirst({
        where: {
          hospitalId,
          email: { equals: normalizedEmail, mode: 'insensitive' },
          isActive: true,
        },
      });

      if (patientByEmail) {
        logger.info(`[PatientLookup] Found patient by email: ${patientByEmail.id}`);
        return { patient: patientByEmail, matchedBy: 'email' };
      }
    }

    // Priority 2: Search by phone (secondary identifier)
    if (criteria.phone) {
      const normalizedPhone = this.normalizePhone(criteria.phone);

      // Search with normalized comparison - find patients and compare normalized phones
      const patients = await prisma.patient.findMany({
        where: {
          hospitalId,
          isActive: true,
          phone: { not: '' },
        },
      });

      const patientByPhone = patients.find(
        p => this.normalizePhone(p.phone) === normalizedPhone
      );

      if (patientByPhone) {
        logger.info(`[PatientLookup] Found patient by phone: ${patientByPhone.id}`);
        return { patient: patientByPhone, matchedBy: 'phone' };
      }
    }

    // Priority 3: Search by name + DOB combination
    if (criteria.firstName && criteria.lastName && criteria.dateOfBirth) {
      const normalizedDob = this.normalizeDate(criteria.dateOfBirth);

      if (normalizedDob) {
        // Create date range for DOB match (same day)
        const dobStart = new Date(normalizedDob);
        dobStart.setUTCHours(0, 0, 0, 0);
        const dobEnd = new Date(normalizedDob);
        dobEnd.setUTCHours(23, 59, 59, 999);

        const patientByNameDob = await prisma.patient.findFirst({
          where: {
            hospitalId,
            firstName: { equals: criteria.firstName.trim(), mode: 'insensitive' },
            lastName: { equals: criteria.lastName.trim(), mode: 'insensitive' },
            dateOfBirth: {
              gte: dobStart,
              lte: dobEnd,
            },
            isActive: true,
          },
        });

        if (patientByNameDob) {
          logger.info(`[PatientLookup] Found patient by name+DOB: ${patientByNameDob.id}`);
          return { patient: patientByNameDob, matchedBy: 'name_dob' };
        }
      }
    }

    logger.debug('[PatientLookup] No existing patient found');
    return null;
  }

  /**
   * Finds an existing patient or creates a new one
   * Prevents duplicate patient records across all entry points
   *
   * @param hospitalId - The hospital tenant ID
   * @param patientData - Patient information for lookup/creation
   * @param source - Where the patient record is being created from
   * @returns The patient record with flag indicating if existing
   */
  async findOrCreatePatient(
    hospitalId: string,
    patientData: PatientLookupData,
    source: PatientCreationSource
  ): Promise<PatientLookupResult> {
    logger.info(`[PatientLookup] findOrCreatePatient called from ${source}`, {
      hospitalId,
      firstName: patientData.firstName,
      lastName: patientData.lastName,
      hasEmail: !!patientData.email,
      hasPhone: !!patientData.phone,
    });

    // Validate hospital exists
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
    });

    if (!hospital) {
      logger.error(`[PatientLookup] Hospital not found: ${hospitalId}`);
      throw new NotFoundError('Hospital not found');
    }

    // Try to find existing patient
    const existingResult = await this.findExistingPatient(hospitalId, {
      email: patientData.email,
      phone: patientData.phone,
      firstName: patientData.firstName,
      lastName: patientData.lastName,
      dateOfBirth: patientData.dateOfBirth,
    });

    if (existingResult) {
      logger.info(`[PatientLookup] Returning existing patient: ${existingResult.patient.id}`, {
        matchedBy: existingResult.matchedBy,
        source,
      });

      return {
        patient: existingResult.patient,
        isExisting: true,
        matchedBy: existingResult.matchedBy,
      };
    }

    // Create new patient
    const mrn = this.generateMRN(hospital.code);

    // Map gender string to enum
    let gender: Gender = 'OTHER';
    if (patientData.gender) {
      const genderUpper = patientData.gender.toUpperCase();
      if (genderUpper === 'MALE' || genderUpper === 'M') {
        gender = 'MALE';
      } else if (genderUpper === 'FEMALE' || genderUpper === 'F') {
        gender = 'FEMALE';
      }
    }

    // Parse date of birth
    const dateOfBirth = patientData.dateOfBirth
      ? new Date(patientData.dateOfBirth)
      : new Date('1990-01-01'); // Default DOB if not provided

    try {
      const newPatient = await prisma.patient.create({
        data: {
          hospitalId,
          mrn,
          firstName: patientData.firstName.trim(),
          lastName: patientData.lastName.trim(),
          email: patientData.email ? this.normalizeEmail(patientData.email) : null,
          phone: patientData.phone || '',
          dateOfBirth,
          gender,
          address: patientData.address || 'To be updated',
          city: patientData.city || 'To be updated',
          state: patientData.state || 'To be updated',
          zipCode: patientData.zipCode || '00000',
          isActive: true,
        },
      });

      // Create empty medical history for the new patient
      await prisma.medicalHistory.create({
        data: {
          patientId: newPatient.id,
          chronicConditions: [],
          pastSurgeries: [],
          familyHistory: [],
          currentMedications: [],
          immunizations: [],
        },
      });

      logger.info(`[PatientLookup] Created new patient: ${newPatient.id}`, {
        mrn: newPatient.mrn,
        source,
      });

      return {
        patient: newPatient,
        isExisting: false,
      };
    } catch (error) {
      logger.error('[PatientLookup] Failed to create patient', { error });
      throw new AppError('Failed to create patient record');
    }
  }

  /**
   * Links an existing patient record to a User account
   * Used when a patient claims their account through the portal
   *
   * @param patientId - The patient record ID
   * @param userId - The user account ID to link
   * @returns The updated patient record
   */
  async linkUserToPatient(patientId: string, userId: string): Promise<Patient> {
    logger.info(`[PatientLookup] Linking user ${userId} to patient ${patientId}`);

    // Verify patient exists and has no linked user
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      logger.error(`[PatientLookup] Patient not found: ${patientId}`);
      throw new NotFoundError('Patient not found');
    }

    if (patient.oderId) {
      logger.warn(`[PatientLookup] Patient ${patientId} already linked to user ${patient.oderId}`);
      throw new ConflictError('Patient is already linked to a user account');
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      logger.error(`[PatientLookup] User not found: ${userId}`);
      throw new NotFoundError('User not found');
    }

    // Check if user is already linked to another patient
    const existingPatientLink = await prisma.patient.findFirst({
      where: { oderId: userId },
    });

    if (existingPatientLink) {
      logger.warn(`[PatientLookup] User ${userId} already linked to patient ${existingPatientLink.id}`);
      throw new ConflictError('User is already linked to another patient record');
    }

    // Link the user to patient
    const updatedPatient = await prisma.patient.update({
      where: { id: patientId },
      data: { oderId: userId },
    });

    logger.info(`[PatientLookup] Successfully linked user ${userId} to patient ${patientId}`);
    return updatedPatient;
  }

  /**
   * Checks if a patient record can be claimed by a user
   * Patient must have no linked user and email/phone must match
   *
   * @param patientId - The patient record ID
   * @param email - Email to verify against
   * @param phone - Phone to verify against
   * @returns Claim eligibility result
   */
  async canClaimPatient(
    patientId: string,
    email?: string,
    phone?: string
  ): Promise<PatientClaimResult> {
    logger.debug(`[PatientLookup] Checking claim eligibility for patient ${patientId}`);

    if (!email && !phone) {
      return {
        canClaim: false,
        reason: 'Email or phone must be provided to claim a patient record',
      };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return {
        canClaim: false,
        reason: 'Patient not found',
      };
    }

    // Check if already linked to a user
    if (patient.oderId) {
      return {
        canClaim: false,
        reason: 'Patient is already linked to a user account',
        patient,
      };
    }

    // Verify email or phone matches
    let emailMatch = false;
    let phoneMatch = false;

    if (email && patient.email) {
      emailMatch = this.normalizeEmail(email) === this.normalizeEmail(patient.email);
    }

    if (phone && patient.phone) {
      phoneMatch = this.normalizePhone(phone) === this.normalizePhone(patient.phone);
    }

    if (!emailMatch && !phoneMatch) {
      return {
        canClaim: false,
        reason: 'Email or phone does not match patient record',
        patient,
      };
    }

    logger.info(`[PatientLookup] Patient ${patientId} can be claimed`, {
      emailMatch,
      phoneMatch,
    });

    return {
      canClaim: true,
      patient,
    };
  }

  /**
   * Merges duplicate patient records into a primary record
   * Transfers all related records (appointments, prescriptions, etc.) to primary
   * Marks the duplicate record as inactive
   *
   * @param primaryPatientId - The patient record to keep
   * @param duplicatePatientId - The patient record to merge and deactivate
   * @returns Merge operation result with counts of transferred records
   */
  async mergePatientRecords(
    primaryPatientId: string,
    duplicatePatientId: string
  ): Promise<PatientMergeResult> {
    logger.info(`[PatientLookup] Starting merge: ${duplicatePatientId} -> ${primaryPatientId}`);

    if (primaryPatientId === duplicatePatientId) {
      throw new AppError('Cannot merge a patient with itself');
    }

    // Verify both patients exist and are in the same hospital
    const [primaryPatient, duplicatePatient] = await Promise.all([
      prisma.patient.findUnique({ where: { id: primaryPatientId } }),
      prisma.patient.findUnique({ where: { id: duplicatePatientId } }),
    ]);

    if (!primaryPatient) {
      throw new NotFoundError('Primary patient not found');
    }

    if (!duplicatePatient) {
      throw new NotFoundError('Duplicate patient not found');
    }

    if (primaryPatient.hospitalId !== duplicatePatient.hospitalId) {
      throw new AppError('Cannot merge patients from different hospitals');
    }

    if (!duplicatePatient.isActive) {
      throw new AppError('Duplicate patient is already inactive/merged');
    }

    // Track merged record counts
    const mergedRecords = {
      appointments: 0,
      prescriptions: 0,
      labOrders: 0,
      imagingOrders: 0,
      admissions: 0,
      consultations: 0,
      vitals: 0,
      invoices: 0,
    };

    // Perform merge in a transaction
    await prisma.$transaction(async (tx) => {
      // Transfer appointments
      const appointmentResult = await tx.appointment.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });
      mergedRecords.appointments = appointmentResult.count;

      // Transfer prescriptions
      const prescriptionResult = await tx.prescription.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });
      mergedRecords.prescriptions = prescriptionResult.count;

      // Transfer lab orders
      const labOrderResult = await tx.labOrder.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });
      mergedRecords.labOrders = labOrderResult.count;

      // Transfer imaging orders
      const imagingOrderResult = await tx.imagingOrder.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });
      mergedRecords.imagingOrders = imagingOrderResult.count;

      // Transfer admissions
      const admissionResult = await tx.admission.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });
      mergedRecords.admissions = admissionResult.count;

      // Transfer consultations
      const consultationResult = await tx.consultation.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });
      mergedRecords.consultations = consultationResult.count;

      // Transfer vitals
      const vitalsResult = await tx.vital.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });
      mergedRecords.vitals = vitalsResult.count;

      // Transfer invoices
      const invoiceResult = await tx.invoice.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });
      mergedRecords.invoices = invoiceResult.count;

      // Transfer allergies (may have duplicates, handle carefully)
      await tx.allergy.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });

      // Transfer insurances
      await tx.patientInsurance.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });

      // Transfer AI predictions and diagnoses
      await tx.aIPrediction.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });

      await tx.aIDiagnosis.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });

      // Transfer smart orders
      await tx.smartOrder.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });

      // Transfer clinical notes
      await tx.clinicalNote.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });

      // Transfer AI scribe sessions
      await tx.aiScribeSession.updateMany({
        where: { patientId: duplicatePatientId },
        data: { patientId: primaryPatientId },
      });

      // Delete duplicate's medical history (primary should keep theirs)
      await tx.medicalHistory.deleteMany({
        where: { patientId: duplicatePatientId },
      });

      // Mark duplicate as inactive (soft delete)
      await tx.patient.update({
        where: { id: duplicatePatientId },
        data: {
          isActive: false,
          // Append merge note to indicate this record was merged
          emergencyContact: `[MERGED INTO ${primaryPatientId}] ${duplicatePatient.emergencyContact || ''}`.trim(),
        },
      });
    });

    // Fetch updated primary patient
    const updatedPrimaryPatient = await prisma.patient.findUnique({
      where: { id: primaryPatientId },
    });

    logger.info(`[PatientLookup] Merge completed: ${duplicatePatientId} -> ${primaryPatientId}`, {
      mergedRecords,
    });

    return {
      success: true,
      primaryPatient: updatedPrimaryPatient!,
      mergedRecords,
    };
  }

  /**
   * Searches for potential duplicate patients based on similar information
   * Useful for staff to identify duplicates before creating new records
   *
   * @param hospitalId - The hospital tenant ID
   * @param criteria - Search criteria
   * @param limit - Maximum number of results to return
   * @returns List of potential duplicate patients with match scores
   */
  async findPotentialDuplicates(
    hospitalId: string,
    criteria: PatientSearchCriteria,
    limit: number = 10
  ): Promise<PotentialDuplicate[]> {
    logger.debug('[PatientLookup] Searching for potential duplicates');

    const conditions: any[] = [];

    // Build OR conditions for potential matches
    if (criteria.email) {
      const normalizedEmail = this.normalizeEmail(criteria.email);
      conditions.push({
        email: { equals: normalizedEmail, mode: 'insensitive' },
      });
      // Also search for similar emails (same username part)
      const emailParts = normalizedEmail.split('@');
      if (emailParts.length === 2 && emailParts[0].length >= 3) {
        conditions.push({
          email: { contains: emailParts[0], mode: 'insensitive' },
        });
      }
    }

    if (criteria.phone) {
      // For phone, we'll search for records and compare normalized versions
      const normalizedPhone = this.normalizePhone(criteria.phone);
      if (normalizedPhone.length >= 7) {
        // Search for last 7 digits match
        const lastDigits = normalizedPhone.slice(-7);
        conditions.push({
          phone: { contains: lastDigits },
        });
      }
    }

    if (criteria.firstName && criteria.lastName) {
      conditions.push({
        AND: [
          { firstName: { equals: criteria.firstName.trim(), mode: 'insensitive' } },
          { lastName: { equals: criteria.lastName.trim(), mode: 'insensitive' } },
        ],
      });
    }

    // Also search for individual name matches
    if (criteria.firstName) {
      conditions.push({
        firstName: { equals: criteria.firstName.trim(), mode: 'insensitive' },
      });
    }

    if (criteria.lastName) {
      conditions.push({
        lastName: { equals: criteria.lastName.trim(), mode: 'insensitive' },
      });
    }

    if (conditions.length === 0) {
      return [];
    }

    const potentialMatches = await prisma.patient.findMany({
      where: {
        hospitalId,
        isActive: true,
        OR: conditions,
      },
      orderBy: { createdAt: 'desc' },
      take: limit * 2, // Get more to allow for scoring and filtering
    });

    // Score and rank the matches
    const scoredMatches: PotentialDuplicate[] = potentialMatches.map(patient => {
      const { score, matchedFields } = this.calculateMatchScore(patient, criteria);
      return {
        patient,
        matchScore: score,
        matchedFields,
      };
    });

    // Sort by match score descending and limit results
    return scoredMatches
      .filter(m => m.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  /**
   * Calculate a match score between a patient and the given criteria
   * Higher scores indicate better matches
   *
   * @param patient - The patient to compare against
   * @param criteria - The search criteria
   * @returns Match score and list of matched fields
   */
  private calculateMatchScore(
    patient: Patient,
    criteria: PatientSearchCriteria
  ): { score: number; matchedFields: string[] } {
    let score = 0;
    const matchedFields: string[] = [];

    // Email exact match (highest weight - 40 points)
    if (criteria.email && patient.email) {
      const normalizedCriteria = this.normalizeEmail(criteria.email);
      const normalizedPatient = this.normalizeEmail(patient.email);

      if (normalizedPatient === normalizedCriteria) {
        score += 40;
        matchedFields.push('email (exact)');
      } else {
        // Check for partial match (same username)
        const criteriaParts = normalizedCriteria.split('@');
        const patientParts = normalizedPatient.split('@');
        if (criteriaParts[0] === patientParts[0]) {
          score += 20;
          matchedFields.push('email (username match)');
        } else if (normalizedPatient.includes(criteriaParts[0])) {
          score += 10;
          matchedFields.push('email (partial)');
        }
      }
    }

    // Phone exact match (high weight - 35 points)
    if (criteria.phone && patient.phone) {
      const normalizedCriteria = this.normalizePhone(criteria.phone);
      const normalizedPatient = this.normalizePhone(patient.phone);

      if (normalizedPatient === normalizedCriteria) {
        score += 35;
        matchedFields.push('phone (exact)');
      } else if (
        normalizedPatient.length >= 7 &&
        normalizedCriteria.length >= 7 &&
        normalizedPatient.slice(-7) === normalizedCriteria.slice(-7)
      ) {
        score += 20;
        matchedFields.push('phone (last 7 digits)');
      }
    }

    // First name match (15 points exact, 8 partial)
    if (criteria.firstName && patient.firstName) {
      const criteriaFirst = criteria.firstName.toLowerCase().trim();
      const patientFirst = patient.firstName.toLowerCase();

      if (patientFirst === criteriaFirst) {
        score += 15;
        matchedFields.push('firstName (exact)');
      } else if (patientFirst.includes(criteriaFirst) || criteriaFirst.includes(patientFirst)) {
        score += 8;
        matchedFields.push('firstName (partial)');
      }
    }

    // Last name match (15 points exact, 8 partial)
    if (criteria.lastName && patient.lastName) {
      const criteriaLast = criteria.lastName.toLowerCase().trim();
      const patientLast = patient.lastName.toLowerCase();

      if (patientLast === criteriaLast) {
        score += 15;
        matchedFields.push('lastName (exact)');
      } else if (patientLast.includes(criteriaLast) || criteriaLast.includes(patientLast)) {
        score += 8;
        matchedFields.push('lastName (partial)');
      }
    }

    // Date of birth match (20 points - strong identifier when combined with name)
    if (criteria.dateOfBirth && patient.dateOfBirth) {
      const criteriaDate = this.normalizeDate(criteria.dateOfBirth);
      const patientDate = this.normalizeDate(patient.dateOfBirth);

      if (criteriaDate && patientDate) {
        const criteriaDob = criteriaDate.toISOString().split('T')[0];
        const patientDob = patientDate.toISOString().split('T')[0];

        if (criteriaDob === patientDob) {
          score += 20;
          matchedFields.push('dateOfBirth');
        }
      }
    }

    return { score, matchedFields };
  }

  /**
   * Gets a patient by ID with hospital validation
   *
   * @param patientId - The patient ID
   * @param hospitalId - The hospital tenant ID
   * @returns The patient or throws NotFoundError
   */
  async getPatientById(patientId: string, hospitalId: string): Promise<Patient> {
    const patient = await prisma.patient.findFirst({
      where: {
        id: patientId,
        hospitalId,
        isActive: true,
      },
    });

    if (!patient) {
      throw new NotFoundError('Patient not found');
    }

    return patient;
  }

  /**
   * Checks if a patient with the given identifiers already exists
   *
   * @param hospitalId - The hospital tenant ID
   * @param email - Patient email
   * @param phone - Patient phone
   * @returns Boolean indicating if patient exists
   */
  async patientExists(
    hospitalId: string,
    email?: string,
    phone?: string
  ): Promise<boolean> {
    const result = await this.findExistingPatient(hospitalId, { email, phone });
    return result !== null;
  }
}

// Export singleton instance
export const patientLookupService = new PatientLookupService();
