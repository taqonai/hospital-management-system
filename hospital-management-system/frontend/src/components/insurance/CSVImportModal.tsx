import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface CSVField {
  name: string;
  required: boolean;
  example: string;
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: Array<{ row: number; code: string; error: string }>;
}

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title: string;
  description: string;
  importFn: (file: File) => Promise<{ data: { data: ImportResult } }>;
  downloadTemplateFn: () => Promise<{ data: Blob }>;
  templateFilename: string;
  fields: CSVField[];
}

export default function CSVImportModal({
  isOpen,
  onClose,
  onSuccess,
  title,
  description,
  importFn,
  downloadTemplateFn,
  templateFilename,
  fields,
}: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: importFn,
    onSuccess: (response) => {
      const result = response.data.data;
      setImportResult(result);
      if (result.errors.length === 0) {
        toast.success(`Successfully imported ${result.created} new codes, updated ${result.updated} codes`);
        onSuccess();
      } else {
        toast.error(`Import completed with ${result.errors.length} errors`);
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Import failed');
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setImportResult(null);
      } else {
        toast.error('Please upload a CSV file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (file) {
      importMutation.mutate(file);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await downloadTemplateFn();
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = templateFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-6">
        <div className="fixed inset-0 bg-black/50" onClick={handleClose} />
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
            </div>
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Download Template */}
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-100">Download CSV Template</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Use this template to format your data correctly
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <DocumentArrowDownIcon className="h-5 w-5" />
                Download
              </button>
            </div>

            {/* File Upload */}
            <div
              className={clsx(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                dragActive
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="space-y-2">
                  <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white">{file.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                  <button
                    onClick={() => {
                      setFile(null);
                      setImportResult(null);
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <ArrowUpTrayIcon className="h-12 w-12 text-gray-400 mx-auto" />
                  <p className="text-lg font-medium text-gray-900 dark:text-white">
                    Drop your CSV file here
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      browse to upload
                    </button>
                  </p>
                  <p className="text-xs text-gray-400">Max file size: 10MB</p>
                </div>
              )}
            </div>

            {/* Field Reference */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">CSV Fields</h3>
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Field</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Required</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {fields.map((field) => (
                      <tr key={field.name}>
                        <td className="px-3 py-2 font-mono text-gray-900 dark:text-white">{field.name}</td>
                        <td className="px-3 py-2">
                          {field.required ? (
                            <span className="text-red-600 dark:text-red-400">Yes</span>
                          ) : (
                            <span className="text-gray-400">No</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{field.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Import Results */}
            {importResult && (
              <div className={clsx(
                'p-4 rounded-lg',
                importResult.errors.length > 0
                  ? 'bg-yellow-50 dark:bg-yellow-900/20'
                  : 'bg-green-50 dark:bg-green-900/20'
              )}>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Import Results</h3>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{importResult.total}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Rows</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Updated</p>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                      <ExclamationCircleIcon className="h-5 w-5" />
                      {importResult.errors.length} Errors
                    </h4>
                    <div className="max-h-32 overflow-y-auto text-sm bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-800">
                      {importResult.errors.map((err, idx) => (
                        <div key={idx} className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                          <span className="font-medium">Row {err.row}</span>
                          {err.code !== 'unknown' && (
                            <span className="text-gray-500"> ({err.code})</span>
                          )}
                          : <span className="text-red-600 dark:text-red-400">{err.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {importResult ? 'Close' : 'Cancel'}
            </button>
            {!importResult && (
              <button
                onClick={handleImport}
                disabled={!file || importMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importMutation.isPending ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="h-5 w-5" />
                    Import CSV
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
