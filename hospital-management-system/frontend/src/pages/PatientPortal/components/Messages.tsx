import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  EnvelopeIcon,
  EnvelopeOpenIcon,
  PlusIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  UserCircleIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../../services/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  senderAvatar?: string;
  subject: string;
  body: string;
  preview: string;
  createdAt: string;
  isRead: boolean;
  threadId: string;
  replyTo?: string;
}

interface MessageThread {
  id: string;
  subject: string;
  participants: Array<{
    id: string;
    name: string;
    role: string;
    avatar?: string;
  }>;
  messages: Message[];
  lastMessageAt: string;
  isRead: boolean;
  unreadCount: number;
}

interface Provider {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar?: string;
}

// Get initials from name
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Get color based on role
const getRoleColor = (role: string) => {
  const colors: Record<string, string> = {
    DOCTOR: 'from-blue-500 to-indigo-600',
    NURSE: 'from-green-500 to-emerald-600',
    ADMIN: 'from-purple-500 to-violet-600',
    RECEPTIONIST: 'from-orange-500 to-amber-600',
    default: 'from-gray-500 to-slate-600',
  };
  return colors[role] || colors.default;
};

// Format relative time
const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Compose Modal Component
function ComposeModal({
  onClose,
  onSuccess,
  replyTo,
}: {
  onClose: () => void;
  onSuccess: () => void;
  replyTo?: { threadId: string; subject: string; recipientId: string; recipientName: string };
}) {
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    replyTo ? { id: replyTo.recipientId, name: replyTo.recipientName, role: '', department: '' } : null
  );
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [messageBody, setMessageBody] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);

  // Fetch providers for selection
  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ['patient-portal-providers', searchQuery],
    queryFn: async () => {
      const response = await patientPortalApi.getProviders({ search: searchQuery });
      return response.data?.data || response.data || [];
    },
    enabled: !replyTo,
  });

  const handleSend = async () => {
    if (!selectedProvider) {
      toast.error('Please select a recipient');
      return;
    }
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!messageBody.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      await patientPortalApi.sendMessage({
        recipientId: selectedProvider.id,
        subject: subject.trim(),
        body: messageBody.trim(),
        threadId: replyTo?.threadId,
      });
      toast.success('Message sent successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to send message:', error);
      toast.error(error.response?.data?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ChatBubbleLeftRightIcon className="h-6 w-6 text-white" />
                <h2 className="text-xl font-bold text-white">
                  {replyTo ? 'Reply to Message' : 'New Message'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <XMarkIcon className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Recipient Selection */}
            {!replyTo ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To <span className="text-red-500">*</span>
                </label>
                {selectedProvider ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div
                        className={clsx(
                          'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br',
                          getRoleColor(selectedProvider.role)
                        )}
                      >
                        {getInitials(selectedProvider.name)}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{selectedProvider.name}</span>
                        <p className="text-sm text-gray-500">
                          {selectedProvider.role} - {selectedProvider.department}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProvider(null)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search for a provider..."
                        className="w-full rounded-xl border border-gray-300 bg-white pl-11 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                      />
                    </div>
                    {loadingProviders && (
                      <div className="absolute right-4 top-3">
                        <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-400" />
                      </div>
                    )}
                    {providers.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {providers.map((provider: Provider) => (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => {
                              setSelectedProvider(provider);
                              setSearchQuery('');
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl flex items-center gap-3"
                          >
                            <div
                              className={clsx(
                                'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br',
                                getRoleColor(provider.role)
                              )}
                            >
                              {getInitials(provider.name)}
                            </div>
                            <div>
                              <span className="font-medium text-gray-900">{provider.name}</span>
                              <p className="text-sm text-gray-500">
                                {provider.role} - {provider.department}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div
                  className={clsx(
                    'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br from-blue-500 to-indigo-600'
                  )}
                >
                  {getInitials(replyTo.recipientName)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Replying to</p>
                  <span className="font-medium text-gray-900">{replyTo.recipientName}</span>
                </div>
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject..."
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
                disabled={!!replyTo}
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Type your message here..."
                rows={6}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
              />
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
                onClick={handleSend}
                disabled={sending || !selectedProvider || !subject.trim() || !messageBody.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending ? (
                  <>
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <PaperAirplaneIcon className="h-5 w-5" />
                    Send Message
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Thread View Component
function ThreadView({
  thread,
  onBack,
  onReply,
}: {
  thread: MessageThread;
  onBack: () => void;
  onReply: () => void;
}) {
  const queryClient = useQueryClient();

  // Mark thread as read when viewing
  const markAsReadMutation = useMutation({
    mutationFn: (threadId: string) => patientPortalApi.markMessageRead(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
    },
  });

  useEffect(() => {
    if (!thread.isRead) {
      markAsReadMutation.mutate(thread.id);
    }
  }, [thread.id, thread.isRead]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-gray-200/50">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 truncate">{thread.subject}</h2>
          <p className="text-sm text-gray-500">
            {thread.participants.map((p) => p.name).join(', ')}
          </p>
        </div>
        <button
          onClick={onReply}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center gap-2"
        >
          <PaperAirplaneIcon className="h-4 w-4" />
          Reply
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {thread.messages.map((message, index) => (
          <div
            key={message.id}
            className="relative overflow-hidden backdrop-blur-sm bg-white/70 rounded-xl p-4 border border-gray-200/50"
            style={{
              animation: 'fadeIn 0.3s ease-out',
              animationDelay: `${index * 0.05}s`,
              animationFillMode: 'both',
            }}
          >
            {/* Shine line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

            <div className="flex items-start gap-3">
              <div
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br flex-shrink-0',
                  getRoleColor(message.senderRole)
                )}
              >
                {getInitials(message.senderName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{message.senderName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {message.senderRole}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <ClockIcon className="h-3.5 w-3.5" />
                    {formatRelativeTime(message.createdAt)}
                  </span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{message.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Messages Component
export default function Messages() {
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [replyInfo, setReplyInfo] = useState<{
    threadId: string;
    subject: string;
    recipientId: string;
    recipientName: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const queryClient = useQueryClient();

  // Fetch message threads
  const { data: threads = [], isLoading, error } = useQuery({
    queryKey: ['patient-messages', filter],
    queryFn: async () => {
      const response = await patientPortalApi.getMessages({ filter });
      return response.data?.data || response.data || [];
    },
  });

  // Mark as read/unread mutation
  const toggleReadMutation = useMutation({
    mutationFn: ({ threadId, isRead }: { threadId: string; isRead: boolean }) =>
      isRead
        ? patientPortalApi.markMessageUnread(threadId)
        : patientPortalApi.markMessageRead(threadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
    },
  });

  // Filter threads by search query
  const filteredThreads = threads.filter((thread: MessageThread) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      thread.subject.toLowerCase().includes(query) ||
      thread.participants.some((p) => p.name.toLowerCase().includes(query))
    );
  });

  // Calculate unread count
  const unreadCount = threads.filter((t: MessageThread) => !t.isRead).length;

  const handleReply = () => {
    if (selectedThread) {
      const otherParticipant = selectedThread.participants[0];
      setReplyInfo({
        threadId: selectedThread.id,
        subject: selectedThread.subject,
        recipientId: otherParticipant.id,
        recipientName: otherParticipant.name,
      });
      setShowCompose(true);
    }
  };

  const handleComposeSuccess = () => {
    setShowCompose(false);
    setReplyInfo(null);
    queryClient.invalidateQueries({ queryKey: ['patient-messages'] });
  };

  // Thread view
  if (selectedThread) {
    return (
      <div className="h-full">
        <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200/50 shadow-xl h-full">
          {/* Shine line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <ThreadView
            thread={selectedThread}
            onBack={() => setSelectedThread(null)}
            onReply={handleReply}
          />
        </div>

        {/* Reply Modal */}
        {showCompose && replyInfo && (
          <ComposeModal
            onClose={() => {
              setShowCompose(false);
              setReplyInfo(null);
            }}
            onSuccess={handleComposeSuccess}
            replyTo={replyInfo}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 p-8">
        {/* Floating orbs */}
        <div className="absolute top-4 right-12 w-24 h-24 bg-white/20 rounded-full blur-2xl animate-pulse" />
        <div
          className="absolute bottom-2 right-32 w-32 h-32 bg-purple-300/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute top-1/2 left-1/4 w-16 h-16 bg-blue-300/30 rounded-full blur-xl animate-pulse"
          style={{ animationDelay: '0.5s' }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white/90 text-sm font-medium mb-3">
              <ChatBubbleLeftRightIcon className="h-4 w-4" />
              Patient Portal
            </div>
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">Messages</h1>
            <p className="mt-2 text-white/80">
              Communicate securely with your healthcare providers
            </p>
          </div>
          <button
            onClick={() => setShowCompose(true)}
            className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-white/90 text-blue-600 font-semibold rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-lg"
          >
            <PlusIcon className="h-5 w-5" />
            New Message
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="relative overflow-hidden backdrop-blur-xl bg-blue-50/70 rounded-xl p-4 border border-blue-200/50">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <EnvelopeIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-700">Total Messages</p>
              <p className="text-2xl font-bold text-blue-800">{threads.length}</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden backdrop-blur-xl bg-amber-50/70 rounded-xl p-4 border border-amber-200/50">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
              <EnvelopeOpenIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-700">Unread</p>
              <p className="text-2xl font-bold text-amber-800">{unreadCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages..."
            className="w-full rounded-xl border border-gray-200/50 bg-white/70 backdrop-blur-sm pl-11 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'px-4 py-2 rounded-xl font-medium transition-all',
              filter === 'all'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                : 'bg-white/70 text-gray-600 hover:bg-gray-100 border border-gray-200/50'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={clsx(
              'px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2',
              filter === 'unread'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                : 'bg-white/70 text-gray-600 hover:bg-gray-100 border border-gray-200/50'
            )}
          >
            Unread
            {unreadCount > 0 && (
              <span
                className={clsx(
                  'px-2 py-0.5 rounded-full text-xs font-semibold',
                  filter === 'unread' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                )}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="relative overflow-hidden backdrop-blur-xl bg-white rounded-2xl border border-gray-200/50 shadow-xl">
        {/* Shine line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        {isLoading ? (
          <div className="p-8 text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin mx-auto text-blue-500" />
            <p className="mt-2 text-gray-500">Loading messages...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <ExclamationCircleIcon className="h-12 w-12 mx-auto text-red-400 mb-4" />
            <p className="text-red-600">Failed to load messages</p>
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="p-8 text-center">
            <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              {searchQuery
                ? 'No messages match your search'
                : filter === 'unread'
                ? 'No unread messages'
                : 'No messages yet'}
            </p>
            {!searchQuery && filter === 'all' && (
              <button
                onClick={() => setShowCompose(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-medium hover:from-blue-600 hover:to-indigo-600 transition-all"
              >
                Send your first message
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200/50">
            {filteredThreads.map((thread: MessageThread, index: number) => (
              <div
                key={thread.id}
                onClick={() => setSelectedThread(thread)}
                className={clsx(
                  'p-4 cursor-pointer transition-all duration-200 hover:bg-gray-50/50',
                  !thread.isRead && 'bg-blue-50/30'
                )}
                style={{
                  animation: 'fadeIn 0.5s ease-out',
                  animationDelay: `${index * 0.05}s`,
                  animationFillMode: 'both',
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className={clsx(
                        'w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-gradient-to-br',
                        getRoleColor(thread.participants[0]?.role || 'default')
                      )}
                    >
                      {getInitials(thread.participants[0]?.name || 'Unknown')}
                    </div>
                    {!thread.isRead && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3
                            className={clsx(
                              'font-semibold truncate',
                              !thread.isRead ? 'text-gray-900' : 'text-gray-700'
                            )}
                          >
                            {thread.participants[0]?.name || 'Unknown'}
                          </h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                            {thread.participants[0]?.role}
                          </span>
                        </div>
                        <p
                          className={clsx(
                            'text-sm truncate mt-0.5',
                            !thread.isRead ? 'text-gray-900 font-medium' : 'text-gray-600'
                          )}
                        >
                          {thread.subject}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0 flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {formatRelativeTime(thread.lastMessageAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {thread.messages[thread.messages.length - 1]?.preview || ''}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReadMutation.mutate({
                          threadId: thread.id,
                          isRead: thread.isRead,
                        });
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 transition-colors group"
                      title={thread.isRead ? 'Mark as unread' : 'Mark as read'}
                    >
                      {thread.isRead ? (
                        <EnvelopeOpenIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-600" />
                      ) : (
                        <EnvelopeIcon className="h-5 w-5 text-blue-500 group-hover:text-blue-600" />
                      )}
                    </button>
                    {thread.unreadCount > 1 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose Modal */}
      {showCompose && !replyInfo && (
        <ComposeModal onClose={() => setShowCompose(false)} onSuccess={handleComposeSuccess} />
      )}

      {/* Fade animation */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
