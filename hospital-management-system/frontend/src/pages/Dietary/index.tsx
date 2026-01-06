import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  CakeIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  TruckIcon,
  SparklesIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  BeakerIcon,
  FireIcon,
  ScaleIcon,
  HeartIcon,
  CalendarDaysIcon,
  BuildingOfficeIcon,
  UserIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  DocumentTextIcon,
  LightBulbIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import { dietaryApi, patientApi, ipdApi } from '../../services/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// Types
interface DietaryStats {
  todayOrders: {
    total: number;
    pending: number;
    preparing: number;
    ready: number;
    delivered: number;
    consumed: number;
  };
  activeDiets: number;
  specialDiets: number;
}

interface DietPlan {
  id: string;
  name: string;
  category: string;
  description?: string;
  targetCalories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  restrictions?: string[];
  breakfastItems?: string[];
  lunchItems?: string[];
  dinnerItems?: string[];
  snackItems?: string[];
  isActive: boolean;
  createdAt: string;
}

interface PatientDiet {
  id: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
  };
  dietPlan: {
    id: string;
    name: string;
    category: string;
  };
  feedingMethod: string;
  allergies?: string[];
  specialInstructions?: string;
  startDate: string;
  endDate?: string;
  status: string;
  createdAt: string;
}

interface MealOrder {
  id: string;
  orderNumber: string;
  patientDiet: {
    id: string;
    patient: {
      id: string;
      firstName: string;
      lastName: string;
      mrn: string;
    };
    dietPlan: {
      id: string;
      name: string;
      category: string;
    };
  };
  mealType: string;
  scheduledTime: string;
  items?: string[];
  specialInstructions?: string;
  status: string;
  consumptionPercentage?: number;
  consumptionNotes?: string;
  deliveredAt?: string;
  ward?: string;
  bedNumber?: string;
  createdAt: string;
}

interface Ward {
  id: string;
  name: string;
  code: string;
}

// Status configurations
const orderStatusConfig: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  PENDING: { dot: 'bg-yellow-500', bg: 'bg-yellow-100/60', text: 'text-yellow-700', label: 'Pending' },
  PREPARING: { dot: 'bg-blue-500', bg: 'bg-blue-100/60', text: 'text-blue-700', label: 'Preparing' },
  READY: { dot: 'bg-purple-500', bg: 'bg-purple-100/60', text: 'text-purple-700', label: 'Ready' },
  DELIVERED: { dot: 'bg-green-500', bg: 'bg-green-100/60', text: 'text-green-700', label: 'Delivered' },
  CONSUMED: { dot: 'bg-emerald-500', bg: 'bg-emerald-100/60', text: 'text-emerald-700', label: 'Consumed' },
  CANCELLED: { dot: 'bg-red-500', bg: 'bg-red-100/60', text: 'text-red-700', label: 'Cancelled' },
};

const dietStatusConfig: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  ACTIVE: { dot: 'bg-green-500', bg: 'bg-green-100/60', text: 'text-green-700', label: 'Active' },
  COMPLETED: { dot: 'bg-blue-500', bg: 'bg-blue-100/60', text: 'text-blue-700', label: 'Completed' },
  SUSPENDED: { dot: 'bg-yellow-500', bg: 'bg-yellow-100/60', text: 'text-yellow-700', label: 'Suspended' },
  CANCELLED: { dot: 'bg-red-500', bg: 'bg-red-100/60', text: 'text-red-700', label: 'Cancelled' },
};

const dietCategories = [
  'REGULAR',
  'DIABETIC',
  'RENAL',
  'CARDIAC',
  'LOW_SODIUM',
  'HIGH_PROTEIN',
  'SOFT',
  'LIQUID',
  'NPO',
];

const dietCategoryLabels: Record<string, string> = {
  REGULAR: 'Regular',
  DIABETIC: 'Diabetic',
  RENAL: 'Renal',
  CARDIAC: 'Cardiac',
  LOW_SODIUM: 'Low Sodium',
  HIGH_PROTEIN: 'High Protein',
  SOFT: 'Soft',
  LIQUID: 'Liquid',
  NPO: 'NPO (Nothing by Mouth)',
};

const dietCategoryColors: Record<string, string> = {
  REGULAR: 'bg-gray-100 text-gray-700',
  DIABETIC: 'bg-blue-100 text-blue-700',
  RENAL: 'bg-purple-100 text-purple-700',
  CARDIAC: 'bg-red-100 text-red-700',
  LOW_SODIUM: 'bg-yellow-100 text-yellow-700',
  HIGH_PROTEIN: 'bg-green-100 text-green-700',
  SOFT: 'bg-orange-100 text-orange-700',
  LIQUID: 'bg-cyan-100 text-cyan-700',
  NPO: 'bg-rose-100 text-rose-700',
};

const mealTypes = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];
const feedingMethods = ['ORAL', 'ENTERAL', 'PARENTERAL', 'NPO'];

// Status Badge Component
function StatusBadge({ status, config }: { status: string; config: Record<string, any> }) {
  const statusConf = config[status] || config.PENDING;
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm border border-white/20',
      statusConf.bg,
      statusConf.text
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full', statusConf.dot)} />
      {statusConf.label}
    </span>
  );
}

// Add/Edit Diet Plan Modal
function DietPlanModal({
  plan,
  onClose,
  onSuccess,
}: {
  plan?: DietPlan;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: plan ? {
      name: plan.name,
      category: plan.category,
      description: plan.description || '',
      targetCalories: plan.targetCalories || '',
      proteinGrams: plan.proteinGrams || '',
      carbsGrams: plan.carbsGrams || '',
      fatGrams: plan.fatGrams || '',
      restrictions: plan.restrictions || [],
      breakfastItems: plan.breakfastItems?.map(item => ({ value: item })) || [{ value: '' }],
      lunchItems: plan.lunchItems?.map(item => ({ value: item })) || [{ value: '' }],
      dinnerItems: plan.dinnerItems?.map(item => ({ value: item })) || [{ value: '' }],
      snackItems: plan.snackItems?.map(item => ({ value: item })) || [{ value: '' }],
    } : {
      name: '',
      category: 'REGULAR',
      description: '',
      targetCalories: '',
      proteinGrams: '',
      carbsGrams: '',
      fatGrams: '',
      restrictions: [],
      breakfastItems: [{ value: '' }],
      lunchItems: [{ value: '' }],
      dinnerItems: [{ value: '' }],
      snackItems: [{ value: '' }],
    },
  });

  const { fields: breakfastFields, append: appendBreakfast, remove: removeBreakfast } = useFieldArray({
    control,
    name: 'breakfastItems',
  });

  const { fields: lunchFields, append: appendLunch, remove: removeLunch } = useFieldArray({
    control,
    name: 'lunchItems',
  });

  const { fields: dinnerFields, append: appendDinner, remove: removeDinner } = useFieldArray({
    control,
    name: 'dinnerItems',
  });

  const { fields: snackFields, append: appendSnack, remove: removeSnack } = useFieldArray({
    control,
    name: 'snackItems',
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        targetCalories: data.targetCalories ? parseInt(data.targetCalories) : undefined,
        proteinGrams: data.proteinGrams ? parseInt(data.proteinGrams) : undefined,
        carbsGrams: data.carbsGrams ? parseInt(data.carbsGrams) : undefined,
        fatGrams: data.fatGrams ? parseInt(data.fatGrams) : undefined,
        restrictions: data.restrictions ? data.restrictions.split(',').map((r: string) => r.trim()).filter(Boolean) : [],
        breakfastItems: data.breakfastItems.map((i: { value: string }) => i.value).filter(Boolean),
        lunchItems: data.lunchItems.map((i: { value: string }) => i.value).filter(Boolean),
        dinnerItems: data.dinnerItems.map((i: { value: string }) => i.value).filter(Boolean),
        snackItems: data.snackItems.map((i: { value: string }) => i.value).filter(Boolean),
      };

      if (plan) {
        await dietaryApi.updateDietPlan(plan.id, payload);
        toast.success('Diet plan updated successfully');
      } else {
        await dietaryApi.createDietPlan(payload);
        toast.success('Diet plan created successfully');
      }
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save diet plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-300 to-transparent" />

        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {plan ? 'Edit Diet Plan' : 'Create Diet Plan'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Plan Name *</label>
                <input
                  {...register('name', { required: 'Plan name is required' })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., Diabetic Diet Type 1"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Category *</label>
                <select
                  {...register('category', { required: 'Category is required' })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  {dietCategories.map(cat => (
                    <option key={cat} value={cat}>{dietCategoryLabels[cat]}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  {...register('description')}
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Brief description of the diet plan"
                />
              </div>
            </div>
          </div>

          {/* Nutritional Targets */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Nutritional Targets</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Calories (kcal)</label>
                <input
                  type="number"
                  {...register('targetCalories')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="2000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Protein (g)</label>
                <input
                  type="number"
                  {...register('proteinGrams')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Carbs (g)</label>
                <input
                  type="number"
                  {...register('carbsGrams')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="250"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Fat (g)</label>
                <input
                  type="number"
                  {...register('fatGrams')}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="70"
                />
              </div>
            </div>
          </div>

          {/* Restrictions */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Dietary Restrictions (comma-separated)</label>
            <input
              {...register('restrictions')}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="e.g., No sugar, Low salt, Gluten-free"
            />
          </div>

          {/* Meal Items */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Meal Items</h3>

            {/* Breakfast Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-600">Breakfast Items</label>
                <button
                  type="button"
                  onClick={() => appendBreakfast({ value: '' })}
                  className="text-sm text-green-600 hover:text-green-700"
                >
                  + Add Item
                </button>
              </div>
              <div className="space-y-2">
                {breakfastFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`breakfastItems.${index}.value`)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                      placeholder="e.g., Oatmeal with fruits"
                    />
                    {breakfastFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBreakfast(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Lunch Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-600">Lunch Items</label>
                <button
                  type="button"
                  onClick={() => appendLunch({ value: '' })}
                  className="text-sm text-green-600 hover:text-green-700"
                >
                  + Add Item
                </button>
              </div>
              <div className="space-y-2">
                {lunchFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`lunchItems.${index}.value`)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                      placeholder="e.g., Grilled chicken salad"
                    />
                    {lunchFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLunch(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Dinner Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-600">Dinner Items</label>
                <button
                  type="button"
                  onClick={() => appendDinner({ value: '' })}
                  className="text-sm text-green-600 hover:text-green-700"
                >
                  + Add Item
                </button>
              </div>
              <div className="space-y-2">
                {dinnerFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`dinnerItems.${index}.value`)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                      placeholder="e.g., Steamed fish with vegetables"
                    />
                    {dinnerFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDinner(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Snack Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-600">Snack Items</label>
                <button
                  type="button"
                  onClick={() => appendSnack({ value: '' })}
                  className="text-sm text-green-600 hover:text-green-700"
                >
                  + Add Item
                </button>
              </div>
              <div className="space-y-2">
                {snackFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`snackItems.${index}.value`)}
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                      placeholder="e.g., Fresh fruit"
                    />
                    {snackFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSnack(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium transition-all shadow-lg shadow-green-500/25 disabled:opacity-50"
            >
              {loading ? 'Saving...' : plan ? 'Update Plan' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Assign Patient Diet Modal
function AssignDietModal({
  onClose,
  onSuccess,
  dietPlans,
}: {
  onClose: () => void;
  onSuccess: () => void;
  dietPlans: DietPlan[];
}) {
  const [loading, setLoading] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiSuggestion, setAISuggestion] = useState<any>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      patientId: '',
      dietPlanId: '',
      feedingMethod: 'ORAL',
      allergies: '',
      specialInstructions: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
    },
  });

  const selectedDietPlanId = watch('dietPlanId');

  // Search patients
  const { data: patients = [] } = useQuery({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => patientApi.getAll({ search: patientSearch, limit: 10 }),
    select: (res) => res.data.data?.patients || [],
    enabled: patientSearch.length >= 2,
  });

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    setValue('patientId', patient.id);
    setPatientSearch('');
  };

  const handleGetAISuggestion = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }

    setLoadingAI(true);
    try {
      const response = await dietaryApi.suggestDietPlan({
        patientId: selectedPatient.id,
        diagnosis: selectedPatient.diagnosis || 'General',
        conditions: selectedPatient.conditions || [],
        age: selectedPatient.age,
        weight: selectedPatient.weight,
        height: selectedPatient.height,
      });
      setAISuggestion(response.data.data);
      if (response.data.data?.recommendedCategory) {
        const recommendedPlan = dietPlans.find(p => p.category === response.data.data.recommendedCategory);
        if (recommendedPlan) {
          setValue('dietPlanId', recommendedPlan.id);
        }
      }
      toast.success('AI recommendation generated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to get AI suggestion');
    } finally {
      setLoadingAI(false);
    }
  };

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await dietaryApi.assignPatientDiet({
        ...data,
        allergies: data.allergies ? data.allergies.split(',').map((a: string) => a.trim()).filter(Boolean) : [],
        startDate: new Date(data.startDate).toISOString(),
        endDate: data.endDate ? new Date(data.endDate).toISOString() : undefined,
      });
      toast.success('Diet assigned successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to assign diet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-300 to-transparent" />

        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">Assign Diet to Patient</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Patient Search */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Patient *</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 border border-green-200">
                <div>
                  <p className="font-medium text-gray-900">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </p>
                  <p className="text-sm text-gray-500">MRN: {selectedPatient.mrn}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(null);
                    setValue('patientId', '');
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Search by name or MRN..."
                />
                {patients.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {patients.map((patient: any) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => handleSelectPatient(patient)}
                        className="w-full px-4 py-3 text-left hover:bg-green-50 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{patient.firstName} {patient.lastName}</p>
                          <p className="text-sm text-gray-500">MRN: {patient.mrn}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.patientId && <p className="text-red-500 text-xs mt-1">Patient is required</p>}
          </div>

          {/* AI Suggestion Button */}
          <button
            type="button"
            onClick={handleGetAISuggestion}
            disabled={loadingAI || !selectedPatient}
            className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-medium transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingAI ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Getting AI Recommendation...
              </>
            ) : (
              <>
                <SparklesIcon className="h-5 w-5" />
                Get AI Diet Recommendation
              </>
            )}
          </button>

          {/* AI Suggestion Display */}
          {aiSuggestion && (
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-2">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-purple-600" />
                <h4 className="font-semibold text-purple-900">AI Recommendation</h4>
              </div>
              <p className="text-sm text-purple-700">
                Recommended Category: <span className="font-medium">{dietCategoryLabels[aiSuggestion.recommendedCategory] || aiSuggestion.recommendedCategory}</span>
              </p>
              {aiSuggestion.rationale && (
                <p className="text-sm text-purple-600">{aiSuggestion.rationale}</p>
              )}
              {aiSuggestion.nutritionalGoals && (
                <div className="text-sm text-purple-600">
                  <p>Calories: {aiSuggestion.nutritionalGoals.calories} kcal</p>
                  <p>Protein: {aiSuggestion.nutritionalGoals.protein}g</p>
                </div>
              )}
            </div>
          )}

          {/* Diet Plan Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Diet Plan *</label>
            <select
              {...register('dietPlanId', { required: 'Diet plan is required' })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">Select Diet Plan</option>
              {dietPlans.filter(p => p.isActive).map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({dietCategoryLabels[plan.category]})
                </option>
              ))}
            </select>
            {errors.dietPlanId && <p className="text-red-500 text-xs mt-1">{errors.dietPlanId.message as string}</p>}
          </div>

          {/* Feeding Method */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Feeding Method *</label>
            <select
              {...register('feedingMethod', { required: true })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              {feedingMethods.map(method => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Allergies (comma-separated)</label>
            <input
              {...register('allergies')}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="e.g., Peanuts, Shellfish, Dairy"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Start Date *</label>
              <input
                type="date"
                {...register('startDate', { required: true })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">End Date</label>
              <input
                type="date"
                {...register('endDate')}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Special Instructions</label>
            <textarea
              {...register('specialInstructions')}
              rows={2}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Any special dietary requirements or instructions"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium transition-all shadow-lg shadow-green-500/25 disabled:opacity-50"
            >
              {loading ? 'Assigning...' : 'Assign Diet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Consumption Recording Modal
function ConsumptionModal({
  order,
  onClose,
  onSuccess,
}: {
  order: MealOrder;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm({
    defaultValues: {
      consumptionPercentage: 100,
      consumptionNotes: '',
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      await dietaryApi.updateMealOrderStatus(order.id, 'CONSUMED');
      toast.success('Consumption recorded successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to record consumption');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 w-full max-w-md shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-300 to-transparent" />

        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Record Consumption</h2>
          <p className="text-sm text-gray-500">
            {order.patientDiet?.patient?.firstName} {order.patientDiet?.patient?.lastName} - {order.mealType}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Consumption Percentage</label>
            <input
              type="range"
              {...register('consumptionPercentage')}
              min="0"
              max="100"
              step="10"
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              {...register('consumptionNotes')}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Any observations about meal consumption"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium transition-all shadow-lg shadow-green-500/25 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Record Consumption'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main Dietary Management Page
export default function Dietary() {
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'plans' | 'patients' | 'orders' | 'ai'>('dashboard');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mealTypeFilter, setMealTypeFilter] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showDietPlanModal, setShowDietPlanModal] = useState(false);
  const [showAssignDietModal, setShowAssignDietModal] = useState(false);
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<DietPlan | undefined>(undefined);
  const [selectedOrder, setSelectedOrder] = useState<MealOrder | null>(null);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  // AI Insights State
  const [aiRecommendationForm, setAIRecommendationForm] = useState({
    dietCategory: '',
    allergies: '',
    conditions: '',
  });
  const [aiSuggestPlanForm, setAISuggestPlanForm] = useState({
    diagnosis: '',
    conditions: '',
    age: '',
    weight: '',
    height: '',
  });
  const [aiAnalyzeForm, setAIAnalyzeForm] = useState({
    patientId: '',
    startDate: '',
    endDate: '',
  });
  const [aiResults, setAIResults] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['dietary-stats'],
    queryFn: () => dietaryApi.getStats(),
    select: (res) => res.data.data || {
      todayOrders: { total: 0, pending: 0, preparing: 0, ready: 0, delivered: 0, consumed: 0 },
      activeDiets: 0,
      specialDiets: 0,
    },
  });

  // Fetch diet plans
  const { data: dietPlansData, isLoading: loadingPlans } = useQuery({
    queryKey: ['diet-plans', page, categoryFilter],
    queryFn: () => dietaryApi.getDietPlans({
      page,
      limit: 20,
      category: categoryFilter || undefined,
    }),
    select: (res) => ({
      plans: res.data.data?.dietPlans || res.data.data?.plans || [],
      pagination: res.data.data?.pagination || { totalPages: 1 },
    }),
  });

  // Fetch patient diets
  const { data: patientDietsData, isLoading: loadingPatientDiets } = useQuery({
    queryKey: ['patient-diets', page, statusFilter, search],
    queryFn: () => dietaryApi.getPatientDiets({
      page,
      limit: 20,
      status: statusFilter || undefined,
      patientId: search || undefined,
    }),
    select: (res) => ({
      diets: res.data.data?.patientDiets || res.data.data?.diets || [],
      pagination: res.data.data?.pagination || { totalPages: 1 },
    }),
    enabled: activeTab === 'patients',
  });

  // Fetch meal orders
  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['meal-orders', page, mealTypeFilter, statusFilter, wardFilter],
    queryFn: () => dietaryApi.getMealOrders({
      page,
      limit: 20,
      mealType: mealTypeFilter || undefined,
      status: statusFilter || undefined,
      ward: wardFilter || undefined,
    }),
    select: (res) => ({
      orders: res.data.data?.mealOrders || res.data.data?.orders || [],
      pagination: res.data.data?.pagination || { totalPages: 1 },
    }),
    enabled: activeTab === 'orders',
  });

  // Fetch wards
  const { data: wards = [] } = useQuery({
    queryKey: ['wards'],
    queryFn: () => ipdApi.getWards(),
    select: (res) => res.data.data?.wards || res.data.data || [],
  });

  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      dietaryApi.updateMealOrderStatus(id, status),
    onSuccess: () => {
      toast.success('Order status updated');
      queryClient.invalidateQueries({ queryKey: ['meal-orders'] });
      queryClient.invalidateQueries({ queryKey: ['dietary-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update status');
    },
  });

  // AI Functions
  const handleAIRecommendations = async () => {
    setLoadingAI(true);
    try {
      const response = await dietaryApi.getAIRecommendations({
        dietCategory: aiRecommendationForm.dietCategory || undefined,
        allergies: aiRecommendationForm.allergies ? aiRecommendationForm.allergies.split(',').map(a => a.trim()) : [],
        conditions: aiRecommendationForm.conditions ? aiRecommendationForm.conditions.split(',').map(c => c.trim()) : [],
      });
      setAIResults({ type: 'recommendations', data: response.data.data });
      toast.success('Recommendations generated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to get recommendations');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleAISuggestPlan = async () => {
    setLoadingAI(true);
    try {
      const response = await dietaryApi.suggestDietPlan({
        diagnosis: aiSuggestPlanForm.diagnosis,
        conditions: aiSuggestPlanForm.conditions ? aiSuggestPlanForm.conditions.split(',').map(c => c.trim()) : [],
        age: aiSuggestPlanForm.age ? parseInt(aiSuggestPlanForm.age) : undefined,
        weight: aiSuggestPlanForm.weight ? parseFloat(aiSuggestPlanForm.weight) : undefined,
        height: aiSuggestPlanForm.height ? parseFloat(aiSuggestPlanForm.height) : undefined,
      });
      setAIResults({ type: 'suggestion', data: response.data.data });
      toast.success('Diet plan suggestion generated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to get suggestion');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleAIAnalyzeIntake = async () => {
    if (!aiAnalyzeForm.patientId) {
      toast.error('Please enter a patient ID');
      return;
    }
    setLoadingAI(true);
    try {
      const response = await dietaryApi.analyzeNutritionIntake({
        patientId: aiAnalyzeForm.patientId,
        startDate: aiAnalyzeForm.startDate || undefined,
        endDate: aiAnalyzeForm.endDate || undefined,
      });
      setAIResults({ type: 'analysis', data: response.data.data });
      toast.success('Nutrition analysis complete');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to analyze intake');
    } finally {
      setLoadingAI(false);
    }
  };

  const dietPlans = dietPlansData?.plans || [];
  const patientDiets = patientDietsData?.diets || [];
  const mealOrders = ordersData?.orders || [];

  return (
    <div className="space-y-6">
      {/* Glassmorphism Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white/90 text-sm font-medium mb-3">
              <CakeIcon className="h-4 w-4" />
              Dietary Management
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-sm">Dietary Services</h1>
            <p className="mt-2 text-green-100">
              Manage diet plans, patient nutrition, and meal orders
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['dietary-stats'] })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl text-white font-medium transition-all"
            >
              <ArrowPathIcon className="h-5 w-5" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {[
          { label: "Today's Orders", value: stats?.todayOrders?.total || 0, icon: TruckIcon, gradient: 'from-blue-500 to-blue-600' },
          { label: 'Pending', value: stats?.todayOrders?.pending || 0, icon: ClockIcon, gradient: 'from-yellow-500 to-yellow-600' },
          { label: 'Preparing', value: stats?.todayOrders?.preparing || 0, icon: FireIcon, gradient: 'from-orange-500 to-orange-600' },
          { label: 'Delivered', value: stats?.todayOrders?.delivered || 0, icon: CheckCircleIcon, gradient: 'from-green-500 to-green-600' },
          { label: 'Active Diets', value: stats?.activeDiets || 0, icon: UserGroupIcon, gradient: 'from-purple-500 to-purple-600' },
          { label: 'Special Diets', value: stats?.specialDiets || 0, icon: HeartIcon, gradient: 'from-rose-500 to-rose-600' },
        ].map((stat, index) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={clsx('p-2 rounded-lg bg-gradient-to-br', stat.gradient)}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-2 shadow-lg">
        <nav className="flex space-x-2">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon },
            { id: 'plans', label: 'Diet Plans', icon: ClipboardDocumentListIcon },
            { id: 'patients', label: 'Patient Diets', icon: UserGroupIcon },
            { id: 'orders', label: 'Meal Orders', icon: TruckIcon },
            { id: 'ai', label: 'AI Insights', icon: SparklesIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as typeof activeTab);
                setPage(1);
                setStatusFilter('');
                setCategoryFilter('');
                setMealTypeFilter('');
              }}
              className={clsx(
                'relative flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all duration-300 flex items-center justify-center gap-2',
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Meal Summary by Type */}
          <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CakeIcon className="h-5 w-5 text-green-500" />
                Today's Meal Orders by Type
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {mealTypes.map((mealType) => (
                  <div
                    key={mealType}
                    className={clsx(
                      'p-4 rounded-xl border-2 transition-all hover:shadow-md',
                      mealType === 'BREAKFAST' ? 'border-yellow-200 bg-yellow-50' :
                      mealType === 'LUNCH' ? 'border-orange-200 bg-orange-50' :
                      mealType === 'DINNER' ? 'border-purple-200 bg-purple-50' :
                      'border-green-200 bg-green-50'
                    )}
                  >
                    <h4 className="font-semibold text-gray-900 capitalize">{mealType.toLowerCase()}</h4>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {mealOrders.filter((o: MealOrder) => o.mealType === mealType).length || 0}
                    </p>
                    <p className="text-sm text-gray-500">orders</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setShowAssignDietModal(true)}
              className="p-6 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 hover:border-green-300 transition-all hover:shadow-lg group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
                  <PlusIcon className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 group-hover:text-green-700">Assign Diet to Patient</h4>
                  <p className="text-sm text-gray-500">Create a new diet assignment with AI assistance</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setActiveTab('orders');
                setStatusFilter('PENDING');
              }}
              className="p-6 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 hover:border-yellow-300 transition-all hover:shadow-lg group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 text-white shadow-lg">
                  <ClockIcon className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 group-hover:text-yellow-700">View Pending Orders</h4>
                  <p className="text-sm text-gray-500">{stats?.todayOrders?.pending || 0} orders waiting to be prepared</p>
                </div>
              </div>
            </button>
          </div>

          {/* Recent Orders */}
          <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Recent Meal Orders</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {mealOrders.slice(0, 5).map((order: MealOrder) => (
                <div key={order.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.patientDiet?.patient?.firstName} {order.patientDiet?.patient?.lastName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {order.mealType} - {order.patientDiet?.dietPlan?.name}
                      </p>
                    </div>
                    <StatusBadge status={order.status} config={orderStatusConfig} />
                  </div>
                </div>
              ))}
              {mealOrders.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <TruckIcon className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                  <p>No meal orders for today</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diet Plans Tab */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {/* Filters & Actions */}
          <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search diet plans..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <FunnelIcon className="h-5 w-5 text-gray-400" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All Categories</option>
                  {dietCategories.map(cat => (
                    <option key={cat} value={cat}>{dietCategoryLabels[cat]}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setSelectedPlan(undefined);
                    setShowDietPlanModal(true);
                  }}
                  className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all flex items-center gap-2"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add Plan
                </button>
              </div>
            </div>
          </div>

          {/* Diet Plans List */}
          {loadingPlans ? (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-12 text-center shadow-lg">
              <ArrowPathIcon className="h-10 w-10 animate-spin mx-auto text-green-500" />
              <p className="mt-3 text-gray-600">Loading diet plans...</p>
            </div>
          ) : dietPlans.length === 0 ? (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-12 text-center shadow-lg">
              <ClipboardDocumentListIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">No diet plans found</p>
              <button
                onClick={() => setShowDietPlanModal(true)}
                className="mt-4 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium"
              >
                Create First Plan
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {dietPlans.map((plan: DietPlan) => (
                <div
                  key={plan.id}
                  className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg hover:shadow-xl transition-all"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-medium',
                            dietCategoryColors[plan.category] || 'bg-gray-100 text-gray-700'
                          )}>
                            {dietCategoryLabels[plan.category]}
                          </span>
                          {!plan.isActive && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              Inactive
                            </span>
                          )}
                        </div>
                        {plan.description && (
                          <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                        )}

                        {/* Nutritional Info */}
                        <div className="flex items-center gap-4 mt-3 flex-wrap">
                          {plan.targetCalories && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <FireIcon className="h-4 w-4 text-orange-500" />
                              {plan.targetCalories} kcal
                            </div>
                          )}
                          {plan.proteinGrams && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <BeakerIcon className="h-4 w-4 text-blue-500" />
                              {plan.proteinGrams}g protein
                            </div>
                          )}
                          {plan.carbsGrams && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <CakeIcon className="h-4 w-4 text-yellow-500" />
                              {plan.carbsGrams}g carbs
                            </div>
                          )}
                          {plan.fatGrams && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <ScaleIcon className="h-4 w-4 text-purple-500" />
                              {plan.fatGrams}g fat
                            </div>
                          )}
                        </div>

                        {/* Restrictions */}
                        {plan.restrictions && plan.restrictions.length > 0 && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                            {plan.restrictions.map((r, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedPlanId(expandedPlanId === plan.id ? null : plan.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          {expandedPlanId === plan.id ? (
                            <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPlan(plan);
                            setShowDietPlanModal(true);
                          }}
                          className="p-2 hover:bg-green-100 rounded-lg transition-colors text-green-600"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Meal Items */}
                    {expandedPlanId === plan.id && (
                      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Breakfast', items: plan.breakfastItems, color: 'yellow' },
                          { label: 'Lunch', items: plan.lunchItems, color: 'orange' },
                          { label: 'Dinner', items: plan.dinnerItems, color: 'purple' },
                          { label: 'Snacks', items: plan.snackItems, color: 'green' },
                        ].map((meal) => (
                          <div key={meal.label}>
                            <h4 className={`text-sm font-medium text-${meal.color}-700 mb-2`}>{meal.label}</h4>
                            {meal.items && meal.items.length > 0 ? (
                              <ul className="space-y-1">
                                {meal.items.map((item: string, idx: number) => (
                                  <li key={idx} className="text-sm text-gray-600 flex items-start gap-1">
                                    <span className="text-gray-400 mt-1">-</span>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-400">No items</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Patient Diets Tab */}
      {activeTab === 'patients' && (
        <div className="space-y-4">
          {/* Filters & Actions */}
          <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by patient ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <FunnelIcon className="h-5 w-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
                <button
                  onClick={() => setShowAssignDietModal(true)}
                  className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all flex items-center gap-2"
                >
                  <PlusIcon className="h-5 w-5" />
                  Assign Diet
                </button>
              </div>
            </div>
          </div>

          {/* Patient Diets List */}
          {loadingPatientDiets ? (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-12 text-center shadow-lg">
              <ArrowPathIcon className="h-10 w-10 animate-spin mx-auto text-green-500" />
              <p className="mt-3 text-gray-600">Loading patient diets...</p>
            </div>
          ) : patientDiets.length === 0 ? (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-12 text-center shadow-lg">
              <UserGroupIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">No patient diet assignments found</p>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Diet Plan</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Feeding</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Allergies</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Start Date</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {patientDiets.map((diet: PatientDiet) => (
                      <tr key={diet.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                              <UserIcon className="h-5 w-5 text-white" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {diet.patient?.firstName} {diet.patient?.lastName}
                              </div>
                              <div className="text-sm text-gray-500">MRN: {diet.patient?.mrn}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{diet.dietPlan?.name}</div>
                          <span className={clsx(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            dietCategoryColors[diet.dietPlan?.category] || 'bg-gray-100 text-gray-700'
                          )}>
                            {dietCategoryLabels[diet.dietPlan?.category] || diet.dietPlan?.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {diet.feedingMethod}
                        </td>
                        <td className="px-6 py-4">
                          {diet.allergies && diet.allergies.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {diet.allergies.map((a, idx) => (
                                <span key={idx} className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                                  {a}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {diet.startDate ? new Date(diet.startDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={diet.status} config={dietStatusConfig} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meal Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-4 shadow-lg">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <FunnelIcon className="h-5 w-5 text-gray-400" />
                <select
                  value={wardFilter}
                  onChange={(e) => setWardFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All Wards</option>
                  {wards.map((ward: Ward) => (
                    <option key={ward.id} value={ward.id}>{ward.name}</option>
                  ))}
                </select>
                <select
                  value={mealTypeFilter}
                  onChange={(e) => setMealTypeFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All Meals</option>
                  {mealTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-green-500"
                >
                  <option value="">All Status</option>
                  {Object.keys(orderStatusConfig).map(status => (
                    <option key={status} value={status}>{orderStatusConfig[status].label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          {loadingOrders ? (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-12 text-center shadow-lg">
              <ArrowPathIcon className="h-10 w-10 animate-spin mx-auto text-green-500" />
              <p className="mt-3 text-gray-600">Loading orders...</p>
            </div>
          ) : mealOrders.length === 0 ? (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 p-12 text-center shadow-lg">
              <TruckIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">No meal orders found</p>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Order #</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Bed/Ward</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Meal Type</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Diet</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Time</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {mealOrders.map((order: MealOrder) => (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">{order.orderNumber}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {order.patientDiet?.patient?.firstName} {order.patientDiet?.patient?.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            MRN: {order.patientDiet?.patient?.mrn}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {order.bedNumber || '-'} / {order.ward || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-medium',
                            order.mealType === 'BREAKFAST' ? 'bg-yellow-100 text-yellow-700' :
                            order.mealType === 'LUNCH' ? 'bg-orange-100 text-orange-700' :
                            order.mealType === 'DINNER' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          )}>
                            {order.mealType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {order.patientDiet?.dietPlan?.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {order.scheduledTime ? new Date(order.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge status={order.status} config={orderStatusConfig} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            {order.status === 'PENDING' && (
                              <button
                                onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: 'PREPARING' })}
                                className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                                title="Start Preparing"
                              >
                                <PlayIcon className="h-4 w-4" />
                              </button>
                            )}
                            {order.status === 'PREPARING' && (
                              <button
                                onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: 'READY' })}
                                className="p-1.5 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 transition-colors"
                                title="Mark Ready"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                              </button>
                            )}
                            {order.status === 'READY' && (
                              <button
                                onClick={() => updateOrderStatusMutation.mutate({ id: order.id, status: 'DELIVERED' })}
                                className="p-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                                title="Mark Delivered"
                              >
                                <TruckIcon className="h-4 w-4" />
                              </button>
                            )}
                            {order.status === 'DELIVERED' && (
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowConsumptionModal(true);
                                }}
                                className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                                title="Record Consumption"
                              >
                                <DocumentTextIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'ai' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Nutritional Recommendations */}
          <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-300 to-transparent" />
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <LightBulbIcon className="h-5 w-5 text-purple-500" />
                Nutritional Recommendations
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Diet Category</label>
                  <select
                    value={aiRecommendationForm.dietCategory}
                    onChange={(e) => setAIRecommendationForm({ ...aiRecommendationForm, dietCategory: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Any Category</option>
                    {dietCategories.map(cat => (
                      <option key={cat} value={cat}>{dietCategoryLabels[cat]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Allergies (comma-separated)</label>
                  <input
                    value={aiRecommendationForm.allergies}
                    onChange={(e) => setAIRecommendationForm({ ...aiRecommendationForm, allergies: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Peanuts, Shellfish"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Medical Conditions (comma-separated)</label>
                  <input
                    value={aiRecommendationForm.conditions}
                    onChange={(e) => setAIRecommendationForm({ ...aiRecommendationForm, conditions: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g., Diabetes, Hypertension"
                  />
                </div>
                <button
                  onClick={handleAIRecommendations}
                  disabled={loadingAI}
                  className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium hover:from-purple-600 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingAI ? (
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <SparklesIcon className="h-5 w-5" />
                  )}
                  Get Recommendations
                </button>
              </div>
            </div>
          </div>

          {/* AI Diet Plan Suggestion */}
          <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-300 to-transparent" />
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DocumentTextIcon className="h-5 w-5 text-blue-500" />
                Diet Plan Suggestion
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Diagnosis</label>
                  <input
                    value={aiSuggestPlanForm.diagnosis}
                    onChange={(e) => setAISuggestPlanForm({ ...aiSuggestPlanForm, diagnosis: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Type 2 Diabetes"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Conditions (comma-separated)</label>
                  <input
                    value={aiSuggestPlanForm.conditions}
                    onChange={(e) => setAISuggestPlanForm({ ...aiSuggestPlanForm, conditions: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Obesity, Hypertension"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Age</label>
                    <input
                      type="number"
                      value={aiSuggestPlanForm.age}
                      onChange={(e) => setAISuggestPlanForm({ ...aiSuggestPlanForm, age: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                      placeholder="45"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      value={aiSuggestPlanForm.weight}
                      onChange={(e) => setAISuggestPlanForm({ ...aiSuggestPlanForm, weight: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                      placeholder="70"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Height (cm)</label>
                    <input
                      type="number"
                      value={aiSuggestPlanForm.height}
                      onChange={(e) => setAISuggestPlanForm({ ...aiSuggestPlanForm, height: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500"
                      placeholder="170"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAISuggestPlan}
                  disabled={loadingAI || !aiSuggestPlanForm.diagnosis}
                  className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-medium hover:from-blue-600 hover:to-cyan-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingAI ? (
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <SparklesIcon className="h-5 w-5" />
                  )}
                  Suggest Diet Plan
                </button>
              </div>
            </div>
          </div>

          {/* AI Nutrition Intake Analysis */}
          <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-300 to-transparent" />
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ChartBarIcon className="h-5 w-5 text-green-500" />
                Nutrition Intake Analysis
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Patient ID</label>
                  <input
                    value={aiAnalyzeForm.patientId}
                    onChange={(e) => setAIAnalyzeForm({ ...aiAnalyzeForm, patientId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-500"
                    placeholder="Enter patient ID"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={aiAnalyzeForm.startDate}
                      onChange={(e) => setAIAnalyzeForm({ ...aiAnalyzeForm, startDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={aiAnalyzeForm.endDate}
                      onChange={(e) => setAIAnalyzeForm({ ...aiAnalyzeForm, endDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAIAnalyzeIntake}
                  disabled={loadingAI || !aiAnalyzeForm.patientId}
                  className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingAI ? (
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <SparklesIcon className="h-5 w-5" />
                  )}
                  Analyze Intake
                </button>
              </div>
            </div>
          </div>

          {/* AI Results Display */}
          {aiResults && (
            <div className="relative overflow-hidden rounded-xl backdrop-blur-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 shadow-lg">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-purple-600" />
                    AI Results
                  </h3>
                  <button
                    onClick={() => setAIResults(null)}
                    className="p-1 hover:bg-purple-100 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-purple-600" />
                  </button>
                </div>
                <div className="space-y-3">
                  {aiResults.type === 'recommendations' && aiResults.data && (
                    <>
                      {aiResults.data.recommendations?.map((rec: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-lg bg-white border border-purple-100">
                          <p className="text-sm text-purple-800">{rec}</p>
                        </div>
                      ))}
                      {aiResults.data.mealSuggestions && (
                        <div className="p-3 rounded-lg bg-white border border-purple-100">
                          <h4 className="font-medium text-purple-900 mb-2">Suggested Meals</h4>
                          <ul className="space-y-1 text-sm text-purple-700">
                            {aiResults.data.mealSuggestions.map((meal: string, idx: number) => (
                              <li key={idx}>- {meal}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                  {aiResults.type === 'suggestion' && aiResults.data && (
                    <>
                      <div className="p-3 rounded-lg bg-white border border-purple-100">
                        <p className="text-sm text-purple-600">Recommended Category</p>
                        <p className="font-semibold text-purple-900">
                          {dietCategoryLabels[aiResults.data.recommendedCategory] || aiResults.data.recommendedCategory}
                        </p>
                      </div>
                      {aiResults.data.rationale && (
                        <div className="p-3 rounded-lg bg-white border border-purple-100">
                          <p className="text-sm text-purple-600">Rationale</p>
                          <p className="text-sm text-purple-800">{aiResults.data.rationale}</p>
                        </div>
                      )}
                      {aiResults.data.nutritionalGoals && (
                        <div className="p-3 rounded-lg bg-white border border-purple-100">
                          <p className="text-sm text-purple-600 mb-2">Nutritional Goals</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>Calories: <span className="font-medium">{aiResults.data.nutritionalGoals.calories}</span></div>
                            <div>Protein: <span className="font-medium">{aiResults.data.nutritionalGoals.protein}g</span></div>
                            <div>Carbs: <span className="font-medium">{aiResults.data.nutritionalGoals.carbs}g</span></div>
                            <div>Fat: <span className="font-medium">{aiResults.data.nutritionalGoals.fat}g</span></div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {aiResults.type === 'analysis' && aiResults.data && (
                    <>
                      <div className="p-3 rounded-lg bg-white border border-purple-100">
                        <p className="text-sm text-purple-600">Analysis Summary</p>
                        <p className="text-sm text-purple-800">{aiResults.data.summary || 'Nutrition intake analysis complete.'}</p>
                      </div>
                      {aiResults.data.averageIntake && (
                        <div className="p-3 rounded-lg bg-white border border-purple-100">
                          <p className="text-sm text-purple-600 mb-2">Average Daily Intake</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>Calories: <span className="font-medium">{aiResults.data.averageIntake.calories}</span></div>
                            <div>Protein: <span className="font-medium">{aiResults.data.averageIntake.protein}g</span></div>
                            <div>Consumption Rate: <span className="font-medium">{aiResults.data.averageIntake.consumptionRate}%</span></div>
                          </div>
                        </div>
                      )}
                      {aiResults.data.recommendations?.length > 0 && (
                        <div className="p-3 rounded-lg bg-white border border-purple-100">
                          <p className="text-sm text-purple-600 mb-2">Recommendations</p>
                          <ul className="space-y-1 text-sm text-purple-700">
                            {aiResults.data.recommendations.map((rec: string, idx: number) => (
                              <li key={idx}>- {rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showDietPlanModal && (
        <DietPlanModal
          plan={selectedPlan}
          onClose={() => {
            setShowDietPlanModal(false);
            setSelectedPlan(undefined);
          }}
          onSuccess={() => {
            setShowDietPlanModal(false);
            setSelectedPlan(undefined);
            queryClient.invalidateQueries({ queryKey: ['diet-plans'] });
          }}
        />
      )}

      {showAssignDietModal && (
        <AssignDietModal
          onClose={() => setShowAssignDietModal(false)}
          onSuccess={() => {
            setShowAssignDietModal(false);
            queryClient.invalidateQueries({ queryKey: ['patient-diets'] });
            queryClient.invalidateQueries({ queryKey: ['dietary-stats'] });
          }}
          dietPlans={dietPlans}
        />
      )}

      {showConsumptionModal && selectedOrder && (
        <ConsumptionModal
          order={selectedOrder}
          onClose={() => {
            setShowConsumptionModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={() => {
            setShowConsumptionModal(false);
            setSelectedOrder(null);
            queryClient.invalidateQueries({ queryKey: ['meal-orders'] });
            queryClient.invalidateQueries({ queryKey: ['dietary-stats'] });
          }}
        />
      )}
    </div>
  );
}
