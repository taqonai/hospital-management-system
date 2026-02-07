import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
  CalendarDaysIcon,
  BuildingOffice2Icon,
  ArrowPathIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { format, parseISO, differenceInDays, isBefore } from 'date-fns';
import { patientPortalApi } from '../../../services/api';

interface InsuranceStatusCardProps {
  onUpdateInsurance?: () => void;
  showUpdateButton?: boolean;
  compact?: boolean;
  className?: string;
}

interface PatientInsurance {
  id: string;
  providerName: string;
  providerId?: string;
  policyNumber: string;
  groupNumber?: string;
  memberName?: string;
  startDate?: string;
  expiryDate?: string;
  copay?: number;
  coveragePercent?: number;
  isActive: boolean;
  isPrimary?: boolean;
  verificationStatus?: string;
}

export function getInsuranceStatus(insurance: PatientInsurance | null): {
  status: 'active' | 'expiring-soon' | 'expired' | 'pending' | 'none';
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof ShieldCheckIcon;
  daysUntilExpiry?: number;
} {
  if (!insurance) {
    return {
      status: 'none',
      label: 'No Insurance',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      icon: CreditCardIcon,
    };
  }

  const now = new Date();
  const expiryDate = insurance.expiryDate ? parseISO(insurance.expiryDate) : null;
  
  // Check verification status first
  if (insurance.verificationStatus === 'PENDING') {
    return {
      status: 'pending',
      label: 'Pending Verification',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      icon: ExclamationTriangleIcon,
    };
  }

  // Check if expired
  if (expiryDate && isBefore(expiryDate, now)) {
    return {
      status: 'expired',
      label: 'Expired',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      icon: ShieldExclamationIcon,
      daysUntilExpiry: differenceInDays(expiryDate, now),
    };
  }

  // Check if expiring soon (within 30 days)
  if (expiryDate) {
    const daysUntilExpiry = differenceInDays(expiryDate, now);
    if (daysUntilExpiry <= 30) {
      return {
        status: 'expiring-soon',
        label: `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        icon: ExclamationTriangleIcon,
        daysUntilExpiry,
      };
    }
  }

  // Active
  return {
    status: 'active',
    label: 'Active',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: ShieldCheckIcon,
    daysUntilExpiry: expiryDate ? differenceInDays(expiryDate, now) : undefined,
  };
}

export default function InsuranceStatusCard({
  onUpdateInsurance,
  showUpdateButton = true,
  compact = false,
  className = '',
}: InsuranceStatusCardProps) {
  const { data: insurances, isLoading, refetch } = useQuery({
    queryKey: ['patient-portal-insurance'],
    queryFn: async () => {
      const response = await patientPortalApi.getInsurance();
      return response.data?.data || response.data || [];
    },
  });

  // Get primary insurance or first active one
  const primaryInsurance = (insurances || []).find(
    (ins: PatientInsurance) => ins.isPrimary && ins.isActive
  ) || (insurances || []).find((ins: PatientInsurance) => ins.isActive);

  const statusInfo = getInsuranceStatus(primaryInsurance);
  const StatusIcon = statusInfo.icon;

  if (isLoading) {
    return (
      <div className={`rounded-xl border ${statusInfo.borderColor} ${statusInfo.bgColor} p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin" />
          <span className="text-sm text-gray-500">Loading insurance...</span>
        </div>
      </div>
    );
  }

  // Compact view (for booking flow step headers)
  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${statusInfo.bgColor} ${className}`}>
        <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
        {primaryInsurance ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">{primaryInsurance.providerName}</span>
            <span className={`text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.status === 'active' ? '✓ Active' : statusInfo.label}
            </span>
          </div>
        ) : (
          <span className="text-sm font-medium text-gray-700">Self-Pay</span>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${statusInfo.borderColor} ${statusInfo.bgColor} p-4 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`p-2 rounded-lg ${statusInfo.status === 'active' ? 'bg-green-100' : statusInfo.status === 'none' ? 'bg-gray-100' : 'bg-amber-100'}`}>
            <StatusIcon className={`h-6 w-6 ${statusInfo.color}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-gray-900">
                {primaryInsurance ? 'Insurance Status' : 'No Insurance on File'}
              </h4>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color} border ${statusInfo.borderColor}`}>
                {statusInfo.status === 'active' && '✓ '}{statusInfo.label}
              </span>
            </div>

            {primaryInsurance ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BuildingOffice2Icon className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{primaryInsurance.providerName}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CreditCardIcon className="h-4 w-4 text-gray-400" />
                  <span>Policy: {primaryInsurance.policyNumber}</span>
                </div>
                {primaryInsurance.expiryDate && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                    <span>
                      Valid until: {format(parseISO(primaryInsurance.expiryDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                {primaryInsurance.coveragePercent !== undefined && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium text-green-600">{primaryInsurance.coveragePercent}%</span> coverage
                    {primaryInsurance.copay !== undefined && (
                      <span className="ml-2">• Copay: <span className="font-medium">AED {primaryInsurance.copay}</span></span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-gray-600">
                You will be charged the full consultation fee. Add insurance to reduce costs.
              </p>
            )}
          </div>
        </div>

        {showUpdateButton && onUpdateInsurance && (
          <button
            onClick={onUpdateInsurance}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
            {primaryInsurance ? 'Update' : 'Add'}
          </button>
        )}
      </div>

      {/* Self-Pay Notice */}
      {!primaryInsurance && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-start gap-2">
            <CreditCardIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-800">Self-Pay Option</p>
              <p className="text-blue-600 mt-0.5">
                You can proceed with booking and pay the full consultation fee at the clinic or online.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expiring Soon Warning */}
      {statusInfo.status === 'expiring-soon' && (
        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
          <div className="flex items-start gap-2">
            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Insurance Expiring Soon</p>
              <p className="text-amber-600 mt-0.5">
                Please renew your insurance before it expires to maintain coverage for future appointments.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Expired Warning */}
      {statusInfo.status === 'expired' && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
          <div className="flex items-start gap-2">
            <ShieldExclamationIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-red-800">Insurance Expired</p>
              <p className="text-red-600 mt-0.5">
                Your insurance has expired. You will be charged the full amount as self-pay. Update your insurance to restore coverage.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export a helper hook for checking insurance before appointment
export function useInsuranceExpiryWarning(appointmentDate: string | null) {
  const { data: insurances } = useQuery({
    queryKey: ['patient-portal-insurance'],
    queryFn: async () => {
      const response = await patientPortalApi.getInsurance();
      return response.data?.data || response.data || [];
    },
    enabled: !!appointmentDate,
  });

  const primaryInsurance = (insurances || []).find(
    (ins: PatientInsurance) => ins.isPrimary && ins.isActive
  ) || (insurances || []).find((ins: PatientInsurance) => ins.isActive);

  if (!appointmentDate || !primaryInsurance?.expiryDate) {
    return null;
  }

  const appointmentDateObj = parseISO(appointmentDate);
  const expiryDateObj = parseISO(primaryInsurance.expiryDate);

  if (isBefore(expiryDateObj, appointmentDateObj)) {
    return {
      insuranceExpiry: format(expiryDateObj, 'MMM d, yyyy'),
      appointmentDateFormatted: format(appointmentDateObj, 'MMM d, yyyy'),
      providerName: primaryInsurance.providerName,
      message: `Your insurance expires on ${format(expiryDateObj, 'MMM d, yyyy')}, before your appointment on ${format(appointmentDateObj, 'MMM d, yyyy')}. You may need to pay the full amount or update your insurance.`,
    };
  }

  return null;
}
