import type { AutoScribeStatus } from '../../hooks/useAutoScribe';

interface ScribeIndicatorProps {
  status: AutoScribeStatus;
  duration: number;
  error: string | null;
  isEnabled: boolean;
  onToggle: () => void;
  onStopEarly: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ScribeIndicator({ status, duration, error, isEnabled, onToggle, onStopEarly }: ScribeIndicatorProps) {
  if (!isEnabled) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
        <span className="text-sm text-gray-500 flex items-center gap-2">
          <span>🎙️</span> AI Scribe Off
        </span>
        <button onClick={onToggle} className="text-xs px-2.5 py-1 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors">
          Enable
        </button>
      </div>
    );
  }

  if (status === 'recording') {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg">
        <span className="text-sm text-red-700 flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
          AI Scribe Recording
          <span className="font-mono text-red-600">{formatTime(duration)}</span>
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onStopEarly} className="text-xs px-2.5 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
            Stop
          </button>
          <button onClick={onToggle} className="text-xs px-2.5 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors">
            Off
          </button>
        </div>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="flex items-center px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-sm text-blue-700 flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Processing transcript...
        </span>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg">
        <span className="text-sm text-green-700 flex items-center gap-2">
          <span>✅</span> Transcript applied
        </span>
        <button onClick={onToggle} className="text-xs px-2.5 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
          Off
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
        <span className="text-sm text-amber-700 flex items-center gap-2">
          <span>⚠️</span> {error || 'An error occurred'}
        </span>
        <button onClick={onToggle} className="text-xs px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">
          Off
        </button>
      </div>
    );
  }

  // idle
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
      <span className="text-sm text-gray-600 flex items-center gap-2">
        <span>🎙️</span> AI Scribe Ready
      </span>
      <button onClick={onToggle} className="text-xs px-2.5 py-1 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors">
        Off
      </button>
    </div>
  );
}
