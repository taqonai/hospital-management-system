import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpenIcon,
  TableCellsIcon,
  ScaleIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  PlusIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  XMarkIcon,
  CheckCircleIcon,
  LockClosedIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { accountingApi } from '../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================

interface GLAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentId: string | null;
  isActive: boolean;
  description: string | null;
  children?: GLAccount[];
}

interface GLEntry {
  id: string;
  transactionDate: string;
  glAccountId: string;
  debitAmount: string;
  creditAmount: string;
  description: string;
  referenceType: string;
  referenceId: string;
  costCenter: string | null;
  createdAt: string;
  createdBy: string;
  glAccount: { accountCode: string; accountName: string };
  fiscalPeriod?: { name: string } | null;
}

interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  totalDebits: number;
  totalCredits: number;
  balance: number;
}

interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
  closedBy: string | null;
  closedAt: string | null;
}

// ============================================================================
// Tab definitions
// ============================================================================

const TABS = [
  { id: 'coa', label: 'Chart of Accounts', icon: BookOpenIcon },
  { id: 'ledger', label: 'General Ledger', icon: TableCellsIcon },
  { id: 'trial-balance', label: 'Trial Balance', icon: ScaleIcon },
  { id: 'fiscal-periods', label: 'Fiscal Periods', icon: CalendarDaysIcon },
  { id: 'journal', label: 'Journal Entries', icon: DocumentTextIcon },
] as const;

type TabId = (typeof TABS)[number]['id'];

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'REVENUE', 'EXPENSE', 'EQUITY'] as const;
const REFERENCE_TYPES = ['INVOICE', 'PAYMENT', 'REFUND', 'WRITE_OFF', 'DEPOSIT', 'REVERSAL', 'MANUAL'] as const;

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-800',
  LIABILITY: 'bg-red-100 text-red-800',
  REVENUE: 'bg-green-100 text-green-800',
  EXPENSE: 'bg-orange-100 text-orange-800',
  EQUITY: 'bg-purple-100 text-purple-800',
};

const formatCurrency = (val: number | string) => {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(n);
};

const formatDate = (d: string) => new Date(d).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' });

// ============================================================================
// Main Component
// ============================================================================

const Accounting: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('coa');

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Accounting</h1>
        <p className="text-sm text-gray-500 mt-1">General Ledger &amp; Chart of Accounts</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-6 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'coa' && <ChartOfAccountsTab />}
      {activeTab === 'ledger' && <GeneralLedgerTab />}
      {activeTab === 'trial-balance' && <TrialBalanceTab />}
      {activeTab === 'fiscal-periods' && <FiscalPeriodsTab />}
      {activeTab === 'journal' && <JournalTab />}
    </div>
  );
};

// ============================================================================
// Chart of Accounts Tab
// ============================================================================

const ChartOfAccountsTab: React.FC = () => {
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAccount, setEditAccount] = useState<GLAccount | null>(null);
  const [filterType, setFilterType] = useState<string>('');

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterType) params.accountType = filterType;
      const data = await accountingApi.listAccounts(params);
      setAccounts(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const handleSeed = async () => {
    try {
      await accountingApi.seedDefaultCoA();
      toast.success('Default Chart of Accounts seeded');
      loadAccounts();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to seed CoA');
    }
  };

  // Build tree structure
  const rootAccounts = accounts.filter((a) => !a.parentId);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSeed}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Seed Default CoA
          </button>
          <button
            onClick={() => { setEditAccount(null); setShowModal(true); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            <PlusIcon className="w-4 h-4" />
            Add Account
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12">
          <BookOpenIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No accounts yet. Seed the default healthcare Chart of Accounts to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(filterType ? accounts : rootAccounts).map((account) => (
                <AccountRow
                  key={account.id}
                  account={account}
                  depth={0}
                  onEdit={(a) => { setEditAccount(a); setShowModal(true); }}
                  allAccounts={accounts}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AccountModal
          account={editAccount}
          accounts={accounts}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadAccounts(); }}
        />
      )}
    </div>
  );
};

const AccountRow: React.FC<{
  account: GLAccount;
  depth: number;
  onEdit: (a: GLAccount) => void;
  allAccounts: GLAccount[];
}> = ({ account, depth, onEdit, allAccounts }) => {
  const [expanded, setExpanded] = useState(true);
  const children = allAccounts.filter((a) => a.parentId === account.id);

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3 text-sm font-mono" style={{ paddingLeft: `${16 + depth * 24}px` }}>
          {children.length > 0 && (
            <button onClick={() => setExpanded(!expanded)} className="mr-1 inline-block">
              <ChevronRightIcon className={clsx('w-4 h-4 transition-transform', expanded && 'rotate-90')} />
            </button>
          )}
          {account.accountCode}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">{account.accountName}</td>
        <td className="px-4 py-3">
          <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', ACCOUNT_TYPE_COLORS[account.accountType])}>
            {account.accountType}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600')}>
            {account.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{account.description || '—'}</td>
        <td className="px-4 py-3 text-right">
          <button onClick={() => onEdit(account)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
            Edit
          </button>
        </td>
      </tr>
      {expanded && children.map((child) => (
        <AccountRow key={child.id} account={child} depth={depth + 1} onEdit={onEdit} allAccounts={allAccounts} />
      ))}
    </>
  );
};

// ============================================================================
// Account Modal
// ============================================================================

const AccountModal: React.FC<{
  account: GLAccount | null;
  accounts: GLAccount[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ account, accounts, onClose, onSaved }) => {
  const [form, setForm] = useState({
    accountCode: account?.accountCode || '',
    accountName: account?.accountName || '',
    accountType: account?.accountType || 'ASSET',
    parentId: account?.parentId || '',
    description: account?.description || '',
    isActive: account?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (account) {
        await accountingApi.updateAccount(account.id, {
          accountName: form.accountName,
          description: form.description,
          isActive: form.isActive,
          parentId: form.parentId || null,
        });
        toast.success('Account updated');
      } else {
        await accountingApi.createAccount({
          accountCode: form.accountCode,
          accountName: form.accountName,
          accountType: form.accountType,
          parentId: form.parentId || undefined,
          description: form.description,
        });
        toast.success('Account created');
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{account ? 'Edit Account' : 'New GL Account'}</h2>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.accountCode}
                onChange={(e) => setForm({ ...form, accountCode: e.target.value })}
                disabled={!!account}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.accountType}
                onChange={(e) => setForm({ ...form, accountType: e.target.value })}
                disabled={!!account}
              >
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.accountName}
              onChange={(e) => setForm({ ...form, accountName: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Account</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.parentId}
              onChange={(e) => setForm({ ...form, parentId: e.target.value })}
            >
              <option value="">None (Root Account)</option>
              {accounts.filter((a) => a.id !== account?.id).map((a) => (
                <option key={a.id} value={a.id}>{a.accountCode} – {a.accountName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          {account && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving...' : account ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// General Ledger Tab
// ============================================================================

const GeneralLedgerTab: React.FC = () => {
  const [entries, setEntries] = useState<GLEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    referenceType: '',
    costCenter: '',
  });

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 25 };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.referenceType) params.referenceType = filters.referenceType;
      if (filters.costCenter) params.costCenter = filters.costCenter;
      const data = await accountingApi.queryGLEntries(params as any);
      setEntries(data.entries);
      setTotal(data.total);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load GL entries');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const handleReverse = async (entryId: string) => {
    const reason = prompt('Reason for reversal:');
    if (!reason) return;
    try {
      await accountingApi.reverseEntry(entryId, reason);
      toast.success('Entry reversed');
      loadEntries();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reverse entry');
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex items-end gap-3 mb-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.startDate}
            onChange={(e) => { setFilters({ ...filters, startDate: e.target.value }); setPage(1); }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.endDate}
            onChange={(e) => { setFilters({ ...filters, endDate: e.target.value }); setPage(1); }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Reference Type</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={filters.referenceType}
            onChange={(e) => { setFilters({ ...filters, referenceType: e.target.value }); setPage(1); }}
          >
            <option value="">All</option>
            {REFERENCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button
          onClick={() => { setFilters({ startDate: '', endDate: '', referenceType: '', costCenter: '' }); setPage(1); }}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <FunnelIcon className="w-4 h-4" />
          Clear
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <TableCellsIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No GL entries found.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Center</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDate(entry.transactionDate)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-mono text-xs text-gray-500">{entry.glAccount.accountCode}</span>{' '}
                      <span className="text-gray-900">{entry.glAccount.accountName}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {parseFloat(entry.debitAmount) > 0 ? formatCurrency(entry.debitAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {parseFloat(entry.creditAmount) > 0 ? formatCurrency(entry.creditAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{entry.description}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {entry.referenceType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{entry.costCenter || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleReverse(entry.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                        title="Reverse this entry"
                      >
                        Reverse
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-500">{total} entries total</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40"
              >
                Previous
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-600">Page {page}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={entries.length < 25}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Trial Balance Tab
// ============================================================================

const TrialBalanceTab: React.FC = () => {
  const [data, setData] = useState<{ rows: TrialBalanceRow[]; totalDebits: number; totalCredits: number; asOfDate: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (asOfDate) params.asOfDate = asOfDate;
      const result = await accountingApi.getTrialBalance(params);
      setData(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load trial balance');
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">As of Date</label>
          <input
            type="date"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
          <ArrowPathIcon className="w-4 h-4" />
          Generate
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : !data || data.rows.length === 0 ? (
        <div className="text-center py-12">
          <ScaleIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No data available for trial balance.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debits</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credits</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.rows.map((row) => (
                <tr key={row.accountId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{row.accountCode}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.accountName}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', ACCOUNT_TYPE_COLORS[row.accountType])}>
                      {row.accountType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{formatCurrency(row.totalDebits)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{formatCurrency(row.totalCredits)}</td>
                  <td className={clsx('px-4 py-3 text-sm text-right font-mono font-medium', row.balance >= 0 ? 'text-gray-900' : 'text-red-600')}>
                    {formatCurrency(Math.abs(row.balance))} {row.balance < 0 ? 'CR' : 'DR'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm text-gray-700">Totals</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{formatCurrency(data.totalDebits)}</td>
                <td className="px-4 py-3 text-sm text-right font-mono">{formatCurrency(data.totalCredits)}</td>
                <td className="px-4 py-3 text-sm text-right font-mono">
                  {Math.abs(data.totalDebits - data.totalCredits) < 0.01 ? (
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <CheckCircleIcon className="w-4 h-4" /> Balanced
                    </span>
                  ) : (
                    <span className="text-red-600">Imbalance: {formatCurrency(Math.abs(data.totalDebits - data.totalCredits))}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Fiscal Periods Tab
// ============================================================================

const FiscalPeriodsTab: React.FC = () => {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await accountingApi.listFiscalPeriods();
      setPeriods(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load fiscal periods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleClose = async (id: string) => {
    if (!confirm('Are you sure you want to close this fiscal period? This cannot be undone.')) return;
    try {
      await accountingApi.closeFiscalPeriod(id);
      toast.success('Fiscal period closed');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to close period');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Fiscal Periods</h3>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          <PlusIcon className="w-4 h-4" />
          New Period
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : periods.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDaysIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No fiscal periods defined.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {periods.map((p) => (
            <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-900">{p.name}</h4>
                  {p.isClosed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      <LockClosedIcon className="w-3 h-3" /> Closed
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Open</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDate(p.startDate)} — {formatDate(p.endDate)}
                  {p.closedAt && <span className="ml-2">· Closed {formatDate(p.closedAt)}</span>}
                </p>
              </div>
              {!p.isClosed && (
                <button
                  onClick={() => handleClose(p.id)}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
                >
                  Close Period
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <FiscalPeriodModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} />
      )}
    </div>
  );
};

const FiscalPeriodModal: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await accountingApi.createFiscalPeriod(form);
      toast.success('Fiscal period created');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create period');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">New Fiscal Period</h2>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period Name</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g., FY 2025 Q1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// Journal Entries Tab
// ============================================================================

const JournalTab: React.FC = () => {
  const [referenceId, setReferenceId] = useState('');
  const [journal, setJournal] = useState<{ entries: GLEntry[]; totalDebits: number; totalCredits: number; isBalanced: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!referenceId.trim()) return;
    setLoading(true);
    try {
      const data = await accountingApi.getJournal(referenceId.trim());
      setJournal(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No journal entries found');
      setJournal(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-end gap-3 mb-6">
        <div className="flex-1 max-w-md">
          <label className="block text-xs font-medium text-gray-500 mb-1">Reference ID (Invoice, Payment, etc.)</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Enter reference ID..."
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
          />
        </div>
        <button
          onClick={search}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <DocumentTextIcon className="w-4 h-4" />
          Lookup
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Searching...</div>
      ) : !journal ? (
        <div className="text-center py-12">
          <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Enter a reference ID to view journal entries.</p>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {journal.entries.length} entries for reference <span className="font-mono font-medium">{referenceId}</span>
            </span>
            {journal.isBalanced ? (
              <span className="inline-flex items-center gap-1 text-sm text-green-600">
                <CheckCircleIcon className="w-4 h-4" /> Balanced
              </span>
            ) : (
              <span className="text-sm text-red-600">⚠ Not balanced</span>
            )}
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {journal.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{formatDate(entry.transactionDate)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-mono text-xs text-gray-500">{entry.glAccount.accountCode}</span>{' '}
                      {entry.glAccount.accountName}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {parseFloat(entry.debitAmount) > 0 ? formatCurrency(entry.debitAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono">
                      {parseFloat(entry.creditAmount) > 0 ? formatCurrency(entry.creditAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{entry.description}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm">Totals</td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{formatCurrency(journal.totalDebits)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{formatCurrency(journal.totalCredits)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounting;
