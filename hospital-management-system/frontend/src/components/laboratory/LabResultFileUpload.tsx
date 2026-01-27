import { useState, useRef, useCallback } from 'react';
import {
  DocumentArrowUpIcon,
  PhotoIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { laboratoryApi } from '@/services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface LabResultFileUploadProps {
  testId: string;
  testName: string;
  patientName?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface ExtractionResult {
  testName?: string;
  resultValue?: string;
  unit?: string;
  normalRange?: string;
  isAbnormal?: boolean;
  isCritical?: boolean;
  comments?: string;
  confidence: string;
  summary?: string;
}

export default function LabResultFileUpload({
  testId,
  testName,
  patientName,
  onSuccess,
  onCancel,
}: LabResultFileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF or image file (JPEG, PNG)');
      return;
    }

    if (file.size > maxSize) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setExtractedData(null);

    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreview(null);
    setExtractedData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await laboratoryApi.uploadLabResult(testId, formData);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.data.success) {
        setExtractedData(response.data.extraction);
        toast.success('Lab result uploaded and extracted successfully!');

        // Auto-close after 2 seconds
        setTimeout(() => {
          onSuccess();
        }, 2000);
      } else {
        toast.error(response.data.error || 'Failed to process file');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Upload Lab Result File
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Test: <span className="font-medium">{testName}</span>
          {patientName && (
            <>
              {' • '}
              Patient: <span className="font-medium">{patientName}</span>
            </>
          )}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-blue-600 dark:text-blue-400">
          <SparklesIcon className="w-4 h-4" />
          <span>AI will automatically extract test results from your file</span>
        </div>
      </div>

      {/* File Upload Area */}
      {!selectedFile ? (
        <div
          className={clsx(
            'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <DocumentArrowUpIcon className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
            Drag and drop your file here, or click to browse
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Supported: PDF, JPEG, PNG (Max 10MB)
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            Choose File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/jpg,image/png"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          {/* File Preview */}
          <div className="flex items-start gap-4">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="w-24 h-24 object-cover rounded border border-gray-300 dark:border-gray-600"
              />
            ) : (
              <div className="w-24 h-24 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
                <DocumentArrowUpIcon className="w-12 h-12 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              <div className="flex items-center gap-2 mt-2">
                <PhotoIcon className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedFile.type}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              disabled={uploading}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">
                  {uploadProgress < 90
                    ? 'Uploading...'
                    : uploadProgress < 100
                    ? 'Processing with AI...'
                    : 'Complete!'}
                </span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Extracted Data Preview */}
          {extractedData && (
            <div className="mt-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  AI Extracted Data
                </span>
                <span
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded-full',
                    extractedData.confidence === 'HIGH'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : extractedData.confidence === 'MEDIUM'
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  )}
                >
                  Confidence: {extractedData.confidence}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {extractedData.resultValue && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Result:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {extractedData.resultValue} {extractedData.unit}
                    </span>
                  </div>
                )}
                {extractedData.normalRange && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Normal Range:</span>
                    <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                      {extractedData.normalRange}
                    </span>
                  </div>
                )}
              </div>

              {(extractedData.isAbnormal || extractedData.isCritical) && (
                <div
                  className={clsx(
                    'flex items-center gap-2 p-3 rounded-md',
                    extractedData.isCritical
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
                  )}
                >
                  <ExclamationTriangleIcon className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    {extractedData.isCritical ? 'Critical Result Detected' : 'Abnormal Result'}
                  </span>
                </div>
              )}

              {extractedData.summary && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">
                    AI Summary:
                  </p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">
                    {extractedData.summary}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          disabled={uploading}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || uploading || !!extractedData}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {uploading ? (
            <>
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : extractedData ? (
            <>
              <CheckCircleIcon className="w-4 h-4" />
              Uploaded Successfully
            </>
          ) : (
            <>
              <SparklesIcon className="w-4 h-4" />
              Upload & Extract
            </>
          )}
        </button>
      </div>
    </div>
  );
}
