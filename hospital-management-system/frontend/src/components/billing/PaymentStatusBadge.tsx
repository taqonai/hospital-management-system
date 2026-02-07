import {
  CheckCircleIcon,
  BanknotesIcon,
  ClockIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

export type PaymentStatus = 
  | 'pending'
  | 'pay_at_clinic'
  | 'payment_initiated'
  | 'paid_online'
  | 'paid_cash'
  | 'refunded';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  amount?: number;
  compact?: boolean;
  className?: string;
}

const statusConfig: Record<PaymentStatus, {
  label: string;
  shortLabel: string;
  icon: typeof CheckCircleIcon;
  bgColor: string;
  textColor: string;
  dotColor: string;
}> = {
  pending: {
    label: 'Payment Pending',
    shortLabel: 'Pending',
    icon: ClockIcon,
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    dotColor: 'bg-yellow-500',
  },
  pay_at_clinic: {
    label: 'Cash Due',
    shortLabel: 'Cash Due',
    icon: BanknotesIcon,
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    dotColor: 'bg-orange-500',
  },
  payment_initiated: {
    label: 'Processing',
    shortLabel: 'Processing',
    icon: CreditCardIcon,
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    dotColor: 'bg-blue-500 animate-pulse',
  },
  paid_online: {
    label: 'Paid Online',
    shortLabel: 'Paid',
    icon: CheckCircleIcon,
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    dotColor: 'bg-green-500',
  },
  paid_cash: {
    label: 'Paid (Cash)',
    shortLabel: 'Paid',
    icon: CheckCircleIcon,
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    dotColor: 'bg-green-500',
  },
  refunded: {
    label: 'Refunded',
    shortLabel: 'Refunded',
    icon: CreditCardIcon,
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-600',
    dotColor: 'bg-gray-400',
  },
};

export default function PaymentStatusBadge({ 
  status, 
  amount, 
  compact = false,
  className = '' 
}: PaymentStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  if (compact) {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          config.bgColor,
          config.textColor,
          className
        )}
        title={`${config.label}${amount ? ` - AED ${amount}` : ''}`}
      >
        <span className={clsx('w-1.5 h-1.5 rounded-full', config.dotColor)} />
        {config.shortLabel}
      </span>
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
        config.bgColor,
        config.textColor,
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
      {amount !== undefined && amount > 0 && (
        <span className="font-semibold">AED {amount}</span>
      )}
    </span>
  );
}

// Helper function to determine if payment is complete
export function isPaymentComplete(status: PaymentStatus): boolean {
  return status === 'paid_online' || status === 'paid_cash';
}

// Helper function to determine if cash collection is needed
export function needsCashCollection(status: PaymentStatus): boolean {
  return status === 'pay_at_clinic' || status === 'pending';
}
