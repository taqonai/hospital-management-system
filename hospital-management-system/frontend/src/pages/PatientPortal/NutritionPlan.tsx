import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import {
  FireIcon,
  BeakerIcon,
  SparklesIcon,
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
  CalendarIcon,
  ChartPieIcon,
} from '@heroicons/react/24/outline';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface NutritionLog {
  id: string;
  mealType: string;
  foodItems: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sodium: number | null;
  sugar: number | null;
  notes: string | null;
  loggedAt: string;
}

interface NutritionSummary {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  avgCalories: number;
  dailyGoal: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  macroDistribution: {
    protein: number;
    carbs: number;
    fat: number;
  };
  weeklyData: {
    day: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }[];
}

interface NutritionPlan {
  id: string;
  planName: string;
  planType: string;
  dailyCalorieTarget: number;
  macroTargets: {
    protein: number;
    carbs: number;
    fat: number;
  };
  dietaryRestrictions: string[];
  allergies: string[];
  mealPlan: {
    day: string;
    meals: {
      type: string;
      name: string;
      calories: number;
      foods: string[];
    }[];
  }[];
  startDate: string;
  endDate: string | null;
  isActive: boolean;
}

const MEAL_TYPES = [
  { id: 'BREAKFAST', name: 'Breakfast', icon: '🌅', color: 'bg-yellow-100 text-yellow-700' },
  { id: 'LUNCH', name: 'Lunch', icon: '☀️', color: 'bg-orange-100 text-orange-700' },
  { id: 'DINNER', name: 'Dinner', icon: '🌙', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'SNACK', name: 'Snack', icon: '🍎', color: 'bg-green-100 text-green-700' },
  { id: 'DRINK', name: 'Drink', icon: '🥤', color: 'bg-blue-100 text-blue-700' },
];

const DIET_TYPES = [
  { id: 'BALANCED', name: 'Balanced', description: 'Well-rounded nutrition' },
  { id: 'LOW_CARB', name: 'Low Carb', description: 'Reduced carbohydrate intake' },
  { id: 'HIGH_PROTEIN', name: 'High Protein', description: 'Muscle building focus' },
  { id: 'KETO', name: 'Keto', description: 'Very low carb, high fat' },
  { id: 'VEGETARIAN', name: 'Vegetarian', description: 'Plant-based with dairy/eggs' },
  { id: 'VEGAN', name: 'Vegan', description: 'Fully plant-based' },
  { id: 'MEDITERRANEAN', name: 'Mediterranean', description: 'Heart-healthy eating' },
  { id: 'DIABETIC_FRIENDLY', name: 'Diabetic Friendly', description: 'Blood sugar management' },
];

const COMMON_FOODS = [
  { name: 'Chicken Breast (100g)', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Brown Rice (100g)', calories: 111, protein: 2.6, carbs: 23, fat: 0.9 },
  { name: 'Salmon (100g)', calories: 208, protein: 20, carbs: 0, fat: 13 },
  { name: 'Egg (1 large)', calories: 78, protein: 6, carbs: 0.6, fat: 5 },
  { name: 'Banana (medium)', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: 'Greek Yogurt (100g)', calories: 59, protein: 10, carbs: 3.6, fat: 0.7 },
  { name: 'Avocado (half)', calories: 160, protein: 2, carbs: 9, fat: 15 },
  { name: 'Oatmeal (100g)', calories: 68, protein: 2.5, carbs: 12, fat: 1.4 },
];

export default function NutritionPlanPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'log' | 'plan' | 'ai'>('log');
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [showAIPlanModal, setShowAIPlanModal] = useState(false);
  const [dateRange, setDateRange] = useState('7d');
  const [mealForm, setMealForm] = useState({
    mealType: 'LUNCH',
    foodItems: [] as string[],
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    notes: '',
  });
  const [customFood, setCustomFood] = useState('');
  const [aiPlanForm, setAiPlanForm] = useState({
    dietType: 'BALANCED',
    dailyCalories: 2000,
    restrictions: [] as string[],
    allergies: [] as string[],
    goals: 'weight_maintenance',
  });

  // Fetch nutrition logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['nutrition-logs', dateRange],
    queryFn: async () => {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const response = await api.get('/wellness/nutrition/logs', {
        params: {
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
      });
      return response.data;
    },
  });

  // Fetch nutrition summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['nutrition-summary', dateRange],
    queryFn: async () => {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const response = await api.get('/wellness/nutrition/summary', {
        params: { days },
      });
      return response.data;
    },
  });

  // Fetch active nutrition plan
  const { data: planData, isLoading: planLoading } = useQuery({
    queryKey: ['nutrition-plan-active'],
    queryFn: async () => {
      const response = await api.get('/wellness/nutrition/plans/active');
      return response.data;
    },
  });

  // AI meal plan generation
  const generateAIPlanMutation = useMutation({
    mutationFn: async (data: typeof aiPlanForm) => {
      const response = await api.post('/wellness/ai/meal-plan', {
        dietaryPreferences: data.dietType,
        dailyCalorieTarget: data.dailyCalories,
        restrictions: data.restrictions,
        allergies: data.allergies,
        healthGoals: data.goals,
        daysToGenerate: 7,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-plan-active'] });
      setShowAIPlanModal(false);
    },
  });

  // Add meal mutation
  const addMealMutation = useMutation({
    mutationFn: async (data: typeof mealForm) => {
      const response = await api.post('/wellness/nutrition/logs', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-logs'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition-summary'] });
      setShowAddMealModal(false);
      setMealForm({
        mealType: 'LUNCH',
        foodItems: [],
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        notes: '',
      });
    },
  });

  // Delete meal mutation
  const deleteMealMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/wellness/nutrition/logs/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-logs'] });
      queryClient.invalidateQueries({ queryKey: ['nutrition-summary'] });
    },
  });

  const logs: NutritionLog[] = logsData?.logs || [];
  const summary: NutritionSummary = summaryData?.summary || {
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFiber: 0,
    avgCalories: 0,
    dailyGoal: { calories: 2000, protein: 150, carbs: 250, fat: 65 },
    macroDistribution: { protein: 33, carbs: 33, fat: 34 },
    weeklyData: [],
  };
  const activePlan: NutritionPlan | null = planData?.plan || null;

  // Macro distribution chart
  const macroChartData = {
    labels: ['Protein', 'Carbs', 'Fat'],
    datasets: [
      {
        data: [
          summary.macroDistribution?.protein || 0,
          summary.macroDistribution?.carbs || 0,
          summary.macroDistribution?.fat || 0,
        ],
        backgroundColor: ['#3B82F6', '#10B981', '#F59E0B'],
        borderWidth: 0,
      },
    ],
  };

  // Weekly calories chart
  const weeklyChartData = {
    labels: summary.weeklyData?.map((d) => d.day) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Calories',
        data: summary.weeklyData?.map((d) => d.calories) || [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 6,
      },
    ],
  };

  // Add food to meal
  const addFoodToMeal = (food: typeof COMMON_FOODS[0]) => {
    setMealForm({
      ...mealForm,
      foodItems: [...mealForm.foodItems, food.name],
      calories: mealForm.calories + food.calories,
      protein: mealForm.protein + food.protein,
      carbs: mealForm.carbs + food.carbs,
      fat: mealForm.fat + food.fat,
    });
  };

  // Add custom food
  const addCustomFood = () => {
    if (customFood.trim()) {
      setMealForm({
        ...mealForm,
        foodItems: [...mealForm.foodItems, customFood.trim()],
      });
      setCustomFood('');
    }
  };

  // Today's progress
  const todayLogs = logs.filter(
    (log) => new Date(log.loggedAt).toDateString() === new Date().toDateString()
  );
  const todayCalories = todayLogs.reduce((sum, log) => sum + log.calories, 0);
  const todayProtein = todayLogs.reduce((sum, log) => sum + log.protein, 0);
  const todayCarbs = todayLogs.reduce((sum, log) => sum + log.carbs, 0);
  const todayFat = todayLogs.reduce((sum, log) => sum + log.fat, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nutrition & Diet</h1>
          <p className="text-gray-600">Track your meals and follow AI-powered diet plans</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAIPlanModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition-colors flex items-center gap-2"
          >
            <SparklesIcon className="w-5 h-5" />
            AI Meal Plan
          </button>
          <button
            onClick={() => setShowAddMealModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Log Meal
          </button>
        </div>
      </div>

      {/* Today's Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Today's Progress</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="relative inline-block">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="#3B82F6"
                  strokeWidth="8"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(todayCalories / summary.dailyGoal.calories) * 251.2} 251.2`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{todayCalories}</span>
                <span className="text-xs text-gray-500">cal</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">Calories</p>
            <p className="text-xs text-gray-400">Goal: {summary.dailyGoal.calories}</p>
          </div>
          <MacroProgress
            label="Protein"
            current={todayProtein}
            goal={summary.dailyGoal.protein}
            unit="g"
            color="bg-blue-500"
          />
          <MacroProgress
            label="Carbs"
            current={todayCarbs}
            goal={summary.dailyGoal.carbs}
            unit="g"
            color="bg-green-500"
          />
          <MacroProgress
            label="Fat"
            current={todayFat}
            goal={summary.dailyGoal.fat}
            unit="g"
            color="bg-yellow-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('log')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'log'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Food Log
        </button>
        <button
          onClick={() => setActiveTab('plan')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'plan'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Meal Plan
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'ai'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Analytics
        </button>
      </div>

      {/* Food Log Tab */}
      {activeTab === 'log' && (
        <div className="space-y-6">
          {/* Today's Meals */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Today's Meals</h2>
            {todayLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No meals logged today</p>
                <p className="text-sm">Start tracking your nutrition!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayLogs.map((log) => {
                  const mealType = MEAL_TYPES.find((t) => t.id === log.mealType);
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{mealType?.icon || '🍽️'}</span>
                        <div>
                          <h3 className="font-medium">{mealType?.name || log.mealType}</h3>
                          <p className="text-sm text-gray-500">{log.foodItems.join(', ')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-bold text-orange-600">{log.calories} cal</p>
                          <p className="text-xs text-gray-500">
                            P: {log.protein}g | C: {log.carbs}g | F: {log.fat}g
                          </p>
                        </div>
                        <button
                          onClick={() => deleteMealMutation.mutate(log.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Meals */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Meals</h2>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.slice(0, 20).map((log) => {
                  const mealType = MEAL_TYPES.find((t) => t.id === log.mealType);
                  return (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <span>{mealType?.icon || '🍽️'}</span>
                        <div>
                          <span className="font-medium">{mealType?.name}</span>
                          <span className="text-sm text-gray-500 ml-2">
                            {new Date(log.loggedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-medium">{log.calories} cal</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meal Plan Tab */}
      {activeTab === 'plan' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Active Meal Plan</h2>
          {planLoading ? (
            <div className="flex justify-center py-8">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : activePlan ? (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{activePlan.planName}</h3>
                    <p className="text-sm text-gray-600">{activePlan.planType}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">
                      {activePlan.dailyCalorieTarget} cal/day
                    </p>
                    <p className="text-xs text-gray-500">
                      P: {activePlan.macroTargets?.protein}g | C: {activePlan.macroTargets?.carbs}g | F:{' '}
                      {activePlan.macroTargets?.fat}g
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {activePlan.mealPlan?.map((dayPlan, idx) => (
                  <div key={idx} className="border border-gray-100 rounded-lg p-4">
                    <h4 className="font-medium text-blue-600 mb-3">{dayPlan.day}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {dayPlan.meals?.map((meal, mealIdx) => (
                        <div key={mealIdx} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{meal.type}</span>
                            <span className="text-xs text-orange-600">{meal.calories} cal</span>
                          </div>
                          <p className="text-sm text-gray-700">{meal.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{meal.foods?.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <SparklesIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No active meal plan</p>
              <p className="text-sm mb-4">Generate an AI-powered meal plan to get started</p>
              <button
                onClick={() => setShowAIPlanModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition-colors inline-flex items-center gap-2"
              >
                <SparklesIcon className="w-5 h-5" />
                Generate AI Meal Plan
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'ai' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Macro Distribution */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Macro Distribution</h2>
            <div className="h-64 flex items-center justify-center">
              <Doughnut
                data={macroChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'bottom' as const },
                  },
                }}
              />
            </div>
          </div>

          {/* Weekly Calories */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Weekly Calorie Intake</h2>
            <div className="h-64">
              <Bar
                data={weeklyChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                }}
              />
            </div>
          </div>

          {/* Summary Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Nutrition Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-orange-600">
                  {summary.avgCalories.toFixed(0)}
                </p>
                <p className="text-sm text-gray-600">Avg Daily Calories</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">
                  {summary.totalProtein.toFixed(0)}g
                </p>
                <p className="text-sm text-gray-600">Total Protein</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">
                  {summary.totalCarbs.toFixed(0)}g
                </p>
                <p className="text-sm text-gray-600">Total Carbs</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{summary.totalFat.toFixed(0)}g</p>
                <p className="text-sm text-gray-600">Total Fat</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">
                  {summary.totalFiber.toFixed(0)}g
                </p>
                <p className="text-sm text-gray-600">Total Fiber</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Meal Modal */}
      {showAddMealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Log Meal</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Meal Type</label>
                <div className="flex gap-2 flex-wrap">
                  {MEAL_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setMealForm({ ...mealForm, mealType: type.id })}
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                        mealForm.mealType === type.id
                          ? 'ring-2 ring-blue-500 bg-blue-50'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <span>{type.icon}</span>
                      <span>{type.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick Add Foods</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {COMMON_FOODS.map((food) => (
                    <button
                      key={food.name}
                      onClick={() => addFoodToMeal(food)}
                      className="p-2 text-left bg-gray-50 rounded-lg hover:bg-gray-100 text-sm"
                    >
                      <span className="font-medium">{food.name}</span>
                      <span className="text-gray-500 ml-1">({food.calories} cal)</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Food Item
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customFood}
                    onChange={(e) => setCustomFood(e.target.value)}
                    placeholder="Enter food item..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={addCustomFood}
                    className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>
              </div>

              {mealForm.foodItems.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selected Foods
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {mealForm.foodItems.map((item, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-1"
                      >
                        {item}
                        <button
                          onClick={() =>
                            setMealForm({
                              ...mealForm,
                              foodItems: mealForm.foodItems.filter((_, i) => i !== idx),
                            })
                          }
                          className="ml-1 hover:text-red-500"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calories</label>
                  <input
                    type="number"
                    value={mealForm.calories}
                    onChange={(e) =>
                      setMealForm({ ...mealForm, calories: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Protein (g)</label>
                  <input
                    type="number"
                    value={mealForm.protein}
                    onChange={(e) => setMealForm({ ...mealForm, protein: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
                  <input
                    type="number"
                    value={mealForm.carbs}
                    onChange={(e) => setMealForm({ ...mealForm, carbs: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fat (g)</label>
                  <input
                    type="number"
                    value={mealForm.fat}
                    onChange={(e) => setMealForm({ ...mealForm, fat: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={mealForm.notes}
                  onChange={(e) => setMealForm({ ...mealForm, notes: e.target.value })}
                  placeholder="Any notes about this meal..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddMealModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => addMealMutation.mutate(mealForm)}
                disabled={addMealMutation.isPending || mealForm.foodItems.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {addMealMutation.isPending ? 'Saving...' : 'Log Meal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Meal Plan Modal */}
      {showAIPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold">Generate AI Meal Plan</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Diet Type</label>
                <select
                  value={aiPlanForm.dietType}
                  onChange={(e) => setAiPlanForm({ ...aiPlanForm, dietType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {DIET_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Daily Calorie Target
                </label>
                <input
                  type="number"
                  value={aiPlanForm.dailyCalories}
                  onChange={(e) =>
                    setAiPlanForm({ ...aiPlanForm, dailyCalories: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min={1000}
                  max={5000}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Health Goal</label>
                <select
                  value={aiPlanForm.goals}
                  onChange={(e) => setAiPlanForm({ ...aiPlanForm, goals: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="weight_loss">Weight Loss</option>
                  <option value="weight_maintenance">Weight Maintenance</option>
                  <option value="muscle_gain">Muscle Gain</option>
                  <option value="improve_health">Improve Overall Health</option>
                  <option value="manage_diabetes">Manage Diabetes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dietary Restrictions
                </label>
                <div className="flex flex-wrap gap-2">
                  {['gluten_free', 'dairy_free', 'nut_free', 'halal', 'kosher'].map((r) => (
                    <button
                      key={r}
                      onClick={() =>
                        setAiPlanForm({
                          ...aiPlanForm,
                          restrictions: aiPlanForm.restrictions.includes(r)
                            ? aiPlanForm.restrictions.filter((x) => x !== r)
                            : [...aiPlanForm.restrictions, r],
                        })
                      }
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        aiPlanForm.restrictions.includes(r)
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {r.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAIPlanModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => generateAIPlanMutation.mutate(aiPlanForm)}
                disabled={generateAIPlanMutation.isPending}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 disabled:opacity-50 flex items-center gap-2"
              >
                {generateAIPlanMutation.isPending ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5" />
                    Generate Plan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Macro Progress Component
function MacroProgress({
  label,
  current,
  goal,
  unit,
  color,
}: {
  label: string;
  current: number;
  goal: number;
  unit: string;
  color: string;
}) {
  const progress = Math.min((current / goal) * 100, 100);
  return (
    <div className="text-center">
      <p className="text-2xl font-bold">
        {current}
        <span className="text-sm text-gray-500">{unit}</span>
      </p>
      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-sm text-gray-600 mt-1">{label}</p>
      <p className="text-xs text-gray-400">
        Goal: {goal}
        {unit}
      </p>
    </div>
  );
}
