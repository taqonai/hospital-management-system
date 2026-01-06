import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  VideoCameraIcon,
  MicrophoneIcon,
} from '@heroicons/react/24/solid';
import { telemedicineApi } from '../../services/api';

interface Recording {
  id: string;
  type: 'VIDEO' | 'AUDIO' | 'SCREEN';
  url: string;
  duration: number;
  thumbnailUrl?: string;
  title?: string;
  createdAt?: string;
}

interface RecordingPlayerProps {
  recording: Recording;
  onClose?: () => void;
  onDelete?: (recordingId: string) => void;
  showDeleteButton?: boolean;
  className?: string;
}

export default function RecordingPlayer({
  recording,
  onClose,
  onDelete,
  showDeleteButton = true,
  className = '',
}: RecordingPlayerProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recording.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [audioData, setAudioData] = useState<number[]>(new Array(64).fill(0));

  // Audio context for waveform visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Delete recording mutation
  const deleteRecordingMutation = useMutation({
    mutationFn: async (recordingId: string) => {
      const response = await telemedicineApi.deleteRecording(recordingId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-recordings'] });
      queryClient.invalidateQueries({ queryKey: ['patient-recordings'] });
      onDelete?.(recording.id);
      onClose?.();
    },
  });

  const formatTime = useCallback((seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Setup audio visualization for audio recordings
  useEffect(() => {
    if (recording.type !== 'AUDIO' || !audioRef.current) return;

    const setupAudioContext = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 128;

        if (audioRef.current && !sourceRef.current) {
          sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
          sourceRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        }
      }
    };

    const drawWaveform = () => {
      if (!analyserRef.current || !isPlaying) return;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteFrequencyData(dataArray);

      const normalized = Array.from(dataArray).map((v) => v / 255);
      setAudioData(normalized);

      animationRef.current = requestAnimationFrame(drawWaveform);
    };

    if (isPlaying) {
      setupAudioContext();
      drawWaveform();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [recording.type, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handlePlayPause = () => {
    const media = recording.type === 'VIDEO' ? videoRef.current : audioRef.current;
    if (!media) return;

    if (isPlaying) {
      media.pause();
    } else {
      media.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    const media = recording.type === 'VIDEO' ? videoRef.current : audioRef.current;
    if (media) {
      setCurrentTime(media.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const media = recording.type === 'VIDEO' ? videoRef.current : audioRef.current;
    if (media) {
      setDuration(media.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const media = recording.type === 'VIDEO' ? videoRef.current : audioRef.current;
    if (!media || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    media.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);

    const media = recording.type === 'VIDEO' ? videoRef.current : audioRef.current;
    if (media) {
      media.volume = newVolume;
    }
  };

  const toggleMute = () => {
    const media = recording.type === 'VIDEO' ? videoRef.current : audioRef.current;
    if (!media) return;

    if (isMuted) {
      media.volume = volume || 1;
      setIsMuted(false);
    } else {
      media.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    const container = document.getElementById('player-container');
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = recording.url;
    link.download = `recording-${recording.id}.${recording.type === 'VIDEO' ? 'mp4' : 'mp3'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    deleteRecordingMutation.mutate(recording.id);
    setShowDeleteConfirm(false);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      id="player-container"
      className={`bg-white/90 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-800 to-slate-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              recording.type === 'VIDEO'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            {recording.type === 'VIDEO' ? (
              <VideoCameraIcon className="h-5 w-5" />
            ) : (
              <MicrophoneIcon className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="font-medium text-white">
              {recording.title || `${recording.type === 'VIDEO' ? 'Video' : 'Audio'} Recording`}
            </h3>
            <p className="text-xs text-gray-400">
              Duration: {formatTime(recording.duration / 1000)}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Video Player */}
      {recording.type === 'VIDEO' && (
        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            src={recording.url}
            poster={recording.thumbnailUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onClick={handlePlayPause}
            className="w-full h-full object-contain cursor-pointer"
          />
          {/* Play overlay */}
          {!isPlaying && (
            <div
              onClick={handlePlayPause}
              className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
            >
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors">
                <PlayIcon className="h-12 w-12 text-white" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Audio Player with Waveform */}
      {recording.type === 'AUDIO' && (
        <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800">
          <audio
            ref={audioRef}
            src={recording.url}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
          />

          {/* Waveform Visualization */}
          <div className="h-32 flex items-end justify-center gap-1 mb-4">
            {audioData.map((value, index) => (
              <div
                key={index}
                className="w-2 bg-gradient-to-t from-indigo-500 to-purple-400 rounded-t transition-all duration-75"
                style={{
                  height: `${Math.max(4, value * 100)}%`,
                  opacity: isPlaying ? 0.8 + value * 0.2 : 0.3,
                }}
              />
            ))}
          </div>

          {/* Large Play Button for Audio */}
          <div className="flex justify-center mb-4">
            <button
              onClick={handlePlayPause}
              className={`p-6 rounded-full transition-all duration-300 ${
                isPlaying
                  ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30'
                  : 'bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/30'
              }`}
            >
              {isPlaying ? (
                <PauseIcon className="h-10 w-10 text-white" />
              ) : (
                <PlayIcon className="h-10 w-10 text-white" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="p-4 bg-gradient-to-r from-slate-800 to-slate-900 space-y-3">
        {/* Progress Bar */}
        <div
          ref={progressRef}
          onClick={handleSeek}
          className="h-2 bg-gray-700 rounded-full cursor-pointer group relative"
        >
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Time Display */}
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span className="font-mono">{formatTime(currentTime)}</span>
          <span className="font-mono">{formatTime(duration)}</span>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="p-2.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
            >
              {isPlaying ? (
                <PauseIcon className="h-5 w-5 text-white" />
              ) : (
                <PlayIcon className="h-5 w-5 text-white" />
              )}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <SpeakerXMarkIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <SpeakerWaveIcon className="h-5 w-5 text-white" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Download"
            >
              <ArrowDownTrayIcon className="h-5 w-5 text-white" />
            </button>

            {/* Delete */}
            {showDeleteButton && (
              <button
                onClick={handleDelete}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                title="Delete"
              >
                <TrashIcon className="h-5 w-5 text-red-400" />
              </button>
            )}

            {/* Fullscreen (Video only) */}
            {recording.type === 'VIDEO' && (
              <button
                onClick={toggleFullscreen}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <ArrowsPointingInIcon className="h-5 w-5 text-white" />
                ) : (
                  <ArrowsPointingOutIcon className="h-5 w-5 text-white" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Delete Recording</h4>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to permanently delete this recording? All data will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteRecordingMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 font-medium transition-colors disabled:opacity-50"
              >
                {deleteRecordingMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
