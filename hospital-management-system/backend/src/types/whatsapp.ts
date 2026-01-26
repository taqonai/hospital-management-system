// WhatsApp Bot Type Definitions

export interface WhatsAppMessage {
  from: string; // Phone number in E.164 format (e.g., whatsapp:+971501234567)
  body: string; // Message text
  mediaUrl?: string; // URL to voice message or media
  mediaContentType?: string; // MIME type of media
  messageId: string; // Unique message ID from Twilio
}

export interface WhatsAppSessionData {
  phoneNumber: string;
  hospitalId?: string;
  hospitalName?: string;
  patientId?: string;
  patientName?: string;
  currentStep: ConversationStep;
  collectedData: CollectedPatientData;
  symptomCheckSessionId?: string;
  lastMessageTimestamp: number;
}

export enum ConversationStep {
  GREETING = 'GREETING',
  ASK_REGISTRATION = 'ASK_REGISTRATION',
  ASK_EMIRATE = 'ASK_EMIRATE',
  ASK_HOSPITAL = 'ASK_HOSPITAL',
  COLLECT_NAME = 'COLLECT_NAME',
  COLLECT_DOB = 'COLLECT_DOB',
  COLLECT_GENDER = 'COLLECT_GENDER',
  VERIFY_OTP = 'VERIFY_OTP',
  EXISTING_PATIENT_LOGIN = 'EXISTING_PATIENT_LOGIN',
  EXISTING_PATIENT_VERIFY_OTP = 'EXISTING_PATIENT_VERIFY_OTP',
  MAIN_MENU = 'MAIN_MENU',
  SYMPTOM_CHECK_START = 'SYMPTOM_CHECK_START',
  SYMPTOM_CHECK_VOICE_CONFIRM = 'SYMPTOM_CHECK_VOICE_CONFIRM',
  SYMPTOM_CHECK_QUESTIONS = 'SYMPTOM_CHECK_QUESTIONS',
  SYMPTOM_CHECK_COMPLETE = 'SYMPTOM_CHECK_COMPLETE',
  ASK_DOCTOR_PREFERENCE = 'ASK_DOCTOR_PREFERENCE',
  SELECT_DOCTOR = 'SELECT_DOCTOR',
  SELECT_SLOT = 'SELECT_SLOT',
  CONFIRM_BOOKING = 'CONFIRM_BOOKING',
  BOOKING_COMPLETE = 'BOOKING_COMPLETE',
  VIEW_APPOINTMENTS = 'VIEW_APPOINTMENTS',
  CANCEL_APPOINTMENT_SELECT = 'CANCEL_APPOINTMENT_SELECT',
  CANCEL_APPOINTMENT_CONFIRM = 'CANCEL_APPOINTMENT_CONFIRM'
}

export interface CollectedPatientData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  emirate?: string;
  hospitalId?: string;
  hospitalName?: string;
  patientId?: string;
  otpCode?: string;
  lastTranscript?: string;
  reasonForVisit?: string;
  symptoms?: string;
  departmentId?: string;
  departmentName?: string;
  doctorId?: string;
  doctorName?: string;
  selectedSlot?: {
    date: string;
    startTime: string;
    endTime: string;
  };
  appointmentId?: string;
  triageResult?: {
    recommendedDepartment: string;
    urgency: string;
    summary: string;
  };
}

export interface TwilioWebhookPayload {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

export interface WhatsAppQuickReply {
  type: 'button';
  button: {
    id: string;
    title: string;
  };
}

export interface WhatsAppListMessage {
  type: 'list';
  header?: {
    type: 'text';
    text: string;
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: {
    button: string;
    sections: Array<{
      title: string;
      rows: Array<{
        id: string;
        title: string;
        description?: string;
      }>;
    }>;
  };
}

// UAE Emirates for hospital selection
export const UAE_EMIRATES = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Umm Al Quwain',
  'Fujairah'
];
