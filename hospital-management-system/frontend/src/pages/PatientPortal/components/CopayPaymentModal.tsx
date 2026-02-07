import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  CreditCardIcon,
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';
import { CurrencyDisplay } from '../../../components/common';
import toast from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Initialize Stripe (use your publishable key from env)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

interface CopayPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  appointmentDetails: {
    doctorName: string;
    date: string;
    time: string;
    department?: string;
  };
  onPaymentComplete?: (status: 'paid' | 'pay_at_clinic' | 'decide_later') => void;
}

interface CopayInfo {
  appointmentId: string;
  copayAmount: number;
  paymentStatus: string;
  paymentMethod?: string;
  paidAt?: string;
  transactionId?: string;
  receiptUrl?: string;
}

// Stripe Payment Form Component
function StripePaymentForm({
  clientSecret,
  onSuccess,
  onCancel,
  amount,
}: {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
  amount: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Payment failed');
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
          <ExclamationCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-medium hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ShieldCheckIcon className="h-5 w-5" />
              Pay AED {amount.toFixed(2)}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function CopayPaymentModal({
  isOpen,
  onClose,
  appointmentId,
  appointmentDetails,
  onPaymentComplete,
}: CopayPaymentModalProps) {
  const [step, setStep] = useState<'selection' | 'payment' | 'processing' | 'success'>('selection');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Fetch copay info
  const { data: copayData, isLoading, refetch } = useQuery({
    queryKey: ['copay-info', appointmentId],
    queryFn: async () => {
      const response = await patientPortalApi.getCopayInfo(appointmentId);
      return response.data?.data || response.data;
    },
    enabled: isOpen && !!appointmentId,
  });

  const copayInfo = copayData as CopayInfo | undefined;

  // Initiate online payment mutation
  const initPaymentMutation = useMutation({
    mutationFn: () => patientPortalApi.initiateCopayPayment(appointmentId),
    onSuccess: (response) => {
      const data = response.data?.data || response.data;
      if (data.paymentIntent?.clientSecret) {
        setClientSecret(data.paymentIntent.clientSecret);
        setStep('payment');
      } else {
        toast.error('Failed to initialize payment');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to initiate payment');
    },
  });

  // Pay at clinic mutation
  const payAtClinicMutation = useMutation({
    mutationFn: () => patientPortalApi.selectPayAtClinic(appointmentId),
    onSuccess: () => {
      toast.success('Payment preference saved. Please pay at the clinic.');
      setStep('success');
      setSelectedOption('pay_at_clinic');
      onPaymentComplete?.('pay_at_clinic');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save preference');
    },
  });

  // Decide later mutation
  const decideLaterMutation = useMutation({
    mutationFn: () => patientPortalApi.selectDecideLater(appointmentId),
    onSuccess: () => {
      toast.success('Got it! We\'ll send you a reminder before your appointment.');
      setStep('success');
      setSelectedOption('decide_later');
      onPaymentComplete?.('decide_later');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save preference');
    },
  });

  // Handle online payment success
  const handlePaymentSuccess = async () => {
    setStep('processing');
    try {
      // Confirm the payment in our backend
      await patientPortalApi.confirmCopayPayment(appointmentId, clientSecret!);
      toast.success('Payment successful!');
      setStep('success');
      setSelectedOption('paid');
      onPaymentComplete?.('paid');
    } catch (error: any) {
      toast.error('Payment confirmation failed. Please contact support.');
      setStep('selection');
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('selection');
      setClientSecret(null);
      setSelectedOption(null);
    }
  }, [isOpen]);

  const isProcessing = initPaymentMutation.isPending || payAtClinicMutation.isPending || decideLaterMutation.isPending;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-1 rounded-full hover:bg-white/20 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-white" />
                  </button>
                  <h3 className="text-xl font-bold text-white">
                    {step === 'success' ? 'All Set!' : 'Copay Payment'}
                  </h3>
                  <p className="text-blue-100 text-sm mt-1">
                    {appointmentDetails.doctorName} • {appointmentDetails.date}
                  </p>
                </div>

                {/* Loading State */}
                {isLoading && (
                  <div className="px-6 py-12 text-center">
                    <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
                    <p className="text-gray-500 mt-2">Loading payment details...</p>
                  </div>
                )}

                {/* Selection Step */}
                {!isLoading && step === 'selection' && copayInfo && (
                  <div className="px-6 py-6">
                    {/* Amount Display */}
                    <div className="text-center mb-6">
                      <p className="text-gray-500 text-sm">Copay Amount Due</p>
                      <p className="text-4xl font-bold text-gray-900 mt-1">
                        <CurrencyDisplay amount={copayInfo.copayAmount} />
                      </p>
                    </div>

                    {/* Payment Options */}
                    <div className="space-y-3">
                      {/* Pay Now */}
                      <button
                        onClick={() => initPaymentMutation.mutate()}
                        disabled={isProcessing}
                        className="w-full p-4 rounded-xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-all text-left flex items-center gap-4 group disabled:opacity-50"
                      >
                        <div className="p-3 bg-green-500 rounded-xl text-white group-hover:bg-green-600 transition-colors">
                          <CreditCardIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">Pay Now</p>
                          <p className="text-sm text-green-600">Faster check-in, skip the queue!</p>
                        </div>
                        {initPaymentMutation.isPending && (
                          <ArrowPathIcon className="h-5 w-5 text-green-600 animate-spin" />
                        )}
                      </button>

                      {/* Pay at Clinic */}
                      <button
                        onClick={() => payAtClinicMutation.mutate()}
                        disabled={isProcessing}
                        className="w-full p-4 rounded-xl border-2 border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 transition-all text-left flex items-center gap-4 group disabled:opacity-50"
                      >
                        <div className="p-3 bg-gray-500 rounded-xl text-white group-hover:bg-gray-600 transition-colors">
                          <BanknotesIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">Pay Cash at Clinic</p>
                          <p className="text-sm text-gray-500">Pay at reception when you arrive</p>
                        </div>
                        {payAtClinicMutation.isPending && (
                          <ArrowPathIcon className="h-5 w-5 text-gray-600 animate-spin" />
                        )}
                      </button>

                      {/* Decide Later */}
                      <button
                        onClick={() => decideLaterMutation.mutate()}
                        disabled={isProcessing}
                        className="w-full p-4 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all text-left flex items-center gap-4 group disabled:opacity-50"
                      >
                        <div className="p-3 bg-blue-500 rounded-xl text-white group-hover:bg-blue-600 transition-colors">
                          <ClockIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">Decide Later</p>
                          <p className="text-sm text-gray-500">We'll remind you 24h before</p>
                        </div>
                        {decideLaterMutation.isPending && (
                          <ArrowPathIcon className="h-5 w-5 text-blue-600 animate-spin" />
                        )}
                      </button>
                    </div>

                    {/* Security Note */}
                    <div className="mt-6 flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <ShieldCheckIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-700">
                        Your payment is secured with industry-standard encryption. We never store your full card details.
                      </p>
                    </div>
                  </div>
                )}

                {/* Payment Step (Stripe Form) */}
                {step === 'payment' && clientSecret && copayInfo && (
                  <div className="px-6 py-6">
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: 'stripe',
                          variables: {
                            colorPrimary: '#2563eb',
                            borderRadius: '12px',
                          },
                        },
                      }}
                    >
                      <StripePaymentForm
                        clientSecret={clientSecret}
                        onSuccess={handlePaymentSuccess}
                        onCancel={() => setStep('selection')}
                        amount={copayInfo.copayAmount}
                      />
                    </Elements>
                  </div>
                )}

                {/* Processing Step */}
                {step === 'processing' && (
                  <div className="px-6 py-12 text-center">
                    <ArrowPathIcon className="h-12 w-12 text-blue-600 animate-spin mx-auto" />
                    <p className="text-gray-700 mt-4 font-medium">Processing your payment...</p>
                    <p className="text-gray-500 text-sm mt-1">Please don't close this window</p>
                  </div>
                )}

                {/* Success Step */}
                {step === 'success' && (
                  <div className="px-6 py-8 text-center">
                    <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                      <CheckCircleIcon className="h-10 w-10 text-green-600" />
                    </div>
                    
                    {selectedOption === 'paid' && (
                      <>
                        <h4 className="text-xl font-bold text-gray-900">Payment Successful!</h4>
                        <p className="text-gray-500 mt-2">
                          Your copay has been paid. Show your confirmation at check-in for faster service.
                        </p>
                      </>
                    )}
                    
                    {selectedOption === 'pay_at_clinic' && (
                      <>
                        <h4 className="text-xl font-bold text-gray-900">Preference Saved</h4>
                        <p className="text-gray-500 mt-2">
                          Please pay <span className="font-semibold">AED {copayInfo?.copayAmount}</span> at the reception when you arrive.
                        </p>
                      </>
                    )}
                    
                    {selectedOption === 'decide_later' && (
                      <>
                        <h4 className="text-xl font-bold text-gray-900">Reminder Set</h4>
                        <p className="text-gray-500 mt-2">
                          We'll send you a payment reminder 24 hours before your appointment.
                        </p>
                      </>
                    )}

                    <button
                      onClick={onClose}
                      className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-700 hover:to-indigo-700 transition-all"
                    >
                      Done
                    </button>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
