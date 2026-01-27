import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import whatsappSessionService from './whatsappSessionService';
import whatsappService from './whatsappService';
import {
  WhatsAppMessage,
  WhatsAppSessionData,
  ConversationStep,
  UAE_EMIRATES
} from '../types/whatsapp';

const prisma = new PrismaClient();

export class WhatsAppBotService {
  private aiServiceUrl: string;
  private defaultHospitalId: string;

  constructor() {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    // Default hospital ID for WhatsApp bot (hospital-specific number)
    this.defaultHospitalId = process.env.DEFAULT_HOSPITAL_ID || '';
  }

  /**
   * Get default hospital for WhatsApp bot
   * If no default hospital ID is set, get the first active hospital
   */
  private async getDefaultHospital() {
    if (this.defaultHospitalId) {
      const hospital = await prisma.hospital.findUnique({
        where: { id: this.defaultHospitalId, isActive: true }
      });
      if (hospital) return hospital;
    }

    // Fallback: get first active hospital
    const hospital = await prisma.hospital.findFirst({
      where: { isActive: true }
    });

    if (!hospital) {
      throw new Error('No active hospital found for WhatsApp bot');
    }

    return hospital;
  }

  /**
   * Main entry point for handling incoming WhatsApp messages
   */
  async handleIncomingMessage(message: WhatsAppMessage): Promise<void> {
    try {
      // Get or create session
      let session = await whatsappSessionService.getOrCreateSession(message.from);

      // Handle voice message if present
      if (message.mediaUrl && message.mediaContentType?.startsWith('audio/')) {
        await this.processVoiceMessage(session, message.from, message.mediaUrl);
        return;
      }

      // Process text message
      await this.processTextMessage(session, message.from, message.body);
    } catch (error) {
      console.error('Error handling WhatsApp message:', error);
      await this.sendErrorMessage(message.from);
    }
  }

  /**
   * Process voice message using Whisper transcription
   */
  private async processVoiceMessage(
    session: WhatsAppSessionData,
    phoneNumber: string,
    audioUrl: string
  ): Promise<void> {
    try {
      // Download audio file
      const audioResponse = await axios.get(audioUrl, {
        responseType: 'arraybuffer',
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID!,
          password: process.env.TWILIO_AUTH_TOKEN!
        }
      });

      // Send to AI transcription service
      const formData = new FormData();
      const audioBlob = new Blob([audioResponse.data], { type: 'audio/ogg' });
      formData.append('file', audioBlob, 'voice.ogg');

      const transcriptionResponse = await axios.post(
        `${this.aiServiceUrl}/api/v1/ai/transcribe`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const transcript = transcriptionResponse.data.transcription;

      // Save transcript and ask for confirmation
      await whatsappSessionService.updateSessionState(
        phoneNumber,
        ConversationStep.SYMPTOM_CHECK_VOICE_CONFIRM,
        {
          lastTranscript: transcript
        }
      );

      await this.sendWhatsAppMessage(
        phoneNumber,
        `I heard: "${transcript}"\n\nIs that correct?\n\n1. Yes\n2. No, let me retype`
      );
    } catch (error) {
      console.error('Error processing voice message:', error);
      await this.sendWhatsAppMessage(
        phoneNumber,
        "Sorry, I couldn't process that voice message. Please try typing your message instead."
      );
    }
  }

  /**
   * Process text message based on conversation state
   */
  private async processTextMessage(
    session: WhatsAppSessionData,
    phoneNumber: string,
    text: string
  ): Promise<void> {
    const normalizedText = text.trim().toLowerCase();

    switch (session.currentStep) {
      case ConversationStep.GREETING:
        await this.handleGreeting(phoneNumber);
        break;

      case ConversationStep.ASK_REGISTRATION:
        await this.handleRegistrationChoice(phoneNumber, normalizedText);
        break;

      case ConversationStep.ASK_EMIRATE:
        await this.handleEmirateSelection(phoneNumber, text);
        break;

      case ConversationStep.ASK_HOSPITAL:
        await this.handleHospitalSelection(phoneNumber, text);
        break;

      case ConversationStep.COLLECT_NAME:
        await this.handleNameCollection(phoneNumber, text);
        break;

      case ConversationStep.COLLECT_DOB:
        await this.handleDOBCollection(phoneNumber, text);
        break;

      case ConversationStep.COLLECT_GENDER:
        await this.handleGenderCollection(phoneNumber, normalizedText);
        break;

      case ConversationStep.VERIFY_OTP:
        await this.handleOTPVerification(phoneNumber, text);
        break;

      case ConversationStep.EXISTING_PATIENT_LOGIN:
        await this.handleExistingPatientLogin(phoneNumber, text);
        break;

      case ConversationStep.EXISTING_PATIENT_VERIFY_OTP:
        await this.handleExistingPatientOTP(phoneNumber, text);
        break;

      case ConversationStep.MAIN_MENU:
        await this.handleMainMenu(phoneNumber, normalizedText);
        break;

      case ConversationStep.SYMPTOM_CHECK_START:
        await this.handleSymptomCheckStart(phoneNumber, text);
        break;

      case ConversationStep.SYMPTOM_CHECK_VOICE_CONFIRM:
        await this.handleVoiceConfirmation(phoneNumber, normalizedText);
        break;

      case ConversationStep.SYMPTOM_CHECK_QUESTIONS:
        await this.handleSymptomCheckQuestions(phoneNumber, text);
        break;

      case ConversationStep.ASK_DOCTOR_PREFERENCE:
        await this.handleDoctorPreference(phoneNumber, text);
        break;

      case ConversationStep.SELECT_DOCTOR:
        await this.handleDoctorSelection(phoneNumber, text);
        break;

      case ConversationStep.SELECT_SLOT:
        await this.handleSlotSelection(phoneNumber, text);
        break;

      case ConversationStep.CONFIRM_BOOKING:
        await this.handleBookingConfirmation(phoneNumber, normalizedText);
        break;

      case ConversationStep.VIEW_APPOINTMENTS:
        await this.handleViewAppointments(phoneNumber, normalizedText);
        break;

      default:
        await this.sendWhatsAppMessage(
          phoneNumber,
          "I'm not sure how to help with that. Type 'menu' to see available options."
        );
    }
  }

  /**
   * Handle initial greeting
   */
  private async handleGreeting(phoneNumber: string): Promise<void> {
    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.ASK_REGISTRATION,
      {}
    );

    await this.sendWhatsAppMessage(
      phoneNumber,
      `👋 Welcome to Spetaar HMS! I'm your AI health assistant.\n\nAre you a new patient or do you already have an account?\n\n1. New Patient\n2. Existing Patient`
    );
  }

  /**
   * Handle registration choice
   */
  private async handleRegistrationChoice(phoneNumber: string, choice: string): Promise<void> {
    if (choice === '1' || choice.includes('new')) {
      // New patient - skip emirate/hospital selection, go directly to name collection
      try {
        const hospital = await this.getDefaultHospital();

        await whatsappSessionService.updateSessionState(
          phoneNumber,
          ConversationStep.COLLECT_NAME,
          {
            hospitalId: hospital.id,
            hospitalName: hospital.name
          },
          {
            hospitalId: hospital.id,
            hospitalName: hospital.name
          }
        );

        await this.sendWhatsAppMessage(
          phoneNumber,
          `Great! To register, I'll need some information.\n\nWhat is your full name? (First and Last Name)`
        );
      } catch (error) {
        console.error('Error getting default hospital:', error);
        await this.sendWhatsAppMessage(
          phoneNumber,
          `Sorry, there was an error. Please try again later.`
        );
      }
    } else if (choice === '2' || choice.includes('existing')) {
      // Existing patient - ask for phone verification
      await whatsappSessionService.updateSessionState(
        phoneNumber,
        ConversationStep.EXISTING_PATIENT_LOGIN,
        {}
      );

      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please share your registered phone number, or reply 'this number' if it's the same.`
      );
    } else {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please reply with '1' for New Patient or '2' for Existing Patient.`
      );
    }
  }

  /**
   * Handle emirate selection
   */
  private async handleEmirateSelection(phoneNumber: string, text: string): Promise<void> {
    let selectedEmirate: string | undefined;

    // Check if number or text
    const choiceNum = parseInt(text.trim());
    if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= UAE_EMIRATES.length) {
      selectedEmirate = UAE_EMIRATES[choiceNum - 1];
    } else {
      // Try to match emirate name
      selectedEmirate = UAE_EMIRATES.find(e =>
        e.toLowerCase() === text.toLowerCase() ||
        text.toLowerCase().includes(e.toLowerCase())
      );
    }

    if (!selectedEmirate) {
      const emiratesButtons = UAE_EMIRATES.map((emirate, index) =>
        `${index + 1}. ${emirate}`
      ).join('\n');

      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please select a valid emirate:\n\n${emiratesButtons}`
      );
      return;
    }

    // Fetch hospitals in selected emirate
    const hospitals = await prisma.hospital.findMany({
      where: {
        city: selectedEmirate,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        address: true
      },
      take: 20
    });

    if (hospitals.length === 0) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Sorry, no hospitals found in ${selectedEmirate}. Please try another emirate.`
      );
      return;
    }

    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.ASK_HOSPITAL,
      { emirate: selectedEmirate }
    );

    // Send hospital list
    const hospitalList = hospitals.map((h, index) =>
      `${index + 1}. ${h.name}\n   ${h.address}`
    ).join('\n\n');

    await this.sendWhatsAppMessage(
      phoneNumber,
      `🏥 Please select a hospital in ${selectedEmirate}:\n\n${hospitalList}\n\nReply with the number of your choice.`
    );
  }

  /**
   * Handle hospital selection
   */
  private async handleHospitalSelection(phoneNumber: string, text: string): Promise<void> {
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session) return;

    const emirate = session.collectedData.emirate;
    if (!emirate) return;

    const hospitals = await prisma.hospital.findMany({
      where: {
        city: emirate,
        isActive: true
      },
      take: 20
    });

    const choiceNum = parseInt(text.trim());
    if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > hospitals.length) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please reply with a valid number (1-${hospitals.length}).`
      );
      return;
    }

    const selectedHospital = hospitals[choiceNum - 1];

    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.COLLECT_NAME,
      {
        hospitalId: selectedHospital.id,
        hospitalName: selectedHospital.name
      },
      {
        hospitalId: selectedHospital.id,
        hospitalName: selectedHospital.name
      }
    );

    await this.sendWhatsAppMessage(
      phoneNumber,
      `Perfect! You've selected ${selectedHospital.name}.\n\nTo register, I'll need some information.\n\nWhat is your full name? (First and Last Name)`
    );
  }

  /**
   * Handle name collection
   */
  private async handleNameCollection(phoneNumber: string, text: string): Promise<void> {
    const nameParts = text.trim().split(/\s+/);

    if (nameParts.length < 2) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please provide both your first and last name.`
      );
      return;
    }

    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.COLLECT_DOB,
      {
        firstName,
        lastName
      }
    );

    await this.sendWhatsAppMessage(
      phoneNumber,
      `Thank you, ${firstName}! What is your date of birth? (DD/MM/YYYY)`
    );
  }

  /**
   * Handle DOB collection
   */
  private async handleDOBCollection(phoneNumber: string, text: string): Promise<void> {
    // Validate date format
    const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = text.trim().match(dateRegex);

    if (!match) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please enter your date of birth in DD/MM/YYYY format (e.g., 15/03/1990).`
      );
      return;
    }

    const [, day, month, year] = match;
    const dateOfBirth = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

    // Validate date is not in future
    const dob = new Date(dateOfBirth);
    if (dob > new Date()) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Date of birth cannot be in the future. Please try again.`
      );
      return;
    }

    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.COLLECT_GENDER,
      {
        dateOfBirth
      }
    );

    await this.sendWhatsAppMessage(
      phoneNumber,
      `What is your gender?\n\n1. Male\n2. Female\n3. Other`
    );
  }

  /**
   * Handle gender collection
   */
  private async handleGenderCollection(phoneNumber: string, choice: string): Promise<void> {
    let gender: 'MALE' | 'FEMALE' | 'OTHER' | undefined;

    if (choice === '1' || choice.includes('male') && !choice.includes('female')) {
      gender = 'MALE';
    } else if (choice === '2' || choice.includes('female')) {
      gender = 'FEMALE';
    } else if (choice === '3' || choice.includes('other')) {
      gender = 'OTHER';
    }

    if (!gender) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please reply with 1 (Male), 2 (Female), or 3 (Other).`
      );
      return;
    }

    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.VERIFY_OTP,
      { gender }
    );

    // Generate and send OTP
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session) return;

    const cleanPhone = phoneNumber.replace('whatsapp:', '').replace('+', '');

    try {
      // Send OTP via WhatsApp
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      await whatsappSessionService.updateSessionState(
        phoneNumber,
        ConversationStep.VERIFY_OTP,
        { otpCode }
      );

      await this.sendWhatsAppMessage(
        phoneNumber,
        `I'll send you a verification code via WhatsApp.\n\nYour verification code is: *${otpCode}*\n\nPlease reply with this 6-digit code to verify.`
      );
    } catch (error) {
      console.error('Error sending OTP:', error);
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Sorry, there was an error sending the verification code. Please try again.`
      );
    }
  }

  /**
   * Handle OTP verification and patient registration
   */
  private async handleOTPVerification(phoneNumber: string, text: string): Promise<void> {
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session) return;

    const enteredOTP = text.trim();
    const savedOTP = session.collectedData.otpCode;

    if (enteredOTP !== savedOTP) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `❌ Incorrect verification code. Please try again.`
      );
      return;
    }

    // Create patient account
    try {
      const cleanPhone = phoneNumber.replace('whatsapp:', '');
      const { firstName, lastName, dateOfBirth, gender, hospitalId } = session.collectedData;

      if (!firstName || !lastName || !dateOfBirth || !gender || !hospitalId) {
        throw new Error('Missing required patient data');
      }

      // Get hospital info for address
      const hospital = await prisma.hospital.findUnique({
        where: { id: hospitalId }
      });

      // Check if patient already exists
      const existingPatient = await prisma.patient.findFirst({
        where: {
          hospitalId,
          phone: cleanPhone
        }
      });

      let patient;
      if (existingPatient) {
        patient = existingPatient;
      } else {
        // Generate MRN
        const mrn = `MRN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Create patient - use hospital location for address fields
        patient = await prisma.patient.create({
          data: {
            hospitalId,
            mrn,
            firstName,
            lastName,
            dateOfBirth: new Date(dateOfBirth),
            gender: gender as any,
            phone: cleanPhone,
            email: `${cleanPhone}@whatsapp.patient`,
            address: hospital?.address || 'UAE',
            city: hospital?.city || 'Dubai',
            state: hospital?.state || 'Dubai',
            zipCode: hospital?.zipCode || '00000'
          }
        });
      }

      // Link session to patient
      await whatsappSessionService.linkPatient(phoneNumber, patient.id);

      await whatsappSessionService.updateSessionState(
        phoneNumber,
        ConversationStep.MAIN_MENU,
        {},
        {
          patientId: patient.id,
          patientName: `${firstName} ${lastName}`
        }
      );

      await this.sendWhatsAppMessage(
        phoneNumber,
        `✅ Verified! Your account is ready.\n\nMRN: ${patient.mrn}\n\nWhat can I help you with today?\n\n1. Book Appointment\n2. View My Appointments\n3. Symptom Check`
      );
    } catch (error) {
      console.error('Error creating patient:', error);
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Sorry, there was an error creating your account. Please try again later.`
      );
    }
  }

  /**
   * Handle existing patient login
   */
  private async handleExistingPatientLogin(phoneNumber: string, text: string): Promise<void> {
    const normalizedText = text.trim().toLowerCase();
    let loginPhone = phoneNumber.replace('whatsapp:', '');

    if (!normalizedText.includes('this number')) {
      // User provided different phone
      loginPhone = text.trim().replace(/\D/g, ''); // Remove non-digits
      if (!loginPhone.startsWith('+')) {
        loginPhone = '+' + loginPhone;
      }
    }

    // Search for patient
    const patient = await prisma.patient.findFirst({
      where: {
        phone: loginPhone
      },
      include: {
        hospital: true
      }
    });

    if (!patient) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `❌ No account found with this phone number. Would you like to register as a new patient?\n\n1. Yes, register me\n2. Try different number`
      );
      return;
    }

    // Send OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.EXISTING_PATIENT_VERIFY_OTP,
      { otpCode },
      {
        patientId: patient.id,
        hospitalId: patient.hospitalId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        hospitalName: patient.hospital.name
      }
    );

    await this.sendWhatsAppMessage(
      phoneNumber,
      `✅ Found your account: ${patient.firstName} ${patient.lastName}\nMRN: ${patient.mrn}\n\nVerification code: *${otpCode}*\n\nPlease reply with this code to continue.`
    );
  }

  /**
   * Handle existing patient OTP verification
   */
  private async handleExistingPatientOTP(phoneNumber: string, text: string): Promise<void> {
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session) return;

    const enteredOTP = text.trim();
    const savedOTP = session.collectedData.otpCode;

    if (enteredOTP !== savedOTP) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `❌ Incorrect verification code. Please try again.`
      );
      return;
    }

    // Link session
    if (session.patientId) {
      await whatsappSessionService.linkPatient(phoneNumber, session.patientId);
    }

    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.MAIN_MENU,
      {}
    );

    await this.sendWhatsAppMessage(
      phoneNumber,
      `✅ Welcome back, ${session.patientName}!\n\nWhat can I help you with today?\n\n1. Book Appointment\n2. View My Appointments\n3. Symptom Check`
    );
  }

  /**
   * Handle main menu
   */
  private async handleMainMenu(phoneNumber: string, choice: string): Promise<void> {
    if (choice === '1' || choice.includes('book')) {
      await whatsappSessionService.updateSessionState(
        phoneNumber,
        ConversationStep.SYMPTOM_CHECK_START,
        {}
      );

      await this.sendWhatsAppMessage(
        phoneNumber,
        `What brings you in today? You can describe your symptoms or reason for visit.\n\n(You can type or send a voice message)`
      );
    } else if (choice === '2' || choice.includes('view')) {
      await this.handleViewAppointments(phoneNumber, 'view');
    } else if (choice === '3' || choice.includes('symptom')) {
      await whatsappSessionService.updateSessionState(
        phoneNumber,
        ConversationStep.SYMPTOM_CHECK_START,
        {}
      );

      await this.sendWhatsAppMessage(
        phoneNumber,
        `Let's do a symptom check. What symptoms are you experiencing?\n\n(You can type or send a voice message)`
      );
    } else {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please choose an option:\n\n1. Book Appointment\n2. View My Appointments\n3. Symptom Check`
      );
    }
  }

  /**
   * Handle symptom check start
   */
  private async handleSymptomCheckStart(phoneNumber: string, text: string): Promise<void> {
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session) return;

    // Start symptom checker session via AI service
    try {
      const response = await axios.post(`${this.aiServiceUrl}/symptom-checker/start`, {
        initialSymptoms: text,
        patientId: session.patientId
      });

      await whatsappSessionService.updateSessionState(
        phoneNumber,
        ConversationStep.SYMPTOM_CHECK_QUESTIONS,
        {
          symptoms: text
        },
        {
          symptomCheckSessionId: response.data.sessionId
        }
      );

      // Send first question from AI
      await this.sendWhatsAppMessage(
        phoneNumber,
        `I understand. ${response.data.message || response.data.nextQuestion || 'Let me ask you a few questions...'}`
      );
    } catch (error) {
      console.error('Error starting symptom check:', error);
      // Fallback: ask for department directly
      await this.showDepartmentList(phoneNumber);
    }
  }

  /**
   * Handle voice confirmation
   */
  private async handleVoiceConfirmation(phoneNumber: string, choice: string): Promise<void> {
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session) return;

    if (choice === '1' || choice.includes('yes')) {
      // Use transcript
      const transcript = session.collectedData.lastTranscript || '';
      await this.handleSymptomCheckStart(phoneNumber, transcript);
    } else {
      // Ask to retype
      await whatsappSessionService.updateSessionState(
        phoneNumber,
        ConversationStep.SYMPTOM_CHECK_START,
        {}
      );

      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please type your symptoms.`
      );
    }
  }

  /**
   * Handle symptom check questions (multi-turn)
   */
  private async handleSymptomCheckQuestions(phoneNumber: string, text: string): Promise<void> {
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session?.symptomCheckSessionId) return;

    try {
      const response = await axios.post(`${this.aiServiceUrl}/symptom-checker/respond`, {
        sessionId: session.symptomCheckSessionId,
        answer: text
      });

      if (response.data.complete) {
        // Symptom check complete
        const triageResult = response.data.result;

        await whatsappSessionService.updateSessionState(
          phoneNumber,
          ConversationStep.ASK_DOCTOR_PREFERENCE,
          {
            triageResult: {
              recommendedDepartment: triageResult.recommendedDepartment,
              urgency: triageResult.urgency,
              summary: triageResult.summary
            }
          }
        );

        const urgencyEmoji = triageResult.urgency === 'URGENT' ? '⚠️' :
                           triageResult.urgency === 'EMERGENCY' ? '🚨' : 'ℹ️';

        await this.sendWhatsAppMessage(
          phoneNumber,
          `${urgencyEmoji} Based on your symptoms:\n\n${triageResult.summary}\n\nRecommended: ${triageResult.recommendedDepartment}\nUrgency: ${triageResult.urgency}\n\nWould you like to book an appointment?\n\n1. Yes, book now\n2. No, not now`
        );
      } else {
        // Ask next question
        await this.sendWhatsAppMessage(
          phoneNumber,
          response.data.nextQuestion || response.data.message
        );
      }
    } catch (error) {
      console.error('Error in symptom check:', error);
      // Fallback to department selection
      await this.showDepartmentList(phoneNumber);
    }
  }

  /**
   * Show department list
   */
  private async showDepartmentList(phoneNumber: string): Promise<void> {
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session?.hospitalId) return;

    const departments = await prisma.department.findMany({
      where: {
        hospitalId: session.hospitalId,
        isActive: true
      },
      take: 10
    });

    const deptList = departments.map((d, i) => `${i + 1}. ${d.name}`).join('\n');

    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.ASK_DOCTOR_PREFERENCE,
      {}
    );

    await this.sendWhatsAppMessage(
      phoneNumber,
      `Which department would you like to visit?\n\n${deptList}\n\nReply with the number.`
    );
  }

  /**
   * Handle doctor preference
   */
  private async handleDoctorPreference(phoneNumber: string, text: string): Promise<void> {
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session?.hospitalId) return;

    const normalizedText = text.trim().toLowerCase();

    if (normalizedText === '2' || normalizedText.includes('no')) {
      // User declined booking
      await this.sendWhatsAppMessage(
        phoneNumber,
        `No problem! Type 'menu' anytime to see options.\n\nFeel better soon! 💚`
      );
      await whatsappSessionService.updateSessionState(
        phoneNumber,
        ConversationStep.MAIN_MENU,
        {}
      );
      return;
    }

    // Get departments
    const departments = await prisma.department.findMany({
      where: {
        hospitalId: session.hospitalId,
        isActive: true
      },
      take: 10
    });

    let selectedDepartment;

    // Try to match by number or name
    const choiceNum = parseInt(text.trim());
    if (!isNaN(choiceNum) && choiceNum >= 1 && choiceNum <= departments.length) {
      selectedDepartment = departments[choiceNum - 1];
    } else if (session.collectedData.triageResult) {
      // Use AI recommendation
      selectedDepartment = departments.find(d =>
        d.name.toLowerCase().includes(session.collectedData.triageResult!.recommendedDepartment.toLowerCase())
      ) || departments[0];
    }

    if (!selectedDepartment) {
      const deptList = departments.map((d, i) => `${i + 1}. ${d.name}`).join('\n');
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please select a department:\n\n${deptList}`
      );
      return;
    }

    // Find available doctors
    const doctors = await prisma.doctor.findMany({
      where: {
        departmentId: selectedDepartment.id,
        isAvailable: true
      },
      include: {
        user: true
      },
      take: 5
    });

    if (doctors.length === 0) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Sorry, no doctors available in ${selectedDepartment.name} right now. Please try another department.`
      );
      return;
    }

    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.SELECT_DOCTOR,
      {
        departmentId: selectedDepartment.id,
        departmentName: selectedDepartment.name
      }
    );

    const doctorList = doctors.map((d, i) =>
      `${i + 1}. Dr. ${d.user.firstName} ${d.user.lastName}\n   Specialization: ${d.specialization}`
    ).join('\n\n');

    await this.sendWhatsAppMessage(
      phoneNumber,
      `Available doctors in ${selectedDepartment.name}:\n\n${doctorList}\n\nReply with the number.`
    );
  }

  /**
   * Handle doctor selection
   */
  private async handleDoctorSelection(phoneNumber: string, text: string): Promise<void> {
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session?.collectedData.departmentId) return;

    const doctors = await prisma.doctor.findMany({
      where: {
        departmentId: session.collectedData.departmentId,
        isAvailable: true
      },
      include: {
        user: true
      },
      take: 5
    });

    const choiceNum = parseInt(text.trim());
    if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > doctors.length) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please reply with a valid number (1-${doctors.length}).`
      );
      return;
    }

    const selectedDoctor = doctors[choiceNum - 1];

    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.SELECT_SLOT,
      {
        doctorId: selectedDoctor.id,
        doctorName: `${selectedDoctor.user.firstName} ${selectedDoctor.user.lastName}`
      }
    );

    // Get available slots (simplified - show today and tomorrow)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    await this.sendWhatsAppMessage(
      phoneNumber,
      `Great! Available slots for Dr. ${selectedDoctor.user.firstName} ${selectedDoctor.user.lastName}:\n\n1. Today, ${today.toLocaleDateString()} - 3:00 PM\n2. Today, ${today.toLocaleDateString()} - 4:00 PM\n3. Tomorrow, ${tomorrow.toLocaleDateString()} - 10:00 AM\n4. Tomorrow, ${tomorrow.toLocaleDateString()} - 2:00 PM\n\nReply with the number.`
    );
  }

  /**
   * Handle slot selection
   */
  private async handleSlotSelection(phoneNumber: string, text: string): Promise<void> {
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session) return;

    const choiceNum = parseInt(text.trim());
    if (isNaN(choiceNum) || choiceNum < 1 || choiceNum > 4) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Please reply with a valid number (1-4).`
      );
      return;
    }

    // Simplified slot mapping
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const slots = [
      { date: today.toISOString().split('T')[0], startTime: '15:00', endTime: '15:30' },
      { date: today.toISOString().split('T')[0], startTime: '16:00', endTime: '16:30' },
      { date: tomorrow.toISOString().split('T')[0], startTime: '10:00', endTime: '10:30' },
      { date: tomorrow.toISOString().split('T')[0], startTime: '14:00', endTime: '14:30' }
    ];

    const selectedSlot = slots[choiceNum - 1];

    await whatsappSessionService.updateSessionState(
      phoneNumber,
      ConversationStep.CONFIRM_BOOKING,
      {
        selectedSlot
      }
    );

    const { doctorName, departmentName } = session.collectedData;
    const date = new Date(selectedSlot.date);

    await this.sendWhatsAppMessage(
      phoneNumber,
      `📋 Booking Summary:\n\n📅 Date: ${date.toLocaleDateString()}\n⏰ Time: ${selectedSlot.startTime}\n👨‍⚕️ Doctor: Dr. ${doctorName}\n🏥 Department: ${departmentName}\n\nConfirm booking?\n\n1. Yes, confirm\n2. No, cancel`
    );
  }

  /**
   * Handle booking confirmation
   */
  private async handleBookingConfirmation(phoneNumber: string, choice: string): Promise<void> {
    if (choice !== '1' && !choice.includes('yes') && !choice.includes('confirm')) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Booking cancelled. Type 'menu' to return to main menu.`
      );
      await whatsappSessionService.updateSessionState(
        phoneNumber,
        ConversationStep.MAIN_MENU,
        {}
      );
      return;
    }

    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session) return;

    try {
      const { patientId, doctorId, selectedSlot, symptoms } = session.collectedData;

      if (!patientId || !doctorId || !selectedSlot) {
        throw new Error('Missing required booking data');
      }

      // Create appointment
      const appointmentDate = new Date(`${selectedSlot.date}T${selectedSlot.startTime}`);

      const appointment = await prisma.appointment.create({
        data: {
          hospitalId: session.hospitalId!,
          patientId: session.collectedData.patientId || patientId,
          doctorId,
          appointmentDate,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          type: 'CONSULTATION',
          status: 'SCHEDULED',
          reason: symptoms || 'General consultation'
        }
      });

      await whatsappSessionService.updateSessionState(
        phoneNumber,
        ConversationStep.BOOKING_COMPLETE,
        {
          appointmentId: appointment.id
        }
      );

      await this.sendWhatsAppMessage(
        phoneNumber,
        `✅ Appointment Confirmed!\n\n📅 Date: ${appointmentDate.toLocaleDateString()}\n⏰ Time: ${selectedSlot.startTime}\n👨‍⚕️ Doctor: Dr. ${session.collectedData.doctorName}\n🏥 Hospital: ${session.hospitalName}\n\nConfirmation Code: ${appointment.id.substring(0, 8).toUpperCase()}\n\nPlease arrive 15 minutes early. Bring your Emirates ID.\n\nType 'menu' for more options.`
      );

      // Reset to main menu
      setTimeout(async () => {
        await whatsappSessionService.updateSessionState(
          phoneNumber,
          ConversationStep.MAIN_MENU,
          {}
        );
      }, 2000);
    } catch (error) {
      console.error('Error creating appointment:', error);
      await this.sendWhatsAppMessage(
        phoneNumber,
        `Sorry, there was an error creating your appointment. Please try again or call the hospital directly.`
      );
    }
  }

  /**
   * Handle view appointments
   */
  private async handleViewAppointments(phoneNumber: string, _action: string): Promise<void> {
    const session = await whatsappSessionService.getSessionContext(phoneNumber);
    if (!session?.patientId) return;

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId: session.patientId,
        status: {
          in: ['SCHEDULED', 'CONFIRMED']
        },
        appointmentDate: {
          gte: new Date()
        }
      },
      include: {
        doctor: {
          include: {
            user: true,
            department: true
          }
        }
      },
      orderBy: {
        appointmentDate: 'asc'
      },
      take: 5
    });

    if (appointments.length === 0) {
      await this.sendWhatsAppMessage(
        phoneNumber,
        `You have no upcoming appointments.\n\nType 'menu' to book one!`
      );
      return;
    }

    const appointmentList = appointments.map((apt, i) => {
      const date = new Date(apt.appointmentDate);
      return `${i + 1}. ${date.toLocaleDateString()} at ${apt.startTime}\n   Dr. ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}\n   ${apt.doctor.department.name}`;
    }).join('\n\n');

    await this.sendWhatsAppMessage(
      phoneNumber,
      `📅 Your Upcoming Appointments:\n\n${appointmentList}\n\nType 'menu' to return to main menu.`
    );
  }

  /**
   * Send WhatsApp message
   */
  private async sendWhatsAppMessage(to: string, message: string): Promise<void> {
    try {
      await whatsappService.sendMessage({ to, body: message });
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Send error message
   */
  private async sendErrorMessage(to: string): Promise<void> {
    await this.sendWhatsAppMessage(
      to,
      `I'm having a small technical issue. Please try again in a moment, or type 'menu' to start over.`
    );
  }
}

export default new WhatsAppBotService();
