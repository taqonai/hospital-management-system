import { useState, useEffect } from 'react';
import {
  IdentificationIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserPlusIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  BanknotesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { insuranceCodingApi, patientApi } from '../../services/api';
import toast from 'react-hot-toast';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn?: string;
  emiratesId?: string;
}

interface InsuranceInfo {
  id?: string;
  providerName: string;
  policyNumber: string;
  coveragePercentage: number;
  copayPercentage: number;
  networkStatus: string;
  verificationStatus: string;
}

interface WalkInInsuranceCaptureProps {
  serviceType: 'LAB' | 'RADIOLOGY';
  estimatedCost: number; // Pass from parent based on selected tests/procedures
  onComplete: (result: {
    patient: Patient;
    hasInsurance: boolean;
    insuranceId?: string;
    copayCollected: boolean;
    copayAmount: number;
    paymentMethod?: 'CASH' | 'CREDIT_CARD';
    proceedAsSelfPay: boolean;
  }) => void;
  onCancel: () => void;
}

export default function WalkInInsuranceCapture({
  serviceType,
  estimatedCost,
  onComplete,
  onCancel,
}: WalkInInsuranceCaptureProps) {
  // Step: 'eid_lookup' | 'insurance_verify' | 'quick_register' | 'copay_collect'
  const [step, setStep] = useState<'eid_lookup' | 'insurance_verify' | 'quick_register' | 'copay_collect'>('eid_lookup');
  const [loading, setLoading] = useState(false);
  
  // EID Lookup
  const [emiratesId, setEmiratesId] = useState('');
  
  // Patient
  const [patient, setPatient] = useState<Patient | null>(null);
  
  // Insurance
  const [insurance, setInsurance] = useState<InsuranceInfo | null>(null);
  const [copayAmount, setCopayAmount] = useState(0);
  const [insuranceCovers, setInsuranceCovers] = useState(0);
  
  // Quick registration form
  const [regForm, setRegForm] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'MALE',
    phone: '',
    emiratesId: '',
  });
  
  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CREDIT_CARD'>('CASH');

  const formatEmiratesId = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 15);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length <= 14) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 14)}-${digits.slice(14)}`;
  };

  const handleEidLookup = async () => {
    const cleanEid = emiratesId.replace(/-/g, '');
    if (cleanEid.length !== 15) {
      toast.error('Please enter a valid 15-digit Emirates ID');
      return;
    }

    setLoading(true);
    try {
      // First try to find patient by Emirates ID
      const patientResponse = await patientApi.getAll({ emiratesId: cleanEid, limit: 1 });
      const patients = patientResponse.data.data || [];

      if (patients.length > 0) {
        // Patient found
        const foundPatient = patients[0];
        setPatient(foundPatient);
        
        // Now verify insurance
        const eligResponse = await insuranceCodingApi.verifyEligibility({ 
          patientId: foundPatient.id,
          emiratesId: cleanEid 
        });
        const eligData = eligResponse.data.data;

        if (eligData.eligible && eligData.insuranceProvider) {
          setInsurance({
            id: eligData.insuranceId,
            providerName: eligData.insuranceProvider,
            policyNumber: eligData.policyNumber || '',
            coveragePercentage: eligData.coveragePercentage || 80,
            copayPercentage: eligData.copayPercentage || 20,
            networkStatus: eligData.networkStatus || 'IN_NETWORK',
            verificationStatus: eligData.verificationSource === 'DHA_ECLAIM' ? 'VERIFIED' : 'PENDING',
          });
          
          // Calculate copay
          const coverage = eligData.coveragePercentage || 80;
          const patientPays = estimatedCost * (1 - coverage / 100);
          setCopayAmount(patientPays);
          setInsuranceCovers(estimatedCost - patientPays);
          
          setStep('copay_collect');
        } else {
          // No insurance - proceed to copay as self-pay
          setInsurance(null);
          setCopayAmount(estimatedCost);
          setInsuranceCovers(0);
          setStep('copay_collect');
        }
      } else {
        // Patient not found - show quick registration
        setRegForm(prev => ({ ...prev, emiratesId: cleanEid }));
        setStep('quick_register');
      }
    } catch (error: any) {
      console.error('EID lookup failed:', error);
      toast.error(error.response?.data?.message || 'Failed to lookup patient');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickRegister = async () => {
    const { firstName, lastName, dateOfBirth, gender, phone, emiratesId } = regForm;
    if (!firstName || !lastName || !dateOfBirth || !gender || !phone) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await patientApi.create({
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth).toISOString(),
        gender,
        phone,
        emiratesId: emiratesId || undefined,
        address: 'Walk-in',
        city: 'Dubai',
        state: 'Dubai',
        zipCode: '00000',
      });
      
      const newPatient = response.data.data;
      setPatient(newPatient);
      
      // New patient - no insurance, proceed as self-pay
      setInsurance(null);
      setCopayAmount(estimatedCost);
      setInsuranceCovers(0);
      setStep('copay_collect');
      
      toast.success('Patient registered successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to register patient');
    } finally {
      setLoading(false);
    }
  };

  const handleCollectCopay = () => {
    if (!patient) return;

    onComplete({
      patient,
      hasInsurance: !!insurance,
      insuranceId: insurance?.id,
      copayCollected: true,
      copayAmount,
      paymentMethod,
      proceedAsSelfPay: !insurance,
    });
  };

  const handleSkipPayment = () => {
    if (!patient) return;

    // For walk-ins, we should collect payment upfront
    // But allow proceeding if authorized
    onComplete({
      patient,
      hasInsurance: !!insurance,
      insuranceId: insurance?.id,
      copayCollected: false,
      copayAmount,
      proceedAsSelfPay: !insurance,
    });
  };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
          step === 'eid_lookup' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
        }`}>
          1. Emirates ID
        </div>
        <div className="w-8 h-0.5 bg-gray-200" />
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
          step === 'quick_register' ? 'bg-blue-100 text-blue-700' : 
          step === 'insurance_verify' || step === 'copay_collect' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          2. Patient
        </div>
        <div className="w-8 h-0.5 bg-gray-200" />
        <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
          step === 'copay_collect' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
        }`}>
          3. Payment
        </div>
      </div>

      {/* Step 1: Emirates ID Lookup */}
      {step === 'eid_lookup' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <IdentificationIcon className="h-6 w-6 text-blue-500" />
              <div>
                <h4 className="font-semibold text-blue-800">Walk-in {serviceType === 'LAB' ? 'Laboratory' : 'Radiology'}</h4>
                <p className="text-sm text-blue-600 mt-1">
                  Enter patient's Emirates ID to lookup their record and insurance
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Emirates ID <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={emiratesId}
                onChange={(e) => setEmiratesId(formatEmiratesId(e.target.value))}
                placeholder="784-XXXX-XXXXXXX-X"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                autoFocus
              />
              <button
                type="button"
                onClick={handleEidLookup}
                disabled={loading || emiratesId.replace(/-/g, '').length !== 15}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <ArrowPathIcon className="h-5 w-5 animate-spin" />
                ) : (
                  <MagnifyingGlassIcon className="h-5 w-5" />
                )}
                Lookup
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Quick Registration (if patient not found) */}
      {step === 'quick_register' && (
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <UserPlusIcon className="h-6 w-6 text-orange-500" />
              <div>
                <h4 className="font-semibold text-orange-800">New Patient Registration</h4>
                <p className="text-sm text-orange-600 mt-1">
                  No patient found with this Emirates ID. Quick registration required.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                value={regForm.firstName}
                onChange={(e) => setRegForm(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                value={regForm.lastName}
                onChange={(e) => setRegForm(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
              <input
                type="date"
                value={regForm.dateOfBirth}
                onChange={(e) => setRegForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
              <select
                value={regForm.gender}
                onChange={(e) => setRegForm(prev => ({ ...prev, gender: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input
                type="tel"
                value={regForm.phone}
                onChange={(e) => setRegForm(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+971-XX-XXX-XXXX"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-between gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setStep('eid_lookup')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleQuickRegister}
              disabled={loading}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              Register & Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Copay Collection */}
      {step === 'copay_collect' && patient && (
        <div className="space-y-4">
          {/* Patient Info */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="h-6 w-6 text-green-500" />
              <div>
                <h4 className="font-semibold text-green-800">{patient.firstName} {patient.lastName}</h4>
                <p className="text-sm text-green-600">MRN: {patient.mrn || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Insurance Info */}
          {insurance ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ShieldCheckIcon className="h-6 w-6 text-blue-500" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-800">{insurance.providerName}</h4>
                  <div className="text-sm text-blue-600 mt-1">
                    <span>Policy: {insurance.policyNumber}</span>
                    <span className="mx-2">•</span>
                    <span>{insurance.networkStatus === 'IN_NETWORK' ? '✅ In-Network' : '⚠️ Out-of-Network'}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ExclamationTriangleIcon className="h-6 w-6 text-orange-500" />
                <div>
                  <h4 className="font-semibold text-orange-800">No Insurance</h4>
                  <p className="text-sm text-orange-600 mt-1">Patient will pay full amount</p>
                </div>
              </div>
            </div>
          )}

          {/* Cost Summary */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-semibold text-gray-900 mb-3">Cost Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Estimated Service Cost</span>
                <span className="font-medium">AED {estimatedCost.toFixed(2)}</span>
              </div>
              {insurance && (
                <div className="flex justify-between text-green-600">
                  <span>Insurance Covers ({insurance.coveragePercentage}%)</span>
                  <span>- AED {insuranceCovers.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
                <span>Patient Pays</span>
                <span className="text-primary-600">AED {copayAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          {copayAmount > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Payment Method</h4>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    paymentMethod === 'CASH'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <BanknotesIcon className="h-5 w-5" />
                  <span className="font-medium">Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CREDIT_CARD')}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    paymentMethod === 'CREDIT_CARD'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <CreditCardIcon className="h-5 w-5" />
                  <span className="font-medium">Card</span>
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setStep('eid_lookup')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Start Over
            </button>
            <div className="flex gap-3">
              {copayAmount > 0 && (
                <button
                  type="button"
                  onClick={handleSkipPayment}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Bill Later
                </button>
              )}
              <button
                type="button"
                onClick={handleCollectCopay}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                {copayAmount > 0 ? (
                  <>Collect AED {copayAmount.toFixed(2)} & Proceed</>
                ) : (
                  <>No Payment Required - Proceed</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
