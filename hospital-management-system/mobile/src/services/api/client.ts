import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { secureStorage } from '../securestore/secureStorage';
import { ApiResponse } from '../../types';
import { env } from '../../config/env';

// API base URL from environment configuration
const API_BASE_URL = env.API_URL;

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to add timeout to any promise
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// Request interceptor - add auth token (with timeout to prevent hanging)
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 3 second timeout for getting token - if it hangs, proceed without token
    const token = await withTimeout(secureStorage.getAccessToken(), 3000);

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If 401 and not already retried, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // 3 second timeout for getting refresh token
        const refreshToken = await withTimeout(secureStorage.getRefreshToken(), 3000);

        if (!refreshToken) {
          // No refresh token, clear session
          await withTimeout(secureStorage.clearAll(), 3000);
          // Navigation to login will be handled by the auth state listener
          return Promise.reject(error);
        }

        // Attempt to refresh token (with its own timeout via axios)
        const response = await axios.post(`${API_BASE_URL}/patient-auth/refresh-token`, {
          refreshToken,
        }, { timeout: 10000 });

        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        // Save new tokens (with timeout)
        await withTimeout(secureStorage.setTokens(accessToken, newRefreshToken || refreshToken), 3000);

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear session
        await withTimeout(secureStorage.clearAll(), 3000);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Helper function to extract data from API response
export function extractData<T>(response: { data: ApiResponse<T> }): T {
  if (response.data.success && response.data.data !== undefined) {
    return response.data.data;
  }
  throw new Error(response.data.message || 'API request failed');
}

// Set API base URL dynamically (for environment switching)
export function setApiBaseUrl(url: string): void {
  api.defaults.baseURL = url;
}

export default api;
