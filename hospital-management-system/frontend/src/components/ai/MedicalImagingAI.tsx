import { useState, useRef } from 'react';
import {
  PhotoIcon,
  CloudArrowUpIcon,
  MagnifyingGlassCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  BeakerIcon,
  LightBulbIcon,
  EyeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

// Types
interface Finding {
  region: string;
  finding: string;
  abnormal: boolean;
  confidence: number;
  severity?: string;
  pathology?: string;
}

interface StudyInfo {
  modality: string;
  bodyPart: string;
  patientAge: number;
  patientGender: string;
}

interface ImageAnalysisResult {
  findings: Finding[];
  impression: string;
  recommendations: string[];
  heatmapUrl: string | null;
  abnormalityDetected: boolean;
  confidence: number;
  urgency: 'routine' | 'urgent' | 'emergent' | 'critical';
  studyInfo: StudyInfo;
  modelVersion: string;
  comparison?: {
    newFindings: string[];
    resolvedFindings: string[];
    unchangedFindings: string[];
    overallChange: string;
    comparisonNote: string;
  };
}

interface MedicalImagingAIProps {
  className?: string;
  onAnalysisComplete?: (result: ImageAnalysisResult) => void;
}

const MODALITY_OPTIONS = [
  { value: 'XRAY', label: 'X-Ray', icon: '' },
  { value: 'CT', label: 'CT Scan', icon: '' },
  { value: 'MRI', label: 'MRI', icon: '' },
  { value: 'ULTRASOUND', label: 'Ultrasound', icon: '' },
];

const BODY_PART_OPTIONS: Record<string, string[]> = {
  XRAY: ['Chest', 'Spine', 'Extremity', 'Abdomen', 'Pelvis', 'Skull'],
  CT: ['Head', 'Chest', 'Abdomen', 'Pelvis', 'Spine', 'Extremity'],
  MRI: ['Brain', 'Spine', 'Knee', 'Shoulder', 'Pelvis', 'Abdomen'],
  ULTRASOUND: ['Abdomen', 'Pelvis', 'Thyroid', 'Breast', 'Vascular'],
};

const URGENCY_CONFIG = {
  routine: {
    label: 'Routine',
    color: 'emerald',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-700',
    description: 'No acute findings requiring immediate attention',
  },
  urgent: {
    label: 'Urgent',
    color: 'amber',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    description: 'Findings require clinical follow-up within 24-48 hours',
  },
  emergent: {
    label: 'Emergent',
    color: 'orange',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-700',
    description: 'Findings require prompt clinical action',
  },
  critical: {
    label: 'Critical',
    color: 'red',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    description: 'Critical findings - immediate intervention required',
  },
};

const DEMO_IMAGES = [
  {
    url: 'https://example.com/chest-xray-pneumonia.jpg',
    label: 'Chest X-Ray (Pneumonia)',
    modality: 'XRAY',
    bodyPart: 'Chest',
    history: 'Cough and fever for 5 days',
  },
  {
    url: 'https://example.com/ct-head-hemorrhage.jpg',
    label: 'CT Head (Trauma)',
    modality: 'CT',
    bodyPart: 'Head',
    history: 'Fall from height, headache',
  },
  {
    url: 'https://example.com/mri-spine-herniation.jpg',
    label: 'MRI Spine (Back Pain)',
    modality: 'MRI',
    bodyPart: 'Spine',
    history: 'Lower back pain radiating to leg',
  },
  {
    url: 'https://example.com/us-abdomen-gallstones.jpg',
    label: 'US Abdomen (RUQ Pain)',
    modality: 'ULTRASOUND',
    bodyPart: 'Abdomen',
    history: 'Right upper quadrant pain after meals',
  },
];

export default function MedicalImagingAI({
  className = '',
  onAnalysisComplete,
}: MedicalImagingAIProps) {
  // Form state
  const [imageUrl, setImageUrl] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
  const [modality, setModality] = useState<string>('XRAY');
  const [bodyPart, setBodyPart] = useState<string>('Chest');
  const [patientAge, setPatientAge] = useState<number>(45);
  const [patientGender, setPatientGender] = useState<string>('male');
  const [clinicalHistory, setClinicalHistory] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);

  // UI state
  const [showFindings, setShowFindings] = useState(true);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/dicom', 'application/dicom'];
      if (!validTypes.includes(file.type) && !file.name.endsWith('.dcm')) {
        toast.error('Please upload a valid image file (JPEG, PNG, or DICOM)');
        return;
      }
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }
      setUploadedFile(file);
      setImageUrl('');
      // Create preview for regular images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setImagePreview(null);
      }
      setResult(null);
      setError(null);
    }
  };

  // Update body part when modality changes
  const handleModalityChange = (newModality: string) => {
    setModality(newModality);
    const parts = BODY_PART_OPTIONS[newModality];
    if (parts && parts.length > 0) {
      setBodyPart(parts[0]);
    }
  };

  // Load demo image
  const loadDemoImage = (demo: typeof DEMO_IMAGES[0]) => {
    setImageUrl(demo.url);
    setModality(demo.modality);
    setBodyPart(demo.bodyPart);
    setClinicalHistory(demo.history);
    setResult(null);
    setError(null);
  };

  // Analyze image
  const analyzeImage = async () => {
    if (!uploadedFile && !imageUrl) {
      setError('Please upload an image or provide an image URL');
      toast.error('Please upload an image or provide an image URL');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let analysisResult;
      const token = localStorage.getItem('token');

      if (uploadedFile) {
        // Upload file and analyze
        const formData = new FormData();
        formData.append('image', uploadedFile);
        formData.append('modalityType', modality);
        formData.append('bodyPart', bodyPart);
        formData.append('patientAge', patientAge.toString());
        formData.append('patientGender', patientGender);
        if (clinicalHistory) {
          formData.append('clinicalHistory', clinicalHistory);
        }

        const response = await fetch(`${API_URL}/ai/analyze-image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to analyze image');
        }

        const data = await response.json();
        analysisResult = data.data || data;
      } else {
        // Analyze by URL
        const response = await fetch(`${API_URL}/ai/analyze-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            imageUrl,
            modalityType: modality,
            bodyPart,
            patientAge,
            patientGender,
            clinicalHistory: clinicalHistory || null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to analyze image');
        }

        const data = await response.json();
        analysisResult = data.data || data;
      }

      setResult(analysisResult);
      toast.success('Image analysis complete');

      if (onAnalysisComplete) {
        onAnalysisComplete(analysisResult);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to analyze image. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Image analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  const urgencyConfig = result ? URGENCY_CONFIG[result.urgency] : null;

  return (
    <div className={clsx('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <PhotoIcon className="h-6 w-6 text-indigo-500" />
            Medical Imaging AI
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            CNN-powered analysis of X-rays, CT, MRI, and Ultrasound images
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          {/* Image Input */}
          <div className="rounded-xl p-5 backdrop-blur-xl bg-white/70 border border-white/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CloudArrowUpIcon className="h-5 w-5 text-indigo-500" />
              Image Input
            </h3>

            {/* Input Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setInputMode('upload')}
                className={clsx(
                  'flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all',
                  inputMode === 'upload'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Upload File
              </button>
              <button
                onClick={() => setInputMode('url')}
                className={clsx(
                  'flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all',
                  inputMode === 'url'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                Image URL
              </button>
            </div>

            {/* File Upload */}
            {inputMode === 'upload' && (
              <div className="mb-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.dcm"
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all"
                >
                  {uploadedFile ? (
                    <div>
                      <PhotoIcon className="h-10 w-10 text-indigo-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFile(null);
                          setImagePreview(null);
                        }}
                        className="mt-2 text-xs text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <CloudArrowUpIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Click to upload image</p>
                      <p className="text-xs text-gray-400 mt-1">JPEG, PNG, or DICOM (max 50MB)</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* URL Input */}
            {inputMode === 'url' && (
              <>
                {/* Demo Images */}
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">
                    Quick Demo Images:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DEMO_IMAGES.map((demo, index) => (
                      <button
                        key={index}
                        onClick={() => loadDemoImage(demo)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                      >
                        {demo.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Image URL
                  </label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={e => {
                      setImageUrl(e.target.value);
                      setUploadedFile(null);
                      setImagePreview(null);
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-100/50 border border-gray-200/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>
              </>
            )}

            {/* Modality & Body Part */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Modality
                </label>
                <select
                  value={modality}
                  onChange={e => handleModalityChange(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-100/50 border border-gray-200/50"
                >
                  {MODALITY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Body Part
                </label>
                <select
                  value={bodyPart}
                  onChange={e => setBodyPart(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-100/50 border border-gray-200/50"
                >
                  {(BODY_PART_OPTIONS[modality] || []).map(part => (
                    <option key={part} value={part}>
                      {part}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Patient Info */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient Age
                </label>
                <input
                  type="number"
                  value={patientAge}
                  onChange={e => setPatientAge(parseInt(e.target.value) || 0)}
                  min={0}
                  max={120}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-100/50 border border-gray-200/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  value={patientGender}
                  onChange={e => setPatientGender(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-100/50 border border-gray-200/50"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Clinical History */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Clinical History (Optional)
              </label>
              <textarea
                value={clinicalHistory}
                onChange={e => setClinicalHistory(e.target.value)}
                placeholder="e.g., Cough and fever for 5 days, history of COPD"
                rows={2}
                className="w-full px-4 py-2.5 text-sm rounded-xl bg-gray-100/50 border border-gray-200/50 resize-none"
              />
            </div>

            {/* Analyze Button */}
            <button
              onClick={analyzeImage}
              disabled={loading || (!uploadedFile && !imageUrl)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <MagnifyingGlassCircleIcon className="h-5 w-5" />
                  Analyze Image
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Image Preview */}
          <div className="rounded-xl p-5 backdrop-blur-xl bg-white/70 border border-white/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <EyeIcon className="h-5 w-5 text-indigo-500" />
              Image Preview
            </h3>
            <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Uploaded medical image"
                  className="max-w-full max-h-full object-contain"
                />
              ) : uploadedFile ? (
                <div className="text-center">
                  <PhotoIcon className="h-16 w-16 text-indigo-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {modality} - {bodyPart}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {uploadedFile.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    (DICOM preview not available)
                  </p>
                </div>
              ) : imageUrl ? (
                <div className="text-center">
                  <PhotoIcon className="h-16 w-16 text-indigo-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {modality} - {bodyPart}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 truncate max-w-[200px]">
                    {imageUrl.substring(0, 50)}...
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <CloudArrowUpIcon className="h-16 w-16 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    Upload an image or enter URL
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {loading && (
            <div className="rounded-xl p-12 backdrop-blur-xl bg-white/70 border border-white/50 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-200" />
                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Analyzing image with CNN model...
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Detecting pathologies and generating report
              </p>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Urgency Banner */}
              <div
                className={clsx(
                  'rounded-xl p-4 border-2',
                  urgencyConfig?.bgColor,
                  result.urgency === 'critical' ? 'border-red-500' : 'border-transparent'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {result.abnormalityDetected ? (
                      <ExclamationTriangleIcon
                        className={clsx('h-8 w-8', urgencyConfig?.textColor)}
                      />
                    ) : (
                      <CheckCircleIcon className="h-8 w-8 text-emerald-500" />
                    )}
                    <div>
                      <h3 className={clsx('font-bold text-lg', urgencyConfig?.textColor)}>
                        {urgencyConfig?.label}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {urgencyConfig?.description}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {Math.round(result.confidence * 100)}%
                    </div>
                    <p className="text-xs text-gray-500">Confidence</p>
                  </div>
                </div>
              </div>

              {/* Study Info */}
              <div className="rounded-xl p-4 backdrop-blur-xl bg-white/70 border border-white/50">
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-500">Modality</p>
                    <p className="font-semibold text-gray-900">
                      {result.studyInfo.modality}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Body Part</p>
                    <p className="font-semibold text-gray-900">
                      {result.studyInfo.bodyPart}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Age</p>
                    <p className="font-semibold text-gray-900">
                      {result.studyInfo.patientAge}y
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Gender</p>
                    <p className="font-semibold text-gray-900 capitalize">
                      {result.studyInfo.patientGender}
                    </p>
                  </div>
                </div>
              </div>

              {/* Impression */}
              <div className="rounded-xl p-5 backdrop-blur-xl bg-white/70 border border-white/50">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5 text-indigo-500" />
                  Impression
                </h3>
                <p
                  className={clsx(
                    'text-sm leading-relaxed',
                    result.urgency === 'critical'
                      ? 'text-red-700 font-medium'
                      : 'text-gray-700'
                  )}
                >
                  {result.impression}
                </p>
              </div>

              {/* Findings */}
              <div className="rounded-xl backdrop-blur-xl bg-white/70 border border-white/50 overflow-hidden">
                <button
                  onClick={() => setShowFindings(!showFindings)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <BeakerIcon className="h-5 w-5 text-indigo-500" />
                    Findings ({result.findings.length})
                  </h3>
                  {showFindings ? (
                    <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {showFindings && (
                  <div className="px-4 pb-4 space-y-2">
                    {result.findings.map((finding, index) => (
                      <div
                        key={index}
                        className={clsx(
                          'p-3 rounded-lg border transition-all cursor-pointer',
                          finding.abnormal
                            ? 'bg-red-50 border-red-200 hover:bg-red-100'
                            : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                        )}
                        onClick={() =>
                          setSelectedFinding(selectedFinding === finding ? null : finding)
                        }
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2">
                            {finding.abnormal ? (
                              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5" />
                            ) : (
                              <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5" />
                            )}
                            <div>
                              <p
                                className={clsx(
                                  'font-medium text-sm',
                                  finding.abnormal
                                    ? 'text-red-700'
                                    : 'text-emerald-700'
                                )}
                              >
                                {finding.region}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {finding.finding}
                              </p>
                              {finding.abnormal && finding.severity && (
                                <span
                                  className={clsx(
                                    'inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium',
                                    finding.severity === 'severe'
                                      ? 'bg-red-200 text-red-800'
                                      : finding.severity === 'moderate'
                                      ? 'bg-orange-200 text-orange-800'
                                      : 'bg-amber-200 text-amber-800'
                                  )}
                                >
                                  {finding.severity} severity
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={clsx(
                              'text-xs font-medium px-2 py-1 rounded',
                              finding.abnormal
                                ? 'bg-red-200 text-red-700'
                                : 'bg-emerald-200 text-emerald-700'
                            )}
                          >
                            {Math.round(finding.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommendations */}
              <div className="rounded-xl backdrop-blur-xl bg-white/70 border border-white/50 overflow-hidden">
                <button
                  onClick={() => setShowRecommendations(!showRecommendations)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <LightBulbIcon className="h-5 w-5 text-amber-500" />
                    Recommendations ({result.recommendations.length})
                  </h3>
                  {showRecommendations ? (
                    <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {showRecommendations && (
                  <div className="px-4 pb-4 space-y-2">
                    {result.recommendations.map((rec, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 rounded-lg bg-amber-50"
                      >
                        <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-xs font-bold text-amber-800">
                          {index + 1}
                        </div>
                        <p className="text-sm text-gray-700">{rec}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Model Info */}
              <div className="text-center">
                <p className="text-xs text-gray-400">
                  Model Version: {result.modelVersion} | CNN-based pathology detection
                </p>
              </div>
            </>
          )}

          {!result && !loading && (
            <div className="rounded-xl p-12 backdrop-blur-xl bg-white/70 border border-white/50 flex flex-col items-center justify-center">
              <PhotoIcon className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-600">
                Ready to Analyze
              </h3>
              <p className="text-sm text-gray-500 mt-1 text-center max-w-md">
                Enter an image URL and click "Analyze Image" to detect pathologies using our
                CNN-based medical imaging AI.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
