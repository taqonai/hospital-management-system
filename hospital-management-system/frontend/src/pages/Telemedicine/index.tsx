import React, { useState, useEffect } from 'react';
import { telemedicineApi } from '../../services/api';
import {
  VideoCameraIcon,
  PhoneIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface Session {
  id: string;
  sessionId: string;
  patientName: string;
  doctorName: string;
  scheduledAt: string;
  status: string;
  type: string;
  reason: string;
}

const Telemedicine: React.FC = () => {
  const [activeTab, setActiveTab] = useState('sessions');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<any>(null);

  // AI Triage Form
  const [triageForm, setTriageForm] = useState({
    symptoms: ['headache', 'fever'],
    duration: '2 days',
    severity: 'moderate',
    age: 35,
    gender: 'MALE',
    medicalHistory: [] as string[],
    currentMedications: [] as string[],
  });
  const [triageResult, setTriageResult] = useState<any>(null);

  useEffect(() => {
    loadSessions();
    loadStats();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await telemedicineApi.getSessions();
      setSessions(response.data.data || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await telemedicineApi.getStats();
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const performTriage = async () => {
    setLoading(true);
    try {
      const response = await telemedicineApi.performTriage(triageForm);
      setTriageResult(response.data.data);
    } catch (error) {
      console.error('Triage failed:', error);
    }
    setLoading(false);
  };

  const addSymptom = (symptom: string) => {
    if (symptom && !triageForm.symptoms.includes(symptom)) {
      setTriageForm({
        ...triageForm,
        symptoms: [...triageForm.symptoms, symptom],
      });
    }
  };

  const removeSymptom = (symptom: string) => {
    setTriageForm({
      ...triageForm,
      symptoms: triageForm.symptoms.filter((s) => s !== symptom),
    });
  };

  const tabs = [
    { id: 'sessions', name: 'Sessions', icon: VideoCameraIcon },
    { id: 'schedule', name: 'Schedule', icon: CalendarDaysIcon },
    { id: 'ai-triage', name: 'AI Triage', icon: SparklesIcon },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { dot: string; bg: string; text: string }> = {
      SCHEDULED: {
        dot: 'bg-blue-500',
        bg: 'bg-blue-100/80',
        text: 'text-blue-700',
      },
      IN_PROGRESS: {
        dot: 'bg-green-500',
        bg: 'bg-green-100/80',
        text: 'text-green-700',
      },
      COMPLETED: {
        dot: 'bg-gray-500',
        bg: 'bg-gray-100/80',
        text: 'text-gray-700',
      },
      CANCELLED: {
        dot: 'bg-red-500',
        bg: 'bg-red-100/80',
        text: 'text-red-700',
      },
    };
    const config = statusConfig[status] || statusConfig.COMPLETED;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-gray-200 ${config.bg} ${config.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {status}
      </span>
    );
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'EMERGENCY':
        return 'bg-gradient-to-r from-red-500 to-red-600 text-white';
      case 'URGENT':
        return 'bg-gradient-to-r from-orange-500 to-orange-600 text-white';
      case 'MODERATE':
        return 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white';
      case 'LOW':
        return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Glassmorphism Header with Gradient Background */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-teal-500 p-8">
        {/* Floating Orbs */}
        <div className="absolute top-4 right-16 w-32 h-32 bg-white/20 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-4 left-16 w-24 h-24 bg-cyan-300/30 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-teal-300/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0.5s' }} />

        {/* Content */}
        <div className="relative z-10 flex items-center justify-between">
          <div>
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white/90 text-sm font-medium mb-3">
              <VideoCameraIcon className="h-4 w-4" />
              Telemedicine
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Telemedicine</h1>
            <p className="text-cyan-100 mt-1">Virtual consultations with AI-powered triage</p>
          </div>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white/20 backdrop-blur-sm text-white rounded-xl hover:bg-white/30 transition-all duration-300 border border-white/30 shadow-lg hover:shadow-xl hover:scale-105">
            <VideoCameraIcon className="h-5 w-5" />
            New Session
          </button>
        </div>
      </div>

      {/* Stats Cards with Glassmorphism */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: CalendarDaysIcon, label: "Today's Sessions", value: stats?.todaySessions || 0, color: 'sky', delay: '0ms' },
          { icon: VideoCameraIcon, label: 'In Progress', value: stats?.inProgress || 0, color: 'emerald', delay: '100ms' },
          { icon: CheckCircleIcon, label: 'Completed Today', value: stats?.completedToday || 0, color: 'violet', delay: '200ms' },
          { icon: ClockIcon, label: 'Avg Duration', value: `${stats?.averageDuration || 0} min`, color: 'amber', delay: '300ms' },
        ].map((stat, index) => (
          <div
            key={index}
            className="relative overflow-hidden backdrop-blur-xl bg-white p-5 rounded-xl shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
            style={{ animationDelay: stat.delay }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${
                stat.color === 'sky' ? 'from-sky-400 to-cyan-500' :
                stat.color === 'emerald' ? 'from-emerald-400 to-green-500' :
                stat.color === 'violet' ? 'from-violet-400 to-purple-500' :
                'from-amber-400 to-orange-500'
              } shadow-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Animated Gradient Tabs */}
      <div className="relative backdrop-blur-xl bg-white rounded-xl p-1.5 border border-gray-200 shadow-lg">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        <nav className="flex space-x-1" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content with Glassmorphism */}
      <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-xl shadow-lg p-6 border border-gray-200 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]" style={{ animationDelay: '400ms' }}>
        {/* Shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        {activeTab === 'sessions' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Teleconsultation Sessions</h2>
            {sessions.length > 0 ? (
              <div className="space-y-4">
                {sessions.map((session, index) => (
                  <div
                    key={session.id}
                    className="relative overflow-hidden backdrop-blur-xl bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:shadow-lg transition-all duration-300 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Shine line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gradient-to-br from-sky-400 to-cyan-500 rounded-xl shadow-lg">
                        <UserIcon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{session.patientName || 'Patient'}</p>
                        <p className="text-sm text-gray-500">with {session.doctorName || 'Doctor'}</p>
                        <p className="text-sm text-gray-500">{session.reason}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{new Date(session.scheduledAt).toLocaleTimeString()}</p>
                        <p className="text-xs text-gray-500">{new Date(session.scheduledAt).toLocaleDateString()}</p>
                      </div>
                      {getStatusBadge(session.status)}
                      {session.status === 'SCHEDULED' && (
                        <button className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-green-600 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-1.5">
                          <PhoneIcon className="h-4 w-4" />
                          Join
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-sky-400/20 to-cyan-500/20 mb-4">
                  <VideoCameraIcon className="h-8 w-8 text-sky-500" />
                </div>
                <p className="text-gray-500">No sessions scheduled</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 text-gray-900">Schedule New Session</h2>
            <div className="max-w-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Patient</label>
                <select className="mt-1 block w-full rounded-xl border-gray-300 bg-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-gray-900 transition-all duration-300">
                  <option>Select patient...</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Doctor</label>
                <select className="mt-1 block w-full rounded-xl border-gray-300 bg-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-gray-900 transition-all duration-300">
                  <option>Select doctor...</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    className="mt-1 block w-full rounded-xl border-gray-300 bg-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-gray-900 transition-all duration-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Time</label>
                  <input
                    type="time"
                    className="mt-1 block w-full rounded-xl border-gray-300 bg-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-gray-900 transition-all duration-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Reason</label>
                <textarea
                  rows={3}
                  className="mt-1 block w-full rounded-xl border-gray-300 bg-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-gray-900 transition-all duration-300"
                  placeholder="Reason for consultation..."
                />
              </div>
              <button className="w-full py-3 bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-xl font-medium hover:from-sky-600 hover:to-cyan-600 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                Schedule Session
              </button>
            </div>
          </div>
        )}

        {activeTab === 'ai-triage' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
                <SparklesIcon className="h-5 w-5 text-white" />
              </div>
              AI Pre-Consultation Triage
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Symptoms</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {triageForm.symptoms.map((symptom) => (
                      <span
                        key={symptom}
                        className="inline-flex items-center gap-1 px-3 py-1.5 backdrop-blur-sm bg-sky-100/80 text-sky-700 rounded-full text-sm border border-sky-200/50"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        {symptom}
                        <button
                          onClick={() => removeSymptom(symptom)}
                          className="ml-1 text-sky-500 hover:text-sky-700 transition-colors"
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add symptom..."
                      className="flex-1 rounded-xl border-gray-300 bg-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-gray-900 transition-all duration-300"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addSymptom((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {['chest pain', 'shortness of breath', 'cough', 'nausea', 'dizziness'].map((s) => (
                      <button
                        key={s}
                        onClick={() => addSymptom(s)}
                        className="px-2.5 py-1 text-xs backdrop-blur-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 border border-gray-200 transition-all duration-300"
                      >
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration</label>
                    <select
                      value={triageForm.duration}
                      onChange={(e) => setTriageForm({ ...triageForm, duration: e.target.value })}
                      className="mt-1 block w-full rounded-xl border-gray-300 bg-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-gray-900 transition-all duration-300"
                    >
                      <option value="hours">A few hours</option>
                      <option value="1 day">1 day</option>
                      <option value="2 days">2-3 days</option>
                      <option value="1 week">1 week</option>
                      <option value="more than a week">More than a week</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Severity</label>
                    <select
                      value={triageForm.severity}
                      onChange={(e) => setTriageForm({ ...triageForm, severity: e.target.value })}
                      className="mt-1 block w-full rounded-xl border-gray-300 bg-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-gray-900 transition-all duration-300"
                    >
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Age</label>
                    <input
                      type="number"
                      value={triageForm.age}
                      onChange={(e) => setTriageForm({ ...triageForm, age: parseInt(e.target.value) })}
                      className="mt-1 block w-full rounded-xl border-gray-300 bg-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-gray-900 transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Gender</label>
                    <select
                      value={triageForm.gender}
                      onChange={(e) => setTriageForm({ ...triageForm, gender: e.target.value })}
                      className="mt-1 block w-full rounded-xl border-gray-300 bg-white shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-gray-900 transition-all duration-300"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={performTriage}
                  disabled={loading || triageForm.symptoms.length === 0}
                  className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium hover:from-violet-600 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loading ? 'Analyzing...' : 'Perform AI Triage'}
                </button>
              </div>

              <div>
                {triageResult && (
                  <div className="space-y-4 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]">
                    <div className={`relative overflow-hidden p-4 rounded-xl ${getUrgencyColor(triageResult.urgencyLevel)} shadow-lg`}>
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                      <div className="flex items-center gap-2">
                        {triageResult.urgencyLevel === 'EMERGENCY' && (
                          <ExclamationTriangleIcon className="h-6 w-6" />
                        )}
                        <div>
                          <h3 className="font-semibold text-lg">
                            {triageResult.urgencyLevel} Priority
                          </h3>
                          <p className="text-sm opacity-90">
                            Urgency Score: {triageResult.urgencyScore}/100
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="relative overflow-hidden backdrop-blur-xl bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                      <h4 className="font-medium text-gray-800 mb-2">Recommended Action</h4>
                      <p className="text-gray-600">{triageResult.recommendedAction}</p>
                    </div>

                    {triageResult.telemedAppropriate !== undefined && (
                      <div className={`relative overflow-hidden p-3 rounded-xl backdrop-blur-sm border ${triageResult.telemedAppropriate ? 'bg-emerald-100/80 border-emerald-200/50' : 'bg-red-100/80 border-red-200/50'}`}>
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                        <p className={`font-medium flex items-center gap-2 ${triageResult.telemedAppropriate ? 'text-emerald-800' : 'text-red-800'}`}>
                          <span className={`w-2 h-2 rounded-full ${triageResult.telemedAppropriate ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {triageResult.telemedAppropriate
                            ? 'Suitable for Teleconsultation'
                            : 'In-person visit recommended'}
                        </p>
                      </div>
                    )}

                    {triageResult.redFlags?.length > 0 && (
                      <div className="relative overflow-hidden backdrop-blur-sm bg-red-100/80 border border-red-200/50 rounded-xl p-4">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                        <h4 className="font-medium text-red-800 mb-2">Red Flags</h4>
                        <ul className="space-y-1">
                          {triageResult.redFlags.map((flag: string, idx: number) => (
                            <li key={idx} className="text-sm text-red-700 flex items-start gap-2">
                              <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              {flag}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {triageResult.possibleConditions?.length > 0 && (
                      <div className="relative overflow-hidden backdrop-blur-sm bg-sky-100/80 border border-sky-200/50 rounded-xl p-4">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                        <h4 className="font-medium text-sky-800 mb-2">Possible Conditions</h4>
                        <ul className="space-y-1">
                          {triageResult.possibleConditions.map((condition: any, idx: number) => (
                            <li key={idx} className="text-sm text-sky-700 flex justify-between">
                              <span>{condition.condition}</span>
                              <span className="text-sky-500 font-medium">
                                {Math.round(condition.probability * 100)}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {triageResult.questionsToAsk?.length > 0 && (
                      <div className="relative overflow-hidden backdrop-blur-xl bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                        <h4 className="font-medium text-gray-800 mb-2">Questions for Doctor</h4>
                        <ul className="space-y-1">
                          {triageResult.questionsToAsk.map((q: string, idx: number) => (
                            <li key={idx} className="text-sm text-gray-600">
                              {idx + 1}. {q}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS for fadeIn animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Telemedicine;
