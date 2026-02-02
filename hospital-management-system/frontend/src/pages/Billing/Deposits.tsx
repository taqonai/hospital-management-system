import React, { useState, useEffect } from 'react';
import {
  BanknotesIcon,
  UserCircleIcon,
  ClipboardDocumentListIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';


interface Deposit {
  id: string;
  amount: number;
  remainingBalance: number;
  currency: string;
  paymentMethod: string;
  referenceNumber?: string;
  reason?: string;
  status: 'ACTIVE' | 'UTILIZED' | 'REFUNDED' | 'EXPIRED';
  createdAt: string;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    mrn: string;
    phone: string;
  };
}

interface DepositBalance {
  patientId: string;
  totalBalance: number;
  activeDeposits: number;
}

interface LedgerEntry {
  id: string;
  type: 'DEPOSIT' | 'UTILIZATION' | 'REFUND' | 'ADJUSTMENT';
  amount: number;
  description: string;
  createdAt: string;
  invoice?: {
    invoiceNumber: string;
  };
}

const statusColors = {
  ACTIVE: 'bg-green-100 text-green-800',
  UTILIZED: 'bg-gray-100 text-gray-800',
  REFUNDED: 'bg-blue-100 text-blue-800',
  EXPIRED: 'bg-red-100 text-red-800',
};

export default function Deposits() {
  const token = localStorage.getItem('accessToken');
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [depositBalance, setDepositBalance] = useState<DepositBalance | null>(null);
  const [selectedDeposit, setSelectedDeposit] = useState<string | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    patientId: '',
    amount: '',
    paymentMethod: 'CASH',
    referenceNumber: '',
    reason: '',
  });

  // Filters
  const [filters, setFilters] = useState({
    patientId: '',
    status: '',
    page: 1,
    limit: 20,
  });

  useEffect(() => {
    fetchDeposits();
  }, [filters]);

  const fetchDeposits = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.patientId) params.append('patientId', filters.patientId);
      if (filters.status) params.append('status', filters.status);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const response = await fetch(`/api/v1/billing/deposits?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setDeposits(data.data);
      } else {
        toast.error(data.message || 'Failed to fetch deposits');
      }
    } catch (error) {
      console.error('Error fetching deposits:', error);
      toast.error('Failed to fetch deposits');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepositBalance = async (patientId: string) => {
    try {
      const response = await fetch(`/api/v1/billing/patients/${patientId}/deposit-balance`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setDepositBalance(data.data);
      }
    } catch (error) {
      console.error('Error fetching deposit balance:', error);
    }
  };

  const fetchDepositLedger = async (depositId: string) => {
    try {
      const response = await fetch(`/api/v1/billing/deposits/${depositId}/ledger`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setLedgerEntries(data.data.ledgerEntries);
        setSelectedDeposit(depositId);
      }
    } catch (error) {
      console.error('Error fetching deposit ledger:', error);
      toast.error('Failed to fetch deposit ledger');
    }
  };

  const handleRecordDeposit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patientId || !formData.amount) {
      toast.error('Patient and amount are required');
      return;
    }

    try {
      const response = await fetch('/api/v1/billing/deposits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patientId: formData.patientId,
          amount: parseFloat(formData.amount),
          paymentMethod: formData.paymentMethod,
          referenceNumber: formData.referenceNumber || undefined,
          reason: formData.reason || undefined,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Deposit recorded successfully');
        setShowRecordForm(false);
        setFormData({
          patientId: '',
          amount: '',
          paymentMethod: 'CASH',
          referenceNumber: '',
          reason: '',
        });
        fetchDeposits();
      } else {
        toast.error(data.message || 'Failed to record deposit');
      }
    } catch (error) {
      console.error('Error recording deposit:', error);
      toast.error('Failed to record deposit');
    }
  };

  const handlePatientSearch = (patientId: string) => {
    setSelectedPatient(patientId);
    setFilters({ ...filters, patientId });
    if (patientId) {
      fetchDepositBalance(patientId);
    } else {
      setDepositBalance(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <BanknotesIcon className="h-8 w-8 text-blue-600" />
          Deposit Management
        </h1>
        <p className="mt-2 text-gray-600">
          Manage patient deposits, view balances, and track utilization
        </p>
      </div>

      {/* Deposit Balance Card */}
      {depositBalance && (
        <div className="mb-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Patient Deposit Balance</p>
              <p className="text-4xl font-bold mt-2">
                AED {depositBalance.totalBalance.toFixed(2)}
              </p>
              <p className="text-blue-100 text-sm mt-1">
                {depositBalance.activeDeposits} active deposit(s)
              </p>
            </div>
            <BanknotesIcon className="h-16 w-16 text-blue-300" />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setShowRecordForm(!showRecordForm)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors gap-2"
        >
          <PlusIcon className="h-5 w-5" />
          Record Deposit
        </button>
      </div>

      {/* Record Deposit Form */}
      {showRecordForm && (
        <div className="mb-6 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Record New Deposit</h2>
          <form onSubmit={handleRecordDeposit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Patient ID *
              </label>
              <input
                type="text"
                value={formData.patientId}
                onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter patient ID"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method *
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="CASH">Cash</option>
                <option value="CREDIT_CARD">Credit Card</option>
                <option value="DEBIT_CARD">Debit Card</option>
                <option value="UPI">UPI</option>
                <option value="NET_BANKING">Net Banking</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Number
              </label>
              <input
                type="text"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Transaction reference"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Purpose of deposit"
              />
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Record Deposit
              </button>
              <button
                type="button"
                onClick={() => setShowRecordForm(false)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Patient
            </label>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={filters.patientId}
                onChange={(e) => handlePatientSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Patient ID"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="UTILIZED">Utilized</option>
              <option value="REFUNDED">Refunded</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Deposits List */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Loading deposits...
                  </td>
                </tr>
              ) : deposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No deposits found
                  </td>
                </tr>
              ) : (
                deposits.map((deposit) => (
                  <tr key={deposit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <UserCircleIcon className="h-8 w-8 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {deposit.patient.firstName} {deposit.patient.lastName}
                          </div>
                          <div className="text-sm text-gray-500">MRN: {deposit.patient.mrn}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {deposit.currency} {deposit.amount.toFixed(2)}
                      </div>
                      {deposit.referenceNumber && (
                        <div className="text-xs text-gray-500">Ref: {deposit.referenceNumber}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-blue-600">
                        {deposit.currency} {deposit.remainingBalance.toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {deposit.paymentMethod.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={clsx(
                          'px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full',
                          statusColors[deposit.status]
                        )}
                      >
                        {deposit.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(deposit.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => fetchDepositLedger(deposit.id)}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        View Ledger
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ledger Modal */}
      {selectedDeposit && ledgerEntries.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardDocumentListIcon className="h-6 w-6 text-blue-600" />
                Deposit Ledger
              </h3>
              <button
                onClick={() => {
                  setSelectedDeposit(null);
                  setLedgerEntries([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              <div className="space-y-3">
                {ledgerEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span
                          className={clsx(
                            'px-2 py-1 text-xs font-semibold rounded',
                            entry.type === 'DEPOSIT' && 'bg-green-100 text-green-800',
                            entry.type === 'UTILIZATION' && 'bg-blue-100 text-blue-800',
                            entry.type === 'REFUND' && 'bg-orange-100 text-orange-800',
                            entry.type === 'ADJUSTMENT' && 'bg-purple-100 text-purple-800'
                          )}
                        >
                          {entry.type}
                        </span>
                        <p className="text-sm text-gray-900 mt-2">{entry.description}</p>
                        {entry.invoice && (
                          <p className="text-xs text-gray-500 mt-1">
                            Invoice: {entry.invoice.invoiceNumber}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={clsx(
                            'text-lg font-semibold',
                            entry.type === 'DEPOSIT' && 'text-green-600',
                            entry.type === 'UTILIZATION' && 'text-red-600',
                            entry.type === 'REFUND' && 'text-orange-600',
                            entry.type === 'ADJUSTMENT' && 'text-purple-600'
                          )}
                        >
                          {entry.type === 'DEPOSIT' || entry.type === 'REFUND' ? '+' : '-'}
                          AED {entry.amount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
