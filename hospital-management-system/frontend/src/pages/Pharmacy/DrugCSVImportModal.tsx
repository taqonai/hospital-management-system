import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentArrowDownIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { pharmacyApi } from '../../services/api';

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  errors: Array<{ row: number; code: string; error: string }>;
}

interface DrugCSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CSV_FIELDS = [
  { name: 'name', required: true, example: 'Paracetamol' },
  { name: 'genericName', required: true, example: 'Acetaminophen' },
  { name: 'brandName', required: false, example: 'Tylenol' },
  { name: 'code', required: true, example: 'PARA-500' },
  { name: 'category', required: true, example: 'ANALGESIC' },
  { name: 'dosageForm', required: true, example: 'TABLET' },
  { name: 'strength', required: true, example: '500mg' },
  { name: 'manufacturer', required: false, example: 'PharmaCorp' },
  { name: 'price', required: true, example: '5.99' },
  { name: 'reorderLevel', required: false, example: '50' },
  { name: 'requiresPrescription', required: false, example: 'false' },
  { name: 'isControlled', required: false, example: 'false' },
  { name: 'sideEffects', required: false, example: 'Nausea|Dizziness' },
  { name: 'contraindications', required: false, example: 'Liver disease' },
  { name: 'interactions', required: false, example: 'Warfarin|Alcohol' },
];

export default function DrugCSVImportModal({ isOpen, onClose, onSuccess }: DrugCSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation({
    mutationFn: (file: File) => pharmacyApi.bulkImportDrugs(file),
    onSuccess: (response) => {
      const result = response.data.data;
      setImportResult(result);
      if (result.errors.length === 0) {
        toast.success(`Successfully imported ${result.created} new drugs, updated ${result.updated} drugs`);
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
      const response = await pharmacyApi.downloadDrugTemplate();
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drug-import-template.csv';
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
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={clsx(
            'relative w-full max-w-2xl max-h-[90vh] overflow-hidden',
            'rounded-2xl backdrop-blur-xl border shadow-2xl',
            'bg-white/95 dark:bg-slate-800/95',
            'border-white/50 dark:border-white/10'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200/50 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                <TableCellsIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Import Drugs from CSV
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Bulk import drugs using a CSV file
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-400 transition-all duration-200"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6 space-y-6">
            {/* Download Template */}
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-100">Download CSV Template</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Use this template to format your data correctly
                </p>
              </div>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25"
              >
                <DocumentArrowDownIcon className="h-5 w-5" />
                Download
              </button>
            </div>

            {/* File Upload */}
            <div
              className={clsx(
                'border-2 border-dashed rounded-xl p-8 text-center transition-all',
                dragActive
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
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
                  <p className="text-lg font-medium text-slate-900 dark:text-white">{file.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                  <button
                    onClick={() => {
                      setFile(null);
                      setImportResult(null);
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <ArrowUpTrayIcon className="h-12 w-12 text-slate-400 mx-auto" />
                  <p className="text-lg font-medium text-slate-900 dark:text-white">
                    Drop your CSV file here
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    or{' '}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-green-600 hover:text-green-700 font-medium"
                    >
                      browse to upload
                    </button>
                  </p>
                  <p className="text-xs text-slate-400">Max file size: 10MB</p>
                </div>
              )}
            </div>

            {/* Field Reference */}
            <div>
              <h3 className="font-medium text-slate-900 dark:text-white mb-3">CSV Fields</h3>
              <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Field</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Required</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {CSV_FIELDS.map((field) => (
                      <tr key={field.name}>
                        <td className="px-3 py-2 font-mono text-slate-900 dark:text-white">{field.name}</td>
                        <td className="px-3 py-2">
                          {field.required ? (
                            <span className="text-red-600 dark:text-red-400">Yes</span>
                          ) : (
                            <span className="text-slate-400">No</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{field.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Note: Use | (pipe) to separate multiple values in sideEffects, contraindications, and interactions fields.
              </p>
            </div>

            {/* Import Results */}
            {importResult && (
              <div className={clsx(
                'p-4 rounded-xl border',
                importResult.errors.length > 0
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              )}>
                <h3 className="font-medium text-slate-900 dark:text-white mb-3">Import Results</h3>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{importResult.total}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Rows</p>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{importResult.created}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Created</p>
                  </div>
                  <div className="text-center p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{importResult.updated}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Updated</p>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                      <ExclamationCircleIcon className="h-5 w-5" />
                      {importResult.errors.length} Errors
                    </h4>
                    <div className="max-h-32 overflow-y-auto text-sm bg-white dark:bg-slate-800 rounded-lg border border-red-200 dark:border-red-800">
                      {importResult.errors.map((err, idx) => (
                        <div key={idx} className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                          <span className="font-medium">Row {err.row}</span>
                          {err.code !== 'unknown' && (
                            <span className="text-slate-500"> ({err.code})</span>
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
          <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200/50 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl">
            <button
              onClick={handleClose}
              className={clsx(
                'px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
                'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600',
                'text-slate-700 dark:text-slate-300'
              )}
            >
              {importResult ? 'Close' : 'Cancel'}
            </button>
            {!importResult && (
              <button
                onClick={handleImport}
                disabled={!file || importMutation.isPending}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
                  'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700',
                  'text-white shadow-lg shadow-green-500/25',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
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
