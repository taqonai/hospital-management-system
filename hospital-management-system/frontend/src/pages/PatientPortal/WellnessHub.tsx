import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import {
  SparklesIcon,
  HeartIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  TrophyIcon,
  ArrowPathIcon,
  PlusIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface WellnessGoal {
  id: string;
  goalCategory: string;
  goalTitle: string;
  description: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  targetDate: string | null;
  priority: string;
  status: string;
  progress: number;
  milestones: { title: string; completed: boolean; date: string | null }[];
}

interface WellnessAssessment {
  id: string;
  assessmentType: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  insights: string[];
  recommendations: string[];
  assessedAt: string;
  nextAssessmentDate: string | null;
}

interface HealthCoachMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const GOAL_CATEGORIES = [
  { id: 'PHYSICAL_HEALTH', name: 'Physical Health', icon: '💪', color: 'bg-red-100 text-red-700' },
  { id: 'MENTAL_HEALTH', name: 'Mental Health', icon: '🧠', color: 'bg-purple-100 text-purple-700' },
  { id: 'NUTRITION', name: 'Nutrition', icon: '🥗', color: 'bg-green-100 text-green-700' },
  { id: 'SLEEP', name: 'Sleep', icon: '😴', color: 'bg-indigo-100 text-indigo-700' },
  { id: 'STRESS', name: 'Stress Management', icon: '🧘', color: 'bg-pink-100 text-pink-700' },
  { id: 'HYDRATION', name: 'Hydration', icon: '💧', color: 'bg-blue-100 text-blue-700' },
  { id: 'WEIGHT', name: 'Weight Management', icon: '⚖️', color: 'bg-orange-100 text-orange-700' },
  { id: 'OTHER', name: 'Other', icon: '🎯', color: 'bg-gray-100 text-gray-700' },
];

const ASSESSMENT_TYPES = [
  {
    id: 'COMPREHENSIVE',
    name: 'Comprehensive Wellness',
    description: 'Full assessment covering all health areas',
    duration: '10-15 min',
  },
  {
    id: 'STRESS',
    name: 'Stress & Mental Health',
    description: 'Evaluate stress levels and mental wellbeing',
    duration: '5-7 min',
  },
  {
    id: 'LIFESTYLE',
    name: 'Lifestyle Habits',
    description: 'Review diet, exercise, and daily habits',
    duration: '5-7 min',
  },
  {
    id: 'SLEEP',
    name: 'Sleep Quality',
    description: 'Analyze your sleep patterns and quality',
    duration: '3-5 min',
  },
];

export default function WellnessHub() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'goals' | 'assessment' | 'coach'>('goals');
  const [showAddGoalModal, setShowAddGoalModal] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [selectedAssessmentType, setSelectedAssessmentType] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<HealthCoachMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [goalForm, setGoalForm] = useState({
    goalCategory: 'PHYSICAL_HEALTH',
    goalTitle: '',
    description: '',
    targetValue: '',
    unit: '',
    targetDate: '',
    priority: 'MEDIUM',
  });

  // Fetch wellness goals
  const { data: goalsData, isLoading: goalsLoading } = useQuery({
    queryKey: ['wellness-goals'],
    queryFn: async () => {
      const response = await api.get('/wellness/wellness/goals');
      return response.data;
    },
  });

  // Fetch latest wellness assessment
  const { data: assessmentData, isLoading: assessmentLoading } = useQuery({
    queryKey: ['wellness-assessment'],
    queryFn: async () => {
      const response = await api.get('/wellness/ai/wellness-assessment');
      return response.data;
    },
  });

  // Add goal mutation
  const addGoalMutation = useMutation({
    mutationFn: async (data: typeof goalForm) => {
      const response = await api.post('/wellness/wellness/goals', {
        ...data,
        targetValue: data.targetValue ? Number(data.targetValue) : undefined,
        targetDate: data.targetDate || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness-goals'] });
      setShowAddGoalModal(false);
      setGoalForm({
        goalCategory: 'PHYSICAL_HEALTH',
        goalTitle: '',
        description: '',
        targetValue: '',
        unit: '',
        targetDate: '',
        priority: 'MEDIUM',
      });
    },
  });

  // Update goal progress mutation
  const updateGoalMutation = useMutation({
    mutationFn: async ({ id, currentValue }: { id: string; currentValue: number }) => {
      const response = await api.put(`/wellness/wellness/goals/${id}`, { currentValue });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness-goals'] });
    },
  });

  // Generate AI assessment mutation
  const generateAssessmentMutation = useMutation({
    mutationFn: async (assessmentType: string) => {
      const response = await api.post('/wellness/ai/wellness-assessment', {
        assessmentType,
        responses: {}, // In a real app, this would include questionnaire responses
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness-assessment'] });
      setShowAssessmentModal(false);
      setSelectedAssessmentType(null);
    },
  });

  // AI Health Coach chat mutation
  const sendChatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await api.post('/wellness/ai/health-coach', {
        message,
        context: {
          recentGoals: goals.slice(0, 3),
          latestAssessment: assessment,
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      setChatMessages([
        ...chatMessages,
        {
          role: 'assistant',
          content: data.response || data.message || 'I understand. How can I help you further?',
          timestamp: new Date().toISOString(),
        },
      ]);
    },
  });

  const goals: WellnessGoal[] = goalsData?.goals || [];
  const assessment: WellnessAssessment | null = assessmentData?.assessment || null;

  // Handle chat send
  const handleSendChat = () => {
    if (chatInput.trim()) {
      setChatMessages([
        ...chatMessages,
        {
          role: 'user',
          content: chatInput,
          timestamp: new Date().toISOString(),
        },
      ]);
      sendChatMutation.mutate(chatInput);
      setChatInput('');
    }
  };

  // Calculate overall wellness score
  const overallScore = assessment?.overallScore || 0;
  const scoreColor =
    overallScore >= 80
      ? 'text-green-600'
      : overallScore >= 60
      ? 'text-yellow-600'
      : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wellness Hub</h1>
          <p className="text-gray-600">Your personalized health journey with AI guidance</p>
        </div>
        <button
          onClick={() => setShowAddGoalModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5" />
          Add Goal
        </button>
      </div>

      {/* Wellness Score Overview */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium opacity-90">Overall Wellness Score</h2>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-5xl font-bold">{overallScore}</span>
              <span className="text-xl opacity-75">/100</span>
            </div>
            <p className="mt-2 opacity-75">
              {assessment
                ? `Last assessed: ${new Date(assessment.assessedAt).toLocaleDateString()}`
                : 'Take an assessment to get your score'}
            </p>
          </div>
          <div className="text-right">
            <button
              onClick={() => setShowAssessmentModal(true)}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
            >
              <SparklesIcon className="w-5 h-5" />
              Take Assessment
            </button>
            {assessment?.categoryScores && (
              <div className="mt-4 text-sm space-y-1">
                {Object.entries(assessment.categoryScores).slice(0, 4).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-end gap-2">
                    <span className="opacity-75">{key}:</span>
                    <span className="font-medium">{value}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrophyIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Goals</p>
              <p className="text-xl font-bold">
                {goals.filter((g) => g.status === 'ACTIVE').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-xl font-bold">
                {goals.filter((g) => g.status === 'COMPLETED').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ChartBarIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Progress</p>
              <p className="text-xl font-bold">
                {goals.length > 0
                  ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
                  : 0}
                %
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <LightBulbIcon className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">AI Insights</p>
              <p className="text-xl font-bold">{assessment?.insights?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'goals'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <TrophyIcon className="w-4 h-4" />
          Goals
        </button>
        <button
          onClick={() => setActiveTab('assessment')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'assessment'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <ChartBarIcon className="w-4 h-4" />
          Assessment
        </button>
        <button
          onClick={() => setActiveTab('coach')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'coach'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <ChatBubbleLeftRightIcon className="w-4 h-4" />
          AI Coach
        </button>
      </div>

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <div className="space-y-4">
          {goalsLoading ? (
            <div className="flex justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : goals.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <TrophyIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No wellness goals yet</h3>
              <p className="text-gray-500 mb-4">
                Start your wellness journey by setting your first goal
              </p>
              <button
                onClick={() => setShowAddGoalModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <PlusIcon className="w-5 h-5" />
                Add Your First Goal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((goal) => {
                const category = GOAL_CATEGORIES.find((c) => c.id === goal.goalCategory);
                return (
                  <div
                    key={goal.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{category?.icon || '🎯'}</span>
                        <div>
                          <h3 className="font-medium">{goal.goalTitle}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${category?.color}`}>
                            {category?.name || goal.goalCategory}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          goal.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : goal.status === 'ACTIVE'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {goal.status}
                      </span>
                    </div>
                    {goal.description && (
                      <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
                    )}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium">{goal.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            goal.progress >= 100
                              ? 'bg-green-500'
                              : goal.progress >= 50
                              ? 'bg-blue-500'
                              : 'bg-orange-500'
                          }`}
                          style={{ width: `${Math.min(goal.progress, 100)}%` }}
                        />
                      </div>
                    </div>
                    {goal.targetValue && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          {goal.currentValue || 0} / {goal.targetValue} {goal.unit}
                        </span>
                        {goal.targetDate && (
                          <span className="text-gray-400 flex items-center gap-1">
                            <ClockIcon className="w-4 h-4" />
                            {new Date(goal.targetDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                    {goal.milestones && goal.milestones.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">Milestones</p>
                        <div className="space-y-1">
                          {goal.milestones.map((milestone, idx) => (
                            <div
                              key={idx}
                              className={`text-sm flex items-center gap-2 ${
                                milestone.completed ? 'text-green-600' : 'text-gray-500'
                              }`}
                            >
                              {milestone.completed ? (
                                <CheckCircleIcon className="w-4 h-4" />
                              ) : (
                                <div className="w-4 h-4 border border-gray-300 rounded-full" />
                              )}
                              {milestone.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Assessment Tab */}
      {activeTab === 'assessment' && (
        <div className="space-y-6">
          {/* Latest Assessment */}
          {assessmentLoading ? (
            <div className="flex justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : assessment ? (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4">Latest Assessment Results</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {Object.entries(assessment.categoryScores || {}).map(([category, score]) => (
                    <div key={category} className="text-center p-4 bg-gray-50 rounded-lg">
                      <div
                        className={`text-2xl font-bold ${
                          Number(score) >= 80
                            ? 'text-green-600'
                            : Number(score) >= 60
                            ? 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      >
                        {score}%
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{category}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Insights */}
              {assessment.insights && assessment.insights.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <LightBulbIcon className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-lg font-semibold">AI Insights</h2>
                  </div>
                  <div className="space-y-3">
                    {assessment.insights.map((insight, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg"
                      >
                        <span className="text-yellow-500 mt-0.5">💡</span>
                        <p className="text-sm text-gray-700">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Recommendations */}
              {assessment.recommendations && assessment.recommendations.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <SparklesIcon className="w-5 h-5 text-purple-500" />
                    <h2 className="text-lg font-semibold">Personalized Recommendations</h2>
                  </div>
                  <div className="space-y-3">
                    {assessment.recommendations.map((rec, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg"
                      >
                        <span className="text-purple-500 mt-0.5">✨</span>
                        <p className="text-sm text-gray-700">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <ChartBarIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No assessment yet</h3>
              <p className="text-gray-500 mb-4">
                Take a wellness assessment to get personalized insights
              </p>
              <button
                onClick={() => setShowAssessmentModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors inline-flex items-center gap-2"
              >
                <SparklesIcon className="w-5 h-5" />
                Start Assessment
              </button>
            </div>
          )}
        </div>
      )}

      {/* AI Coach Tab */}
      {activeTab === 'coach' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <SparklesIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-semibold">AI Health Coach</h2>
                <p className="text-sm opacity-75">
                  Get personalized guidance for your wellness journey
                </p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {chatMessages.length === 0 ? (
              <div className="text-center py-12">
                <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">Start a conversation with your AI health coach</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {[
                    'How can I improve my sleep?',
                    'What exercises are good for stress?',
                    'Help me create a healthy routine',
                    'Review my wellness progress',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => {
                        setChatInput(prompt);
                      }}
                      className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            {sendChatMutation.isPending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    />
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.4s' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask your AI health coach..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || sendChatMutation.isPending}
                className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoalModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Add Wellness Goal</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <div className="grid grid-cols-4 gap-2">
                  {GOAL_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setGoalForm({ ...goalForm, goalCategory: cat.id })}
                      className={`p-2 rounded-lg text-center transition-all ${
                        goalForm.goalCategory === cat.id
                          ? 'ring-2 ring-blue-500 bg-blue-50'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-xl block">{cat.icon}</span>
                      <span className="text-xs">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title</label>
                <input
                  type="text"
                  value={goalForm.goalTitle}
                  onChange={(e) => setGoalForm({ ...goalForm, goalTitle: e.target.value })}
                  placeholder="e.g., Walk 10,000 steps daily"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                  placeholder="Why is this goal important to you?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Value (optional)
                  </label>
                  <input
                    type="number"
                    value={goalForm.targetValue}
                    onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })}
                    placeholder="e.g., 10000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    type="text"
                    value={goalForm.unit}
                    onChange={(e) => setGoalForm({ ...goalForm, unit: e.target.value })}
                    placeholder="e.g., steps"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={goalForm.targetDate}
                    onChange={(e) => setGoalForm({ ...goalForm, targetDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={goalForm.priority}
                    onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddGoalModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => addGoalMutation.mutate(goalForm)}
                disabled={addGoalMutation.isPending || !goalForm.goalTitle}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {addGoalMutation.isPending ? 'Creating...' : 'Create Goal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Modal */}
      {showAssessmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                <SparklesIcon className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold">Wellness Assessment</h2>
            </div>
            <p className="text-gray-600 mb-6">
              Choose an assessment type to get personalized insights about your health
            </p>
            <div className="space-y-3">
              {ASSESSMENT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedAssessmentType(type.id)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    selectedAssessmentType === type.id
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{type.name}</h3>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <ClockIcon className="w-3 h-3" />
                      {type.duration}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAssessmentModal(false);
                  setSelectedAssessmentType(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  selectedAssessmentType &&
                  generateAssessmentMutation.mutate(selectedAssessmentType)
                }
                disabled={!selectedAssessmentType || generateAssessmentMutation.isPending}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 flex items-center gap-2"
              >
                {generateAssessmentMutation.isPending ? (
                  <>
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5" />
                    Start Assessment
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
