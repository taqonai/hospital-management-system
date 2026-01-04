import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class MedicalRecordsService {
  // ==================== DOCUMENT MANAGEMENT ====================

  async uploadDocument(hospitalId: string, data: any) {
    const documentNumber = `DOC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    // AI: Extract text and generate summary
    const aiAnalysis = this.analyzeDocument(data.fileName, data.documentType, data.content);

    const document = await prisma.medicalDocument.create({
      data: {
        hospitalId,
        documentNumber,
        patientId: data.patientId,
        documentType: data.documentType,
        title: data.title,
        description: data.description,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
        documentDate: new Date(data.documentDate || new Date()),
        uploadedBy: data.uploadedBy,
        sourceType: data.sourceType || 'UPLOAD',
        encounterId: data.encounterId,
        departmentId: data.departmentId,
        isConfidential: data.isConfidential || false,
        accessLevel: data.accessLevel || 'NORMAL',
        aiExtractedText: aiAnalysis.extractedText,
        aiSummary: aiAnalysis.summary,
        aiTags: aiAnalysis.tags,
        tags: data.tags || [],
        notes: data.notes,
      },
    });

    return { document, aiAnalysis };
  }

  async getDocuments(hospitalId: string, params: any) {
    const { page = 1, limit = 20, patientId, documentType, search, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (patientId) where.patientId = patientId;
    if (documentType) where.documentType = documentType;
    if (startDate || endDate) {
      where.documentDate = {};
      if (startDate) where.documentDate.gte = new Date(startDate);
      if (endDate) where.documentDate.lte = new Date(endDate);
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { documentNumber: { contains: search, mode: 'insensitive' } },
        { aiExtractedText: { contains: search, mode: 'insensitive' } },
        { aiTags: { has: search } },
      ];
    }

    const [documents, total] = await Promise.all([
      prisma.medicalDocument.findMany({
        where,
        skip,
        take: limit,
        orderBy: { documentDate: 'desc' },
      }),
      prisma.medicalDocument.count({ where }),
    ]);

    return { documents, total, page, limit };
  }

  async getDocumentById(id: string) {
    return prisma.medicalDocument.findUnique({ where: { id } });
  }

  async verifyDocument(id: string, verifiedBy: string) {
    return prisma.medicalDocument.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedBy,
        verifiedAt: new Date(),
      },
    });
  }

  // AI: Analyze document
  analyzeDocument(fileName: string, documentType: string, content?: string): {
    extractedText: string;
    summary: string;
    tags: string[];
    entities: { type: string; value: string }[];
  } {
    // Simulated AI document analysis
    const tags: string[] = [];
    const entities: { type: string; value: string }[] = [];

    // Generate tags based on document type
    const tagsByType: Record<string, string[]> = {
      'DISCHARGE_SUMMARY': ['discharge', 'summary', 'treatment', 'follow-up'],
      'LAB_REPORT': ['laboratory', 'test-results', 'blood-work'],
      'IMAGING_REPORT': ['radiology', 'imaging', 'findings'],
      'PRESCRIPTION': ['medication', 'prescription', 'drugs'],
      'OPERATIVE_REPORT': ['surgery', 'operation', 'procedure'],
      'CONSENT_FORM': ['consent', 'authorization', 'legal'],
      'MEDICAL_CERTIFICATE': ['certificate', 'fitness', 'medical-leave'],
    };

    tags.push(...(tagsByType[documentType] || ['medical-record']));

    // Simulated text extraction summary
    const summaries: Record<string, string> = {
      'DISCHARGE_SUMMARY': 'Patient discharge summary containing diagnosis, treatment provided, and follow-up instructions.',
      'LAB_REPORT': 'Laboratory test results with reference ranges and interpretations.',
      'IMAGING_REPORT': 'Radiological study findings with impressions and recommendations.',
      'PRESCRIPTION': 'Medication prescription with dosage and duration instructions.',
      'OPERATIVE_REPORT': 'Surgical procedure report including findings and post-operative instructions.',
    };

    return {
      extractedText: content || `Content extracted from ${fileName}`,
      summary: summaries[documentType] || 'Medical document uploaded to patient records.',
      tags,
      entities,
    };
  }

  // AI: Smart search across documents
  async smartSearch(hospitalId: string, query: string, patientId?: string) {
    // Parse search intent
    const searchIntent = this.parseSearchIntent(query);

    const where: any = { hospitalId };
    if (patientId) where.patientId = patientId;

    // Build search conditions based on intent
    const conditions: any[] = [];

    if (searchIntent.documentTypes.length > 0) {
      conditions.push({ documentType: { in: searchIntent.documentTypes } });
    }

    if (searchIntent.keywords.length > 0) {
      searchIntent.keywords.forEach(keyword => {
        conditions.push({
          OR: [
            { title: { contains: keyword, mode: 'insensitive' } },
            { aiExtractedText: { contains: keyword, mode: 'insensitive' } },
            { aiTags: { has: keyword } },
          ],
        });
      });
    }

    if (searchIntent.dateRange) {
      where.documentDate = {
        gte: searchIntent.dateRange.start,
        lte: searchIntent.dateRange.end,
      };
    }

    if (conditions.length > 0) {
      where.AND = conditions;
    }

    const documents = await prisma.medicalDocument.findMany({
      where,
      orderBy: { documentDate: 'desc' },
      take: 20,
    });

    return {
      query,
      intent: searchIntent,
      results: documents,
      totalFound: documents.length,
      suggestions: this.generateSearchSuggestions(query, documents.length),
    };
  }

  // Parse natural language search
  parseSearchIntent(query: string): {
    documentTypes: string[];
    keywords: string[];
    dateRange?: { start: Date; end: Date };
  } {
    const queryLower = query.toLowerCase();
    const documentTypes: string[] = [];
    const keywords: string[] = [];

    // Detect document types
    if (queryLower.includes('lab') || queryLower.includes('blood') || queryLower.includes('test')) {
      documentTypes.push('LAB_REPORT');
    }
    if (queryLower.includes('xray') || queryLower.includes('ct') || queryLower.includes('mri') || queryLower.includes('scan')) {
      documentTypes.push('IMAGING_REPORT', 'XRAY_IMAGE', 'CT_SCAN', 'MRI_SCAN');
    }
    if (queryLower.includes('discharge')) {
      documentTypes.push('DISCHARGE_SUMMARY');
    }
    if (queryLower.includes('prescription') || queryLower.includes('medication')) {
      documentTypes.push('PRESCRIPTION');
    }
    if (queryLower.includes('surgery') || queryLower.includes('operation')) {
      documentTypes.push('OPERATIVE_REPORT');
    }
    if (queryLower.includes('consent')) {
      documentTypes.push('CONSENT_FORM');
    }

    // Extract medical keywords
    const medicalTerms = ['diabetes', 'hypertension', 'cardiac', 'renal', 'liver', 'cancer', 'infection', 'fracture', 'pregnancy'];
    medicalTerms.forEach(term => {
      if (queryLower.includes(term)) keywords.push(term);
    });

    // Date detection
    let dateRange: { start: Date; end: Date } | undefined;
    if (queryLower.includes('last month')) {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 1);
      dateRange = { start, end };
    } else if (queryLower.includes('last year')) {
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      dateRange = { start, end };
    } else if (queryLower.includes('this year')) {
      const start = new Date(new Date().getFullYear(), 0, 1);
      const end = new Date();
      dateRange = { start, end };
    }

    return { documentTypes, keywords, dateRange };
  }

  generateSearchSuggestions(query: string, resultsCount: number): string[] {
    const suggestions: string[] = [];

    if (resultsCount === 0) {
      suggestions.push('Try broader search terms');
      suggestions.push('Check spelling of medical terms');
      suggestions.push('Search by document type (e.g., "lab reports", "discharge summaries")');
    } else if (resultsCount > 10) {
      suggestions.push('Add date range to narrow results (e.g., "last month")');
      suggestions.push('Specify document type for more precise results');
    }

    return suggestions;
  }

  // ==================== CONSENT MANAGEMENT ====================

  async createConsent(hospitalId: string, data: any) {
    const consentNumber = `CON-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    // Get consent template
    const consentText = this.getConsentTemplate(data.consentType, data.procedureName);

    return prisma.consentForm.create({
      data: {
        hospitalId,
        consentNumber,
        patientId: data.patientId,
        consentType: data.consentType,
        procedureName: data.procedureName,
        consentText: data.customText || consentText,
        language: data.language || 'en',
        doctorId: data.doctorId,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      },
    });
  }

  async getConsents(hospitalId: string, patientId: string) {
    return prisma.consentForm.findMany({
      where: { hospitalId, patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async signConsent(consentId: string, data: any) {
    return prisma.consentForm.update({
      where: { id: consentId },
      data: {
        patientSignature: data.patientSignature,
        patientSignedAt: new Date(),
        witnessName: data.witnessName,
        witnessSignature: data.witnessSignature,
        witnessSignedAt: data.witnessSignature ? new Date() : null,
        status: 'SIGNED',
      },
    });
  }

  async revokeConsent(consentId: string, reason: string) {
    return prisma.consentForm.update({
      where: { id: consentId },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }

  getConsentTemplate(consentType: string, procedureName?: string): string {
    const templates: Record<string, string> = {
      'GENERAL_TREATMENT': `I hereby consent to receive general medical treatment at this facility. I understand that the healthcare team will explain any procedures before they are performed. I have been informed about my condition and the proposed treatment.`,
      'SURGICAL_PROCEDURE': `I, the undersigned, hereby consent to the surgical procedure: ${procedureName || '[Procedure Name]'}. The nature, purpose, risks, and benefits of this procedure have been explained to me. I understand that no guarantee has been made regarding the results.`,
      'ANESTHESIA': `I consent to the administration of anesthesia as deemed necessary by the anesthesiologist. I understand the risks associated with anesthesia including but not limited to allergic reactions, aspiration, and complications.`,
      'BLOOD_TRANSFUSION': `I consent to receive blood transfusion(s) as determined necessary by my physician. I have been informed of the risks including transfusion reactions, transmission of infectious diseases, and other complications.`,
      'HIV_TESTING': `I consent to HIV testing. I understand that the test is voluntary and confidential. I have been counseled about the implications of positive or negative results.`,
      'DNR': `I direct that in the event of cardiac or respiratory arrest, no cardiopulmonary resuscitation (CPR) be initiated. This decision has been made after careful consideration and discussion with my healthcare team.`,
    };

    return templates[consentType] || 'Standard consent form for medical procedures.';
  }

  // ==================== PATIENT TIMELINE ====================

  async getPatientTimeline(hospitalId: string, patientId: string) {
    const [documents, appointments, admissions, labOrders, prescriptions] = await Promise.all([
      prisma.medicalDocument.findMany({
        where: { hospitalId, patientId },
        orderBy: { documentDate: 'desc' },
        take: 50,
      }),
      prisma.appointment.findMany({
        where: { hospitalId, patientId },
        orderBy: { appointmentDate: 'desc' },
        take: 50,
        include: { doctor: { include: { user: true } } },
      }),
      prisma.admission.findMany({
        where: { hospitalId, patientId },
        orderBy: { admissionDate: 'desc' },
        take: 20,
        include: { bed: { include: { ward: true } } },
      }),
      prisma.labOrder.findMany({
        where: { hospitalId, patientId },
        orderBy: { orderedAt: 'desc' },
        take: 30,
      }),
      prisma.prescription.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { medications: true },
      }),
    ]);

    // Merge and sort all events
    const events: any[] = [];

    documents.forEach(doc => {
      events.push({
        type: 'DOCUMENT',
        date: doc.documentDate,
        title: doc.title,
        subtype: doc.documentType,
        id: doc.id,
        details: doc.aiSummary,
      });
    });

    appointments.forEach(apt => {
      events.push({
        type: 'APPOINTMENT',
        date: apt.appointmentDate,
        title: `${apt.type} with Dr. ${apt.doctor?.user?.lastName || 'Unknown'}`,
        subtype: apt.status,
        id: apt.id,
        details: apt.reason,
      });
    });

    admissions.forEach(adm => {
      events.push({
        type: 'ADMISSION',
        date: adm.admissionDate,
        title: `Admitted to ${adm.bed?.ward?.name || 'Ward'}`,
        subtype: adm.status,
        id: adm.id,
        details: adm.chiefComplaint,
      });
      if (adm.dischargeDate) {
        events.push({
          type: 'DISCHARGE',
          date: adm.dischargeDate,
          title: 'Discharged',
          subtype: 'COMPLETED',
          id: adm.id,
        });
      }
    });

    labOrders.forEach(lab => {
      events.push({
        type: 'LAB_ORDER',
        date: lab.orderedAt,
        title: 'Laboratory Tests Ordered',
        subtype: lab.status,
        id: lab.id,
      });
    });

    prescriptions.forEach(rx => {
      events.push({
        type: 'PRESCRIPTION',
        date: rx.createdAt,
        title: `Prescription - ${rx.medications?.length || 0} medications`,
        subtype: rx.status,
        id: rx.id,
      });
    });

    // Sort by date descending
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      patientId,
      totalEvents: events.length,
      timeline: events,
      summary: {
        totalDocuments: documents.length,
        totalAppointments: appointments.length,
        totalAdmissions: admissions.length,
        totalLabOrders: labOrders.length,
        totalPrescriptions: prescriptions.length,
      },
    };
  }

  // AI: Generate patient summary
  async generatePatientSummary(hospitalId: string, patientId: string) {
    const timeline = await this.getPatientTimeline(hospitalId, patientId);
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        medicalHistory: true,
        allergies: true,
      },
    });

    if (!patient) throw new Error('Patient not found');

    const summary = {
      demographics: {
        name: `${patient.firstName} ${patient.lastName}`,
        age: patient.dateOfBirth
          ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : null,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
      },
      medicalHistory: {
        chronicConditions: patient.medicalHistory?.chronicConditions || [],
        pastSurgeries: patient.medicalHistory?.pastSurgeries || [],
        familyHistory: patient.medicalHistory?.familyHistory || [],
      },
      allergies: patient.allergies.map(a => ({
        allergen: a.allergen,
        type: a.type,
        severity: a.severity,
      })),
      recentActivity: {
        lastVisit: timeline.timeline[0]?.date || null,
        recentAdmissions: timeline.timeline.filter(e => e.type === 'ADMISSION').slice(0, 3),
        activeConditions: [],
      },
      aiInsights: this.generateAIInsights(patient, timeline),
    };

    return summary;
  }

  generateAIInsights(patient: any, timeline: any): {
    riskFactors: string[];
    recommendations: string[];
    alerts: string[];
  } {
    const riskFactors: string[] = [];
    const recommendations: string[] = [];
    const alerts: string[] = [];

    // Check chronic conditions
    const chronicConditions = patient.medicalHistory?.chronicConditions || [];
    if (chronicConditions.includes('diabetes')) {
      riskFactors.push('Diabetes - requires regular HbA1c monitoring');
      recommendations.push('Schedule regular diabetes check-ups every 3 months');
    }
    if (chronicConditions.includes('hypertension')) {
      riskFactors.push('Hypertension - cardiovascular risk');
      recommendations.push('Monitor blood pressure regularly');
    }

    // Check allergies
    if (patient.allergies.some((a: any) => a.severity === 'LIFE_THREATENING')) {
      alerts.push('CRITICAL: Patient has life-threatening allergies - verify before any medication');
    }

    // Check recent activity
    const recentAdmissions = timeline.timeline.filter((e: any) => e.type === 'ADMISSION');
    if (recentAdmissions.length >= 3) {
      alerts.push('Multiple recent admissions - consider care coordination review');
    }

    // Age-based recommendations
    const age = patient.dateOfBirth
      ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;

    if (age && age > 50) {
      recommendations.push('Consider routine health screening (colonoscopy, cardiac evaluation)');
    }
    if (age && age > 65) {
      recommendations.push('Annual flu vaccination recommended');
      recommendations.push('Consider bone density screening');
    }

    return { riskFactors, recommendations, alerts };
  }
}

export const medicalRecordsService = new MedicalRecordsService();
