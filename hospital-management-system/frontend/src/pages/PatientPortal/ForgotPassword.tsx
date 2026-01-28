import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EnvelopeIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid';
import axios from 'axios';

export default function PatientForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await axios.post('/api/v1/patient-auth/forgot-password', {
        email: email.toLowerCase().trim(),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send reset link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-teal-500 to-cyan-400">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Content */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
            {/* Header */}
            <div className="p-8 pb-6">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <HeartSolid className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Spetaar Pro</h1>
                  <p className="text-gray-500 text-sm">Patient Portal</p>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 text-center">Forgot Password?</h2>
              <p className="text-gray-600 text-center mt-2">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>

            {/* Error/Success Messages */}
            {(error || success) && (
              <div className="px-8">
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
                  <p className="text-sm">
                    {error || 'If an account exists with that email, we\'ve sent a password reset link.'}
                  </p>
                </div>
              </div>
            )}

            {success ? (
              /* Success State */
              <div className="p-8 pt-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircleIcon className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Check Your Email</h3>
                <p className="text-gray-600 mb-6">
                  If an account exists with that email, we've sent a password reset link. Please check your inbox and spam folder.
                </p>
                <Link
                  to="/patient-portal/login"
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                  Back to Login
                </Link>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-teal-500 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-teal-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <div className="text-center">
                  <Link
                    to="/patient-portal/login"
                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back to Login
                  </Link>
                </div>
              </form>
            )}
          </div>

          {/* Footer Links */}
          <div className="text-center mt-6 text-white/80 text-sm">
            <Link to="/" className="hover:text-white underline">
              Back to Home
            </Link>
          </div>
        </div>
      </div>

      {/* Animation Styles */}
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
      `}</style>
    </div>
  );
}
