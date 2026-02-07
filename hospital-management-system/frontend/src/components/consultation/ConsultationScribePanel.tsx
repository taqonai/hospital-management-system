import { useState } from 'react';
import {
  MicrophoneIcon,
  StopIcon,
  PauseIcon,
  PlayIcon,
  SparklesIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useConsultationScribe, ScribeResults } from '../../hooks/useConsultationScribe';

// ============ Types ============

interface ConsultationScribePanelProps {
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  appointmentId: string;
  existingConditions?: string[];
  currentMedications?: string[];
  knownAllergies?: string[];
  onResultsReady: (results: ScribeResults) => void;
}

// ============ Helpers ============

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============ Component ============

export default function ConsultationScribePanel({
  patientId,
  patientName,
  patientAge,
  patientGender,
  appointmentId,
  existingConditions,
  currentMedications,
  knownAllergies,
  onResultsReady,
}: ConsultationScribePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);

  const {
    scribeStatus,
    isEnabled,
    duration,
    results,
    error,
    pauseRecording,
    resumeRecording,
    stopAndProcess,
    toggleEnabled,
    reset,
  } = useConsultationScribe({
    autoStart: true,
    patientContext: {
      patientId,
      patientName,
      patientAge,
      patientGender,
      appointmentId,
      existingConditions,
      currentMedications,
      knownAllergies,
    },
  });

  const handleApply = () => {
    if (results) {
      onResultsReady(results);
    }
  };

  const handleReRecord = () => {
    reset();
  };

  // ---- Render: Disabled state ----
  if (!isEnabled) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MicrophoneIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-500">AI Scribe (Off)</span>
          <span className="text-xs text-gray-400">Scribe disabled for this session</span>
        </div>
        <button
          onClick={toggleEnabled}
          className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        >
          <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform translate-x-1" />
        </button>
      </div>
    );
  }

  // ---- Render: Recording state ----
  if (scribeStatus === 'recording' || scribeStatus === 'paused') {
    return (
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {scribeStatus === 'recording' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${scribeStatus === 'recording' ? 'bg-red-500' : 'bg-yellow-500'}`} />
            </span>
            <span className="text-sm font-medium text-gray-800">
              AI Scribe {scribeStatus === 'paused' ? 'Paused' : 'Recording'}
            </span>
            <span className="text-sm font-mono text-gray-600 bg-white/60 px-2 py-0.5 rounded">
              {formatDuration(duration)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {scribeStatus === 'recording' ? (
              <button
                onClick={pauseRecording}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
              >
                <PauseIcon className="h-4 w-4" />
                Pause
              </button>
            ) : (
              <button
                onClick={resumeRecording}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
              >
                <PlayIcon className="h-4 w-4" />
                Resume
              </button>
            )}
            <button
              onClick={stopAndProcess}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
            >
              <StopIcon className="h-4 w-4" />
              Stop & Process
            </button>
            <button
              onClick={toggleEnabled}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-purple-500 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform translate-x-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: Processing state ----
  if (scribeStatus === 'processing') {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl px-4 py-4 mb-4">
        <div className="flex items-center gap-3 mb-2">
          <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />
          <span className="text-sm font-medium text-blue-800">AI Scribe Processing...</span>
        </div>
        <p className="text-xs text-blue-600 mb-2">Transcribing & generating clinical notes...</p>
        <div className="w-full bg-blue-200 rounded-full h-1.5">
          <div className="bg-blue-500 h-1.5 rounded-full animate-pulse" style={{ width: '70%' }} />
        </div>
      </div>
    );
  }

  // ---- Render: Error state ----
  if (scribeStatus === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <XMarkIcon className="h-5 w-5 text-red-500" />
            <div>
              <span className="text-sm font-medium text-red-800">AI Scribe Error</span>
              <p className="text-xs text-red-600">{error || 'An error occurred'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReRecord}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
            >
              <ArrowPathIcon className="h-4 w-4" />
              Try Again
            </button>
            <button
              onClick={toggleEnabled}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-purple-500 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform translate-x-6" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: Results ready (completed) ----
  if (scribeStatus === 'completed' && results) {
    const symptomCount = results.extractedSymptoms?.length || 0;
    const diagnosisCount = results.extractedDiagnoses?.length || 0;
    const medicationCount = results.extractedMedications?.length || 0;

    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl px-4 py-3 mb-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-800">AI Scribe Results</span>
            <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
              {symptomCount} symptoms, {diagnosisCount} diagnoses, {medicationCount} medications
            </span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-green-600 hover:text-green-800 p-1"
          >
            {isExpanded ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-3 space-y-3">
            {/* Transcript */}
            {results.transcript && (
              <div>
                <button
                  onClick={() => setTranscriptExpanded(!transcriptExpanded)}
                  className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1"
                >
                  <span>Transcript</span>
                  {transcriptExpanded ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                </button>
                <p className={`text-xs text-gray-600 bg-white/60 rounded-lg p-2 ${!transcriptExpanded ? 'line-clamp-2' : ''}`}>
                  {results.transcript}
                </p>
              </div>
            )}

            {/* SOAP Note */}
            {results.soapNote && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">SOAP Note</p>
                <div className="grid grid-cols-2 gap-2">
                  {results.soapNote.subjective && (
                    <div className="bg-white/60 rounded-lg p-2">
                      <span className="text-xs font-semibold text-purple-700">S: </span>
                      <span className="text-xs text-gray-600">{results.soapNote.subjective.slice(0, 100)}{results.soapNote.subjective.length > 100 ? '...' : ''}</span>
                    </div>
                  )}
                  {results.soapNote.objective && (
                    <div className="bg-white/60 rounded-lg p-2">
                      <span className="text-xs font-semibold text-blue-700">O: </span>
                      <span className="text-xs text-gray-600">{results.soapNote.objective.slice(0, 100)}{results.soapNote.objective.length > 100 ? '...' : ''}</span>
                    </div>
                  )}
                  {results.soapNote.assessment && (
                    <div className="bg-white/60 rounded-lg p-2">
                      <span className="text-xs font-semibold text-green-700">A: </span>
                      <span className="text-xs text-gray-600">{results.soapNote.assessment.slice(0, 100)}{results.soapNote.assessment.length > 100 ? '...' : ''}</span>
                    </div>
                  )}
                  {results.soapNote.plan && (
                    <div className="bg-white/60 rounded-lg p-2">
                      <span className="text-xs font-semibold text-orange-700">P: </span>
                      <span className="text-xs text-gray-600">{results.soapNote.plan.slice(0, 100)}{results.soapNote.plan.length > 100 ? '...' : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ICD-10 Codes */}
            {results.icdCodes?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Suggested ICD-10 Codes</p>
                <div className="flex flex-wrap gap-1">
                  {results.icdCodes.map((code, i) => (
                    <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      {code.code} - {code.description}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-up recommendations */}
            {results.followUpRecommendations?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Follow-up Recommendations</p>
                <ul className="list-disc list-inside text-xs text-gray-600">
                  {results.followUpRecommendations.map((rec, i) => (
                    <li key={i}>{rec.recommendation}{rec.timeframe ? ` (${rec.timeframe})` : ''}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Prescription suggestions */}
            {results.prescriptionSuggestions?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-700 mb-1">Prescription Suggestions (review before accepting)</p>
                <div className="flex flex-wrap gap-1">
                  {results.prescriptionSuggestions.map((rx, i) => (
                    <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {rx.medication}{rx.dosage ? ` ${rx.dosage}` : ''}{rx.frequency ? ` ${rx.frequency}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-green-200">
          <button
            onClick={handleApply}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg transition-all shadow-sm"
          >
            <SparklesIcon className="h-4 w-4" />
            Apply to Consultation
          </button>
          <button
            onClick={handleReRecord}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Re-record
          </button>
          <button
            onClick={() => { reset(); }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    );
  }

  // ---- Render: Idle state (waiting for auto-start or mic permission) ----
  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <MicrophoneIcon className="h-5 w-5 text-purple-500" />
        <span className="text-sm font-medium text-purple-800">AI Scribe</span>
        <span className="text-xs text-purple-600">
          {error ? error : 'Waiting for microphone access...'}
        </span>
      </div>
      <button
        onClick={toggleEnabled}
        className="relative inline-flex h-6 w-11 items-center rounded-full bg-purple-500 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
      >
        <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform translate-x-6" />
      </button>
    </div>
  );
}
