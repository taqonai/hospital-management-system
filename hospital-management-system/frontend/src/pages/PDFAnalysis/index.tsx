import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import {
  DocumentTextIcon,
  CloudArrowUpIcon,
  LinkIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BeakerIcon,
  ClipboardDocumentListIcon,
  UserIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
  DocumentMagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { pdfApi } from '../../services/api';

const DOCUMENT_TYPES = [
  { value: 'medical_report', label: 'Medical Report', icon: DocumentTextIcon },
  { value: 'lab_result', label: 'Lab Result', icon: BeakerIcon },
  { value: 'radiology_report', label: 'Radiology Report', icon: DocumentMagnifyingGlassIcon },
  { value: 'prescription', label: 'Prescription', icon: ClipboardDocumentListIcon },
  { value: 'discharge_summary', label: 'Discharge Summary', icon: DocumentTextIcon },
  { value: 'pathology_report', label: 'Pathology Report', icon: BeakerIcon },
  { value: 'consultation_note', label: 'Consultation Note', icon: UserIcon },
];

interface AnalysisResult {
  success: boolean;
  summary?: string;
  documentDate?: string;
  keyFindings?: string[];
  diagnoses?: string[];
  medications?: string[];
  labResults?: Array<{
    test: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    abnormal?: boolean;
  }>;
  recommendations?: string[];
  urgentFindings?: string[];
  extractedEntities?: {
    conditions?: string[];
    procedures?: string[];
    anatomicalSites?: string[];
    clinicians?: string[];
  };
  confidence?: number;
  pageCount?: number;
  analysisMethod?: string;
  documentType?: string;
  error?: string;
}

export default function PDFAnalysis() {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [documentType, setDocumentType] = useState('medical_report');
  const [pdfUrl, setPdfUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // File upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', documentType);
      formData.append('extractEntities', 'true');
      const response = await pdfApi.analyze(formData);
      return response.data?.data || response.data;
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
    },
  });

  // URL analysis mutation
  const urlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await pdfApi.analyzeUrl({ url, documentType, extractEntities: true });
      return response.data?.data || response.data;
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setAnalysisResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const handleAnalyze = () => {
    if (activeTab === 'upload' && selectedFile) {
      uploadMutation.mutate(selectedFile);
    } else if (activeTab === 'url' && pdfUrl) {
      urlMutation.mutate(pdfUrl);
    }
  };

  const isLoading = uploadMutation.isPending || urlMutation.isPending;
  const error = uploadMutation.error || urlMutation.error;

  const handleExport = () => {
    if (!analysisResult) return;
    const blob = new Blob([JSON.stringify(analysisResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdf-analysis-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse delay-1000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
              <DocumentMagnifyingGlassIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">PDF Document Analysis</h1>
              <p className="text-gray-500">AI-powered medical document analysis with GPT-4 Vision</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Upload/Input */}
          <div className="space-y-6">
            {/* Document Type Selection */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Document Type</h2>
              <div className="grid grid-cols-2 gap-2">
                {DOCUMENT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setDocumentType(type.value)}
                    className={`flex items-center space-x-2 p-3 rounded-xl transition-all ${
                      documentType === type.value
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <type.icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Tabs */}
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    activeTab === 'upload'
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <CloudArrowUpIcon className="w-5 h-5 inline mr-2" />
                  Upload File
                </button>
                <button
                  onClick={() => setActiveTab('url')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                    activeTab === 'url'
                      ? 'bg-purple-100 text-purple-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <LinkIcon className="w-5 h-5 inline mr-2" />
                  From URL
                </button>
              </div>

              {activeTab === 'upload' ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50'
                  }`}
                >
                  <input {...getInputProps()} />
                  <CloudArrowUpIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  {selectedFile ? (
                    <div>
                      <p className="text-gray-900 font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                        className="mt-2 text-red-500 text-sm hover:text-red-700"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-600">Drag & drop a PDF file here, or click to select</p>
                      <p className="text-sm text-gray-400 mt-2">Maximum file size: 50MB</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <input
                    type="url"
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                    placeholder="https://example.com/document.pdf"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-sm text-gray-400 mt-2">Enter a publicly accessible PDF URL</p>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={isLoading || (activeTab === 'upload' ? !selectedFile : !pdfUrl)}
                className="w-full mt-4 py-3 px-4 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5" />
                    <span>Analyze Document</span>
                  </>
                )}
              </button>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-700 text-sm">{(error as Error).message}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="space-y-6">
            {analysisResult ? (
              <>
                {/* Summary Card */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Analysis Summary</h2>
                    <div className="flex space-x-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        analysisResult.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {analysisResult.success ? 'Success' : 'Failed'}
                      </span>
                      <button
                        onClick={handleExport}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {analysisResult.summary && (
                    <p className="text-gray-700 mb-4">{analysisResult.summary}</p>
                  )}

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-2xl font-bold text-purple-600">{analysisResult.pageCount || '-'}</p>
                      <p className="text-xs text-gray-500">Pages</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-2xl font-bold text-purple-600">{analysisResult.analysisMethod || '-'}</p>
                      <p className="text-xs text-gray-500">Method</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-2xl font-bold text-purple-600">{analysisResult.confidence ? `${(Number(analysisResult.confidence) * 100).toFixed(0)}%` : '-'}</p>
                      <p className="text-xs text-gray-500">Confidence</p>
                    </div>
                  </div>
                </div>

                {/* Urgent Findings */}
                {analysisResult.urgentFindings && analysisResult.urgentFindings.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-red-700 mb-3 flex items-center">
                      <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                      Urgent Findings
                    </h3>
                    <ul className="space-y-2">
                      {analysisResult.urgentFindings.map((finding, idx) => (
                        <li key={idx} className="flex items-start space-x-2 text-red-700">
                          <span className="w-2 h-2 mt-2 bg-red-500 rounded-full flex-shrink-0"></span>
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Key Findings */}
                {analysisResult.keyFindings && analysisResult.keyFindings.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Findings</h3>
                    <ul className="space-y-2">
                      {analysisResult.keyFindings.map((finding, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Diagnoses & Medications */}
                <div className="grid grid-cols-2 gap-4">
                  {analysisResult.diagnoses && analysisResult.diagnoses.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Diagnoses</h3>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.diagnoses.map((dx, idx) => (
                          <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                            {dx}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysisResult.medications && analysisResult.medications.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Medications</h3>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.medications.map((med, idx) => (
                          <span key={idx} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                            {med}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Lab Results */}
                {analysisResult.labResults && analysisResult.labResults.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Lab Results</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 uppercase">
                            <th className="pb-2">Test</th>
                            <th className="pb-2">Value</th>
                            <th className="pb-2">Reference</th>
                            <th className="pb-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {analysisResult.labResults.map((lab, idx) => (
                            <tr key={idx}>
                              <td className="py-2 text-gray-900">{lab.test}</td>
                              <td className="py-2 font-medium">{lab.value} {lab.unit}</td>
                              <td className="py-2 text-gray-500">{lab.referenceRange || '-'}</td>
                              <td className="py-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  lab.abnormal ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                }`}>
                                  {lab.abnormal ? 'Abnormal' : 'Normal'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Recommendations</h3>
                    <ul className="space-y-2">
                      {analysisResult.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <span className="w-6 h-6 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-gray-700">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Extracted Entities */}
                {analysisResult.extractedEntities && (
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Extracted Entities</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {analysisResult.extractedEntities.conditions && analysisResult.extractedEntities.conditions.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">Conditions</p>
                          <div className="flex flex-wrap gap-1">
                            {analysisResult.extractedEntities.conditions.map((c, i) => (
                              <span key={i} className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysisResult.extractedEntities.procedures && analysisResult.extractedEntities.procedures.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">Procedures</p>
                          <div className="flex flex-wrap gap-1">
                            {analysisResult.extractedEntities.procedures.map((p, i) => (
                              <span key={i} className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded text-xs">{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysisResult.extractedEntities.anatomicalSites && analysisResult.extractedEntities.anatomicalSites.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">Anatomical Sites</p>
                          <div className="flex flex-wrap gap-1">
                            {analysisResult.extractedEntities.anatomicalSites.map((a, i) => (
                              <span key={i} className="px-2 py-1 bg-pink-100 text-pink-700 rounded text-xs">{a}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysisResult.extractedEntities.clinicians && analysisResult.extractedEntities.clinicians.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-2">Clinicians</p>
                          <div className="flex flex-wrap gap-1">
                            {analysisResult.extractedEntities.clinicians.map((c, i) => (
                              <span key={i} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs">{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-lg border border-white/20 p-12 text-center">
                <DocumentMagnifyingGlassIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Analysis Yet</h3>
                <p className="text-gray-500">Upload a PDF document or provide a URL to see AI-powered analysis results</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
