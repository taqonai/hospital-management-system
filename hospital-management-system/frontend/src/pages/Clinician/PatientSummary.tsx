import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BeakerIcon,
  HeartIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { clinicianApi } from '../../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type NoteType = 'GENERAL' | 'GENOMIC_REVIEW' | 'WEARABLE_REVIEW' | 'LAB_INTERPRETATION' | 'RECOMMENDATION_OVERRIDE' | 'CARE_PLAN';

export default function PatientSummary() {
  const { patientId } = useParams<{ patientId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'genomic' | 'wearable' | 'recommendations' | 'timeline' | 'notes'>('overview');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteType, setNoteType] = useState<NoteType>('GENERAL');
  const [noteContent, setNoteContent] = useState('');

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['clinician-patient-summary', patientId],
    queryFn: async () => {
      const response = await clinicianApi.getPatientSummary(patientId!);
      return response.data;
    },
    enabled: !!patientId,
  });

  const { data: timelineData } = useQuery({
    queryKey: ['clinician-patient-timeline', patientId],
    queryFn: async () => {
      const response = await clinicianApi.getPatientTimeline(patientId!, { days: 30 });
      return response.data;
    },
    enabled: !!patientId && activeTab === 'timeline',
  });

  const { data: notesData, refetch: refetchNotes } = useQuery({
    queryKey: ['clinician-patient-notes', patientId],
    queryFn: async () => {
      const response = await clinicianApi.getPatientNotes(patientId!, { limit: 20 });
      return response.data;
    },
    enabled: !!patientId && activeTab === 'notes',
  });

  const addNoteMutation = useMutation({
    mutationFn: (data: { noteType: NoteType; content: string }) =>
      clinicianApi.addPatientNote(patientId!, data),
    onSuccess: () => {
      toast.success('Note added successfully');
      setShowNoteModal(false);
      setNoteContent('');
      refetchNotes();
    },
    onError: () => {
      toast.error('Failed to add note');
    },
  });

  const summary = summaryData?.data;
  const timeline = timelineData?.data?.events || [];
  const notes = notesData?.data?.notes || [];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'IMPROVING':
        return <ArrowTrendingUpIcon className="h-5 w-5 text-green-500" />;
      case 'DECLINING':
        return <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" />;
      default:
        return <MinusIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'genomic', label: 'Genomic Profile', icon: BeakerIcon },
    { id: 'wearable', label: 'Wearable Data', icon: HeartIcon },
    { id: 'recommendations', label: 'Recommendations', icon: ClipboardDocumentListIcon },
    { id: 'timeline', label: 'Timeline', icon: DocumentTextIcon },
    { id: 'notes', label: 'Clinical Notes', icon: DocumentTextIcon },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Patient not found</p>
        <Link to="/clinician" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/clinician"
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{summary.patient.name}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>MRN: {summary.patient.mrn}</span>
            <span>DOB: {format(new Date(summary.patient.dateOfBirth), 'MMM d, yyyy')}</span>
            <span>{summary.patient.gender}</span>
            {summary.patient.bloodGroup && <span>Blood: {summary.patient.bloodGroup}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${getScoreColor(summary.healthScores?.[0]?.overall || 0)}`}>
            Health Score: {summary.healthScores?.[0]?.overall || 'N/A'}
          </span>
          {summary.overallTrend && getTrendIcon(summary.overallTrend)}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Health Score Breakdown */}
          {summary.healthScores?.[0] && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Health Score</h3>
              <div className="space-y-4">
                {[
                  { label: 'Sleep', value: summary.healthScores[0].sleep, color: 'bg-indigo-500' },
                  { label: 'Activity', value: summary.healthScores[0].activity, color: 'bg-green-500' },
                  { label: 'Nutrition', value: summary.healthScores[0].nutrition, color: 'bg-orange-500' },
                  { label: 'Recovery', value: summary.healthScores[0].recovery, color: 'bg-blue-500' },
                  { label: 'Compliance', value: summary.healthScores[0].compliance, color: 'bg-purple-500' },
                ].map((metric) => (
                  <div key={metric.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{metric.label}</span>
                      <span className="font-medium">{metric.value}/100</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${metric.color} rounded-full transition-all`}
                        style={{ width: `${metric.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {summary.healthScores[0].insights?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Insights</p>
                  <ul className="space-y-1">
                    {summary.healthScores[0].insights.map((insight: string, idx: number) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Medical History & Allergies */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Medical History</h3>
            {summary.medicalHistory?.length > 0 ? (
              <ul className="space-y-2 mb-4">
                {summary.medicalHistory.map((item: any, idx: number) => (
                  <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    {item.condition} ({item.status})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 mb-4">No medical history recorded</p>
            )}

            <h4 className="text-md font-semibold text-gray-900 mb-2">Allergies</h4>
            {summary.allergies?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {summary.allergies.map((allergy: any, idx: number) => (
                  <span
                    key={idx}
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      allergy.severity === 'SEVERE'
                        ? 'bg-red-100 text-red-800'
                        : allergy.severity === 'MODERATE'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {allergy.allergen}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No known allergies</p>
            )}
          </div>

          {/* Connected Devices */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Connected Devices</h3>
            {summary.connectedDevices?.length > 0 ? (
              <div className="space-y-3">
                {summary.connectedDevices.map((device: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <HeartIcon className="h-6 w-6 text-green-500" />
                      <div>
                        <p className="font-medium text-gray-900">{device.provider.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-500">
                          Last sync: {device.lastSyncAt ? format(new Date(device.lastSyncAt), 'MMM d, HH:mm') : 'Never'}
                        </p>
                      </div>
                    </div>
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No devices connected</p>
            )}
          </div>

          {/* Active Recommendations */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Recommendations</h3>
            {summary.activeRecommendations?.length > 0 ? (
              <div className="space-y-3">
                {summary.activeRecommendations.slice(0, 5).map((rec: any) => (
                  <div key={rec.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{rec.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                        rec.priority === 'HIGH' || rec.priority === 'URGENT'
                          ? 'bg-red-100 text-red-800'
                          : rec.priority === 'MEDIUM'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No active recommendations</p>
            )}
          </div>
        </div>
      )}

      {/* Genomic Profile Tab */}
      {activeTab === 'genomic' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Genomic Profile</h3>
          {summary.genomicProfile ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600 font-medium">Status</p>
                  <p className="text-lg font-bold text-purple-900">{summary.genomicProfile.status}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600 font-medium">Markers Analyzed</p>
                  <p className="text-lg font-bold text-purple-900">{summary.genomicProfile.markers?.length || 0}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-600 font-medium">Risk Scores</p>
                  <p className="text-lg font-bold text-purple-900">{summary.genomicProfile.riskScores?.length || 0}</p>
                </div>
              </div>

              {/* Genomic Markers */}
              {summary.genomicProfile.markers?.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Genetic Markers</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Gene</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">RS ID</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Genotype</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phenotype</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {summary.genomicProfile.markers.map((marker: any) => (
                          <tr key={marker.id}>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{marker.gene}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{marker.rsId}</td>
                            <td className="px-4 py-2 text-sm font-mono text-gray-600">{marker.genotype}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{marker.phenotype}</td>
                            <td className="px-4 py-2">
                              <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-800">
                                {marker.category}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Risk Scores */}
              {summary.genomicProfile.riskScores?.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">Risk Assessment</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {summary.genomicProfile.riskScores.map((risk: any) => (
                      <div key={risk.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-gray-900">{risk.condition}</p>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                            risk.riskLevel === 'HIGH'
                              ? 'bg-red-100 text-red-800'
                              : risk.riskLevel === 'MODERATE'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {risk.riskLevel}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              risk.score >= 70 ? 'bg-red-500' : risk.score >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${risk.score}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{risk.score}% genetic risk</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <BeakerIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No genomic profile available</p>
              <p className="text-sm text-gray-400 mt-1">Patient has not uploaded genomic data</p>
            </div>
          )}
        </div>
      )}

      {/* Wearable Data Tab */}
      {activeTab === 'wearable' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Wearable Health Metrics</h3>
          {summary.healthMetrics?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {summary.healthMetrics.map((metric: any) => (
                <div key={metric.type} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-600">{metric.type.replace(/_/g, ' ')}</p>
                    <span className="text-xs text-gray-400">{metric.count} readings</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {metric.latest?.value?.toFixed(1)} {metric.unit}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>Avg: {metric.avg?.toFixed(1)}</span>
                    <span>Min: {metric.min?.toFixed(1)}</span>
                    <span>Max: {metric.max?.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <HeartIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No wearable data available</p>
              <p className="text-sm text-gray-400 mt-1">Patient has not synced any health devices</p>
            </div>
          )}
        </div>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AI Recommendations</h3>
          </div>
          {summary.activeRecommendations?.length > 0 ? (
            <div className="space-y-4">
              {summary.activeRecommendations.map((rec: any) => (
                <div key={rec.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{rec.title}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${
                        rec.category === 'NUTRITION' ? 'bg-green-100 text-green-800' :
                        rec.category === 'ACTIVITY' ? 'bg-blue-100 text-blue-800' :
                        rec.category === 'SLEEP' ? 'bg-indigo-100 text-indigo-800' :
                        rec.category === 'MEDICAL' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {rec.category}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      rec.priority === 'HIGH' || rec.priority === 'URGENT'
                        ? 'bg-red-100 text-red-800'
                        : rec.priority === 'MEDIUM'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                  {rec.reasoning?.length > 0 && (
                    <div className="text-xs text-gray-500">
                      <p className="font-medium mb-1">Reasoning:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {rec.reasoning.map((reason: string, idx: number) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardDocumentListIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No active recommendations</p>
            </div>
          )}
        </div>
      )}

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Health Event Timeline</h3>
          {timeline.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {timeline.map((event: any, idx: number) => (
                  <div key={idx} className="relative pl-10">
                    <div className={`absolute left-2 w-5 h-5 rounded-full border-2 border-white ${
                      event.type === 'APPOINTMENT' ? 'bg-blue-500' :
                      event.type === 'LAB_ORDER' ? 'bg-purple-500' :
                      event.type === 'RECOMMENDATION' ? 'bg-green-500' :
                      event.type === 'HEALTH_SCORE' ? 'bg-orange-500' :
                      event.type === 'CLINICIAN_NOTE' ? 'bg-gray-500' :
                      'bg-gray-400'
                    }`} />
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500 uppercase">{event.type.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(event.date), 'MMM d, yyyy HH:mm')}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{event.title}</p>
                      {event.status && (
                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${
                          event.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          event.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {event.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No events in the last 30 days</p>
            </div>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Clinical Notes</h3>
            <button
              onClick={() => setShowNoteModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="h-5 w-5" />
              Add Note
            </button>
          </div>
          {notes.length > 0 ? (
            <div className="space-y-4">
              {notes.map((note: any) => (
                <div key={note.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-800">
                        {note.noteType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-sm text-gray-500">
                        by {note.clinician?.firstName} {note.clinician?.lastName}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {format(new Date(note.createdAt), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No clinical notes yet</p>
            </div>
          )}
        </div>
      )}

      {/* Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Clinical Note</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note Type</label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value as NoteType)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="GENERAL">General</option>
                  <option value="GENOMIC_REVIEW">Genomic Review</option>
                  <option value="WEARABLE_REVIEW">Wearable Review</option>
                  <option value="LAB_INTERPRETATION">Lab Interpretation</option>
                  <option value="RECOMMENDATION_OVERRIDE">Recommendation Override</option>
                  <option value="CARE_PLAN">Care Plan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note Content</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder="Enter your clinical note..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNoteModal(false);
                  setNoteContent('');
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => addNoteMutation.mutate({ noteType, content: noteContent })}
                disabled={!noteContent.trim() || addNoteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addNoteMutation.isPending ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
