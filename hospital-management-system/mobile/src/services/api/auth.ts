import api from './client';
import { ApiResponse, PatientUser } from '../../types';

export interface LoginCredentials {
  email: string;
  password: string;
  hospitalId?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  hospitalId?: string;
}

export interface OTPRequest {
  mobile: string;
  countryCode?: string;
  hospitalId?: string;
}

export interface OTPVerification {
  mobile: string;
  otp: string;
  hospitalId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  patient: PatientUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const authApi = {
  // Email/password login
  login: (credentials: LoginCredentials) =>
    api.post<ApiResponse<AuthResponse>>('/patient-auth/login', credentials),

  // Patient registration
  register: (data: RegisterData) => {
    // Backend expects 'mobile' instead of 'phone'
    const { phone, ...rest } = data;
    return api.post<ApiResponse<AuthResponse>>('/patient-auth/register', {
      ...rest,
      mobile: phone,
    });
  },

  // Request SMS OTP
  sendOTP: (data: OTPRequest) =>
    api.post<ApiResponse<{ expiresIn: number }>>('/patient-auth/send-otp', data),

  // Verify SMS OTP
  verifyOTP: (data: OTPVerification) =>
    api.post<ApiResponse<AuthResponse>>('/patient-auth/verify-otp', data),

  // Request WhatsApp OTP
  sendWhatsAppOTP: (data: OTPRequest) =>
    api.post<ApiResponse<{ expiresIn: number }>>('/patient-auth/send-whatsapp-otp', data),

  // Refresh access token
  refreshToken: (refreshToken: string) =>
    api.post<ApiResponse<{ accessToken: string; refreshToken?: string }>>('/patient-auth/refresh-token', {
      refreshToken,
    }),

  // Get patient profile
  getProfile: () =>
    api.get<ApiResponse<PatientUser>>('/patient-auth/profile'),

  // Update patient profile
  updateProfile: (data: Partial<PatientUser>) =>
    api.put<ApiResponse<PatientUser>>('/patient-auth/profile', data),

  // Change password
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<ApiResponse<{ message: string }>>('/patient-auth/change-password', {
      currentPassword,
      newPassword,
    }),

  // Logout
  logout: () =>
    api.post<ApiResponse<{ message: string }>>('/patient-auth/logout'),

  // Check if account can be claimed
  canClaimAccount: (email: string, hospitalId?: string) =>
    api.post<ApiResponse<{ canClaim: boolean; patientId?: string }>>('/patient-auth/can-claim', {
      email,
      hospitalId,
    }),

  // Claim pre-created patient account
  claimAccount: (data: { email: string; password: string; patientId: string }) =>
    api.post<ApiResponse<AuthResponse>>('/patient-auth/claim-account', data),
};

export default authApi;
