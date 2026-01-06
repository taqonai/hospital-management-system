import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  ComputerDesktopIcon,
  PlayIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  UserIcon,
  CalendarDaysIcon,
  ArrowPathIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  Squares2X2Icon,
  TableCellsIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import { telemedicineApi } from '../../services/api';
import RecordingPlayer from './RecordingPlayer';
import toast from 'react-hot-toast';

interface Recording {
  id: string;
  sessionId: string;
  type: 'VIDEO' | 'AUDIO' | 'SCREEN';
  url?: string;
  duration?: number;
  fileSize?: number;
  thumbnailUrl?: string;
  createdAt: string;
  session?: {
    id: string;
    patientName?: string;
    doctorName?: string;
    scheduledAt?: string;
    reason?: string;
  };
}

interface RecordingHistoryProps {
  patientId?: string;
  sessionId?: string;
}

export default function RecordingHistory({ patientId, sessionId }: RecordingHistoryProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Fetch recordings using TanStack Query
  const { data: recordingsData, isLoading: loading, refetch } = useQuery({
    queryKey: ['recordings', sessionId, patientId],
    queryFn: async () => {
      if (sessionId) {
        const response = await telemedicineApi.getSessionRecordings(sessionId);
        return response.data.data || [];
      } else if (patientId) {
        const response = await telemedicineApi.getPatientRecordings(patientId);
        return response.data.data || [];
      } else {
        // Get all sessions and their recordings
        const sessionsResponse = await telemedicineApi.getSessions({ limit: 100 });
        const sessions = sessionsResponse.data.data || [];
        const allRecordings: Recording[] = [];

        for (const session of sessions) {
          try {
            const recResponse = await telemedicineApi.getSessionRecordings(session.id);
            const sessionRecordings = (recResponse.data.data || []).map((r: Recording) => ({
              ...r,
              session: {
                id: session.id,
                patientName: session.patientName,
                doctorName: session.doctorName,
                scheduledAt: session.scheduledAt,
                reason: session.reason,
              },
            }));
            allRecordings.push(...sessionRecordings);
          } catch {
            // Silently ignore sessions without recordings
          }
        }
        return allRecordings;
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const recordings: Recording[] = recordingsData || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (recordingId: string) => {
      await telemedicineApi.deleteRecording(recordingId);
      return recordingId;
    },
    onSuccess: (recordingId) => {
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      toast.success('Recording deleted successfully');
      setShowDeleteConfirm(null);
    },
    onError: () => {
      toast.error('Failed to delete recording');
    },
  });

  const handleDelete = (recordingId: string) => {
    setShowDeleteConfirm(recordingId);
  };

  const confirmDelete = () => {
    if (showDeleteConfirm) {
      deleteMutation.mutate(showDeleteConfirm);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'VIDEO':
        return <VideoCameraIcon className="h-5 w-5" />;
      case 'AUDIO':
        return <MicrophoneIcon className="h-5 w-5" />;
      case 'SCREEN':
        return <ComputerDesktopIcon className="h-5 w-5" />;
      default:
        return <VideoCameraIcon className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'VIDEO':
        return {
          bg: 'bg-sky-500/10',
          text: 'text-sky-600',
          border: 'border-sky-500/20',
          gradient: 'from-sky-500 to-cyan-500',
        };
      case 'AUDIO':
        return {
          bg: 'bg-violet-500/10',
          text: 'text-violet-600',
          border: 'border-violet-500/20',
          gradient: 'from-violet-500 to-purple-500',
        };
      case 'SCREEN':
        return {
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-600',
          border: 'border-emerald-500/20',
          gradient: 'from-emerald-500 to-green-500',
        };
      default:
        return {
          bg: 'bg-gray-500/10',
          text: 'text-gray-600',
          border: 'border-gray-500/20',
          gradient: 'from-gray-500 to-gray-600',
        };
    }
  };

  // Filter recordings using useMemo for performance
  const filteredRecordings = useMemo(() => {
    return recordings.filter((recording) => {
      const matchesSearch =
        !search ||
        recording.session?.patientName?.toLowerCase().includes(search.toLowerCase()) ||
        recording.session?.doctorName?.toLowerCase().includes(search.toLowerCase()) ||
        recording.session?.reason?.toLowerCase().includes(search.toLowerCase());

      const matchesType = !typeFilter || recording.type === typeFilter;

      const matchesDateRange = (() => {
        if (!dateRange.start && !dateRange.end) return true;
        const recordingDate = new Date(recording.createdAt);
        if (dateRange.start && recordingDate < new Date(dateRange.start)) return false;
        if (dateRange.end && recordingDate > new Date(dateRange.end + 'T23:59:59')) return false;
        return true;
      })();

      return matchesSearch && matchesType && matchesDateRange;
    });
  }, [recordings, search, typeFilter, dateRange]);

  const hasActiveFilters = search || typeFilter || dateRange.start || dateRange.end;

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('');
    setDateRange({ start: '', end: '' });
  };

  const handleDownload = (recording: Recording) => {
    if (!recording.url) return;
    const link = document.createElement('a');
    link.href = recording.url;
    link.download = `recording-${recording.id}.${recording.type === 'VIDEO' ? 'mp4' : recording.type === 'AUDIO' ? 'mp3' : 'webm'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-sky-500/10 to-cyan-500/10 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl shadow-lg shadow-sky-500/25">
              <VideoCameraIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Recording History</h3>
              <p className="text-sm text-gray-500">
                {filteredRecordings.length} recording{filteredRecordings.length !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100/80 backdrop-blur-sm rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white shadow-sm text-sky-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Grid view"
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'table'
                    ? 'bg-white shadow-sm text-sky-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Table view"
              >
                <TableCellsIcon className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => refetch()}
              disabled={loading}
              className="p-2.5 rounded-xl bg-gray-100/80 backdrop-blur-sm hover:bg-gray-200/80 transition-colors"
            >
              <ArrowPathIcon className={`h-5 w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] group">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-sky-500 transition-colors" />
            <input
              type="text"
              placeholder="Search by patient, doctor, or reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 text-sm rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/50 placeholder-gray-400 transition-all"
            />
          </div>
          <div className="relative">
            <FunnelIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none w-full sm:w-40 pl-12 pr-10 py-2.5 text-sm rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-gray-700 cursor-pointer transition-all"
            >
              <option value="">All Types</option>
              <option value="VIDEO">Video</option>
              <option value="AUDIO">Audio</option>
              <option value="SCREEN">Screen</option>
            </select>
          </div>
          {/* Date Range Filters */}
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="px-3 py-2 text-sm rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-gray-700 transition-all"
              placeholder="Start date"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="px-3 py-2 text-sm rounded-xl bg-white/80 backdrop-blur-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500/30 text-gray-700 transition-all"
              placeholder="End date"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <XMarkIcon className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Recordings List */}
      <div className="p-6 max-h-[600px] overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin" />
            </div>
            <p className="text-gray-500 animate-pulse">Loading recordings...</p>
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-sky-500/10 to-cyan-500/10 flex items-center justify-center">
              <VideoCameraIcon className="h-10 w-10 text-sky-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No recordings found</h3>
            <p className="text-gray-500">
              {hasActiveFilters
                ? 'Try adjusting your filters'
                : 'Session recordings will appear here'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecordings.map((recording, idx) => {
              const typeColor = getTypeColor(recording.type);
              return (
                <div
                  key={recording.id}
                  className="group relative overflow-hidden backdrop-blur-xl bg-white/90 border border-gray-200 rounded-xl shadow-lg hover:shadow-xl hover:border-sky-300 transition-all duration-300 opacity-0 animate-[fadeIn_0.5s_ease-out_forwards]"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Shine line */}
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                  {/* Thumbnail / Type Header */}
                  <div
                    className={`relative p-4 bg-gradient-to-r ${typeColor.gradient} cursor-pointer`}
                    onClick={() => recording.url && setSelectedRecording(recording)}
                  >
                    {recording.thumbnailUrl && recording.type === 'VIDEO' ? (
                      <div className="aspect-video -mx-4 -mt-4 mb-2">
                        <img
                          src={recording.thumbnailUrl}
                          alt="Recording thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white">
                        {getTypeIcon(recording.type)}
                        <span className="font-medium">{recording.type} Recording</span>
                      </div>
                      <span className="text-xs text-white/80 backdrop-blur-sm bg-white/20 px-2 py-1 rounded-lg">
                        {formatDuration(recording.duration)}
                      </span>
                    </div>
                    {/* Play Overlay */}
                    {recording.url && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-full">
                          <PlayIcon className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-3">
                    {recording.session && (
                      <>
                        <div className="flex items-center gap-2 text-sm">
                          <UserIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-700">
                            {recording.session.patientName || 'Patient'}
                          </span>
                        </div>
                        {recording.session.reason && (
                          <p className="text-sm text-gray-500 line-clamp-2">
                            {recording.session.reason}
                          </p>
                        )}
                      </>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <ClockIcon className="h-4 w-4" />
                        {new Date(recording.createdAt).toLocaleDateString()}
                      </div>
                      <span>{formatFileSize(recording.fileSize)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      {recording.url && (
                        <button
                          onClick={() => setSelectedRecording(recording)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 transition-colors text-sm font-medium"
                        >
                          <EyeIcon className="h-4 w-4" />
                          View
                        </button>
                      )}
                      {recording.url && (
                        <button
                          onClick={() => handleDownload(recording)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(recording.id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors text-sm font-medium"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Patient / Session
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRecordings.map((recording) => {
                  const typeColor = getTypeColor(recording.type);
                  return (
                    <tr key={recording.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${typeColor.bg} ${typeColor.text}`}>
                            {getTypeIcon(recording.type)}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{recording.type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {recording.session?.patientName || `Session ${recording.sessionId.slice(0, 8)}`}
                          </p>
                          {recording.session?.reason && (
                            <p className="text-xs text-gray-500 truncate max-w-[200px]">
                              {recording.session.reason}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-gray-900">
                          {new Date(recording.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(recording.createdAt).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-900 font-mono">
                            {formatDuration(recording.duration)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-600">{formatFileSize(recording.fileSize)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          {recording.url && (
                            <button
                              onClick={() => setSelectedRecording(recording)}
                              className="p-2 text-gray-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                              title="Play"
                            >
                              <PlayIcon className="h-4 w-4" />
                            </button>
                          )}
                          {recording.url && (
                            <button
                              onClick={() => handleDownload(recording)}
                              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Download"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(recording.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recording Player Modal */}
      {selectedRecording && selectedRecording.url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl">
            <RecordingPlayer
              recording={{
                id: selectedRecording.id,
                type: selectedRecording.type,
                url: selectedRecording.url,
                duration: (selectedRecording.duration || 0) * 1000, // Convert to milliseconds
                thumbnailUrl: selectedRecording.thumbnailUrl,
                title: selectedRecording.session?.patientName
                  ? `${selectedRecording.type} - ${selectedRecording.session.patientName}`
                  : `${selectedRecording.type} Recording`,
                createdAt: selectedRecording.createdAt,
              }}
              onClose={() => setSelectedRecording(null)}
              onDelete={() => {
                setSelectedRecording(null);
                refetch();
              }}
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-100 rounded-xl">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Delete Recording?</h3>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to permanently delete this recording? All data will be lost.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteMutation.isPending ? (
                    <>
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <TrashIcon className="h-4 w-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS for fadeIn animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
