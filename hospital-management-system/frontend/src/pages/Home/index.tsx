import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDaysIcon,
  UserGroupIcon,
  BeakerIcon,
  HeartIcon,
  PhoneIcon,
  ClockIcon,
  MapPinIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SparklesIcon,
  ShieldCheckIcon,
  TrophyIcon,
  VideoCameraIcon,
  BuildingOffice2Icon,
  ArrowRightIcon,
  MicrophoneIcon,
  StopIcon,
  CheckCircleIcon,
  StarIcon,
  CpuChipIcon,
  DocumentTextIcon,
  TruckIcon,
  EyeIcon,
  ScissorsIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChatBubbleBottomCenterTextIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  BoltIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  AcademicCapIcon,
  GlobeAltIcon,
  PlayIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import {
  HeartIcon as HeartSolid,
  StarIcon as StarSolid,
  CheckCircleIcon as CheckCircleSolid,
  SparklesIcon as SparklesSolid,
} from '@heroicons/react/24/solid';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Full-page banner data with enhanced styling
const banners = [
  {
    id: 1,
    title: 'Experience The Future of Healthcare',
    subtitle: 'AI-Powered Medical Excellence',
    description: 'Where cutting-edge artificial intelligence meets compassionate care. Our smart systems ensure faster diagnosis, personalized treatment, and better outcomes.',
    image: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=1920&q=80',
    cta: 'Book Smart Appointment',
    ctaLink: '#booking',
    secondaryCta: 'Explore AI Services',
    secondaryLink: '#ai-services',
    gradient: 'from-blue-900/95 via-blue-800/90 to-transparent',
    accent: 'blue',
  },
  {
    id: 2,
    title: 'Your Health Assistant, Available 24/7',
    subtitle: 'AI Symptom Checker & Virtual Care',
    description: 'Describe your symptoms using text or voice. Our AI instantly analyzes and connects you with the right specialist, anytime, anywhere.',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1920&q=80',
    cta: 'Try AI Symptom Checker',
    ctaLink: '/symptom-checker',
    secondaryCta: 'Start Voice Booking',
    secondaryLink: '#booking',
    gradient: 'from-teal-900/95 via-teal-800/90 to-transparent',
    accent: 'teal',
  },
  {
    id: 3,
    title: 'Emergency Care When Minutes Matter',
    subtitle: '24/7 Emergency & Trauma Center',
    description: 'World-class emergency services with rapid response teams, advanced trauma facilities, and AI-assisted triage for critical care prioritization.',
    image: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=1920&q=80',
    cta: 'Emergency Contact',
    ctaLink: 'tel:108',
    secondaryCta: 'Ambulance Services',
    secondaryLink: '#contact',
    gradient: 'from-red-900/95 via-red-800/90 to-transparent',
    accent: 'red',
  },
];

// AI Services showcase
const aiServices = [
  {
    icon: ChatBubbleBottomCenterTextIcon,
    title: 'AI Symptom Checker',
    description: 'Describe symptoms in natural language. Get instant triage assessment and specialist recommendations.',
    link: '/symptom-checker',
    color: 'from-violet-500 to-purple-600',
    features: ['Natural Language Processing', 'Instant Triage', 'Smart Referrals'],
  },
  {
    icon: MicrophoneIcon,
    title: 'Voice-Powered Booking',
    description: 'Book appointments hands-free using voice commands. Perfect for accessibility and convenience.',
    link: '#booking',
    color: 'from-blue-500 to-cyan-600',
    features: ['Speech Recognition', 'Multi-language', 'Instant Confirmation'],
  },
  {
    icon: DocumentTextIcon,
    title: 'AI Medical Scribe',
    description: 'Automatic clinical documentation from doctor-patient conversations. Save hours of paperwork.',
    link: '/ai-scribe',
    color: 'from-emerald-500 to-teal-600',
    features: ['Real-time Transcription', 'SOAP Notes', 'ICD-10 Coding'],
  },
  {
    icon: ChartBarIcon,
    title: 'Predictive Analytics',
    description: 'AI-powered risk assessment and early warning systems for proactive patient care.',
    link: '/patient-risk',
    color: 'from-orange-500 to-red-600',
    features: ['Risk Prediction', 'Early Warnings', 'Outcome Analysis'],
  },
  {
    icon: EyeIcon,
    title: 'Medical Imaging AI',
    description: 'Advanced AI analysis of X-rays, CT scans, and MRIs for faster, more accurate diagnosis.',
    link: '/medical-imaging',
    color: 'from-pink-500 to-rose-600',
    features: ['Image Analysis', 'Pattern Detection', 'Report Generation'],
  },
  {
    icon: BeakerIcon,
    title: 'Drug Interaction Checker',
    description: 'AI-powered medication safety system to prevent adverse drug interactions.',
    link: '/drug-interactions',
    color: 'from-amber-500 to-orange-600',
    features: ['Interaction Alerts', 'Dosage Checks', 'Allergy Warnings'],
  },
];

// Featured Services with enhanced design
const featuredServices = [
  {
    icon: HeartIcon,
    title: 'Cardiology',
    description: 'Comprehensive heart care including diagnostics, interventional cardiology, and rehabilitation.',
    color: 'bg-gradient-to-br from-red-500 to-rose-600',
    lightBg: 'bg-red-50',
  },
  {
    icon: CpuChipIcon,
    title: 'Neurology',
    description: 'Expert care for brain and nervous system disorders with advanced imaging technology.',
    color: 'bg-gradient-to-br from-purple-500 to-violet-600',
    lightBg: 'bg-purple-50',
  },
  {
    icon: UserGroupIcon,
    title: 'Pediatrics',
    description: 'Specialized healthcare for infants, children, and adolescents in a child-friendly environment.',
    color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    lightBg: 'bg-blue-50',
  },
  {
    icon: BuildingOffice2Icon,
    title: 'Orthopedics',
    description: 'Treatment for bone, joint, and muscle conditions including sports medicine and joint replacement.',
    color: 'bg-gradient-to-br from-green-500 to-emerald-600',
    lightBg: 'bg-green-50',
  },
  {
    icon: EyeIcon,
    title: 'Ophthalmology',
    description: 'Complete eye care from routine exams to advanced surgical procedures like LASIK.',
    color: 'bg-gradient-to-br from-cyan-500 to-teal-600',
    lightBg: 'bg-cyan-50',
  },
  {
    icon: ScissorsIcon,
    title: 'General Surgery',
    description: 'Minimally invasive and traditional surgical procedures with expert surgical teams.',
    color: 'bg-gradient-to-br from-orange-500 to-amber-600',
    lightBg: 'bg-orange-50',
  },
  {
    icon: BeakerIcon,
    title: 'Laboratory',
    description: 'State-of-the-art diagnostic testing with AI-assisted analysis for quick and accurate results.',
    color: 'bg-gradient-to-br from-indigo-500 to-blue-600',
    lightBg: 'bg-indigo-50',
  },
  {
    icon: VideoCameraIcon,
    title: 'Telemedicine',
    description: 'Virtual consultations with doctors from the comfort of your home, powered by AI assistance.',
    color: 'bg-gradient-to-br from-teal-500 to-cyan-600',
    lightBg: 'bg-teal-50',
  },
];

// Quick Services with icons
const quickServices = [
  { icon: CalendarDaysIcon, title: 'Book Appointment', description: 'AI-powered scheduling', link: '#booking', color: 'from-blue-500 to-blue-600' },
  { icon: ChatBubbleBottomCenterTextIcon, title: 'Symptom Checker', description: 'Get instant assessment', link: '/symptom-checker', color: 'from-violet-500 to-purple-600' },
  { icon: DocumentTextIcon, title: 'Patient Portal', description: 'Access your records', link: '/patient-portal/login', color: 'from-teal-500 to-cyan-600' },
  { icon: TruckIcon, title: 'Ambulance', description: '24/7 Emergency', link: 'tel:108', color: 'from-red-500 to-rose-600' },
];

// Stats with animation
const stats = [
  { value: '50,000+', label: 'Happy Patients', icon: UserGroupIcon, suffix: '' },
  { value: '200+', label: 'Expert Doctors', icon: AcademicCapIcon, suffix: '' },
  { value: '25+', label: 'Years Experience', icon: TrophyIcon, suffix: '' },
  { value: '98%', label: 'Success Rate', icon: ChartBarIcon, suffix: '' },
];

// Time slots
const timeSlots = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
];

// Testimonials
const testimonials = [
  {
    name: 'Rajesh Kumar',
    role: 'Cardiac Patient',
    content: 'The AI booking system recommended the perfect cardiologist. The voice booking feature made it incredibly easy while I was recovering. Exceptional care!',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
  },
  {
    name: 'Priya Sharma',
    role: 'Regular Patient',
    content: 'The AI Symptom Checker accurately identified my condition and connected me with the right specialist. Modern healthcare at its best!',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
  },
  {
    name: 'Dr. Mohammed Ali',
    role: 'Referring Physician',
    content: 'As a physician, I recommend Spetaar for their cutting-edge AI tools and exceptional patient care. The medical imaging AI is remarkable.',
    rating: 5,
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&q=80',
  },
];

// Why choose us features
const whyChooseUs = [
  {
    icon: CpuChipIcon,
    title: 'AI-Powered Diagnostics',
    description: 'Advanced artificial intelligence assists our doctors in faster, more accurate diagnoses.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: ShieldCheckIcon,
    title: 'NABH Accredited',
    description: 'International quality standards with comprehensive patient safety protocols.',
    color: 'bg-green-100 text-green-600',
  },
  {
    icon: ClockIcon,
    title: '24/7 Availability',
    description: 'Round-the-clock emergency services and AI health assistant always available.',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    icon: GlobeAltIcon,
    title: 'Telemedicine Ready',
    description: 'Consult with specialists from anywhere using our advanced video consultation platform.',
    color: 'bg-teal-100 text-teal-600',
  },
];

interface BookingResult {
  confirmationCode: string;
  tokenNumber: number;
  appointmentDate: string;
  time: string;
  patient: {
    name: string;
    email: string;
    mrn: string;
  };
  doctor: {
    name: string;
    department: string;
  };
}

interface AIAnalysis {
  suggestedDepartment: string;
  confidence: number;
  reasoning: string;
  urgency: string;
  recommendedTests?: string[];
}

interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

export default function Home() {
  const [currentBanner, setCurrentBanner] = useState(0);
  const [bookingForm, setBookingForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    department: '',
    preferredDate: '',
    preferredTime: '',
    symptoms: '',
  });
  const [aiSuggestion, setAiSuggestion] = useState<AIAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const recognitionRef = useRef<any>(null);

  // Chatbot state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'bot',
      text: "Hello! I'm your AI Health Assistant. How can I help you today? You can describe your symptoms, ask about our services, or get help booking an appointment.",
      timestamp: new Date(),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Mobile menu
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Scroll state for nav
  const [isScrolled, setIsScrolled] = useState(false);

  // Handle scroll for sticky nav
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check voice support
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setBookingForm(prev => ({
            ...prev,
            symptoms: prev.symptoms + ' ' + finalTranscript
          }));
        }
        setVoiceText(interimTranscript);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setVoiceText('');
      };
    }
  }, []);

  // Auto-rotate banners
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Handle department from symptom checker redirect
  useEffect(() => {
    // Check URL hash for department parameter
    const hash = window.location.hash;
    if (hash.includes('#booking')) {
      const params = new URLSearchParams(hash.split('?')[1] || '');
      const urlDepartment = params.get('department');

      // Check sessionStorage for triage result
      const storedTriage = sessionStorage.getItem('triageResult');
      let triageData = null;
      if (storedTriage) {
        try {
          triageData = JSON.parse(storedTriage);
          sessionStorage.removeItem('triageResult'); // Clear after reading
        } catch (e) {
          console.error('Failed to parse triage result');
        }
      }

      // Set department from URL or triage data
      const department = urlDepartment || triageData?.department;
      if (department) {
        setBookingForm(prev => ({
          ...prev,
          department: department,
          symptoms: triageData?.symptoms || prev.symptoms,
        }));

        // Scroll to booking section
        setTimeout(() => {
          const bookingSection = document.getElementById('booking');
          if (bookingSection) {
            bookingSection.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
    }
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const nextBanner = () => setCurrentBanner((prev) => (prev + 1) % banners.length);
  const prevBanner = () => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);

  // Toggle voice recording
  const toggleVoice = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // AI symptom analysis
  const analyzeSymptoms = async () => {
    if (bookingForm.symptoms.length < 10) {
      setAiSuggestion(null);
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_URL}/public/ai/analyze-symptoms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: bookingForm.symptoms }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setAiSuggestion(data.data);
          if (data.data.suggestedDepartment && data.data.confidence > 0.7) {
            const deptMap: Record<string, string> = {
              'Cardiology': 'cardiology',
              'Neurology': 'neurology',
              'Pediatrics': 'pediatrics',
              'Orthopedics': 'orthopedics',
              'Ophthalmology': 'ophthalmology',
              'Dermatology': 'dermatology',
              'Gastroenterology': 'gastroenterology',
              'General Medicine': 'general',
              'ENT': 'ent',
            };
            const deptValue = deptMap[data.data.suggestedDepartment];
            if (deptValue && !bookingForm.department) {
              setBookingForm(prev => ({ ...prev, department: deptValue }));
            }
          }
        }
      }
    } catch {
      localAnalyzeSymptoms();
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Local fallback for symptom analysis
  const localAnalyzeSymptoms = () => {
    const symptoms = bookingForm.symptoms.toLowerCase();
    let suggestion: AIAnalysis | null = null;

    if (symptoms.includes('chest') || symptoms.includes('heart') || symptoms.includes('palpitation')) {
      suggestion = {
        suggestedDepartment: 'Cardiology',
        confidence: 0.85,
        reasoning: 'Symptoms indicate possible cardiac issues. Immediate evaluation recommended.',
        urgency: symptoms.includes('pain') ? 'high' : 'medium',
      };
    } else if (symptoms.includes('head') || symptoms.includes('dizzy') || symptoms.includes('migraine')) {
      suggestion = {
        suggestedDepartment: 'Neurology',
        confidence: 0.8,
        reasoning: 'Symptoms suggest neurological evaluation needed.',
        urgency: 'medium',
      };
    } else if (symptoms.includes('child') || symptoms.includes('kid') || symptoms.includes('baby')) {
      suggestion = {
        suggestedDepartment: 'Pediatrics',
        confidence: 0.9,
        reasoning: 'Pediatric care recommended for children.',
        urgency: 'medium',
      };
    } else if (symptoms.includes('bone') || symptoms.includes('joint') || symptoms.includes('fracture')) {
      suggestion = {
        suggestedDepartment: 'Orthopedics',
        confidence: 0.85,
        reasoning: 'Musculoskeletal symptoms detected.',
        urgency: symptoms.includes('fracture') ? 'high' : 'medium',
      };
    } else if (symptoms.includes('eye') || symptoms.includes('vision')) {
      suggestion = {
        suggestedDepartment: 'Ophthalmology',
        confidence: 0.85,
        reasoning: 'Eye-related symptoms detected.',
        urgency: 'low',
      };
    } else if (symptoms.length > 15) {
      suggestion = {
        suggestedDepartment: 'General Medicine',
        confidence: 0.6,
        reasoning: 'General evaluation recommended for comprehensive assessment.',
        urgency: 'low',
      };
    }

    setAiSuggestion(suggestion);
  };

  useEffect(() => {
    const debounce = setTimeout(analyzeSymptoms, 800);
    return () => clearTimeout(debounce);
  }, [bookingForm.symptoms]);

  // Handle chat submit
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      text: chatInput.trim(),
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Try to use the symptom checker API
      const response = await fetch(`${API_URL}/ai/symptom-checker/quick-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: userMessage.text }),
      });

      let botResponse = '';

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          const { triageLevel, suggestedDepartment, confidence } = data.data;
          botResponse = `Based on your symptoms, I recommend:\n\n**Department:** ${suggestedDepartment}\n**Priority:** ${triageLevel}\n**Confidence:** ${Math.round(confidence * 100)}%\n\nWould you like me to help you book an appointment?`;
        }
      } else {
        // Fallback response
        const symptoms = userMessage.text.toLowerCase();
        if (symptoms.includes('appointment') || symptoms.includes('book')) {
          botResponse = "I'd be happy to help you book an appointment! Please scroll down to our booking section or tell me your symptoms, and I'll recommend the right specialist for you.";
        } else if (symptoms.includes('emergency') || symptoms.includes('urgent')) {
          botResponse = "For medical emergencies, please call 108 immediately or visit our 24/7 Emergency Department. If this is not an emergency, I can help you find the right specialist.";
        } else if (symptoms.includes('doctor') || symptoms.includes('specialist')) {
          botResponse = "We have over 200 expert doctors across 50+ specializations. Tell me your symptoms, and I'll recommend the best specialist for your needs.";
        } else {
          botResponse = `Thank you for sharing. Based on what you've described, I recommend consulting with a specialist. Would you like me to help you:\n\n1. Book an appointment\n2. Use our detailed Symptom Checker\n3. Learn about our AI services\n\nJust let me know how I can assist you further!`;
        }
      }

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        text: botResponse,
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, botMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        text: "I'm having trouble connecting right now. Please try our Symptom Checker page for a detailed assessment, or call us at 1800-123-4567 for immediate assistance.",
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Submit booking
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/public/book-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: bookingForm.fullName,
          email: bookingForm.email,
          phone: bookingForm.phone,
          department: bookingForm.department || 'general',
          preferredDate: bookingForm.preferredDate,
          preferredTime: bookingForm.preferredTime,
          reason: bookingForm.symptoms,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setBookingResult(data.data);
        setBookingForm({
          fullName: '',
          phone: '',
          email: '',
          department: '',
          preferredDate: '',
          preferredTime: '',
          symptoms: '',
        });
        setAiSuggestion(null);
      } else {
        setError(data.message || 'Failed to book appointment. Please try again.');
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBooking = () => {
    setBookingResult(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Floating AI Chatbot Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isChatOpen && (
          <button
            onClick={() => setIsChatOpen(true)}
            className="group relative w-16 h-16 bg-gradient-to-br from-violet-600 to-purple-700 rounded-full shadow-2xl hover:shadow-purple-500/30 transition-all duration-300 hover:scale-110 flex items-center justify-center"
          >
            <ChatBubbleBottomCenterTextIcon className="w-7 h-7 text-white" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
            <span className="absolute -top-12 right-0 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              AI Health Assistant
            </span>
          </button>
        )}
      </div>

      {/* AI Chatbot Panel */}
      {isChatOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[550px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <SparklesSolid className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">AI Health Assistant</h3>
                <p className="text-xs text-white/80">Online | Powered by AI</p>
              </div>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    message.type === 'user'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-violet-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleChatSubmit} className="p-4 border-t border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Describe your symptoms..."
                className="flex-1 px-4 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition-all"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="p-3 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center justify-center gap-4 mt-3">
              <Link
                to="/symptom-checker"
                className="text-xs text-violet-600 hover:text-violet-700 font-medium"
              >
                Full Symptom Checker →
              </Link>
            </div>
          </form>
        </div>
      )}

      {/* Top Announcement Bar */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white py-2.5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap justify-between items-center gap-2 relative">
          <div className="flex items-center gap-6 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <SparklesIcon className="w-4 h-4" />
              AI-Powered Healthcare
            </span>
            <span className="hidden sm:flex items-center gap-2">
              <PhoneIcon className="w-4 h-4" />
              Emergency: 108
            </span>
            <span className="hidden md:flex items-center gap-2">
              <ClockIcon className="w-4 h-4" />
              Open 24/7
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/symptom-checker" className="hidden sm:flex items-center gap-1.5 hover:text-white/80 transition-colors">
              <BoltIcon className="w-4 h-4" />
              Try AI Symptom Checker
            </Link>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className={`sticky top-0 z-40 transition-all duration-300 ${isScrolled ? 'bg-white/95 backdrop-blur-lg shadow-lg' : 'bg-white'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <HeartSolid className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" />
              </div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Spetaar</span>
                <span className="text-2xl font-light text-blue-600"> Pro</span>
                <p className="text-xs text-gray-500 -mt-0.5">AI-Powered Healthcare</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              <a href="#services" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">Services</a>
              <a href="#ai-services" className="text-gray-600 hover:text-blue-600 font-medium transition-colors flex items-center gap-1">
                <SparklesIcon className="w-4 h-4" />
                AI Features
              </a>
              <a href="#booking" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">Book Online</a>
              <a href="#about" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">About</a>
              <a href="#contact" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">Contact</a>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Link
                to="/symptom-checker"
                className="hidden lg:flex items-center gap-2 px-4 py-2.5 text-violet-600 hover:text-violet-700 font-semibold transition-colors"
              >
                <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                AI Chat
              </Link>
              <a
                href={`https://wa.me/${(import.meta.env.VITE_HOSPITAL_WHATSAPP_NUMBER || '+971501234567').replace(/\+/g, '')}?text=${encodeURIComponent('Hi, I would like to book an appointment')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden lg:flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/40"
                title="Book via WhatsApp"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <span className="hidden xl:inline">WhatsApp</span>
              </a>
              <Link
                to="/patient-portal/login"
                className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-teal-500/30 hover:shadow-teal-500/40"
              >
                <UserGroupIcon className="w-5 h-5" />
                Patient Portal
              </Link>
              <Link
                to="/login"
                className="hidden md:flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-blue-600 font-medium transition-colors border border-gray-200 hover:border-blue-300 rounded-lg"
              >
                <ShieldCheckIcon className="w-4 h-4" />
                Staff
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 text-gray-600 hover:text-blue-600"
              >
                <Bars3Icon className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 py-4 px-4 shadow-lg">
            <div className="flex flex-col gap-3">
              <a href="#services" className="px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">Services</a>
              <a href="#ai-services" className="px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2">
                <SparklesIcon className="w-4 h-4" />
                AI Features
              </a>
              <a href="#booking" className="px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">Book Online</a>
              <a href="#about" className="px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">About</a>
              <a href="#contact" className="px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">Contact</a>
              <Link
                to="/symptom-checker"
                className="px-4 py-2 text-violet-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg transition-colors flex items-center gap-2"
              >
                <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
                AI Symptom Checker
              </Link>
              <a
                href={`https://wa.me/${(import.meta.env.VITE_HOSPITAL_WHATSAPP_NUMBER || '+971501234567').replace(/\+/g, '')}?text=${encodeURIComponent('Hi, I would like to book an appointment')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                <div>
                  <div className="font-semibold">Book via WhatsApp</div>
                  <div className="text-xs text-green-100">AI-powered booking assistant</div>
                </div>
              </a>
              <div className="border-t border-gray-100 my-2 pt-3">
                <p className="px-4 text-xs text-gray-400 uppercase tracking-wider mb-2">Login Options</p>
                <Link
                  to="/patient-portal/login"
                  className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg mb-2"
                >
                  <UserGroupIcon className="w-5 h-5" />
                  <div>
                    <div className="font-semibold">Patient Portal</div>
                    <div className="text-xs text-teal-100">Access your health records</div>
                  </div>
                </Link>
                <Link
                  to="/login"
                  className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-200"
                >
                  <ShieldCheckIcon className="w-5 h-5" />
                  <div>
                    <div className="font-medium">Staff Login</div>
                    <div className="text-xs text-gray-400">Hospital employees only</div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Full-Screen Hero Banner Slider */}
      <section className="relative h-screen min-h-[700px] max-h-[900px] overflow-hidden">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`absolute inset-0 transition-all duration-1000 ${
              index === currentBanner ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
          >
            {/* Background Image with Parallax Effect */}
            <div className="absolute inset-0">
              <img
                src={banner.image}
                alt={banner.title}
                className="w-full h-full object-cover"
                style={{ transform: index === currentBanner ? 'scale(1.05)' : 'scale(1.1)' }}
              />
              <div className={`absolute inset-0 bg-gradient-to-r ${banner.gradient}`} />
              {/* Decorative Pattern */}
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGMxLjI1NCAwIDIuNDc4LS4xMjggMy42NTktLjM3MiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMiIvPjwvZz48L3N2Zz4=')] opacity-20" />
            </div>

            {/* Content */}
            <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center">
              <div className="max-w-3xl">
                {/* Subtitle Badge */}
                <span className="inline-flex items-center gap-2 px-5 py-2 bg-white/10 backdrop-blur-md rounded-full text-sm font-semibold text-white mb-6 border border-white/20">
                  <SparklesIcon className="w-4 h-4" />
                  {banner.subtitle}
                </span>

                {/* Title */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-6 leading-tight">
                  {banner.title}
                </h1>

                {/* Description */}
                <p className="text-lg md:text-xl text-white/90 mb-10 leading-relaxed max-w-2xl">
                  {banner.description}
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-wrap gap-4">
                  <a
                    href={banner.ctaLink}
                    className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-2xl"
                  >
                    {banner.cta}
                    <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </a>
                  <a
                    href={banner.secondaryLink}
                    className="group inline-flex items-center gap-3 px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/30"
                  >
                    <PlayIcon className="w-5 h-5" />
                    {banner.secondaryCta}
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Banner Navigation */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6">
          <button
            onClick={prevBanner}
            className="p-3 bg-white/10 hover:bg-white/25 rounded-full backdrop-blur-md transition-all border border-white/20"
          >
            <ChevronLeftIcon className="w-6 h-6 text-white" />
          </button>
          <div className="flex gap-3">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentBanner(index)}
                className={`transition-all ${
                  index === currentBanner
                    ? 'w-12 h-3 bg-white rounded-full'
                    : 'w-3 h-3 bg-white/40 hover:bg-white/60 rounded-full'
                }`}
              />
            ))}
          </div>
          <button
            onClick={nextBanner}
            className="p-3 bg-white/10 hover:bg-white/25 rounded-full backdrop-blur-md transition-all border border-white/20"
          >
            <ChevronRightIcon className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 right-10 hidden lg:flex flex-col items-center gap-2 text-white/60">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-white/60 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* Quick Services Cards - Floating on banner */}
      <section className="relative z-10 -mt-20 mb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {quickServices.map((service) => (
              <a
                key={service.title}
                href={service.link}
                className="group relative flex flex-col items-center gap-3 p-6 bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 border border-gray-100 overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                <div className={`w-14 h-14 bg-gradient-to-br ${service.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                  <service.icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-center">
                  <span className="font-bold text-gray-900">{service.title}</span>
                  <p className="text-xs text-gray-500 mt-0.5">{service.description}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* AI Services Showcase */}
      <section id="ai-services" className="py-20 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMCwwLDAsMC4wNSkiLz48L2c+PC9zdmc+')] opacity-50" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Section Header */}
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 rounded-full text-sm font-semibold mb-4">
              <SparklesIcon className="w-4 h-4" />
              Powered by Artificial Intelligence
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Experience AI-Powered Healthcare
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Our cutting-edge AI services provide faster diagnoses, smarter recommendations, and personalized care for every patient.
            </p>
          </div>

          {/* AI Services Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiServices.map((service, index) => (
              <Link
                key={service.title}
                to={service.link}
                className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 overflow-hidden"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Gradient Overlay on Hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                {/* Icon */}
                <div className={`w-16 h-16 bg-gradient-to-br ${service.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <service.icon className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-violet-700 transition-colors">
                  {service.title}
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {service.description}
                </p>

                {/* Feature Pills */}
                <div className="flex flex-wrap gap-2">
                  {service.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* Arrow */}
                <div className="absolute top-8 right-8 w-10 h-10 bg-gray-100 group-hover:bg-violet-100 rounded-full flex items-center justify-center transition-all group-hover:translate-x-1">
                  <ArrowRightIcon className="w-5 h-5 text-gray-400 group-hover:text-violet-600 transition-colors" />
                </div>
              </Link>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <Link
              to="/symptom-checker"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-700 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-purple-800 transition-all shadow-lg shadow-violet-500/30"
            >
              <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
              Start AI Symptom Check
              <ArrowRightIcon className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* AI Booking Section */}
      <section id="booking" className="py-20 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Left Side - Info */}
            <div className="lg:sticky lg:top-32">
              <span className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 rounded-full text-sm font-semibold mb-6">
                <SparklesIcon className="w-4 h-4" />
                AI-Powered Smart Booking
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Book Your Appointment with AI Assistance
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Simply describe your symptoms using text or voice. Our AI will analyze and recommend the right specialist, making healthcare access effortless.
              </p>

              {/* Features */}
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MicrophoneIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Voice Booking</h4>
                    <p className="text-sm text-gray-600">Speak your symptoms naturally, hands-free booking experience</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CpuChipIcon className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Smart Recommendations</h4>
                    <p className="text-sm text-gray-600">AI analyzes symptoms and suggests the right specialist</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Instant Confirmation</h4>
                    <p className="text-sm text-gray-600">Get immediate appointment confirmation with token number</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side - Booking Form */}
            <div>
              {bookingResult ? (
                <div className="bg-white rounded-3xl shadow-2xl p-8 border border-green-200">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                      <CheckCircleSolid className="w-14 h-14 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Appointment Confirmed!</h3>
                    <p className="text-gray-600 mb-8">Your appointment has been successfully booked.</p>

                    <div className="bg-gray-50 rounded-2xl p-6 text-left mb-8">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Confirmation Code</p>
                          <p className="text-2xl font-bold text-blue-600">{bookingResult.confirmationCode}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Token Number</p>
                          <p className="text-2xl font-bold text-gray-900">#{bookingResult.tokenNumber}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Date & Time</p>
                          <p className="font-semibold text-gray-900">
                            {new Date(bookingResult.appointmentDate).toLocaleDateString('en-IN', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                          <p className="text-blue-600 font-medium">{bookingResult.time}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Doctor</p>
                          <p className="font-semibold text-gray-900">{bookingResult.doctor.name}</p>
                          <p className="text-sm text-gray-600">{bookingResult.doctor.department}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button
                        onClick={resetBooking}
                        className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg"
                      >
                        Book Another Appointment
                      </button>
                      <Link
                        to="/login"
                        className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                      >
                        Go to Dashboard
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
                  {/* Error Message */}
                  {error && (
                    <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                      <XCircleIcon className="w-5 h-5 flex-shrink-0" />
                      <p className="flex-1">{error}</p>
                      <button onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded-lg">
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-5">
                    {/* Full Name */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={bookingForm.fullName}
                        onChange={(e) => setBookingForm({ ...bookingForm, fullName: e.target.value })}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={bookingForm.phone}
                        onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                        placeholder="Enter your phone number"
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={bookingForm.email}
                        onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                        placeholder="Enter your email"
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                    {/* Date */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Preferred Date *</label>
                      <input
                        type="date"
                        required
                        value={bookingForm.preferredDate}
                        onChange={(e) => setBookingForm({ ...bookingForm, preferredDate: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                      />
                    </div>

                    {/* Time */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Preferred Time *</label>
                      <select
                        required
                        value={bookingForm.preferredTime}
                        onChange={(e) => setBookingForm({ ...bookingForm, preferredTime: e.target.value })}
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                      >
                        <option value="">Select Time Slot</option>
                        {timeSlots.map((slot) => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))}
                      </select>
                    </div>

                    {/* Department */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Department
                        {aiSuggestion && (
                          <span className="ml-2 text-green-600 font-normal text-xs">(AI: {aiSuggestion.suggestedDepartment})</span>
                        )}
                      </label>
                      <select
                        value={bookingForm.department}
                        onChange={(e) => setBookingForm({ ...bookingForm, department: e.target.value })}
                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all"
                      >
                        <option value="">Let AI suggest based on symptoms</option>
                        <option value="general">General Medicine</option>
                        <option value="cardiology">Cardiology</option>
                        <option value="neurology">Neurology</option>
                        <option value="pediatrics">Pediatrics</option>
                        <option value="orthopedics">Orthopedics</option>
                        <option value="ophthalmology">Ophthalmology</option>
                        <option value="dermatology">Dermatology</option>
                        <option value="gastroenterology">Gastroenterology</option>
                        <option value="ent">ENT</option>
                      </select>
                    </div>

                    {/* Symptoms with Voice */}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Describe Your Symptoms
                        <span className="ml-2 font-normal text-blue-600 text-xs">(Type or use voice)</span>
                      </label>
                      <div className="relative">
                        <textarea
                          value={bookingForm.symptoms}
                          onChange={(e) => setBookingForm({ ...bookingForm, symptoms: e.target.value })}
                          placeholder="Describe your symptoms here... Our AI will analyze and suggest the right department."
                          rows={4}
                          className="w-full px-4 py-3.5 pr-16 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all resize-none"
                        />

                        {/* Voice Button */}
                        {voiceSupported && (
                          <button
                            type="button"
                            onClick={toggleVoice}
                            className={`absolute right-3 top-3 p-3 rounded-xl transition-all ${
                              isListening
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                                : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                            }`}
                            title={isListening ? 'Stop recording' : 'Start voice input'}
                          >
                            {isListening ? (
                              <StopIcon className="w-5 h-5" />
                            ) : (
                              <MicrophoneIcon className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Voice Status */}
                      {isListening && (
                        <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 px-4 py-2 rounded-lg">
                          <span className="flex h-3 w-3 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                          </span>
                          <span className="text-sm font-medium">Listening... Speak your symptoms</span>
                          {voiceText && <span className="text-gray-500 italic ml-2">"{voiceText}"</span>}
                        </div>
                      )}

                      {/* AI Analysis Loading */}
                      {isAnalyzing && (
                        <div className="mt-3 flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-lg">
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          <span className="text-sm font-medium">AI is analyzing your symptoms...</span>
                        </div>
                      )}

                      {/* AI Suggestion */}
                      {aiSuggestion && !isAnalyzing && (
                        <div className="mt-4 p-5 bg-gradient-to-r from-blue-50 via-violet-50 to-purple-50 border border-blue-200 rounded-xl">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                              <SparklesIcon className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-bold text-gray-900">AI Recommendation</p>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                                  aiSuggestion.urgency === 'high' ? 'bg-red-100 text-red-700' :
                                  aiSuggestion.urgency === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {aiSuggestion.urgency} priority
                                </span>
                              </div>
                              <p className="text-gray-700">
                                Suggested: <strong className="text-violet-700">{aiSuggestion.suggestedDepartment}</strong>
                                <span className="text-sm text-gray-500 ml-2">({Math.round(aiSuggestion.confidence * 100)}% confidence)</span>
                              </p>
                              <p className="text-sm text-gray-600 mt-1">{aiSuggestion.reasoning}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Submit */}
                    <div className="md:col-span-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-blue-400 disabled:to-indigo-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <>
                            <ArrowPathIcon className="w-5 h-5 animate-spin" />
                            Booking Appointment...
                          </>
                        ) : (
                          <>
                            <CalendarDaysIcon className="w-5 h-5" />
                            Book Appointment
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Services */}
      <section id="services" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-5 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-4">
              <ClipboardDocumentCheckIcon className="w-4 h-4" />
              Comprehensive Healthcare
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Our Medical Services
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              World-class healthcare across all major medical specialties with AI-enhanced diagnostics and personalized care.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredServices.map((service) => (
              <div
                key={service.title}
                className="group relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 overflow-hidden"
              >
                <div className={`absolute top-0 left-0 right-0 h-1 ${service.color}`} />
                <div className={`w-16 h-16 ${service.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <service.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{service.title}</h3>
                <p className="text-gray-600 leading-relaxed">{service.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMtOS45NDEgMC0xOCA4LjA1OS0xOCAxOHM4LjA1OSAxOCAxOCAxOGMxLjI1NCAwIDIuNDc4LS4xMjggMy42NTktLjM3MiIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMiIvPjwvZz48L3N2Zz4=')] opacity-20" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20">
                  <stat.icon className="w-10 h-10 text-white" />
                </div>
                <p className="text-4xl md:text-5xl font-bold text-white mb-2">{stat.value}</p>
                <p className="text-blue-100 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section id="about" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-5 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold mb-6">
                <ShieldCheckIcon className="w-4 h-4" />
                Why Choose Us
              </span>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Excellence in Healthcare, Powered by Innovation
              </h2>
              <p className="text-lg text-gray-600 mb-10 leading-relaxed">
                At Spetaar Pro, we combine decades of medical expertise with cutting-edge AI technology to deliver healthcare that's faster, smarter, and more personalized than ever before.
              </p>

              <div className="grid sm:grid-cols-2 gap-6">
                {whyChooseUs.map((feature) => (
                  <div key={feature.title} className="flex items-start gap-4">
                    <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <feature.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 mb-1">{feature.title}</h4>
                      <p className="text-sm text-gray-600">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1551076805-e1869033e561?w=800&q=80"
                  alt="Medical Team"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              </div>

              {/* Floating Card */}
              <div className="absolute -bottom-8 -left-8 bg-white rounded-2xl p-6 shadow-2xl border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <CheckCircleSolid className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">NABH Accredited</p>
                    <p className="text-sm text-gray-500">Quality Assured Healthcare</p>
                  </div>
                </div>
              </div>

              {/* Stats Card */}
              <div className="absolute -top-6 -right-6 bg-white rounded-2xl p-5 shadow-2xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <SparklesSolid className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">AI-Powered</p>
                    <p className="text-xs text-gray-500">Smart Healthcare</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-5 py-2 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold mb-4">
              <StarIcon className="w-4 h-4" />
              Patient Testimonials
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              What Our Patients Say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div key={testimonial.name} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-1 mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <StarSolid key={i} className="w-5 h-5 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-8 leading-relaxed italic">"{testimonial.content}"</p>
                <div className="flex items-center gap-4">
                  <img src={testimonial.image} alt={testimonial.name} className="w-14 h-14 rounded-full object-cover ring-4 ring-gray-100" />
                  <div>
                    <p className="font-bold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-30" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/20">
            <SparklesSolid className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Experience AI-Powered Healthcare Today
          </h2>
          <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Our team is available 24/7 to help you with any medical inquiry. Try our AI symptom checker or book an appointment now.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/symptom-checker"
              className="group px-8 py-4 bg-white text-violet-700 font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-2xl flex items-center gap-2"
            >
              <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
              Try AI Symptom Checker
              <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#booking"
              className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl hover:bg-white/20 transition-all border border-white/30 flex items-center gap-2"
            >
              <CalendarDaysIcon className="w-5 h-5" />
              Book Appointment
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-gray-400 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
                  <HeartSolid className="w-7 h-7 text-white" />
                </div>
                <div>
                  <span className="text-2xl font-bold text-white">Spetaar</span>
                  <span className="text-2xl font-light text-blue-400"> Pro</span>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-6">
                Providing world-class AI-powered healthcare services with compassion and excellence since 1998.
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-6">Quick Links</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#services" className="hover:text-white transition-colors">Our Services</a></li>
                <li><a href="#ai-services" className="hover:text-white transition-colors">AI Features</a></li>
                <li><a href="#booking" className="hover:text-white transition-colors">Book Appointment</a></li>
                <li><Link to="/symptom-checker" className="hover:text-white transition-colors">AI Symptom Checker</Link></li>
                <li><Link to="/patient-portal/login" className="hover:text-white transition-colors flex items-center gap-1"><UserGroupIcon className="w-4 h-4" />Patient Portal</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors text-gray-500 text-xs">Staff Login</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-semibold mb-6">Contact Us</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <PhoneIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">+91 1800-123-4567</p>
                    <p className="text-xs text-gray-500">24/7 Helpline</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <MapPinIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p>123 Healthcare Avenue</p>
                    <p>Medical City, State 12345</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <ClockIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-medium">Open 24/7</p>
                    <p className="text-xs text-gray-500">Emergency Services Always Available</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* Emergency */}
            <div>
              <h4 className="text-white font-semibold mb-6">Emergency</h4>
              <p className="text-sm mb-6">For medical emergencies, call our 24/7 emergency hotline immediately:</p>
              <a
                href="tel:108"
                className="inline-flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl font-semibold hover:from-red-700 hover:to-rose-700 transition-all shadow-lg"
              >
                <PhoneIcon className="w-6 h-6" />
                <div>
                  <p className="text-lg">Call: 108</p>
                  <p className="text-xs font-normal opacity-80">24/7 Emergency Line</p>
                </div>
              </a>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm">&copy; 2025 Spetaar Pro. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
