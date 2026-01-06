import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import {
  SparklesIcon,
  BeakerIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  LightBulbIcon,
  CalendarDaysIcon,
  UserIcon,
  ScaleIcon,
  FireIcon,
  HeartIcon,
  ClockIcon,
  InformationCircleIcon,
  XMarkIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { dietaryApi } from '../../services/api';

// Types
interface RecommendationsInput {
  dietCategory: string;
  allergies: string[];
  conditions: string[];
}

interface NutritionRecommendation {
  dailyCalories: number;
  macronutrients: {
    protein: number;
    carbohydrates: number;
    fat: number;
  };
  restrictions: string[];
  recommendations: string[];
  mealTimingAdvice: string[];
  hydrationGuidance: string;
  supplements?: string[];
}

interface DietPlanInput {
  diagnosis: string;
  chronicConditions: string[];
  allergies: string[];
  age: number;
  weight: number;
  height: number;
  activityLevel: string;
}

interface DietPlanSuggestion {
  suggestedCategory: string;
  alternativeCategories: string[];
  calorieTarget: number;
  calorieExplanation: string;
  specialConsiderations: string[];
  contraindications: string[];
}

interface IntakeAnalysisInput {
  patientId: string;
  startDate: string;
  endDate: string;
}

interface IntakeAnalysisResult {
  periodSummary: string;
  totalMeals: number;
  averageConsumptionPercentage: number;
  consumptionByMealType: {
    breakfast: number;
    lunch: number;
    dinner: number;
    snacks: number;
  };
  nutritionStatus: 'ADEQUATE' | 'SUBOPTIMAL' | 'POOR';
  alerts: string[];
  recommendations: string[];
}

// Constants
const DIET_CATEGORIES = [
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

const COMMON_ALLERGIES = ['Gluten', 'Dairy', 'Nuts', 'Eggs', 'Shellfish', 'Soy'];

const CHRONIC_CONDITIONS = [
  'Diabetes',
  'Hypertension',
  'Kidney Disease',
  'Heart Disease',
];

const ACTIVITY_LEVELS = ['Sedentary', 'Light', 'Moderate', 'Active'];

const STATUS_COLORS = {
  ADEQUATE: {
    bg: 'bg-emerald-500',
    bgLight: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500',
  },
  SUBOPTIMAL: {
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500',
  },
  POOR: {
    bg: 'bg-red-500',
    bgLight: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-500',
  },
};

// Helper components
function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  allowCustom = false,
}: {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  allowCustom?: boolean;
}) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleAdd = (value: string) => {
    if (value && !selected.includes(value)) {
      onChange([...selected, value]);
    }
    setInputValue('');
    setIsOpen(false);
  };

  const handleRemove = (value: string) => {
    onChange(selected.filter((v) => v !== value));
  };

  const filteredOptions = options.filter(
    (opt) =>
      !selected.includes(opt) &&
      opt.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 p-2 min-h-[42px] rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
        {selected.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg text-sm"
          >
            {item}
            <button
              type="button"
              onClick={() => handleRemove(item)}
              className="hover:text-blue-900 dark:hover:text-blue-100"
            >
              <XMarkIcon className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && inputValue && allowCustom) {
              e.preventDefault();
              handleAdd(inputValue);
            }
          }}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent border-none focus:outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400"
        />
      </div>
      {isOpen && (filteredOptions.length > 0 || (allowCustom && inputValue)) && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg max-h-48 overflow-auto">
          {filteredOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleAdd(option)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
            >
              {option}
            </button>
          ))}
          {allowCustom && inputValue && !options.includes(inputValue) && (
            <button
              type="button"
              onClick={() => handleAdd(inputValue)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              Add "{inputValue}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CalorieGauge({ value, max = 3000 }: { value: number; max?: number }) {
  const percentage = Math.min((value / max) * 100, 100);
  const rotation = (percentage / 100) * 180 - 90;

  return (
    <div className="relative w-48 h-24 mx-auto">
      {/* Background arc */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 100">
        <path
          d="M 10 100 A 90 90 0 0 1 190 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-slate-200 dark:text-slate-700"
        />
        <path
          d="M 10 100 A 90 90 0 0 1 190 100"
          fill="none"
          stroke="url(#calorieGradient)"
          strokeWidth="12"
          strokeDasharray={`${percentage * 2.82} 282`}
        />
        <defs>
          <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center needle */}
      <div
        className="absolute bottom-0 left-1/2 w-1 h-16 bg-slate-800 dark:bg-white rounded-full origin-bottom transition-transform duration-500"
        style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
      />
      {/* Value display */}
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">
        <span className="text-2xl font-bold text-slate-900 dark:text-white">
          {value}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">
          kcal
        </span>
      </div>
    </div>
  );
}

function MacroPieChart({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const total = protein + carbs + fat;
  const proteinPct = (protein / total) * 100;
  const carbsPct = (carbs / total) * 100;
  const fatPct = (fat / total) * 100;

  // SVG pie chart angles
  const proteinAngle = (proteinPct / 100) * 360;
  const carbsAngle = (carbsPct / 100) * 360;

  const getArcPath = (startAngle: number, endAngle: number, radius: number) => {
    const start = polarToCartesian(50, 50, radius, endAngle);
    const end = polarToCartesian(50, 50, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} L 50 50 Z`;
  };

  const polarToCartesian = (
    cx: number,
    cy: number,
    r: number,
    angle: number
  ) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-32 h-32">
        {/* Fat slice */}
        <path
          d={getArcPath(proteinAngle + carbsAngle, 360, 45)}
          fill="#f59e0b"
        />
        {/* Carbs slice */}
        <path
          d={getArcPath(proteinAngle, proteinAngle + carbsAngle, 45)}
          fill="#3b82f6"
        />
        {/* Protein slice */}
        <path d={getArcPath(0, proteinAngle, 45)} fill="#10b981" />
        {/* Center circle */}
        <circle
          cx="50"
          cy="50"
          r="25"
          fill="white"
          className="dark:fill-slate-800"
        />
      </svg>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Protein: {protein}g ({proteinPct.toFixed(0)}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Carbs: {carbs}g ({carbsPct.toFixed(0)}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            Fat: {fat}g ({fatPct.toFixed(0)}%)
          </span>
        </div>
      </div>
    </div>
  );
}

function ConsumptionBar({ label, value }: { label: string; value: number }) {
  const getBarColor = (pct: number) => {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className="font-medium text-slate-900 dark:text-white">
          {value}%
        </span>
      </div>
      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500',
            getBarColor(value)
          )}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function AINutritionAssistant() {
  const [activeTab, setActiveTab] = useState<
    'recommendations' | 'dietPlan' | 'analysis'
  >('recommendations');

  // Recommendations form
  const recommendationsForm = useForm<RecommendationsInput>({
    defaultValues: {
      dietCategory: 'REGULAR',
      allergies: [],
      conditions: [],
    },
  });

  // Diet plan form
  const dietPlanForm = useForm<DietPlanInput>({
    defaultValues: {
      diagnosis: '',
      chronicConditions: [],
      allergies: [],
      age: 45,
      weight: 70,
      height: 170,
      activityLevel: 'Moderate',
    },
  });

  // Intake analysis form
  const intakeAnalysisForm = useForm<IntakeAnalysisInput>({
    defaultValues: {
      patientId: '',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
    },
  });

  // Mutations
  const recommendationsMutation = useMutation({
    mutationFn: (data: RecommendationsInput) =>
      dietaryApi.getAIRecommendations(data),
  });

  const dietPlanMutation = useMutation({
    mutationFn: (data: DietPlanInput) => dietaryApi.suggestDietPlan(data),
  });

  const intakeAnalysisMutation = useMutation({
    mutationFn: (data: IntakeAnalysisInput) =>
      dietaryApi.analyzeNutritionIntake(data),
  });

  // Form handlers
  const onRecommendationsSubmit = (data: RecommendationsInput) => {
    recommendationsMutation.mutate(data);
  };

  const onDietPlanSubmit = (data: DietPlanInput) => {
    dietPlanMutation.mutate(data);
  };

  const onIntakeAnalysisSubmit = (data: IntakeAnalysisInput) => {
    intakeAnalysisMutation.mutate(data);
  };

  // Get results
  const recommendationsResult = recommendationsMutation.data?.data as
    | NutritionRecommendation
    | undefined;
  const dietPlanResult = dietPlanMutation.data?.data as
    | DietPlanSuggestion
    | undefined;
  const intakeResult = intakeAnalysisMutation.data?.data as
    | IntakeAnalysisResult
    | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <SparklesIcon className="h-7 w-7 text-emerald-500" />
            AI Nutrition Assistant
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            AI-powered nutritional guidance and diet planning for patients
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('recommendations')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all',
            activeTab === 'recommendations'
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
              : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-slate-600 dark:text-slate-300'
          )}
        >
          <LightBulbIcon className="h-5 w-5" />
          Nutritional Recommendations
        </button>
        <button
          onClick={() => setActiveTab('dietPlan')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all',
            activeTab === 'dietPlan'
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
              : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-slate-600 dark:text-slate-300'
          )}
        >
          <ClipboardDocumentListIcon className="h-5 w-5" />
          Diet Plan Suggestion
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all',
            activeTab === 'analysis'
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
              : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-slate-600 dark:text-slate-300'
          )}
        >
          <ChartBarIcon className="h-5 w-5" />
          Nutrition Intake Analysis
        </button>
      </div>

      {/* Nutritional Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <BeakerIcon className="h-5 w-5 text-emerald-500" />
              Patient Diet Parameters
            </h3>
            <form
              onSubmit={recommendationsForm.handleSubmit(onRecommendationsSubmit)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Diet Category *
                </label>
                <select
                  {...recommendationsForm.register('dietCategory')}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {DIET_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Allergies
                </label>
                <Controller
                  name="allergies"
                  control={recommendationsForm.control}
                  render={({ field }) => (
                    <MultiSelect
                      options={COMMON_ALLERGIES}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder="Select or type allergies..."
                      allowCustom
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Medical Conditions
                </label>
                <Controller
                  name="conditions"
                  control={recommendationsForm.control}
                  render={({ field }) => (
                    <MultiSelect
                      options={CHRONIC_CONDITIONS}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder="Select conditions..."
                    />
                  )}
                />
              </div>

              <button
                type="submit"
                disabled={recommendationsMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50"
              >
                {recommendationsMutation.isPending ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-5 w-5" />
                    Get Recommendations
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {recommendationsMutation.isError && (
              <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400">
                  Failed to generate recommendations. Please try again.
                </p>
              </div>
            )}

            {recommendationsResult && (
              <>
                {/* Daily Calories */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <FireIcon className="h-5 w-5 text-orange-500" />
                    Daily Calorie Target
                  </h3>
                  <CalorieGauge value={recommendationsResult.dailyCalories} />
                </div>

                {/* Macronutrients */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ScaleIcon className="h-5 w-5 text-blue-500" />
                    Macronutrient Distribution
                  </h3>
                  <MacroPieChart
                    protein={recommendationsResult.macronutrients.protein}
                    carbs={recommendationsResult.macronutrients.carbohydrates}
                    fat={recommendationsResult.macronutrients.fat}
                  />
                </div>

                {/* Restrictions */}
                {recommendationsResult.restrictions.length > 0 && (
                  <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                      Dietary Restrictions
                    </h3>
                    <div className="space-y-2">
                      {recommendationsResult.restrictions.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20"
                        >
                          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500" />
                    Recommendations
                  </h3>
                  <div className="space-y-2">
                    {recommendationsResult.recommendations.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20"
                      >
                        <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Meal Timing */}
                {recommendationsResult.mealTimingAdvice &&
                  recommendationsResult.mealTimingAdvice.length > 0 && (
                    <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <ClockIcon className="h-5 w-5 text-blue-500" />
                        Meal Timing Advice
                      </h3>
                      <div className="space-y-2">
                        {recommendationsResult.mealTimingAdvice.map(
                          (item, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20"
                            >
                              <ClockIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-slate-700 dark:text-slate-300">
                                {item}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Hydration */}
                {recommendationsResult.hydrationGuidance && (
                  <div className="rounded-2xl p-4 backdrop-blur-xl bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                    <div className="flex items-start gap-3">
                      <InformationCircleIcon className="h-5 w-5 text-cyan-600 dark:text-cyan-400 mt-0.5" />
                      <div>
                        <span className="font-medium text-cyan-700 dark:text-cyan-300">
                          Hydration Guidance:
                        </span>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                          {recommendationsResult.hydrationGuidance}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Supplements */}
                {recommendationsResult.supplements &&
                  recommendationsResult.supplements.length > 0 && (
                    <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <BeakerIcon className="h-5 w-5 text-purple-500" />
                        Supplements
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {recommendationsResult.supplements.map((item, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}

            {!recommendationsResult && !recommendationsMutation.isPending && (
              <div className="rounded-2xl p-8 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg text-center">
                <LightBulbIcon className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">
                  Select diet parameters and click "Get Recommendations" to
                  receive AI-powered nutritional guidance.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Diet Plan Suggestion Tab */}
      {activeTab === 'dietPlan' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-blue-500" />
              Patient Information
            </h3>
            <form
              onSubmit={dietPlanForm.handleSubmit(onDietPlanSubmit)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Diagnosis (comma-separated)
                </label>
                <input
                  type="text"
                  {...dietPlanForm.register('diagnosis')}
                  placeholder="e.g., Type 2 Diabetes, Hypertension"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chronic Conditions
                </label>
                <Controller
                  name="chronicConditions"
                  control={dietPlanForm.control}
                  render={({ field }) => (
                    <MultiSelect
                      options={CHRONIC_CONDITIONS}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder="Select conditions..."
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Allergies
                </label>
                <Controller
                  name="allergies"
                  control={dietPlanForm.control}
                  render={({ field }) => (
                    <MultiSelect
                      options={COMMON_ALLERGIES}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder="Select allergies..."
                      allowCustom
                    />
                  )}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Age (years)
                  </label>
                  <input
                    type="number"
                    {...dietPlanForm.register('age', { valueAsNumber: true })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    {...dietPlanForm.register('weight', { valueAsNumber: true })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    {...dietPlanForm.register('height', { valueAsNumber: true })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Activity Level
                </label>
                <select
                  {...dietPlanForm.register('activityLevel')}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {ACTIVITY_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={dietPlanMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50"
              >
                {dietPlanMutation.isPending ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ClipboardDocumentListIcon className="h-5 w-5" />
                    Suggest Diet Plan
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {dietPlanMutation.isError && (
              <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400">
                  Failed to generate diet plan suggestion. Please try again.
                </p>
              </div>
            )}

            {dietPlanResult && (
              <>
                {/* Suggested Category */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ClipboardDocumentListIcon className="h-5 w-5 text-blue-500" />
                    Suggested Diet Category
                  </h3>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl text-lg">
                      {dietPlanResult.suggestedCategory}
                    </span>
                  </div>
                  {dietPlanResult.alternativeCategories &&
                    dietPlanResult.alternativeCategories.length > 0 && (
                      <div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                          Alternative options:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {dietPlanResult.alternativeCategories.map(
                            (cat, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm"
                              >
                                {cat}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </div>

                {/* Calorie Target */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <FireIcon className="h-5 w-5 text-orange-500" />
                    Calorie Target
                  </h3>
                  <div className="text-center mb-4">
                    <span className="text-4xl font-bold text-slate-900 dark:text-white">
                      {dietPlanResult.calorieTarget}
                    </span>
                    <span className="text-lg text-slate-500 dark:text-slate-400 ml-2">
                      kcal/day
                    </span>
                  </div>
                  {dietPlanResult.calorieExplanation && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {dietPlanResult.calorieExplanation}
                      </p>
                    </div>
                  )}
                </div>

                {/* Special Considerations */}
                {dietPlanResult.specialConsiderations &&
                  dietPlanResult.specialConsiderations.length > 0 && (
                    <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <LightBulbIcon className="h-5 w-5 text-emerald-500" />
                        Special Considerations
                      </h3>
                      <div className="space-y-2">
                        {dietPlanResult.specialConsiderations.map(
                          (item, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20"
                            >
                              <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-slate-700 dark:text-slate-300">
                                {item}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                {/* Contraindications */}
                {dietPlanResult.contraindications &&
                  dietPlanResult.contraindications.length > 0 && (
                    <div className="rounded-2xl p-6 backdrop-blur-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 shadow-lg">
                      <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-4 flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-5 w-5" />
                        Contraindications
                      </h3>
                      <div className="space-y-2">
                        {dietPlanResult.contraindications.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 rounded-lg bg-white/50 dark:bg-slate-800/50"
                          >
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-red-700 dark:text-red-300">
                              {item}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}

            {!dietPlanResult && !dietPlanMutation.isPending && (
              <div className="rounded-2xl p-8 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg text-center">
                <ClipboardDocumentListIcon className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">
                  Enter patient information and click "Suggest Diet Plan" to get
                  AI-powered diet recommendations.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Nutrition Intake Analysis Tab */}
      {activeTab === 'analysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Form */}
          <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <CalendarDaysIcon className="h-5 w-5 text-purple-500" />
              Analysis Parameters
            </h3>
            <form
              onSubmit={intakeAnalysisForm.handleSubmit(onIntakeAnalysisSubmit)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Patient ID *
                </label>
                <input
                  type="text"
                  {...intakeAnalysisForm.register('patientId', {
                    required: true,
                  })}
                  placeholder="Enter patient ID or search..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    {...intakeAnalysisForm.register('startDate', {
                      required: true,
                    })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    {...intakeAnalysisForm.register('endDate', {
                      required: true,
                    })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={intakeAnalysisMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50"
              >
                {intakeAnalysisMutation.isPending ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ChartBarIcon className="h-5 w-5" />
                    Analyze Intake
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {intakeAnalysisMutation.isError && (
              <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400">
                  Failed to analyze nutrition intake. Please try again.
                </p>
              </div>
            )}

            {intakeResult && (
              <>
                {/* Period Summary */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <CalendarDaysIcon className="h-5 w-5 text-purple-500" />
                    Period Summary
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    {intakeResult.periodSummary}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Total Meals
                      </p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {intakeResult.totalMeals}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Nutrition Status
                      </p>
                      <span
                        className={clsx(
                          'inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold mt-1',
                          STATUS_COLORS[intakeResult.nutritionStatus].bgLight,
                          STATUS_COLORS[intakeResult.nutritionStatus].text
                        )}
                      >
                        {intakeResult.nutritionStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Average Consumption */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <HeartIcon className="h-5 w-5 text-pink-500" />
                    Average Consumption
                  </h3>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        Overall Consumption
                      </span>
                      <span className="text-2xl font-bold text-slate-900 dark:text-white">
                        {intakeResult.averageConsumptionPercentage}%
                      </span>
                    </div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={clsx(
                          'h-full rounded-full transition-all duration-500',
                          intakeResult.averageConsumptionPercentage >= 80
                            ? 'bg-emerald-500'
                            : intakeResult.averageConsumptionPercentage >= 60
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        )}
                        style={{
                          width: `${Math.min(
                            intakeResult.averageConsumptionPercentage,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Consumption by Meal Type */}
                <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ChartBarIcon className="h-5 w-5 text-blue-500" />
                    Consumption by Meal Type
                  </h3>
                  <div className="space-y-4">
                    <ConsumptionBar
                      label="Breakfast"
                      value={intakeResult.consumptionByMealType.breakfast}
                    />
                    <ConsumptionBar
                      label="Lunch"
                      value={intakeResult.consumptionByMealType.lunch}
                    />
                    <ConsumptionBar
                      label="Dinner"
                      value={intakeResult.consumptionByMealType.dinner}
                    />
                    <ConsumptionBar
                      label="Snacks"
                      value={intakeResult.consumptionByMealType.snacks}
                    />
                  </div>
                </div>

                {/* Alerts */}
                {intakeResult.alerts && intakeResult.alerts.length > 0 && (
                  <div className="rounded-2xl p-6 backdrop-blur-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 shadow-lg">
                    <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400 mb-4 flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-5 w-5" />
                      Alerts
                    </h3>
                    <div className="space-y-2">
                      {intakeResult.alerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-lg bg-white/50 dark:bg-slate-800/50"
                        >
                          <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-slate-700 dark:text-slate-300">
                            {alert}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {intakeResult.recommendations &&
                  intakeResult.recommendations.length > 0 && (
                    <div className="rounded-2xl p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <LightBulbIcon className="h-5 w-5 text-emerald-500" />
                        Recommendations
                      </h3>
                      <div className="space-y-2">
                        {intakeResult.recommendations.map((rec, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20"
                          >
                            <CheckCircleIcon className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-slate-700 dark:text-slate-300">
                              {rec}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </>
            )}

            {!intakeResult && !intakeAnalysisMutation.isPending && (
              <div className="rounded-2xl p-8 backdrop-blur-xl bg-white/70 dark:bg-slate-800/70 border border-white/50 dark:border-white/10 shadow-lg text-center">
                <ChartBarIcon className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">
                  Enter a patient ID and date range, then click "Analyze Intake"
                  to get nutrition intake analysis.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
