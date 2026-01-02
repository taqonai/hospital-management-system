import { useState } from 'react';
import {
  DocumentTextIcon,
  SparklesIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TagIcon,
  BeakerIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
  UserIcon,
  UserCircleIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';

interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

interface MedicalEntity {
  type: string;
  value: string;
  confidence: number;
  context?: string;
}

interface IcdCodeSuggestion {
  code: string;
  description: string;
  confidence: string;
  supportingText: string;
}

interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface AIScribeNotesProps {
  transcript: TranscriptSegment[];
  fullTranscript: string;
  soapNote?: SoapNote;
  entities?: Record<string, MedicalEntity[]>;
  icdCodes?: IcdCodeSuggestion[];
  keyFindings?: string[];
  onSoapNoteChange?: (soapNote: SoapNote) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export default function AIScribeNotes({
  transcript,
  fullTranscript,
  soapNote,
  entities,
  icdCodes,
  keyFindings,
  onSoapNoteChange,
  onSave,
  isSaving = false,
}: AIScribeNotesProps) {
  const [activeTab, setActiveTab] = useState<'soap' | 'transcript' | 'entities' | 'icd'>('soap');
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    subjective: true,
    objective: true,
    assessment: true,
    plan: true,
  });
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyAllNotes = () => {
    if (!soapNote) return;
    const fullNote = `SUBJECTIVE:\n${soapNote.subjective}\n\nOBJECTIVE:\n${soapNote.objective}\n\nASSESSMENT:\n${soapNote.assessment}\n\nPLAN:\n${soapNote.plan}`;
    handleCopyToClipboard(fullNote, 'all');
  };

  const handleEditStart = (section: string, content: string) => {
    setEditingSection(section);
    setEditedContent(content);
  };

  const handleEditSave = () => {
    if (editingSection && soapNote && onSoapNoteChange) {
      onSoapNoteChange({
        ...soapNote,
        [editingSection]: editedContent,
      });
    }
    setEditingSection(null);
    setEditedContent('');
  };

  const handleEditCancel = () => {
    setEditingSection(null);
    setEditedContent('');
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getConfidenceColor = (confidence: number | string) => {
    if (typeof confidence === 'string') {
      switch (confidence) {
        case 'high':
          return 'bg-green-100 text-green-700 border-green-200';
        case 'medium':
          return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'low':
          return 'bg-red-100 text-red-700 border-red-200';
        default:
          return 'bg-gray-100 text-gray-700 border-gray-200';
      }
    }
    if (confidence >= 0.8) return 'bg-green-100 text-green-700 border-green-200';
    if (confidence >= 0.6) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'symptoms':
        return ExclamationTriangleIcon;
      case 'medications':
        return BeakerIcon;
      case 'diagnoses':
        return HeartIcon;
      case 'vitals':
        return ClipboardDocumentListIcon;
      default:
        return TagIcon;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderSoapSection = (
    title: string,
    key: keyof SoapNote,
    content?: string,
    icon?: React.ElementType
  ) => {
    const Icon = icon || DocumentTextIcon;
    const isExpanded = expandedSections[key];
    const isEditing = editingSection === key;

    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <button
          onClick={() => toggleSection(key)}
          className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <Icon className="h-4 w-4 text-blue-600" />
            </div>
            <span className="font-medium text-gray-900">{title}</span>
          </div>
          {isExpanded ? (
            <ChevronUpIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {isExpanded && (
          <div className="p-4 border-t border-gray-100">
            {isEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleEditCancel}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <CheckIcon className="h-4 w-4" />
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="group relative">
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {content || 'No content available'}
                </div>
                <button
                  onClick={() => handleEditStart(key, content || '')}
                  className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50"
                >
                  <PencilIcon className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header with Tabs */}
      <div className="border-b border-gray-200">
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm">
              <SparklesIcon className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Generated Documentation</h3>
              <p className="text-sm text-gray-500">AI-generated clinical notes from your conversation</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-gray-200 bg-white">
          {[
            { id: 'soap', label: 'SOAP Note', icon: DocumentTextIcon },
            { id: 'transcript', label: 'Transcript', icon: ClipboardDocumentListIcon },
            { id: 'entities', label: 'Entities', icon: TagIcon },
            { id: 'icd', label: 'ICD Codes', icon: BeakerIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Key Findings Alert */}
        {keyFindings && keyFindings.length > 0 && activeTab === 'soap' && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800 mb-2">Key Findings</h4>
                <ul className="space-y-1">
                  {keyFindings.map((finding, idx) => (
                    <li key={idx} className="text-sm text-amber-700">
                      {finding}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* SOAP Note Tab */}
        {activeTab === 'soap' && soapNote && (
          <div className="space-y-4">
            {/* Copy All Button */}
            <div className="flex justify-end mb-2">
              <button
                onClick={copyAllNotes}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {copiedText === 'all' ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-green-600" />
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <ClipboardDocumentIcon className="h-4 w-4" />
                    Copy All Notes
                  </>
                )}
              </button>
            </div>

            {renderSoapSection('Subjective', 'subjective', soapNote.subjective, UserIcon)}
            {renderSoapSection('Objective', 'objective', soapNote.objective, ClipboardDocumentListIcon)}
            {renderSoapSection('Assessment', 'assessment', soapNote.assessment, HeartIcon)}
            {renderSoapSection('Plan', 'plan', soapNote.plan, DocumentTextIcon)}

            {/* Save Button */}
            {onSave && (
              <div className="pt-4 flex justify-end">
                <button
                  onClick={onSave}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-5 w-5" />
                      Save to Patient Record
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Transcript Tab */}
        {activeTab === 'transcript' && (
          <div className="space-y-4">
            {/* Full Transcript Toggle */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Conversation Transcript</h4>
              <span className="text-sm text-gray-500">
                {transcript.length} segments
              </span>
            </div>

            {/* Transcript Segments */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {transcript.map((segment, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border ${
                    segment.speaker === 'Doctor'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {segment.speaker === 'Doctor' ? (
                        <UserCircleIcon className="h-5 w-5 text-blue-600" />
                      ) : (
                        <UserIcon className="h-5 w-5 text-green-600" />
                      )}
                      <span
                        className={`text-sm font-medium ${
                          segment.speaker === 'Doctor' ? 'text-blue-700' : 'text-green-700'
                        }`}
                      >
                        {segment.speaker}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {formatTime(segment.startTime)} - {formatTime(segment.endTime)}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${getConfidenceColor(
                          segment.confidence
                        )}`}
                      >
                        {Math.round(segment.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-800">{segment.text}</p>
                </div>
              ))}
            </div>

            {/* Full Transcript */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-700 font-medium">
                View Full Transcript
              </summary>
              <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{fullTranscript}</p>
              </div>
            </details>
          </div>
        )}

        {/* Entities Tab */}
        {activeTab === 'entities' && entities && (
          <div className="space-y-6">
            {Object.entries(entities).map(([type, items]) => {
              if (!items || items.length === 0) return null;

              const Icon = getEntityIcon(type);

              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-5 w-5 text-gray-500" />
                    <h4 className="font-medium text-gray-900 capitalize">{type}</h4>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {items.map((entity, idx) => (
                      <div
                        key={idx}
                        className={`px-3 py-1.5 rounded-lg border text-sm flex items-center gap-2 ${getConfidenceColor(
                          entity.confidence
                        )}`}
                      >
                        <span>{entity.value}</span>
                        <span className="text-xs opacity-75">
                          {Math.round(entity.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {Object.values(entities).every((items) => !items || items.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <TagIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No medical entities extracted</p>
              </div>
            )}
          </div>
        )}

        {/* ICD Codes Tab */}
        {activeTab === 'icd' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Suggested ICD-10 Codes</h4>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
                Requires verification
              </span>
            </div>

            {icdCodes && icdCodes.length > 0 ? (
              <div className="space-y-3">
                {icdCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-sm font-mono font-medium rounded">
                            {code.code}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${getConfidenceColor(
                              code.confidence
                            )}`}
                          >
                            {code.confidence}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{code.description}</p>
                        {code.supportingText && (
                          <p className="text-xs text-gray-500 mt-1 italic">
                            "{code.supportingText}"
                          </p>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        defaultChecked={code.confidence === 'high'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <BeakerIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No ICD codes suggested</p>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-4 p-3 bg-gray-50 rounded-lg">
              <strong>Disclaimer:</strong> AI-suggested codes require verification by certified
              medical coders. These suggestions are based on the conversation content and may not
              reflect complete clinical documentation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
