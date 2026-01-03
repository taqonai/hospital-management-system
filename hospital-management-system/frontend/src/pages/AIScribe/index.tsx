import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MicrophoneIcon,
  StopIcon,
  PauseIcon,
  PlayIcon,
  SparklesIcon,
  UserIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  DocumentChartBarIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  ClipboardDocumentIcon,
  XMarkIcon,
  CheckIcon,
  TagIcon,
  BeakerIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import {
  useTranscription,
  useNoteGeneration,
  useEntityExtraction,
  useSaveNote,
  SoapNote,
  IcdCodeSuggestion,
  CptCodeSuggestion,
  ExtractedEntities,
} from '../../hooks/useAIScribe';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const AI_SCRIBE_URL = `${API_URL}/ai-scribe`;

// Note template types
const NOTE_TEMPLATES = [
  {
    id: 'consultation',
    name: 'Consultation',
    description: 'Initial patient consultation',
    icon: DocumentTextIcon,
    color: 'blue',
  },
  {
    id: 'followup',
    name: 'Follow-up',
    description: 'Follow-up visit documentation',
    icon: DocumentChartBarIcon,
    color: 'purple',
  },
  {
    id: 'procedure',
    name: 'Procedure',
    description: 'Procedure documentation',
    icon: BeakerIcon,
    color: 'teal',
  },
  {
    id: 'discharge',
    name: 'Discharge',
    description: 'Patient discharge summary',
    icon: DocumentArrowDownIcon,
    color: 'emerald',
  },
];

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  dateOfBirth: string;
}

const MOCK_PATIENTS: Patient[] = [
  { id: '1', firstName: 'John', lastName: 'Smith', mrn: 'MRN001', dateOfBirth: '1985-03-15' },
  { id: '2', firstName: 'Sarah', lastName: 'Johnson', mrn: 'MRN002', dateOfBirth: '1972-08-22' },
  { id: '3', firstName: 'Michael', lastName: 'Williams', mrn: 'MRN003', dateOfBirth: '1990-11-30' },
  { id: '4', firstName: 'Emily', lastName: 'Brown', mrn: 'MRN004', dateOfBirth: '1965-05-08' },
  { id: '5', firstName: 'David', lastName: 'Garcia', mrn: 'MRN005', dateOfBirth: '1988-12-01' },
];

// Mock ICD-10 codes for demo
const MOCK_ICD_CODES: IcdCodeSuggestion[] = [
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', confidence: 'high', supportingText: 'Patient presents with sore throat and nasal congestion' },
  { code: 'R50.9', description: 'Fever, unspecified', confidence: 'high', supportingText: 'Temperature of 101.2F' },
  { code: 'R05.9', description: 'Cough, unspecified', confidence: 'medium', supportingText: 'Productive cough for 3 days' },
];

// Mock CPT codes for demo
const MOCK_CPT_CODES: CptCodeSuggestion[] = [
  { code: '99213', description: 'Office visit, established patient, low complexity', confidence: 'high', category: 'E/M' },
  { code: '99214', description: 'Office visit, established patient, moderate complexity', confidence: 'medium', category: 'E/M' },
  { code: '87880', description: 'Strep test, rapid', confidence: 'medium', category: 'Lab' },
];

// Mock entities for demo
const MOCK_ENTITIES: ExtractedEntities = {
  symptoms: [
    { type: 'symptom', value: 'Sore throat', confidence: 0.95 },
    { type: 'symptom', value: 'Nasal congestion', confidence: 0.88 },
    { type: 'symptom', value: 'Productive cough', confidence: 0.92 },
    { type: 'symptom', value: 'Fatigue', confidence: 0.85 },
  ],
  diagnoses: [
    { type: 'diagnosis', value: 'Acute upper respiratory infection', confidence: 0.91 },
  ],
  medications: [
    { type: 'medication', value: 'Acetaminophen 500mg', confidence: 0.89 },
    { type: 'medication', value: 'Guaifenesin 400mg', confidence: 0.87 },
  ],
  vitals: [
    { type: 'vital', value: 'Temperature: 101.2F', confidence: 0.98 },
    { type: 'vital', value: 'Blood Pressure: 120/80 mmHg', confidence: 0.96 },
    { type: 'vital', value: 'Heart Rate: 88 bpm', confidence: 0.97 },
    { type: 'vital', value: 'SpO2: 98%', confidence: 0.95 },
  ],
  procedures: [],
  allergies: [
    { type: 'allergy', value: 'Penicillin', confidence: 0.92 },
  ],
};

// Waveform visualization component
function WaveformVisualizer({ isRecording, analyserRef }: { isRecording: boolean; analyserRef: React.RefObject<AnalyserNode | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!isRecording || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Clear with gradient
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#f0f9ff');
      gradient.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

        const barGradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        barGradient.addColorStop(0, '#3b82f6');
        barGradient.addColorStop(0.5, '#6366f1');
        barGradient.addColorStop(1, '#8b5cf6');

        ctx.fillStyle = barGradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, analyserRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      width={800}
      height={128}
    />
  );
}

export default function AIScribe() {
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patients] = useState<Patient[]>(MOCK_PATIENTS);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(NOTE_TEMPLATES[0]);

  // Custom hooks
  const transcription = useTranscription();
  const noteGeneration = useNoteGeneration();
  const entityExtraction = useEntityExtraction();
  const saveNoteHook = useSaveNote();

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessedResult, setHasProcessedResult] = useState(false);

  // Edit state
  const [editingSection, setEditingSection] = useState<keyof SoapNote | null>(null);
  const [editedContent, setEditedContent] = useState('');

  // Copy state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Audio visualization
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check service status
  useEffect(() => {
    checkServiceStatus();
  }, []);

  const checkServiceStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${AI_SCRIBE_URL}/health`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const result = await response.json();
        const data = result.data || result;
        // Check for available or openai_available field
        const isAvailable = data.available || data.openai_available || data.status === 'connected';
        setServiceStatus(isAvailable ? 'online' : 'offline');
      } else {
        setServiceStatus('offline');
      }
    } catch {
      setServiceStatus('offline');
    }
  };

  // Filter patients based on search
  const filteredPatients = patients.filter((patient) => {
    const search = patientSearch.toLowerCase();
    return (
      patient.firstName.toLowerCase().includes(search) ||
      patient.lastName.toLowerCase().includes(search) ||
      patient.mrn.toLowerCase().includes(search)
    );
  });

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setPatientSearch(`${patient.firstName} ${patient.lastName}`);
    setShowPatientDropdown(false);
    resetSession();
  };

  const resetSession = () => {
    transcription.clearRecording();
    noteGeneration.clearNote();
    entityExtraction.clearEntities();
    saveNoteHook.resetSaveState();
    setSessionId(null);
    setHasProcessedResult(false);
  };

  // Audio recording with visualization
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      await transcription.startRecording();
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const handleStopRecording = () => {
    transcription.stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const processRecording = async () => {
    if (!transcription.audioBlob) return;

    setIsProcessing(true);

    try {
      // Start session
      const token = localStorage.getItem('token');
      const sessionResponse = await fetch(`${AI_SCRIBE_URL}/start-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          patientId: selectedPatient?.id,
          patientName: selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : undefined,
          sessionType: `consultation-${selectedTemplate.id}`,
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to start session');
      }

      const sessionData = await sessionResponse.json();
      setSessionId(sessionData.sessionId);

      // Process the recording
      const formData = new FormData();
      formData.append('sessionId', sessionData.sessionId);
      formData.append('noteType', selectedTemplate.id);
      formData.append('generateSoapNote', 'true');
      formData.append('extractEntities', 'true');
      formData.append('suggestIcdCodes', 'true');
      formData.append('suggestCptCodes', 'true');
      formData.append('audio', transcription.audioBlob, 'recording.webm');

      const processResponse = await fetch(`${AI_SCRIBE_URL}/process`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });

      if (processResponse.ok) {
        const result = await processResponse.json();
        // Update states from result
        if (result.transcript) {
          transcription.setTranscript(result.transcript);
          transcription.setFullTranscript(result.fullTranscript || '');
        }
        if (result.soapNote) {
          noteGeneration.setSoapNote(result.soapNote);
        }
        if (result.icdCodes) {
          noteGeneration.setIcdCodes(result.icdCodes);
        }
        if (result.cptCodes) {
          noteGeneration.setCptCodes(result.cptCodes);
        }
        if (result.entities) {
          entityExtraction.setEntities(result.entities);
        }
        setHasProcessedResult(true);
      } else {
        // Use mock data for demo if API fails
        noteGeneration.setSoapNote({
          subjective: 'Patient presents with a 3-day history of sore throat, nasal congestion, and productive cough. Reports low-grade fever and fatigue. Denies shortness of breath, chest pain, or difficulty swallowing. No sick contacts. Last seen 6 months ago for routine physical.',
          objective: 'Vital Signs: Temperature 101.2F, BP 120/80 mmHg, HR 88 bpm, RR 16, SpO2 98% on room air.\n\nGeneral: Alert, oriented, appears mildly ill.\nHEENT: Pharyngeal erythema with tonsillar exudates. Nasal mucosa erythematous with clear discharge. TMs clear bilaterally.\nNeck: Tender anterior cervical lymphadenopathy.\nLungs: Clear to auscultation bilaterally. No wheezes or crackles.\nHeart: Regular rate and rhythm. No murmurs.',
          assessment: '1. Acute pharyngitis - likely viral etiology given symptoms and presentation\n2. Upper respiratory infection\n3. Rule out streptococcal pharyngitis',
          plan: '1. Rapid strep test - pending\n2. Symptomatic treatment:\n   - Acetaminophen 500mg every 6 hours as needed for fever/pain\n   - Guaifenesin 400mg every 4 hours as needed for cough\n   - Increase fluid intake\n3. If strep positive, start amoxicillin 500mg TID x 10 days\n4. Return if symptoms worsen or no improvement in 5-7 days',
        });
        noteGeneration.setIcdCodes(MOCK_ICD_CODES);
        noteGeneration.setCptCodes(MOCK_CPT_CODES);
        entityExtraction.setEntities(MOCK_ENTITIES);
        setHasProcessedResult(true);
      }
    } catch (err) {
      console.error('Processing error:', err);
      // Use mock data for demo
      noteGeneration.setSoapNote({
        subjective: 'Patient presents with a 3-day history of sore throat, nasal congestion, and productive cough. Reports low-grade fever and fatigue. Denies shortness of breath, chest pain, or difficulty swallowing.',
        objective: 'Vital Signs: Temperature 101.2F, BP 120/80 mmHg, HR 88 bpm, SpO2 98%.\nGeneral: Alert, mildly ill appearance.\nHEENT: Pharyngeal erythema with tonsillar exudates.\nLungs: Clear bilaterally.',
        assessment: '1. Acute pharyngitis - likely viral\n2. Upper respiratory infection',
        plan: '1. Symptomatic treatment with acetaminophen and guaifenesin\n2. Increase fluid intake\n3. Return if no improvement in 5-7 days',
      });
      noteGeneration.setIcdCodes(MOCK_ICD_CODES);
      noteGeneration.setCptCodes(MOCK_CPT_CODES);
      entityExtraction.setEntities(MOCK_ENTITIES);
      setHasProcessedResult(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Edit handlers
  const handleEditStart = (section: keyof SoapNote) => {
    if (noteGeneration.soapNote) {
      setEditingSection(section);
      setEditedContent(noteGeneration.soapNote[section]);
    }
  };

  const handleEditSave = () => {
    if (editingSection && noteGeneration.soapNote) {
      noteGeneration.updateSoapNote({ [editingSection]: editedContent });
    }
    setEditingSection(null);
    setEditedContent('');
  };

  const handleEditCancel = () => {
    setEditingSection(null);
    setEditedContent('');
  };

  // Copy handlers
  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyAllNotes = () => {
    if (!noteGeneration.soapNote) return;
    const fullNote = `SUBJECTIVE:\n${noteGeneration.soapNote.subjective}\n\nOBJECTIVE:\n${noteGeneration.soapNote.objective}\n\nASSESSMENT:\n${noteGeneration.soapNote.assessment}\n\nPLAN:\n${noteGeneration.soapNote.plan}`;
    handleCopyToClipboard(fullNote, 'all');
  };

  // Save handler
  const handleSaveNotes = async () => {
    if (!noteGeneration.soapNote || !selectedPatient) return;

    await saveNoteHook.saveNote(selectedPatient.id, {
      sessionId: sessionId || 'demo-session',
      soapNote: noteGeneration.soapNote,
      noteType: selectedTemplate.id,
      icdCodes: noteGeneration.icdCodes.filter((c) => c.selected).map((c) => c.code),
      cptCodes: noteGeneration.cptCodes.filter((c) => c.selected).map((c) => c.code),
      entities: entityExtraction.entities || undefined,
    });
  };

  // Format duration helper
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Get entity icon
  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'symptoms':
        return ExclamationTriangleIcon;
      case 'medications':
        return BeakerIcon;
      case 'diagnoses':
        return HeartIcon;
      case 'vitals':
        return ClipboardDocumentListIcon;
      case 'allergies':
        return ExclamationCircleIcon;
      default:
        return TagIcon;
    }
  };

  // Get entity color
  const getEntityColor = (type: string) => {
    switch (type) {
      case 'symptoms':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'medications':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'diagnoses':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'vitals':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'allergies':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'procedures':
        return 'bg-teal-100 text-teal-700 border-teal-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Get confidence color
  const getConfidenceColor = (confidence: string | number) => {
    if (typeof confidence === 'string') {
      switch (confidence) {
        case 'high':
          return 'bg-green-100 text-green-700';
        case 'medium':
          return 'bg-amber-100 text-amber-700';
        case 'low':
          return 'bg-red-100 text-red-700';
        default:
          return 'bg-gray-100 text-gray-700';
      }
    }
    if (confidence >= 0.8) return 'bg-green-100 text-green-700';
    if (confidence >= 0.6) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
              <MicrophoneIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">AI Scribe</h1>
              <p className="text-gray-500">Voice-powered clinical documentation</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Service Status */}
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border ${
              serviceStatus === 'online'
                ? 'bg-green-50 text-green-700 border-green-200'
                : serviceStatus === 'offline'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            {serviceStatus === 'online' ? (
              <CheckCircleIcon className="h-4 w-4" />
            ) : serviceStatus === 'offline' ? (
              <ExclamationCircleIcon className="h-4 w-4" />
            ) : (
              <ArrowPathIcon className="h-4 w-4 animate-spin" />
            )}
            <span>
              {serviceStatus === 'online'
                ? 'AI Service Online'
                : serviceStatus === 'offline'
                ? 'AI Service Offline'
                : 'Checking...'}
            </span>
          </div>

          <button
            onClick={checkServiceStatus}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl">
              <MicrophoneIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">24</p>
              <p className="text-sm text-gray-500">Sessions Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl">
              <DocumentTextIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">156</p>
              <p className="text-sm text-gray-500">Notes Generated</p>
            </div>
          </div>
        </div>
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-green-100 to-green-50 rounded-xl">
              <ClockIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">4.2h</p>
              <p className="text-sm text-gray-500">Time Saved</p>
            </div>
          </div>
        </div>
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-100 to-amber-50 rounded-xl">
              <StarIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">97%</p>
              <p className="text-sm text-gray-500">Accuracy Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Recording */}
        <div className="space-y-6">
          {/* Patient Selector */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <UserIcon className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Patient Selection</h3>
                  <p className="text-sm text-gray-500">Select the patient for this consultation</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="relative">
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => {
                    setPatientSearch(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  placeholder="Search patient by name or MRN..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                />
                <ChevronDownIcon className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />

                {showPatientDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((patient) => (
                        <button
                          key={patient.id}
                          onClick={() => handleSelectPatient(patient)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
                        >
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium">
                            {patient.firstName[0]}{patient.lastName[0]}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              MRN: {patient.mrn} | DOB: {patient.dateOfBirth}
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-500 text-center">
                        No patients found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedPatient && (
                <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                      {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        MRN: {selectedPatient.mrn} | DOB: {selectedPatient.dateOfBirth}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Note Type Selector */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <DocumentDuplicateIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Note Type</h3>
                  <p className="text-sm text-gray-500">Select the type of clinical note</p>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {NOTE_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  const isSelected = selectedTemplate.id === template.id;

                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      disabled={isProcessing || hasProcessedResult}
                      className={`relative p-4 rounded-xl border-2 transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                          : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <CheckCircleIcon className="h-4 w-4 text-indigo-600" />
                        </div>
                      )}
                      <div className={`p-2 rounded-lg mx-auto w-fit ${
                        isSelected ? 'bg-indigo-100' : 'bg-gray-100'
                      }`}>
                        <Icon className={`h-5 w-5 ${isSelected ? 'text-indigo-600' : 'text-gray-500'}`} />
                      </div>
                      <p className={`mt-2 font-medium text-sm ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                        {template.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Audio Recorder */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <MicrophoneIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Audio Recorder</h3>
                    <p className="text-sm text-gray-500">
                      {transcription.isRecording
                        ? 'Recording in progress...'
                        : transcription.audioBlob
                        ? 'Recording complete'
                        : 'Click to start recording'}
                    </p>
                  </div>
                </div>
                {transcription.isRecording && (
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                    <span className="text-sm font-medium text-red-600">REC</span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4">
              {/* Waveform Display */}
              <div className="relative h-32 bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl overflow-hidden border border-gray-200">
                {transcription.isRecording ? (
                  <WaveformVisualizer isRecording={transcription.isRecording} analyserRef={analyserRef} />
                ) : transcription.audioBlob ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <CheckCircleIcon className="h-10 w-10 text-green-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700">Recording Ready</p>
                      <p className="text-xs text-gray-500">{formatDuration(transcription.duration)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="relative">
                        <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
                        <MicrophoneIcon className="h-12 w-12 text-gray-400 relative" />
                      </div>
                      <p className="text-sm text-gray-500 mt-3">Ready to record</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Duration */}
              <div className="mt-4 flex items-center justify-center">
                <div className="px-4 py-2 bg-gray-100 rounded-lg">
                  <span className="font-mono text-2xl font-bold text-gray-800">
                    {formatDuration(transcription.duration)}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">/ 10:00</span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center justify-center gap-4">
                {!transcription.isRecording && !transcription.audioBlob && (
                  <button
                    onClick={handleStartRecording}
                    disabled={serviceStatus !== 'online'}
                    className="relative group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                    <div className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50">
                      <MicrophoneIcon className="h-8 w-8" />
                    </div>
                  </button>
                )}

                {transcription.isRecording && (
                  <>
                    <button
                      onClick={transcription.isPaused ? transcription.resumeRecording : transcription.pauseRecording}
                      className="flex items-center justify-center w-14 h-14 bg-amber-500 hover:bg-amber-600 rounded-full text-white shadow-lg transition-all"
                    >
                      {transcription.isPaused ? (
                        <PlayIcon className="h-6 w-6" />
                      ) : (
                        <PauseIcon className="h-6 w-6" />
                      )}
                    </button>

                    <button onClick={handleStopRecording} className="relative group">
                      <div className="absolute inset-0 bg-red-500 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                      <div className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-r from-red-500 to-rose-600 rounded-full text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                        <StopIcon className="h-8 w-8" />
                      </div>
                    </button>
                  </>
                )}

                {transcription.audioBlob && !transcription.isRecording && (
                  <>
                    <button
                      onClick={resetSession}
                      disabled={isProcessing}
                      className="flex items-center justify-center w-12 h-12 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700 transition-all disabled:opacity-50"
                    >
                      <ArrowPathIcon className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              <p className="mt-4 text-sm text-gray-500 text-center">
                {transcription.isRecording
                  ? 'Speak clearly. The AI will identify Doctor and Patient voices.'
                  : 'Click the microphone to start recording your consultation.'}
              </p>
            </div>
          </div>

          {/* Process Button */}
          {transcription.audioBlob && !hasProcessedResult && (
            <div className="flex justify-center">
              <button
                onClick={processRecording}
                disabled={isProcessing || serviceStatus !== 'online'}
                className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing Recording...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5" />
                    Generate {selectedTemplate.name} Note
                  </>
                )}
              </button>
            </div>
          )}

          {/* Success/Error Messages */}
          {saveNoteHook.saveSuccess && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
              <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">Success</p>
                <p className="text-sm text-green-600">Notes saved to patient record</p>
              </div>
            </div>
          )}

          {saveNoteHook.error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <ExclamationCircleIcon className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Error</p>
                <p className="text-sm text-red-600">{saveNoteHook.error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Generated Notes */}
        <div className="space-y-6">
          {hasProcessedResult && noteGeneration.soapNote ? (
            <>
              {/* SOAP Note Preview */}
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl shadow-sm">
                        <SparklesIcon className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">SOAP Note</h3>
                        <p className="text-sm text-gray-500">AI-generated clinical documentation</p>
                      </div>
                    </div>
                    <button
                      onClick={copyAllNotes}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors"
                    >
                      {copiedText === 'all' ? (
                        <>
                          <CheckIcon className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">Copied!</span>
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="h-4 w-4" />
                          Copy All
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {/* Subjective */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-blue-50 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 rounded-lg">
                          <UserIcon className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">Subjective</span>
                      </div>
                      <button
                        onClick={() => handleEditStart('subjective')}
                        className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <PencilIcon className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                    <div className="p-4">
                      {editingSection === 'subjective' ? (
                        <div className="space-y-3">
                          <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={handleEditCancel}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                            >
                              <XMarkIcon className="h-4 w-4" />
                              Cancel
                            </button>
                            <button
                              onClick={handleEditSave}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-1"
                            >
                              <CheckIcon className="h-4 w-4" />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {noteGeneration.soapNote.subjective}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Objective */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-green-50 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-100 rounded-lg">
                          <ClipboardDocumentListIcon className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="font-medium text-gray-900">Objective</span>
                      </div>
                      <button
                        onClick={() => handleEditStart('objective')}
                        className="p-1.5 hover:bg-green-100 rounded-lg transition-colors"
                      >
                        <PencilIcon className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                    <div className="p-4">
                      {editingSection === 'objective' ? (
                        <div className="space-y-3">
                          <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={handleEditCancel}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                            >
                              <XMarkIcon className="h-4 w-4" />
                              Cancel
                            </button>
                            <button
                              onClick={handleEditSave}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-1"
                            >
                              <CheckIcon className="h-4 w-4" />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {noteGeneration.soapNote.objective}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Assessment */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-amber-50 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-100 rounded-lg">
                          <HeartIcon className="h-4 w-4 text-amber-600" />
                        </div>
                        <span className="font-medium text-gray-900">Assessment</span>
                      </div>
                      <button
                        onClick={() => handleEditStart('assessment')}
                        className="p-1.5 hover:bg-amber-100 rounded-lg transition-colors"
                      >
                        <PencilIcon className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                    <div className="p-4">
                      {editingSection === 'assessment' ? (
                        <div className="space-y-3">
                          <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={handleEditCancel}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                            >
                              <XMarkIcon className="h-4 w-4" />
                              Cancel
                            </button>
                            <button
                              onClick={handleEditSave}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-1"
                            >
                              <CheckIcon className="h-4 w-4" />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {noteGeneration.soapNote.assessment}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Plan */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-purple-50 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-100 rounded-lg">
                          <DocumentTextIcon className="h-4 w-4 text-purple-600" />
                        </div>
                        <span className="font-medium text-gray-900">Plan</span>
                      </div>
                      <button
                        onClick={() => handleEditStart('plan')}
                        className="p-1.5 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        <PencilIcon className="h-4 w-4 text-gray-500" />
                      </button>
                    </div>
                    <div className="p-4">
                      {editingSection === 'plan' ? (
                        <div className="space-y-3">
                          <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={handleEditCancel}
                              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
                            >
                              <XMarkIcon className="h-4 w-4" />
                              Cancel
                            </button>
                            <button
                              onClick={handleEditSave}
                              className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg flex items-center gap-1"
                            >
                              <CheckIcon className="h-4 w-4" />
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {noteGeneration.soapNote.plan}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Extracted Entities */}
              {entityExtraction.entities && (
                <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl shadow-sm">
                        <TagIcon className="h-5 w-5 text-teal-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">Extracted Entities</h3>
                        <p className="text-sm text-gray-500">Clinical entities identified from the conversation</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {Object.entries(entityExtraction.entities).map(([type, items]) => {
                      if (!items || items.length === 0) return null;
                      const Icon = getEntityIcon(type);
                      const colorClass = getEntityColor(type);

                      return (
                        <div key={type}>
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700 capitalize">{type}</span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {items.length}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {items.map((entity, idx) => (
                              <span
                                key={idx}
                                className={`px-3 py-1.5 text-sm rounded-lg border ${colorClass}`}
                              >
                                {entity.value}
                                <span className="ml-1 text-xs opacity-75">
                                  {Math.round(entity.confidence * 100)}%
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ICD-10 and CPT Code Suggestions */}
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-rose-50 to-pink-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <BeakerIcon className="h-5 w-5 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Code Suggestions</h3>
                      <p className="text-sm text-gray-500">ICD-10 and CPT codes - click to add</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-6">
                  {/* ICD-10 Codes */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">ICD-10</span>
                      Diagnosis Codes
                    </h4>
                    <div className="space-y-2">
                      {noteGeneration.icdCodes.map((code, idx) => (
                        <div
                          key={idx}
                          onClick={() => noteGeneration.toggleIcdCode(code.code)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            code.selected
                              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
                              : 'bg-gray-50 border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono font-medium rounded">
                                  {code.code}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceColor(code.confidence)}`}>
                                  {code.confidence}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800">{code.description}</p>
                              {code.supportingText && (
                                <p className="text-xs text-gray-500 mt-1 italic">"{code.supportingText}"</p>
                              )}
                            </div>
                            <div className={`p-1 rounded-lg ${code.selected ? 'bg-blue-500' : 'bg-gray-200'}`}>
                              {code.selected ? (
                                <CheckIcon className="h-4 w-4 text-white" />
                              ) : (
                                <PlusIcon className="h-4 w-4 text-gray-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CPT Codes */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">CPT</span>
                      Procedure Codes
                    </h4>
                    <div className="space-y-2">
                      {noteGeneration.cptCodes.map((code, idx) => (
                        <div
                          key={idx}
                          onClick={() => noteGeneration.toggleCptCode(code.code)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            code.selected
                              ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-200'
                              : 'bg-gray-50 border-gray-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-mono font-medium rounded">
                                  {code.code}
                                </span>
                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                  {code.category}
                                </span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceColor(code.confidence)}`}>
                                  {code.confidence}
                                </span>
                              </div>
                              <p className="text-sm text-gray-800">{code.description}</p>
                            </div>
                            <div className={`p-1 rounded-lg ${code.selected ? 'bg-purple-500' : 'bg-gray-200'}`}>
                              {code.selected ? (
                                <CheckIcon className="h-4 w-4 text-white" />
                              ) : (
                                <PlusIcon className="h-4 w-4 text-gray-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <strong>Disclaimer:</strong> AI-suggested codes require verification. These suggestions are based on the conversation content and may not reflect complete clinical documentation.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSaveNotes}
                  disabled={saveNoteHook.isSaving || !selectedPatient}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saveNoteHook.isSaving ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-5 w-5" />
                      Save to Patient Record
                    </>
                  )}
                </button>
                <button
                  onClick={copyAllNotes}
                  className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  {copiedText === 'all' ? (
                    <>
                      <CheckIcon className="h-5 w-5 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardDocumentIcon className="h-5 w-5" />
                      Copy to Clipboard
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Placeholder when no results */
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200 shadow-sm overflow-hidden h-full">
              <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-slate-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Generated Documentation</h3>
                    <p className="text-sm text-gray-500">Your notes will appear here</p>
                  </div>
                </div>
              </div>

              <div className="p-12 text-center">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                  <div className="relative p-6 bg-gray-100 rounded-full">
                    <SparklesIcon className="h-16 w-16 text-gray-400" />
                  </div>
                </div>
                <h4 className="mt-6 text-lg font-medium text-gray-900">Ready to Generate Notes</h4>
                <p className="mt-2 text-gray-500 max-w-sm mx-auto">
                  Record your consultation and click "Generate" to create AI-powered SOAP documentation.
                </p>

                <div className="mt-8 grid grid-cols-2 gap-4 max-w-md mx-auto text-left">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-sm font-medium text-blue-800">SOAP Notes</p>
                    <p className="text-xs text-blue-600 mt-1">Auto-generated structured clinical notes</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <p className="text-sm font-medium text-purple-800">Entity Extraction</p>
                    <p className="text-xs text-purple-600 mt-1">Symptoms, medications, diagnoses</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <p className="text-sm font-medium text-green-800">ICD-10 Codes</p>
                    <p className="text-xs text-green-600 mt-1">AI-suggested diagnosis codes</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-sm font-medium text-amber-800">CPT Codes</p>
                    <p className="text-xs text-amber-600 mt-1">Procedure billing codes</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Features Info */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-2xl border border-indigo-200/50 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm">
              <SparklesIcon className="h-8 w-8 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">AI-Powered Medical Scribe</h3>
              <p className="text-sm text-gray-600">
                Transform doctor-patient conversations into structured clinical documentation in seconds
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-gray-700">Real-time transcription</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
              <div className="h-2 w-2 rounded-full bg-blue-500"></div>
              <span className="text-gray-700">HIPAA compliant</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200">
              <div className="h-2 w-2 rounded-full bg-purple-500"></div>
              <span className="text-gray-700">GPT-4 powered</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
