import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CpuChipIcon,
  SparklesIcon,
  HeartIcon,
  PhotoIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  BeakerIcon,
  ClockIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { aiApi } from '../../services/api';
import {
  useAIHealth,
  usePatientDiagnosis,
  usePatientRiskPrediction,
  getRiskLevelColor,
  getSeverityColor,
} from '../../hooks/useAI';
import LoadingSpinner from '../common/LoadingSpinner';
import clsx from 'clsx';
import { format } from 'date-fns';
import type { Patient } from '../../types';

interface PatientAIInsightsProps {
  patient: Patient;
}

export default function PatientAIInsights({ patient }: PatientAIInsightsProps) {
  const [activeSection, setActiveSection] = useState<'history' | 'analyze'>('history');
  const [symptoms, setSymptoms] = useState('');
  const [predictionType, setPredictionType] = useState('READMISSION');
  const [expandedDiagnosis, setExpandedDiagnosis] = useState<string | null>(null);
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null);

  // Hooks
  const { data: healthStatus } = useAIHealth();
  const diagnosisMutation = usePatientDiagnosis();
  const riskMutation = usePatientRiskPrediction();

  // Fetch patient's AI insights history
  const { data: aiInsights, isLoading: insightsLoading, refetch: refetchInsights } = useQuery({
    queryKey: ['patientAIInsights', patient.id],
    queryFn: async () => {
      const response = await aiApi.getInsights(patient.id);
      return response.data.data;
    },
  });

  const isAIOnline = healthStatus?.status === 'connected';

  // Calculate patient age
  const patientAge = Math.floor(
    (new Date().getTime() - new Date(patient.dateOfBirth).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000)
  );

  const handleDiagnosisAnalysis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptoms.trim()) return;

    const symptomList = symptoms.split(',').map(s => s.trim()).filter(Boolean);

    // Use patient-based endpoint that saves to database
    diagnosisMutation.mutate(
      {
        patientId: patient.id,
        symptoms: symptomList,
      },
      {
        onSuccess: () => {
          setSymptoms('');
          refetchInsights();
        },
      }
    );
  };

  const handleRiskPrediction = (e: React.FormEvent) => {
    e.preventDefault();

    // Use patient-based endpoint that saves to database
    riskMutation.mutate(
      {
        patientId: patient.id,
        predictionType,
      },
      {
        onSuccess: () => {
          refetchInsights();
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with AI Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <CpuChipIcon className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">AI Clinical Insights</h3>
            <p className="text-sm text-gray-500">
              ML-powered analysis for {patient.firstName} {patient.lastName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAIOnline ? (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              <CheckCircleIcon className="h-4 w-4" />
              AI Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
              <XCircleIcon className="h-4 w-4" />
              AI Offline
            </span>
          )}
          <button
            onClick={() => refetchInsights()}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            title="Refresh insights"
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Section Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSection('history')}
          className={clsx(
            'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors',
            activeSection === 'history'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          <ClockIcon className="h-4 w-4 inline mr-2" />
          Analysis History
        </button>
        <button
          onClick={() => setActiveSection('analyze')}
          className={clsx(
            'flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors',
            activeSection === 'analyze'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          )}
        >
          <SparklesIcon className="h-4 w-4 inline mr-2" />
          New Analysis
        </button>
      </div>

      {/* History Section */}
      {activeSection === 'history' && (
        <div className="space-y-6">
          {insightsLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              {/* Risk Predictions */}
              <div className="card">
                <div className="card-header flex items-center gap-2">
                  <HeartIcon className="h-5 w-5 text-red-500" />
                  <h4 className="font-semibold">Risk Predictions</h4>
                  <span className="text-xs text-gray-500 ml-auto">
                    {aiInsights?.predictions?.length || 0} predictions
                  </span>
                </div>
                <div className="card-body">
                  {aiInsights?.predictions?.length > 0 ? (
                    <div className="space-y-3">
                      {aiInsights.predictions.map((pred: any) => (
                        <div key={pred.id} className="border rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedPrediction(
                              expandedPrediction === pred.id ? null : pred.id
                            )}
                            className={clsx(
                              'w-full p-4 flex items-center justify-between',
                              pred.riskLevel === 'LOW' && 'bg-green-50',
                              pred.riskLevel === 'MODERATE' && 'bg-yellow-50',
                              pred.riskLevel === 'HIGH' && 'bg-orange-50',
                              pred.riskLevel === 'CRITICAL' && 'bg-red-50'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={clsx(
                                'h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold',
                                getRiskLevelColor(pred.riskLevel)
                              )}>
                                {(pred.riskScore * 100).toFixed(0)}%
                              </div>
                              <div className="text-left">
                                <p className="font-medium text-gray-900">
                                  {pred.predictionType.replace(/_/g, ' ')}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {pred.createdAt ? format(new Date(pred.createdAt), 'MMM d, yyyy h:mm a') : 'Recent'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={clsx(
                                'px-2.5 py-1 rounded-full text-xs font-medium',
                                getRiskLevelColor(pred.riskLevel)
                              )}>
                                {pred.riskLevel}
                              </span>
                              {expandedPrediction === pred.id ? (
                                <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                              ) : (
                                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                          </button>
                          {expandedPrediction === pred.id && (
                            <div className="p-4 bg-white border-t space-y-3">
                              {pred.factors?.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-700 mb-2">Contributing Factors</p>
                                  <ul className="space-y-1">
                                    {pred.factors.map((factor: string, idx: number) => (
                                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                        {factor}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {pred.recommendations?.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-700 mb-2">Recommendations</p>
                                  <ul className="space-y-1">
                                    {pred.recommendations.map((rec: string, idx: number) => (
                                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                                        <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
                                        {rec}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <p className="text-xs text-gray-400">
                                Timeframe: {pred.timeframe || '30 days'}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No risk predictions yet. Run a new analysis to get started.
                    </p>
                  )}
                </div>
              </div>

              {/* Diagnosis History */}
              <div className="card">
                <div className="card-header flex items-center gap-2">
                  <SparklesIcon className="h-5 w-5 text-purple-500" />
                  <h4 className="font-semibold">Diagnosis Analyses</h4>
                  <span className="text-xs text-gray-500 ml-auto">
                    {aiInsights?.diagnoses?.length || 0} analyses
                  </span>
                </div>
                <div className="card-body">
                  {aiInsights?.diagnoses?.length > 0 ? (
                    <div className="space-y-3">
                      {aiInsights.diagnoses.map((diag: any) => (
                        <div key={diag.id} className="border rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedDiagnosis(
                              expandedDiagnosis === diag.id ? null : diag.id
                            )}
                            className="w-full p-4 bg-blue-50 flex items-center justify-between"
                          >
                            <div className="text-left">
                              <div className="flex flex-wrap gap-2">
                                {diag.suggestedDiagnoses?.slice(0, 2).map((d: any, idx: number) => (
                                  <span key={idx} className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    {d.name} ({(d.confidence * 100).toFixed(0)}%)
                                  </span>
                                ))}
                                {diag.suggestedDiagnoses?.length > 2 && (
                                  <span className="text-xs text-gray-500">
                                    +{diag.suggestedDiagnoses.length - 2} more
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                {diag.createdAt ? format(new Date(diag.createdAt), 'MMM d, yyyy h:mm a') : 'Recent'}
                              </p>
                            </div>
                            {expandedDiagnosis === diag.id ? (
                              <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                          {expandedDiagnosis === diag.id && (
                            <div className="p-4 bg-white border-t space-y-4">
                              {/* Symptoms */}
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">Symptoms Analyzed</p>
                                <div className="flex flex-wrap gap-1">
                                  {diag.symptoms?.map((s: string, idx: number) => (
                                    <span key={idx} className="px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Diagnoses */}
                              <div>
                                <p className="text-sm font-medium text-gray-700 mb-2">Suggested Diagnoses</p>
                                <div className="space-y-2">
                                  {diag.suggestedDiagnoses?.map((d: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-gray-50">
                                      <div>
                                        <span className="font-medium text-sm">{d.name}</span>
                                        <span className="text-xs text-gray-500 ml-2">({d.icd10})</span>
                                        {d.category && (
                                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">
                                            {d.category}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {d.severity && (
                                          <span className={clsx('text-xs px-1.5 py-0.5 rounded', getSeverityColor(d.severity))}>
                                            {d.severity}
                                          </span>
                                        )}
                                        <span className="text-sm font-medium text-blue-600">
                                          {(d.confidence * 100).toFixed(0)}%
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Tests */}
                              {diag.recommendedTests?.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                                    <BeakerIcon className="h-4 w-4 text-green-600" />
                                    Recommended Tests
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {diag.recommendedTests.map((test: string, idx: number) => (
                                      <span key={idx} className="px-2 py-0.5 rounded-full bg-green-100 text-xs text-green-700">
                                        {test}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Drug Interactions */}
                              {diag.drugInteractionWarnings?.length > 0 && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                                  <p className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                                    <ExclamationTriangleIcon className="h-4 w-4" />
                                    Drug Interactions
                                  </p>
                                  <div className="space-y-1">
                                    {diag.drugInteractionWarnings.map((warning: any, idx: number) => (
                                      <p key={idx} className="text-xs text-red-600">
                                        {typeof warning === 'string' ? warning : `${warning.drug1} + ${warning.drug2}: ${warning.warning}`}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No diagnosis analyses yet. Run a new analysis to get started.
                    </p>
                  )}
                </div>
              </div>

              {/* Image Analyses */}
              {aiInsights?.imageAnalyses?.length > 0 && (
                <div className="card">
                  <div className="card-header flex items-center gap-2">
                    <PhotoIcon className="h-5 w-5 text-blue-500" />
                    <h4 className="font-semibold">Imaging Analyses</h4>
                    <span className="text-xs text-gray-500 ml-auto">
                      {aiInsights.imageAnalyses.length} analyses
                    </span>
                  </div>
                  <div className="card-body space-y-3">
                    {aiInsights.imageAnalyses.map((img: any) => (
                      <div key={img.id} className={clsx(
                        'p-4 rounded-lg border',
                        img.abnormalityDetected ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">
                            {img.imagingOrder?.modalityType} - {img.imagingOrder?.bodyPart}
                          </span>
                          {img.abnormalityDetected ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                              Abnormality Detected
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                              Normal
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{img.impression}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Confidence: {(img.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* New Analysis Section */}
      {activeSection === 'analyze' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Symptom Analysis */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-purple-500" />
              <h4 className="font-semibold">Symptom Analysis</h4>
            </div>
            <div className="card-body">
              <form onSubmit={handleDiagnosisAnalysis} className="space-y-4">
                <div>
                  <label className="label">Patient Symptoms</label>
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Enter symptoms separated by commas (e.g., headache, fever, nausea)"
                    rows={3}
                    className="input"
                    disabled={!isAIOnline}
                  />
                </div>
                <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                  <p><strong>Patient Info:</strong> {patientAge} years, {patient.gender}</p>
                  {(patient as any).medicalHistory?.chronicConditions?.length > 0 && (
                    <p><strong>Conditions:</strong> {(patient as any).medicalHistory.chronicConditions.join(', ')}</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!isAIOnline || diagnosisMutation.isPending || !symptoms.trim()}
                  className="btn-primary w-full"
                >
                  {diagnosisMutation.isPending ? (
                    <><LoadingSpinner size="sm" /><span className="ml-2">Analyzing...</span></>
                  ) : (
                    <><SparklesIcon className="h-5 w-5 mr-2" />Analyze Symptoms</>
                  )}
                </button>
              </form>

              {/* Show latest result */}
              {diagnosisMutation.data && (
                <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-100">
                  <p className="text-sm font-medium text-blue-800 mb-2">Latest Analysis Result</p>
                  {diagnosisMutation.data.diagnoses.slice(0, 3).map((d, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{d.name}</span>
                      <span className="text-blue-600">{(d.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Risk Prediction */}
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <HeartIcon className="h-5 w-5 text-red-500" />
              <h4 className="font-semibold">Risk Prediction</h4>
            </div>
            <div className="card-body">
              <form onSubmit={handleRiskPrediction} className="space-y-4">
                <div>
                  <label className="label">Prediction Type</label>
                  <select
                    value={predictionType}
                    onChange={(e) => setPredictionType(e.target.value)}
                    className="input"
                    disabled={!isAIOnline}
                  >
                    <option value="READMISSION">30-Day Readmission</option>
                    <option value="DETERIORATION">Clinical Deterioration</option>
                    <option value="MORTALITY">Mortality Risk</option>
                    <option value="LENGTH_OF_STAY">Length of Stay</option>
                    <option value="NO_SHOW">Appointment No-Show</option>
                  </select>
                </div>
                <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                  <p><strong>Patient Info:</strong> {patientAge} years, {patient.gender}</p>
                  <p><strong>Analysis uses:</strong> Medical history, vitals, admission history</p>
                </div>
                <button
                  type="submit"
                  disabled={!isAIOnline || riskMutation.isPending}
                  className="btn-primary w-full"
                >
                  {riskMutation.isPending ? (
                    <><LoadingSpinner size="sm" /><span className="ml-2">Predicting...</span></>
                  ) : (
                    <><HeartIcon className="h-5 w-5 mr-2" />Predict Risk</>
                  )}
                </button>
              </form>

              {/* Show latest result */}
              {riskMutation.data && (
                <div className={clsx(
                  'mt-4 p-4 rounded-lg border',
                  riskMutation.data.riskLevel === 'LOW' && 'bg-green-50 border-green-200',
                  riskMutation.data.riskLevel === 'MODERATE' && 'bg-yellow-50 border-yellow-200',
                  riskMutation.data.riskLevel === 'HIGH' && 'bg-orange-50 border-orange-200',
                  riskMutation.data.riskLevel === 'CRITICAL' && 'bg-red-50 border-red-200',
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Risk Assessment</span>
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      getRiskLevelColor(riskMutation.data.riskLevel)
                    )}>
                      {riskMutation.data.riskLevel}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {(riskMutation.data.riskScore * 100).toFixed(0)}%
                  </div>
                  {riskMutation.data.recommendations?.slice(0, 2).map((rec, idx) => (
                    <p key={idx} className="text-xs text-gray-600 mt-1">• {rec}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-3 rounded-lg bg-gray-100 text-xs text-gray-600 text-center">
        AI-generated insights are for clinical decision support only. Always verify with professional medical judgment.
      </div>
    </div>
  );
}
