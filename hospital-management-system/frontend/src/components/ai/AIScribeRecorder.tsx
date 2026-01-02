import { useState, useRef, useCallback, useEffect } from 'react';
import {
  MicrophoneIcon,
  StopIcon,
  PauseIcon,
  PlayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/solid';
import { useAudioRecorder, formatDuration } from '../../hooks/useAudioRecorder';

interface AIScribeRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onRecordingStart?: () => void;
  isProcessing?: boolean;
  disabled?: boolean;
  maxDuration?: number;
}

export default function AIScribeRecorder({
  onRecordingComplete,
  onRecordingStart,
  isProcessing = false,
  disabled = false,
  maxDuration = 600000, // 10 minutes default
}: AIScribeRecorderProps) {
  const [showWaveform, setShowWaveform] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const {
    isRecording,
    isPaused,
    audioBlob,
    audioUrl,
    duration,
    error,
    startRecording: startRecorder,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
  } = useAudioRecorder({
    maxDuration,
    onRecordingComplete: (result) => {
      if (result.blob) {
        onRecordingComplete(result.blob, result.duration);
      }
    },
  });

  // Setup audio visualization
  const setupVisualization = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setShowWaveform(true);
      drawWaveform();
    } catch (err) {
      console.error('Failed to setup visualization:', err);
    }
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;

    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      // Clear canvas with gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#f0f9ff');
      gradient.addColorStop(1, '#e0f2fe');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

        // Create gradient for bars
        const barGradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        barGradient.addColorStop(0, '#3b82f6');
        barGradient.addColorStop(0.5, '#6366f1');
        barGradient.addColorStop(1, '#8b5cf6');

        ctx.fillStyle = barGradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  }, []);

  const handleStartRecording = async () => {
    onRecordingStart?.();
    await setupVisualization();
    await startRecorder();
  };

  const handleStopRecording = () => {
    stopRecording();
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setShowWaveform(false);
  };

  const handleClear = () => {
    clearRecording();
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setShowWaveform(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <MicrophoneIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Audio Recorder</h3>
              <p className="text-sm text-gray-500">
                {isRecording
                  ? 'Recording in progress...'
                  : audioBlob
                  ? 'Recording complete'
                  : 'Click to start recording'}
              </p>
            </div>
          </div>
          {isRecording && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-sm font-medium text-red-600">REC</span>
            </div>
          )}
        </div>
      </div>

      {/* Waveform Visualization */}
      <div className="px-6 py-4">
        <div className="relative h-32 bg-gradient-to-br from-slate-50 to-gray-100 rounded-xl overflow-hidden border border-gray-200">
          {showWaveform && isRecording ? (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              width={800}
              height={128}
            />
          ) : audioBlob ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <CheckCircleIcon className="h-10 w-10 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-700">Recording Ready</p>
                <p className="text-xs text-gray-500">{formatDuration(duration)}</p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-400 rounded-full blur-xl opacity-20 animate-pulse"></div>
                  <MicrophoneIcon className="h-12 w-12 text-gray-400 relative" />
                </div>
                <p className="text-sm text-gray-500 mt-3">Ready to record</p>
              </div>
            </div>
          )}
        </div>

        {/* Duration Display */}
        <div className="mt-4 flex items-center justify-center">
          <div className="px-4 py-2 bg-gray-100 rounded-lg">
            <span className="font-mono text-2xl font-bold text-gray-800">
              {formatDuration(duration)}
            </span>
            <span className="text-sm text-gray-500 ml-2">
              / {formatDuration(maxDuration)}
            </span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-center gap-4">
          {!isRecording && !audioBlob && (
            <button
              onClick={handleStartRecording}
              disabled={disabled || isProcessing}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                <MicrophoneIcon className="h-8 w-8" />
              </div>
            </button>
          )}

          {isRecording && (
            <>
              {/* Pause/Resume Button */}
              <button
                onClick={isPaused ? resumeRecording : pauseRecording}
                className="flex items-center justify-center w-14 h-14 bg-amber-500 hover:bg-amber-600 rounded-full text-white shadow-lg transition-all"
              >
                {isPaused ? (
                  <PlayIcon className="h-6 w-6" />
                ) : (
                  <PauseIcon className="h-6 w-6" />
                )}
              </button>

              {/* Stop Button */}
              <button
                onClick={handleStopRecording}
                className="relative group"
              >
                <div className="absolute inset-0 bg-red-500 rounded-full blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <div className="relative flex items-center justify-center w-20 h-20 bg-gradient-to-r from-red-500 to-rose-600 rounded-full text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                  <StopIcon className="h-8 w-8" />
                </div>
              </button>
            </>
          )}

          {audioBlob && !isRecording && (
            <>
              {/* Audio Preview */}
              {audioUrl && (
                <audio
                  src={audioUrl}
                  controls
                  className="h-10 rounded-lg"
                />
              )}

              {/* Clear Button */}
              <button
                onClick={handleClear}
                disabled={isProcessing}
                className="flex items-center justify-center w-12 h-12 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700 transition-all disabled:opacity-50"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Recording Tips */}
        <div className="mt-4 text-center">
          {isRecording ? (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Tip:</span> Speak clearly and at a normal pace.
              The AI will identify Doctor and Patient voices.
            </p>
          ) : !audioBlob ? (
            <p className="text-sm text-gray-500">
              Click the microphone to start recording your consultation.
              Maximum duration: {Math.floor(maxDuration / 60000)} minutes.
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              Recording complete. You can preview, re-record, or proceed to process.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
