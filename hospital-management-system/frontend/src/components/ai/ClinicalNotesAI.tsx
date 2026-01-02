import { useState } from 'react';
import {
  DocumentTextIcon,
  SparklesIcon,
  MicrophoneIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentDuplicateIcon,
  TagIcon,
  AcademicCapIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface GeneratedNote {
  success: boolean;
  noteType?: string;
  noteName?: string;
  generatedNote?: string;
  timestamp?: string;
  aiGenerated?: boolean;
  error?: string;
}

interface EnhancedNote {
  success: boolean;
  originalNote?: string;
  enhancedNote?: string;
  enhancementType?: string;
  aiGenerated?: boolean;
  error?: string;
}

interface ExtractedEntities {
  success: boolean;
  entities?: {
    diagnoses?: string[];
    medications?: string[];
    procedures?: string[];
    vitals?: string[];
    labs?: string[];
    allergies?: string[];
    symptoms?: string[];
    assessments?: string[];
    plans?: string[];
  };
  aiGenerated?: boolean;
  error?: string;
}

interface IcdCode {
  code: string;
  description: string;
  confidence: string;
  supportingText?: string;
}

interface SuggestedCodes {
  success: boolean;
  codes?: IcdCode[];
  disclaimer?: string;
  aiGenerated?: boolean;
  error?: string;
}

const NOTE_TYPES = [
  { id: 'soap', name: 'SOAP Note', icon: ClipboardDocumentListIcon, color: 'blue' },
  { id: 'discharge', name: 'Discharge Summary', icon: DocumentTextIcon, color: 'green' },
  { id: 'progress', name: 'Progress Note', icon: ArrowPathIcon, color: 'purple' },
  { id: 'procedure', name: 'Procedure Note', icon: BeakerIcon, color: 'orange' },
  { id: 'consultation', name: 'Consultation', icon: AcademicCapIcon, color: 'teal' },
  { id: 'emergency', name: 'ED Note', icon: DocumentDuplicateIcon, color: 'red' },
];

const ENHANCEMENT_TYPES = [
  { id: 'improve', name: 'Improve Clarity', description: 'Enhance language and structure' },
  { id: 'expand', name: 'Expand Details', description: 'Add more medical detail' },
  { id: 'summarize', name: 'Summarize', description: 'Create concise summary' },
  { id: 'correct', name: 'Correct', description: 'Fix grammar and formatting' },
  { id: 'structure', name: 'Restructure', description: 'Reorganize into sections' },
];

const AI_SERVICE_URL = 'http://localhost:8000';

export default function ClinicalNotesAI() {
  const [activeTab, setActiveTab] = useState<'generate' | 'enhance' | 'extract' | 'transcribe'>('generate');
  const [selectedNoteType, setSelectedNoteType] = useState('soap');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate Note State
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    mrn: '',
    dob: '',
    age: '',
    gender: 'Male',
  });
  const [clinicalData, setClinicalData] = useState({
    chiefComplaint: '',
    historyOfPresentIllness: '',
    vitalSigns: '',
    physicalExam: '',
    assessment: '',
    plan: '',
    medications: '',
    allergies: '',
  });
  const [generatedNote, setGeneratedNote] = useState<GeneratedNote | null>(null);

  // Enhance Note State
  const [existingNote, setExistingNote] = useState('');
  const [enhancementType, setEnhancementType] = useState('improve');
  const [enhancedNote, setEnhancedNote] = useState<EnhancedNote | null>(null);

  // Extract Entities State
  const [noteToAnalyze, setNoteToAnalyze] = useState('');
  const [extractedEntities, setExtractedEntities] = useState<ExtractedEntities | null>(null);
  const [suggestedCodes, setSuggestedCodes] = useState<SuggestedCodes | null>(null);

  // Transcribe State
  const [transcription, setTranscription] = useState('');
  const [transcribedNote, setTranscribedNote] = useState<GeneratedNote | null>(null);

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    patientInfo: true,
    clinicalData: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleGenerateNote = async () => {
    setIsLoading(true);
    setError(null);
    setGeneratedNote(null);

    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/notes/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteType: selectedNoteType,
          patientInfo: {
            name: patientInfo.name || 'Unknown',
            mrn: patientInfo.mrn || 'N/A',
            dob: patientInfo.dob || 'N/A',
            age: patientInfo.age || 'N/A',
            gender: patientInfo.gender,
          },
          clinicalData: {
            chiefComplaint: clinicalData.chiefComplaint,
            historyOfPresentIllness: clinicalData.historyOfPresentIllness,
            vitalSigns: clinicalData.vitalSigns,
            physicalExamination: clinicalData.physicalExam,
            assessment: clinicalData.assessment,
            plan: clinicalData.plan,
            currentMedications: clinicalData.medications,
            allergies: clinicalData.allergies,
          },
        }),
      });

      const data = await response.json();
      setGeneratedNote(data);
    } catch (err) {
      setError('Failed to generate note. Please check if AI services are running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnhanceNote = async () => {
    if (!existingNote.trim()) {
      setError('Please enter a note to enhance');
      return;
    }

    setIsLoading(true);
    setError(null);
    setEnhancedNote(null);

    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/notes/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingNote: existingNote,
          enhancementType: enhancementType,
        }),
      });

      const data = await response.json();
      setEnhancedNote(data);
    } catch (err) {
      setError('Failed to enhance note. Please check if AI services are running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtractEntities = async () => {
    if (!noteToAnalyze.trim()) {
      setError('Please enter a note to analyze');
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedEntities(null);
    setSuggestedCodes(null);

    try {
      // Extract entities
      const entitiesResponse = await fetch(`${AI_SERVICE_URL}/api/notes/extract-entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteText: noteToAnalyze }),
      });
      const entitiesData = await entitiesResponse.json();
      setExtractedEntities(entitiesData);

      // Suggest ICD codes
      const codesResponse = await fetch(`${AI_SERVICE_URL}/api/notes/suggest-icd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteText: noteToAnalyze }),
      });
      const codesData = await codesResponse.json();
      setSuggestedCodes(codesData);
    } catch (err) {
      setError('Failed to analyze note. Please check if AI services are running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscriptionToNote = async () => {
    if (!transcription.trim()) {
      setError('Please enter transcription text');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTranscribedNote(null);

    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/notes/from-transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcription: transcription,
          noteType: selectedNoteType,
          patientInfo: patientInfo.name ? patientInfo : null,
        }),
      });

      const data = await response.json();
      setTranscribedNote({
        success: data.success,
        noteType: data.noteType,
        noteName: data.noteName,
        generatedNote: data.structuredNote,
        timestamp: data.timestamp,
        aiGenerated: data.aiGenerated,
        error: data.error,
      });
    } catch (err) {
      setError('Failed to convert transcription. Please check if AI services are running.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'generate':
        return (
          <div className="space-y-6">
            {/* Note Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Note Type
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {NOTE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedNoteType(type.id)}
                    className={clsx(
                      'p-3 rounded-xl border-2 transition-all text-center',
                      selectedNoteType === type.id
                        ? `border-${type.color}-500 bg-${type.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <type.icon
                      className={clsx(
                        'h-6 w-6 mx-auto mb-1',
                        selectedNoteType === type.id
                          ? `text-${type.color}-600`
                          : 'text-gray-400'
                      )}
                    />
                    <span
                      className={clsx(
                        'text-xs font-medium',
                        selectedNoteType === type.id
                          ? `text-${type.color}-700`
                          : 'text-gray-600'
                      )}
                    >
                      {type.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Patient Information */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleSection('patientInfo')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">
                  Patient Information
                </span>
                {expandedSections.patientInfo ? (
                  <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
              {expandedSections.patientInfo && (
                <div className="p-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-5 gap-4">
                  <input
                    type="text"
                    placeholder="Patient Name"
                    value={patientInfo.name}
                    onChange={(e) =>
                      setPatientInfo({ ...patientInfo, name: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="MRN"
                    value={patientInfo.mrn}
                    onChange={(e) =>
                      setPatientInfo({ ...patientInfo, mrn: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="DOB"
                    value={patientInfo.dob}
                    onChange={(e) =>
                      setPatientInfo({ ...patientInfo, dob: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Age"
                    value={patientInfo.age}
                    onChange={(e) =>
                      setPatientInfo({ ...patientInfo, age: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  />
                  <select
                    value={patientInfo.gender}
                    onChange={(e) =>
                      setPatientInfo({ ...patientInfo, gender: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}
            </div>

            {/* Clinical Data */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => toggleSection('clinicalData')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span className="font-medium text-gray-900">
                  Clinical Data
                </span>
                {expandedSections.clinicalData ? (
                  <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
              {expandedSections.clinicalData && (
                <div className="p-4 border-t border-gray-200 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Chief Complaint
                      </label>
                      <input
                        type="text"
                        value={clinicalData.chiefComplaint}
                        onChange={(e) =>
                          setClinicalData({
                            ...clinicalData,
                            chiefComplaint: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                        placeholder="e.g., chest pain, shortness of breath"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Vital Signs
                      </label>
                      <input
                        type="text"
                        value={clinicalData.vitalSigns}
                        onChange={(e) =>
                          setClinicalData({
                            ...clinicalData,
                            vitalSigns: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                        placeholder="e.g., BP 120/80, HR 72, RR 16, Temp 98.6F"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      History of Present Illness
                    </label>
                    <textarea
                      value={clinicalData.historyOfPresentIllness}
                      onChange={(e) =>
                        setClinicalData({
                          ...clinicalData,
                          historyOfPresentIllness: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                      rows={3}
                      placeholder="Describe the present illness..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Physical Examination
                    </label>
                    <textarea
                      value={clinicalData.physicalExam}
                      onChange={(e) =>
                        setClinicalData({
                          ...clinicalData,
                          physicalExam: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                      rows={3}
                      placeholder="Physical examination findings..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Assessment
                      </label>
                      <textarea
                        value={clinicalData.assessment}
                        onChange={(e) =>
                          setClinicalData({
                            ...clinicalData,
                            assessment: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                        rows={2}
                        placeholder="Clinical assessment..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Plan
                      </label>
                      <textarea
                        value={clinicalData.plan}
                        onChange={(e) =>
                          setClinicalData({
                            ...clinicalData,
                            plan: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                        rows={2}
                        placeholder="Treatment plan..."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Current Medications
                      </label>
                      <input
                        type="text"
                        value={clinicalData.medications}
                        onChange={(e) =>
                          setClinicalData({
                            ...clinicalData,
                            medications: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                        placeholder="e.g., Lisinopril 10mg, Metformin 500mg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Allergies
                      </label>
                      <input
                        type="text"
                        value={clinicalData.allergies}
                        onChange={(e) =>
                          setClinicalData({
                            ...clinicalData,
                            allergies: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm"
                        placeholder="e.g., Penicillin, Sulfa"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateNote}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25"
            >
              {isLoading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <SparklesIcon className="h-5 w-5" />
                  Generate {NOTE_TYPES.find((t) => t.id === selectedNoteType)?.name}
                </>
              )}
            </button>

            {/* Generated Note Result */}
            {generatedNote && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-purple-500" />
                    <span className="font-medium text-gray-900">
                      Generated {generatedNote.noteName}
                    </span>
                    {generatedNote.aiGenerated && (
                      <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                        AI Generated
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => copyToClipboard(generatedNote.generatedNote || '')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy to clipboard"
                  >
                    <DocumentDuplicateIcon className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
                <div className="p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                    {generatedNote.generatedNote}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );

      case 'enhance':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Enhancement Type
              </label>
              <div className="flex flex-wrap gap-2">
                {ENHANCEMENT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setEnhancementType(type.id)}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      enhancementType === type.id
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Existing Note
              </label>
              <textarea
                value={existingNote}
                onChange={(e) => setExistingNote(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900"
                rows={10}
                placeholder="Paste your existing clinical note here..."
              />
            </div>

            <button
              onClick={handleEnhanceNote}
              disabled={isLoading || !existingNote.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-500/25"
            >
              {isLoading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Enhancing...
                </>
              ) : (
                <>
                  <SparklesIcon className="h-5 w-5" />
                  Enhance Note
                </>
              )}
            </button>

            {enhancedNote && enhancedNote.success && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-pink-500" />
                    <span className="font-medium text-gray-900">
                      Enhanced Note
                    </span>
                    {enhancedNote.aiGenerated && (
                      <span className="px-2 py-0.5 text-xs bg-pink-100 text-pink-700 rounded-full">
                        AI Enhanced
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => copyToClipboard(enhancedNote.enhancedNote || '')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <DocumentDuplicateIcon className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
                <div className="p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                    {enhancedNote.enhancedNote}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );

      case 'extract':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Clinical Note to Analyze
              </label>
              <textarea
                value={noteToAnalyze}
                onChange={(e) => setNoteToAnalyze(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900"
                rows={8}
                placeholder="Paste a clinical note to extract entities and suggest ICD codes..."
              />
            </div>

            <button
              onClick={handleExtractEntities}
              disabled={isLoading || !noteToAnalyze.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-medium rounded-xl hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50 transition-all shadow-lg shadow-teal-500/25"
            >
              {isLoading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <BeakerIcon className="h-5 w-5" />
                  Extract Entities & Suggest ICD Codes
                </>
              )}
            </button>

            {/* Extracted Entities */}
            {extractedEntities && extractedEntities.success && extractedEntities.entities && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <TagIcon className="h-5 w-5 text-teal-500" />
                    <span className="font-medium text-gray-900">
                      Extracted Entities
                    </span>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(extractedEntities.entities).map(([key, values]) => (
                    values && values.length > 0 && (
                      <div key={key} className="bg-gray-50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {values.map((value, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-white text-gray-700 rounded-md border border-gray-200"
                            >
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Suggested ICD Codes */}
            {suggestedCodes && suggestedCodes.success && suggestedCodes.codes && suggestedCodes.codes.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <ClipboardDocumentListIcon className="h-5 w-5 text-cyan-500" />
                    <span className="font-medium text-gray-900">
                      Suggested ICD-10 Codes
                    </span>
                  </div>
                  {suggestedCodes.disclaimer && (
                    <p className="text-xs text-amber-600 mt-1">
                      {suggestedCodes.disclaimer}
                    </p>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  {suggestedCodes.codes.map((code, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="px-2 py-1 bg-cyan-100 text-cyan-700 font-mono text-sm rounded">
                        {code.code}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">
                          {code.description}
                        </p>
                        {code.supportingText && (
                          <p className="text-xs text-gray-500 mt-1">
                            "{code.supportingText}"
                          </p>
                        )}
                      </div>
                      <span
                        className={clsx(
                          'px-2 py-0.5 text-xs rounded-full',
                          code.confidence === 'high'
                            ? 'bg-green-100 text-green-700'
                            : code.confidence === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {code.confidence}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'transcribe':
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Target Note Format
              </label>
              <div className="flex flex-wrap gap-2">
                {NOTE_TYPES.slice(0, 4).map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedNoteType(type.id)}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      selectedNoteType === type.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Voice Transcription
              </label>
              <textarea
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900"
                rows={8}
                placeholder="Paste voice transcription here or dictate your notes..."
              />
              <p className="mt-2 text-xs text-gray-500">
                The AI will convert your dictation into a structured clinical note format.
              </p>
            </div>

            <button
              onClick={handleTranscriptionToNote}
              disabled={isLoading || !transcription.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/25"
            >
              {isLoading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <MicrophoneIcon className="h-5 w-5" />
                  Convert to Structured Note
                </>
              )}
            </button>

            {transcribedNote && transcribedNote.success && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <MicrophoneIcon className="h-5 w-5 text-indigo-500" />
                    <span className="font-medium text-gray-900">
                      Structured {transcribedNote.noteName}
                    </span>
                    {transcribedNote.aiGenerated && (
                      <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full">
                        AI Structured
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => copyToClipboard(transcribedNote.generatedNote || '')}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <DocumentDuplicateIcon className="h-5 w-5 text-gray-400" />
                  </button>
                </div>
                <div className="p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                    {transcribedNote.generatedNote}
                  </pre>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
          <DocumentTextIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            AI Clinical Notes
          </h2>
          <p className="text-sm text-gray-500">
            Generate, enhance, and analyze clinical documentation
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {[
          { id: 'generate', label: 'Generate', icon: SparklesIcon },
          { id: 'enhance', label: 'Enhance', icon: ArrowPathIcon },
          { id: 'extract', label: 'Analyze', icon: TagIcon },
          { id: 'transcribe', label: 'Transcribe', icon: MicrophoneIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      )}

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}
