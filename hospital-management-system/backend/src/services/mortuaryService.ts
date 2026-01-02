import prisma from '../config/database';

// ==================== MORTUARY RECORD MANAGEMENT ====================

export const mortuaryService = {
  // Register death / create mortuary record
  async registerDeath(hospitalId: string, data: {
    patientId: string;
    admissionId?: string;
    dateOfDeath: Date;
    timeOfDeath: string;
    causeOfDeath: string;
    mannerOfDeath: string;
    pronouncedBy: string;
    witnessedBy?: string;
    location: string;
    autopsy: boolean;
    organDonor: boolean;
    nextOfKinName: string;
    nextOfKinRelation: string;
    nextOfKinPhone: string;
    nextOfKinAddress?: string;
  }) {
    // Generate mortuary number
    const count = await prisma.mortuaryRecord.count({ where: { hospitalId } });
    const mortuaryNumber = `MR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    return prisma.mortuaryRecord.create({
      data: {
        ...data,
        hospitalId,
        mortuaryNumber,
        status: 'ADMITTED',
        deathCertificateIssued: false,
      },
      include: {
        patient: true,
      },
    });
  },

  // Get mortuary records
  async getRecords(hospitalId: string, filters: {
    status?: string;
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
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.dateOfDeath = {};
      if (filters.dateFrom) where.dateOfDeath.gte = filters.dateFrom;
      if (filters.dateTo) where.dateOfDeath.lte = filters.dateTo;
    }
    if (filters.search) {
      where.OR = [
        { mortuaryNumber: { contains: filters.search, mode: 'insensitive' } },
        { patient: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const [records, total] = await Promise.all([
      prisma.mortuaryRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dateOfDeath: 'desc' },
        include: { patient: true },
      }),
      prisma.mortuaryRecord.count({ where }),
    ]);

    return { records, total, page, limit };
  },

  // Get record by ID
  async getRecordById(id: string) {
    return prisma.mortuaryRecord.findUnique({
      where: { id },
      include: {
        patient: true,
        admission: true,
      },
    });
  },

  // Update record
  async updateRecord(id: string, data: {
    causeOfDeath?: string;
    autopsyResults?: string;
    autopsyPerformedBy?: string;
    autopsyDate?: Date;
    storageLocation?: string;
    preservationMethod?: string;
    notes?: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data,
      include: { patient: true },
    });
  },

  // Update status
  async updateStatus(id: string, status: string, data?: {
    releasedTo?: string;
    releaseDate?: Date;
    releaseAuthorizedBy?: string;
    funeralHome?: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        status,
        ...data,
      },
      include: { patient: true },
    });
  },

  // Issue death certificate
  async issueDeathCertificate(id: string, data: {
    certificateNumber: string;
    issuedBy: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        deathCertificateIssued: true,
        deathCertificateNumber: data.certificateNumber,
        certificateIssuedBy: data.issuedBy,
        certificateIssuedAt: new Date(),
      },
      include: { patient: true },
    });
  },

  // Schedule autopsy
  async scheduleAutopsy(id: string, data: {
    scheduledDate: Date;
    pathologist: string;
    reason: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        autopsy: true,
        autopsyScheduledDate: data.scheduledDate,
        autopsyPathologist: data.pathologist,
        autopsyReason: data.reason,
        status: 'AUTOPSY_PENDING',
      },
      include: { patient: true },
    });
  },

  // Complete autopsy
  async completeAutopsy(id: string, data: {
    results: string;
    findings: string;
    performedBy: string;
    finalCauseOfDeath?: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        autopsyResults: data.results,
        autopsyFindings: data.findings,
        autopsyPerformedBy: data.performedBy,
        autopsyDate: new Date(),
        causeOfDeath: data.finalCauseOfDeath || undefined,
        status: 'ADMITTED',
      },
      include: { patient: true },
    });
  },

  // Release body
  async releaseBody(id: string, data: {
    releasedTo: string;
    relationship: string;
    idVerification: string;
    funeralHome?: string;
    authorizedBy: string;
    notes?: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        status: 'RELEASED',
        releasedTo: data.releasedTo,
        releasedToRelation: data.relationship,
        releaseIdVerification: data.idVerification,
        funeralHome: data.funeralHome,
        releaseAuthorizedBy: data.authorizedBy,
        releaseDate: new Date(),
        releaseNotes: data.notes,
      },
      include: { patient: true },
    });
  },

  // ==================== ORGAN DONATION ====================

  // Register organ donation consent
  async registerOrganDonation(id: string, data: {
    organs: string[];
    consentForm: string;
    consentedBy: string;
    relationship: string;
    witnessedBy: string;
  }) {
    return prisma.mortuaryRecord.update({
      where: { id },
      data: {
        organDonor: true,
        organsForDonation: data.organs,
        organDonationConsent: data.consentForm,
        organDonationConsentedBy: data.consentedBy,
        organDonationConsentRelation: data.relationship,
        organDonationWitnessedBy: data.witnessedBy,
      },
      include: { patient: true },
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
      location: string;
      department: string;
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
      .filter(([_, data]) => data.count > 0)
      .map(([group, data]) => {
        const topCause = Object.entries(data.causes)
          .sort((a, b) => b[1] - a[1])[0];
        return {
          group,
          count: data.count,
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
    patient: {
      name: string;
      age: number;
      gender: string;
      medicalHistory: string[];
    };
    admission: {
      diagnosis: string;
      treatments: string[];
      complications: string[];
    };
    death: {
      dateOfDeath: Date;
      causeOfDeath: string;
      contributingFactors: string[];
    };
  }): {
    summary: string;
    timeline: { time: string; event: string }[];
    clinicalNotes: string;
  } {
    const { patient, admission, death } = data;

    const summary = `
DEATH SUMMARY REPORT

Patient: ${patient.name}
Age: ${patient.age} years | Gender: ${patient.gender}
Date of Death: ${death.dateOfDeath.toLocaleDateString()}

MEDICAL HISTORY:
${patient.medicalHistory.map(h => `• ${h}`).join('\n')}

ADMISSION DIAGNOSIS:
${admission.diagnosis}

TREATMENTS PROVIDED:
${admission.treatments.map(t => `• ${t}`).join('\n')}

COMPLICATIONS:
${admission.complications.map(c => `• ${c}`).join('\n')}

CAUSE OF DEATH:
Primary: ${death.causeOfDeath}
${death.contributingFactors.length > 0 ? `Contributing Factors:\n${death.contributingFactors.map(f => `• ${f}`).join('\n')}` : ''}
    `.trim();

    const timeline: { time: string; event: string }[] = [
      { time: 'Admission', event: `Admitted with ${admission.diagnosis}` },
      ...admission.treatments.map((t, i) => ({
        time: `Day ${i + 1}`,
        event: `Treatment: ${t}`,
      })),
      ...admission.complications.map((c, i) => ({
        time: `Complication ${i + 1}`,
        event: c,
      })),
      { time: death.dateOfDeath.toLocaleDateString(), event: `Death: ${death.causeOfDeath}` },
    ];

    const clinicalNotes = `
Patient ${patient.name}, a ${patient.age}-year-old ${patient.gender.toLowerCase()},
was admitted with ${admission.diagnosis}. Despite ${admission.treatments.length} treatment interventions,
the patient developed ${admission.complications.length > 0 ? admission.complications.join(', ') : 'no documented complications'}.
The patient expired on ${death.dateOfDeath.toLocaleDateString()} due to ${death.causeOfDeath}.
${death.contributingFactors.length > 0 ? `Contributing factors included ${death.contributingFactors.join(', ')}.` : ''}
    `.trim();

    return { summary, timeline, clinicalNotes };
  },

  // AI: Suggest documentation completeness
  checkDocumentationCompleteness(record: {
    causeOfDeath?: string;
    mannerOfDeath?: string;
    pronouncedBy?: string;
    timeOfDeath?: string;
    nextOfKinName?: string;
    nextOfKinPhone?: string;
    autopsy?: boolean;
    autopsyResults?: string;
    deathCertificateIssued?: boolean;
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
    if (!record.pronouncedBy) {
      missingFields.push('Pronounced by (physician)');
      requiredForRelease.push('Death must be pronounced by physician');
    }
    if (!record.timeOfDeath) {
      missingFields.push('Time of death');
    }
    if (!record.nextOfKinName) {
      missingFields.push('Next of kin name');
      requiredForRelease.push('Next of kin information required for release');
    }
    if (!record.nextOfKinPhone) {
      missingFields.push('Next of kin contact');
    }

    // Autopsy documentation
    if (record.autopsy && !record.autopsyResults) {
      missingFields.push('Autopsy results');
      recommendations.push('Complete autopsy documentation before release');
    }

    // Death certificate
    if (!record.deathCertificateIssued) {
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
      totalAdmitted,
      pendingAutopsy,
      pendingRelease,
      releasedThisMonth,
      totalThisMonth,
      pendingCertificates,
    ] = await Promise.all([
      prisma.mortuaryRecord.count({
        where: { hospitalId, status: 'ADMITTED' },
      }),
      prisma.mortuaryRecord.count({
        where: { hospitalId, status: 'AUTOPSY_PENDING' },
      }),
      prisma.mortuaryRecord.count({
        where: {
          hospitalId,
          status: 'ADMITTED',
          deathCertificateIssued: true,
        },
      }),
      prisma.mortuaryRecord.count({
        where: {
          hospitalId,
          status: 'RELEASED',
          releaseDate: { gte: thisMonth },
        },
      }),
      prisma.mortuaryRecord.count({
        where: {
          hospitalId,
          dateOfDeath: { gte: thisMonth },
        },
      }),
      prisma.mortuaryRecord.count({
        where: {
          hospitalId,
          deathCertificateIssued: false,
        },
      }),
    ]);

    return {
      totalAdmitted,
      pendingAutopsy,
      pendingRelease,
      releasedThisMonth,
      totalThisMonth,
      pendingCertificates,
    };
  },
};
