import { useState } from 'react';
import {
  CpuChipIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
  HeartIcon,
  PhotoIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/common/LoadingSpinner';
import clsx from 'clsx';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  useAIHealth,
  useDirectRiskPrediction,
  useDirectImageAnalysis,
  getRiskLevelColor,
  getUrgencyColor,
  getSeverityColor,
} from '../hooks/useAI';
import { symptomCheckerApi } from '../services/api';
import type {
  AIPrediction,
  AIImageAnalysis,
} from '../types';

// Local type for symptom checker quick-check response
interface SymptomCheckResult {
  triageLevel: string;
  urgencyScore: number;
  recommendedDepartment: string;
  redFlagsDetected: boolean;
  redFlags: string[];
  recommendedAction: string;
}

type TabType = 'diagnosis' | 'risk' | 'imaging';

export default function AIAssistant() {
  const [activeTab, setActiveTab] = useState<TabType>('diagnosis');

  // Diagnosis state
  const [patientAge, setPatientAge] = useState(45);
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [symptoms, setSymptoms] = useState('');
  const [medications, setMedications] = useState('');
  const [diagnosisResult, setDiagnosisResult] = useState<SymptomCheckResult | null>(null);

  // Risk state
  const [riskAge, setRiskAge] = useState(65);
  const [riskGender, setRiskGender] = useState('male');
  const [predictionType, setPredictionType] = useState('readmission');
  const [chronicConditions, setChronicConditions] = useState('');
  const [riskResult, setRiskResult] = useState<AIPrediction | null>(null);

  // Imaging state
  const [imageUrl, setImageUrl] = useState('');
  const [modality, setModality] = useState<'XRAY' | 'CT' | 'MRI' | 'ULTRASOUND'>('XRAY');
  const [bodyPart, setBodyPart] = useState('chest');
  const [imgAge, setImgAge] = useState(55);
  const [imgGender, setImgGender] = useState<'male' | 'female' | 'other'>('male');
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [imagingResult, setImagingResult] = useState<AIImageAnalysis | null>(null);

  // Hooks
  const { data: healthStatus } = useAIHealth();
  const riskMutation = useDirectRiskPrediction();
  const imagingMutation = useDirectImageAnalysis();

  // Use symptom checker API for diagnosis (production endpoint)
  const diagnosisMutation = useMutation({
    mutationFn: async (data: { symptoms: string[]; patientAge: number }) => {
      const response = await symptomCheckerApi.quickCheck(data.symptoms, data.patientAge);
      return response.data.data as SymptomCheckResult;
    },
    onSuccess: (data) => {
      setDiagnosisResult(data);
      toast.success('Symptom analysis complete');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Analysis failed');
    },
  });

  const handleDiagnosisSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const symptomList = symptoms.split(',').map((s) => s.trim()).filter(Boolean);

    diagnosisMutation.mutate({
      symptoms: symptomList,
      patientAge,
    });
  };

  const handleRiskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const conditions = chronicConditions.split(',').map((c) => c.trim()).filter(Boolean);

    riskMutation.mutate(
      {
        predictionType,
        timeframe: '30 days',
        patientData: {
          age: riskAge,
          gender: riskGender,
          chronicConditions: conditions,
        },
      },
      {
        onSuccess: (data) => setRiskResult(data),
      }
    );
  };

  const handleImagingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    imagingMutation.mutate(
      {
        imageUrl: imageUrl || 'https://hospital-storage.s3.amazonaws.com/sample.dcm',
        modalityType: modality,
        bodyPart,
        patientAge: imgAge,
        patientGender: imgGender,
        clinicalHistory,
      },
      {
        onSuccess: (data) => setImagingResult(data),
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <CpuChipIcon className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Clinical Assistant</h1>
              <p className="text-purple-100">
                ML-powered diagnostic support, risk prediction & imaging analysis
              </p>
            </div>
          </div>
          {/* AI Status */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20">
            {healthStatus?.status === 'connected' ? (
              <>
                <CheckCircleIcon className="h-5 w-5 text-green-300" />
                <span className="text-sm text-white">AI Services Online</span>
              </>
            ) : (
              <>
                <XCircleIcon className="h-5 w-5 text-red-300" />
                <span className="text-sm text-white">AI Offline</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => setActiveTab('diagnosis')}
          className={clsx(
            'p-4 rounded-xl border-2 transition-all',
            activeTab === 'diagnosis'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-gray-300'
          )}
        >
          <div className="flex items-center gap-3">
            <SparklesIcon
              className={clsx(
                'h-6 w-6',
                activeTab === 'diagnosis' ? 'text-purple-600' : 'text-gray-400'
              )}
            />
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">Diagnostic AI</h3>
              <p className="text-sm text-gray-500">Symptom analysis</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('risk')}
          className={clsx(
            'p-4 rounded-xl border-2 transition-all',
            activeTab === 'risk'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-gray-300'
          )}
        >
          <div className="flex items-center gap-3">
            <HeartIcon
              className={clsx(
                'h-6 w-6',
                activeTab === 'risk' ? 'text-purple-600' : 'text-gray-400'
              )}
            />
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">Risk Prediction</h3>
              <p className="text-sm text-gray-500">Clinical risk scores</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('imaging')}
          className={clsx(
            'p-4 rounded-xl border-2 transition-all',
            activeTab === 'imaging'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-gray-300'
          )}
        >
          <div className="flex items-center gap-3">
            <PhotoIcon
              className={clsx(
                'h-6 w-6',
                activeTab === 'imaging' ? 'text-purple-600' : 'text-gray-400'
              )}
            />
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">Medical Imaging</h3>
              <p className="text-sm text-gray-500">X-ray, CT, MRI analysis</p>
            </div>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">
              {activeTab === 'diagnosis' && 'Symptom Analysis'}
              {activeTab === 'risk' && 'Risk Assessment'}
              {activeTab === 'imaging' && 'Image Analysis'}
            </h2>
          </div>
          <div className="card-body">
            {activeTab === 'diagnosis' && (
              <form onSubmit={handleDiagnosisSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Age</label>
                    <input
                      type="number"
                      value={patientAge}
                      onChange={(e) => setPatientAge(Number(e.target.value))}
                      className="input"
                      min={0}
                      max={150}
                    />
                  </div>
                  <div>
                    <label className="label">Gender</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'MALE' | 'FEMALE' | 'OTHER')}
                      className="input"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Symptoms</label>
                  <textarea
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="e.g., severe headache, nausea, sensitivity to light"
                    rows={3}
                    className="input"
                  />
                  <p className="mt-1 text-sm text-gray-500">Separate with commas</p>
                </div>
                <div>
                  <label className="label">Current Medications (optional)</label>
                  <input
                    type="text"
                    value={medications}
                    onChange={(e) => setMedications(e.target.value)}
                    placeholder="e.g., aspirin, lisinopril"
                    className="input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={diagnosisMutation.isPending || !symptoms}
                  className="btn-primary w-full"
                >
                  {diagnosisMutation.isPending ? (
                    <><LoadingSpinner size="sm" /><span className="ml-2">Analyzing...</span></>
                  ) : (
                    <><SparklesIcon className="h-5 w-5 mr-2" />Analyze Symptoms</>
                  )}
                </button>
              </form>
            )}

            {activeTab === 'risk' && (
              <form onSubmit={handleRiskSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Age</label>
                    <input
                      type="number"
                      value={riskAge}
                      onChange={(e) => setRiskAge(Number(e.target.value))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Gender</label>
                    <select
                      value={riskGender}
                      onChange={(e) => setRiskGender(e.target.value)}
                      className="input"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Prediction Type</label>
                  <select
                    value={predictionType}
                    onChange={(e) => setPredictionType(e.target.value)}
                    className="input"
                  >
                    <option value="readmission">Readmission Risk</option>
                    <option value="deterioration">Clinical Deterioration</option>
                    <option value="mortality">Mortality Risk</option>
                    <option value="length_of_stay">Length of Stay</option>
                    <option value="no_show">Appointment No-Show</option>
                  </select>
                </div>
                <div>
                  <label className="label">Chronic Conditions</label>
                  <input
                    type="text"
                    value={chronicConditions}
                    onChange={(e) => setChronicConditions(e.target.value)}
                    placeholder="e.g., diabetes, hypertension, COPD"
                    className="input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={riskMutation.isPending}
                  className="btn-primary w-full"
                >
                  {riskMutation.isPending ? (
                    <><LoadingSpinner size="sm" /><span className="ml-2">Predicting...</span></>
                  ) : (
                    <><HeartIcon className="h-5 w-5 mr-2" />Predict Risk</>
                  )}
                </button>
              </form>
            )}

            {activeTab === 'imaging' && (
              <form onSubmit={handleImagingSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Modality</label>
                    <select
                      value={modality}
                      onChange={(e) => setModality(e.target.value as any)}
                      className="input"
                    >
                      <option value="XRAY">X-Ray</option>
                      <option value="CT">CT Scan</option>
                      <option value="MRI">MRI</option>
                      <option value="ULTRASOUND">Ultrasound</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Body Part</label>
                    <select
                      value={bodyPart}
                      onChange={(e) => setBodyPart(e.target.value)}
                      className="input"
                    >
                      <option value="chest">Chest</option>
                      <option value="head">Head</option>
                      <option value="abdomen">Abdomen</option>
                      <option value="spine">Spine</option>
                      <option value="knee">Knee</option>
                      <option value="shoulder">Shoulder</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Patient Age</label>
                    <input
                      type="number"
                      value={imgAge}
                      onChange={(e) => setImgAge(Number(e.target.value))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Gender</label>
                    <select
                      value={imgGender}
                      onChange={(e) => setImgGender(e.target.value as any)}
                      className="input"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Clinical History</label>
                  <textarea
                    value={clinicalHistory}
                    onChange={(e) => setClinicalHistory(e.target.value)}
                    placeholder="e.g., cough, fever, shortness of breath"
                    rows={2}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Image URL (optional)</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="input"
                  />
                  <p className="mt-1 text-sm text-gray-500">Leave blank for demo analysis</p>
                </div>
                <button
                  type="submit"
                  disabled={imagingMutation.isPending}
                  className="btn-primary w-full"
                >
                  {imagingMutation.isPending ? (
                    <><LoadingSpinner size="sm" /><span className="ml-2">Analyzing...</span></>
                  ) : (
                    <><PhotoIcon className="h-5 w-5 mr-2" />Analyze Image</>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold">AI Results</h2>
            {((diagnosisResult as any)?.modelVersion || (riskResult as any)?.modelVersion || (imagingResult as any)?.modelVersion) && (
              <span className="text-xs text-gray-500 font-mono">
                Model: {(diagnosisResult as any)?.modelVersion || (riskResult as any)?.modelVersion || (imagingResult as any)?.modelVersion}
              </span>
            )}
          </div>
          <div className="card-body max-h-[600px] overflow-y-auto">
            {/* Diagnosis Results - Symptom Triage */}
            {activeTab === 'diagnosis' && diagnosisResult && (
              <div className="space-y-6">
                {/* Triage Level & Urgency */}
                <div className="text-center p-6 rounded-xl bg-gray-50">
                  <div className={clsx(
                    'inline-flex items-center justify-center h-24 w-24 rounded-full text-3xl font-bold',
                    diagnosisResult.triageLevel === 'EMERGENCY' ? 'bg-red-100 text-red-700' :
                    diagnosisResult.triageLevel === 'URGENT' ? 'bg-orange-100 text-orange-700' :
                    diagnosisResult.triageLevel === 'ROUTINE' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  )}>
                    {diagnosisResult.urgencyScore}/10
                  </div>
                  <p className="mt-4 text-lg font-medium text-gray-900">
                    {diagnosisResult.triageLevel} Priority
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Urgency Score
                  </p>
                </div>

                {/* Recommended Department */}
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <h3 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                    <CpuChipIcon className="h-5 w-5" />
                    Recommended Department
                  </h3>
                  <p className="text-lg font-semibold text-blue-900">{diagnosisResult.recommendedDepartment}</p>
                </div>

                {/* Red Flags Warning */}
                {diagnosisResult.redFlagsDetected && diagnosisResult.redFlags.length > 0 && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <h3 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5" />
                      Red Flags Detected
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {diagnosisResult.redFlags.map((flag, idx) => (
                        <span key={idx} className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-full">
                          {flag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Action */}
                <div className={clsx(
                  'p-4 rounded-lg border',
                  diagnosisResult.triageLevel === 'EMERGENCY' ? 'bg-red-50 border-red-200' :
                  diagnosisResult.triageLevel === 'URGENT' ? 'bg-orange-50 border-orange-200' :
                  'bg-green-50 border-green-200'
                )}>
                  <h3 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    Recommended Action
                  </h3>
                  <p className={clsx(
                    'text-sm',
                    diagnosisResult.triageLevel === 'EMERGENCY' ? 'text-red-800' :
                    diagnosisResult.triageLevel === 'URGENT' ? 'text-orange-800' :
                    'text-gray-700'
                  )}>
                    {diagnosisResult.recommendedAction}
                  </p>
                </div>

                {/* Disclaimer */}
                <div className="p-3 rounded-lg bg-gray-100 text-sm text-gray-600 flex items-start gap-2">
                  <InformationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>AI-generated triage assessment. This is for informational purposes only and is not a substitute for professional medical advice.</span>
                </div>
              </div>
            )}


            {/* Risk Results */}
            {activeTab === 'risk' && riskResult && (
              <div className="space-y-6">
                <div className="text-center p-6 rounded-xl bg-gray-50">
                  <div className={clsx(
                    'inline-flex items-center justify-center h-24 w-24 rounded-full text-3xl font-bold',
                    getRiskLevelColor(riskResult.riskLevel)
                  )}>
                    {(riskResult.riskScore * 100).toFixed(0)}%
                  </div>
                  <p className="mt-4 text-lg font-medium text-gray-900">
                    {riskResult.riskLevel} Risk
                  </p>
                  <p className="text-sm text-gray-500">
                    Timeframe: {riskResult.timeframe}
                  </p>
                </div>

                {riskResult.factors.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Contributing Factors</h3>
                    <ul className="space-y-2">
                      {riskResult.factors.map((factor, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {riskResult.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Recommendations</h3>
                    <ul className="space-y-2">
                      {riskResult.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircleIcon className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Imaging Results */}
            {activeTab === 'imaging' && imagingResult && (
              <div className="space-y-6">
                {/* Urgency & Study Info */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
                  <div>
                    <p className="text-sm text-gray-500">Study</p>
                    <p className="font-medium">
                      {imagingResult.studyInfo.modality} - {imagingResult.studyInfo.bodyPart}
                    </p>
                  </div>
                  <div className={clsx(
                    'px-3 py-1.5 rounded-full text-sm font-medium',
                    getUrgencyColor(imagingResult.urgency)
                  )}>
                    {imagingResult.urgency.toUpperCase()}
                  </div>
                </div>

                {/* Impression */}
                <div className={clsx(
                  'p-4 rounded-lg border',
                  imagingResult.abnormalityDetected
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                )}>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    {imagingResult.abnormalityDetected ? (
                      <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    )}
                    Impression
                  </h3>
                  <p className={clsx(
                    'text-sm',
                    imagingResult.abnormalityDetected ? 'text-red-800' : 'text-green-800'
                  )}>
                    {imagingResult.impression}
                  </p>
                </div>

                {/* Findings */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Findings</h3>
                  <div className="space-y-2">
                    {imagingResult.findings.map((finding, idx) => (
                      <div
                        key={idx}
                        className={clsx(
                          'p-3 rounded-lg border',
                          finding.abnormal
                            ? 'bg-red-50 border-red-200'
                            : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {finding.region}
                          </span>
                          <div className="flex items-center gap-2">
                            {finding.abnormal && finding.severity && (
                              <span className={clsx(
                                'text-xs px-2 py-0.5 rounded',
                                getSeverityColor(finding.severity)
                              )}>
                                {finding.severity}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {(finding.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <p className={clsx(
                          'text-sm mt-1',
                          finding.abnormal ? 'text-red-700' : 'text-gray-600'
                        )}>
                          {finding.finding}
                        </p>
                        {finding.pathology && (
                          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            {finding.pathology}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                {imagingResult.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Recommendations</h3>
                    <ul className="space-y-2">
                      {imagingResult.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircleIcon className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="p-3 rounded-lg bg-gray-100 text-sm text-gray-600 flex items-start gap-2">
                  <InformationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>{imagingResult.disclaimer || 'AI-assisted analysis. Final interpretation by radiologist required.'}</span>
                </div>
              </div>
            )}

            {/* Empty State */}
            {((activeTab === 'diagnosis' && !diagnosisResult) ||
              (activeTab === 'risk' && !riskResult) ||
              (activeTab === 'imaging' && !imagingResult)) && (
              <div className="text-center py-12 text-gray-500">
                <CpuChipIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Enter data and click analyze to see AI results</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
