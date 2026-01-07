import { useState, useEffect } from 'react';
import {
  SparklesIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PlusIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  HeartIcon,
  ShieldExclamationIcon,
  LightBulbIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

interface PatientContext {
  id?: string;
  age: number;
  gender: string;
  medicalHistory?: string[];
  currentMedications?: string[];
  allergies?: string[];
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    oxygenSaturation?: number;
    respiratoryRate?: number;
  };
}

interface Diagnosis {
  icd10: string;
  name: string;
  confidence: number;
  category?: string;
  severity?: string;
}

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: string;
  warning: string;
}

interface RiskFactor {
  factor: string;
  relevance: string;
}

interface AgeAdjustedWarning {
  symptom: string;
  ageGroup: string;
  severityMultiplier: number;
  warnings: string[];
  priority: 'high' | 'moderate';
}

interface UrgencyAssessment {
  level: 'HIGH' | 'MODERATE-HIGH' | 'MODERATE' | 'LOW';
  baseScore: number;
  ageAdjustedScore: number;
  ageMultiplier: number;
  patientAgeCategory: string;
  patientAge: number;
  highPrioritySymptoms?: string[];
  ageConsideration?: string;
}

interface DiagnosisResult {
  diagnoses: Diagnosis[];
  recommendedTests: string[];
  treatmentSuggestions: string[];
  drugInteractions: DrugInteraction[];
  riskFactors: RiskFactor[];
  ageAdjustedWarnings?: AgeAdjustedWarning[];
  urgencyAssessment?: UrgencyAssessment;
  confidence: number;
  modelVersion: string;
}

interface DiagnosticAssistantProps {
  patient?: PatientContext;
  onDiagnosisSelect?: (diagnosis: Diagnosis) => void;
  onTestSelect?: (tests: string[]) => void;
  className?: string;
}

const COMMON_SYMPTOMS = [
  'headache', 'fever', 'cough', 'fatigue', 'nausea', 'vomiting',
  'chest pain', 'shortness of breath', 'abdominal pain', 'diarrhea',
  'dizziness', 'back pain', 'joint pain', 'sore throat', 'runny nose',
  'muscle aches', 'chills', 'sweating', 'loss of appetite', 'weight loss',
  'palpitations', 'swelling', 'rash', 'itching', 'blurred vision',
];

export default function DiagnosticAssistant({
  patient,
  onDiagnosisSelect,
  className,
}: DiagnosticAssistantProps) {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    diagnoses: true,
    tests: true,
    treatments: false,
    interactions: true,
    risks: false,
    ageWarnings: true,
  });

  useEffect(() => {
    if (symptomInput.length >= 2) {
      const filtered = COMMON_SYMPTOMS.filter(
        s => s.toLowerCase().includes(symptomInput.toLowerCase()) && !symptoms.includes(s)
      ).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [symptomInput, symptoms]);

  const addSymptom = (symptom: string) => {
    const normalized = symptom.toLowerCase().trim();
    if (normalized && !symptoms.includes(normalized)) {
      setSymptoms([...symptoms, normalized]);
    }
    setSymptomInput('');
    setSuggestions([]);
  };

  const removeSymptom = (symptom: string) => {
    setSymptoms(symptoms.filter(s => s !== symptom));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && symptomInput.trim()) {
      e.preventDefault();
      addSymptom(symptomInput);
    }
  };

  const analyzeSymptoms = async () => {
    if (symptoms.length === 0) {
      setError('Please add at least one symptom');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await fetch(`${API_URL}/ai/diagnose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          symptoms,
          patientAge: patient?.age || 35,
          gender: patient?.gender || 'unknown',
          medicalHistory: patient?.medicalHistory || [],
          currentMedications: patient?.currentMedications || [],
          allergies: patient?.allergies || [],
          vitalSigns: patient?.vitalSigns || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze symptoms');
      }

      const data = await response.json();
      // API returns { success: true, data: {...} } - extract the actual data
      setResult(data.data || data);
    } catch (err) {
      console.error('Diagnosis error:', err);
      setError('Failed to analyze symptoms. Please ensure the AI service is running.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-700 bg-green-100';
    if (confidence >= 0.4) return 'text-amber-700 bg-amber-100';
    return 'text-red-700 bg-red-100';
  };

  const getSeverityColor = (severity?: string) => {
    if (!severity) return 'bg-gray-100 text-gray-700';
    switch (severity.toLowerCase()) {
      case 'mild': return 'bg-green-100 text-green-700';
      case 'moderate': return 'bg-amber-100 text-amber-700';
      case 'severe': case 'emergency': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getUrgencyColor = (level?: string) => {
    switch (level) {
      case 'HIGH': return 'bg-red-600 text-white';
      case 'MODERATE-HIGH': return 'bg-orange-500 text-white';
      case 'MODERATE': return 'bg-amber-500 text-white';
      case 'LOW': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getUrgencyBorderColor = (level?: string) => {
    switch (level) {
      case 'HIGH': return 'border-red-500 bg-red-50';
      case 'MODERATE-HIGH': return 'border-orange-500 bg-orange-50';
      case 'MODERATE': return 'border-amber-500 bg-amber-50';
      case 'LOW': return 'border-green-500 bg-green-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <SparklesIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">AI Diagnostic Assistant</h3>
            <p className="text-sm text-blue-100">Enter symptoms for AI-powered analysis</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Patient Context */}
        {patient && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-gray-600"><strong>Age:</strong> {patient.age} yrs</span>
              <span className="text-gray-600"><strong>Gender:</strong> {patient.gender}</span>
              {patient.vitalSigns?.bloodPressure && (
                <span className="text-gray-600"><strong>BP:</strong> {patient.vitalSigns.bloodPressure}</span>
              )}
              {patient.vitalSigns?.heartRate && (
                <span className="text-gray-600"><strong>HR:</strong> {patient.vitalSigns.heartRate} bpm</span>
              )}
            </div>
          </div>
        )}

        {/* Symptom Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Enter Symptoms</label>
          <div className="relative">
            <input
              type="text"
              value={symptomInput}
              onChange={(e) => setSymptomInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a symptom and press Enter..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={() => symptomInput && addSymptom(symptomInput)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              <PlusIcon className="h-5 w-5" />
            </button>

            {suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => addSymptom(suggestion)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Symptom Tags */}
          {symptoms.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {symptoms.map((symptom) => (
                <span
                  key={symptom}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {symptom}
                  <button onClick={() => removeSymptom(symptom)} className="hover:text-blue-900">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Quick add suggestions */}
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-2">Quick add:</p>
            <div className="flex flex-wrap gap-1">
              {COMMON_SYMPTOMS.filter(s => !symptoms.includes(s)).slice(0, 8).map(s => (
                <button
                  key={s}
                  onClick={() => addSymptom(s)}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Analyze Button */}
        <button
          onClick={analyzeSymptoms}
          disabled={loading || symptoms.length === 0}
          className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
            loading || symptoms.length === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? (
            <>
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <SparklesIcon className="h-5 w-5" />
              Analyze Symptoms
            </>
          )}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-6 space-y-4">
            {/* Overall Confidence */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Analysis Confidence</span>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${getConfidenceColor(result.confidence)}`}>
                {Math.round(result.confidence * 100)}%
              </span>
            </div>

            {/* Urgency Assessment - Show prominently if age affects severity */}
            {result.urgencyAssessment && result.urgencyAssessment.ageMultiplier > 1 && (
              <div className={`p-4 rounded-lg border-2 ${getUrgencyBorderColor(result.urgencyAssessment.level)}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className={`h-6 w-6 ${
                      result.urgencyAssessment.level === 'HIGH' ? 'text-red-600' :
                      result.urgencyAssessment.level === 'MODERATE-HIGH' ? 'text-orange-600' : 'text-amber-600'
                    }`} />
                    <span className="font-bold text-gray-900">Age-Adjusted Urgency</span>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${getUrgencyColor(result.urgencyAssessment.level)}`}>
                    {result.urgencyAssessment.level}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                  <div className="p-2 bg-white rounded border">
                    <span className="text-gray-500">Patient Age:</span>
                    <span className="ml-2 font-semibold">{result.urgencyAssessment.patientAge} years</span>
                    <span className="ml-1 text-gray-500">({result.urgencyAssessment.patientAgeCategory})</span>
                  </div>
                  <div className="p-2 bg-white rounded border">
                    <span className="text-gray-500">Age Factor:</span>
                    <span className={`ml-2 font-semibold ${result.urgencyAssessment.ageMultiplier > 1.3 ? 'text-red-600' : 'text-orange-600'}`}>
                      {result.urgencyAssessment.ageMultiplier}x severity
                    </span>
                  </div>
                </div>

                {result.urgencyAssessment.ageConsideration && (
                  <div className="p-3 bg-white rounded border border-amber-200">
                    <p className="text-sm text-gray-700">
                      <strong className="text-amber-700">Clinical Note:</strong> {result.urgencyAssessment.ageConsideration}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Age-Adjusted Warnings */}
            {(result.ageAdjustedWarnings?.length || 0) > 0 && (
              <div className="border border-orange-300 bg-orange-50 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('ageWarnings')}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-orange-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-orange-600" />
                    <span className="font-medium text-orange-800">Age-Specific Clinical Warnings</span>
                    <span className="px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full text-xs font-bold">
                      {result.ageAdjustedWarnings?.length || 0}
                    </span>
                  </div>
                  {expandedSections.ageWarnings ? <ChevronUpIcon className="h-5 w-5 text-orange-600" /> : <ChevronDownIcon className="h-5 w-5 text-orange-600" />}
                </button>

                {expandedSections.ageWarnings && (
                  <div className="p-4 space-y-3">
                    {(result.ageAdjustedWarnings || []).map((warning, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border ${
                          warning.priority === 'high'
                            ? 'bg-red-50 border-red-300'
                            : 'bg-amber-50 border-amber-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${warning.priority === 'high' ? 'text-red-700' : 'text-amber-700'}`}>
                              {warning.symptom}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              warning.priority === 'high'
                                ? 'bg-red-200 text-red-800'
                                : 'bg-amber-200 text-amber-800'
                            }`}>
                              {warning.priority.toUpperCase()} PRIORITY
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">
                            Severity: <strong className={warning.severityMultiplier >= 1.5 ? 'text-red-600' : 'text-amber-600'}>
                              {warning.severityMultiplier}x
                            </strong>
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {warning.warnings.map((w, wIdx) => (
                            <li key={wIdx} className="flex items-start gap-2 text-sm">
                              <ExclamationTriangleIcon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                                warning.priority === 'high' ? 'text-red-500' : 'text-amber-500'
                              }`} />
                              <span className="text-gray-700">{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Diagnoses */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('diagnoses')}
                className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ClipboardDocumentListIcon className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Differential Diagnoses</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    {result.diagnoses?.length || 0}
                  </span>
                </div>
                {expandedSections.diagnoses ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
              </button>

              {expandedSections.diagnoses && (
                <div className="p-4 space-y-3">
                  {(result.diagnoses || []).map((diag, idx) => (
                    <div
                      key={diag.icd10}
                      onClick={() => onDiagnosisSelect?.(diag)}
                      className={`p-3 rounded-lg border transition-all ${
                        idx === 0 ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                      } ${onDiagnosisSelect ? 'cursor-pointer hover:shadow-md' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium text-gray-900">{diag.name}</span>
                          {diag.severity && (
                            <span className={`ml-2 px-2 py-0.5 rounded text-xs ${getSeverityColor(diag.severity)}`}>
                              {diag.severity}
                            </span>
                          )}
                          <p className="text-sm text-gray-500 mt-0.5">ICD-10: {diag.icd10}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${getConfidenceColor(diag.confidence)}`}>
                          {Math.round(diag.confidence * 100)}%
                        </span>
                      </div>
                      {diag.category && (
                        <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {diag.category}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommended Tests */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('tests')}
                className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BeakerIcon className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Recommended Tests</span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                    {result.recommendedTests?.length || 0}
                  </span>
                </div>
                {expandedSections.tests ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
              </button>

              {expandedSections.tests && (
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {(result.recommendedTests || []).map((test) => (
                      <span key={test} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm border border-green-200">
                        {test}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drug Interactions */}
            {(result.drugInteractions?.length || 0) > 0 && (
              <div className="border border-red-200 bg-red-50 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('interactions')}
                  className="w-full px-4 py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <ShieldExclamationIcon className="h-5 w-5 text-red-600" />
                    <span className="font-medium text-red-700">Drug Interactions</span>
                    <span className="px-2 py-0.5 bg-red-200 text-red-700 rounded-full text-xs">
                      {result.drugInteractions?.length || 0}
                    </span>
                  </div>
                  {expandedSections.interactions ? <ChevronUpIcon className="h-5 w-5 text-red-600" /> : <ChevronDownIcon className="h-5 w-5 text-red-600" />}
                </button>

                {expandedSections.interactions && (
                  <div className="p-4 space-y-2">
                    {(result.drugInteractions || []).map((interaction, idx) => (
                      <div key={idx} className="p-3 bg-white rounded-lg border border-red-200">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-red-700">{interaction.drug1}</span>
                          <span className="text-gray-400">+</span>
                          <span className="font-medium text-red-700">{interaction.drug2}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            interaction.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {interaction.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{interaction.warning}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Treatment Suggestions */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('treatments')}
                className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <LightBulbIcon className="h-5 w-5 text-amber-600" />
                  <span className="font-medium">Treatment Suggestions</span>
                </div>
                {expandedSections.treatments ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
              </button>

              {expandedSections.treatments && (
                <div className="p-4">
                  <ul className="space-y-2">
                    {(result.treatmentSuggestions || []).map((suggestion, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircleIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Risk Factors */}
            {(result.riskFactors?.length || 0) > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('risks')}
                  className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <HeartIcon className="h-5 w-5 text-rose-600" />
                    <span className="font-medium">Risk Factors</span>
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-xs">
                      {result.riskFactors?.length || 0}
                    </span>
                  </div>
                  {expandedSections.risks ? <ChevronUpIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                </button>

                {expandedSections.risks && (
                  <div className="p-4 space-y-2">
                    {(result.riskFactors || []).map((risk, idx) => (
                      <div key={idx} className="p-3 bg-rose-50 rounded-lg">
                        <p className="font-medium text-rose-700">{risk.factor}</p>
                        <p className="text-sm text-gray-600">{risk.relevance}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Model Version */}
            <div className="text-center text-xs text-gray-400">
              AI Model: {result.modelVersion}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
