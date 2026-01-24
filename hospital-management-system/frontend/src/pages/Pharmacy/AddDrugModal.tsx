import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  XMarkIcon,
  BeakerIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { pharmacyApi } from '../../services/api';

interface AddDrugModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DRUG_CATEGORIES = [
  'ANALGESIC',
  'ANTIBIOTIC',
  'ANTIVIRAL',
  'ANTIFUNGAL',
  'ANTIHISTAMINE',
  'ANTIHYPERTENSIVE',
  'ANTIDIABETIC',
  'ANTIDEPRESSANT',
  'ANTICONVULSANT',
  'ANTICOAGULANT',
  'BRONCHODILATOR',
  'CARDIOVASCULAR',
  'CORTICOSTEROID',
  'DIURETIC',
  'GASTROINTESTINAL',
  'HORMONE',
  'IMMUNOSUPPRESSANT',
  'MUSCLE_RELAXANT',
  'NSAID',
  'OPIOID',
  'SEDATIVE',
  'STATIN',
  'VITAMIN',
  'OTHER',
];

const DOSAGE_FORMS = [
  'TABLET',
  'CAPSULE',
  'SYRUP',
  'SUSPENSION',
  'INJECTION',
  'CREAM',
  'OINTMENT',
  'GEL',
  'DROPS',
  'INHALER',
  'PATCH',
  'SUPPOSITORY',
  'POWDER',
  'SOLUTION',
  'SPRAY',
  'LOTION',
  'OTHER',
];

interface DrugFormData {
  name: string;
  genericName: string;
  brandName: string;
  code: string;
  category: string;
  dosageForm: string;
  strength: string;
  manufacturer: string;
  price: string;
  reorderLevel: string;
  requiresPrescription: boolean;
  isControlled: boolean;
  sideEffects: string;
  contraindications: string;
  interactions: string;
}

const initialFormData: DrugFormData = {
  name: '',
  genericName: '',
  brandName: '',
  code: '',
  category: '',
  dosageForm: '',
  strength: '',
  manufacturer: '',
  price: '',
  reorderLevel: '10',
  requiresPrescription: true,
  isControlled: false,
  sideEffects: '',
  contraindications: '',
  interactions: '',
};

export default function AddDrugModal({ isOpen, onClose, onSuccess }: AddDrugModalProps) {
  const [formData, setFormData] = useState<DrugFormData>(initialFormData);

  const createMutation = useMutation({
    mutationFn: (data: any) => pharmacyApi.createDrug(data),
    onSuccess: () => {
      toast.success('Drug added successfully');
      setFormData(initialFormData);
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add drug');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name.trim()) {
      toast.error('Drug name is required');
      return;
    }
    if (!formData.genericName.trim()) {
      toast.error('Generic name is required');
      return;
    }
    if (!formData.code.trim()) {
      toast.error('Drug code is required');
      return;
    }
    if (!formData.category) {
      toast.error('Category is required');
      return;
    }
    if (!formData.dosageForm) {
      toast.error('Dosage form is required');
      return;
    }
    if (!formData.strength.trim()) {
      toast.error('Strength is required');
      return;
    }
    if (!formData.price || Number(formData.price) <= 0) {
      toast.error('Valid price is required');
      return;
    }

    // Prepare data for API
    const payload = {
      name: formData.name.trim(),
      genericName: formData.genericName.trim(),
      brandName: formData.brandName.trim() || undefined,
      code: formData.code.trim(),
      category: formData.category,
      dosageForm: formData.dosageForm,
      strength: formData.strength.trim(),
      manufacturer: formData.manufacturer.trim() || undefined,
      price: Number(formData.price),
      reorderLevel: Number(formData.reorderLevel) || 10,
      requiresPrescription: formData.requiresPrescription,
      isControlled: formData.isControlled,
      sideEffects: formData.sideEffects.trim() ? formData.sideEffects.split(',').map(s => s.trim()) : [],
      contraindications: formData.contraindications.trim() ? formData.contraindications.split(',').map(s => s.trim()) : [],
      interactions: formData.interactions.trim() ? formData.interactions.split(',').map(s => s.trim()) : [],
    };

    createMutation.mutate(payload);
  };

  const handleClose = () => {
    setFormData(initialFormData);
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
            'relative w-full max-w-3xl max-h-[90vh] overflow-hidden',
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
              <div className="p-2 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
                <BeakerIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Add New Medicine
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Add a new drug to the pharmacy inventory
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
          <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-180px)]">
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Basic Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Drug Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g., Paracetamol"
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    />
                  </div>

                  {/* Generic Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Generic Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="genericName"
                      value={formData.genericName}
                      onChange={handleChange}
                      placeholder="e.g., Acetaminophen"
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    />
                  </div>

                  {/* Brand Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Brand Name
                    </label>
                    <input
                      type="text"
                      name="brandName"
                      value={formData.brandName}
                      onChange={handleChange}
                      placeholder="e.g., Tylenol"
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    />
                  </div>

                  {/* Code */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Drug Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code}
                      onChange={handleChange}
                      placeholder="e.g., PARA-500"
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Classification */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Classification
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    >
                      <option value="">Select Category</option>
                      {DRUG_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dosage Form */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Dosage Form <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="dosageForm"
                      value={formData.dosageForm}
                      onChange={handleChange}
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    >
                      <option value="">Select Dosage Form</option>
                      {DOSAGE_FORMS.map((form) => (
                        <option key={form} value={form}>
                          {form.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Strength */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Strength <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="strength"
                      value={formData.strength}
                      onChange={handleChange}
                      placeholder="e.g., 500mg"
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    />
                  </div>

                  {/* Manufacturer */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Manufacturer
                    </label>
                    <input
                      type="text"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleChange}
                      placeholder="e.g., PharmaCorp"
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Pricing & Stock
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Price */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Price <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      placeholder="e.g., 5.99"
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    />
                  </div>

                  {/* Reorder Level */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Reorder Level
                    </label>
                    <input
                      type="number"
                      name="reorderLevel"
                      value={formData.reorderLevel}
                      onChange={handleChange}
                      min="0"
                      placeholder="e.g., 10"
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    />
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="requiresPrescription"
                      checked={formData.requiresPrescription}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Requires Prescription</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isControlled"
                      checked={formData.isControlled}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Controlled Substance</span>
                  </label>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Additional Information
                </h3>

                <div className="space-y-4">
                  {/* Side Effects */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Side Effects <span className="text-slate-400 text-xs">(comma-separated)</span>
                    </label>
                    <textarea
                      name="sideEffects"
                      value={formData.sideEffects}
                      onChange={handleChange}
                      rows={2}
                      placeholder="e.g., Nausea, Dizziness, Headache"
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200 resize-none',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    />
                  </div>

                  {/* Contraindications */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Contraindications <span className="text-slate-400 text-xs">(comma-separated)</span>
                    </label>
                    <textarea
                      name="contraindications"
                      value={formData.contraindications}
                      onChange={handleChange}
                      rows={2}
                      placeholder="e.g., Pregnancy, Liver disease, Allergy to NSAIDs"
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200 resize-none',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    />
                  </div>

                  {/* Interactions */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Drug Interactions <span className="text-slate-400 text-xs">(comma-separated)</span>
                    </label>
                    <textarea
                      name="interactions"
                      value={formData.interactions}
                      onChange={handleChange}
                      rows={2}
                      placeholder="e.g., Warfarin, Aspirin, Alcohol"
                      className={clsx(
                        'w-full px-4 py-2.5 rounded-xl border transition-all duration-200 resize-none',
                        'bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm',
                        'border-slate-200 dark:border-slate-700',
                        'text-slate-900 dark:text-white placeholder-slate-400',
                        'focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500'
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200/50 dark:border-white/10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl">
              <button
                type="button"
                onClick={handleClose}
                className={clsx(
                  'px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
                  'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600',
                  'text-slate-700 dark:text-slate-300'
                )}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className={clsx(
                  'px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
                  'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700',
                  'text-white shadow-lg shadow-green-500/25',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'hover:scale-105 hover:shadow-xl'
                )}
              >
                {createMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Adding...
                  </span>
                ) : (
                  'Add Medicine'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
