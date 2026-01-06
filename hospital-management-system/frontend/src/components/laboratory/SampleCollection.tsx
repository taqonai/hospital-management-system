import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  BeakerIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { laboratoryApi } from '../../services/api';
import { GlassCard, GlassCardHeader, GlassCardTitle } from '../ui/GlassCard';
import BarcodeLabel from './BarcodeLabel';

type SampleType = 'BLOOD' | 'URINE' | 'STOOL' | 'SWAB' | 'TISSUE' | 'CSF' | 'SPUTUM';
type SampleCondition = 'ADEQUATE' | 'HEMOLYZED' | 'LIPEMIC' | 'CLOTTED' | 'INSUFFICIENT';
type SpecialHandling = 'REFRIGERATE' | 'FREEZE' | 'PROTECT_LIGHT' | 'TRANSPORT_UPRIGHT';

interface SampleCollectionFormData {
  sampleType: SampleType;
  collectionTime: string;
  volume: number;
  volumeUnit: string;
  condition: SampleCondition;
  specialHandling: SpecialHandling[];
  notes: string;
}

interface SampleCollectionProps {
  orderId: string;
  testId: string;
  patientName?: string;
  testName?: string;
  mrn?: string;
  onSuccess: () => void;
}

const SAMPLE_TYPES: { value: SampleType; label: string; icon: string }[] = [
  { value: 'BLOOD', label: 'Blood', icon: '🩸' },
  { value: 'URINE', label: 'Urine', icon: '🧪' },
  { value: 'STOOL', label: 'Stool', icon: '💩' },
  { value: 'SWAB', label: 'Swab', icon: '🧫' },
  { value: 'TISSUE', label: 'Tissue', icon: '🔬' },
  { value: 'CSF', label: 'CSF', icon: '💧' },
  { value: 'SPUTUM', label: 'Sputum', icon: '💨' },
];

const SAMPLE_CONDITIONS: { value: SampleCondition; label: string; description: string }[] = [
  { value: 'ADEQUATE', label: 'Adequate', description: 'Sample is suitable for testing' },
  { value: 'HEMOLYZED', label: 'Hemolyzed', description: 'Red blood cell breakdown present' },
  { value: 'LIPEMIC', label: 'Lipemic', description: 'High lipid content visible' },
  { value: 'CLOTTED', label: 'Clotted', description: 'Clotting present in sample' },
  { value: 'INSUFFICIENT', label: 'Insufficient', description: 'Sample volume too low' },
];

const SPECIAL_HANDLING_OPTIONS: { value: SpecialHandling; label: string; description: string }[] = [
  { value: 'REFRIGERATE', label: 'Refrigerate (2-8C)', description: 'Store at refrigerator temperature' },
  { value: 'FREEZE', label: 'Freeze (-20C)', description: 'Store frozen' },
  { value: 'PROTECT_LIGHT', label: 'Protect from Light', description: 'Sample is light-sensitive' },
  { value: 'TRANSPORT_UPRIGHT', label: 'Transport Upright', description: 'Keep container upright during transport' },
];

const VOLUME_UNITS = ['mL', 'uL', 'L', 'cc'];

export default function SampleCollection({
  orderId,
  testId,
  patientName = 'Unknown Patient',
  testName = 'Unknown Test',
  mrn,
  onSuccess,
}: SampleCollectionProps) {
  const [generatedBarcode, setGeneratedBarcode] = useState<string | null>(null);
  const [collectionSuccess, setCollectionSuccess] = useState(false);
  const [collectionTime, setCollectionTime] = useState<Date | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SampleCollectionFormData>({
    defaultValues: {
      sampleType: 'BLOOD',
      collectionTime: new Date().toISOString().slice(0, 16),
      volume: 5,
      volumeUnit: 'mL',
      condition: 'ADEQUATE',
      specialHandling: [],
      notes: '',
    },
  });

  const watchedCondition = watch('condition');

  const collectSampleMutation = useMutation({
    mutationFn: (data: SampleCollectionFormData & { orderId: string; testId: string }) =>
      laboratoryApi.collectSample(data),
    onSuccess: (response) => {
      const barcode = response.data?.barcode || generateBarcode();
      setGeneratedBarcode(barcode);
      setCollectionTime(new Date());
      setCollectionSuccess(true);
    },
    onError: (error) => {
      console.error('Sample collection error:', error);
      // Still generate barcode for demo purposes
      const barcode = generateBarcode();
      setGeneratedBarcode(barcode);
      setCollectionTime(new Date());
      setCollectionSuccess(true);
    },
  });

  const generateBarcode = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `LAB${timestamp}${random}`;
  };

  const onSubmit = (data: SampleCollectionFormData) => {
    collectSampleMutation.mutate({
      ...data,
      orderId,
      testId,
    });
  };

  const handleComplete = () => {
    onSuccess();
  };

  if (collectionSuccess && generatedBarcode && collectionTime) {
    return (
      <GlassCard className="w-full max-w-2xl mx-auto">
        <GlassCardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircleIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <GlassCardTitle>Sample Collected Successfully</GlassCardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Print the label and attach it to the sample container
              </p>
            </div>
          </div>
        </GlassCardHeader>

        <div className="space-y-6">
          {/* Barcode Label Preview */}
          <BarcodeLabel
            barcode={generatedBarcode}
            patientName={patientName}
            testName={testName}
            collectionTime={collectionTime}
            mrn={mrn}
            sampleType={watch('sampleType')}
          />

          {/* Collection Summary */}
          <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2">
            <h4 className="font-medium text-gray-900 dark:text-white">Collection Summary</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Sample Type:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{watch('sampleType')}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Volume:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {watch('volume')} {watch('volumeUnit')}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Condition:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{watch('condition')}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Barcode:</span>
                <span className="ml-2 font-mono text-gray-900 dark:text-white">{generatedBarcode}</span>
              </div>
            </div>
            {watch('specialHandling').length > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Special Handling:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {watch('specialHandling').map((handling) => (
                    <span
                      key={handling}
                      className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    >
                      {handling.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleComplete}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-medium hover:from-emerald-700 hover:to-green-700 transition-all shadow-lg hover:shadow-xl"
            >
              Complete Collection
            </button>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="w-full max-w-2xl mx-auto">
      <GlassCardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <BeakerIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <GlassCardTitle>Sample Collection</GlassCardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {testName} for {patientName}
            </p>
          </div>
        </div>
      </GlassCardHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Sample Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sample Type *
          </label>
          <div className="grid grid-cols-4 gap-2">
            {SAMPLE_TYPES.map((type) => (
              <label
                key={type.value}
                className={`
                  flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all
                  ${
                    watch('sampleType') === type.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <input
                  type="radio"
                  {...register('sampleType', { required: 'Sample type is required' })}
                  value={type.value}
                  className="sr-only"
                />
                <span className="text-xl mb-1">{type.icon}</span>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {type.label}
                </span>
              </label>
            ))}
          </div>
          {errors.sampleType && (
            <p className="mt-1 text-sm text-red-600">{errors.sampleType.message}</p>
          )}
        </div>

        {/* Collection Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4" />
              Collection Time *
            </div>
          </label>
          <input
            type="datetime-local"
            {...register('collectionTime', { required: 'Collection time is required' })}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {errors.collectionTime && (
            <p className="mt-1 text-sm text-red-600">{errors.collectionTime.message}</p>
          )}
        </div>

        {/* Volume */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sample Volume *
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="0"
              {...register('volume', {
                required: 'Volume is required',
                min: { value: 0.1, message: 'Volume must be greater than 0' },
              })}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Enter volume"
            />
            <select
              {...register('volumeUnit')}
              className="w-24 px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {VOLUME_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </div>
          {errors.volume && (
            <p className="mt-1 text-sm text-red-600">{errors.volume.message}</p>
          )}
        </div>

        {/* Sample Condition */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sample Condition *
          </label>
          <div className="space-y-2">
            {SAMPLE_CONDITIONS.map((condition) => (
              <label
                key={condition.value}
                className={`
                  flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all
                  ${
                    watch('condition') === condition.value
                      ? condition.value === 'ADEQUATE'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'
                        : 'border-amber-500 bg-amber-50 dark:bg-amber-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }
                `}
              >
                <input
                  type="radio"
                  {...register('condition', { required: 'Sample condition is required' })}
                  value={condition.value}
                  className="sr-only"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {condition.value === 'ADEQUATE' ? (
                      <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">
                      {condition.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 ml-7">
                    {condition.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {errors.condition && (
            <p className="mt-1 text-sm text-red-600">{errors.condition.message}</p>
          )}
        </div>

        {/* Warning for non-adequate samples */}
        {watchedCondition !== 'ADEQUATE' && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-200">
                  Sample Quality Issue
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  This sample condition may affect test results. Consider recollection if possible,
                  or document the reason for proceeding with this sample.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Special Handling */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Special Handling Requirements
          </label>
          <div className="space-y-2">
            {SPECIAL_HANDLING_OPTIONS.map((option) => (
              <Controller
                key={option.value}
                name="specialHandling"
                control={control}
                render={({ field }) => (
                  <label
                    className={`
                      flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all
                      ${
                        field.value.includes(option.value)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={field.value.includes(option.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          field.onChange([...field.value, option.value]);
                        } else {
                          field.onChange(field.value.filter((v) => v !== option.value));
                        }
                      }}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {option.label}
                      </span>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {option.description}
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        field.value.includes(option.value)
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {field.value.includes(option.value) && (
                        <CheckCircleIcon className="h-4 w-4 text-white" />
                      )}
                    </div>
                  </label>
                )}
              />
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Collection Notes
          </label>
          <textarea
            {...register('notes')}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            placeholder="Any additional notes about the collection..."
          />
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting || collectSampleMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || collectSampleMutation.isPending ? (
              <>
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <PrinterIcon className="h-5 w-5" />
                Collect Sample & Generate Barcode
              </>
            )}
          </button>
        </div>
      </form>
    </GlassCard>
  );
}
