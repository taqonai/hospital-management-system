export { default as api, extractData, setApiBaseUrl } from './client';
export { authApi } from './auth';
export { patientPortalApi } from './patientPortal';
export { symptomCheckerApi } from './symptomChecker';

// Re-export types
export type { LoginCredentials, RegisterData, OTPRequest, OTPVerification, AuthTokens, AuthResponse } from './auth';
export type { StartSessionData, SessionResponse, RespondData } from './symptomChecker';
