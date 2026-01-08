import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import {
  FireIcon,
  ClockIcon,
  ChartBarIcon,
  PlusIcon,
  TrashIcon,
  TrophyIcon,
  ArrowPathIcon,
  CalendarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Bar, Doughnut } from 'react-chartjs-2';
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

interface FitnessActivity {
  id: string;
  activityType: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  intensity: string;
  caloriesBurned: number | null;
  distanceKm: number | null;
  notes: string | null;
  source: string;
}

interface FitnessGoal {
  id: string;
  goalType: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  frequency: string;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  progress: number;
}

interface FitnessStats {
  totalWorkouts: number;
  totalDuration: number;
  totalCalories: number;
  avgDuration: number;
  streak: number;
  topActivity: string;
  weeklyProgress: { day: string; minutes: number; calories: number }[];
}

const ACTIVITY_TYPES = [
  { id: 'WALKING', name: 'Walking', icon: '🚶', color: 'bg-green-100 text-green-700' },
  { id: 'RUNNING', name: 'Running', icon: '🏃', color: 'bg-orange-100 text-orange-700' },
  { id: 'CYCLING', name: 'Cycling', icon: '🚴', color: 'bg-blue-100 text-blue-700' },
  { id: 'SWIMMING', name: 'Swimming', icon: '🏊', color: 'bg-cyan-100 text-cyan-700' },
  { id: 'YOGA', name: 'Yoga', icon: '🧘', color: 'bg-purple-100 text-purple-700' },
  { id: 'PILATES', name: 'Pilates', icon: '🤸', color: 'bg-pink-100 text-pink-700' },
  { id: 'WEIGHT_TRAINING', name: 'Weight Training', icon: '🏋️', color: 'bg-gray-100 text-gray-700' },
  { id: 'HIIT', name: 'HIIT', icon: '⚡', color: 'bg-red-100 text-red-700' },
  { id: 'MEDITATION', name: 'Meditation', icon: '🧠', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'DANCE', name: 'Dance', icon: '💃', color: 'bg-rose-100 text-rose-700' },
  { id: 'BASKETBALL', name: 'Basketball', icon: '🏀', color: 'bg-amber-100 text-amber-700' },
  { id: 'TENNIS', name: 'Tennis', icon: '🎾', color: 'bg-lime-100 text-lime-700' },
  { id: 'MARTIAL_ARTS', name: 'Martial Arts', icon: '🥋', color: 'bg-slate-100 text-slate-700' },
  { id: 'STRETCHING', name: 'Stretching', icon: '🙆', color: 'bg-teal-100 text-teal-700' },
  { id: 'OTHER', name: 'Other', icon: '🎯', color: 'bg-gray-100 text-gray-700' },
];

const INTENSITIES = [
  { id: 'LOW', name: 'Low', description: 'Light effort, can easily talk' },
  { id: 'MODERATE', name: 'Moderate', description: 'Noticeable effort, can talk in short sentences' },
  { id: 'HIGH', name: 'High', description: 'Hard effort, difficult to talk' },
  { id: 'VERY_HIGH', name: 'Very High', description: 'Maximum effort' },
];

export default function FitnessTracker() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [dateRange, setDateRange] = useState('7d');
  const [activityForm, setActivityForm] = useState({
    activityType: 'WALKING',
    durationMinutes: 30,
    intensity: 'MODERATE',
    caloriesBurned: '',
    distanceKm: '',
    notes: '',
  });
  const [goalForm, setGoalForm] = useState({
    goalType: 'WEEKLY_WORKOUT_MINUTES',
    targetValue: 150,
    frequency: 'WEEKLY',
  });

  // Fetch activities
  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ['fitness-activities', dateRange],
    queryFn: async () => {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const response = await api.get('/wellness/fitness/activities', {
        params: {
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString(),
        },
      });
      return response.data;
    },
  });

  // Fetch fitness stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['fitness-stats', dateRange],
    queryFn: async () => {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const response = await api.get('/wellness/fitness/stats', {
        params: { days },
      });
      return response.data;
    },
  });

  // Fetch fitness goals
  const { data: goalsData, isLoading: goalsLoading } = useQuery({
    queryKey: ['fitness-goals'],
    queryFn: async () => {
      const response = await api.get('/wellness/fitness/goals');
      return response.data;
    },
  });

  // AI workout recommendations
  const { data: aiRecommendations, isLoading: aiLoading, refetch: refetchAI } = useQuery({
    queryKey: ['ai-workout-recommendations'],
    queryFn: async () => {
      const response = await api.post('/wellness/ai/workout-recommendations', {
        fitnessLevel: 'INTERMEDIATE',
        availableTime: 45,
        preferences: ['strength', 'cardio'],
        equipment: ['dumbbells', 'resistance_bands'],
      });
      return response.data;
    },
    enabled: false,
  });

  // Add activity mutation
  const addActivityMutation = useMutation({
    mutationFn: async (data: typeof activityForm) => {
      const response = await api.post('/wellness/fitness/activities', {
        ...data,
        caloriesBurned: data.caloriesBurned ? Number(data.caloriesBurned) : undefined,
        distanceKm: data.distanceKm ? Number(data.distanceKm) : undefined,
        startTime: new Date().toISOString(),
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitness-activities'] });
      queryClient.invalidateQueries({ queryKey: ['fitness-stats'] });
      queryClient.invalidateQueries({ queryKey: ['fitness-goals'] });
      setShowAddModal(false);
      setActivityForm({
        activityType: 'WALKING',
        durationMinutes: 30,
        intensity: 'MODERATE',
        caloriesBurned: '',
        distanceKm: '',
        notes: '',
      });
    },
  });

  // Delete activity mutation
  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/wellness/fitness/activities/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitness-activities'] });
      queryClient.invalidateQueries({ queryKey: ['fitness-stats'] });
    },
  });

  // Add goal mutation
  const addGoalMutation = useMutation({
    mutationFn: async (data: typeof goalForm) => {
      const response = await api.post('/wellness/fitness/goals', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitness-goals'] });
      setShowGoalModal(false);
    },
  });

  const activities: FitnessActivity[] = activitiesData?.activities || [];
  const stats: FitnessStats = statsData?.stats || {
    totalWorkouts: 0,
    totalDuration: 0,
    totalCalories: 0,
    avgDuration: 0,
    streak: 0,
    topActivity: 'N/A',
    weeklyProgress: [],
  };
  const goals: FitnessGoal[] = goalsData?.goals || [];

  // Weekly progress chart data
  const weeklyChartData = {
    labels: stats.weeklyProgress?.map((d) => d.day) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Minutes',
        data: stats.weeklyProgress?.map((d) => d.minutes) || [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 6,
      },
    ],
  };

  // Activity distribution chart
  const activityDistribution = activities.reduce((acc, a) => {
    acc[a.activityType] = (acc[a.activityType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const distributionChartData = {
    labels: Object.keys(activityDistribution).map(
      (type) => ACTIVITY_TYPES.find((t) => t.id === type)?.name || type
    ),
    datasets: [
      {
        data: Object.values(activityDistribution),
        backgroundColor: [
          '#3B82F6',
          '#10B981',
          '#F59E0B',
          '#EF4444',
          '#8B5CF6',
          '#EC4899',
          '#06B6D4',
          '#6366F1',
        ],
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fitness Tracker</h1>
          <p className="text-gray-600">Track your workouts and achieve your fitness goals</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setShowAIModal(true);
              refetchAI();
            }}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors flex items-center gap-2"
          >
            <SparklesIcon className="w-5 h-5" />
            AI Workout
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            Log Workout
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ChartBarIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Workouts</p>
              <p className="text-2xl font-bold">{stats.totalWorkouts}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <ClockIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Duration</p>
              <p className="text-2xl font-bold">{Math.round(stats.totalDuration)} min</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <FireIcon className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Calories Burned</p>
              <p className="text-2xl font-bold">{stats.totalCalories.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrophyIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Current Streak</p>
              <p className="text-2xl font-bold">{stats.streak} days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Goals Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Fitness Goals</h2>
          <button
            onClick={() => setShowGoalModal(true)}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" />
            Add Goal
          </button>
        </div>
        {goalsLoading ? (
          <div className="flex justify-center py-8">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <TrophyIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No fitness goals set</p>
            <p className="text-sm">Set goals to track your progress</p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <div key={goal.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{goal.goalType.replace(/_/g, ' ')}</span>
                  <span className="text-sm text-gray-500">
                    {goal.currentValue} / {goal.targetValue} {goal.unit}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(goal.progress, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">{goal.frequency}</span>
                  <span
                    className={`text-sm font-medium ${
                      goal.progress >= 100 ? 'text-green-600' : 'text-blue-600'
                    }`}
                  >
                    {goal.progress.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weekly Progress */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Weekly Progress</h2>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="7d">This Week</option>
              <option value="30d">This Month</option>
              <option value="90d">Last 3 Months</option>
            </select>
          </div>
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

        {/* Activity Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Activity Distribution</h2>
          <div className="h-64 flex items-center justify-center">
            {Object.keys(activityDistribution).length === 0 ? (
              <p className="text-gray-500">No activities logged yet</p>
            ) : (
              <Doughnut
                data={distributionChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'right' as const },
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Activities</h2>
        {activitiesLoading ? (
          <div className="flex justify-center py-8">
            <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No activities logged yet</p>
            <p className="text-sm">Start logging your workouts!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 10).map((activity) => {
              const activityType = ACTIVITY_TYPES.find((t) => t.id === activity.activityType);
              return (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{activityType?.icon || '🎯'}</span>
                    <div>
                      <h3 className="font-medium">{activityType?.name || activity.activityType}</h3>
                      <p className="text-sm text-gray-500">
                        {new Date(activity.startTime).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium">{activity.durationMinutes} min</p>
                      {activity.caloriesBurned && (
                        <p className="text-sm text-orange-500">{activity.caloriesBurned} cal</p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        activity.intensity === 'HIGH' || activity.intensity === 'VERY_HIGH'
                          ? 'bg-red-100 text-red-700'
                          : activity.intensity === 'MODERATE'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {activity.intensity}
                    </span>
                    <button
                      onClick={() => deleteActivityMutation.mutate(activity.id)}
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

      {/* Add Activity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Log Workout</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Activity Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {ACTIVITY_TYPES.slice(0, 12).map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setActivityForm({ ...activityForm, activityType: type.id })}
                      className={`p-2 rounded-lg text-center transition-all ${
                        activityForm.activityType === type.id
                          ? 'ring-2 ring-blue-500 bg-blue-50'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-xl block">{type.icon}</span>
                      <span className="text-xs">{type.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={activityForm.durationMinutes}
                  onChange={(e) =>
                    setActivityForm({ ...activityForm, durationMinutes: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Intensity</label>
                <div className="grid grid-cols-4 gap-2">
                  {INTENSITIES.map((intensity) => (
                    <button
                      key={intensity.id}
                      onClick={() => setActivityForm({ ...activityForm, intensity: intensity.id })}
                      className={`p-2 rounded-lg text-center text-sm transition-all ${
                        activityForm.intensity === intensity.id
                          ? 'ring-2 ring-blue-500 bg-blue-50'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      {intensity.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calories Burned (optional)
                  </label>
                  <input
                    type="number"
                    value={activityForm.caloriesBurned}
                    onChange={(e) =>
                      setActivityForm({ ...activityForm, caloriesBurned: e.target.value })
                    }
                    placeholder="e.g., 200"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Distance (km, optional)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={activityForm.distanceKm}
                    onChange={(e) => setActivityForm({ ...activityForm, distanceKm: e.target.value })}
                    placeholder="e.g., 5.0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (optional)</label>
                <textarea
                  value={activityForm.notes}
                  onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                  placeholder="How did it feel? Any achievements?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => addActivityMutation.mutate(activityForm)}
                disabled={addActivityMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {addActivityMutation.isPending ? 'Saving...' : 'Log Workout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Fitness Goal</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Goal Type</label>
                <select
                  value={goalForm.goalType}
                  onChange={(e) => setGoalForm({ ...goalForm, goalType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="WEEKLY_WORKOUT_MINUTES">Weekly Workout Minutes</option>
                  <option value="WEEKLY_WORKOUTS">Weekly Workouts Count</option>
                  <option value="WEEKLY_CALORIES">Weekly Calories Burned</option>
                  <option value="DAILY_STEPS">Daily Steps</option>
                  <option value="WEEKLY_DISTANCE">Weekly Distance (km)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Value</label>
                <input
                  type="number"
                  value={goalForm.targetValue}
                  onChange={(e) => setGoalForm({ ...goalForm, targetValue: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                <select
                  value={goalForm.frequency}
                  onChange={(e) => setGoalForm({ ...goalForm, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowGoalModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => addGoalMutation.mutate(goalForm)}
                disabled={addGoalMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {addGoalMutation.isPending ? 'Creating...' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Workout Recommendations Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold">AI Workout Recommendation</h2>
            </div>
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <ArrowPathIcon className="w-10 h-10 animate-spin text-purple-500 mb-4" />
                <p className="text-gray-500">Generating personalized workout...</p>
              </div>
            ) : aiRecommendations?.recommendation ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">{aiRecommendations.recommendation.workoutName}</h3>
                  <p className="text-sm text-gray-600">{aiRecommendations.recommendation.description}</p>
                  <div className="flex gap-4 mt-3 text-sm">
                    <span className="flex items-center gap-1">
                      <ClockIcon className="w-4 h-4" />
                      {aiRecommendations.recommendation.duration} min
                    </span>
                    <span className="flex items-center gap-1">
                      <FireIcon className="w-4 h-4" />
                      {aiRecommendations.recommendation.estimatedCalories} cal
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                      {aiRecommendations.recommendation.difficulty}
                    </span>
                  </div>
                </div>
                {aiRecommendations.recommendation.exercises?.map((exercise: any, idx: number) => (
                  <div key={idx} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{exercise.name}</h4>
                      <span className="text-sm text-gray-500">{exercise.targetMuscles}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {exercise.sets} sets x {exercise.reps} reps
                      {exercise.restSeconds && ` | ${exercise.restSeconds}s rest`}
                    </p>
                    {exercise.instructions && (
                      <p className="text-xs text-gray-400 mt-2">{exercise.instructions}</p>
                    )}
                  </div>
                ))}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-2">Tips</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    {aiRecommendations.recommendation.tips?.map((tip: string, idx: number) => (
                      <li key={idx}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Unable to generate recommendations. Please try again.
              </p>
            )}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAIModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Close
              </button>
              <button
                onClick={() => refetchAI()}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600"
              >
                Generate New
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
