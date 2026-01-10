import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { PatientUser } from '../types';
import { secureStorage } from '../services/storage/secureStorage';
import { authApi, AuthResponse, LoginCredentials, RegisterData, OTPVerification } from '../services/api';

interface AuthState {
  user: PatientUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,
};

// Async thunks
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    try {
      const [token, user] = await Promise.all([
        secureStorage.getAccessToken(),
        secureStorage.getPatientUser(),
      ]);

      if (token && user) {
        return { user, isAuthenticated: true };
      }

      return { user: null, isAuthenticated: false };
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
      const message = error.response?.data?.message || 'Registration failed';
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
  },
});

export const { clearError, setUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;
