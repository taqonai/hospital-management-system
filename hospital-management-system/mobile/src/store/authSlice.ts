import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { PatientUser } from '../types';
import { secureStorage } from '../services/securestore/secureStorage';
import { authApi, AuthResponse, LoginCredentials, RegisterData, OTPVerification } from '../services/api';
import { biometricService, BiometricStatus } from '../services/biometric/biometricService';

interface AuthState {
  user: PatientUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  biometricStatus: BiometricStatus | null;
  isBiometricEnabled: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
  biometricStatus: null,
  isBiometricEnabled: false,
};

// Async thunks
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    try {
      const [token, user, biometricStatus, isBiometricEnabled] = await Promise.all([
        secureStorage.getAccessToken(),
        secureStorage.getPatientUser(),
        biometricService.checkAvailability(),
        secureStorage.isBiometricEnabled(),
      ]);

      if (token && user) {
        return { user, isAuthenticated: true, biometricStatus, isBiometricEnabled };
      }

      return { user: null, isAuthenticated: false, biometricStatus, isBiometricEnabled };
    } catch (error) {
      return rejectWithValue('Failed to initialize auth');
    }
  }
);

export const loginWithEmail = createAsyncThunk(
  'auth/loginWithEmail',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      const data = response.data.data as AuthResponse;

      await secureStorage.setTokens(data.accessToken, data.refreshToken);
      await secureStorage.setPatientUser(data.patient);
      await secureStorage.setLastLoginEmail(credentials.email);

      return data.patient;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Login failed';
      return rejectWithValue(message);
    }
  }
);

export const loginWithOTP = createAsyncThunk(
  'auth/loginWithOTP',
  async (data: OTPVerification, { rejectWithValue }) => {
    try {
      const response = await authApi.verifyOTP(data);
      const result = response.data.data as AuthResponse;

      await secureStorage.setTokens(result.accessToken, result.refreshToken);
      await secureStorage.setPatientUser(result.patient);

      return result.patient;
    } catch (error: any) {
      const message = error.response?.data?.message || 'OTP verification failed';
      return rejectWithValue(message);
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (data: RegisterData, { rejectWithValue }) => {
    try {
      const response = await authApi.register(data);
      const result = response.data.data as AuthResponse;

      await secureStorage.setTokens(result.accessToken, result.refreshToken);
      await secureStorage.setPatientUser(result.patient);
      await secureStorage.setLastLoginEmail(data.email);

      return result.patient;
    } catch (error: any) {
      // Extract validation errors from backend response
      const responseData = error.response?.data;

      // Check for field-specific validation errors
      if (responseData?.errors && Array.isArray(responseData.errors)) {
        // Format: [{ field: "body.mobile", message: "..." }]
        const errorMessages = responseData.errors
          .map((err: { field: string; message: string }) => {
            // Remove "body." prefix from field name for cleaner display
            const fieldName = err.field.replace('body.', '');
            return `${fieldName}: ${err.message}`;
          })
          .join('\n');
        return rejectWithValue(errorMessages || 'Validation failed');
      }

      // Fallback to general error message
      const message = responseData?.error || responseData?.message || 'Registration failed';
      return rejectWithValue(message);
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.logout();
    } catch (error) {
      // Continue with local logout even if API fails
    }

    await secureStorage.clearAll();
    return null;
  }
);

export const refreshProfile = createAsyncThunk(
  'auth/refreshProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getProfile();
      const user = response.data.data as PatientUser;

      await secureStorage.setPatientUser(user);

      return user;
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to refresh profile';
      return rejectWithValue(message);
    }
  }
);

export const loginWithBiometric = createAsyncThunk(
  'auth/loginWithBiometric',
  async (_, { rejectWithValue }) => {
    try {
      const result = await biometricService.performBiometricLogin();

      if (!result.success) {
        return rejectWithValue(result.error || 'Biometric authentication failed');
      }

      // Get the stored user data
      const user = await secureStorage.getPatientUser();
      if (!user) {
        return rejectWithValue('No stored credentials found');
      }

      return user;
    } catch (error: any) {
      return rejectWithValue('Biometric authentication failed');
    }
  }
);

export const enableBiometric = createAsyncThunk(
  'auth/enableBiometric',
  async (_, { rejectWithValue }) => {
    try {
      const result = await biometricService.enableBiometricLogin();

      if (!result.success) {
        return rejectWithValue(result.error || 'Failed to enable biometric login');
      }

      return true;
    } catch (error: any) {
      return rejectWithValue('Failed to enable biometric login');
    }
  }
);

export const disableBiometric = createAsyncThunk(
  'auth/disableBiometric',
  async () => {
    await biometricService.disableBiometricLogin();
    return false;
  }
);

export const checkBiometricStatus = createAsyncThunk(
  'auth/checkBiometricStatus',
  async () => {
    const [status, isEnabled] = await Promise.all([
      biometricService.checkAvailability(),
      secureStorage.isBiometricEnabled(),
    ]);
    return { status, isEnabled };
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUser: (state, action: PayloadAction<PatientUser>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Initialize auth
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.user = action.payload.user;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.biometricStatus = action.payload.biometricStatus;
        state.isBiometricEnabled = action.payload.isBiometricEnabled;
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isLoading = false;
        state.isInitialized = true;
        state.isAuthenticated = false;
      });

    // Login with email
    builder
      .addCase(loginWithEmail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithEmail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginWithEmail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Login with OTP
    builder
      .addCase(loginWithOTP.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithOTP.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginWithOTP.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Register
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Logout
    builder
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.error = null;
      });

    // Refresh profile
    builder
      .addCase(refreshProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });

    // Login with biometric
    builder
      .addCase(loginWithBiometric.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginWithBiometric.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginWithBiometric.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Enable biometric
    builder
      .addCase(enableBiometric.fulfilled, (state, action) => {
        state.isBiometricEnabled = action.payload;
      })
      .addCase(enableBiometric.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Disable biometric
    builder
      .addCase(disableBiometric.fulfilled, (state, action) => {
        state.isBiometricEnabled = action.payload;
      });

    // Check biometric status
    builder
      .addCase(checkBiometricStatus.fulfilled, (state, action) => {
        state.biometricStatus = action.payload.status;
        state.isBiometricEnabled = action.payload.isEnabled;
      });
  },
});

export const { clearError, setUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;
