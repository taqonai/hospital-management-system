import { Fragment, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  CheckCircleIcon,
  XMarkIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  BuildingOffice2Icon,
  ReceiptPercentIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { CurrencyDisplay } from '../../../components/common';

interface PaymentReceiptProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: {
    transactionId: string;
    receiptNumber?: string;
    amount: number;
    paymentMethod: string;
    paidAt: string | Date;
    appointmentDetails: {
      doctorName: string;
      department?: string;
      date: string;
      time: string;
      appointmentId: string;
    };
    insuranceProvider?: string;
    policyNumber?: string;
    breakdown?: {
      serviceFee: number;
      insuranceCoverage: number;
      insuranceCoveragePercent: number;
      patientResponsibility: number;
      deductibleApplied: number;
    };
    patientName?: string;
    patientEmail?: string;
    hospitalName?: string;
    hospitalAddress?: string;
    hospitalPhone?: string;
  };
  onDownloadPDF?: () => void;
  onEmailReceipt?: () => void;
  emailSending?: boolean;
  emailSent?: boolean;
}

export default function PaymentReceipt({
  isOpen,
  onClose,
  receipt,
  onDownloadPDF,
  onEmailReceipt,
  emailSending = false,
  emailSent = false,
}: PaymentReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const paymentMethodLabels: Record<string, string> = {
    CREDIT_CARD: 'Credit Card',
    DEBIT_CARD: 'Debit Card',
    CASH: 'Cash',
    NET_BANKING: 'Net Banking',
    UPI: 'UPI',
    APPLE_PAY: 'Apple Pay',
    GOOGLE_PAY: 'Google Pay',
  };

  const handlePrint = () => {
    window.print();
  };

  const paidAtDate = typeof receipt.paidAt === 'string' ? new Date(receipt.paidAt) : receipt.paidAt;

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
                {/* Header with success indicator */}
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/20 rounded-full">
                        <CheckCircleIcon className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Payment Successful</h3>
                        <p className="text-green-100 text-sm">Thank you for your payment</p>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-2 rounded-full hover:bg-white/20 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5 text-white" />
                    </button>
                  </div>
                </div>

                {/* Receipt Content */}
                <div ref={receiptRef} className="px-6 py-6 print:px-4 print:py-4">
                  {/* Transaction Info */}
                  <div className="text-center mb-6 print:mb-4">
                    <p className="text-gray-500 text-sm">Transaction ID</p>
                    <p className="font-mono text-lg font-semibold text-gray-900">{receipt.transactionId}</p>
                    {receipt.receiptNumber && (
                      <p className="text-gray-500 text-xs mt-1">Receipt #: {receipt.receiptNumber}</p>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="text-center mb-6 pb-6 border-b border-dashed border-gray-200 print:mb-4 print:pb-4">
                    <p className="text-gray-500 text-sm">Amount Paid</p>
                    <p className="text-4xl font-bold text-green-600 mt-1">
                      <CurrencyDisplay amount={receipt.amount} />
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      {format(paidAtDate, 'MMMM d, yyyy')} at {format(paidAtDate, 'h:mm a')}
                    </p>
                  </div>

                  {/* Appointment Details */}
                  <div className="space-y-3 mb-6 print:mb-4">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <CalendarDaysIcon className="h-5 w-5 text-blue-600" />
                      Appointment Details
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <UserIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">Doctor:</span>
                        <span className="font-medium text-gray-900">{receipt.appointmentDetails.doctorName}</span>
                      </div>
                      {receipt.appointmentDetails.department && (
                        <div className="flex items-center gap-2 text-sm">
                          <BuildingOffice2Icon className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">Department:</span>
                          <span className="font-medium text-gray-900">{receipt.appointmentDetails.department}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">Date & Time:</span>
                        <span className="font-medium text-gray-900">
                          {receipt.appointmentDetails.date} at {receipt.appointmentDetails.time}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Breakdown */}
                  {receipt.breakdown && (
                    <div className="space-y-3 mb-6 print:mb-4">
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        <ReceiptPercentIcon className="h-5 w-5 text-blue-600" />
                        Payment Breakdown
                      </h4>
                      <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Consultation Fee</span>
                          <span className="font-medium"><CurrencyDisplay amount={receipt.breakdown.serviceFee} /></span>
                        </div>
                        {receipt.breakdown.insuranceCoverage > 0 && (
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Insurance Coverage ({receipt.breakdown.insuranceCoveragePercent}%)</span>
                            <span className="font-medium">-<CurrencyDisplay amount={receipt.breakdown.insuranceCoverage} /></span>
                          </div>
                        )}
                        {receipt.breakdown.deductibleApplied > 0 && (
                          <div className="flex justify-between text-sm text-amber-600">
                            <span>Deductible Applied</span>
                            <span className="font-medium">+<CurrencyDisplay amount={receipt.breakdown.deductibleApplied} /></span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm pt-2 border-t border-blue-200 font-semibold">
                          <span className="text-gray-900">Your Copay</span>
                          <span className="text-blue-600"><CurrencyDisplay amount={receipt.breakdown.patientResponsibility} /></span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment Method */}
                  <div className="flex items-center justify-between py-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm">
                      <CreditCardIcon className="h-5 w-5 text-gray-400" />
                      <span className="text-gray-600">Payment Method</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      {paymentMethodLabels[receipt.paymentMethod] || receipt.paymentMethod}
                    </span>
                  </div>

                  {/* Insurance Info */}
                  {receipt.insuranceProvider && (
                    <div className="flex items-center justify-between py-3 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-sm">
                        <BuildingOffice2Icon className="h-5 w-5 text-gray-400" />
                        <span className="text-gray-600">Insurance</span>
                      </div>
                      <div className="text-right">
                        <span className="font-medium text-gray-900">{receipt.insuranceProvider}</span>
                        {receipt.policyNumber && (
                          <p className="text-xs text-gray-500">{receipt.policyNumber}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 space-y-3 print:hidden">
                  <div className="flex gap-3">
                    {onDownloadPDF && (
                      <button
                        onClick={onDownloadPDF}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                      >
                        <DocumentArrowDownIcon className="h-5 w-5" />
                        Download PDF
                      </button>
                    )}
                    <button
                      onClick={handlePrint}
                      className="px-4 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                      title="Print Receipt"
                    >
                      <PrinterIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {onEmailReceipt && (
                    <button
                      onClick={onEmailReceipt}
                      disabled={emailSending || emailSent}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-medium transition-colors ${
                        emailSent
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {emailSending ? (
                        <>
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Sending...
                        </>
                      ) : emailSent ? (
                        <>
                          <CheckCircleIcon className="h-5 w-5" />
                          Receipt Sent to Email
                        </>
                      ) : (
                        <>
                          <EnvelopeIcon className="h-5 w-5" />
                          Email Receipt
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 font-medium hover:from-gray-200 hover:to-gray-300 transition-all"
                  >
                    Close
                  </button>
                </div>

                {/* Footer Note */}
                <div className="bg-gray-50 px-6 py-4 text-center border-t border-gray-100 print:py-2">
                  <p className="text-xs text-gray-500">
                    Please keep this receipt for your records. Show it at check-in for faster service.
                  </p>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

// Export a simple inline receipt component for embedding in other views
export function InlineReceipt({
  transactionId,
  amount,
  paidAt,
  paymentMethod,
  className = '',
}: {
  transactionId: string;
  amount: number;
  paidAt: string | Date;
  paymentMethod: string;
  className?: string;
}) {
  const paidAtDate = typeof paidAt === 'string' ? new Date(paidAt) : paidAt;
  
  const paymentMethodLabels: Record<string, string> = {
    CREDIT_CARD: 'Credit Card',
    DEBIT_CARD: 'Debit Card',
    CASH: 'Cash',
    NET_BANKING: 'Net Banking',
    UPI: 'UPI',
  };

  return (
    <div className={`bg-green-50 border border-green-200 rounded-xl p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-green-100 rounded-lg">
          <CheckCircleIcon className="h-6 w-6 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-green-800">Payment Received</p>
          <div className="mt-1 space-y-1 text-sm">
            <p className="text-green-700">
              Amount: <span className="font-medium"><CurrencyDisplay amount={amount} /></span>
            </p>
            <p className="text-green-600">
              {format(paidAtDate, 'MMM d, yyyy')} • {paymentMethodLabels[paymentMethod] || paymentMethod}
            </p>
            <p className="text-green-600 font-mono text-xs">
              Txn: {transactionId}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
