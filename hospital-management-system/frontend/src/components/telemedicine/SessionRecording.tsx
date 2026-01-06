import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  VideoCameraIcon,
  MicrophoneIcon,
  StopIcon,
  PlayIcon,
  PauseIcon,
  DocumentDuplicateIcon,
  ClockIcon,
  ExclamationCircleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/solid';
import {
  VideoCameraSlashIcon,
  SpeakerXMarkIcon,
} from '@heroicons/react/24/outline';
import { telemedicineApi } from '../../services/api';

interface Recording {
  id: string;
  type: 'VIDEO' | 'AUDIO' | 'SCREEN';
  status: 'RECORDING' | 'STOPPED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  startedAt: string;
  endedAt?: string;
  duration?: number;
  url?: string;
  thumbnailUrl?: string;
  fileSize?: number;
}

interface SessionRecordingProps {
  sessionId: string;
  isSessionActive: boolean;
  onRecordingStatusChange?: (isRecording: boolean, type: 'VIDEO' | 'AUDIO') => void;
}

export default function SessionRecording({
  sessionId,
  isSessionActive,
  onRecordingStatusChange,
}: SessionRecordingProps) {
  const queryClient = useQueryClient();
  const [videoRecordingId, setVideoRecordingId] = useState<string | null>(null);
  const [audioRecordingId, setAudioRecordingId] = useState<string | null>(null);
  const [videoElapsed, setVideoElapsed] = useState(0);
  const [audioElapsed, setAudioElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch current session recordings
  const {
    data: recordingsData,
    isLoading: isLoadingRecordings,
    refetch: refetchRecordings,
  } = useQuery({
    queryKey: ['session-recordings', sessionId],
    queryFn: async () => {
      const response = await telemedicineApi.getSessionRecordings(sessionId);
      return response.data;
    },
    enabled: !!sessionId,
    refetchInterval: 5000, // Poll every 5 seconds for status updates
  });

  const recordings: Recording[] = recordingsData?.data || [];
  const activeVideoRecording = recordings.find(
    (r) => r.type === 'VIDEO' && r.status === 'RECORDING'
  );
  const activeAudioRecording = recordings.find(
    (r) => r.type === 'AUDIO' && r.status === 'RECORDING'
  );

  // Start recording mutation
  const startRecordingMutation = useMutation({
    mutationFn: async (type: 'VIDEO' | 'AUDIO' | 'SCREEN') => {
      const response = await telemedicineApi.startRecording(sessionId, type);
      return response.data;
    },
    onSuccess: (data, type) => {
      if (type === 'VIDEO') {
        setVideoRecordingId(data.data?.id || data.id);
        setVideoElapsed(0);
      } else if (type === 'AUDIO') {
        setAudioRecordingId(data.data?.id || data.id);
        setAudioElapsed(0);
      }
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['session-recordings', sessionId] });
      onRecordingStatusChange?.(true, type as 'VIDEO' | 'AUDIO');
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to start recording');
    },
  });

  // Stop recording mutation
  const stopRecordingMutation = useMutation({
    mutationFn: async ({ recordingId }: { recordingId: string; type: 'VIDEO' | 'AUDIO' }) => {
      const response = await telemedicineApi.stopRecording(sessionId, recordingId);
      return response.data;
    },
    onSuccess: (_, variables) => {
      if (variables.type === 'VIDEO') {
        setVideoRecordingId(null);
        setVideoElapsed(0);
      } else if (variables.type === 'AUDIO') {
        setAudioRecordingId(null);
        setAudioElapsed(0);
      }
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['session-recordings', sessionId] });
      onRecordingStatusChange?.(false, variables.type);
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to stop recording');
    },
  });

  // Timer effect for video recording
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (videoRecordingId || activeVideoRecording) {
      interval = setInterval(() => {
        setVideoElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoRecordingId, activeVideoRecording]);

  // Timer effect for audio recording
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (audioRecordingId || activeAudioRecording) {
      interval = setInterval(() => {
        setAudioElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [audioRecordingId, activeAudioRecording]);

  // Sync with server state
  useEffect(() => {
    if (activeVideoRecording && !videoRecordingId) {
      setVideoRecordingId(activeVideoRecording.id);
      const startTime = new Date(activeVideoRecording.startedAt).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setVideoElapsed(elapsed);
    }
    if (activeAudioRecording && !audioRecordingId) {
      setAudioRecordingId(activeAudioRecording.id);
      const startTime = new Date(activeAudioRecording.startedAt).getTime();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setAudioElapsed(elapsed);
    }
  }, [activeVideoRecording, activeAudioRecording, videoRecordingId, audioRecordingId]);

  const formatTime = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleStartVideoRecording = () => {
    if (!isSessionActive) {
      setError('Session must be active to start recording');
      return;
    }
    startRecordingMutation.mutate('VIDEO');
  };

  const handleStopVideoRecording = () => {
    const recordingId = videoRecordingId || activeVideoRecording?.id;
    if (recordingId) {
      stopRecordingMutation.mutate({ recordingId, type: 'VIDEO' });
    }
  };

  const handleStartAudioRecording = () => {
    if (!isSessionActive) {
      setError('Session must be active to start recording');
      return;
    }
    startRecordingMutation.mutate('AUDIO');
  };

  const handleStopAudioRecording = () => {
    const recordingId = audioRecordingId || activeAudioRecording?.id;
    if (recordingId) {
      stopRecordingMutation.mutate({ recordingId, type: 'AUDIO' });
    }
  };

  const isVideoRecording = !!(videoRecordingId || activeVideoRecording);
  const isAudioRecording = !!(audioRecordingId || activeAudioRecording);
  const completedRecordings = recordings.filter(
    (r) => r.status === 'COMPLETED' || r.status === 'STOPPED'
  );

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
              <VideoCameraIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Session Recording</h3>
              <p className="text-sm text-gray-500">
                {isSessionActive ? 'Session active - Ready to record' : 'Session inactive'}
              </p>
            </div>
          </div>
          <button
            onClick={() => refetchRecordings()}
            disabled={isLoadingRecordings}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
          >
            <ArrowPathIcon
              className={`h-5 w-5 text-gray-500 ${isLoadingRecordings ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
          <ExclamationCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <span className="sr-only">Dismiss</span>
            &times;
          </button>
        </div>
      )}

      {/* Recording Controls */}
      <div className="p-6 space-y-4">
        {/* Video Recording Control */}
        <div
          className={`p-4 rounded-xl border transition-all duration-300 ${
            isVideoRecording
              ? 'bg-red-50/80 border-red-200 shadow-lg shadow-red-500/10'
              : 'bg-gray-50/80 border-gray-200 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isVideoRecording ? (
                <div className="relative">
                  <div className="p-3 bg-red-500 rounded-xl">
                    <VideoCameraIcon className="h-6 w-6 text-white" />
                  </div>
                  {/* Pulsing Recording Indicator */}
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white"></span>
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-gray-200 rounded-xl">
                  <VideoCameraSlashIcon className="h-6 w-6 text-gray-500" />
                </div>
              )}
              <div>
                <h4 className="font-medium text-gray-900">Video Recording</h4>
                {isVideoRecording ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                      REC
                    </span>
                    <span className="font-mono text-lg font-bold text-red-600">
                      {formatTime(videoElapsed)}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Record video and audio</p>
                )}
              </div>
            </div>
            <button
              onClick={isVideoRecording ? handleStopVideoRecording : handleStartVideoRecording}
              disabled={
                !isSessionActive ||
                startRecordingMutation.isPending ||
                stopRecordingMutation.isPending
              }
              className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isVideoRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/25'
                  : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
              }`}
            >
              {isVideoRecording ? (
                <>
                  <StopIcon className="h-5 w-5" />
                  Stop
                </>
              ) : (
                <>
                  <PlayIcon className="h-5 w-5" />
                  Start
                </>
              )}
            </button>
          </div>
        </div>

        {/* Audio Recording Control */}
        <div
          className={`p-4 rounded-xl border transition-all duration-300 ${
            isAudioRecording
              ? 'bg-amber-50/80 border-amber-200 shadow-lg shadow-amber-500/10'
              : 'bg-gray-50/80 border-gray-200 hover:border-indigo-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isAudioRecording ? (
                <div className="relative">
                  <div className="p-3 bg-amber-500 rounded-xl">
                    <MicrophoneIcon className="h-6 w-6 text-white" />
                  </div>
                  {/* Pulsing Recording Indicator */}
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-white"></span>
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-gray-200 rounded-xl">
                  <SpeakerXMarkIcon className="h-6 w-6 text-gray-500" />
                </div>
              )}
              <div>
                <h4 className="font-medium text-gray-900">Audio Recording</h4>
                {isAudioRecording ? (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                      REC
                    </span>
                    <span className="font-mono text-lg font-bold text-amber-600">
                      {formatTime(audioElapsed)}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Record audio only</p>
                )}
              </div>
            </div>
            <button
              onClick={isAudioRecording ? handleStopAudioRecording : handleStartAudioRecording}
              disabled={
                !isSessionActive ||
                startRecordingMutation.isPending ||
                stopRecordingMutation.isPending
              }
              className={`px-4 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                isAudioRecording
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25'
                  : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
              }`}
            >
              {isAudioRecording ? (
                <>
                  <StopIcon className="h-5 w-5" />
                  Stop
                </>
              ) : (
                <>
                  <PlayIcon className="h-5 w-5" />
                  Start
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Current Session Recordings */}
      {completedRecordings.length > 0 && (
        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 mb-3">
            <DocumentDuplicateIcon className="h-5 w-5 text-gray-400" />
            <h4 className="font-medium text-gray-700">Session Recordings</h4>
            <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
              {completedRecordings.length}
            </span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {completedRecordings.map((recording) => (
              <div
                key={recording.id}
                className="flex items-center justify-between p-3 bg-gray-50/80 rounded-xl border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      recording.type === 'VIDEO'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    {recording.type === 'VIDEO' ? (
                      <VideoCameraIcon className="h-4 w-4" />
                    ) : (
                      <MicrophoneIcon className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {recording.type === 'VIDEO' ? 'Video' : 'Audio'} Recording
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <ClockIcon className="h-3.5 w-3.5" />
                      <span>
                        {recording.duration
                          ? formatTime(Math.floor(recording.duration / 1000))
                          : 'Processing...'}
                      </span>
                      {recording.fileSize && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>{formatFileSize(recording.fileSize)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {recording.status === 'COMPLETED' ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      Ready
                    </span>
                  ) : recording.status === 'PROCESSING' ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium">
                      <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      Processing
                    </span>
                  ) : recording.status === 'FAILED' ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium">
                      <ExclamationCircleIcon className="h-3.5 w-3.5" />
                      Failed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">
                      Stopped
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50/80 border-t border-gray-100">
        <p className="text-xs text-gray-500 text-center">
          Recordings are automatically saved and encrypted for HIPAA compliance
        </p>
      </div>
    </div>
  );
}
