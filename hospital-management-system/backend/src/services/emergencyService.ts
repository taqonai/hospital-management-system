import prisma from '../config/database';
import { NotFoundError } from '../middleware/errorHandler';
import { patientLookupService } from './patientLookupService';

export class EmergencyService {
  // ESI Triage Levels:
  // 1 - Immediate (life-threatening)
  // 2 - Emergent (high risk)
  // 3 - Urgent (stable with multiple resources)
  // 4 - Less Urgent (one resource)
  // 5 - Non-Urgent (no resources)

  async registerEmergencyPatient(hospitalId: string, data: {
    patientId?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    gender?: 'MALE' | 'FEMALE' | 'OTHER';
    phone?: string;
    chiefComplaint: string;
    esiLevel: number;
    vitals?: {
      temperature?: number;
      bloodPressureSys?: number;
      bloodPressureDia?: number;
      heartRate?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
    };
    arrivalMode?: string;
    triageNotes?: string;
    assignedDoctorId?: string;
  }) {
    let patientId = data.patientId;
    let isNewPatient = false;

    // Find existing patient or create new one using centralized lookup service
    if (!patientId && data.firstName && data.lastName) {
      // Use patientLookupService to check for existing patient and prevent duplicates
      const result = await patientLookupService.findOrCreatePatient(
        hospitalId,
        {
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
          phone: data.phone,
          email: undefined, // Emergency patients often don't have email readily available
          address: 'Emergency Registration',
          city: '',
          state: '',
          zipCode: '',
        },
        'STAFF' // Emergency registration is done by staff
      );

      patientId = result.patient.id;
      isNewPatient = !result.isExisting;
    }

    if (!patientId) throw new Error('Patient information required');

    // Create emergency appointment
    const appointment = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId,
        doctorId: data.assignedDoctorId || (await this.getAvailableEmergencyDoctor(hospitalId)),
        appointmentDate: new Date(),
        startTime: new Date().toTimeString().slice(0, 5),
        endTime: new Date(Date.now() + 60 * 60 * 1000).toTimeString().slice(0, 5),
        type: 'EMERGENCY',
        status: 'IN_PROGRESS',
        reason: data.chiefComplaint,
        notes: JSON.stringify({
          esiLevel: data.esiLevel,
          arrivalMode: data.arrivalMode,
          triageNotes: data.triageNotes,
        }),
      },
      include: {
        patient: true,
        doctor: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Record vitals if provided
    if (data.vitals && patientId) {
      await prisma.vital.create({
        data: {
          patientId,
          ...data.vitals,
          recordedBy: 'Emergency Triage',
        },
      });
    }

    return appointment;
  }

  private async getAvailableEmergencyDoctor(hospitalId: string): Promise<string> {
    // Get an available emergency doctor
    const doctor = await prisma.doctor.findFirst({
      where: {
        department: { hospitalId, name: { contains: 'Emergency', mode: 'insensitive' } },
        isAvailable: true,
      },
    });

    if (!doctor) {
      // Fallback to any available doctor
      const anyDoctor = await prisma.doctor.findFirst({
        where: { department: { hospitalId }, isAvailable: true },
      });
      if (!anyDoctor) throw new Error('No available doctor');
      return anyDoctor.id;
    }

    return doctor.id;
  }

  async getEmergencyPatients(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        type: 'EMERGENCY',
        appointmentDate: { gte: today },
        status: { in: ['IN_PROGRESS', 'CHECKED_IN'] },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        patient: {
          include: {
            vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
            allergies: { where: { severity: { in: ['SEVERE', 'LIFE_THREATENING'] } } },
          },
        },
        doctor: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    // Transform appointments to ED patient format
    return appointments.map(apt => {
      let esiLevel = 3; // Default triage level
      let triageNotes = '';

      // Parse ESI level and triage notes from JSON notes field
      if (apt.notes) {
        try {
          const parsedNotes = JSON.parse(apt.notes);
          esiLevel = parsedNotes.esiLevel || esiLevel;
          triageNotes = parsedNotes.triageNotes || '';
        } catch (e) {
          // If notes is not JSON, treat as plain text
          triageNotes = apt.notes;
        }
      }

      return {
        id: apt.id,
        patient: {
          firstName: apt.patient.firstName,
          lastName: apt.patient.lastName,
        },
        esiLevel,
        chiefComplaint: apt.reason || '',
        arrivalTime: apt.createdAt.toISOString(), // Use createdAt as arrival time
        status: apt.status,
        triageNotes,
        doctor: apt.doctor ? {
          user: apt.doctor.user,
        } : undefined,
        vitals: apt.patient.vitals,
        allergies: apt.patient.allergies,
      };
    });
  }

  async updateTriageLevel(appointmentId: string, esiLevel: number, notes?: string) {
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) throw new NotFoundError('Emergency case not found');

    const existingNotes = appointment.notes ? JSON.parse(appointment.notes) : {};
    return prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        notes: JSON.stringify({
          ...existingNotes,
          esiLevel,
          triageNotes: notes || existingNotes.triageNotes,
          triageUpdatedAt: new Date(),
        }),
      },
    });
  }

  async assignDoctor(appointmentId: string, doctorId: string) {
    return prisma.appointment.update({
      where: { id: appointmentId },
      data: { doctorId },
      include: {
        doctor: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }

  async admitFromEmergency(appointmentId: string, hospitalId: string, bedId: string) {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId, type: 'EMERGENCY' },
    });

    if (!appointment) throw new NotFoundError('Emergency case not found');

    const notes = appointment.notes ? JSON.parse(appointment.notes) : {};

    // Create admission
    const admission = await prisma.admission.create({
      data: {
        hospitalId,
        patientId: appointment.patientId,
        bedId,
        admissionType: 'EMERGENCY',
        admittingDoctorId: appointment.doctorId,
        admissionDate: new Date(),
        chiefComplaint: appointment.reason || 'Emergency admission',
        notes: `ESI Level: ${notes.esiLevel}. ${notes.triageNotes || ''}`,
      },
    });

    // Update bed status
    await prisma.bed.update({
      where: { id: bedId },
      data: { status: 'OCCUPIED' },
    });

    // Complete emergency appointment
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
    });

    return admission;
  }

  async dischargeFromEmergency(appointmentId: string, notes?: string) {
    return prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'COMPLETED',
        notes: JSON.stringify({
          ...JSON.parse((await prisma.appointment.findUnique({ where: { id: appointmentId } }))?.notes || '{}'),
          dischargeNotes: notes,
          dischargedAt: new Date(),
        }),
      },
    });
  }

  async getEmergencyStats(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const patients = await prisma.appointment.findMany({
      where: {
        hospitalId,
        type: 'EMERGENCY',
        appointmentDate: { gte: today },
      },
    });

    const byESI: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    patients.forEach(p => {
      const notes = p.notes ? JSON.parse(p.notes) : {};
      const esi = notes.esiLevel || 3;
      byESI[esi] = (byESI[esi] || 0) + 1;
    });

    const active = patients.filter(p => ['IN_PROGRESS', 'CHECKED_IN'].includes(p.status));
    const completed = patients.filter(p => p.status === 'COMPLETED');

    // Count patients admitted from ED today
    const admitted = await prisma.admission.count({
      where: {
        hospitalId,
        admissionType: 'EMERGENCY',
        admissionDate: { gte: today },
      },
    });

    // Calculate average wait time (door-to-doctor time)
    let avgWaitTime = 0;
    if (completed.length > 0) {
      const waitTimes = completed
        .filter(p => p.createdAt && p.updatedAt)
        .map(p => {
          const arrivalTime = p.createdAt.getTime();
          const seenTime = p.updatedAt.getTime(); // Approximation using updatedAt
          return Math.round((seenTime - arrivalTime) / (1000 * 60)); // minutes
        });
      
      if (waitTimes.length > 0) {
        avgWaitTime = Math.round(
          waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length
        );
      }
    }

    return {
      // Frontend expects these field names:
      inDepartment: active.length,      // Patients currently in ED
      treatedToday: completed.length,   // Patients treated today
      admitted,                         // Patients admitted from ED today
      avgWaitTime,                      // Calculated average wait time
      byESILevel: byESI,
      criticalCount: byESI[1] + byESI[2],
      // Keep old fields for backward compatibility (temporary)
      totalToday: patients.length,
      activePatients: active.length,
      completedToday: completed.length,
    };
  }

  async getResuscitationStatus(hospitalId: string) {
    // Get ESI level 1 patients (resuscitation)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const critical = await prisma.appointment.findMany({
      where: {
        hospitalId,
        type: 'EMERGENCY',
        appointmentDate: { gte: today },
        status: { in: ['IN_PROGRESS', 'CHECKED_IN'] },
      },
      include: {
        patient: {
          include: { vitals: { orderBy: { recordedAt: 'desc' }, take: 1 } },
        },
        doctor: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    return critical.filter(c => {
      const notes = c.notes ? JSON.parse(c.notes) : {};
      return notes.esiLevel === 1 || notes.esiLevel === 2;
    });
  }

  // ESI Triage Algorithm based on ACEP/ENA guidelines
  calculateESI(data: {
    chiefComplaint: string;
    vitals?: {
      heartRate?: number;
      respiratoryRate?: number;
      oxygenSaturation?: number;
      bloodPressureSys?: number;
      bloodPressureDia?: number;
      temperature?: number;
    };
    painScale?: number; // 0-10
    mentalStatus?: 'alert' | 'voice' | 'pain' | 'unresponsive';
    age?: number;
    isPregnant?: boolean;
    symptoms?: string[];
  }): {
    esiLevel: number;
    category: string;
    reasoning: string[];
    recommendations: string[];
    estimatedResources: number;
  } {
    const reasoning: string[] = [];
    let esiLevel = 3; // Default to Urgent

    const complaint = (data.chiefComplaint || '').toLowerCase();
    const symptoms = (data.symptoms || []).map(s => s.toLowerCase());
    const allSymptoms = [complaint, ...symptoms].join(' ');

    // ========== STEP 1: Check for ESI Level 1 (Resuscitation) ==========
    // Requires immediate life-saving intervention

    // Check mental status
    if (data.mentalStatus === 'unresponsive') {
      return {
        esiLevel: 1,
        category: 'Resuscitation',
        reasoning: ['Patient is unresponsive - requires immediate life-saving intervention'],
        recommendations: ['Immediate resuscitation', 'Activate trauma/code team', 'Continuous monitoring'],
        estimatedResources: 5,
      };
    }

    // Check for life-threatening conditions
    const level1Keywords = [
      'cardiac arrest', 'not breathing', 'no pulse', 'apnea', 'pulseless',
      'severe respiratory distress', 'anaphylaxis', 'anaphylactic',
      'intubation', 'cpr needed', 'choking', 'airway obstruction'
    ];

    if (level1Keywords.some(kw => allSymptoms.includes(kw))) {
      return {
        esiLevel: 1,
        category: 'Resuscitation',
        reasoning: ['Life-threatening condition detected - requires immediate intervention'],
        recommendations: ['Immediate resuscitation', 'Activate emergency response team', 'Prepare for intubation'],
        estimatedResources: 5,
      };
    }

    // Critical vitals check for Level 1
    if (data.vitals) {
      if (data.vitals.oxygenSaturation && data.vitals.oxygenSaturation < 85) {
        return {
          esiLevel: 1,
          category: 'Resuscitation',
          reasoning: ['Severe hypoxia (SpO2 < 85%) - requires immediate intervention'],
          recommendations: ['Immediate supplemental oxygen', 'Prepare for intubation', 'Continuous monitoring'],
          estimatedResources: 5,
        };
      }
      if (data.vitals.respiratoryRate && (data.vitals.respiratoryRate < 6 || data.vitals.respiratoryRate > 40)) {
        return {
          esiLevel: 1,
          category: 'Resuscitation',
          reasoning: ['Critical respiratory rate - requires immediate intervention'],
          recommendations: ['Immediate respiratory support', 'Prepare for intubation if needed'],
          estimatedResources: 5,
        };
      }
    }

    // ========== STEP 2: Check for ESI Level 2 (Emergent) ==========
    // High risk situation, lethargy, severe pain/distress

    // Mental status changes
    if (data.mentalStatus === 'voice' || data.mentalStatus === 'pain') {
      reasoning.push('Altered mental status (responds to voice/pain only)');
      return {
        esiLevel: 2,
        category: 'Emergent',
        reasoning,
        recommendations: ['Immediate assessment', 'Neurological evaluation', 'Continuous monitoring'],
        estimatedResources: 4,
      };
    }

    // Severe pain
    if (data.painScale && data.painScale >= 8) {
      reasoning.push(`Severe pain (${data.painScale}/10)`);
    }

    // High-risk chief complaints
    const level2Keywords = [
      'chest pain', 'crushing chest', 'heart attack', 'mi', 'myocardial',
      'stroke', 'facial droop', 'sudden weakness', 'slurred speech', 'tpa',
      'severe allergic', 'difficulty breathing', 'respiratory distress',
      'severe bleeding', 'hemorrhage', 'uncontrolled bleeding',
      'overdose', 'poisoning', 'ingestion',
      'altered mental', 'confusion', 'disoriented', 'lethargy',
      'seizure', 'active seizure', 'post-ictal',
      'severe trauma', 'major trauma', 'mvc', 'motor vehicle',
      'stabbing', 'gunshot', 'penetrating injury',
      'suicidal', 'suicide attempt', 'self-harm',
      'severe abdominal', 'rigid abdomen', 'peritonitis',
      'fever in infant', 'neonate fever', 'baby fever',
      'testicular torsion', 'ectopic', 'vaginal bleeding pregnant'
    ];

    if (level2Keywords.some(kw => allSymptoms.includes(kw))) {
      reasoning.push('High-risk presenting complaint identified');
      return {
        esiLevel: 2,
        category: 'Emergent',
        reasoning,
        recommendations: ['Immediate physician evaluation', 'Continuous monitoring', 'Prepare for rapid intervention'],
        estimatedResources: 4,
      };
    }

    // Abnormal vitals for Level 2
    if (data.vitals) {
      const vitals = data.vitals;
      if (vitals.oxygenSaturation && vitals.oxygenSaturation < 90) {
        reasoning.push(`Low oxygen saturation (${vitals.oxygenSaturation}%)`);
        esiLevel = 2;
      }
      if (vitals.bloodPressureSys && vitals.bloodPressureSys < 80) {
        reasoning.push(`Hypotension (SBP ${vitals.bloodPressureSys} mmHg)`);
        esiLevel = 2;
      }
      if (vitals.bloodPressureSys && vitals.bloodPressureSys > 200) {
        reasoning.push(`Hypertensive crisis (SBP ${vitals.bloodPressureSys} mmHg)`);
        esiLevel = 2;
      }
      if (vitals.heartRate && (vitals.heartRate < 40 || vitals.heartRate > 150)) {
        reasoning.push(`Abnormal heart rate (${vitals.heartRate} bpm)`);
        esiLevel = 2;
      }
      if (vitals.temperature && vitals.temperature > 40) {
        reasoning.push(`High fever (${vitals.temperature}°C)`);
        esiLevel = 2;
      }
    }

    // Pregnancy considerations
    if (data.isPregnant && (allSymptoms.includes('bleeding') || allSymptoms.includes('pain'))) {
      reasoning.push('Pregnant patient with concerning symptoms');
      esiLevel = 2;
    }

    if (esiLevel === 2) {
      return {
        esiLevel: 2,
        category: 'Emergent',
        reasoning,
        recommendations: ['Prioritize for physician evaluation', 'Close monitoring', 'Prepare diagnostics'],
        estimatedResources: 4,
      };
    }

    // ========== STEP 3: Estimate Resources for ESI 3-5 ==========
    let estimatedResources = 0;

    // Lab work indicators
    const labKeywords = ['fever', 'infection', 'vomiting', 'diarrhea', 'blood', 'diabetic', 'weakness'];
    if (labKeywords.some(kw => allSymptoms.includes(kw))) {
      estimatedResources++;
      reasoning.push('Will likely need laboratory tests');
    }

    // Imaging indicators
    const imagingKeywords = ['pain', 'fall', 'injury', 'trauma', 'swelling', 'fracture', 'accident', 'back pain', 'headache'];
    if (imagingKeywords.some(kw => allSymptoms.includes(kw))) {
      estimatedResources++;
      reasoning.push('Will likely need imaging (X-ray/CT)');
    }

    // IV/Medications
    const ivKeywords = ['dehydration', 'severe pain', 'vomiting', 'nausea', 'migraine', 'kidney stone'];
    if (ivKeywords.some(kw => allSymptoms.includes(kw))) {
      estimatedResources++;
      reasoning.push('Will likely need IV fluids or medications');
    }

    // Procedures
    const procedureKeywords = ['laceration', 'cut', 'wound', 'foreign body', 'abscess', 'splint'];
    if (procedureKeywords.some(kw => allSymptoms.includes(kw))) {
      estimatedResources++;
      reasoning.push('Will likely need procedure');
    }

    // Specialty consult
    const consultKeywords = ['cardiac', 'heart', 'neuro', 'surgical', 'ortho', 'psych'];
    if (consultKeywords.some(kw => allSymptoms.includes(kw))) {
      estimatedResources++;
      reasoning.push('May need specialty consultation');
    }

    // Determine ESI level based on resources
    if (estimatedResources >= 2) {
      return {
        esiLevel: 3,
        category: 'Urgent',
        reasoning: reasoning.length > 0 ? reasoning : ['Multiple resources anticipated'],
        recommendations: ['Prioritize appropriately', 'Order labs and imaging as indicated'],
        estimatedResources,
      };
    } else if (estimatedResources === 1) {
      return {
        esiLevel: 4,
        category: 'Less Urgent',
        reasoning: reasoning.length > 0 ? reasoning : ['Single resource anticipated'],
        recommendations: ['Standard workup', 'Monitor for changes'],
        estimatedResources,
      };
    }

    // ========== ESI Level 5 (Non-Urgent) ==========
    const nonUrgentKeywords = [
      'cold', 'cough', 'sore throat', 'runny nose', 'congestion',
      'prescription refill', 'medication refill',
      'minor rash', 'mild rash', 'itching',
      'follow up', 'suture removal', 'dressing change',
      'mild pain', 'chronic pain'
    ];

    if (nonUrgentKeywords.some(kw => allSymptoms.includes(kw)) || estimatedResources === 0) {
      return {
        esiLevel: 5,
        category: 'Non-Urgent',
        reasoning: ['No immediate resources needed', 'Could be seen in urgent care or primary care'],
        recommendations: ['May have extended wait time', 'Consider alternative care setting if appropriate'],
        estimatedResources: 0,
      };
    }

    // Default fallback
    return {
      esiLevel: 3,
      category: 'Urgent',
      reasoning: ['Default triage level - requires clinical assessment'],
      recommendations: ['Complete clinical evaluation required'],
      estimatedResources: 2,
    };
  }

  // NEW: Get available ED doctors
  async getAvailableDoctors(hospitalId: string) {
    const doctors = await prisma.doctor.findMany({
      where: {
        department: { hospitalId },
        user: {
          role: 'DOCTOR',
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        specialization: true,
      },
      orderBy: {
        user: {
          firstName: 'asc',
        },
      },
    });

    // Get current patient count per doctor in ED
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const doctorsWithCounts = await Promise.all(
      doctors.map(async (doctor) => {
        const activePatients = await prisma.appointment.count({
          where: {
            doctorId: doctor.id,
            type: 'EMERGENCY',
            status: { in: ['IN_PROGRESS', 'CHECKED_IN'] },
            appointmentDate: { gte: today },
          },
        });

        return {
          id: doctor.id,
          name: `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`,
          specialization: doctor.specialization?.name || 'General',
          activePatients,
          availability: activePatients < 5 ? 'available' : activePatients < 8 ? 'busy' : 'overloaded',
        };
      })
    );

    return doctorsWithCounts;
  }

  // NEW: Get available beds (for admit flow)
  async getAvailableBeds(hospitalId: string) {
    const beds = await prisma.bed.findMany({
      where: {
        hospitalId,
        status: 'AVAILABLE',
      },
      include: {
        ward: {
          select: {
            id: true,
            name: true,
            type: true,
            floor: true,
          },
        },
      },
      orderBy: [
        { ward: { name: 'asc' } },
        { bedNumber: 'asc' },
      ],
    });

    return beds.map((bed) => ({
      id: bed.id,
      bedNumber: bed.bedNumber,
      ward: bed.ward?.name || 'Unknown',
      wardId: bed.wardId,
      wardType: bed.ward?.type || 'GENERAL',
      floor: (bed.ward as any)?.floor ?? 0,
    }));
  }

  // NEW: Enhanced stats with hourly trends
  async getStatsWithTrends(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all ED patients today
    const patients = await prisma.appointment.findMany({
      where: {
        hospitalId,
        type: 'EMERGENCY',
        appointmentDate: { gte: today },
      },
    });

    // Calculate ESI distribution
    const byESI: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    patients.forEach(p => {
      const notes = p.notes ? JSON.parse(p.notes) : {};
      const esi = notes.esiLevel || 3;
      byESI[esi] = (byESI[esi] || 0) + 1;
    });

    const active = patients.filter(p => ['IN_PROGRESS', 'CHECKED_IN'].includes(p.status));
    const completed = patients.filter(p => p.status === 'COMPLETED');

    // Count admissions
    const admitted = await prisma.admission.count({
      where: {
        hospitalId,
        admissionType: 'EMERGENCY',
        admissionDate: { gte: today },
      },
    });

    // Calculate average wait time
    let avgWaitTime = 0;
    if (completed.length > 0) {
      const waitTimes = completed
        .filter(p => p.createdAt && p.updatedAt)
        .map(p => {
          const arrivalTime = p.createdAt.getTime();
          const seenTime = p.updatedAt.getTime();
          return Math.round((seenTime - arrivalTime) / (1000 * 60));
        });
      
      if (waitTimes.length > 0) {
        avgWaitTime = Math.round(
          waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length
        );
      }
    }

    // NEW: Calculate hourly trends (last 12 hours)
    const now = new Date();
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    
    const hourlyData: Array<{ hour: string; count: number }> = [];
    for (let i = 0; i < 12; i++) {
      const hourStart = new Date(twelveHoursAgo.getTime() + i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      
      const count = await prisma.appointment.count({
        where: {
          hospitalId,
          type: 'EMERGENCY',
          createdAt: {
            gte: hourStart,
            lt: hourEnd,
          },
        },
      });
      
      hourlyData.push({
        hour: hourStart.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
        count,
      });
    }

    return {
      inDepartment: active.length,
      treatedToday: completed.length,
      admitted,
      avgWaitTime,
      byESILevel: byESI,
      criticalCount: byESI[1] + byESI[2],
      totalToday: patients.length,
      activePatients: active.length,
      completedToday: completed.length,
      // NEW: Hourly trends
      hourlyTrends: hourlyData,
    };
  }

  // ==================== FEATURE 4: ED BED MANAGEMENT ====================

  // Get all ED beds with current status
  async getEDBeds(hospitalId: string) {
    // Find the Emergency Department
    const edDept = await prisma.department.findFirst({
      where: {
        hospitalId,
        name: { contains: 'Emergency', mode: 'insensitive' },
      },
    });

    if (!edDept) {
      // If no ED department exists, return empty array
      return {
        beds: [],
        occupancyRate: 0,
        availableCount: 0,
        occupiedCount: 0,
        cleaningCount: 0,
      };
    }

    // Get all beds in the ED
    const beds = await prisma.bed.findMany({
      where: {
        hospitalId,
        departmentId: edDept.id,
      },
      include: {
        ward: true,
        admissions: {
          where: {
            status: 'ACTIVE',
          },
          include: {
            patient: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: { bedNumber: 'asc' },
    });

    // For occupied beds, get the current ED patient info
    const bedsWithPatients = await Promise.all(
      beds.map(async (bed) => {
        let currentPatient = null;
        let esiLevel = null;
        let timeOccupied = null;

        if (bed.admissions.length > 0) {
          currentPatient = bed.admissions[0].patient;
          // If admitted, find the originating emergency appointment
          const edAppointment = await prisma.appointment.findFirst({
            where: {
              patientId: bed.admissions[0].patientId,
              type: 'EMERGENCY',
              status: { in: ['IN_PROGRESS', 'COMPLETED'] },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          });

          if (edAppointment?.notes) {
            const notes = JSON.parse(edAppointment.notes);
            esiLevel = notes.esiLevel || null;
          }
          timeOccupied = bed.admissions[0].createdAt;
        } else {
          // Check if there's an ED patient assigned to this bed (via notes field)
          const appointment = await prisma.appointment.findFirst({
            where: {
              hospitalId,
              type: 'EMERGENCY',
              status: { in: ['IN_PROGRESS', 'CHECKED_IN'] },
              notes: {
                contains: bed.id, // Bed assignment stored in notes
              },
            },
            include: {
              patient: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          });

          if (appointment) {
            currentPatient = appointment.patient;
            const notes = JSON.parse(appointment.notes || '{}');
            esiLevel = notes.esiLevel || null;
            timeOccupied = appointment.createdAt;
          }
        }

        return {
          id: bed.id,
          bedNumber: bed.bedNumber,
          bedType: bed.bedType,
          status: bed.status,
          ward: bed.ward?.name,
          currentPatient: currentPatient
            ? {
                firstName: currentPatient.firstName,
                lastName: currentPatient.lastName,
              }
            : null,
          esiLevel,
          timeOccupied,
        };
      })
    );

    // Calculate statistics
    const totalBeds = beds.length;
    const occupiedCount = bedsWithPatients.filter(b => b.status === 'OCCUPIED').length;
    const availableCount = bedsWithPatients.filter(b => b.status === 'AVAILABLE').length;
    const cleaningCount = bedsWithPatients.filter(b => b.status === 'CLEANING').length;
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedCount / totalBeds) * 100) : 0;

    return {
      beds: bedsWithPatients,
      occupancyRate,
      availableCount,
      occupiedCount,
      cleaningCount,
      totalBeds,
    };
  }

  // Assign patient to ED bed
  async assignPatientToBed(appointmentId: string, bedId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundError('Emergency case not found');
    }

    // Update bed status to occupied
    await prisma.bed.update({
      where: { id: bedId },
      data: { status: 'OCCUPIED' },
    });

    // Update appointment notes with bed assignment
    const existingNotes = appointment.notes ? JSON.parse(appointment.notes) : {};
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        notes: JSON.stringify({
          ...existingNotes,
          assignedBedId: bedId,
          bedAssignedAt: new Date(),
        }),
      },
    });

    return { success: true, message: 'Patient assigned to bed' };
  }

  // Update ED bed status
  async updateEDBedStatus(bedId: string, status: string) {
    const bed = await prisma.bed.update({
      where: { id: bedId },
      data: { status: status as any },
    });

    return bed;
  }

  // Get waiting patients (not assigned to bed)
  async getWaitingPatients(hospitalId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await prisma.appointment.findMany({
      where: {
        hospitalId,
        type: 'EMERGENCY',
        status: { in: ['IN_PROGRESS', 'CHECKED_IN'] },
        appointmentDate: { gte: today },
      },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Filter out patients who already have beds
    const waitingPatients = appointments.filter(apt => {
      if (!apt.notes) return true;
      try {
        const notes = JSON.parse(apt.notes);
        return !notes.assignedBedId;
      } catch {
        return true;
      }
    });

    return waitingPatients.map(apt => {
      const notes = apt.notes ? JSON.parse(apt.notes) : {};
      return {
        id: apt.id,
        patient: apt.patient,
        esiLevel: notes.esiLevel || 3,
        chiefComplaint: apt.reason || '',
        arrivalTime: apt.createdAt,
        waitTime: Math.round((Date.now() - apt.createdAt.getTime()) / (1000 * 60)),
      };
    });
  }

  // ==================== FEATURE 6: AMBULANCE INTEGRATION ====================

  // Get incoming ambulances (EN_ROUTE status)
  async getIncomingAmbulances(hospitalId: string) {
    // Find ambulance trips that are en route to this hospital
    const incomingTrips = await prisma.ambulanceTrip.findMany({
      where: {
        hospitalId,
        status: 'EN_ROUTE',
      },
      include: {
        ambulance: {
          select: {
            vehicleNumber: true,
            vehicleType: true,
          },
        },
        pickupLocation: true,
        dropoffLocation: true,
      },
      orderBy: { estimatedArrival: 'asc' },
    });

    return incomingTrips.map(trip => {
      // Calculate ETA in minutes
      let etaMinutes = null;
      if (trip.estimatedArrival) {
        const now = new Date();
        const eta = new Date(trip.estimatedArrival);
        etaMinutes = Math.max(0, Math.round((eta.getTime() - now.getTime()) / (1000 * 60)));
      }

      return {
        id: trip.id,
        ambulanceNumber: trip.ambulance?.vehicleNumber || 'Unknown',
        vehicleType: trip.ambulance?.vehicleType || 'BASIC_LIFE_SUPPORT',
        patientInfo: trip.patientName || 'Unknown',
        chiefComplaint: trip.reason || 'Not specified',
        tripType: trip.tripType,
        estimatedArrival: trip.estimatedArrival,
        etaMinutes,
        pickupLocation: trip.pickupLocation?.address || trip.pickupAddress || 'Unknown',
        status: trip.status,
        vitals: trip.vitals ? JSON.parse(trip.vitals as any) : null,
      };
    });
  }

  // ==================== BLOOD BANK INTEGRATION ====================

  // Get blood bank inventory summary for emergency
  async getBloodBankInventory(hospitalId: string) {
    const inventory = await prisma.bloodComponent.groupBy({
      by: ['bloodGroup', 'rhFactor', 'componentType'],
      where: {
        hospitalId,
        status: 'AVAILABLE',
        expiryDate: { gt: new Date() },
      },
      _count: true,
    });

    // Format inventory by blood type
    const bloodTypes = ['O', 'A', 'B', 'AB'];
    const rhFactors = ['NEGATIVE', 'POSITIVE'];
    
    const inventorySummary = bloodTypes.flatMap(type => 
      rhFactors.map(rh => {
        const items = inventory.filter(
          item => item.bloodGroup === type && item.rhFactor === rh
        );
        
        const totalUnits = items.reduce((sum, item) => sum + item._count, 0);
        const componentBreakdown = items.reduce((acc, item) => {
          acc[item.componentType] = item._count;
          return acc;
        }, {} as Record<string, number>);

        // Determine status level (critical <5, low <10, adequate >=10)
        let statusLevel: 'critical' | 'low' | 'adequate';
        if (totalUnits < 5) statusLevel = 'critical';
        else if (totalUnits < 10) statusLevel = 'low';
        else statusLevel = 'adequate';

        return {
          bloodType: `${type}${rh === 'POSITIVE' ? '+' : '-'}`,
          bloodGroup: type,
          rhFactor: rh,
          totalUnits,
          componentBreakdown,
          statusLevel,
        };
      })
    );

    return inventorySummary;
  }

  // Create emergency blood request
  async createEmergencyBloodRequest(hospitalId: string, data: {
    patientId: string;
    bloodType: string; // e.g., "A+", "O-"
    componentType: string;
    unitsNeeded: number;
    urgency: 'STAT' | 'URGENT' | 'ROUTINE';
    indication: string;
    requestedBy: string;
  }) {
    // Parse blood type (e.g., "A+" -> bloodGroup: "A", rhFactor: "POSITIVE")
    const isNegative = data.bloodType.includes('-');
    const bloodGroup = data.bloodType.replace(/[+-]/, '');
    const rhFactor = isNegative ? 'NEGATIVE' : 'POSITIVE';

    // Get patient info
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      select: {
        firstName: true,
        lastName: true,
        bloodGroup: true,
      },
    });

    if (!patient) throw new NotFoundError('Patient not found');

    const requestNumber = `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    // Map urgency to BloodPriority enum
    let priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY' | 'MASSIVE_TRANSFUSION';
    if (data.urgency === 'STAT') priority = 'EMERGENCY';
    else if (data.urgency === 'URGENT') priority = 'URGENT';
    else priority = 'ROUTINE';

    const request = await prisma.bloodRequest.create({
      data: {
        hospitalId,
        requestNumber,
        patientId: data.patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientBloodGroup: bloodGroup as any,
        patientRhFactor: rhFactor as any,
        componentType: data.componentType as any,
        unitsRequired: data.unitsNeeded,
        priority,
        indication: data.indication,
        requestedBy: data.requestedBy,
        department: 'Emergency',
      },
    });

    return request;
  }

  // Get emergency blood requests (pending or in progress)
  async getEmergencyBloodRequests(hospitalId: string) {
    const requests = await prisma.bloodRequest.findMany({
      where: {
        hospitalId,
        department: 'Emergency',
        status: {
          in: ['PENDING', 'APPROVED', 'PARTIALLY_FULFILLED'],
        },
      },
      orderBy: [
        { priority: 'asc' }, // EMERGENCY first
        { createdAt: 'desc' },
      ],
      take: 50,
    });

    return requests.map(req => ({
      ...req,
      patientBloodType: `${req.patientBloodGroup}${req.patientRhFactor === 'POSITIVE' ? '+' : '-'}`,
    }));
  }

  // Emergency blood release (O- universal donor)
  async emergencyBloodRelease(
    hospitalId: string,
    patientId: string,
    unitsNeeded: number,
    requestedBy: string
  ) {
    // Find available O- blood (universal donor)
    const availableUnits = await prisma.bloodComponent.findMany({
      where: {
        hospitalId,
        bloodGroup: 'O' as any,
        rhFactor: 'NEGATIVE',
        componentType: 'PACKED_RED_CELLS',
        status: 'AVAILABLE',
        expiryDate: { gt: new Date() },
      },
      orderBy: { expiryDate: 'asc' }, // FIFO
      take: unitsNeeded,
    });

    if (availableUnits.length === 0) {
      throw new Error('No O- blood units available for emergency release');
    }

    // Get patient info
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        firstName: true,
        lastName: true,
        bloodGroup: true,
      },
    });

    if (!patient) throw new NotFoundError('Patient not found');

    // Create emergency blood request with auto-approval
    const requestNumber = `REQ-EMER-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    const request = await prisma.bloodRequest.create({
      data: {
        hospitalId,
        requestNumber,
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientBloodGroup: (patient.bloodGroup || 'O_POSITIVE') as any,
        patientRhFactor: 'NEGATIVE',
        componentType: 'PACKED_RED_CELLS',
        unitsRequired: unitsNeeded,
        priority: 'EMERGENCY',
        indication: 'EMERGENCY RELEASE - Life-threatening situation',
        requestedBy,
        department: 'Emergency',
        status: 'APPROVED',
        approvedBy: requestedBy,
        approvedAt: new Date(),
        crossMatchStatus: 'PENDING', // Cross-match to be done later
      },
    });

    // Reserve the units
    await Promise.all(
      availableUnits.map(unit =>
        prisma.bloodComponent.update({
          where: { id: unit.id },
          data: {
            status: 'RESERVED',
            reservedFor: patientId,
            reservedAt: new Date(),
          },
        })
      )
    );

    return {
      request,
      reservedUnits: availableUnits.length,
      units: availableUnits.map(u => ({
        id: u.id,
        componentId: u.componentId,
        bagNumber: u.bagNumber,
        expiryDate: u.expiryDate,
      })),
      warning: 'EMERGENCY RELEASE: Cross-match pending. Monitor patient closely for transfusion reactions.',
    };
  }

  // ==================== ON-CALL DOCTOR SYSTEM ====================

  // Get on-call doctors for Emergency department
  async getOnCallDoctors(hospitalId: string) {
    // Get all doctors from Emergency department or with emergency specialization
    const doctors = await prisma.doctor.findMany({
      where: {
        OR: [
          {
            department: {
              hospitalId,
              name: { contains: 'Emergency', mode: 'insensitive' },
            },
          },
          {
            specialization: { contains: 'Emergency', mode: 'insensitive' },
          },
        ],
        isAvailable: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
        department: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        user: { firstName: 'asc' },
      },
    });

    // Calculate response time stats for each doctor (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const doctorsWithStats = await Promise.all(
      doctors.map(async (doctor) => {
        // Get recent pages for this doctor
        const recentPages = await prisma.emergencyPage.findMany({
          where: {
            doctorId: doctor.id,
            createdAt: { gte: thirtyDaysAgo },
            status: { in: ['ACKNOWLEDGED', 'EN_ROUTE', 'ARRIVED'] },
            responseTime: { not: null },
          },
          select: {
            createdAt: true,
            responseTime: true,
          },
        });

        // Calculate average response time in minutes
        let avgResponseTime = null;
        if (recentPages.length > 0) {
          const totalResponseTime = recentPages.reduce((sum, page) => {
            const responseMs =
              page.responseTime!.getTime() - page.createdAt.getTime();
            return sum + responseMs;
          }, 0);
          avgResponseTime = Math.round(
            totalResponseTime / recentPages.length / (1000 * 60)
          ); // Convert to minutes
        }

        // Determine current status (simplified - could be enhanced with real-time tracking)
        // For now, check if doctor has any active pages
        const activePages = await prisma.emergencyPage.count({
          where: {
            doctorId: doctor.id,
            status: { in: ['EN_ROUTE', 'ACKNOWLEDGED'] },
          },
        });

        let status: 'AVAILABLE' | 'RESPONDING' | 'IN_SURGERY' | 'ON_BREAK' = 'AVAILABLE';
        if (activePages > 0) {
          status = 'RESPONDING';
        }

        return {
          id: doctor.id,
          user: doctor.user,
          department: doctor.department.name,
          specialization: doctor.specialization,
          experience: doctor.experience,
          status,
          avgResponseTime,
          totalPages: recentPages.length,
        };
      })
    );

    return doctorsWithStats;
  }

  // Page a doctor
  async pageDoctor(
    hospitalId: string,
    data: {
      doctorId: string;
      patientId?: string;
      urgency: 'STAT' | 'URGENT' | 'ROUTINE';
      message: string;
      pagedBy: string;
    }
  ) {
    const page = await prisma.emergencyPage.create({
      data: {
        hospitalId,
        doctorId: data.doctorId,
        patientId: data.patientId,
        urgency: data.urgency,
        message: data.message,
        pagedBy: data.pagedBy,
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
        pagedByUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // TODO: Send notification to doctor (SMS, push notification, etc.)
    // For now, we just create the page record

    return page;
  }

  // Get recent pages
  async getPages(hospitalId: string) {
    const pages = await prisma.emergencyPage.findMany({
      where: {
        hospitalId,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        patient: {
          select: {
            firstName: true,
            lastName: true,
            mrn: true,
          },
        },
        pagedByUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [
        { urgency: 'asc' }, // STAT first
        { createdAt: 'desc' },
      ],
    });

    return pages.map((page) => {
      // Calculate elapsed time since page was sent
      const elapsedMinutes = Math.floor(
        (Date.now() - page.createdAt.getTime()) / (1000 * 60)
      );

      // Calculate response time if responded
      let responseMinutes = null;
      if (page.responseTime) {
        responseMinutes = Math.floor(
          (page.responseTime.getTime() - page.createdAt.getTime()) / (1000 * 60)
        );
      }

      return {
        ...page,
        doctorName: `${page.doctor.user.firstName} ${page.doctor.user.lastName}`,
        patientName: page.patient
          ? `${page.patient.firstName} ${page.patient.lastName}`
          : null,
        pagedByName: `${page.pagedByUser.firstName} ${page.pagedByUser.lastName}`,
        elapsedMinutes,
        responseMinutes,
      };
    });
  }

  // Respond to page (doctor endpoint)
  async respondToPage(
    pageId: string,
    doctorUserId: string,
    status: 'ACKNOWLEDGED' | 'EN_ROUTE' | 'ARRIVED' | 'DECLINED',
    declineReason?: string
  ) {
    // Verify the doctor is responding to their own page
    const page = await prisma.emergencyPage.findUnique({
      where: { id: pageId },
      include: {
        doctor: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!page) throw new NotFoundError('Page not found');
    if (page.doctor.userId !== doctorUserId) {
      throw new Error('Unauthorized: You can only respond to your own pages');
    }

    const updateData: any = {
      status,
    };

    if (status === 'ACKNOWLEDGED' && !page.responseTime) {
      updateData.responseTime = new Date();
    } else if (status === 'EN_ROUTE' && !page.responseTime) {
      updateData.responseTime = new Date();
    } else if (status === 'ARRIVED') {
      updateData.arrivedAt = new Date();
      if (!page.responseTime) {
        updateData.responseTime = new Date();
      }
    } else if (status === 'DECLINED') {
      updateData.declineReason = declineReason || 'No reason provided';
      updateData.responseTime = new Date();
    }

    return prisma.emergencyPage.update({
      where: { id: pageId },
      data: updateData,
    });
  }
}

export const emergencyService = new EmergencyService();
