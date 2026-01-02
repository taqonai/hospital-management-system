import { useState, useEffect, useRef } from 'react';
import {
  QrCodeIcon,
  PhoneIcon,
  CalendarDaysIcon,
  UserPlusIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  SpeakerWaveIcon,
  HomeIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Default hospital ID - in production, this would come from kiosk configuration
const HOSPITAL_ID = import.meta.env.VITE_HOSPITAL_ID || 'e0ea7315-0695-4a97-a6d1-c353181f8592';

type KioskStep =
  | 'welcome'
  | 'check-in-options'
  | 'qr-scan'
  | 'phone-lookup'
  | 'appointment-confirm'
  | 'new-patient'
  | 'symptom-assessment'
  | 'department-select'
  | 'ticket-issued'
  | 'error';

interface PatientInfo {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth?: string;
  mrn?: string;
}

interface AppointmentInfo {
  id: string;
  doctorName: string;
  department: string;
  scheduledTime: string;
  reason?: string;
}

interface TicketInfo {
  ticketNumber: string;
  tokenDisplay: string;
  queuePosition: number;
  estimatedWaitTime: number;
  counterName?: string;
  serviceType: string;
}

interface Department {
  id: string;
  name: string;
  icon: string;
  waitTime: number;
}

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'hi', name: 'हिंदी', flag: '🇮🇳' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

const departments: Department[] = [
  { id: 'general', name: 'General Medicine', icon: '🏥', waitTime: 15 },
  { id: 'cardiology', name: 'Cardiology', icon: '❤️', waitTime: 20 },
  { id: 'orthopedics', name: 'Orthopedics', icon: '🦴', waitTime: 25 },
  { id: 'pediatrics', name: 'Pediatrics', icon: '👶', waitTime: 10 },
  { id: 'gynecology', name: 'Gynecology', icon: '🤰', waitTime: 20 },
  { id: 'dermatology', name: 'Dermatology', icon: '🧴', waitTime: 15 },
  { id: 'ophthalmology', name: 'Ophthalmology', icon: '👁️', waitTime: 12 },
  { id: 'ent', name: 'ENT', icon: '👂', waitTime: 18 },
];

export default function SelfCheckInKiosk() {
  const [step, setStep] = useState<KioskStep>('welcome');
  const [language, setLanguage] = useState('en');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Patient & Appointment data
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);
  const [appointmentInfo, setAppointmentInfo] = useState<AppointmentInfo | null>(null);
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);

  // Form inputs
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [priority, setPriority] = useState('NORMAL');

  // New patient form
  const [newPatient, setNewPatient] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const videoRef = useRef<HTMLVideoElement>(null);

  // Update time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Voice guidance
  const speak = (text: string) => {
    if (voiceEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.lang = language === 'hi' ? 'hi-IN' : language === 'es' ? 'es-ES' : 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Reset to welcome after inactivity
  useEffect(() => {
    if (step === 'ticket-issued') {
      const timeout = setTimeout(() => {
        resetKiosk();
      }, 30000); // Reset after 30 seconds
      return () => clearTimeout(timeout);
    }
  }, [step]);

  const resetKiosk = () => {
    setStep('welcome');
    setPatientInfo(null);
    setAppointmentInfo(null);
    setTicketInfo(null);
    setPhoneNumber('');
    setSelectedDepartment(null);
    setSymptoms('');
    setPriority('NORMAL');
    setNewPatient({ firstName: '', lastName: '', phone: '', dateOfBirth: '', gender: '' });
    setError('');
  };

  // Start QR scanner
  const startQRScanner = async () => {
    setStep('qr-scan');
    speak('Please scan your appointment QR code');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      setError('Camera access denied. Please use phone number check-in.');
    }
  };

  // Stop QR scanner
  const stopQRScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  // Lookup patient by phone
  const lookupByPhone = async () => {
    if (phoneNumber.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Try to find patient and their appointment via kiosk API
      const response = await fetch(`${API_URL}/kiosk/${HOSPITAL_ID}/lookup/phone/${phoneNumber}`);

      if (response.ok) {
        const data = await response.json();
        if (data.data?.patient) {
          setPatientInfo({
            id: data.data.patient.id,
            firstName: data.data.patient.firstName || '',
            lastName: data.data.patient.lastName || '',
            phone: phoneNumber,
            mrn: data.data.patient.mrn,
          });

          if (data.data.appointment) {
            setAppointmentInfo({
              id: data.data.appointment.id,
              doctorName: data.data.appointment.doctorName || 'Assigned Doctor',
              department: data.data.appointment.department || 'General',
              scheduledTime: data.data.appointment.scheduledTime,
              reason: data.data.appointment.reason,
            });
            setStep('appointment-confirm');
            speak(`Welcome back! We found your appointment. Please confirm your details.`);
          } else {
            // Patient found but no appointment - walk-in
            setStep('department-select');
            speak('Welcome back! Please select a department for your visit.');
          }
        } else {
          // No patient found
          setStep('department-select');
          speak('No record found. Please select a department for walk-in consultation.');
        }
      } else {
        // No patient found, offer to check-in as walk-in
        setStep('department-select');
        speak('No appointment found. Please select a department for walk-in consultation.');
      }
    } catch (err) {
      setError('Unable to find your records. Please try again or register as a new patient.');
    } finally {
      setLoading(false);
    }
  };

  // Issue queue ticket via kiosk API
  const issueTicket = async (serviceType: string, patientName: string, patientPhone: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/kiosk/${HOSPITAL_ID}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName,
          patientPhone,
          serviceType,
          priority,
          appointmentId: appointmentInfo?.id,
          departmentId: selectedDepartment,
          symptoms: symptoms || appointmentInfo?.reason,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTicketInfo(data.data);
        setStep('ticket-issued');
        speak(`Your token number is ${data.data.tokenDisplay}. Your estimated wait time is ${data.data.estimatedWaitTime} minutes. Please proceed to the waiting area.`);
      } else {
        throw new Error('Failed to issue ticket');
      }
    } catch (err) {
      setError('Failed to issue ticket. Please see the registration desk.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Confirm appointment and get ticket
  const confirmAppointment = () => {
    if (patientInfo && appointmentInfo) {
      issueTicket(
        'consultation',
        `${patientInfo.firstName} ${patientInfo.lastName}`,
        patientInfo.phone
      );
    }
  };

  // Handle department selection for walk-in
  const handleDepartmentSelect = (deptId: string) => {
    setSelectedDepartment(deptId);
    setStep('symptom-assessment');
    speak('Please describe your symptoms or reason for visit');
  };

  // AI symptom triage
  const performAITriage = async (symptomsText: string, patientAge?: number) => {
    try {
      const response = await fetch(`${API_URL}/kiosk/${HOSPITAL_ID}/symptom-triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: symptomsText,
          age: patientAge || 35,
          gender: newPatient.gender || 'unknown',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update priority based on AI assessment
        if (data.data?.priority) {
          setPriority(data.data.priority);
          if (data.data.priority === 'EMERGENCY') {
            speak('Based on your symptoms, you need urgent medical attention. A staff member will assist you shortly.');
          } else if (data.data.priority === 'HIGH') {
            speak('Your symptoms indicate you need priority care. You will be seen soon.');
          }
        }
        return data.data;
      }
    } catch (err) {
      console.error('AI triage failed:', err);
    }
    return null;
  };

  // Submit walk-in registration with AI triage
  const submitWalkIn = async () => {
    // Perform AI triage if symptoms provided
    if (symptoms) {
      const age = newPatient.dateOfBirth
        ? Math.floor((Date.now() - new Date(newPatient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : undefined;
      await performAITriage(symptoms, age);
    }

    if (phoneNumber) {
      issueTicket(
        selectedDepartment || 'general',
        patientInfo?.firstName ? `${patientInfo.firstName} ${patientInfo.lastName}` : phoneNumber,
        phoneNumber
      );
    } else if (newPatient.firstName) {
      issueTicket(
        selectedDepartment || 'general',
        `${newPatient.firstName} ${newPatient.lastName}`,
        newPatient.phone
      );
    }
  };

  // Numpad for phone input
  const NumPad = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => (
    <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'].map((key) => (
        <button
          key={key}
          onClick={() => {
            if (key === 'C') onChange('');
            else if (key === '⌫') onChange(value.slice(0, -1));
            else if (value.length < 10) onChange(value + key);
          }}
          className={clsx(
            'h-16 w-16 rounded-2xl text-2xl font-bold transition-all active:scale-95',
            key === 'C' ? 'bg-red-500 text-white' :
            key === '⌫' ? 'bg-yellow-500 text-white' :
            'bg-white text-gray-800 shadow-lg hover:shadow-xl'
          )}
        >
          {key}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex flex-col">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
            <span className="text-2xl font-bold text-blue-600">H</span>
          </div>
          <div className="text-white">
            <h1 className="text-xl font-bold">Hospital Self Check-In</h1>
            <p className="text-sm text-blue-200">Quick & Easy Registration</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Language selector */}
          <div className="flex gap-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={clsx(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  language === lang.code
                    ? 'bg-white text-blue-600'
                    : 'bg-white/20 text-white hover:bg-white/30'
                )}
              >
                {lang.flag} {lang.name}
              </button>
            ))}
          </div>

          {/* Voice toggle */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={clsx(
              'p-3 rounded-full transition-all',
              voiceEnabled ? 'bg-green-500 text-white' : 'bg-white/20 text-white'
            )}
          >
            <SpeakerWaveIcon className="h-6 w-6" />
          </button>

          {/* Time */}
          <div className="text-white text-right">
            <p className="text-2xl font-mono">{currentTime.toLocaleTimeString()}</p>
            <p className="text-sm text-blue-200">{currentTime.toLocaleDateString()}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl">

          {/* Welcome Screen */}
          {step === 'welcome' && (
            <div className="text-center animate-fade-in">
              <div className="mb-8">
                <div className="w-32 h-32 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                  <HomeIcon className="h-16 w-16 text-white" />
                </div>
                <h2 className="text-5xl font-bold text-white mb-4">Welcome!</h2>
                <p className="text-2xl text-blue-200">Touch the screen to begin check-in</p>
              </div>

              <button
                onClick={() => {
                  setStep('check-in-options');
                  speak('Welcome! Please select how you would like to check in.');
                }}
                className="px-16 py-8 bg-white text-blue-600 rounded-3xl text-3xl font-bold shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all"
              >
                Start Check-In
              </button>

              <div className="mt-12 flex justify-center gap-8 text-white/80">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="h-6 w-6" />
                  <span>Quick & Easy</span>
                </div>
                <div className="flex items-center gap-2">
                  <ClockIcon className="h-6 w-6" />
                  <span>Save Time</span>
                </div>
                <div className="flex items-center gap-2">
                  <SparklesIcon className="h-6 w-6" />
                  <span>AI Powered</span>
                </div>
              </div>
            </div>
          )}

          {/* Check-in Options */}
          {step === 'check-in-options' && (
            <div className="animate-fade-in">
              <button
                onClick={() => setStep('welcome')}
                className="mb-6 flex items-center gap-2 text-white/80 hover:text-white"
              >
                <ArrowLeftIcon className="h-6 w-6" />
                Back
              </button>

              <h2 className="text-4xl font-bold text-white text-center mb-8">
                How would you like to check in?
              </h2>

              <div className="grid grid-cols-2 gap-6">
                {/* QR Code Scan */}
                <button
                  onClick={startQRScanner}
                  className="bg-white rounded-3xl p-8 text-center hover:shadow-2xl transform hover:scale-105 transition-all group"
                >
                  <div className="w-24 h-24 mx-auto bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                    <QrCodeIcon className="h-12 w-12 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Scan QR Code</h3>
                  <p className="text-gray-500">Have an appointment? Scan your booking QR code</p>
                </button>

                {/* Phone Number */}
                <button
                  onClick={() => {
                    setStep('phone-lookup');
                    speak('Please enter your phone number');
                  }}
                  className="bg-white rounded-3xl p-8 text-center hover:shadow-2xl transform hover:scale-105 transition-all group"
                >
                  <div className="w-24 h-24 mx-auto bg-green-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                    <PhoneIcon className="h-12 w-12 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Phone Number</h3>
                  <p className="text-gray-500">Look up your appointment using phone number</p>
                </button>

                {/* Walk-in */}
                <button
                  onClick={() => {
                    setStep('department-select');
                    speak('Please select a department');
                  }}
                  className="bg-white rounded-3xl p-8 text-center hover:shadow-2xl transform hover:scale-105 transition-all group"
                >
                  <div className="w-24 h-24 mx-auto bg-purple-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                    <CalendarDaysIcon className="h-12 w-12 text-purple-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Walk-in Visit</h3>
                  <p className="text-gray-500">No appointment? Register as a walk-in patient</p>
                </button>

                {/* New Patient */}
                <button
                  onClick={() => {
                    setStep('new-patient');
                    speak('Welcome new patient. Please enter your details.');
                  }}
                  className="bg-white rounded-3xl p-8 text-center hover:shadow-2xl transform hover:scale-105 transition-all group"
                >
                  <div className="w-24 h-24 mx-auto bg-orange-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                    <UserPlusIcon className="h-12 w-12 text-orange-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">New Patient</h3>
                  <p className="text-gray-500">First time visit? Register as a new patient</p>
                </button>
              </div>

              {/* Emergency Notice */}
              <div className="mt-8 bg-red-500/20 backdrop-blur rounded-2xl p-4 flex items-center gap-4">
                <ExclamationTriangleIcon className="h-10 w-10 text-red-300" />
                <div className="text-white">
                  <p className="font-bold">Medical Emergency?</p>
                  <p className="text-sm text-red-200">Please go directly to the Emergency Department or call for assistance</p>
                </div>
              </div>
            </div>
          )}

          {/* Phone Lookup */}
          {step === 'phone-lookup' && (
            <div className="animate-fade-in">
              <button
                onClick={() => setStep('check-in-options')}
                className="mb-6 flex items-center gap-2 text-white/80 hover:text-white"
              >
                <ArrowLeftIcon className="h-6 w-6" />
                Back
              </button>

              <div className="bg-white rounded-3xl p-8 text-center max-w-md mx-auto">
                <PhoneIcon className="h-16 w-16 mx-auto text-blue-600 mb-4" />
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Enter Your Phone Number</h2>
                <p className="text-gray-500 mb-6">We'll look up your appointment</p>

                {/* Phone display */}
                <div className="bg-gray-100 rounded-xl p-4 mb-6">
                  <p className="text-4xl font-mono text-gray-800 tracking-wider">
                    {phoneNumber || '_ _ _ _ _ _ _ _ _ _'}
                  </p>
                </div>

                {/* Numpad */}
                <NumPad value={phoneNumber} onChange={setPhoneNumber} />

                {error && (
                  <p className="mt-4 text-red-500">{error}</p>
                )}

                <button
                  onClick={lookupByPhone}
                  disabled={phoneNumber.length < 10 || loading}
                  className={clsx(
                    'mt-6 w-full py-4 rounded-xl text-xl font-bold transition-all',
                    phoneNumber.length >= 10
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  )}
                >
                  {loading ? 'Looking up...' : 'Look Up'}
                </button>
              </div>
            </div>
          )}

          {/* Appointment Confirmation */}
          {step === 'appointment-confirm' && patientInfo && appointmentInfo && (
            <div className="animate-fade-in">
              <button
                onClick={() => setStep('check-in-options')}
                className="mb-6 flex items-center gap-2 text-white/80 hover:text-white"
              >
                <ArrowLeftIcon className="h-6 w-6" />
                Back
              </button>

              <div className="bg-white rounded-3xl p-8 max-w-lg mx-auto">
                <CheckCircleIcon className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h2 className="text-3xl font-bold text-gray-800 text-center mb-6">
                  Appointment Found!
                </h2>

                <div className="space-y-4 mb-8">
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Patient Name</p>
                    <p className="text-xl font-bold text-gray-800">
                      {patientInfo.firstName} {patientInfo.lastName}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Doctor</p>
                    <p className="text-xl font-bold text-gray-800">{appointmentInfo.doctorName}</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Department</p>
                    <p className="text-xl font-bold text-gray-800">{appointmentInfo.department}</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-500">Scheduled Time</p>
                    <p className="text-xl font-bold text-gray-800">{appointmentInfo.scheduledTime}</p>
                  </div>

                  {patientInfo.mrn && (
                    <div className="bg-blue-50 rounded-xl p-4">
                      <p className="text-sm text-blue-500">MRN</p>
                      <p className="text-xl font-bold text-blue-800">{patientInfo.mrn}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={confirmAppointment}
                  disabled={loading}
                  className="w-full py-4 bg-green-500 text-white rounded-xl text-xl font-bold hover:bg-green-600 transition-all"
                >
                  {loading ? 'Processing...' : 'Confirm & Get Token'}
                </button>
              </div>
            </div>
          )}

          {/* Department Selection */}
          {step === 'department-select' && (
            <div className="animate-fade-in">
              <button
                onClick={() => setStep('check-in-options')}
                className="mb-6 flex items-center gap-2 text-white/80 hover:text-white"
              >
                <ArrowLeftIcon className="h-6 w-6" />
                Back
              </button>

              <h2 className="text-4xl font-bold text-white text-center mb-8">
                Select Department
              </h2>

              <div className="grid grid-cols-4 gap-4">
                {departments.map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => handleDepartmentSelect(dept.id)}
                    className="bg-white rounded-2xl p-6 text-center hover:shadow-2xl transform hover:scale-105 transition-all"
                  >
                    <span className="text-4xl mb-2 block">{dept.icon}</span>
                    <h3 className="text-lg font-bold text-gray-800">{dept.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      ~{dept.waitTime} min wait
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Symptom Assessment */}
          {step === 'symptom-assessment' && (
            <div className="animate-fade-in">
              <button
                onClick={() => setStep('department-select')}
                className="mb-6 flex items-center gap-2 text-white/80 hover:text-white"
              >
                <ArrowLeftIcon className="h-6 w-6" />
                Back
              </button>

              <div className="bg-white rounded-3xl p-8 max-w-lg mx-auto">
                <SparklesIcon className="h-12 w-12 mx-auto text-purple-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
                  AI Symptom Assessment
                </h2>
                <p className="text-gray-500 text-center mb-6">
                  Describe your symptoms for faster service
                </p>

                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Example: I have a headache and fever for 2 days..."
                  className="w-full h-32 p-4 border-2 border-gray-200 rounded-xl text-lg focus:border-blue-500 focus:outline-none resize-none"
                />

                {/* Priority Selection */}
                <div className="mt-6">
                  <p className="text-sm font-medium text-gray-600 mb-3">Select Priority (if applicable):</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'NORMAL', label: 'Normal', color: 'gray' },
                      { value: 'SENIOR_CITIZEN', label: 'Senior (65+)', color: 'teal' },
                      { value: 'PREGNANT', label: 'Pregnant', color: 'pink' },
                      { value: 'DISABLED', label: 'Disabled', color: 'blue' },
                      { value: 'CHILD', label: 'Child', color: 'cyan' },
                    ].map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setPriority(p.value)}
                        className={clsx(
                          'px-4 py-2 rounded-full text-sm font-medium transition-all',
                          priority === p.value
                            ? `bg-${p.color}-500 text-white`
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={submitWalkIn}
                  disabled={loading}
                  className="mt-6 w-full py-4 bg-blue-600 text-white rounded-xl text-xl font-bold hover:bg-blue-700 transition-all"
                >
                  {loading ? 'Processing...' : 'Get Token'}
                </button>
              </div>
            </div>
          )}

          {/* New Patient Registration */}
          {step === 'new-patient' && (
            <div className="animate-fade-in">
              <button
                onClick={() => setStep('check-in-options')}
                className="mb-6 flex items-center gap-2 text-white/80 hover:text-white"
              >
                <ArrowLeftIcon className="h-6 w-6" />
                Back
              </button>

              <div className="bg-white rounded-3xl p-8 max-w-lg mx-auto">
                <UserPlusIcon className="h-12 w-12 mx-auto text-orange-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">
                  New Patient Registration
                </h2>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="First Name"
                      value={newPatient.firstName}
                      onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })}
                      className="p-4 border-2 border-gray-200 rounded-xl text-lg focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Last Name"
                      value={newPatient.lastName}
                      onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })}
                      className="p-4 border-2 border-gray-200 rounded-xl text-lg focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <input
                    type="tel"
                    placeholder="Phone Number"
                    value={newPatient.phone}
                    onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl text-lg focus:border-blue-500 focus:outline-none"
                  />

                  <input
                    type="date"
                    placeholder="Date of Birth"
                    value={newPatient.dateOfBirth}
                    onChange={(e) => setNewPatient({ ...newPatient, dateOfBirth: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl text-lg focus:border-blue-500 focus:outline-none"
                  />

                  <div className="flex gap-4">
                    {['Male', 'Female', 'Other'].map((g) => (
                      <button
                        key={g}
                        onClick={() => setNewPatient({ ...newPatient, gender: g })}
                        className={clsx(
                          'flex-1 py-3 rounded-xl font-medium transition-all',
                          newPatient.gender === g
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (newPatient.firstName && newPatient.phone) {
                      setStep('department-select');
                    }
                  }}
                  disabled={!newPatient.firstName || !newPatient.phone}
                  className={clsx(
                    'mt-6 w-full py-4 rounded-xl text-xl font-bold transition-all',
                    newPatient.firstName && newPatient.phone
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  )}
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Ticket Issued - Success */}
          {step === 'ticket-issued' && ticketInfo && (
            <div className="animate-fade-in text-center">
              <div className="bg-white rounded-3xl p-12 max-w-lg mx-auto">
                <CheckCircleIcon className="h-24 w-24 mx-auto text-green-500 mb-6" />

                <h2 className="text-3xl font-bold text-gray-800 mb-2">Check-In Complete!</h2>
                <p className="text-gray-500 mb-8">Your token has been issued</p>

                {/* Token Display */}
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 text-white mb-8">
                  <p className="text-sm uppercase tracking-wider mb-2">Your Token Number</p>
                  <p className="text-6xl font-bold mb-4">{ticketInfo.tokenDisplay}</p>
                  <div className="flex justify-center gap-8 text-sm">
                    <div>
                      <p className="text-blue-200">Position</p>
                      <p className="text-xl font-bold">#{ticketInfo.queuePosition}</p>
                    </div>
                    <div>
                      <p className="text-blue-200">Est. Wait</p>
                      <p className="text-xl font-bold">{ticketInfo.estimatedWaitTime} min</p>
                    </div>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-gray-50 rounded-xl p-6 text-left mb-8">
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <MapPinIcon className="h-5 w-5 text-blue-500" />
                    Next Steps
                  </h3>
                  <ol className="space-y-2 text-gray-600">
                    <li>1. Proceed to the <strong>waiting area</strong></li>
                    <li>2. Watch the display board for your token</li>
                    <li>3. Listen for audio announcements</li>
                    <li>4. Proceed to the counter when called</li>
                  </ol>
                </div>

                {/* Print/SMS Options */}
                <div className="flex gap-4">
                  <button className="flex-1 py-3 border-2 border-gray-300 rounded-xl text-gray-600 font-medium hover:bg-gray-50">
                    Print Token
                  </button>
                  <button className="flex-1 py-3 border-2 border-blue-500 rounded-xl text-blue-600 font-medium hover:bg-blue-50">
                    Send SMS
                  </button>
                </div>

                <p className="mt-6 text-sm text-gray-400">
                  This screen will reset in 30 seconds
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="animate-fade-in text-center">
              <div className="bg-white rounded-3xl p-12 max-w-lg mx-auto">
                <ExclamationTriangleIcon className="h-24 w-24 mx-auto text-red-500 mb-6" />
                <h2 className="text-3xl font-bold text-gray-800 mb-4">Something went wrong</h2>
                <p className="text-gray-500 mb-8">{error || 'Please try again or visit the registration desk'}</p>

                <button
                  onClick={resetKiosk}
                  className="px-8 py-4 bg-blue-600 text-white rounded-xl text-xl font-bold hover:bg-blue-700"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/10 backdrop-blur-lg px-6 py-3 text-center text-white/60 text-sm">
        <p>Need assistance? Press the help button or ask a staff member</p>
      </footer>

      {/* QR Scanner Video (hidden until needed) */}
      {step === 'qr-scan' && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
          <div className="text-center">
            <button
              onClick={() => {
                stopQRScanner();
                setStep('check-in-options');
              }}
              className="absolute top-6 right-6 text-white"
            >
              <XMarkIcon className="h-10 w-10" />
            </button>

            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-96 h-96 rounded-2xl border-4 border-white"
            />

            <p className="text-white text-xl mt-6">Position QR code in the frame</p>
            <p className="text-white/60 mt-2">Or use phone number check-in</p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
