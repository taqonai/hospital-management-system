import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CpuChipIcon,
  ServerStackIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { GlassCard, GlassCardHeader, GlassCardTitle } from '../../components/ui/GlassCard';
import { aiSettingsApi } from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

type Provider = 'openai' | 'ollama';

interface AISettings {
  provider: Provider;
  ollamaEndpoint?: string;
  ollamaModels?: {
    complex?: string;
    simple?: string;
  };
  updatedAt?: string;
  updatedBy?: string;
}

export default function AISettingsPage() {
  const queryClient = useQueryClient();

  // Form state
  const [provider, setProvider] = useState<Provider>('openai');
  const [ollamaEndpoint, setOllamaEndpoint] = useState('');
  const [selectedComplexModel, setSelectedComplexModel] = useState('');
  const [selectedSimpleModel, setSelectedSimpleModel] = useState('');

  // UI state
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');

  // Fetch current settings
  const { data: settings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => aiSettingsApi.getSettings().then(r => r.data.data),
  });

  // Initialize form with current settings
  useEffect(() => {
    if (settings) {
      setProvider(settings.provider || 'openai');
      setOllamaEndpoint(settings.ollamaEndpoint || '');
      setSelectedComplexModel(settings.ollamaModels?.complex || '');
      setSelectedSimpleModel(settings.ollamaModels?.simple || '');

      // If Ollama is configured, fetch models
      if (settings.provider === 'ollama' && settings.ollamaEndpoint) {
        fetchModels(settings.ollamaEndpoint);
      }
    }
  }, [settings]);

  // Fetch Ollama models
  const fetchModels = async (endpoint?: string) => {
    const targetEndpoint = endpoint || ollamaEndpoint;
    if (!targetEndpoint) {
      toast.error('Please enter an Ollama endpoint URL');
      return;
    }

    setIsFetchingModels(true);
    setConnectionStatus('unknown');

    try {
      const response = await aiSettingsApi.getOllamaModels(targetEndpoint);
      const models = response.data.data || [];
      setAvailableModels(models);

      if (models.length > 0) {
        setConnectionStatus('connected');
        toast.success(`Found ${models.length} models`);
      } else {
        setConnectionStatus('failed');
        toast.error('No models found. Is Ollama running?');
      }
    } catch (error: any) {
      setAvailableModels([]);
      setConnectionStatus('failed');
      toast.error(error.response?.data?.error || 'Failed to fetch models');
    } finally {
      setIsFetchingModels(false);
    }
  };

  // Test Ollama connection
  const testConnection = async () => {
    if (!ollamaEndpoint) {
      toast.error('Please enter an Ollama endpoint URL');
      return;
    }

    const modelToTest = selectedSimpleModel || selectedComplexModel;
    if (!modelToTest) {
      toast.error('Please select a model to test');
      return;
    }

    setIsTestingConnection(true);

    try {
      const response = await aiSettingsApi.testOllama(ollamaEndpoint, modelToTest);
      if (response.data.data?.success) {
        toast.success('Connection test successful!');
        setConnectionStatus('connected');
      } else {
        toast.error(response.data.data?.error || 'Test failed');
        setConnectionStatus('failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Connection test failed');
      setConnectionStatus('failed');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: (data: {
      provider: Provider;
      ollamaEndpoint?: string;
      ollamaModels?: { complex?: string; simple?: string };
    }) => aiSettingsApi.updateSettings(data),
    onSuccess: () => {
      toast.success('AI settings saved successfully');
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    },
  });

  const handleSave = () => {
    // Validate if Ollama is selected
    if (provider === 'ollama') {
      if (!ollamaEndpoint) {
        toast.error('Ollama endpoint URL is required');
        return;
      }
      if (!selectedComplexModel && !selectedSimpleModel) {
        toast.error('Please select at least one model');
        return;
      }
    }

    saveMutation.mutate({
      provider,
      ollamaEndpoint: provider === 'ollama' ? ollamaEndpoint : undefined,
      ollamaModels: provider === 'ollama' ? {
        complex: selectedComplexModel || undefined,
        simple: selectedSimpleModel || undefined,
      } : undefined,
    });
  };

  if (isLoadingSettings) {
    return (
      <div className="p-6 flex items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Provider Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure the AI provider for clinical analysis features
        </p>
      </div>

      {/* Provider Selection */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>Select AI Provider</GlassCardTitle>
        </GlassCardHeader>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OpenAI Option */}
            <button
              onClick={() => setProvider('openai')}
              className={clsx(
                'p-6 rounded-xl border-2 transition-all text-left',
                provider === 'openai'
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={clsx(
                  'p-2 rounded-lg',
                  provider === 'openai' ? 'bg-blue-100' : 'bg-gray-100'
                )}>
                  <CpuChipIcon className={clsx(
                    'h-6 w-6',
                    provider === 'openai' ? 'text-blue-600' : 'text-gray-600'
                  )} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">OpenAI</h3>
                  <p className="text-sm text-gray-500">Cloud-hosted AI models</p>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>GPT-4o for complex reasoning</p>
                <p>GPT-4o-mini for simple tasks</p>
                <p>Whisper for voice transcription</p>
              </div>
            </button>

            {/* Ollama Option */}
            <button
              onClick={() => setProvider('ollama')}
              className={clsx(
                'p-6 rounded-xl border-2 transition-all text-left',
                provider === 'ollama'
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={clsx(
                  'p-2 rounded-lg',
                  provider === 'ollama' ? 'bg-blue-100' : 'bg-gray-100'
                )}>
                  <ServerStackIcon className={clsx(
                    'h-6 w-6',
                    provider === 'ollama' ? 'text-blue-600' : 'text-gray-600'
                  )} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Ollama</h3>
                  <p className="text-sm text-gray-500">Self-hosted models</p>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>Llama, Mistral, and more</p>
                <p>Full data privacy</p>
                <p>No API costs</p>
              </div>
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Ollama Configuration */}
      {provider === 'ollama' && (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Ollama Configuration</GlassCardTitle>
          </GlassCardHeader>
          <div className="p-6 space-y-6">
            {/* Endpoint URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ollama Endpoint URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ollamaEndpoint}
                  onChange={(e) => {
                    setOllamaEndpoint(e.target.value);
                    setConnectionStatus('unknown');
                    setAvailableModels([]);
                  }}
                  placeholder="http://localhost:11434"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => fetchModels()}
                  disabled={isFetchingModels || !ollamaEndpoint}
                  className={clsx(
                    'px-4 py-2 rounded-lg flex items-center gap-2 transition-colors',
                    isFetchingModels
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  <ArrowPathIcon className={clsx('h-5 w-5', isFetchingModels && 'animate-spin')} />
                  {isFetchingModels ? 'Loading...' : 'Fetch Models'}
                </button>
              </div>

              {/* Connection Status */}
              {connectionStatus !== 'unknown' && (
                <div className={clsx(
                  'mt-2 flex items-center gap-2 text-sm',
                  connectionStatus === 'connected' ? 'text-green-600' : 'text-red-600'
                )}>
                  {connectionStatus === 'connected' ? (
                    <>
                      <CheckCircleIcon className="h-4 w-4" />
                      Connected - {availableModels.length} models available
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="h-4 w-4" />
                      Connection failed
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Model Selection */}
            {availableModels.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Complex Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Complex Tasks Model
                    <span className="text-gray-400 font-normal ml-1">(Diagnosis, Clinical Reasoning)</span>
                  </label>
                  <select
                    value={selectedComplexModel}
                    onChange={(e) => setSelectedComplexModel(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a model</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Recommended: Large models (70B+) for complex reasoning
                  </p>
                </div>

                {/* Simple Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Simple Tasks Model
                    <span className="text-gray-400 font-normal ml-1">(Chat, Entity Extraction)</span>
                  </label>
                  <select
                    value={selectedSimpleModel}
                    onChange={(e) => setSelectedSimpleModel(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a model</option>
                    {availableModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Smaller models (7B-13B) are faster for simple tasks
                  </p>
                </div>
              </div>
            )}

            {/* Test Connection Button */}
            {availableModels.length > 0 && (selectedComplexModel || selectedSimpleModel) && (
              <div>
                <button
                  onClick={testConnection}
                  disabled={isTestingConnection}
                  className={clsx(
                    'px-6 py-2 rounded-lg flex items-center gap-2 transition-colors',
                    isTestingConnection
                      ? 'bg-blue-400 text-white cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  )}
                >
                  {isTestingConnection ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-5 w-5" />
                      Test Connection
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* Important Notes */}
      <GlassCard className="border-amber-200 bg-amber-50/50">
        <div className="p-6">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 mb-2">Important Notes</h3>
              <ul className="text-sm text-amber-700 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">-</span>
                  Medical image analysis (X-ray, CT, MRI) always uses OpenAI GPT-4o Vision for best accuracy
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">-</span>
                  Voice transcription always uses OpenAI Whisper
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">-</span>
                  If Ollama becomes unavailable, AI features will show an error message
                </li>
              </ul>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Current Status */}
      {settings && (
        <GlassCard>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Current Configuration</h3>
                <p className="text-lg font-semibold text-gray-900 capitalize">
                  {settings.provider || 'OpenAI'}
                  {settings.provider === 'ollama' && settings.ollamaEndpoint && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({settings.ollamaEndpoint})
                    </span>
                  )}
                </p>
              </div>
              {settings.updatedAt && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">Last updated</p>
                  <p className="text-sm text-gray-600">
                    {new Date(settings.updatedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <button
          onClick={() => {
            // Reset to current settings
            if (settings) {
              setProvider(settings.provider || 'openai');
              setOllamaEndpoint(settings.ollamaEndpoint || '');
              setSelectedComplexModel(settings.ollamaModels?.complex || '');
              setSelectedSimpleModel(settings.ollamaModels?.simple || '');
            }
          }}
          className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className={clsx(
            'px-6 py-2 rounded-lg flex items-center gap-2 transition-colors',
            saveMutation.isPending
              ? 'bg-blue-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {saveMutation.isPending ? (
            <>
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </button>
      </div>
    </div>
  );
}
