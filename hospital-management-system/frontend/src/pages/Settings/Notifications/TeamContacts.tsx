import { useState, useEffect, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import {
  UserGroupIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  DevicePhoneMobileIcon,
  ArrowLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import api from '../../../services/api';

interface TeamContact {
  id: string;
  name: string;
  role: string;
  department: string | null;
  email: string | null;
  phone: string | null;
  pagerNumber: string | null;
  whatsappNumber: string | null;
  enabledChannels: string[];
  enabledAlertTypes: string[];
  isEmergencyContact: boolean;
  isActive: boolean;
  onCallSchedule: any;
  createdAt: string;
  updatedAt: string;
}

const emptyContact: Partial<TeamContact> = {
  name: '',
  role: '',
  department: '',
  email: '',
  phone: '',
  pagerNumber: '',
  whatsappNumber: '',
  enabledChannels: ['sms', 'email'],
  enabledAlertTypes: [],
  isEmergencyContact: false,
  isActive: true,
};

const channelOptions = [
  { id: 'sms', label: 'SMS', icon: DevicePhoneMobileIcon },
  { id: 'email', label: 'Email', icon: EnvelopeIcon },
  { id: 'whatsapp', label: 'WhatsApp', icon: ChatBubbleLeftRightIcon },
  { id: 'pager', label: 'Pager', icon: PhoneIcon },
];

export default function TeamContacts() {
  const [contacts, setContacts] = useState<TeamContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<TeamContact> | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterEmergency, setFilterEmergency] = useState(false);

  const fetchContacts = async () => {
    try {
      const params: any = {};
      if (filterEmergency) params.isEmergencyContact = true;
      const response = await api.get('/admin/notifications/team-contacts', { params });
      setContacts(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [filterEmergency]);

  const handleSave = async () => {
    if (!editingContact?.name || !editingContact?.role) {
      setMessage({ type: 'error', text: 'Name and role are required' });
      return;
    }
    if (!editingContact.email && !editingContact.phone && !editingContact.pagerNumber && !editingContact.whatsappNumber) {
      setMessage({ type: 'error', text: 'At least one contact method is required' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      if (editingContact.id) {
        // Update
        await api.put(`/admin/notifications/team-contacts/${editingContact.id}`, editingContact);
        setMessage({ type: 'success', text: 'Contact updated successfully!' });
      } else {
        // Create
        await api.post('/admin/notifications/team-contacts', editingContact);
        setMessage({ type: 'success', text: 'Contact created successfully!' });
      }
      fetchContacts();
      setModalOpen(false);
      setEditingContact(null);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save contact' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      await api.delete(`/admin/notifications/team-contacts/${id}`);
      fetchContacts();
      setMessage({ type: 'success', text: 'Contact deleted successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete contact' });
    }
  };

  const handleTestNotification = async (contact: TeamContact) => {
    setTesting(contact.id);
    setMessage(null);
    try {
      await api.post(`/admin/notifications/team-contacts/${contact.id}/test`);
      setMessage({ type: 'success', text: `Test notification sent to ${contact.name}` });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to send test notification' });
    } finally {
      setTesting(null);
    }
  };

  const openCreateModal = () => {
    setEditingContact({ ...emptyContact });
    setModalOpen(true);
  };

  const openEditModal = (contact: TeamContact) => {
    setEditingContact({ ...contact });
    setModalOpen(true);
  };

  const updateField = (field: keyof TeamContact, value: any) => {
    setEditingContact((prev) => prev ? { ...prev, [field]: value } : null);
  };

  const toggleChannel = (channel: string) => {
    const current = editingContact?.enabledChannels || [];
    const updated = current.includes(channel)
      ? current.filter((c) => c !== channel)
      : [...current, channel];
    updateField('enabledChannels', updated);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/settings/notifications"
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Contacts</h1>
            <p className="text-gray-500 text-sm mt-1">Manage notification recipients for alerts and broadcasts</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
        >
          <PlusIcon className="h-4 w-4" />
          Add Contact
        </button>
      </div>

      {/* Alert Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
          ) : (
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filterEmergency}
            onChange={(e) => setFilterEmergency(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Show only emergency contacts</span>
        </label>
      </div>

      {/* Contacts List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <UserGroupIcon className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-lg font-medium">No team contacts</p>
            <p className="text-sm text-gray-400 mt-1">Add contacts to receive notifications</p>
            <button
              onClick={openCreateModal}
              className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add First Contact
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {contacts.map((contact) => (
              <div key={contact.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      contact.isEmergencyContact ? 'bg-red-100' : 'bg-blue-100'
                    }`}>
                      <UserGroupIcon className={`h-6 w-6 ${
                        contact.isEmergencyContact ? 'text-red-600' : 'text-blue-600'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{contact.name}</h3>
                        {contact.isEmergencyContact && (
                          <span className="px-2 py-0.5 text-[10px] font-medium text-red-600 bg-red-100 rounded-full">
                            Emergency
                          </span>
                        )}
                        {!contact.isActive && (
                          <span className="px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{contact.role}{contact.department ? ` • ${contact.department}` : ''}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {contact.email && (
                          <span className="flex items-center gap-1">
                            <EnvelopeIcon className="h-3.5 w-3.5" />
                            {contact.email}
                          </span>
                        )}
                        {contact.phone && (
                          <span className="flex items-center gap-1">
                            <PhoneIcon className="h-3.5 w-3.5" />
                            {contact.phone}
                          </span>
                        )}
                        {contact.whatsappNumber && (
                          <span className="flex items-center gap-1">
                            <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" />
                            {contact.whatsappNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {(contact.enabledChannels || []).map((channel) => (
                          <span key={channel} className="px-2 py-0.5 text-[10px] font-medium text-gray-600 bg-gray-100 rounded-full capitalize">
                            {channel}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestNotification(contact)}
                      disabled={testing === contact.id}
                      className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      title="Send test notification"
                    >
                      <PaperAirplaneIcon className={`h-4 w-4 ${testing === contact.id ? 'animate-pulse' : ''}`} />
                    </button>
                    <button
                      onClick={() => openEditModal(contact)}
                      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(contact.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Transition appear show={modalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25" />
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
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      {editingContact?.id ? 'Edit Contact' : 'Add New Contact'}
                    </Dialog.Title>
                    <button
                      onClick={() => setModalOpen(false)}
                      className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input
                          type="text"
                          value={editingContact?.name || ''}
                          onChange={(e) => updateField('name', e.target.value)}
                          placeholder="John Doe"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                        <input
                          type="text"
                          value={editingContact?.role || ''}
                          onChange={(e) => updateField('role', e.target.value)}
                          placeholder="On-Call Doctor"
                          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                      <input
                        type="text"
                        value={editingContact?.department || ''}
                        onChange={(e) => updateField('department', e.target.value)}
                        placeholder="Emergency"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Contact Methods */}
                    <div className="pt-2">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Contact Methods (at least one required)</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Email</label>
                          <input
                            type="email"
                            value={editingContact?.email || ''}
                            onChange={(e) => updateField('email', e.target.value)}
                            placeholder="john@hospital.com"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Phone Number (SMS)</label>
                          <input
                            type="text"
                            value={editingContact?.phone || ''}
                            onChange={(e) => updateField('phone', e.target.value)}
                            placeholder="+1234567890"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">WhatsApp Number</label>
                          <input
                            type="text"
                            value={editingContact?.whatsappNumber || ''}
                            onChange={(e) => updateField('whatsappNumber', e.target.value)}
                            placeholder="+1234567890"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Pager Number</label>
                          <input
                            type="text"
                            value={editingContact?.pagerNumber || ''}
                            onChange={(e) => updateField('pagerNumber', e.target.value)}
                            placeholder="1234"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Enabled Channels */}
                    <div className="pt-2">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Notification Channels</h4>
                      <div className="flex flex-wrap gap-2">
                        {channelOptions.map((channel) => {
                          const Icon = channel.icon;
                          const isEnabled = (editingContact?.enabledChannels || []).includes(channel.id);
                          return (
                            <button
                              key={channel.id}
                              type="button"
                              onClick={() => toggleChannel(channel.id)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                                isEnabled
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              {channel.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Options */}
                    <div className="pt-2 space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingContact?.isEmergencyContact || false}
                          onChange={(e) => updateField('isEmergencyContact', e.target.checked)}
                          className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-700">Emergency Contact</span>
                          <p className="text-xs text-gray-500">Receives urgent alerts and broadcast notifications</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingContact?.isActive !== false}
                          onChange={(e) => updateField('isActive', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-700">Active</span>
                          <p className="text-xs text-gray-500">Inactive contacts won't receive notifications</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                    <button
                      onClick={() => setModalOpen(false)}
                      className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                      {editingContact?.id ? 'Save Changes' : 'Create Contact'}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
