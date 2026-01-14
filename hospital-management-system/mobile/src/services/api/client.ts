import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { secureStorage } from '../storage/secureStorage';
import { ApiResponse } from '../../types';
import { env } from '../../config/env';

// API base URL from environment configuration
const API_BASE_URL = env.API_URL;

// Create axios instance with default timeout
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create axios instance with extended timeout for AI operations
// AI calls (symptom checker, health assistant) can take 60-90 seconds for GPT-4 analysis
export const aiApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000, // 90 seconds for AI operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
const createRequestInterceptor = (axiosInstance: typeof api) => {
  axiosInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = await secureStorage.getAccessToken();

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );
};

// Apply request interceptor to both API instances
createRequestInterceptor(api);
createRequestInterceptor(aiApi);

// Response interceptor - handle token refresh
const createResponseInterceptor = (axiosInstance: typeof api) => {
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      // If 401 and not already retried, attempt token refresh
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = await secureStorage.getRefreshToken();

          if (!refreshToken) {
            // No refresh token, clear session
            await secureStorage.clearAll();
            // Navigation to login will be handled by the auth state listener
            return Promise.reject(error);
          }

          // Attempt to refresh token
          const response = await axios.post(`${API_BASE_URL}/patient-auth/refresh-token`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data.data;

          // Save new tokens
          await secureStorage.setTokens(accessToken, newRefreshToken || refreshToken);

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }

          return axiosInstance(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear session
          await secureStorage.clearAll();
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );
};

// Apply interceptors to both API instances
createResponseInterceptor(api);
createResponseInterceptor(aiApi);

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

export { aiApi };
export default api;
