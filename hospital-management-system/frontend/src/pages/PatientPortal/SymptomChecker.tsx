import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  ShieldCheckIcon,
  HeartIcon,
  SparklesIcon,
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';
import SymptomCheckerChat, { TriageResult } from '../../components/ai/SymptomCheckerChat';

const FEATURES = [
  {
    icon: SparklesIcon,
    title: 'AI-Powered Analysis',
    description: 'Advanced algorithms analyze your symptoms for accurate recommendations',
  },
  {
    icon: ClockIcon,
    title: 'Quick Assessment',
    description: 'Get results in under 5 minutes with our streamlined questionnaire',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Private & Secure',
    description: 'Your health information is encrypted and protected',
  },
  {
    icon: HeartIcon,
    title: 'Care Guidance',
    description: 'Receive personalized advice on next steps for your health',
  },
];

const HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Describe Your Symptoms',
    description: 'Tell us what you are experiencing in your own words',
  },
  {
    step: 2,
    title: 'Answer Questions',
    description: 'Respond to follow-up questions about your symptoms',
  },
  {
    step: 3,
    title: 'Get Recommendations',
    description: 'Receive personalized triage and care guidance',
  },
];

const DISCLAIMER_ITEMS = [
  'This tool provides general health information and is not a substitute for professional medical advice',
  'Always consult a healthcare provider for diagnosis and treatment',
  'If you have a medical emergency, call 911 or go to the nearest emergency room',
  'Results are based on the information you provide and may not be comprehensive',
];

export default function SymptomChecker() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showChecker, setShowChecker] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [completedResult, setCompletedResult] = useState<TriageResult | null>(null);

  // Check URL params for autoStart (from AI-guided booking)
  useEffect(() => {
    const shouldAutoStart = searchParams.get('autoStart') === 'true';
    if (shouldAutoStart) {
      setShowChecker(true);
      setAutoStart(true);
      // Clear the URL param
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleComplete = (result: TriageResult) => {
    setCompletedResult(result);
  };

  const handleBookAppointment = (department: string) => {
    // Navigate to patient portal appointment booking with pre-filled info from symptom checker
    const params = new URLSearchParams({
      book: 'true',
      department: department,
    });

    // Add symptoms summary if available
    if (completedResult?.symptoms_summary && completedResult.symptoms_summary.length > 0) {
      params.set('symptoms', completedResult.symptoms_summary.slice(0, 5).join(', '));
    }

    // Add urgency level
    if (completedResult?.urgency) {
      params.set('urgency', completedResult.urgency);
    }

    // Add primary concern
    if (completedResult?.primary_concern) {
      params.set('concern', completedResult.primary_concern);
    }

    navigate(`/patient-portal/appointments?${params.toString()}`);
  };

  const handleStartChecker = () => {
    setShowChecker(true);
    setCompletedResult(null);
  };

  if (showChecker) {
    return (
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => setShowChecker(false)}
          className="mb-4 text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors"
        >
          <ArrowRightIcon className="h-4 w-4 rotate-180" />
          Back to Overview
        </button>

        {/* Symptom Checker Chat */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden min-h-[700px] flex flex-col">
          <SymptomCheckerChat
            onComplete={handleComplete}
            onBookAppointment={handleBookAppointment}
            autoStart={autoStart}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-3xl overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="hero-pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#hero-pattern)" />
          </svg>
        </div>

        <div className="relative px-8 py-12 md:py-16">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-white text-sm font-medium mb-6">
                <SparklesIcon className="h-4 w-4" />
                AI-Powered Health Assessment
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Symptom Checker
              </h1>
              <p className="text-xl text-blue-100 mb-8 max-w-xl">
                Get personalized health guidance by answering a few questions about your symptoms. Our AI will help determine the best next steps for your care.
              </p>
              <button
                onClick={handleStartChecker}
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <ChatBubbleLeftRightIcon className="h-6 w-6" />
                Start Symptom Check
                <ArrowRightIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-shrink-0">
              <div className="w-48 h-48 md:w-64 md:h-64 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                <div className="w-40 h-40 md:w-52 md:h-52 bg-white/20 rounded-full flex items-center justify-center">
                  <HeartIcon className="w-20 h-20 md:w-28 md:h-28 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
              <feature.icon className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
            <p className="text-gray-600">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">How It Works</h2>
          <p className="text-gray-600">Simple steps to get your health guidance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map((item, index) => (
            <div key={item.step} className="relative text-center">
              {/* Connector Line */}
              {index < HOW_IT_WORKS.length - 1 && (
                <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-gray-200" />
              )}

              <div className="relative">
                <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 relative z-10">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={handleStartChecker}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Get Started
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Emergency Warning */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-xl flex-shrink-0">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-800 mb-2">
              Medical Emergency?
            </h3>
            <p className="text-red-700 mb-4">
              If you are experiencing a medical emergency such as difficulty breathing, chest pain, severe bleeding, or signs of a stroke, do not use this tool.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="tel:911"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
              >
                <PhoneIcon className="h-5 w-5" />
                Call 911
              </a>
              <button
                onClick={() => navigate('/emergency')}
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-red-600 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors"
              >
                Emergency Department Info
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-200 rounded-lg flex-shrink-0">
            <DocumentTextIcon className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Important Information</h3>
            <ul className="space-y-2">
              {DISCLAIMER_ITEMS.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-gray-600">
                  <CheckCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Frequently Asked Questions
        </h2>

        <div className="space-y-4 max-w-3xl mx-auto">
          {[
            {
              q: 'Is the Symptom Checker a replacement for seeing a doctor?',
              a: 'No. The Symptom Checker is designed to provide general health guidance and help you determine when to seek care. It is not a substitute for professional medical advice, diagnosis, or treatment.',
            },
            {
              q: 'How accurate is the Symptom Checker?',
              a: 'Our AI uses advanced algorithms and medical knowledge to provide recommendations. However, accuracy depends on the information you provide, and results should be verified by a healthcare professional.',
            },
            {
              q: 'Is my health information kept private?',
              a: 'Yes. Your responses are encrypted and handled in accordance with healthcare privacy regulations. We do not share your information with third parties.',
            },
            {
              q: 'Can I book an appointment based on the results?',
              a: 'Yes. If the Symptom Checker recommends seeing a healthcare provider, you can book an appointment directly from the results page.',
            },
          ].map((faq, index) => (
            <details
              key={index}
              className="group bg-gray-50 rounded-xl overflow-hidden"
            >
              <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 transition-colors">
                <span className="font-medium text-gray-900">{faq.q}</span>
                <QuestionMarkCircleIcon className="h-5 w-5 text-gray-400 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4 text-gray-600">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          Ready to check your symptoms?
        </h2>
        <p className="text-blue-100 mb-6 max-w-xl mx-auto">
          Get personalized guidance in just a few minutes. Our AI-powered tool will help you understand your symptoms and determine the best next steps.
        </p>
        <button
          onClick={handleStartChecker}
          className="inline-flex items-center gap-3 px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-lg"
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
          Start Symptom Check
          <ArrowRightIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
