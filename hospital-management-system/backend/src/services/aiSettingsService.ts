import prisma from '../config/database';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import axios from 'axios';
import logger from '../utils/logger';
import { Prisma } from '@prisma/client';

// Types for AI provider settings
export interface AIProviderSettings {
  provider: 'openai' | 'ollama';
  ollamaEndpoint?: string;
  ollamaModels?: {
    complex?: string;
    simple?: string;
  };
  updatedAt?: string;
  updatedBy?: string;
  [key: string]: string | undefined | { complex?: string; simple?: string };  // Index signature for JSON compatibility
}

export interface OllamaHealthResponse {
  available: boolean;
  error?: string;
  statusCode?: number;
}

export interface OllamaTestResult {
  success: boolean;
  response?: string;
  model?: string;
  error?: string;
}

class AISettingsService {
  private aiServiceUrl: string;

  constructor() {
    this.aiServiceUrl = config.ai.serviceUrl;
  }

  /**
   * Get AI provider settings for a hospital
   */
  async getSettings(hospitalId: string): Promise<AIProviderSettings> {
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { settings: true },
    });

    if (!hospital) {
      throw new AppError('Hospital not found', 404);
    }

    const settings = (hospital.settings as Record<string, any>) || {};
    const aiSettings = settings.aiProvider || { provider: 'openai' };

    return aiSettings as AIProviderSettings;
  }

  /**
   * Update AI provider settings for a hospital
   */
  async updateSettings(
    hospitalId: string,
    newSettings: Partial<AIProviderSettings>,
    userId: string
  ): Promise<AIProviderSettings> {
    const { provider, ollamaEndpoint, ollamaModels } = newSettings;

    // Validate provider
    if (provider && !['openai', 'ollama'].includes(provider)) {
      throw new AppError('Invalid provider. Must be "openai" or "ollama"', 400);
    }

    // If switching to Ollama, validate endpoint is provided and reachable
    if (provider === 'ollama') {
      if (!ollamaEndpoint) {
        throw new AppError('Ollama endpoint URL is required when using Ollama provider', 400);
      }

      // Validate endpoint is reachable
      const health = await this.checkOllamaHealth(ollamaEndpoint);
      if (!health.available) {
        throw new AppError(
          `Cannot connect to Ollama endpoint: ${health.error || 'Unknown error'}`,
          400
        );
      }

      // Validate at least one model is specified
      if (!ollamaModels?.complex && !ollamaModels?.simple) {
        throw new AppError('At least one Ollama model must be specified', 400);
      }
    }

    // Get current hospital settings
    const hospital = await prisma.hospital.findUnique({
      where: { id: hospitalId },
      select: { settings: true },
    });

    if (!hospital) {
      throw new AppError('Hospital not found', 404);
    }

    const existingSettings = (hospital.settings as Record<string, any>) || {};

    // Build new AI provider settings
    const updatedAISettings: AIProviderSettings = {
      provider: provider || 'openai',
      ollamaEndpoint: provider === 'ollama' ? ollamaEndpoint : undefined,
      ollamaModels: provider === 'ollama' ? ollamaModels : undefined,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    // Update hospital settings
    await prisma.hospital.update({
      where: { id: hospitalId },
      data: {
        settings: {
          ...existingSettings,
          aiProvider: updatedAISettings,
        } as Prisma.InputJsonValue,
      },
    });

    logger.info(`AI settings updated for hospital ${hospitalId} by user ${userId}`, {
      provider: updatedAISettings.provider,
      ollamaEndpoint: updatedAISettings.ollamaEndpoint,
    });

    return updatedAISettings;
  }

  /**
   * Fetch available models from Ollama endpoint
   */
  async fetchOllamaModels(endpoint: string): Promise<string[]> {
    try {
      // Call the AI service endpoint which proxies to Ollama
      const response = await axios.get(`${this.aiServiceUrl}/api/ollama/models`, {
        params: { endpoint },
        timeout: 15000,
      });

      if (response.data.success) {
        return response.data.models || [];
      }

      return [];
    } catch (error: any) {
      logger.error('Failed to fetch Ollama models', {
        endpoint,
        error: error.message,
      });

      // Try direct connection to Ollama as fallback
      try {
        const directResponse = await axios.get(`${endpoint}/api/tags`, {
          timeout: 10000,
        });

        if (directResponse.status === 200) {
          return (directResponse.data.models || []).map((m: any) => m.name);
        }
      } catch (directError: any) {
        logger.error('Direct Ollama connection also failed', {
          endpoint,
          error: directError.message,
        });
      }

      throw new AppError(`Cannot fetch models from Ollama: ${error.message}`, 400);
    }
  }

  /**
   * Check Ollama endpoint health
   */
  async checkOllamaHealth(endpoint: string): Promise<OllamaHealthResponse> {
    try {
      // Call the AI service endpoint
      const response = await axios.get(`${this.aiServiceUrl}/api/ollama/health`, {
        params: { endpoint },
        timeout: 10000,
      });

      return {
        available: response.data.success || response.data.available,
        statusCode: response.data.status_code,
      };
    } catch (error: any) {
      // Try direct connection as fallback
      try {
        const directResponse = await axios.get(`${endpoint}/api/tags`, {
          timeout: 5000,
        });

        return {
          available: directResponse.status === 200,
          statusCode: directResponse.status,
        };
      } catch (directError: any) {
        return {
          available: false,
          error: directError.message || 'Cannot connect to Ollama endpoint',
        };
      }
    }
  }

  /**
   * Test Ollama completion with a specific model
   */
  async testOllamaCompletion(endpoint: string, model: string): Promise<OllamaTestResult> {
    try {
      // Call the AI service test endpoint
      const response = await axios.post(
        `${this.aiServiceUrl}/api/ollama/test`,
        { endpoint, model },
        { timeout: 30000 }
      );

      return {
        success: response.data.success,
        response: response.data.response,
        model: response.data.model,
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.detail || error.message || 'Test completion failed';

      return {
        success: false,
        error: errorMessage,
        model,
      };
    }
  }

  /**
   * Get current provider status for a hospital
   */
  async getProviderStatus(hospitalId: string): Promise<{
    provider: string;
    available: boolean;
    details: Record<string, any>;
  }> {
    const settings = await this.getSettings(hospitalId);

    if (settings.provider === 'ollama' && settings.ollamaEndpoint) {
      const health = await this.checkOllamaHealth(settings.ollamaEndpoint);

      return {
        provider: 'ollama',
        available: health.available,
        details: {
          endpoint: settings.ollamaEndpoint,
          models: settings.ollamaModels,
          health,
        },
      };
    }

    // Default to OpenAI status
    try {
      const response = await axios.get(`${this.aiServiceUrl}/health`, {
        timeout: 5000,
      });

      return {
        provider: 'openai',
        available: response.data.openai?.available || false,
        details: response.data.openai || {},
      };
    } catch (error) {
      return {
        provider: 'openai',
        available: false,
        details: { error: 'Cannot reach AI service' },
      };
    }
  }
}

export const aiSettingsService = new AISettingsService();
