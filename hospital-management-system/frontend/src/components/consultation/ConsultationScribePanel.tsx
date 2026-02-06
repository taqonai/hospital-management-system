import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { ScribeStatus } from '../../hooks/useConsultationScribe';

// ============ Types ============

interface ConsultationScribePanelProps {
  status: ScribeStatus;
  duration: number;
  isEnabled: boolean;
  error?: string | null;
  onToggle: () => void;
}

// ============ Helpers ============

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// ============ Toggle Switch ============

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
        enabled ? 'bg-purple-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ============ Component ============

export default function ConsultationScribePanel({
  status,
  duration,
  isEnabled,
  error,
  onToggle,
}: ConsultationScribePanelProps) {

  // Disabled state
  if (!isEnabled) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base">🎙️</span>
          <span className="text-sm font-medium text-gray-500">AI Scribe (Off)</span>
        </div>
        <ToggleSwitch enabled={false} onToggle={onToggle} />
      </div>
    );
  }

  // Recording state
  if (status === 'recording') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <span className="text-sm font-medium text-gray-800">AI Scribe Listening</span>
          <span className="text-sm font-mono text-gray-600 bg-white/60 px-2 py-0.5 rounded">
            {formatDuration(duration)}
          </span>
        </div>
        <ToggleSwitch enabled={true} onToggle={onToggle} />
      </div>
    );
  }

  // Processing state
  if (status === 'processing') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowPathIcon className="h-4 w-4 text-blue-500 animate-spin" />
          <span className="text-sm font-medium text-blue-800">Analyzing conversation...</span>
        </div>
        <ToggleSwitch enabled={true} onToggle={onToggle} />
      </div>
    );
  }

  // Done state
  if (status === 'done') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base">✅</span>
          <span className="text-sm font-medium text-green-800">Chief complaint & notes auto-filled</span>
        </div>
        <ToggleSwitch enabled={true} onToggle={onToggle} />
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base">⚠️</span>
          <span className="text-sm font-medium text-amber-800">Could not process. Type manually.</span>
          {error && <span className="text-xs text-amber-600 hidden sm:inline">({error})</span>}
        </div>
        <ToggleSwitch enabled={true} onToggle={onToggle} />
      </div>
    );
  }

  // Idle state (waiting for auto-start / mic permission)
  return (
    <div className="bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-base">🎙️</span>
        <span className="text-sm font-medium text-purple-800">AI Scribe</span>
        <span className="text-xs text-purple-600">Waiting for microphone access...</span>
      </div>
      <ToggleSwitch enabled={true} onToggle={onToggle} />
    </div>
  );
}
