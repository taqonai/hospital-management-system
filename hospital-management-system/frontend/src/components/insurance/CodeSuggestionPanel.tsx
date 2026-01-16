import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  SparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { api } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import clsx from 'clsx';

// Types
interface SuggestedICD10 {
  code: string;
  description: string;
  confidence: number;
  specificityLevel?: string;
  isPreferred?: boolean;
  rationale?: string;
}

interface SuggestedCPT {
  code: string;
  description: string;
  confidence: number;
  medicalNecessityScore?: number;
  requiredModifiers?: string[];
  rationale?: string;
}

interface CodeSuggestion {
  icd10Codes: SuggestedICD10[];
  cptCodes: SuggestedCPT[];
  extractedDiagnoses: string[];
  confidence: number;
  modelVersion: string;
}

interface AcceptancePrediction {
  acceptanceProbability: number;
  riskLevel: string;
  riskFactors: Array<{ factor: string; impact: string; weight: number }>;
  recommendations: string[];
}

interface CodeSuggestionPanelProps {
  consultationId?: string;
  clinicalText: string;
  patientAge?: number;
  patientGender?: string;
  payerId?: string;
  encounterType?: 'outpatient' | 'inpatient' | 'emergency';
  selectedIcdCodes?: string[];
  selectedCptCodes?: string[];
  onSelectIcdCode?: (code: SuggestedICD10) => void;
  onSelectCptCode?: (code: SuggestedCPT) => void;
  onRemoveIcdCode?: (code: string) => void;
  onRemoveCptCode?: (code: string) => void;
  className?: string;
}

export default function CodeSuggestionPanel({
  consultationId,
  clinicalText,
  patientAge,
  patientGender,
  payerId,
  encounterType = 'outpatient',
  selectedIcdCodes = [],
  selectedCptCodes = [],
  onSelectIcdCode,
  onSelectCptCode,
  onRemoveIcdCode,
  onRemoveCptCode,
  className,
}: CodeSuggestionPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'diagnoses' | 'procedures'>('diagnoses');

  // Fetch AI suggestions
  const {
    data: suggestions,
    isLoading: suggestionsLoading,
    refetch: refetchSuggestions,
  } = useQuery<CodeSuggestion>({
    queryKey: ['code-suggestions', clinicalText, patientAge, patientGender, encounterType],
    queryFn: async () => {
      if (!clinicalText || clinicalText.length < 10) {
        return { icd10Codes: [], cptCodes: [], extractedDiagnoses: [], confidence: 0, modelVersion: '' };
      }
      const response = await api.post('/insurance-coding/ai/suggest', {
        clinicalText,
        patientContext: patientAge && patientGender ? { age: patientAge, gender: patientGender } : undefined,
        encounterType,
        payerId,
      });
      return response.data.data;
    },
    enabled: clinicalText.length >= 10,
    staleTime: 60000, // 1 minute
  });

  // Fetch acceptance prediction when codes are selected
  const {
    data: acceptancePrediction,
    isLoading: predictionLoading,
  } = useQuery<AcceptancePrediction>({
    queryKey: ['acceptance-prediction', selectedIcdCodes, selectedCptCodes, payerId],
    queryFn: async () => {
      if (selectedIcdCodes.length === 0 || selectedCptCodes.length === 0 || !payerId) {
        return null;
      }
      const response = await api.post('/insurance-coding/ai/predict-acceptance', {
        icdCodes: selectedIcdCodes,
        cptCodes: selectedCptCodes,
        payerId,
        patientContext: patientAge && patientGender ? { age: patientAge, gender: patientGender } : undefined,
      });
      return response.data.data;
    },
    enabled: selectedIcdCodes.length > 0 && selectedCptCodes.length > 0 && !!payerId,
  });

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-50';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getAcceptanceColor = (probability: number) => {
    if (probability >= 0.9) return 'bg-green-500';
    if (probability >= 0.7) return 'bg-yellow-500';
    if (probability >= 0.5) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const isIcdSelected = (code: string) => selectedIcdCodes.includes(code);
  const isCptSelected = (code: string) => selectedCptCodes.includes(code);

  return (
    <div className={clsx('bg-white rounded-lg shadow-sm border border-gray-200', className)}>
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-purple-600" />
          <h3 className="font-medium text-gray-900">AI Code Suggestions</h3>
          {suggestionsLoading && <LoadingSpinner size="sm" />}
        </div>
        <div className="flex items-center gap-2">
          {acceptancePrediction && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Acceptance:</span>
              <span
                className={clsx(
                  'px-2 py-0.5 rounded-full text-xs font-medium text-white',
                  getAcceptanceColor(acceptancePrediction.acceptanceProbability)
                )}
              >
                {Math.round(acceptancePrediction.acceptanceProbability * 100)}%
              </span>
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              refetchSuggestions();
            }}
            className="p-1 hover:bg-gray-100 rounded"
            title="Refresh suggestions"
          >
            <ArrowPathIcon className="h-4 w-4 text-gray-500" />
          </button>
          {expanded ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Content */}
      {expanded && (
        <div className="border-t border-gray-200">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('diagnoses')}
              className={clsx(
                'flex-1 px-4 py-2 text-sm font-medium',
                activeTab === 'diagnoses'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <ClipboardDocumentListIcon className="h-4 w-4" />
                ICD-10 Diagnoses
                {suggestions?.icd10Codes && (
                  <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">
                    {suggestions.icd10Codes.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('procedures')}
              className={clsx(
                'flex-1 px-4 py-2 text-sm font-medium',
                activeTab === 'procedures'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <BanknotesIcon className="h-4 w-4" />
                CPT Procedures
                {suggestions?.cptCodes && (
                  <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs">
                    {suggestions.cptCodes.length}
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Suggestions List */}
          <div className="p-4 max-h-96 overflow-y-auto">
            {suggestionsLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
                <span className="ml-2 text-gray-500">Analyzing clinical text...</span>
              </div>
            ) : clinicalText.length < 10 ? (
              <div className="text-center py-8 text-gray-500">
                <SparklesIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>Enter clinical notes to get AI-powered code suggestions</p>
              </div>
            ) : activeTab === 'diagnoses' ? (
              <div className="space-y-2">
                {suggestions?.icd10Codes.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No diagnosis codes suggested</p>
                ) : (
                  suggestions?.icd10Codes.map((code, idx) => (
                    <div
                      key={`${code.code}-${idx}`}
                      className={clsx(
                        'p-3 rounded-lg border transition-colors',
                        isIcdSelected(code.code)
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-gray-900">
                              {code.code}
                            </span>
                            <span
                              className={clsx(
                                'px-1.5 py-0.5 rounded text-xs font-medium',
                                getConfidenceColor(code.confidence)
                              )}
                            >
                              {Math.round(code.confidence * 100)}%
                            </span>
                            {code.isPreferred && (
                              <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                                Preferred
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{code.description}</p>
                          {code.rationale && (
                            <p className="text-xs text-gray-400 mt-1 italic">{code.rationale}</p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (isIcdSelected(code.code)) {
                              onRemoveIcdCode?.(code.code);
                            } else {
                              onSelectIcdCode?.(code);
                            }
                          }}
                          className={clsx(
                            'ml-2 p-1.5 rounded-full',
                            isIcdSelected(code.code)
                              ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          )}
                        >
                          {isIcdSelected(code.code) ? (
                            <CheckCircleIcon className="h-5 w-5" />
                          ) : (
                            <PlusIcon className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {suggestions?.cptCodes.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No procedure codes suggested</p>
                ) : (
                  suggestions?.cptCodes.map((code, idx) => (
                    <div
                      key={`${code.code}-${idx}`}
                      className={clsx(
                        'p-3 rounded-lg border transition-colors',
                        isCptSelected(code.code)
                          ? 'border-purple-300 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-gray-900">
                              {code.code}
                            </span>
                            <span
                              className={clsx(
                                'px-1.5 py-0.5 rounded text-xs font-medium',
                                getConfidenceColor(code.confidence)
                              )}
                            >
                              {Math.round(code.confidence * 100)}%
                            </span>
                            {code.medicalNecessityScore && code.medicalNecessityScore >= 0.8 && (
                              <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-xs">
                                Medical Necessity
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{code.description}</p>
                          {code.requiredModifiers && code.requiredModifiers.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-xs text-gray-500">Modifiers:</span>
                              {code.requiredModifiers.map((mod) => (
                                <span
                                  key={mod}
                                  className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono"
                                >
                                  {mod}
                                </span>
                              ))}
                            </div>
                          )}
                          {code.rationale && (
                            <p className="text-xs text-gray-400 mt-1 italic">{code.rationale}</p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (isCptSelected(code.code)) {
                              onRemoveCptCode?.(code.code);
                            } else {
                              onSelectCptCode?.(code);
                            }
                          }}
                          className={clsx(
                            'ml-2 p-1.5 rounded-full',
                            isCptSelected(code.code)
                              ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          )}
                        >
                          {isCptSelected(code.code) ? (
                            <CheckCircleIcon className="h-5 w-5" />
                          ) : (
                            <PlusIcon className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Acceptance Prediction */}
          {acceptancePrediction && payerId && (
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Claim Acceptance Probability</span>
                <span
                  className={clsx(
                    'px-2 py-1 rounded-full text-sm font-semibold text-white',
                    getAcceptanceColor(acceptancePrediction.acceptanceProbability)
                  )}
                >
                  {Math.round(acceptancePrediction.acceptanceProbability * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                  className={clsx('h-2 rounded-full', getAcceptanceColor(acceptancePrediction.acceptanceProbability))}
                  style={{ width: `${acceptancePrediction.acceptanceProbability * 100}%` }}
                />
              </div>
              {acceptancePrediction.riskFactors.length > 0 && (
                <div className="mb-2">
                  <span className="text-xs text-gray-500 font-medium">Risk Factors:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {acceptancePrediction.riskFactors.slice(0, 3).map((rf, idx) => (
                      <span
                        key={idx}
                        className={clsx(
                          'px-1.5 py-0.5 rounded text-xs',
                          rf.impact === 'negative' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                        )}
                      >
                        {rf.factor}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {acceptancePrediction.recommendations.length > 0 && (
                <div>
                  <span className="text-xs text-gray-500 font-medium">Recommendations:</span>
                  <ul className="mt-1 space-y-0.5">
                    {acceptancePrediction.recommendations.slice(0, 2).map((rec, idx) => (
                      <li key={idx} className="text-xs text-gray-600 flex items-start gap-1">
                        <ExclamationTriangleIcon className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Extracted Diagnoses */}
          {suggestions?.extractedDiagnoses && suggestions.extractedDiagnoses.length > 0 && (
            <div className="border-t border-gray-200 p-4">
              <span className="text-xs text-gray-500 font-medium">Extracted from clinical text:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestions.extractedDiagnoses.map((diag, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                    {diag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
