import prisma from '../config/database';
import { ReleaseStatus, AutopsyStatus, MannerOfDeath } from '@prisma/client';

// ==================== MORTUARY RECORD MANAGEMENT ====================

export const mortuaryService = {
  // Register death / create mortuary record
  async registerDeath(hospitalId: string, data: {
    patientId?: string;
    deceasedName: string;
    dateOfBirth?: Date;
    dateOfDeath: Date;
    timeOfDeath: Date;
    age?: number;
    gender: string;
    placeOfDeath: string;
    causeOfDeath: string;
    mannerOfDeath: string;
    certifyingDoctor: string;
    nokName: string;
    nokRelationship: string;
    nokPhone: string;
    nokAddress?: string;
    autopsyRequired?: boolean;
    notes?: string;
  }) {
    // Generate record number
    const count = await prisma.mortuaryRecord.count({ where: { hospitalId } });
    const recordNumber = `MORT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(count + 1).padStart(3, '0')}`;

    return prisma.mortuaryRecord.create({
      data: {
        hospitalId,
        recordNumber,
        patientId: data.patientId,
        deceasedName: data.deceasedName,
        dateOfBirth: data.dateOfBirth,
        dateOfDeath: data.dateOfDeath,
        timeOfDeath: data.timeOfDeath,
        age: data.age,
        gender: data.gender as any,
        placeOfDeath: data.placeOfDeath,
        causeOfDeath: data.causeOfDeath,
        mannerOfDeath: data.mannerOfDeath as MannerOfDeath,
        certifyingDoctor: data.certifyingDoctor,
        nokName: data.nokName,
        nokRelationship: data.nokRelationship,
        nokPhone: data.nokPhone,
        nokAddress: data.nokAddress,
        autopsyRequired: data.autopsyRequired || false,
        notes: data.notes,
        releaseStatus: ReleaseStatus.NOT_RELEASED,
      },
    });
  },

  // Get mortuary records
  async getRecords(hospitalId: string, filters: {
    releaseStatus?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (filters.releaseStatus) where.releaseStatus = filters.releaseStatus;
    if (filters.dateFrom || filters.dateTo) {
      where.dateOfDeath = {};
      if (filters.dateFrom) where.dateOfDeath.gte = filters.dateFrom;
      if (filters.dateTo) where.dateOfDeath.lte = filters.dateTo;
    }
    if (filters.search) {
      where.OR = [
        { recordNumber: { contains: filters.search, mode: 'insensitive' } },
        { deceasedName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [records, total] = await Promise.all([
      prisma.mortuaryRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateOfDeath: 'desc' },
      }),
      prisma.mortuaryRecord.count({ where }),
    ]);

    return { records, total, page, limit };
  },

  // Get record by ID
  async getRecordById(id: string) {
    return prisma.mortuaryRecord.findUnique({
      where: { id },
    });
  },

  // Update record
  async updateRecord(id: string, data: {
    causeOfDeath?: string;
    storageLocation?: string;
    compartmentNumber?: string;
    bodyCondition?: string;
    notes?: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data,
    });
  },

  // Receive body
  async receiveBody(id: string, data: {
    compartmentNumber: string;
    storageLocation: string;
    receivedBy: string;
    bodyCondition?: string;
    belongings?: string[];
    belongingsReceivedBy?: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        compartmentNumber: data.compartmentNumber,
        storageLocation: data.storageLocation,
        bodyReceivedAt: new Date(),
        receivedBy: data.receivedBy,
        bodyCondition: data.bodyCondition,
        belongings: data.belongings || [],
        belongingsReceivedBy: data.belongingsReceivedBy,
      },
    });
  },

  // Update status
  async updateStatus(id: string, status: string, data?: any) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        releaseStatus: status as any,
        ...data,
      },
    });
  },

  // Register organ donation
  async registerOrganDonation(id: string, data: {
    organs: string[];
    consentForm?: string;
    consentedBy: string;
    relationship: string;
    witnessedBy?: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        notes: `Organ Donation: ${data.organs.join(', ')}. Consented by: ${data.consentedBy} (${data.relationship})`,
      },
    });
  },

  // Issue death certificate
  async issueDeathCertificate(id: string, data: {
    certificateNumber: string;
    certificateUrl?: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        deathCertificateNumber: data.certificateNumber,
        deathCertificateUrl: data.certificateUrl,
        certifiedAt: new Date(),
      },
    });
  },

  // Schedule autopsy
  async scheduleAutopsy(id: string, data: {
    autopsyDoctor: string;
    autopsyDate?: Date;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        autopsyRequired: true,
        autopsyStatus: AutopsyStatus.PENDING,
        autopsyDoctor: data.autopsyDoctor,
        autopsyDate: data.autopsyDate,
      },
    });
  },

  // Complete autopsy
  async completeAutopsy(id: string, data: {
    findings: string;
    doctor?: string;
    finalCauseOfDeath?: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        autopsyStatus: AutopsyStatus.COMPLETED,
        autopsyFindings: data.findings,
        autopsyDoctor: data.doctor,
        autopsyDate: new Date(),
        causeOfDeath: data.finalCauseOfDeath || undefined,
      },
    });
  },

  // Release body
  async releaseBody(id: string, data: {
    releasedTo: string;
    releaseAuthorizedBy: string;
    policeNocNumber?: string;
    undertakerName?: string;
    undertakerLicense?: string;
    notes?: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        releaseStatus: ReleaseStatus.RELEASED,
        releasedTo: data.releasedTo,
        releasedAt: new Date(),
        releaseAuthorizedBy: data.releaseAuthorizedBy,
        policeNocNumber: data.policeNocNumber,
        undertakerName: data.undertakerName,
        undertakerLicense: data.undertakerLicense,
        notes: data.notes,
      },
    });
  },

  // ==================== AI FEATURES ====================

  // AI: Analyze cause of death patterns
  analyzeMortalityPatterns(data: {
    records: {
      causeOfDeath: string;
      age: number;
      gender: string;
      dateOfDeath: Date;
      placeOfDeath: string;
    }[];
  }): {
    topCauses: { cause: string; count: number; percentage: number }[];
    demographicAnalysis: { group: string; count: number; topCause: string }[];
    trends: { period: string; count: number; change: number }[];
    insights: string[];
    recommendations: string[];
  } {
    const causeCounts: Record<string, number> = {};
    const ageGroups: Record<string, { count: number; causes: Record<string, number> }> = {
      '0-18': { count: 0, causes: {} },
      '19-40': { count: 0, causes: {} },
      '41-60': { count: 0, causes: {} },
      '61-80': { count: 0, causes: {} },
      '80+': { count: 0, causes: {} },
    };

    data.records.forEach(record => {
      // Count causes
      causeCounts[record.causeOfDeath] = (causeCounts[record.causeOfDeath] || 0) + 1;

      // Age group analysis
      let ageGroup: string;
      if (record.age <= 18) ageGroup = '0-18';
      else if (record.age <= 40) ageGroup = '19-40';
      else if (record.age <= 60) ageGroup = '41-60';
      else if (record.age <= 80) ageGroup = '61-80';
      else ageGroup = '80+';

      ageGroups[ageGroup].count++;
      ageGroups[ageGroup].causes[record.causeOfDeath] =
        (ageGroups[ageGroup].causes[record.causeOfDeath] || 0) + 1;
    });

    // Top causes
    const total = data.records.length;
    const topCauses = Object.entries(causeCounts)
      .map(([cause, count]) => ({
        cause,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Demographic analysis
    const demographicAnalysis = Object.entries(ageGroups)
      .filter(([_, groupData]) => groupData.count > 0)
      .map(([group, groupData]) => {
        const topCause = Object.entries(groupData.causes)
          .sort((a, b) => b[1] - a[1])[0];
        return {
          group,
          count: groupData.count,
          topCause: topCause ? topCause[0] : 'N/A',
        };
      });

    // Generate insights
    const insights: string[] = [];
    const recommendations: string[] = [];

    if (topCauses.length > 0) {
      insights.push(`Leading cause of death: ${topCauses[0].cause} (${topCauses[0].percentage}%)`);
    }

    // Check for concerning patterns
    const cardiovascular = topCauses.filter(c =>
      c.cause.toLowerCase().includes('cardiac') ||
      c.cause.toLowerCase().includes('heart') ||
      c.cause.toLowerCase().includes('myocardial')
    );
    if (cardiovascular.length > 0) {
      const totalCardio = cardiovascular.reduce((sum, c) => sum + c.count, 0);
      if (totalCardio / total > 0.3) {
        insights.push('High cardiovascular mortality rate detected');
        recommendations.push('Consider cardiac screening programs and preventive cardiology initiatives');
      }
    }

    const infections = topCauses.filter(c =>
      c.cause.toLowerCase().includes('sepsis') ||
      c.cause.toLowerCase().includes('infection') ||
      c.cause.toLowerCase().includes('pneumonia')
    );
    if (infections.length > 0) {
      const totalInfections = infections.reduce((sum, c) => sum + c.count, 0);
      if (totalInfections / total > 0.2) {
        insights.push('Significant infection-related mortality');
        recommendations.push('Review infection control protocols and antibiotic stewardship');
      }
    }

    return {
      topCauses,
      demographicAnalysis,
      trends: [], // Would calculate from historical data
      insights,
      recommendations,
    };
  },

  // AI: Generate death summary report
  generateDeathSummary(data: {
    deceased: {
      name: string;
      age: number;
      gender: string;
    };
    death: {
      dateOfDeath: Date;
      causeOfDeath: string;
      mannerOfDeath: string;
      placeOfDeath: string;
    };
  }): {
    summary: string;
    clinicalNotes: string;
  } {
    const { deceased, death } = data;

    const summary = `
DEATH SUMMARY REPORT

Deceased: ${deceased.name}
Age: ${deceased.age} years | Gender: ${deceased.gender}
Date of Death: ${death.dateOfDeath.toLocaleDateString()}
Place of Death: ${death.placeOfDeath}

CAUSE OF DEATH:
${death.causeOfDeath}

MANNER OF DEATH:
${death.mannerOfDeath}
    `.trim();

    const clinicalNotes = `
${deceased.name}, a ${deceased.age}-year-old ${deceased.gender.toLowerCase()},
expired on ${death.dateOfDeath.toLocaleDateString()} at ${death.placeOfDeath}.
Cause of death: ${death.causeOfDeath}. Manner of death: ${death.mannerOfDeath}.
    `.trim();

    return { summary, clinicalNotes };
  },

  // AI: Check documentation completeness
  checkDocumentationCompleteness(record: {
    causeOfDeath?: string;
    mannerOfDeath?: string;
    certifyingDoctor?: string;
    timeOfDeath?: Date;
    nokName?: string;
    nokPhone?: string;
    autopsyRequired?: boolean;
    autopsyFindings?: string;
    deathCertificateNumber?: string;
  }): {
    completeness: number;
    missingFields: string[];
    requiredForRelease: string[];
    recommendations: string[];
  } {
    const missingFields: string[] = [];
    const requiredForRelease: string[] = [];
    const recommendations: string[] = [];

    // Required fields
    if (!record.causeOfDeath) {
      missingFields.push('Cause of death');
      requiredForRelease.push('Cause of death must be documented');
    }
    if (!record.mannerOfDeath) {
      missingFields.push('Manner of death');
    }
    if (!record.certifyingDoctor) {
      missingFields.push('Certifying doctor');
      requiredForRelease.push('Death must be certified by physician');
    }
    if (!record.timeOfDeath) {
      missingFields.push('Time of death');
    }
    if (!record.nokName) {
      missingFields.push('Next of kin name');
      requiredForRelease.push('Next of kin information required for release');
    }
    if (!record.nokPhone) {
      missingFields.push('Next of kin contact');
    }

    // Autopsy documentation
    if (record.autopsyRequired && !record.autopsyFindings) {
      missingFields.push('Autopsy findings');
      recommendations.push('Complete autopsy documentation before release');
    }

    // Death certificate
    if (!record.deathCertificateNumber) {
      requiredForRelease.push('Death certificate must be issued');
      recommendations.push('Process death certificate before body release');
    }

    const totalFields = 10;
    const completedFields = totalFields - missingFields.length;
    const completeness = Math.round((completedFields / totalFields) * 100);

    return {
      completeness,
      missingFields,
      requiredForRelease,
      recommendations,
    };
  },

  // Get mortuary dashboard stats
  async getDashboardStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      totalNotReleased,
      pendingAutopsy,
      pendingCertificates,
      releasedThisMonth,
      totalThisMonth,
    ] = await Promise.all([
      prisma.mortuaryRecord.count({
        where: { hospitalId, releaseStatus: ReleaseStatus.NOT_RELEASED },
      }),
      prisma.mortuaryRecord.count({
        where: { hospitalId, autopsyStatus: AutopsyStatus.PENDING },
      }),
      prisma.mortuaryRecord.count({
        where: {
          hospitalId,
          releaseStatus: ReleaseStatus.NOT_RELEASED,
          deathCertificateNumber: null,
        },
      }),
      prisma.mortuaryRecord.count({
        where: {
          hospitalId,
          releaseStatus: ReleaseStatus.RELEASED,
          releasedAt: { gte: thisMonth },
        },
      }),
      prisma.mortuaryRecord.count({
        where: {
          hospitalId,
          dateOfDeath: { gte: thisMonth },
        },
      }),
    ]);

    return {
      totalNotReleased,
      pendingAutopsy,
      pendingCertificates,
      releasedThisMonth,
      totalThisMonth,
    };
  },
};
