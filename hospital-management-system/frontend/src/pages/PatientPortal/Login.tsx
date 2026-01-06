import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  EnvelopeIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  DevicePhoneMobileIcon,
  ChatBubbleLeftIcon,
  UserIcon,
  CalendarDaysIcon,
  ShieldCheckIcon,
  HeartIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import axios from 'axios';

// Types
interface LoginFormData {
  email: string;
  password: string;
}

interface OTPFormData {
  mobile: string;
  countryCode: string;
  otp: string[];
}

interface RegistrationFormData {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  countryCode: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  gender: string;
  agreeToTerms: boolean;
}

// Country codes for phone number
const countryCodes = [
  { code: '+1', country: 'US', flag: 'US' },
  { code: '+91', country: 'IN', flag: 'IN' },
  { code: '+44', country: 'UK', flag: 'GB' },
  { code: '+61', country: 'AU', flag: 'AU' },
  { code: '+86', country: 'CN', flag: 'CN' },
  { code: '+81', country: 'JP', flag: 'JP' },
  { code: '+49', country: 'DE', flag: 'DE' },
  { code: '+33', country: 'FR', flag: 'FR' },
  { code: '+971', country: 'UAE', flag: 'AE' },
  { code: '+65', country: 'SG', flag: 'SG' },
];

// API base URL
const API_URL = '/api/v1';

export default function PatientPortalLogin() {
  const navigate = useNavigate();

  // Main state
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState<'email' | 'mobile' | 'whatsapp'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Login form state
  const [loginData, setLoginData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  // OTP form state
  const [otpData, setOtpData] = useState<OTPFormData>({
    mobile: '',
    countryCode: '+1',
    otp: ['', '', '', '', '', ''],
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpSessionId, setOtpSessionId] = useState<string | null>(null);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Registration form state
  const [registrationData, setRegistrationData] = useState<RegistrationFormData>({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    countryCode: '+1',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    gender: '',
    agreeToTerms: false,
  });
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Password validation
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

  // OTP Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpTimer]);

  // Password strength calculator
  useEffect(() => {
    const password = registrationData.password;
    if (password.length < 6) {
      setPasswordStrength('weak');
    } else if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      setPasswordStrength('strong');
    } else {
      setPasswordStrength('medium');
    }
  }, [registrationData.password]);

  // Clear error/success messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Handle email/password login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/patient-auth/login`, {
        email: loginData.email,
        password: loginData.password,
      });

      const { accessToken, refreshToken, patient } = response.data.data;

      // Store tokens in localStorage (separate from staff tokens)
      localStorage.setItem('patientAccessToken', accessToken);
      localStorage.setItem('patientRefreshToken', refreshToken);
      localStorage.setItem('patientUser', JSON.stringify(patient));

      setSuccess('Login successful! Redirecting...');
      setTimeout(() => navigate('/patient-portal/dashboard'), 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle send OTP
  const handleSendOTP = async (type: 'sms' | 'whatsapp') => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/patient-auth/send-otp`, {
        mobile: `${otpData.countryCode}${otpData.mobile}`,
        type,
      });

      setOtpSessionId(response.data.data.sessionId);
      setOtpSent(true);
      setOtpTimer(30);
      setSuccess(`OTP sent to ${otpData.countryCode} ${otpData.mobile}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP input change
  const handleOTPChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }

    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpData.otp];
    newOtp[index] = value;
    setOtpData({ ...otpData, otp: newOtp });

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle OTP key down for backspace
  const handleOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpData.otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle OTP paste
  const handleOTPPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otpData.otp];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtpData({ ...otpData, otp: newOtp });

    const focusIndex = Math.min(pastedData.length, 5);
    otpInputRefs.current[focusIndex]?.focus();
  };

  // Handle OTP verification
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const otp = otpData.otp.join('');
    if (otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/patient-auth/verify-otp`, {
        sessionId: otpSessionId,
        otp,
        mobile: `${otpData.countryCode}${otpData.mobile}`,
      });

      const { accessToken, refreshToken, patient } = response.data.data;

      localStorage.setItem('patientAccessToken', accessToken);
      localStorage.setItem('patientRefreshToken', refreshToken);
      localStorage.setItem('patientUser', JSON.stringify(patient));

      setSuccess('Verification successful! Redirecting...');
      setTimeout(() => navigate('/patient-portal/dashboard'), 1000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend OTP
  const handleResendOTP = () => {
    setOtpData({ ...otpData, otp: ['', '', '', '', '', ''] });
    handleSendOTP(activeTab === 'whatsapp' ? 'whatsapp' : 'sms');
  };

  // Handle registration
  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!registrationData.firstName.trim() || !registrationData.lastName.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!registrationData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!registrationData.mobile.match(/^\d{10}$/)) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (registrationData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (registrationData.password !== registrationData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!registrationData.dateOfBirth) {
      setError('Please enter your date of birth');
      return;
    }

    if (!registrationData.gender) {
      setError('Please select your gender');
      return;
    }

    if (!registrationData.agreeToTerms) {
      setError('Please agree to the Terms & Conditions');
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/patient-auth/register`, {
        firstName: registrationData.firstName,
        lastName: registrationData.lastName,
        email: registrationData.email,
        mobile: `${registrationData.countryCode}${registrationData.mobile}`,
        password: registrationData.password,
        dateOfBirth: registrationData.dateOfBirth,
        gender: registrationData.gender,
      });

      setSuccess('Registration successful! Please login with your credentials.');
      setIsRegistering(false);
      setLoginData({ email: registrationData.email, password: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset OTP state when switching tabs
  const handleTabChange = useCallback((tab: 'email' | 'mobile' | 'whatsapp') => {
    setActiveTab(tab);
    setOtpSent(false);
    setOtpData({
      ...otpData,
      otp: ['', '', '', '', '', ''],
    });
    setError(null);
  }, [otpData]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-teal-500 to-cyan-400">
        {/* Animated Circles */}
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-teal-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-6000"></div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      </div>

      {/* Content */}
      <div className="relative min-h-screen flex flex-col lg:flex-row items-center justify-center p-4 lg:p-8 gap-8">
        {/* Left Side - Branding */}
        <div className="w-full lg:w-1/2 max-w-xl text-center lg:text-left text-white space-y-6 px-4">
          {/* Logo */}
          <div className="flex items-center justify-center lg:justify-start gap-3">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center">
              <HeartSolid className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">HealthCare Plus</h1>
              <p className="text-white/70 text-sm">Patient Portal</p>
            </div>
          </div>

          {/* Hero Text */}
          <div className="space-y-4 mt-8">
            <h2 className="text-3xl lg:text-5xl font-bold leading-tight">
              Your Health,
              <br />
              <span className="text-cyan-200">Your Control</span>
            </h2>
            <p className="text-lg text-white/80 max-w-md mx-auto lg:mx-0">
              Access your medical records, book appointments, view test results, and communicate with your healthcare providers all in one place.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-4 mt-8">
            <FeatureCard
              icon={CalendarDaysIcon}
              title="Easy Scheduling"
              description="Book appointments 24/7"
            />
            <FeatureCard
              icon={ShieldCheckIcon}
              title="Secure Access"
              description="HIPAA compliant platform"
            />
            <FeatureCard
              icon={DevicePhoneMobileIcon}
              title="Mobile Ready"
              description="Access from any device"
            />
            <FeatureCard
              icon={HeartIcon}
              title="Health Tracking"
              description="Monitor your wellness"
            />
          </div>

          {/* Testimonial */}
          <div className="hidden lg:block mt-8 p-6 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20">
            <p className="text-white/90 italic">
              "The patient portal has made managing my health so much easier. I can see my test results and message my doctor without having to call the office."
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-white">Sarah Johnson</p>
                <p className="text-sm text-white/60">Patient since 2023</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login/Registration Card */}
        <div className="w-full lg:w-1/2 max-w-md">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
            {/* Card Header */}
            <div className="p-6 pb-0">
              <h3 className="text-2xl font-bold text-gray-900 text-center">
                {isRegistering ? 'Create Account' : 'Welcome Back'}
              </h3>
              <p className="text-gray-500 text-center mt-2">
                {isRegistering
                  ? 'Register to access your health portal'
                  : 'Sign in to access your patient portal'}
              </p>
            </div>

            {/* Error/Success Messages */}
            {(error || success) && (
              <div className="px-6 pt-4">
                <div
                  className={`p-4 rounded-xl flex items-center gap-3 ${
                    error
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-green-50 text-green-700 border border-green-200'
                  }`}
                >
                  {error ? (
                    <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
                  )}
                  <p className="text-sm">{error || success}</p>
                </div>
              </div>
            )}

            {isRegistering ? (
              /* Registration Form */
              <RegistrationForm
                data={registrationData}
                setData={setRegistrationData}
                onSubmit={handleRegistration}
                isLoading={isLoading}
                showPassword={showRegPassword}
                setShowPassword={setShowRegPassword}
                showConfirmPassword={showRegConfirmPassword}
                setShowConfirmPassword={setShowRegConfirmPassword}
                passwordStrength={passwordStrength}
                countryCodes={countryCodes}
                onSwitchToLogin={() => {
                  setIsRegistering(false);
                  setError(null);
                }}
              />
            ) : (
              /* Login Form */
              <div className="p-6">
                {/* Login Tabs */}
                <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
                  <TabButton
                    active={activeTab === 'email'}
                    onClick={() => handleTabChange('email')}
                    icon={EnvelopeIcon}
                    label="Email"
                  />
                  <TabButton
                    active={activeTab === 'mobile'}
                    onClick={() => handleTabChange('mobile')}
                    icon={DevicePhoneMobileIcon}
                    label="Mobile"
                  />
                  <TabButton
                    active={activeTab === 'whatsapp'}
                    onClick={() => handleTabChange('whatsapp')}
                    icon={ChatBubbleLeftIcon}
                    label="WhatsApp"
                  />
                </div>

                {/* Email/Password Login */}
                {activeTab === 'email' && (
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          value={loginData.email}
                          onChange={(e) =>
                            setLoginData({ ...loginData, email: e.target.value })
                          }
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="your@email.com"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={loginData.password}
                          onChange={(e) =>
                            setLoginData({ ...loginData, password: e.target.value })
                          }
                          className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                          placeholder="Enter your password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? (
                            <EyeSlashIcon className="w-5 h-5" />
                          ) : (
                            <EyeIcon className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">Remember me</span>
                      </label>
                      <Link
                        to="/patient-portal/forgot-password"
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        Forgot Password?
                      </Link>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-teal-500 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-teal-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <ArrowPathIcon className="w-5 h-5 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Sign In
                          <ArrowRightIcon className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* Mobile OTP Login */}
                {activeTab === 'mobile' && (
                  <OTPLoginForm
                    otpData={otpData}
                    setOtpData={setOtpData}
                    otpSent={otpSent}
                    otpTimer={otpTimer}
                    isLoading={isLoading}
                    onSendOTP={() => handleSendOTP('sms')}
                    onVerifyOTP={handleVerifyOTP}
                    onResendOTP={handleResendOTP}
                    otpInputRefs={otpInputRefs}
                    handleOTPChange={handleOTPChange}
                    handleOTPKeyDown={handleOTPKeyDown}
                    handleOTPPaste={handleOTPPaste}
                    countryCodes={countryCodes}
                    label="Mobile Number"
                    buttonText="Send OTP"
                  />
                )}

                {/* WhatsApp Login */}
                {activeTab === 'whatsapp' && (
                  <OTPLoginForm
                    otpData={otpData}
                    setOtpData={setOtpData}
                    otpSent={otpSent}
                    otpTimer={otpTimer}
                    isLoading={isLoading}
                    onSendOTP={() => handleSendOTP('whatsapp')}
                    onVerifyOTP={handleVerifyOTP}
                    onResendOTP={handleResendOTP}
                    otpInputRefs={otpInputRefs}
                    handleOTPChange={handleOTPChange}
                    handleOTPKeyDown={handleOTPKeyDown}
                    handleOTPPaste={handleOTPPaste}
                    countryCodes={countryCodes}
                    label="WhatsApp Number"
                    buttonText="Send WhatsApp OTP"
                    isWhatsApp
                  />
                )}

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">New to our portal?</span>
                  </div>
                </div>

                {/* Register Link */}
                <button
                  onClick={() => {
                    setIsRegistering(true);
                    setError(null);
                  }}
                  className="w-full py-3 px-4 bg-gray-50 text-gray-700 font-semibold rounded-xl border border-gray-200 hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                >
                  <UserIcon className="w-5 h-5" />
                  Register as New Patient
                </button>
              </div>
            )}
          </div>

          {/* Footer Links */}
          <div className="text-center mt-6 text-white/80 text-sm">
            <Link to="/" className="hover:text-white underline">
              Back to Home
            </Link>
            <span className="mx-3">|</span>
            <Link to="/login" className="hover:text-white underline">
              Staff Login
            </Link>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animation-delay-6000 {
          animation-delay: 6s;
        }
        .bg-grid-pattern {
          background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
        }
      `}</style>
    </div>
  );
}

// Feature Card Component
function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 hover:bg-white/20 transition-all">
      <Icon className="w-8 h-8 text-cyan-200 mb-2" />
      <h4 className="font-semibold text-white">{title}</h4>
      <p className="text-sm text-white/70">{description}</p>
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// OTP Login Form Component
function OTPLoginForm({
  otpData,
  setOtpData,
  otpSent,
  otpTimer,
  isLoading,
  onSendOTP,
  onVerifyOTP,
  onResendOTP,
  otpInputRefs,
  handleOTPChange,
  handleOTPKeyDown,
  handleOTPPaste,
  countryCodes,
  label,
  buttonText,
  isWhatsApp = false,
}: {
  otpData: OTPFormData;
  setOtpData: (data: OTPFormData) => void;
  otpSent: boolean;
  otpTimer: number;
  isLoading: boolean;
  onSendOTP: () => void;
  onVerifyOTP: (e: React.FormEvent) => void;
  onResendOTP: () => void;
  otpInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  handleOTPChange: (index: number, value: string) => void;
  handleOTPKeyDown: (index: number, e: React.KeyboardEvent) => void;
  handleOTPPaste: (e: React.ClipboardEvent) => void;
  countryCodes: { code: string; country: string; flag: string }[];
  label: string;
  buttonText: string;
  isWhatsApp?: boolean;
}) {
  if (!otpSent) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
          <div className="flex gap-2">
            <select
              value={otpData.countryCode}
              onChange={(e) =>
                setOtpData({ ...otpData, countryCode: e.target.value })
              }
              className="w-28 px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {countryCodes.map((cc) => (
                <option key={cc.code} value={cc.code}>
                  {cc.code} ({cc.country})
                </option>
              ))}
            </select>
            <div className="relative flex-1">
              <DevicePhoneMobileIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={otpData.mobile}
                onChange={(e) =>
                  setOtpData({
                    ...otpData,
                    mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                  })
                }
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="Enter mobile number"
                required
              />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onSendOTP}
          disabled={isLoading || otpData.mobile.length < 10}
          className={`w-full py-3 px-4 font-semibold rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            isWhatsApp
              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
              : 'bg-gradient-to-r from-blue-600 to-teal-500 text-white hover:from-blue-700 hover:to-teal-600'
          }`}
        >
          {isLoading ? (
            <>
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              {isWhatsApp && <ChatBubbleLeftIcon className="w-5 h-5" />}
              {buttonText}
              <ArrowRightIcon className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onVerifyOTP} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
          Enter the 6-digit OTP sent to {otpData.countryCode} {otpData.mobile}
        </label>
        <div className="flex justify-center gap-2 mt-4" onPaste={handleOTPPaste}>
          {otpData.otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (otpInputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOTPChange(index, e.target.value)}
              onKeyDown={(e) => handleOTPKeyDown(index, e)}
              className="w-12 h-14 text-center text-xl font-bold bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          ))}
        </div>
      </div>

      {/* Timer */}
      <div className="text-center">
        {otpTimer > 0 ? (
          <p className="text-sm text-gray-500">
            OTP expires in{' '}
            <span className="font-semibold text-blue-600">
              {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}
            </span>
          </p>
        ) : (
          <button
            type="button"
            onClick={onResendOTP}
            disabled={isLoading}
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Resend OTP
          </button>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading || otpData.otp.some((d) => !d)}
        className={`w-full py-3 px-4 font-semibold rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
          isWhatsApp
            ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700'
            : 'bg-gradient-to-r from-blue-600 to-teal-500 text-white hover:from-blue-700 hover:to-teal-600'
        }`}
      >
        {isLoading ? (
          <>
            <ArrowPathIcon className="w-5 h-5 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            <CheckCircleIcon className="w-5 h-5" />
            Verify & Login
          </>
        )}
      </button>

      {/* Change Number */}
      <button
        type="button"
        onClick={() => {
          setOtpData({ ...otpData, otp: ['', '', '', '', '', ''] });
          // This requires additional state to reset otpSent
          window.location.reload(); // Simple approach
        }}
        className="w-full text-sm text-gray-500 hover:text-gray-700"
      >
        Change phone number
      </button>
    </form>
  );
}

// Registration Form Component
function RegistrationForm({
  data,
  setData,
  onSubmit,
  isLoading,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  passwordStrength,
  countryCodes,
  onSwitchToLogin,
}: {
  data: RegistrationFormData;
  setData: (data: RegistrationFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (show: boolean) => void;
  passwordStrength: 'weak' | 'medium' | 'strong';
  countryCodes: { code: string; country: string; flag: string }[];
  onSwitchToLogin: () => void;
}) {
  const strengthColors = {
    weak: 'bg-red-500',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
  };

  const strengthLabels = {
    weak: 'Weak',
    medium: 'Medium',
    strong: 'Strong',
  };

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            First Name
          </label>
          <div className="relative">
            <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={data.firstName}
              onChange={(e) => setData({ ...data, firstName: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="John"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Last Name
          </label>
          <input
            type="text"
            value={data.lastName}
            onChange={(e) => setData({ ...data, lastName: e.target.value })}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            placeholder="Doe"
            required
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Address
        </label>
        <div className="relative">
          <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="email"
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            placeholder="your@email.com"
            required
          />
        </div>
      </div>

      {/* Mobile */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mobile Number
        </label>
        <div className="flex gap-2">
          <select
            value={data.countryCode}
            onChange={(e) => setData({ ...data, countryCode: e.target.value })}
            className="w-28 px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {countryCodes.map((cc) => (
              <option key={cc.code} value={cc.code}>
                {cc.code} ({cc.country})
              </option>
            ))}
          </select>
          <div className="relative flex-1">
            <DevicePhoneMobileIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={data.mobile}
              onChange={(e) =>
                setData({
                  ...data,
                  mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                })
              }
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              placeholder="Enter mobile number"
              required
            />
          </div>
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Password
        </label>
        <div className="relative">
          <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={data.password}
            onChange={(e) => setData({ ...data, password: e.target.value })}
            className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            placeholder="Create a password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? (
              <EyeSlashIcon className="w-5 h-5" />
            ) : (
              <EyeIcon className="w-5 h-5" />
            )}
          </button>
        </div>
        {/* Password Strength Indicator */}
        {data.password && (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${strengthColors[passwordStrength]} transition-all`}
                  style={{
                    width:
                      passwordStrength === 'weak'
                        ? '33%'
                        : passwordStrength === 'medium'
                        ? '66%'
                        : '100%',
                  }}
                />
              </div>
              <span
                className={`text-xs font-medium ${
                  passwordStrength === 'weak'
                    ? 'text-red-500'
                    : passwordStrength === 'medium'
                    ? 'text-yellow-600'
                    : 'text-green-500'
                }`}
              >
                {strengthLabels[passwordStrength]}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Confirm Password
        </label>
        <div className="relative">
          <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={data.confirmPassword}
            onChange={(e) => setData({ ...data, confirmPassword: e.target.value })}
            className={`w-full pl-12 pr-12 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
              data.confirmPassword &&
              data.password !== data.confirmPassword
                ? 'border-red-500'
                : 'border-gray-200'
            }`}
            placeholder="Confirm your password"
            required
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showConfirmPassword ? (
              <EyeSlashIcon className="w-5 h-5" />
            ) : (
              <EyeIcon className="w-5 h-5" />
            )}
          </button>
        </div>
        {data.confirmPassword && data.password !== data.confirmPassword && (
          <p className="mt-1 text-sm text-red-500">Passwords do not match</p>
        )}
      </div>

      {/* Date of Birth and Gender */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date of Birth
          </label>
          <div className="relative">
            <CalendarDaysIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={data.dateOfBirth}
              onChange={(e) => setData({ ...data, dateOfBirth: e.target.value })}
              max={new Date().toISOString().split('T')[0]}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gender
          </label>
          <select
            value={data.gender}
            onChange={(e) => setData({ ...data, gender: e.target.value })}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            required
          >
            <option value="">Select Gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Terms and Conditions */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="agreeToTerms"
          checked={data.agreeToTerms}
          onChange={(e) => setData({ ...data, agreeToTerms: e.target.checked })}
          className="w-5 h-5 mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          required
        />
        <label htmlFor="agreeToTerms" className="text-sm text-gray-600">
          I agree to the{' '}
          <Link to="/terms" className="text-blue-600 hover:underline">
            Terms & Conditions
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !data.agreeToTerms}
        className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-teal-500 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-teal-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <ArrowPathIcon className="w-5 h-5 animate-spin" />
            Creating Account...
          </>
        ) : (
          <>
            <UserIcon className="w-5 h-5" />
            Create Account
          </>
        )}
      </button>

      {/* Back to Login */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Already have an account?{' '}
          <span className="font-semibold text-blue-600">Sign In</span>
        </button>
      </div>
    </form>
  );
}
