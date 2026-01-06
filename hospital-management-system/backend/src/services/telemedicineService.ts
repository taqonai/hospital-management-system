import prisma from '../config/database';

// ==================== TELECONSULTATION SESSION MANAGEMENT ====================

export const telemedicineService = {
  // Create teleconsultation session
  async createSession(hospitalId: string, data: {
    patientId: string;
    doctorId: string;
    appointmentId?: string;
    scheduledStart: Date;
    scheduledEnd?: Date;
    sessionType: string;
    chiefComplaint?: string;
    symptoms?: string[];
  }) {
    // Generate session ID
    const count = await prisma.teleconsultationSession.count({ where: { hospitalId } });
    const sessionId = `TELE-${Date.now()}-${String(count + 1).padStart(5, '0')}`;

    // Generate room URL (would integrate with video provider)
    const meetingUrl = `https://meet.hospital.com/room/${sessionId}`;

    // Calculate scheduled end if not provided (default 30 min)
    const scheduledEnd = data.scheduledEnd || new Date(new Date(data.scheduledStart).getTime() + 30 * 60000);

    return prisma.teleconsultationSession.create({
      data: {
        hospitalId,
        sessionId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        appointmentId: data.appointmentId,
        scheduledStart: data.scheduledStart,
        scheduledEnd,
        sessionType: data.sessionType as any,
        chiefComplaint: data.chiefComplaint,
        symptoms: data.symptoms || [],
        meetingUrl,
      },
    });
  },

  // Get sessions
  async getSessions(hospitalId: string, filters: {
    status?: string;
    doctorId?: string;
    patientId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sessionType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { hospitalId };
    if (filters.status) where.status = filters.status;
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.sessionType) where.sessionType = filters.sessionType;
    if (filters.dateFrom || filters.dateTo) {
      where.scheduledStart = {};
      if (filters.dateFrom) where.scheduledStart.gte = filters.dateFrom;
      if (filters.dateTo) where.scheduledStart.lte = filters.dateTo;
    }

    const [sessions, total] = await Promise.all([
      prisma.teleconsultationSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledStart: 'asc' },
      }),
      prisma.teleconsultationSession.count({ where }),
    ]);

    return { sessions, total, page, limit };
  },

  // Get session by ID
  async getSessionById(id: string) {
    return prisma.teleconsultationSession.findUnique({
      where: { id },
    });
  },

  // Start session
  async startSession(id: string) {
    return prisma.teleconsultationSession.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        actualStart: new Date(),
      },
    });
  },

  // End session
  async endSession(id: string, data: {
    diagnosis?: string;
    prescription?: string;
    doctorNotes?: string;
    followUpDate?: Date;
  }) {
    const session = await prisma.teleconsultationSession.findUnique({
      where: { id },
    });

    if (!session) throw new Error('Session not found');

    return prisma.teleconsultationSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        actualEnd: new Date(),
        diagnosis: data.diagnosis,
        prescription: data.prescription,
        doctorNotes: data.doctorNotes,
        followUpDate: data.followUpDate,
      },
    });
  },

  // Cancel session
  async cancelSession(id: string, reason: string) {
    return prisma.teleconsultationSession.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellationReason: reason,
      },
    });
  },

  // Mark as no-show
  async markNoShow(id: string, _party: 'PATIENT' | 'DOCTOR') {
    return prisma.teleconsultationSession.update({
      where: { id },
      data: {
        status: 'NO_SHOW',
      },
    });
  },

  // Update session notes
  async updateNotes(id: string, notes: string) {
    return prisma.teleconsultationSession.update({
      where: { id },
      data: { doctorNotes: notes },
    });
  },

  // Record vitals - store as AI symptom analysis for now
  async recordVitals(id: string, vitals: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
  }) {
    return prisma.teleconsultationSession.update({
      where: { id },
      data: {
        aiSymptomAnalysis: vitals,
      },
    });
  },

  // ==================== AI FEATURES ====================

  // AI: Pre-consultation triage
  performAITriage(data: {
    symptoms: string[];
    duration: string;
    severity: string;
    age: number;
    gender: string;
    medicalHistory: string[];
    currentMedications: string[];
  }): {
    urgencyLevel: string;
    urgencyScore: number;
    recommendedAction: string;
    possibleConditions: { condition: string; probability: number }[];
    questionsToAsk: string[];
    redFlags: string[];
    telemedAppropriate: boolean;
  } {
    const redFlags: string[] = [];
    let urgencyScore = 0;

    // Symptom analysis
    const criticalSymptoms = [
      'chest pain', 'difficulty breathing', 'shortness of breath',
      'severe headache', 'sudden weakness', 'confusion',
      'fainting', 'seizure', 'severe bleeding',
      'suicidal thoughts', 'severe abdominal pain',
    ];

    const moderateSymptoms = [
      'fever', 'persistent cough', 'vomiting',
      'diarrhea', 'dizziness', 'moderate pain',
    ];

    data.symptoms.forEach(symptom => {
      const lowerSymptom = symptom.toLowerCase();
      if (criticalSymptoms.some(cs => lowerSymptom.includes(cs))) {
        redFlags.push(symptom);
        urgencyScore += 30;
      } else if (moderateSymptoms.some(ms => lowerSymptom.includes(ms))) {
        urgencyScore += 10;
      }
    });

    // Severity adjustment
    if (data.severity === 'severe') urgencyScore += 20;
    else if (data.severity === 'moderate') urgencyScore += 10;

    // Age risk factors
    if (data.age < 2 || data.age > 65) urgencyScore += 10;

    // Duration
    if (data.duration.includes('hour') && !data.duration.includes('24')) {
      urgencyScore += 5;
    }

    // Medical history risks
    const highRiskConditions = [
      'diabetes', 'heart disease', 'cancer', 'immunocompromised',
      'copd', 'asthma', 'hypertension',
    ];
    data.medicalHistory.forEach(condition => {
      if (highRiskConditions.some(hrc => condition.toLowerCase().includes(hrc))) {
        urgencyScore += 10;
      }
    });

    // Determine urgency level
    let urgencyLevel: string;
    let recommendedAction: string;
    let telemedAppropriate: boolean;

    if (urgencyScore >= 50) {
      urgencyLevel = 'EMERGENCY';
      recommendedAction = 'Seek immediate emergency care';
      telemedAppropriate = false;
    } else if (urgencyScore >= 35) {
      urgencyLevel = 'URGENT';
      recommendedAction = 'Schedule urgent appointment today';
      telemedAppropriate = true;
    } else if (urgencyScore >= 20) {
      urgencyLevel = 'MODERATE';
      recommendedAction = 'Schedule appointment within 24-48 hours';
      telemedAppropriate = true;
    } else {
      urgencyLevel = 'LOW';
      recommendedAction = 'Teleconsultation appropriate for initial evaluation';
      telemedAppropriate = true;
    }

    // Generate possible conditions (simplified)
    const possibleConditions = this.suggestPossibleConditions(data.symptoms);

    // Generate questions for doctor
    const questionsToAsk = this.generateTriageQuestions(data.symptoms);

    return {
      urgencyLevel,
      urgencyScore: Math.min(100, urgencyScore),
      recommendedAction,
      possibleConditions,
      questionsToAsk,
      redFlags,
      telemedAppropriate,
    };
  },

  // Helper: Suggest possible conditions
  suggestPossibleConditions(symptoms: string[]): { condition: string; probability: number }[] {
    const conditionMap: Record<string, { symptoms: string[]; name: string }> = {
      'uri': {
        symptoms: ['cough', 'sore throat', 'runny nose', 'congestion', 'fever'],
        name: 'Upper Respiratory Infection',
      },
      'uti': {
        symptoms: ['burning urination', 'frequent urination', 'urgency', 'pelvic pain'],
        name: 'Urinary Tract Infection',
      },
      'gastro': {
        symptoms: ['nausea', 'vomiting', 'diarrhea', 'abdominal pain', 'cramps'],
        name: 'Gastroenteritis',
      },
      'migraine': {
        symptoms: ['headache', 'nausea', 'light sensitivity', 'visual changes'],
        name: 'Migraine',
      },
      'allergies': {
        symptoms: ['sneezing', 'itchy eyes', 'runny nose', 'rash', 'hives'],
        name: 'Allergic Reaction',
      },
    };

    const results: { condition: string; probability: number }[] = [];
    const lowerSymptoms = symptoms.map(s => s.toLowerCase());

    Object.entries(conditionMap).forEach(([_, condition]) => {
      const matches = condition.symptoms.filter(cs =>
        lowerSymptoms.some(ls => ls.includes(cs))
      );
      if (matches.length > 0) {
        const probability = Math.min(0.9, matches.length / condition.symptoms.length + 0.2);
        results.push({
          condition: condition.name,
          probability: Math.round(probability * 100) / 100,
        });
      }
    });

    return results.sort((a, b) => b.probability - a.probability).slice(0, 5);
  },

  // Helper: Generate triage questions
  generateTriageQuestions(symptoms: string[]): string[] {
    const questions: string[] = [
      'When did the symptoms first begin?',
      'Have you experienced these symptoms before?',
      'What makes the symptoms better or worse?',
    ];

    const lowerSymptoms = symptoms.map(s => s.toLowerCase()).join(' ');

    if (lowerSymptoms.includes('pain')) {
      questions.push('Can you describe the pain? (sharp, dull, burning, etc.)');
      questions.push('On a scale of 1-10, how severe is the pain?');
    }
    if (lowerSymptoms.includes('fever')) {
      questions.push('What is your highest recorded temperature?');
      questions.push('Are you taking any fever reducers?');
    }
    if (lowerSymptoms.includes('cough')) {
      questions.push('Is the cough dry or productive?');
      questions.push('Is there any blood in the sputum?');
    }
    if (lowerSymptoms.includes('breathing') || lowerSymptoms.includes('breath')) {
      questions.push('Do you have any chest pain with breathing?');
      questions.push('Are you able to speak in full sentences?');
    }

    return questions.slice(0, 8);
  },

  // AI: Generate consultation summary
  generateConsultationSummary(data: {
    patient: { name: string; age: number; gender: string };
    symptoms: string[];
    vitals?: any;
    diagnosis?: string;
    notes: string;
    prescription?: any;
    followUp?: boolean;
  }): {
    summary: string;
    keyFindings: string[];
    plan: string[];
    patientInstructions: string[];
  } {
    const keyFindings: string[] = [];
    const plan: string[] = [];
    const patientInstructions: string[] = [];

    // Extract key findings
    if (data.symptoms.length > 0) {
      keyFindings.push(`Presenting symptoms: ${data.symptoms.join(', ')}`);
    }
    if (data.vitals) {
      if (data.vitals.bloodPressure) keyFindings.push(`BP: ${data.vitals.bloodPressure}`);
      if (data.vitals.heartRate) keyFindings.push(`HR: ${data.vitals.heartRate} bpm`);
      if (data.vitals.temperature) keyFindings.push(`Temp: ${data.vitals.temperature}°F`);
    }
    if (data.diagnosis) {
      keyFindings.push(`Assessment: ${data.diagnosis}`);
    }

    // Generate plan
    if (data.prescription) {
      plan.push('Medications prescribed as detailed below');
    }
    if (data.followUp) {
      plan.push('Follow-up appointment recommended');
    }

    // Generate patient instructions
    patientInstructions.push('Take all medications as prescribed');
    patientInstructions.push('Rest and stay hydrated');
    patientInstructions.push('Return to ER if symptoms worsen significantly');
    if (data.followUp) {
      patientInstructions.push('Schedule follow-up appointment as discussed');
    }

    const summary = `
TELECONSULTATION SUMMARY

Patient: ${data.patient.name} (${data.patient.age}y ${data.patient.gender})
Date: ${new Date().toLocaleDateString()}

CHIEF COMPLAINT:
${data.symptoms.join(', ')}

ASSESSMENT:
${data.diagnosis || 'See clinical notes'}

CLINICAL NOTES:
${data.notes}

PLAN:
${plan.map((p, i) => `${i + 1}. ${p}`).join('\n')}
    `.trim();

    return {
      summary,
      keyFindings,
      plan,
      patientInstructions,
    };
  },

  // AI: Recommend follow-up timing
  recommendFollowUp(data: {
    diagnosis: string;
    severity: string;
    patientAge: number;
    comorbidities: string[];
  }): {
    recommendFollowUp: boolean;
    recommendedDays: number;
    reason: string;
    followUpType: string;
  } {
    let recommendedDays = 14;
    let followUpType = 'TELECONSULTATION';

    // Adjust based on diagnosis
    const acuteConditions = ['infection', 'uti', 'bronchitis', 'sinusitis'];
    const chronicConditions = ['diabetes', 'hypertension', 'copd', 'asthma'];

    const lowerDiagnosis = data.diagnosis.toLowerCase();

    if (acuteConditions.some(c => lowerDiagnosis.includes(c))) {
      recommendedDays = 7;
      followUpType = 'TELECONSULTATION';
    } else if (chronicConditions.some(c => lowerDiagnosis.includes(c))) {
      recommendedDays = 30;
      followUpType = 'IN_PERSON';
    }

    // Severity adjustment
    if (data.severity === 'severe') {
      recommendedDays = Math.min(3, recommendedDays);
      followUpType = 'IN_PERSON';
    }

    // Age adjustment
    if (data.patientAge < 5 || data.patientAge > 70) {
      recommendedDays = Math.min(7, recommendedDays);
    }

    // Comorbidity adjustment
    if (data.comorbidities.length > 2) {
      recommendedDays = Math.min(7, recommendedDays);
    }

    return {
      recommendFollowUp: true,
      recommendedDays,
      reason: `Based on ${data.diagnosis} and patient profile`,
      followUpType,
    };
  },

  // ==================== SESSION RECORDING ====================

  // Start recording a session
  async startRecording(sessionId: string, recordingType: 'VIDEO' | 'AUDIO' | 'SCREEN'): Promise<{
    recordingId: string;
    status: string;
    startedAt: Date;
  }> {
    const session = await prisma.teleconsultationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new Error('Can only record sessions that are in progress');
    }

    // Generate unique recording ID
    const recordingId = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startedAt = new Date();

    // Get existing recordings from doctorDeviceInfo (used as recording metadata storage)
    const existingData = (session.doctorDeviceInfo as any) || {};
    const recordings = existingData.recordings || [];

    // Check if there's already an active recording
    const activeRecording = recordings.find((r: any) => r.status === 'RECORDING');
    if (activeRecording) {
      throw new Error('A recording is already in progress for this session');
    }

    // Add new recording entry
    recordings.push({
      id: recordingId,
      type: recordingType,
      status: 'RECORDING',
      startedAt: startedAt.toISOString(),
      stoppedAt: null,
      duration: null,
      fileSize: null,
      url: null,
      thumbnailUrl: null,
    });

    // Update session with recording info
    await prisma.teleconsultationSession.update({
      where: { id: sessionId },
      data: {
        isRecorded: true,
        doctorDeviceInfo: {
          ...existingData,
          recordings,
        },
      },
    });

    // In real implementation, would integrate with video provider API (e.g., Twilio, Daily.co)
    // to actually start recording the stream

    return {
      recordingId,
      status: 'RECORDING',
      startedAt,
    };
  },

  // Stop recording
  async stopRecording(sessionId: string, recordingId: string): Promise<{
    recordingId: string;
    duration: number;
    fileSize: number;
    url: string;
  }> {
    const session = await prisma.teleconsultationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const existingData = (session.doctorDeviceInfo as any) || {};
    const recordings = existingData.recordings || [];

    const recordingIndex = recordings.findIndex((r: any) => r.id === recordingId);
    if (recordingIndex === -1) {
      throw new Error('Recording not found');
    }

    const recording = recordings[recordingIndex];
    if (recording.status !== 'RECORDING') {
      throw new Error('Recording is not in progress');
    }

    const stoppedAt = new Date();
    const startedAt = new Date(recording.startedAt);
    const duration = Math.round((stoppedAt.getTime() - startedAt.getTime()) / 1000); // duration in seconds

    // In real implementation, would get actual file size and URL from video provider
    // For now, estimate file size based on duration (roughly 1MB per minute for compressed video)
    const estimatedFileSize = Math.round(duration * (1024 * 1024 / 60));
    const recordingUrl = `https://recordings.hospital.com/${sessionId}/${recordingId}.mp4`;

    // Update recording entry
    recordings[recordingIndex] = {
      ...recording,
      status: 'COMPLETED',
      stoppedAt: stoppedAt.toISOString(),
      duration,
      fileSize: estimatedFileSize,
      url: recordingUrl,
    };

    // Update session
    await prisma.teleconsultationSession.update({
      where: { id: sessionId },
      data: {
        recordingUrl: recordingUrl, // Store the latest recording URL
        doctorDeviceInfo: {
          ...existingData,
          recordings,
        },
      },
    });

    return {
      recordingId,
      duration,
      fileSize: estimatedFileSize,
      url: recordingUrl,
    };
  },

  // Get session recordings
  async getSessionRecordings(sessionId: string): Promise<Array<{
    id: string;
    type: string;
    duration: number;
    fileSize: number;
    url: string;
    createdAt: Date;
  }>> {
    const session = await prisma.teleconsultationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const existingData = (session.doctorDeviceInfo as any) || {};
    const recordings = existingData.recordings || [];

    return recordings
      .filter((r: any) => r.status === 'COMPLETED')
      .map((r: any) => ({
        id: r.id,
        type: r.type,
        duration: r.duration || 0,
        fileSize: r.fileSize || 0,
        url: r.url || '',
        createdAt: new Date(r.startedAt),
      }));
  },

  // Save recording metadata (from video provider callback)
  async saveRecordingMetadata(sessionId: string, data: {
    recordingId: string;
    type: string;
    duration: number;
    fileSize: number;
    url: string;
    thumbnailUrl?: string;
  }) {
    const session = await prisma.teleconsultationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const existingData = (session.doctorDeviceInfo as any) || {};
    const recordings = existingData.recordings || [];

    // Find existing recording or add new one
    const recordingIndex = recordings.findIndex((r: any) => r.id === data.recordingId);

    const recordingEntry = {
      id: data.recordingId,
      type: data.type,
      status: 'COMPLETED',
      startedAt: new Date().toISOString(),
      stoppedAt: new Date().toISOString(),
      duration: data.duration,
      fileSize: data.fileSize,
      url: data.url,
      thumbnailUrl: data.thumbnailUrl || null,
    };

    if (recordingIndex !== -1) {
      recordings[recordingIndex] = { ...recordings[recordingIndex], ...recordingEntry };
    } else {
      recordings.push(recordingEntry);
    }

    await prisma.teleconsultationSession.update({
      where: { id: sessionId },
      data: {
        isRecorded: true,
        recordingUrl: data.url,
        doctorDeviceInfo: {
          ...existingData,
          recordings,
        },
      },
    });

    return recordingEntry;
  },

  // Delete recording
  async deleteRecording(recordingId: string) {
    // Find the session containing this recording
    const sessions = await prisma.teleconsultationSession.findMany({
      where: {
        isRecorded: true,
      },
    });

    let targetSession = null;
    let recordingIndex = -1;

    for (const session of sessions) {
      const existingData = (session.doctorDeviceInfo as any) || {};
      const recordings = existingData.recordings || [];
      const idx = recordings.findIndex((r: any) => r.id === recordingId);
      if (idx !== -1) {
        targetSession = session;
        recordingIndex = idx;
        break;
      }
    }

    if (!targetSession || recordingIndex === -1) {
      throw new Error('Recording not found');
    }

    const existingData = (targetSession.doctorDeviceInfo as any) || {};
    const recordings = existingData.recordings || [];

    // Remove the recording
    recordings.splice(recordingIndex, 1);

    // Update session
    await prisma.teleconsultationSession.update({
      where: { id: targetSession.id },
      data: {
        isRecorded: recordings.length > 0,
        recordingUrl: recordings.length > 0 ? recordings[recordings.length - 1].url : null,
        doctorDeviceInfo: {
          ...existingData,
          recordings,
        },
      },
    });

    // In real implementation, would also delete the actual file from storage

    return { deleted: true, recordingId };
  },

  // Get all recordings for a patient (for medical records)
  async getPatientRecordings(patientId: string, params: { page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    // Get all sessions for this patient that have recordings
    const sessions = await prisma.teleconsultationSession.findMany({
      where: {
        patientId,
        isRecorded: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Extract all recordings from all sessions
    const allRecordings: Array<{
      id: string;
      sessionId: string;
      sessionDate: Date;
      type: string;
      duration: number;
      fileSize: number;
      url: string;
      createdAt: Date;
    }> = [];

    for (const session of sessions) {
      const existingData = (session.doctorDeviceInfo as any) || {};
      const recordings = existingData.recordings || [];

      for (const recording of recordings) {
        if (recording.status === 'COMPLETED') {
          allRecordings.push({
            id: recording.id,
            sessionId: session.id,
            sessionDate: session.scheduledStart,
            type: recording.type,
            duration: recording.duration || 0,
            fileSize: recording.fileSize || 0,
            url: recording.url || '',
            createdAt: new Date(recording.startedAt),
          });
        }
      }
    }

    // Sort by createdAt descending
    allRecordings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const total = allRecordings.length;
    const paginatedRecordings = allRecordings.slice(skip, skip + limit);

    return {
      recordings: paginatedRecordings,
      total,
      page,
      limit,
    };
  },

  // Get telemedicine dashboard stats
  async getDashboardStats(hospitalId: string, doctorId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = { hospitalId };
    if (doctorId) where.doctorId = doctorId;

    const [
      todaySessions,
      upcomingSessions,
      inProgress,
      completed,
      noShows,
      totalSessions,
    ] = await Promise.all([
      prisma.teleconsultationSession.count({
        where: {
          ...where,
          scheduledStart: { gte: today, lt: tomorrow },
        },
      }),
      prisma.teleconsultationSession.count({
        where: {
          ...where,
          status: 'SCHEDULED',
          scheduledStart: { gte: new Date() },
        },
      }),
      prisma.teleconsultationSession.count({
        where: { ...where, status: 'IN_PROGRESS' },
      }),
      prisma.teleconsultationSession.count({
        where: {
          ...where,
          status: 'COMPLETED',
          actualEnd: { gte: today },
        },
      }),
      prisma.teleconsultationSession.count({
        where: {
          ...where,
          status: 'NO_SHOW',
          scheduledStart: { gte: today, lt: tomorrow },
        },
      }),
      prisma.teleconsultationSession.count({ where }),
    ]);

    return {
      todaySessions,
      upcomingSessions,
      inProgress,
      completedToday: completed,
      noShowsToday: noShows,
      totalSessions,
    };
  },
};
