import prisma from '../config/database';
import axios from 'axios';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Symptom to department mapping for quick suggestions
const symptomDepartmentMap: Record<string, string[]> = {
  // Cardiology
  'chest pain': ['cardiology'],
  'heart': ['cardiology'],
  'palpitations': ['cardiology'],
  'shortness of breath': ['cardiology', 'general'],
  'high blood pressure': ['cardiology'],
  'hypertension': ['cardiology'],

  // Neurology
  'headache': ['neurology', 'general'],
  'migraine': ['neurology'],
  'dizziness': ['neurology', 'ent'],
  'seizure': ['neurology'],
  'numbness': ['neurology'],
  'memory': ['neurology'],

  // Orthopedics
  'bone': ['orthopedics'],
  'joint': ['orthopedics'],
  'back pain': ['orthopedics'],
  'knee': ['orthopedics'],
  'fracture': ['orthopedics', 'emergency'],
  'spine': ['orthopedics'],
  'arthritis': ['orthopedics'],

  // Pediatrics
  'child': ['pediatrics'],
  'baby': ['pediatrics'],
  'infant': ['pediatrics'],
  'kid': ['pediatrics'],

  // Dermatology
  'skin': ['dermatology'],
  'rash': ['dermatology'],
  'acne': ['dermatology'],
  'eczema': ['dermatology'],
  'itching': ['dermatology'],

  // ENT
  'ear': ['ent'],
  'nose': ['ent'],
  'throat': ['ent'],
  'sinus': ['ent'],
  'hearing': ['ent'],
  'tonsil': ['ent'],

  // Ophthalmology
  'eye': ['ophthalmology'],
  'vision': ['ophthalmology'],
  'glasses': ['ophthalmology'],
  'cataract': ['ophthalmology'],

  // Emergency
  'accident': ['emergency'],
  'injury': ['emergency'],
  'bleeding': ['emergency'],
  'unconscious': ['emergency'],
  'trauma': ['emergency'],

  // General
  'fever': ['general'],
  'cold': ['general', 'ent'],
  'cough': ['general'],
  'flu': ['general'],
  'fatigue': ['general'],
  'checkup': ['general'],
  'routine': ['general'],
};

// Time parsing patterns
const timePatterns = [
  { pattern: /(\d{1,2})\s*(am|pm)/i, format: '12h' },
  { pattern: /(\d{1,2}):(\d{2})\s*(am|pm)/i, format: '12h-full' },
  { pattern: /(\d{1,2}):(\d{2})/i, format: '24h' },
  { pattern: /morning/i, time: '09:00 AM' },
  { pattern: /afternoon/i, time: '02:00 PM' },
  { pattern: /evening/i, time: '04:00 PM' },
];

// Date parsing patterns
const datePatterns = [
  { pattern: /today/i, offset: 0 },
  { pattern: /tomorrow/i, offset: 1 },
  { pattern: /day after tomorrow/i, offset: 2 },
  { pattern: /next week/i, offset: 7 },
  { pattern: /(\d{1,2})[\/\-](\d{1,2})[\/\-]?(\d{2,4})?/i, format: 'date' },
  { pattern: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, format: 'weekday' },
];

export interface ParsedBookingIntent {
  hasBookingIntent: boolean;
  patientName?: string;
  symptoms: string[];
  suggestedDepartments: string[];
  preferredDate?: string;
  preferredTime?: string;
  urgency: 'routine' | 'soon' | 'urgent' | 'emergency';
  confidence: number;
  rawText: string;
  suggestions: string[];
}

export interface SymptomAnalysis {
  symptoms: string[];
  suggestedDepartment: string;
  alternativeDepartments: string[];
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  confidence: number;
}

export class AIBookingService {
  /**
   * Parse natural language text to extract booking intent
   */
  async parseBookingIntent(text: string): Promise<ParsedBookingIntent> {
    const lowerText = text.toLowerCase();

    // Check for booking intent keywords
    const bookingKeywords = ['book', 'appointment', 'schedule', 'see a doctor', 'visit', 'consult', 'need to see'];
    const hasBookingIntent = bookingKeywords.some(keyword => lowerText.includes(keyword));

    // Extract symptoms
    const symptoms: string[] = [];
    const suggestedDepts = new Set<string>();

    for (const [symptom, depts] of Object.entries(symptomDepartmentMap)) {
      if (lowerText.includes(symptom)) {
        symptoms.push(symptom);
        depts.forEach(d => suggestedDepts.add(d));
      }
    }

    // Parse date
    let preferredDate: string | undefined;
    for (const datePattern of datePatterns) {
      if (datePattern.offset !== undefined) {
        if (datePattern.pattern.test(lowerText)) {
          const date = new Date();
          date.setDate(date.getDate() + datePattern.offset);
          preferredDate = date.toISOString().split('T')[0];
          break;
        }
      } else if (datePattern.format === 'weekday') {
        const match = lowerText.match(datePattern.pattern);
        if (match) {
          const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const targetDay = weekdays.indexOf(match[1].toLowerCase());
          const today = new Date();
          const currentDay = today.getDay();
          let daysUntil = targetDay - currentDay;
          if (daysUntil <= 0) daysUntil += 7;
          today.setDate(today.getDate() + daysUntil);
          preferredDate = today.toISOString().split('T')[0];
          break;
        }
      }
    }

    // Parse time
    let preferredTime: string | undefined;
    for (const timePattern of timePatterns) {
      if (timePattern.time) {
        if (timePattern.pattern.test(lowerText)) {
          preferredTime = timePattern.time;
          break;
        }
      } else {
        const match = lowerText.match(timePattern.pattern);
        if (match) {
          if (timePattern.format === '12h') {
            const hour = parseInt(match[1]);
            const ampm = match[2].toUpperCase();
            preferredTime = `${hour.toString().padStart(2, '0')}:00 ${ampm}`;
          } else if (timePattern.format === '12h-full') {
            const hour = parseInt(match[1]);
            const min = match[2];
            const ampm = match[3].toUpperCase();
            preferredTime = `${hour.toString().padStart(2, '0')}:${min} ${ampm}`;
          }
          break;
        }
      }
    }

    // Determine urgency
    let urgency: 'routine' | 'soon' | 'urgent' | 'emergency' = 'routine';
    const urgentKeywords = ['urgent', 'asap', 'immediately', 'emergency', 'severe', 'acute'];
    const soonKeywords = ['soon', 'quickly', 'today', 'this week'];

    if (urgentKeywords.some(k => lowerText.includes(k))) {
      urgency = 'emergency';
    } else if (soonKeywords.some(k => lowerText.includes(k))) {
      urgency = 'soon';
    }

    // Generate suggestions
    const suggestions: string[] = [];
    if (!preferredDate) {
      suggestions.push('Please specify when you\'d like to schedule (e.g., "tomorrow" or "next Monday")');
    }
    if (!preferredTime) {
      suggestions.push('Please specify your preferred time (e.g., "10am" or "afternoon")');
    }
    if (suggestedDepts.size === 0) {
      suggestions.push('Please describe your symptoms so I can suggest the right department');
    }

    // Calculate confidence
    let confidence = 0.5;
    if (hasBookingIntent) confidence += 0.2;
    if (symptoms.length > 0) confidence += 0.15;
    if (preferredDate) confidence += 0.1;
    if (preferredTime) confidence += 0.05;

    return {
      hasBookingIntent,
      symptoms,
      suggestedDepartments: Array.from(suggestedDepts),
      preferredDate,
      preferredTime,
      urgency,
      confidence: Math.min(confidence, 1),
      rawText: text,
      suggestions,
    };
  }

  /**
   * Analyze symptoms and suggest appropriate department
   */
  async analyzeSymptoms(symptoms: string | string[]): Promise<SymptomAnalysis> {
    // Handle both string and array inputs
    const symptomArray = Array.isArray(symptoms) ? symptoms : [symptoms];
    const symptomText = symptomArray.join(' ').toLowerCase();
    const departmentScores: Record<string, number> = {};

    // Score departments based on symptoms
    for (const [symptom, depts] of Object.entries(symptomDepartmentMap)) {
      if (symptomText.includes(symptom)) {
        depts.forEach((dept, index) => {
          departmentScores[dept] = (departmentScores[dept] || 0) + (1 / (index + 1));
        });
      }
    }

    // Sort departments by score
    const sortedDepts = Object.entries(departmentScores)
      .sort(([, a], [, b]) => b - a)
      .map(([dept]) => dept);

    // Default to general if no match
    if (sortedDepts.length === 0) {
      sortedDepts.push('general');
    }

    // Determine urgency
    const emergencySymptoms = ['chest pain', 'unconscious', 'bleeding', 'accident', 'trauma', 'seizure'];
    const highUrgencySymptoms = ['severe', 'acute', 'high fever', 'difficulty breathing'];

    let urgencyLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (emergencySymptoms.some(s => symptomText.includes(s))) {
      urgencyLevel = 'critical';
    } else if (highUrgencySymptoms.some(s => symptomText.includes(s))) {
      urgencyLevel = 'high';
    } else if (symptoms.length > 2) {
      urgencyLevel = 'medium';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (urgencyLevel === 'critical') {
      recommendations.push('⚠️ Your symptoms may require immediate attention. Consider visiting the Emergency department.');
    }
    if (sortedDepts[0] === 'general' && symptoms.length > 0) {
      recommendations.push('A general physician can evaluate your symptoms and refer you to a specialist if needed.');
    }

    return {
      symptoms,
      suggestedDepartment: sortedDepts[0],
      alternativeDepartments: sortedDepts.slice(1, 3),
      urgencyLevel,
      recommendations,
      confidence: sortedDepts.length > 0 ? 0.8 : 0.5,
    };
  }

  /**
   * Generate AI response for booking assistant chat
   */
  async generateBookingResponse(
    userMessage: string,
    context: {
      currentForm?: Record<string, string>;
      previousMessages?: string[];
    }
  ): Promise<{
    message: string;
    formUpdates?: Record<string, string>;
    action?: 'fill_form' | 'suggest_department' | 'confirm_booking' | 'ask_clarification';
    parsedIntent?: ParsedBookingIntent;
  }> {
    // Parse the user's intent
    const parsedIntent = await this.parseBookingIntent(userMessage);

    let message = '';
    let formUpdates: Record<string, string> = {};
    let action: 'fill_form' | 'suggest_department' | 'confirm_booking' | 'ask_clarification' = 'ask_clarification';

    if (parsedIntent.hasBookingIntent || parsedIntent.symptoms.length > 0) {
      // User wants to book an appointment
      if (parsedIntent.symptoms.length > 0) {
        const analysis = await this.analyzeSymptoms(parsedIntent.symptoms);

        // Map department name to ID
        const deptMapping: Record<string, string> = {
          'general': 'general',
          'cardiology': 'cardiology',
          'orthopedics': 'orthopedics',
          'pediatrics': 'pediatrics',
          'neurology': 'neurology',
          'dermatology': 'dermatology',
          'ophthalmology': 'ophthalmology',
          'ent': 'ent',
          'emergency': 'emergency',
        };

        formUpdates.department = deptMapping[analysis.suggestedDepartment] || 'general';
        formUpdates.reason = parsedIntent.symptoms.join(', ');

        if (parsedIntent.preferredDate) {
          formUpdates.preferredDate = parsedIntent.preferredDate;
        }
        if (parsedIntent.preferredTime) {
          formUpdates.preferredTime = parsedIntent.preferredTime;
        }

        message = `Based on your symptoms (${parsedIntent.symptoms.join(', ')}), I recommend the **${analysis.suggestedDepartment.charAt(0).toUpperCase() + analysis.suggestedDepartment.slice(1)}** department.`;

        if (analysis.alternativeDepartments.length > 0) {
          message += ` Alternatively, you could also consider: ${analysis.alternativeDepartments.join(', ')}.`;
        }

        if (analysis.urgencyLevel === 'critical') {
          message += '\n\n⚠️ **Warning**: Your symptoms may require immediate attention. Please consider visiting the Emergency department or calling emergency services.';
        }

        if (parsedIntent.preferredDate && parsedIntent.preferredTime) {
          message += `\n\nI've set your appointment for **${parsedIntent.preferredDate}** at **${parsedIntent.preferredTime}**.`;
          action = 'confirm_booking';
        } else {
          message += '\n\nPlease select your preferred date and time to complete the booking.';
          action = 'fill_form';
        }
      } else {
        message = "I'd be happy to help you book an appointment! Could you please describe your symptoms or the reason for your visit? This will help me suggest the right department for you.";
        action = 'ask_clarification';
      }
    } else {
      // General query or greeting
      const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
      const isGreeting = greetings.some(g => userMessage.toLowerCase().includes(g));

      if (isGreeting) {
        message = "Hello! 👋 I'm your AI booking assistant. I can help you:\n\n• Book an appointment\n• Suggest the right department based on your symptoms\n• Find available time slots\n\nJust tell me what's troubling you or say something like \"I need to see a doctor for headache tomorrow at 10am\"";
      } else {
        message = "I'm here to help you book an appointment. Could you please tell me:\n\n1. What symptoms are you experiencing?\n2. When would you like to schedule your appointment?\n\nFor example: \"I have a headache and want to see a doctor tomorrow morning\"";
      }
    }

    return {
      message,
      formUpdates: Object.keys(formUpdates).length > 0 ? formUpdates : undefined,
      action,
      parsedIntent,
    };
  }

  /**
   * Try to get enhanced analysis from the AI service if available
   */
  async getEnhancedSymptomAnalysis(symptoms: string[]): Promise<SymptomAnalysis | null> {
    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/booking/analyze-symptoms`, {
        symptoms,
      }, { timeout: 5000 });

      return response.data;
    } catch (error) {
      // Fall back to local analysis if AI service is unavailable
      return null;
    }
  }

  /**
   * Get available departments with AI-enhanced descriptions
   */
  async getDepartmentsWithDescriptions() {
    const hospital = await prisma.hospital.findFirst({
      where: { isActive: true },
    });

    if (!hospital) return [];

    const departments = await prisma.department.findMany({
      where: {
        hospitalId: hospital.id,
        isActive: true,
      },
      include: {
        _count: {
          select: { doctors: true },
        },
      },
    });

    return departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      description: dept.description,
      doctorCount: dept._count.doctors,
      keywords: this.getDepartmentKeywords(dept.name),
    }));
  }

  private getDepartmentKeywords(deptName: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'General Medicine': ['fever', 'cold', 'flu', 'checkup', 'fatigue', 'general'],
      'Cardiology': ['heart', 'chest pain', 'blood pressure', 'palpitations'],
      'Orthopedics': ['bone', 'joint', 'back pain', 'fracture', 'spine'],
      'Pediatrics': ['child', 'baby', 'infant', 'vaccination'],
      'Neurology': ['headache', 'migraine', 'dizziness', 'seizure', 'memory'],
      'Dermatology': ['skin', 'rash', 'acne', 'eczema', 'hair'],
      'Ophthalmology': ['eye', 'vision', 'glasses', 'cataract'],
      'ENT': ['ear', 'nose', 'throat', 'sinus', 'hearing'],
      'Emergency': ['accident', 'injury', 'bleeding', 'emergency'],
      'Surgery': ['surgery', 'operation', 'procedure'],
      'Radiology': ['xray', 'scan', 'mri', 'ct'],
    };

    return keywordMap[deptName] || [];
  }
}

export const aiBookingService = new AIBookingService();
