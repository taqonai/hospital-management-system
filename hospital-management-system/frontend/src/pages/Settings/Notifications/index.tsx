import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  DocumentTextIcon,
  ChartBarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import api from '../../../services/api';

interface NotificationSettings {
  id: string;
  hospitalId: string;
  // Twilio SMS
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioPhoneNumber: string | null;
  twilioEnabled: boolean;
  // Twilio WhatsApp
  twilioWhatsappNumber: string | null;
  twilioWhatsappEnabled: boolean;
  // Email SMTP
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  emailEnabled: boolean;
  // Pager
  pagerProvider: string | null;
  pagerApiKey: string | null;
  pagerApiEndpoint: string | null;
  pagerEnabled: boolean;
  // General
  defaultChannels: string[];
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

const defaultSettings: NotificationSettings = {
  id: '',
  hospitalId: '',
  twilioAccountSid: null,
  twilioAuthToken: null,
  twilioPhoneNumber: null,
  twilioEnabled: false,
  twilioWhatsappNumber: null,
  twilioWhatsappEnabled: false,
  smtpHost: null,
  smtpPort: null,
  smtpSecure: true,
  smtpUser: null,
  smtpPassword: null,
  smtpFrom: null,
  emailEnabled: false,
  pagerProvider: null,
  pagerApiKey: null,
  pagerApiEndpoint: null,
  pagerEnabled: false,
  defaultChannels: ['in_app'],
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
};

export default function NotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTwilio, setTestingTwilio] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/admin/notifications/settings');
      setSettings(response.data.data || defaultSettings);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await api.put('/admin/notifications/settings', settings);
      setSettings(response.data.data);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyTwilio = async () => {
    setTestingTwilio(true);
    setMessage(null);
    try {
      await api.post('/admin/notifications/settings/verify-twilio', {
        accountSid: settings.twilioAccountSid,
        authToken: settings.twilioAuthToken,
      });
      setMessage({ type: 'success', text: 'Twilio credentials verified successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to verify Twilio credentials' });
    } finally {
      setTestingTwilio(false);
    }
  };

  const handleTestSMS = async () => {
    if (!testPhoneNumber) {
      setMessage({ type: 'error', text: 'Please enter a phone number' });
      return;
    }
    setTestingTwilio(true);
    setMessage(null);
    try {
      await api.post('/admin/notifications/settings/test-sms', { phoneNumber: testPhoneNumber });
      setMessage({ type: 'success', text: 'Test SMS sent successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to send test SMS' });
    } finally {
      setTestingTwilio(false);
    }
  };

  const updateField = (field: keyof NotificationSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure SMS, Email, and WhatsApp notifications</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/settings/notifications/team-contacts"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            <UserGroupIcon className="h-4 w-4" />
            Team Contacts
          </Link>
          <Link
            to="/settings/notifications/delivery-logs"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            <ChartBarIcon className="h-4 w-4" />
            Delivery Logs
          </Link>
        </div>
      </div>

      {/* Alert Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 text-green-600" />
          ) : (
            <XCircleIcon className="h-5 w-5 text-red-600" />
          )}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      <div className="space-y-6">
        {/* Twilio SMS Configuration */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <DevicePhoneMobileIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Twilio SMS</h2>
                <p className="text-sm text-gray-500">Send SMS notifications via Twilio</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.twilioEnabled}
                onChange={(e) => updateField('twilioEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account SID</label>
                <input
                  type="text"
                  value={settings.twilioAccountSid || ''}
                  onChange={(e) => updateField('twilioAccountSid', e.target.value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Auth Token</label>
                <input
                  type="password"
                  value={settings.twilioAuthToken || ''}
                  onChange={(e) => updateField('twilioAuthToken', e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={settings.twilioPhoneNumber || ''}
                onChange={(e) => updateField('twilioPhoneNumber', e.target.value)}
                placeholder="+1234567890"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Your Twilio phone number in E.164 format</p>
            </div>
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={handleVerifyTwilio}
                disabled={testingTwilio || !settings.twilioAccountSid}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
              >
                {testingTwilio ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <CheckCircleIcon className="h-4 w-4" />}
                Verify Credentials
              </button>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="Enter phone to test..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleTestSMS}
                  disabled={testingTwilio || !testPhoneNumber}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  Send Test
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp Configuration */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">WhatsApp (via Twilio)</h2>
                <p className="text-sm text-gray-500">Send WhatsApp messages using Twilio</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.twilioWhatsappEnabled}
                onChange={(e) => updateField('twilioWhatsappEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>
          <div className="px-6 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
              <input
                type="text"
                value={settings.twilioWhatsappNumber || ''}
                onChange={(e) => updateField('twilioWhatsappNumber', e.target.value)}
                placeholder="+1234567890"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Your Twilio WhatsApp-enabled number</p>
            </div>
          </div>
        </div>

        {/* Email SMTP Configuration */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <EnvelopeIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Email (SMTP)</h2>
                <p className="text-sm text-gray-500">Send email notifications via SMTP</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.emailEnabled}
                onChange={(e) => updateField('emailEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={settings.smtpHost || ''}
                  onChange={(e) => updateField('smtpHost', e.target.value)}
                  placeholder="smtp.example.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                <input
                  type="number"
                  value={settings.smtpPort || ''}
                  onChange={(e) => updateField('smtpPort', parseInt(e.target.value) || null)}
                  placeholder="587"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={settings.smtpUser || ''}
                  onChange={(e) => updateField('smtpUser', e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  value={settings.smtpPassword || ''}
                  onChange={(e) => updateField('smtpPassword', e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Address</label>
              <input
                type="email"
                value={settings.smtpFrom || ''}
                onChange={(e) => updateField('smtpFrom', e.target.value)}
                placeholder="noreply@hospital.com"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.smtpSecure}
                onChange={(e) => updateField('smtpSecure', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Use TLS/SSL</span>
            </label>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Quiet Hours</h2>
                <p className="text-sm text-gray-500">Suppress non-urgent notifications during specific hours</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.quietHoursEnabled}
                onChange={(e) => updateField('quietHoursEnabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>
          {settings.quietHoursEnabled && (
            <div className="px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={settings.quietHoursStart || '22:00'}
                    onChange={(e) => updateField('quietHoursStart', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={settings.quietHoursEnd || '07:00'}
                    onChange={(e) => updateField('quietHoursEnd', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Urgent and emergency notifications will still be sent during quiet hours.</p>
            </div>
          )}
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={() => fetchSettings()}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {saving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
