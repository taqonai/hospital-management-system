import { useState, useEffect } from 'react';
import {
  Cog6ToothIcon,
  BuildingOffice2Icon,
  CreditCardIcon,
  BellIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import toast from 'react-hot-toast';

// Tab definitions
const tabs = [
  { id: 'dha', name: 'DHA eClaimLink', icon: BuildingOffice2Icon },
  { id: 'payment', name: 'Payment Gateway', icon: CreditCardIcon },
  { id: 'notifications', name: 'Notifications', icon: BellIcon },
];

interface DHASettings {
  enabled: boolean;
  baseUrl: string;
  facilityId: string;
  licenseNumber: string;
  apiKey: string;
  testMode: boolean;
}

interface PaymentSettings {
  provider: 'stripe' | 'payfort' | 'network_international' | 'none';
  enabled: boolean;
  testMode: boolean;
  // Stripe
  stripePublicKey: string;
  stripeSecretKey: string;
  // PayFort
  payfortMerchantId: string;
  payfortAccessCode: string;
  payfortShaRequestPhrase: string;
  payfortShaResponsePhrase: string;
  // Network International
  niOutletId: string;
  niApiKey: string;
}

interface NotificationSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  pushEnabled: boolean;
  appointmentReminders: boolean;
  reminderHoursBefore: number;
  labResultsNotify: boolean;
  prescriptionReadyNotify: boolean;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('dha');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // DHA Settings State
  const [dhaSettings, setDhaSettings] = useState<DHASettings>({
    enabled: false,
    baseUrl: 'https://eclaimlink.dha.gov.ae/api/v1',
    facilityId: '',
    licenseNumber: '',
    apiKey: '',
    testMode: true,
  });

  // Payment Settings State
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    provider: 'none',
    enabled: false,
    testMode: true,
    stripePublicKey: '',
    stripeSecretKey: '',
    payfortMerchantId: '',
    payfortAccessCode: '',
    payfortShaRequestPhrase: '',
    payfortShaResponsePhrase: '',
    niOutletId: '',
    niApiKey: '',
  });

  // Notification Settings State
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailEnabled: true,
    smsEnabled: false,
    whatsappEnabled: false,
    pushEnabled: true,
    appointmentReminders: true,
    reminderHoursBefore: 24,
    labResultsNotify: true,
    prescriptionReadyNotify: true,
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await api.get('/settings/hospital');
      if (response.data.success) {
        const settings = response.data.data;
        if (settings.dha) setDhaSettings(settings.dha);
        if (settings.payment) setPaymentSettings(settings.payment);
        if (settings.notifications) setNotificationSettings(settings.notifications);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Use defaults if no settings found
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/settings/hospital', {
        dha: dhaSettings,
        payment: paymentSettings,
        notifications: notificationSettings,
      });
      toast.success('Settings saved successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testDHAConnection = async () => {
    setTestingConnection(true);
    try {
      const response = await api.post('/settings/test-dha', dhaSettings);
      if (response.data.success) {
        toast.success('DHA connection successful!');
      } else {
        toast.error(response.data.message || 'DHA connection failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'DHA connection test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const testPaymentGateway = async () => {
    setTestingConnection(true);
    try {
      const response = await api.post('/settings/test-payment', paymentSettings);
      if (response.data.success) {
        toast.success('Payment gateway connection successful!');
      } else {
        toast.error(response.data.message || 'Payment gateway test failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Payment gateway test failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const renderSecretInput = (
    label: string,
    field: string,
    value: string,
    onChange: (value: string) => void,
    placeholder?: string
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={showSecrets[field] ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="button"
          onClick={() => toggleSecretVisibility(field)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showSecrets[field] ? (
            <EyeSlashIcon className="h-5 w-5" />
          ) : (
            <EyeIcon className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Cog6ToothIcon className="h-8 w-8 text-gray-600" />
          Hospital Settings
        </h1>
        <p className="text-gray-500 mt-1">Configure DHA integration, payment gateway, and notifications</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <tab.icon className="h-5 w-5" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {/* DHA eClaimLink Settings */}
        {activeTab === 'dha' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">DHA eClaimLink Integration</h2>
                <p className="text-sm text-gray-500">Configure Dubai Health Authority insurance eligibility API</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dhaSettings.enabled}
                    onChange={(e) => setDhaSettings({ ...dhaSettings, enabled: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable DHA Integration</span>
                </label>
              </div>
            </div>

            {dhaSettings.enabled && (
              <>
                {/* Test Mode Warning */}
                <div className={`p-4 rounded-lg flex items-start gap-3 ${dhaSettings.testMode ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                  {dhaSettings.testMode ? (
                    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-medium ${dhaSettings.testMode ? 'text-yellow-800' : 'text-green-800'}`}>
                      {dhaSettings.testMode ? 'Test Mode Enabled' : 'Production Mode'}
                    </p>
                    <p className={`text-sm ${dhaSettings.testMode ? 'text-yellow-700' : 'text-green-700'}`}>
                      {dhaSettings.testMode
                        ? 'API calls will use DHA sandbox environment'
                        : 'API calls will hit production DHA servers'
                      }
                    </p>
                  </div>
                  <label className="ml-auto flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dhaSettings.testMode}
                      onChange={(e) => setDhaSettings({ ...dhaSettings, testMode: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                    />
                    <span className="text-sm">Test Mode</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                    <input
                      type="url"
                      value={dhaSettings.baseUrl}
                      onChange={(e) => setDhaSettings({ ...dhaSettings, baseUrl: e.target.value })}
                      placeholder="https://eclaimlink.dha.gov.ae/api/v1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">DHA Facility ID</label>
                    <input
                      type="text"
                      value={dhaSettings.facilityId}
                      onChange={(e) => setDhaSettings({ ...dhaSettings, facilityId: e.target.value })}
                      placeholder="Enter facility ID from DHA"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
                    <input
                      type="text"
                      value={dhaSettings.licenseNumber}
                      onChange={(e) => setDhaSettings({ ...dhaSettings, licenseNumber: e.target.value })}
                      placeholder="Hospital license number"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {renderSecretInput(
                    'API Key',
                    'dhaApiKey',
                    dhaSettings.apiKey,
                    (value) => setDhaSettings({ ...dhaSettings, apiKey: value }),
                    'Enter DHA API key'
                  )}
                </div>

                <div className="pt-4">
                  <button
                    onClick={testDHAConnection}
                    disabled={testingConnection || !dhaSettings.facilityId || !dhaSettings.apiKey}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {testingConnection ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <ShieldCheckIcon className="h-5 w-5" />
                    )}
                    Test Connection
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Payment Gateway Settings */}
        {activeTab === 'payment' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Payment Gateway</h2>
                <p className="text-sm text-gray-500">Configure online payment processing for billing</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentSettings.enabled}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, enabled: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable Payments</span>
                </label>
              </div>
            </div>

            {paymentSettings.enabled && (
              <>
                {/* Provider Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Provider</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { id: 'stripe', name: 'Stripe', desc: 'Global payment processing' },
                      { id: 'payfort', name: 'PayFort (Amazon)', desc: 'Middle East focused' },
                      { id: 'network_international', name: 'Network International', desc: 'UAE local gateway' },
                    ].map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() => setPaymentSettings({ ...paymentSettings, provider: provider.id as any })}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                          paymentSettings.provider === provider.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-medium text-gray-900">{provider.name}</p>
                        <p className="text-sm text-gray-500">{provider.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Test Mode Toggle */}
                <div className={`p-4 rounded-lg flex items-center justify-between ${paymentSettings.testMode ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                  <div className="flex items-center gap-3">
                    {paymentSettings.testMode ? (
                      <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <CheckCircleIcon className="h-5 w-5 text-green-500" />
                    )}
                    <div>
                      <p className={`font-medium ${paymentSettings.testMode ? 'text-yellow-800' : 'text-green-800'}`}>
                        {paymentSettings.testMode ? 'Test/Sandbox Mode' : 'Live Mode'}
                      </p>
                      <p className={`text-sm ${paymentSettings.testMode ? 'text-yellow-700' : 'text-green-700'}`}>
                        {paymentSettings.testMode ? 'No real charges will be made' : 'Real payments will be processed'}
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentSettings.testMode}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, testMode: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                    />
                    <span className="text-sm">Test Mode</span>
                  </label>
                </div>

                {/* Stripe Settings */}
                {paymentSettings.provider === 'stripe' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderSecretInput(
                      'Publishable Key',
                      'stripePublicKey',
                      paymentSettings.stripePublicKey,
                      (value) => setPaymentSettings({ ...paymentSettings, stripePublicKey: value }),
                      'pk_test_...'
                    )}
                    {renderSecretInput(
                      'Secret Key',
                      'stripeSecretKey',
                      paymentSettings.stripeSecretKey,
                      (value) => setPaymentSettings({ ...paymentSettings, stripeSecretKey: value }),
                      'sk_test_...'
                    )}
                  </div>
                )}

                {/* PayFort Settings */}
                {paymentSettings.provider === 'payfort' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Merchant Identifier</label>
                      <input
                        type="text"
                        value={paymentSettings.payfortMerchantId}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, payfortMerchantId: e.target.value })}
                        placeholder="Enter merchant ID"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {renderSecretInput(
                      'Access Code',
                      'payfortAccessCode',
                      paymentSettings.payfortAccessCode,
                      (value) => setPaymentSettings({ ...paymentSettings, payfortAccessCode: value })
                    )}
                    {renderSecretInput(
                      'SHA Request Phrase',
                      'payfortShaRequest',
                      paymentSettings.payfortShaRequestPhrase,
                      (value) => setPaymentSettings({ ...paymentSettings, payfortShaRequestPhrase: value })
                    )}
                    {renderSecretInput(
                      'SHA Response Phrase',
                      'payfortShaResponse',
                      paymentSettings.payfortShaResponsePhrase,
                      (value) => setPaymentSettings({ ...paymentSettings, payfortShaResponsePhrase: value })
                    )}
                  </div>
                )}

                {/* Network International Settings */}
                {paymentSettings.provider === 'network_international' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Outlet ID</label>
                      <input
                        type="text"
                        value={paymentSettings.niOutletId}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, niOutletId: e.target.value })}
                        placeholder="Enter outlet ID"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    {renderSecretInput(
                      'API Key',
                      'niApiKey',
                      paymentSettings.niApiKey,
                      (value) => setPaymentSettings({ ...paymentSettings, niApiKey: value })
                    )}
                  </div>
                )}

                <div className="pt-4">
                  <button
                    onClick={testPaymentGateway}
                    disabled={testingConnection || paymentSettings.provider === 'none'}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {testingConnection ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <CreditCardIcon className="h-5 w-5" />
                    )}
                    Test Gateway
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Notification Settings */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Notification Channels</h2>
              <p className="text-sm text-gray-500">Configure how patients and staff receive notifications</p>
            </div>

            {/* Channels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-500">Send notifications via email</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.emailEnabled}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, emailEnabled: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <div>
                  <p className="font-medium text-gray-900">SMS Notifications</p>
                  <p className="text-sm text-gray-500">Send notifications via SMS</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.smsEnabled}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, smsEnabled: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <div>
                  <p className="font-medium text-gray-900">WhatsApp Notifications</p>
                  <p className="text-sm text-gray-500">Send notifications via WhatsApp</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.whatsappEnabled}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsappEnabled: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                <div>
                  <p className="font-medium text-gray-900">Push Notifications</p>
                  <p className="text-sm text-gray-500">Browser and mobile push</p>
                </div>
                <input
                  type="checkbox"
                  checked={notificationSettings.pushEnabled}
                  onChange={(e) => setNotificationSettings({ ...notificationSettings, pushEnabled: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>

            {/* Notification Types */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Notification Types</h3>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Appointment Reminders</p>
                    <p className="text-sm text-gray-500">Remind patients of upcoming appointments</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationSettings.appointmentReminders}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, appointmentReminders: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                {notificationSettings.appointmentReminders && (
                  <div className="ml-4 pl-4 border-l-2 border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Send reminder hours before appointment
                    </label>
                    <select
                      value={notificationSettings.reminderHoursBefore}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, reminderHoursBefore: parseInt(e.target.value) })}
                      className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={1}>1 hour</option>
                      <option value={2}>2 hours</option>
                      <option value={4}>4 hours</option>
                      <option value={12}>12 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={48}>48 hours</option>
                    </select>
                  </div>
                )}

                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Lab Results Ready</p>
                    <p className="text-sm text-gray-500">Notify when lab results are available</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationSettings.labResultsNotify}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, labResultsNotify: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Prescription Ready</p>
                    <p className="text-sm text-gray-500">Notify when prescription is ready for pickup</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationSettings.prescriptionReadyNotify}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, prescriptionReadyNotify: e.target.checked })}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>

            {/* Link to detailed notification settings */}
            <div className="pt-4">
              <a
                href="/settings/notifications"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Advanced Notification Settings →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? (
            <>
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircleIcon className="h-5 w-5" />
              Save Settings
            </>
          )}
        </button>
      </div>
    </div>
  );
}
