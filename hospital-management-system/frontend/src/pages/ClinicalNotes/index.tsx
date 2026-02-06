import { useState, useEffect, useCallback } from 'react';
import {
  DocumentTextIcon,
  SparklesIcon,
  ClockIcon,
  MicrophoneIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { aiScribeApi } from '../../services/api';
import toast from 'react-hot-toast';

// ============ Types ============

interface ClinicalNote {
  id: string;
  noteType: string;
  status: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  fullText?: string;
  aiGenerated: boolean;
  aiSessionId?: string;
  modelVersion?: string;
  suggestedIcdCodes?: Array<{ code: string; description: string }>;
  suggestedCptCodes?: Array<{ code: string; description: string }>;
  keyFindings?: string[];
  signedAt?: string;
  createdAt: string;
  patient?: { id: string; firstName: string; lastName: string; mrn: string };
  author?: { id: string; firstName: string; lastName: string };
  signedBy?: { id: string; firstName: string; lastName: string };
  diagnoses?: Array<{ diagnosis: string; icdCode?: string; isPrimary?: boolean; confidence?: number }>;
  prescriptions?: Array<{ medication: string; dosage?: string; frequency?: string; duration?: string; route?: string }>;
}

interface ScribeSession {
  id: string;
  sessionType: string;
  status: string;
  transcriptText?: string;
  patientContext?: any;
  startedAt: string;
  completedAt?: string;
  patient?: { id: string; firstName: string; lastName: string; mrn: string };
  notes?: Array<{ id: string; noteType: string; status: string; createdAt: string }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============ Helpers ============

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function noteTypeLabel(type: string): string {
  const map: Record<string, string> = {
    CONSULTATION: 'Consultation',
    FOLLOW_UP: 'Follow-up',
    PROCEDURE: 'Procedure',
    DISCHARGE: 'Discharge',
    ADMISSION: 'Admission',
    EMERGENCY: 'Emergency',
    TELEHEALTH: 'Telehealth',
    SOAP: 'SOAP Note',
    PROGRESS: 'Progress Note',
  };
  return map[type] || type;
}

function statusBadge(status: string) {
  switch (status) {
    case 'SIGNED':
      return 'bg-green-100 text-green-700';
    case 'DRAFT':
      return 'bg-amber-100 text-amber-700';
    case 'NOTE_GENERATED':
      return 'bg-blue-100 text-blue-700';
    case 'ACTIVE':
      return 'bg-blue-100 text-blue-700';
    case 'TRANSCRIBING':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

// ============ Component ============

export default function ClinicalNotes() {
  const [activeTab, setActiveTab] = useState<'notes' | 'sessions'>('notes');

  // Notes state
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [notesPagination, setNotesPagination] = useState<Pagination | null>(null);
  const [notesPage, setNotesPage] = useState(1);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteTypeFilter, setNoteTypeFilter] = useState('');
  const [noteStatusFilter, setNoteStatusFilter] = useState('');

  // Sessions state
  const [sessions, setSessions] = useState<ScribeSession[]>([]);
  const [sessionsPagination, setSessionsPagination] = useState<Pagination | null>(null);
  const [sessionsPage, setSessionsPage] = useState(1);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Expanded note/session detail
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [noteDetail, setNoteDetail] = useState<ClinicalNote | null>(null);
  const [noteDetailLoading, setNoteDetailLoading] = useState(false);

  // Stats
  const [totalNotes, setTotalNotes] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);

  // ---- Fetch Notes ----
  const fetchNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const params: any = { page: notesPage, limit: 15 };
      if (noteTypeFilter) params.noteType = noteTypeFilter;
      if (noteStatusFilter) params.status = noteStatusFilter;
      const response = await aiScribeApi.getNotes(params);
      const data = response.data?.data || response.data;
      setNotes(data.notes || []);
      setNotesPagination(data.pagination || null);
      setTotalNotes(data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch clinical notes:', err);
    } finally {
      setNotesLoading(false);
    }
  }, [notesPage, noteTypeFilter, noteStatusFilter]);

  // ---- Fetch Sessions ----
  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const response = await aiScribeApi.getSessions({ page: sessionsPage, limit: 15 });
      const data = response.data?.data || response.data;
      setSessions(data.sessions || []);
      setSessionsPagination(data.pagination || null);
      setTotalSessions(data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch scribe sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, [sessionsPage]);

  // ---- Fetch Note Detail ----
  const fetchNoteDetail = useCallback(async (noteId: string) => {
    setNoteDetailLoading(true);
    try {
      const response = await aiScribeApi.getNoteById(noteId);
      const data = response.data?.data || response.data;
      setNoteDetail(data);
    } catch (err) {
      console.error('Failed to fetch note detail:', err);
      toast.error('Failed to load note details');
    } finally {
      setNoteDetailLoading(false);
    }
  }, []);

  // ---- Sign Note ----
  const handleSignNote = async (noteId: string) => {
    try {
      await aiScribeApi.signNote(noteId);
      toast.success('Note signed successfully');
      fetchNotes();
      if (noteDetail?.id === noteId) {
        fetchNoteDetail(noteId);
      }
    } catch (err) {
      toast.error('Failed to sign note');
    }
  };

  // ---- Effects ----
  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab, fetchSessions]);

  // Expand/collapse note
  const toggleNote = (noteId: string) => {
    if (expandedNoteId === noteId) {
      setExpandedNoteId(null);
      setNoteDetail(null);
    } else {
      setExpandedNoteId(noteId);
      fetchNoteDetail(noteId);
    }
  };

  // Expand/collapse session
  const toggleSession = (sessionId: string) => {
    setExpandedSessionId(expandedSessionId === sessionId ? null : sessionId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinical Notes & Transcripts</h1>
          <p className="text-gray-500 mt-1">AI Scribe generated notes, SOAP documentation, and consultation transcripts</p>
        </div>
        <button
          onClick={() => { fetchNotes(); fetchSessions(); }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DocumentTextIcon className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalNotes}</p>
              <p className="text-sm text-gray-500">Clinical Notes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <MicrophoneIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
              <p className="text-sm text-gray-500">Scribe Sessions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {notes.filter(n => n.status === 'SIGNED').length}
              </p>
              <p className="text-sm text-gray-500">Signed Notes</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <PencilSquareIcon className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {notes.filter(n => n.status === 'DRAFT').length}
              </p>
              <p className="text-sm text-gray-500">Drafts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'notes'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <DocumentTextIcon className="h-5 w-5" />
              Clinical Notes
              {totalNotes > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{totalNotes}</span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
              activeTab === 'sessions'
                ? 'bg-purple-50 text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <MicrophoneIcon className="h-5 w-5" />
              Scribe Sessions & Transcripts
              {totalSessions > 0 && (
                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">{totalSessions}</span>
              )}
            </div>
          </button>
        </div>

        <div className="p-6">
          {/* ========== NOTES TAB ========== */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <FunnelIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-500">Filter:</span>
                </div>
                <select
                  value={noteTypeFilter}
                  onChange={(e) => { setNoteTypeFilter(e.target.value); setNotesPage(1); }}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="CONSULTATION">Consultation</option>
                  <option value="FOLLOW_UP">Follow-up</option>
                  <option value="PROCEDURE">Procedure</option>
                  <option value="DISCHARGE">Discharge</option>
                  <option value="SOAP">SOAP Note</option>
                  <option value="PROGRESS">Progress Note</option>
                </select>
                <select
                  value={noteStatusFilter}
                  onChange={(e) => { setNoteStatusFilter(e.target.value); setNotesPage(1); }}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SIGNED">Signed</option>
                </select>
              </div>

              {/* Loading */}
              {notesLoading && (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="h-6 w-6 text-blue-500 animate-spin" />
                  <span className="ml-2 text-gray-500">Loading notes...</span>
                </div>
              )}

              {/* Empty State */}
              {!notesLoading && notes.length === 0 && (
                <div className="text-center py-16">
                  <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No clinical notes found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Notes will appear here once a consultation with AI Scribe is completed
                  </p>
                </div>
              )}

              {/* Notes List */}
              {!notesLoading && notes.length > 0 && (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="border border-gray-200 rounded-xl overflow-hidden hover:border-blue-200 transition-colors">
                      {/* Row */}
                      <button
                        onClick={() => toggleNote(note.id)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`p-2 rounded-lg ${note.aiGenerated ? 'bg-purple-100' : 'bg-blue-100'}`}>
                            {note.aiGenerated ? (
                              <SparklesIcon className="h-5 w-5 text-purple-600" />
                            ) : (
                              <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900">{noteTypeLabel(note.noteType)}</span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${statusBadge(note.status)}`}>
                                {note.status}
                              </span>
                              {note.aiGenerated && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">AI Generated</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                              {note.patient && (
                                <span>{note.patient.firstName} {note.patient.lastName} ({note.patient.mrn})</span>
                              )}
                              <span>{formatDate(note.createdAt)}</span>
                              {note.author && (
                                <span>by Dr. {note.author.firstName} {note.author.lastName}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {expandedNoteId === note.id ? (
                          <ChevronUpIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        )}
                      </button>

                      {/* Expanded Detail */}
                      {expandedNoteId === note.id && (
                        <div className="border-t border-gray-200 px-5 py-4 bg-gray-50">
                          {noteDetailLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />
                              <span className="ml-2 text-sm text-gray-500">Loading details...</span>
                            </div>
                          ) : noteDetail ? (
                            <div className="space-y-4">
                              {/* SOAP Sections */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {noteDetail.subjective && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs font-semibold text-purple-700 uppercase mb-1">Subjective</p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{noteDetail.subjective}</p>
                                  </div>
                                )}
                                {noteDetail.objective && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Objective</p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{noteDetail.objective}</p>
                                  </div>
                                )}
                                {noteDetail.assessment && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs font-semibold text-green-700 uppercase mb-1">Assessment</p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{noteDetail.assessment}</p>
                                  </div>
                                )}
                                {noteDetail.plan && (
                                  <div className="bg-white rounded-lg p-3 border border-gray-200">
                                    <p className="text-xs font-semibold text-orange-700 uppercase mb-1">Plan</p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{noteDetail.plan}</p>
                                  </div>
                                )}
                              </div>

                              {/* Full Text / Transcript */}
                              {noteDetail.fullText && (
                                <div className="bg-white rounded-lg p-3 border border-gray-200">
                                  <p className="text-xs font-semibold text-gray-700 uppercase mb-1">Full Transcript</p>
                                  <p className="text-sm text-gray-600 whitespace-pre-wrap max-h-48 overflow-y-auto">{noteDetail.fullText}</p>
                                </div>
                              )}

                              {/* Diagnoses */}
                              {noteDetail.diagnoses && noteDetail.diagnoses.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Diagnoses</p>
                                  <div className="flex flex-wrap gap-2">
                                    {noteDetail.diagnoses.map((d, i) => (
                                      <span key={i} className={`text-xs px-2 py-1 rounded-full ${d.isPrimary ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-700'}`}>
                                        {d.icdCode && <span className="font-mono mr-1">{d.icdCode}</span>}
                                        {d.diagnosis}
                                        {d.confidence != null && <span className="ml-1 text-gray-400">({Math.round(d.confidence * 100)}%)</span>}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* ICD/CPT Codes */}
                              {noteDetail.suggestedIcdCodes && noteDetail.suggestedIcdCodes.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Suggested ICD-10 Codes</p>
                                  <div className="flex flex-wrap gap-2">
                                    {noteDetail.suggestedIcdCodes.map((c, i) => (
                                      <span key={i} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
                                        <span className="font-mono">{c.code}</span> {c.description}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Prescriptions */}
                              {noteDetail.prescriptions && noteDetail.prescriptions.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Prescription Suggestions</p>
                                  <div className="flex flex-wrap gap-2">
                                    {noteDetail.prescriptions.map((rx, i) => (
                                      <span key={i} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                                        {rx.medication} {rx.dosage} {rx.frequency} {rx.duration}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Key Findings */}
                              {noteDetail.keyFindings && noteDetail.keyFindings.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Key Findings</p>
                                  <ul className="list-disc list-inside text-sm text-gray-600">
                                    {noteDetail.keyFindings.map((f, i) => <li key={i}>{f}</li>)}
                                  </ul>
                                </div>
                              )}

                              {/* Metadata */}
                              <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-200">
                                {noteDetail.modelVersion && <span>Model: {noteDetail.modelVersion}</span>}
                                {noteDetail.signedBy && (
                                  <span>Signed by Dr. {noteDetail.signedBy.firstName} {noteDetail.signedBy.lastName} on {formatDate(noteDetail.signedAt!)}</span>
                                )}
                              </div>

                              {/* Actions */}
                              {noteDetail.status === 'DRAFT' && (
                                <div className="flex gap-2 pt-2">
                                  <button
                                    onClick={() => handleSignNote(noteDetail.id)}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                                  >
                                    <CheckCircleIcon className="h-4 w-4" />
                                    Sign Note
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500">Failed to load note details</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {notesPagination && notesPagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm text-gray-500">
                    Page {notesPagination.page} of {notesPagination.totalPages} ({notesPagination.total} total)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNotesPage(p => Math.max(1, p - 1))}
                      disabled={notesPage === 1}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setNotesPage(p => Math.min(notesPagination.totalPages, p + 1))}
                      disabled={notesPage >= notesPagination.totalPages}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========== SESSIONS TAB ========== */}
          {activeTab === 'sessions' && (
            <div className="space-y-4">
              {/* Loading */}
              {sessionsLoading && (
                <div className="flex items-center justify-center py-12">
                  <ArrowPathIcon className="h-6 w-6 text-purple-500 animate-spin" />
                  <span className="ml-2 text-gray-500">Loading sessions...</span>
                </div>
              )}

              {/* Empty State */}
              {!sessionsLoading && sessions.length === 0 && (
                <div className="text-center py-16">
                  <MicrophoneIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No scribe sessions found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Sessions will appear here once a doctor uses AI Scribe during a consultation
                  </p>
                </div>
              )}

              {/* Sessions List */}
              {!sessionsLoading && sessions.length > 0 && (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div key={session.id} className="border border-gray-200 rounded-xl overflow-hidden hover:border-purple-200 transition-colors">
                      {/* Row */}
                      <button
                        onClick={() => toggleSession(session.id)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <MicrophoneIcon className="h-5 w-5 text-purple-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 capitalize">{session.sessionType?.replace('_', ' ') || 'Consultation'} Session</span>
                              <span className={`px-2 py-0.5 text-xs rounded-full ${statusBadge(session.status)}`}>
                                {session.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                              {session.patient && (
                                <span>{session.patient.firstName} {session.patient.lastName} ({session.patient.mrn})</span>
                              )}
                              <span>{formatDate(session.startedAt)}</span>
                              {session.notes && session.notes.length > 0 && (
                                <span className="text-purple-600">{session.notes.length} note(s) generated</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {expandedSessionId === session.id ? (
                          <ChevronUpIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        )}
                      </button>

                      {/* Expanded Transcript */}
                      {expandedSessionId === session.id && (
                        <div className="border-t border-gray-200 px-5 py-4 bg-gray-50 space-y-3">
                          {/* Patient Context */}
                          {session.patientContext && (
                            <div className="flex flex-wrap gap-2">
                              {session.patientContext.patientName && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                  Patient: {session.patientContext.patientName}
                                </span>
                              )}
                              {session.patientContext.patientAge && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                  Age: {session.patientContext.patientAge}
                                </span>
                              )}
                              {session.patientContext.patientGender && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                  {session.patientContext.patientGender}
                                </span>
                              )}
                              {session.patientContext.existingConditions?.length > 0 && (
                                <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full">
                                  Conditions: {session.patientContext.existingConditions.join(', ')}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Transcript */}
                          {session.transcriptText ? (
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <p className="text-xs font-semibold text-purple-700 uppercase mb-2">Conversation Transcript</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed">
                                {session.transcriptText}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
                              <p className="text-sm text-gray-400">No transcript available for this session</p>
                            </div>
                          )}

                          {/* Linked Notes */}
                          {session.notes && session.notes.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-700 uppercase mb-2">Generated Notes</p>
                              <div className="flex flex-wrap gap-2">
                                {session.notes.map((n) => (
                                  <button
                                    key={n.id}
                                    onClick={() => { setActiveTab('notes'); setExpandedNoteId(n.id); fetchNoteDetail(n.id); }}
                                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors"
                                  >
                                    {noteTypeLabel(n.noteType)} - {n.status} ({formatDate(n.createdAt)})
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="flex gap-4 text-xs text-gray-400 pt-2 border-t border-gray-200">
                            <span>Started: {formatDate(session.startedAt)}</span>
                            {session.completedAt && <span>Completed: {formatDate(session.completedAt)}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {sessionsPagination && sessionsPagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm text-gray-500">
                    Page {sessionsPagination.page} of {sessionsPagination.totalPages} ({sessionsPagination.total} total)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSessionsPage(p => Math.max(1, p - 1))}
                      disabled={sessionsPage === 1}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setSessionsPage(p => Math.min(sessionsPagination.totalPages, p + 1))}
                      disabled={sessionsPage >= sessionsPagination.totalPages}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
