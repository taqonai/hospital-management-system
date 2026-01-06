import { useState, useEffect } from 'react';
import {
  ClipboardDocumentCheckIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  AcademicCapIcon,
  EyeIcon,
  PaperClipIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type AuditStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
type AuditType = 'INTERNAL' | 'EXTERNAL' | 'REGULATORY' | 'ACCREDITATION' | 'MOCK_SURVEY';
type FindingSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR' | 'OBSERVATION';
type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'NA' | 'PENDING';

interface AuditTeamMember {
  id: string;
  name: string;
  role: string;
}

interface ChecklistItem {
  id: string;
  description: string;
  category: string;
  status: ComplianceStatus;
  comments: string;
  evidenceCount: number;
}

interface Finding {
  id: string;
  description: string;
  severity: FindingSeverity;
  category: string;
  requiredAction: string;
  dueDate: string;
  responsiblePerson: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
}

interface Audit {
  id: string;
  name: string;
  description: string;
  type: AuditType;
  status: AuditStatus;
  scheduledDate: string;
  completedDate?: string;
  leadAuditor: string;
  teamMembers: AuditTeamMember[];
  scope: string[];
  checklistTemplate: string;
  overallScore?: number;
  checklistItems: ChecklistItem[];
  findings: Finding[];
  createdAt: string;
}

interface AuditStats {
  auditsThisMonth: number;
  pendingAudits: number;
  averageComplianceScore: number;
  openFindingsCount: number;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockAudits: Audit[] = [
  {
    id: '1',
    name: 'Q4 Internal Quality Audit',
    description: 'Quarterly internal audit covering patient safety and documentation standards',
    type: 'INTERNAL',
    status: 'COMPLETED',
    scheduledDate: '2024-12-15',
    completedDate: '2024-12-16',
    leadAuditor: 'Dr. Sarah Johnson',
    teamMembers: [
      { id: '1', name: 'John Smith', role: 'Quality Manager' },
      { id: '2', name: 'Mary Williams', role: 'Nurse Manager' },
    ],
    scope: ['Patient Safety', 'Documentation', 'Infection Control'],
    checklistTemplate: 'Internal Quality Checklist v2.1',
    overallScore: 92,
    checklistItems: [
      { id: 'c1', description: 'Hand hygiene compliance documented', category: 'Infection Control', status: 'COMPLIANT', comments: 'All stations compliant', evidenceCount: 3 },
      { id: 'c2', description: 'Patient identification process followed', category: 'Patient Safety', status: 'COMPLIANT', comments: '', evidenceCount: 2 },
      { id: 'c3', description: 'Medication reconciliation completed', category: 'Medication Safety', status: 'NON_COMPLIANT', comments: 'Missing in 2 cases', evidenceCount: 1 },
      { id: 'c4', description: 'Fall risk assessment documented', category: 'Patient Safety', status: 'COMPLIANT', comments: '', evidenceCount: 2 },
      { id: 'c5', description: 'Consent forms properly completed', category: 'Documentation', status: 'COMPLIANT', comments: '', evidenceCount: 4 },
    ],
    findings: [
      { id: 'f1', description: 'Medication reconciliation incomplete in 2 patient records', severity: 'MAJOR', category: 'Medication Safety', requiredAction: 'Re-train staff on medication reconciliation process', dueDate: '2025-01-15', responsiblePerson: 'Nurse Manager', status: 'OPEN' },
    ],
    createdAt: '2024-12-01',
  },
  {
    id: '2',
    name: 'JCI Accreditation Survey Prep',
    description: 'Mock survey in preparation for upcoming JCI accreditation visit',
    type: 'MOCK_SURVEY',
    status: 'IN_PROGRESS',
    scheduledDate: '2025-01-08',
    leadAuditor: 'Dr. Michael Chen',
    teamMembers: [
      { id: '3', name: 'Lisa Park', role: 'Compliance Officer' },
      { id: '4', name: 'Robert Davis', role: 'Risk Manager' },
    ],
    scope: ['International Patient Safety Goals', 'Facility Management', 'Staff Qualifications'],
    checklistTemplate: 'JCI Standards Checklist 2024',
    checklistItems: [
      { id: 'c6', description: 'IPSG 1: Patient Identification', category: 'IPSG', status: 'PENDING', comments: '', evidenceCount: 0 },
      { id: 'c7', description: 'IPSG 2: Effective Communication', category: 'IPSG', status: 'PENDING', comments: '', evidenceCount: 0 },
      { id: 'c8', description: 'IPSG 3: High-Alert Medications', category: 'IPSG', status: 'COMPLIANT', comments: 'Reviewed and verified', evidenceCount: 5 },
    ],
    findings: [],
    createdAt: '2024-12-20',
  },
  {
    id: '3',
    name: 'State Health Department Inspection',
    description: 'Annual regulatory inspection by state health department',
    type: 'REGULATORY',
    status: 'SCHEDULED',
    scheduledDate: '2025-02-10',
    leadAuditor: 'External Inspector',
    teamMembers: [
      { id: '5', name: 'Dr. Emily Brown', role: 'Chief Medical Officer' },
      { id: '6', name: 'James Wilson', role: 'Facility Director' },
    ],
    scope: ['Life Safety', 'Environmental Safety', 'Emergency Preparedness'],
    checklistTemplate: 'State Regulatory Requirements 2024',
    checklistItems: [],
    findings: [],
    createdAt: '2025-01-02',
  },
  {
    id: '4',
    name: 'External ISO 9001 Audit',
    description: 'External audit for ISO 9001:2015 certification renewal',
    type: 'EXTERNAL',
    status: 'SCHEDULED',
    scheduledDate: '2025-03-15',
    leadAuditor: 'ISO Certification Body',
    teamMembers: [
      { id: '7', name: 'Karen Thompson', role: 'Quality Director' },
    ],
    scope: ['Quality Management System', 'Process Documentation', 'Continuous Improvement'],
    checklistTemplate: 'ISO 9001:2015 Audit Checklist',
    checklistItems: [],
    findings: [],
    createdAt: '2025-01-05',
  },
];

const mockStats: AuditStats = {
  auditsThisMonth: 3,
  pendingAudits: 2,
  averageComplianceScore: 89,
  openFindingsCount: 4,
};

const auditTypeLabels: Record<AuditType, { label: string; icon: React.ElementType }> = {
  INTERNAL: { label: 'Internal Audit', icon: BuildingOfficeIcon },
  EXTERNAL: { label: 'External Audit', icon: UserGroupIcon },
  REGULATORY: { label: 'Regulatory Inspection', icon: ShieldCheckIcon },
  ACCREDITATION: { label: 'Accreditation Survey', icon: AcademicCapIcon },
  MOCK_SURVEY: { label: 'Mock Survey', icon: EyeIcon },
};

const statusConfig: Record<AuditStatus, { bg: string; text: string; border: string; dot: string }> = {
  SCHEDULED: { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  IN_PROGRESS: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20', dot: 'bg-amber-500 animate-pulse' },
  COMPLETED: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
};

const severityConfig: Record<FindingSeverity, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-red-500/10', text: 'text-red-700', border: 'border-red-500/20' },
  MAJOR: { bg: 'bg-orange-500/10', text: 'text-orange-700', border: 'border-orange-500/20' },
  MINOR: { bg: 'bg-yellow-500/10', text: 'text-yellow-700', border: 'border-yellow-500/20' },
  OBSERVATION: { bg: 'bg-gray-500/10', text: 'text-gray-700', border: 'border-gray-500/20' },
};

const complianceStatusConfig: Record<ComplianceStatus, { bg: string; text: string; icon: React.ElementType }> = {
  COMPLIANT: { bg: 'bg-emerald-500', text: 'text-white', icon: CheckCircleIcon },
  NON_COMPLIANT: { bg: 'bg-red-500', text: 'text-white', icon: XMarkIcon },
  NA: { bg: 'bg-gray-400', text: 'text-white', icon: DocumentTextIcon },
  PENDING: { bg: 'bg-gray-200', text: 'text-gray-600', icon: ClockIcon },
};

// ============================================================================
// MOCK API CALLS
// ============================================================================

const auditApi = {
  getAudits: async (_params?: any): Promise<{ data: { data: Audit[] } }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return { data: { data: mockAudits } };
  },
  getStats: async (): Promise<{ data: { data: AuditStats } }> => {
    await new Promise(resolve => setTimeout(resolve, 300));
    return { data: { data: mockStats } };
  },
  createAudit: async (_data: any): Promise<{ data: { data: Audit } }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { data: { data: mockAudits[0] } };
  },
  updateChecklistItem: async (_auditId: string, _itemId: string, _data: any): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 300));
  },
  addFinding: async (_auditId: string, _data: any): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 300));
  },
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Schedule Audit Modal
function ScheduleAuditModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'INTERNAL' as AuditType,
    scheduledDate: '',
    leadAuditor: '',
    teamMembers: '',
    scope: '',
    checklistTemplate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.scheduledDate || !formData.leadAuditor) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await auditApi.createAudit(formData);
      toast.success('Audit scheduled successfully');
      onSuccess();
    } catch (error) {
      toast.error('Failed to schedule audit');
    } finally {
      setLoading(false);
    }
  };

  const checklistTemplates = [
    'Internal Quality Checklist v2.1',
    'JCI Standards Checklist 2024',
    'ISO 9001:2015 Audit Checklist',
    'State Regulatory Requirements 2024',
    'Infection Control Audit Template',
    'Patient Safety Survey Template',
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Schedule New Audit</h2>
                <p className="text-white/80 text-sm">Create a new quality audit or inspection</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <XMarkIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Audit Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Audit Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Q1 Internal Quality Audit"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the audit scope and objectives..."
                rows={2}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Audit Type and Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Audit Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as AuditType })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                >
                  <option value="INTERNAL">Internal Audit</option>
                  <option value="EXTERNAL">External Audit</option>
                  <option value="REGULATORY">Regulatory Inspection</option>
                  <option value="ACCREDITATION">Accreditation Survey</option>
                  <option value="MOCK_SURVEY">Mock Survey</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Scheduled Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            {/* Lead Auditor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Lead Auditor <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.leadAuditor}
                onChange={(e) => setFormData({ ...formData, leadAuditor: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                required
              >
                <option value="">Select Lead Auditor</option>
                <option value="Dr. Sarah Johnson">Dr. Sarah Johnson - Quality Director</option>
                <option value="Dr. Michael Chen">Dr. Michael Chen - CMO</option>
                <option value="Karen Thompson">Karen Thompson - Compliance Officer</option>
                <option value="External Inspector">External Inspector</option>
              </select>
            </div>

            {/* Team Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Team Members</label>
              <input
                type="text"
                value={formData.teamMembers}
                onChange={(e) => setFormData({ ...formData, teamMembers: e.target.value })}
                placeholder="Comma-separated names of team members"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              />
            </div>

            {/* Scope/Areas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Scope / Areas to Audit</label>
              <input
                type="text"
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                placeholder="e.g., Patient Safety, Infection Control, Documentation"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              />
            </div>

            {/* Checklist Template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Checklist Template</label>
              <select
                value={formData.checklistTemplate}
                onChange={(e) => setFormData({ ...formData, checklistTemplate: e.target.value })}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              >
                <option value="">Select a checklist template</option>
                {checklistTemplates.map((template) => (
                  <option key={template} value={template}>{template}</option>
                ))}
              </select>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <CalendarDaysIcon className="h-5 w-5" />
                    Schedule Audit
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Add Finding Modal
function AddFindingModal({
  auditId,
  onClose,
  onSuccess,
}: {
  auditId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    severity: 'MINOR' as FindingSeverity,
    category: '',
    requiredAction: '',
    dueDate: '',
    responsiblePerson: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.requiredAction || !formData.dueDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await auditApi.addFinding(auditId, formData);
      toast.success('Finding added successfully');
      onSuccess();
    } catch (error) {
      toast.error('Failed to add finding');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Add Finding</h2>
                <p className="text-white/80 text-sm">Document a non-compliance or observation</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <XMarkIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the finding in detail..."
                rows={3}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
                required
              />
            </div>

            {/* Severity and Category */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Severity</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as FindingSeverity })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                >
                  <option value="CRITICAL">Critical</option>
                  <option value="MAJOR">Major</option>
                  <option value="MINOR">Minor</option>
                  <option value="OBSERVATION">Observation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Medication Safety"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>
            </div>

            {/* Required Action */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Required Action <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.requiredAction}
                onChange={(e) => setFormData({ ...formData, requiredAction: e.target.value })}
                placeholder="What corrective action is required..."
                rows={2}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
                required
              />
            </div>

            {/* Due Date and Responsible Person */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Due Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsible Person</label>
                <input
                  type="text"
                  value={formData.responsiblePerson}
                  onChange={(e) => setFormData({ ...formData, responsiblePerson: e.target.value })}
                  placeholder="Name or role"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <PlusIcon className="h-5 w-5" />
                    Add Finding
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Audit Detail View
function AuditDetailView({
  audit,
  onClose,
  onUpdate,
}: {
  audit: Audit;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [activeSection, setActiveSection] = useState<'info' | 'checklist' | 'findings'>('info');
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [checklistItems, setChecklistItems] = useState(audit.checklistItems);

  const handleChecklistStatusChange = async (itemId: string, newStatus: ComplianceStatus) => {
    try {
      await auditApi.updateChecklistItem(audit.id, itemId, { status: newStatus });
      setChecklistItems(prev =>
        prev.map(item => (item.id === itemId ? { ...item, status: newStatus } : item))
      );
      toast.success('Item updated');
    } catch (error) {
      toast.error('Failed to update item');
    }
  };

  const status = statusConfig[audit.status];
  const TypeIcon = auditTypeLabels[audit.type].icon;

  // Calculate compliance stats
  const totalItems = checklistItems.length;
  const compliantItems = checklistItems.filter(i => i.status === 'COMPLIANT').length;
  const nonCompliantItems = checklistItems.filter(i => i.status === 'NON_COMPLIANT').length;
  const pendingItems = checklistItems.filter(i => i.status === 'PENDING').length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 px-6 py-5 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                  <TypeIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{audit.name}</h2>
                  <p className="text-white/80 text-sm mt-1">{auditTypeLabels[audit.type].label}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={clsx(
                      'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm',
                      'bg-white/20 text-white border border-white/30'
                    )}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full', status.dot)} />
                      {audit.status.replace('_', ' ')}
                    </span>
                    {audit.overallScore !== undefined && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-sm">
                        Score: {audit.overallScore}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <XMarkIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex border-b border-gray-200 px-6 bg-gray-50 flex-shrink-0">
            {[
              { id: 'info', label: 'General Info', icon: DocumentTextIcon },
              { id: 'checklist', label: `Checklist (${totalItems})`, icon: ClipboardDocumentCheckIcon },
              { id: 'findings', label: `Findings (${audit.findings.length})`, icon: ExclamationTriangleIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as typeof activeSection)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all',
                  activeSection === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* General Info Section */}
            {activeSection === 'info' && (
              <div className="space-y-6">
                {/* Description */}
                {audit.description && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                    <p className="text-gray-600">{audit.description}</p>
                  </div>
                )}

                {/* Key Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Scheduled Date</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(audit.scheduledDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Lead Auditor</p>
                    <p className="font-semibold text-gray-900">{audit.leadAuditor}</p>
                  </div>
                </div>

                {/* Team Members */}
                {audit.teamMembers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Audit Team</h4>
                    <div className="flex flex-wrap gap-2">
                      {audit.teamMembers.map((member) => (
                        <div
                          key={member.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100"
                        >
                          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{member.name}</p>
                            <p className="text-xs text-gray-500">{member.role}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scope */}
                {audit.scope.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Scope / Areas</h4>
                    <div className="flex flex-wrap gap-2">
                      {audit.scope.map((area, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-sm font-medium border border-purple-100"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Checklist Template */}
                {audit.checklistTemplate && (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Checklist Template</p>
                    <p className="font-semibold text-gray-900">{audit.checklistTemplate}</p>
                  </div>
                )}

                {/* Score Summary */}
                {totalItems > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Compliance Summary</h4>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{compliantItems}</p>
                        <p className="text-xs text-emerald-700">Compliant</p>
                      </div>
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center">
                        <p className="text-2xl font-bold text-red-600">{nonCompliantItems}</p>
                        <p className="text-xs text-red-700">Non-Compliant</p>
                      </div>
                      <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-center">
                        <p className="text-2xl font-bold text-gray-600">{pendingItems}</p>
                        <p className="text-xs text-gray-700">Pending</p>
                      </div>
                      <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
                        <p className="text-2xl font-bold text-indigo-600">{totalItems}</p>
                        <p className="text-xs text-indigo-700">Total Items</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Checklist Section */}
            {activeSection === 'checklist' && (
              <div className="space-y-4">
                {checklistItems.length === 0 ? (
                  <div className="text-center py-12">
                    <ClipboardDocumentCheckIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">No checklist items yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Checklist items will appear here once the audit begins
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {checklistItems.map((item) => {
                      const statusConf = complianceStatusConfig[item.status];
                      const StatusIcon = statusConf.icon;
                      return (
                        <div
                          key={item.id}
                          className="p-4 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                                  {item.category}
                                </span>
                              </div>
                              <p className="text-gray-900 font-medium">{item.description}</p>
                              {item.comments && (
                                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                                  <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                                  {item.comments}
                                </p>
                              )}
                              {item.evidenceCount > 0 && (
                                <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
                                  <PaperClipIcon className="h-3.5 w-3.5" />
                                  {item.evidenceCount} evidence file(s) attached
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Status Toggle Buttons */}
                              <div className="flex rounded-lg overflow-hidden border border-gray-300">
                                {(['COMPLIANT', 'NON_COMPLIANT', 'NA'] as ComplianceStatus[]).map((st) => {
                                  const conf = complianceStatusConfig[st];
                                  const Icon = conf.icon;
                                  const isActive = item.status === st;
                                  return (
                                    <button
                                      key={st}
                                      onClick={() => handleChecklistStatusChange(item.id, st)}
                                      className={clsx(
                                        'p-2 transition-colors',
                                        isActive ? conf.bg : 'bg-white hover:bg-gray-50'
                                      )}
                                      title={st.replace('_', ' ')}
                                    >
                                      <Icon className={clsx('h-4 w-4', isActive ? conf.text : 'text-gray-400')} />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Findings Section */}
            {activeSection === 'findings' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowAddFinding(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium hover:from-orange-600 hover:to-red-600 transition-all"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Finding
                  </button>
                </div>

                {audit.findings.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircleIcon className="h-12 w-12 mx-auto text-emerald-300 mb-4" />
                    <p className="text-gray-500">No findings recorded</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Great job! No issues have been identified so far
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {audit.findings.map((finding) => {
                      const sevConfig = severityConfig[finding.severity];
                      return (
                        <div
                          key={finding.id}
                          className={clsx(
                            'p-4 rounded-xl border',
                            sevConfig.bg,
                            sevConfig.border
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={clsx(
                                  'px-2 py-0.5 rounded text-xs font-bold',
                                  sevConfig.bg,
                                  sevConfig.text,
                                  'border',
                                  sevConfig.border
                                )}>
                                  {finding.severity}
                                </span>
                                {finding.category && (
                                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                                    {finding.category}
                                  </span>
                                )}
                                <span className={clsx(
                                  'px-2 py-0.5 rounded text-xs font-medium',
                                  finding.status === 'OPEN' ? 'bg-red-100 text-red-700' :
                                  finding.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                                  'bg-green-100 text-green-700'
                                )}>
                                  {finding.status.replace('_', ' ')}
                                </span>
                              </div>
                              <p className={clsx('font-medium', sevConfig.text)}>{finding.description}</p>
                              <div className="mt-3 p-3 rounded-lg bg-white/50 border border-white/80">
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Required Action</p>
                                <p className="text-sm text-gray-700">{finding.requiredAction}</p>
                              </div>
                              <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <CalendarDaysIcon className="h-4 w-4" />
                                  Due: {new Date(finding.dueDate).toLocaleDateString()}
                                </span>
                                {finding.responsiblePerson && (
                                  <span className="flex items-center gap-1">
                                    <UserGroupIcon className="h-4 w-4" />
                                    {finding.responsiblePerson}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Finding Modal */}
      {showAddFinding && (
        <AddFindingModal
          auditId={audit.id}
          onClose={() => setShowAddFinding(false)}
          onSuccess={() => {
            setShowAddFinding(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AuditTracker() {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [stats, setStats] = useState<AuditStats>(mockStats);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<AuditType | ''>('');
  const [statusFilter, setStatusFilter] = useState<AuditStatus | ''>('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);

  // Fetch audits
  useEffect(() => {
    const fetchAudits = async () => {
      try {
        setLoading(true);
        const response = await auditApi.getAudits({
          type: typeFilter || undefined,
          status: statusFilter || undefined,
          search: search || undefined,
        });
        setAudits(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch audits:', error);
        toast.error('Failed to load audits');
      } finally {
        setLoading(false);
      }
    };

    fetchAudits();
  }, [typeFilter, statusFilter, search]);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await auditApi.getStats();
        setStats(response.data.data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
  }, []);

  // Filter audits based on search
  const filteredAudits = audits.filter(audit => {
    if (search && !audit.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (typeFilter && audit.type !== typeFilter) {
      return false;
    }
    if (statusFilter && audit.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const statCards = [
    { label: 'Audits This Month', value: stats.auditsThisMonth, icon: CalendarDaysIcon, gradient: 'from-indigo-500 to-purple-600', bg: 'bg-indigo-500/10' },
    { label: 'Pending Audits', value: stats.pendingAudits, icon: ClockIcon, gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-500/10' },
    { label: 'Avg Compliance', value: `${stats.averageComplianceScore}%`, icon: ChartBarIcon, gradient: 'from-emerald-500 to-green-600', bg: 'bg-emerald-500/10' },
    { label: 'Open Findings', value: stats.openFindingsCount, icon: ExclamationTriangleIcon, gradient: 'from-red-500 to-rose-600', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-6 animate-fade-in-up" style={{ animationFillMode: 'forwards' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-purple-300/20 rounded-full blur-3xl" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 mb-3">
              <ClipboardDocumentCheckIcon className="h-4 w-4 text-white/80" />
              <span className="text-xs font-medium text-white/90">Quality Management</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Audit Tracker</h1>
            <p className="mt-1 text-white/70">Track quality audits, inspections, and compliance</p>
          </div>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white font-semibold hover:bg-white/20 transition-all hover:scale-105 group"
          >
            <PlusIcon className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
            Schedule Audit
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-2xl p-5 backdrop-blur-xl bg-white border border-gray-200 shadow-lg group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fade-in-up opacity-0"
            style={{ animationDelay: `${100 + idx * 100}ms`, animationFillMode: 'forwards' }}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className={clsx('absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity', stat.gradient)} />
            <div className="flex items-center gap-4">
              <div className={clsx('p-3 rounded-xl group-hover:scale-110 transition-transform', stat.bg)}>
                <stat.icon className="h-6 w-6 text-gray-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div
        className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg animate-fade-in-up opacity-0"
        style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        <div className="p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1 group">
              <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="Search audits by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 placeholder-gray-400 transition-all"
              />
            </div>
            <div className="flex items-center gap-3">
              <FunnelIcon className="h-5 w-5 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as AuditType | '')}
                className="appearance-none px-4 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-gray-700 cursor-pointer transition-all"
              >
                <option value="">All Types</option>
                <option value="INTERNAL">Internal Audit</option>
                <option value="EXTERNAL">External Audit</option>
                <option value="REGULATORY">Regulatory Inspection</option>
                <option value="ACCREDITATION">Accreditation Survey</option>
                <option value="MOCK_SURVEY">Mock Survey</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AuditStatus | '')}
                className="appearance-none px-4 py-3 text-sm rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-gray-700 cursor-pointer transition-all"
              >
                <option value="">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Audits List */}
      <div
        className="relative overflow-hidden rounded-2xl backdrop-blur-xl bg-white border border-gray-200 shadow-lg animate-fade-in-up opacity-0"
        style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            </div>
            <p className="text-gray-500 animate-pulse">Loading audits...</p>
          </div>
        ) : filteredAudits.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center">
              <ClipboardDocumentCheckIcon className="h-10 w-10 text-indigo-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No audits found</h3>
            <p className="text-gray-500">Schedule a new audit to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredAudits.map((audit, idx) => {
              const status = statusConfig[audit.status];
              const typeInfo = auditTypeLabels[audit.type];
              const TypeIcon = typeInfo.icon;

              return (
                <div
                  key={audit.id}
                  onClick={() => setSelectedAudit(audit)}
                  className="p-5 hover:bg-gray-50 transition-all cursor-pointer animate-fade-in-up opacity-0"
                  style={{ animationDelay: `${700 + idx * 50}ms`, animationFillMode: 'forwards' }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={clsx('p-3 rounded-xl', 'bg-gradient-to-br from-indigo-500/10 to-purple-500/10')}>
                        <TypeIcon className="h-6 w-6 text-indigo-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 flex-wrap mb-1">
                          <h3 className="font-semibold text-gray-900">{audit.name}</h3>
                          <span className={clsx(
                            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
                            status.bg, status.text, status.border
                          )}>
                            <span className={clsx('w-1.5 h-1.5 rounded-full', status.dot)} />
                            {audit.status.replace('_', ' ')}
                          </span>
                          {audit.overallScore !== undefined && (
                            <span className={clsx(
                              'px-2.5 py-1 rounded-full text-xs font-bold',
                              audit.overallScore >= 90 ? 'bg-emerald-100 text-emerald-700' :
                              audit.overallScore >= 75 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            )}>
                              {audit.overallScore}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mb-2">{typeInfo.label}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <CalendarDaysIcon className="h-4 w-4" />
                            {new Date(audit.scheduledDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <UserGroupIcon className="h-4 w-4" />
                            {audit.leadAuditor}
                          </span>
                          {audit.findings.length > 0 && (
                            <span className="flex items-center gap-1 text-orange-600">
                              <ExclamationTriangleIcon className="h-4 w-4" />
                              {audit.findings.length} finding(s)
                            </span>
                          )}
                        </div>
                        {audit.scope.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {audit.scope.slice(0, 3).map((area, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                              >
                                {area}
                              </span>
                            ))}
                            {audit.scope.length > 3 && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                +{audit.scope.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Audit Modal */}
      {showScheduleModal && (
        <ScheduleAuditModal
          onClose={() => setShowScheduleModal(false)}
          onSuccess={() => {
            setShowScheduleModal(false);
            // Refresh audits
            auditApi.getAudits().then(response => {
              setAudits(response.data.data || []);
            });
          }}
        />
      )}

      {/* Audit Detail View */}
      {selectedAudit && (
        <AuditDetailView
          audit={selectedAudit}
          onClose={() => setSelectedAudit(null)}
          onUpdate={() => {
            // Refresh audits
            auditApi.getAudits().then(response => {
              setAudits(response.data.data || []);
              // Update selected audit
              const updated = response.data.data.find(a => a.id === selectedAudit.id);
              if (updated) setSelectedAudit(updated);
            });
          }}
        />
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
