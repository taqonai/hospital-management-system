import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, Transition, Switch } from '@headlessui/react';
import {
  UserCircleIcon,
  KeyIcon,
  BellIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  IdentificationIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  PencilSquareIcon,
  CameraIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { patientPortalApi } from '../../services/api';
import toast from 'react-hot-toast';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  // Flat address fields (matching backend)
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  nationality?: string;
  // Flat emergency contact fields (matching backend)
  emergencyContact?: string;
  emergencyPhone?: string;
  occupation?: string;
  bloodGroup?: string;
  avatarUrl?: string;
  photo?: string;
  language?: string;
  timezone?: string;
}

interface NotificationPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsappNotifications: boolean;
  appointmentReminders: boolean;
  labResultsReady: boolean;
  prescriptionReminders: boolean;
  billingAlerts: boolean;
  promotionalEmails: boolean;
  reminderTime: string; // '1_DAY', '2_HOURS', '30_MINS'
}

interface CommunicationPreferences {
  preferredContactMethod: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PHONE';
  preferredLanguage: string;
  preferredTimeForCalls: string;
  allowMarketingCommunications: boolean;
}

// Mock data (flat structure matching backend)
const emptyProfile: UserProfile = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  nationality: '',
  emergencyContact: '',
  emergencyPhone: '',
  bloodGroup: '',
  language: '',
  timezone: '',
};

const mockNotificationPrefs: NotificationPreferences = {
  emailNotifications: true,
  smsNotifications: true,
  whatsappNotifications: false,
  appointmentReminders: true,
  labResultsReady: true,
  prescriptionReminders: true,
  billingAlerts: true,
  promotionalEmails: false,
  reminderTime: '1_DAY',
};

const mockCommunicationPrefs: CommunicationPreferences = {
  preferredContactMethod: 'EMAIL',
  preferredLanguage: 'en',
  preferredTimeForCalls: 'MORNING',
  allowMarketingCommunications: false,
};

export default function Settings() {
  const [activeSection, setActiveSection] = useState<'profile' | 'password' | 'notifications' | 'communication'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const queryClient = useQueryClient();

  // Profile form state
  const [profileForm, setProfileForm] = useState<UserProfile>(emptyProfile);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(mockNotificationPrefs);

  // Communication preferences state
  const [communicationPrefs, setCommunicationPrefs] = useState<CommunicationPreferences>(mockCommunicationPrefs);

  // Fetch profile
  const { data: profileData, isLoading: loadingProfile } = useQuery({
    queryKey: ['patient-profile-settings'],
    queryFn: async () => {
      try {
        const response = await patientPortalApi.getProfile();
        const profile = response.data?.data || response.data;
        if (profile) {
          setProfileForm(profile);
          // Sync photo/profile to localStorage for sidebar/header
          try {
            const existing = JSON.parse(localStorage.getItem('patientUser') || '{}');
            localStorage.setItem('patientUser', JSON.stringify({ ...existing, ...profile }));
          } catch {}
        }
        return profile || emptyProfile;
      } catch {
        return emptyProfile;
      }
    },
  });

  // Fetch notification preferences
  const { data: notifPrefsData, isLoading: loadingNotifPrefs } = useQuery({
    queryKey: ['patient-notification-preferences'],
    queryFn: async () => {
      try {
        const response = await patientPortalApi.getNotificationPreferences();
        const prefs = response.data?.data || response.data || mockNotificationPrefs;
        setNotificationPrefs(prefs);
        return prefs;
      } catch {
        return mockNotificationPrefs;
      }
    },
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: (data: Partial<UserProfile>) => patientPortalApi.updateProfile(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['patient-profile-settings'] });
      queryClient.invalidateQueries({ queryKey: ['patient-profile'] });
      queryClient.invalidateQueries({ queryKey: ['patient-portal'] });
      // Update form with response data immediately
      const updated = response?.data?.data || response?.data;
      if (updated) {
        setProfileForm(updated);
        // Sync to localStorage so sidebar/header picks up changes (including photo)
        try {
          const existing = JSON.parse(localStorage.getItem('patientUser') || '{}');
          localStorage.setItem('patientUser', JSON.stringify({ ...existing, ...updated }));
        } catch {}
      }
      toast.success('Profile updated successfully');
      setIsEditing(false);
    },
    onError: (error: any) => {
      // Handle validation errors properly
      const errorData = error.response?.data;
      if (errorData?.errors && Array.isArray(errorData.errors)) {
        // Show each validation error
        errorData.errors.forEach((err: { message: string; path?: string[] }) => {
          const fieldName = err.path?.join('.') || 'Field';
          toast.error(`${fieldName}: ${err.message}`);
        });
      } else if (errorData?.message) {
        toast.error(errorData.message);
      } else {
        toast.error('Failed to update profile. Please check your input.');
      }
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      patientPortalApi.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to change password');
    },
  });

  // Update notification preferences mutation
  const updateNotifPrefsMutation = useMutation({
    mutationFn: (data: NotificationPreferences) => patientPortalApi.updateNotificationPreferences(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-notification-preferences'] });
      toast.success('Notification preferences updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    },
  });

  // Update communication preferences mutation
  const updateCommPrefsMutation = useMutation({
    mutationFn: (data: CommunicationPreferences) => patientPortalApi.updateCommunicationPreferences(data),
    onSuccess: () => {
      toast.success('Communication preferences updated');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update preferences');
    },
  });

  const handleSaveProfile = () => {
    // Validate mandatory fields
    const errors: string[] = [];

    if (!profileForm.firstName?.trim()) {
      errors.push('First name is required');
    }
    if (!profileForm.lastName?.trim()) {
      errors.push('Last name is required');
    }
    if (!profileForm.emergencyContact?.trim()) {
      errors.push('Emergency contact name is required');
    }
    if (!profileForm.emergencyPhone?.trim()) {
      errors.push('Emergency contact phone is required');
    }

    if (errors.length > 0) {
      errors.forEach(err => toast.error(err));
      return;
    }

    // Send only the fields that backend expects
    const updateData: Partial<UserProfile> = {
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      phone: profileForm.phone || null,
      email: profileForm.email,
      dateOfBirth: profileForm.dateOfBirth || null,
      gender: profileForm.gender || null,
      bloodGroup: profileForm.bloodGroup || null,
      address: profileForm.address || null,
      city: profileForm.city || null,
      state: profileForm.state || null,
      zipCode: profileForm.zipCode || null,
      emergencyContact: profileForm.emergencyContact || null,
      emergencyPhone: profileForm.emergencyPhone || null,
      occupation: profileForm.occupation || null,
      nationality: profileForm.nationality || null,
    } as any;

    updateProfileMutation.mutate(updateData);
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleNotificationToggle = (key: keyof NotificationPreferences, value: boolean | string) => {
    const newPrefs = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(newPrefs);
    updateNotifPrefsMutation.mutate(newPrefs);
  };

  const handleCommunicationChange = (key: keyof CommunicationPreferences, value: string | boolean) => {
    const newPrefs = { ...communicationPrefs, [key]: value };
    setCommunicationPrefs(newPrefs);
    updateCommPrefsMutation.mutate(newPrefs);
  };

  const sidebarItems = [
    { id: 'profile', label: 'Profile Information', icon: UserCircleIcon },
    { id: 'password', label: 'Change Password', icon: KeyIcon },
    { id: 'notifications', label: 'Notification Preferences', icon: BellIcon },
    { id: 'communication', label: 'Communication Preferences', icon: DevicePhoneMobileIcon },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl text-white shadow-lg">
              <UserCircleIcon className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
              <p className="text-gray-500 mt-1">Manage your profile, security, and preferences</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-4 space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                      activeSection === item.id
                        ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Profile Section */}
            {activeSection === 'profile' && (
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg">
                {/* Header */}
                <div className="p-6 border-b border-gray-200/50 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Profile Information</h2>
                    <p className="text-sm text-gray-500 mt-1">Update your personal details</p>
                  </div>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
                    >
                      <PencilSquareIcon className="h-5 w-5" />
                      Edit Profile
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setIsEditing(false); setProfileForm(profileData || emptyProfile); }}
                        className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={updateProfileMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        {updateProfileMutation.isPending ? (
                          <ArrowPathIcon className="h-5 w-5 animate-spin" />
                        ) : (
                          <CheckCircleIcon className="h-5 w-5" />
                        )}
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>

                {loadingProfile ? (
                  <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600 mx-auto" />
                    <p className="mt-4 text-gray-500">Loading profile...</p>
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    {/* Avatar */}
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        {(profileForm.photo || profileForm.avatarUrl) ? (
                          <img
                            src={profileForm.photo || profileForm.avatarUrl}
                            alt={`${profileForm.firstName} ${profileForm.lastName}`}
                            className="h-24 w-24 rounded-full object-cover shadow-lg"
                          />
                        ) : (
                          <div className="h-24 w-24 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                            {profileForm.firstName?.[0]}{profileForm.lastName?.[0]}
                          </div>
                        )}
                        {isEditing && (
                          <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors">
                            <CameraIcon className="h-5 w-5 text-gray-600" />
                          </button>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{profileForm.firstName} {profileForm.lastName}</h3>
                        <p className="text-gray-500">{profileForm.email}</p>
                        {profileForm.bloodGroup && (
                          <span className="inline-flex items-center px-2.5 py-1 mt-2 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Blood Group: {(profileForm.bloodGroup || '').replace('_POSITIVE', '+').replace('_NEGATIVE', '-')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Personal Information */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <IdentificationIcon className="h-4 w-4" />
                        Personal Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                          <input
                            type="text"
                            value={profileForm.firstName}
                            onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                            disabled={!isEditing}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                          <input
                            type="text"
                            value={profileForm.lastName}
                            onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                            disabled={!isEditing}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                          <div className="relative">
                            <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="email"
                              value={profileForm.email}
                              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                              disabled={!isEditing}
                              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                          <div className="relative">
                            <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="tel"
                              value={profileForm.phone || ''}
                              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                              disabled={!isEditing}
                              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
                          <div className="relative">
                            <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="date"
                              value={profileForm.dateOfBirth || ''}
                              onChange={(e) => setProfileForm({ ...profileForm, dateOfBirth: e.target.value })}
                              disabled={!isEditing}
                              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Gender</label>
                          <select
                            value={profileForm.gender || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                            disabled={!isEditing}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                          >
                            <option value="">Select Gender</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Blood Group</label>
                          <select
                            value={profileForm.bloodGroup || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, bloodGroup: e.target.value })}
                            disabled={!isEditing}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                          >
                            <option value="">Select Blood Group</option>
                            <option value="A_POSITIVE">A+</option>
                            <option value="A_NEGATIVE">A-</option>
                            <option value="B_POSITIVE">B+</option>
                            <option value="B_NEGATIVE">B-</option>
                            <option value="AB_POSITIVE">AB+</option>
                            <option value="AB_NEGATIVE">AB-</option>
                            <option value="O_POSITIVE">O+</option>
                            <option value="O_NEGATIVE">O-</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <MapPinIcon className="h-4 w-4" />
                        Address
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                          <input
                            type="text"
                            value={profileForm.address || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                            disabled={!isEditing}
                            placeholder="Enter your street address"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                          <input
                            type="text"
                            value={profileForm.city || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                            disabled={!isEditing}
                            placeholder="Enter city"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                          <input
                            type="text"
                            value={profileForm.state || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                            disabled={!isEditing}
                            placeholder="Enter state"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
                          <input
                            type="text"
                            value={profileForm.zipCode || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, zipCode: e.target.value })}
                            disabled={!isEditing}
                            placeholder="Enter ZIP/postal code"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Nationality</label>
                          <input
                            type="text"
                            value={profileForm.nationality || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, nationality: e.target.value })}
                            disabled={!isEditing}
                            placeholder="Enter nationality"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Emergency Contact - Mandatory */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                        Emergency Contact
                        <span className="text-red-500 text-xs font-normal">(Required)</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Contact Name & Relationship <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={profileForm.emergencyContact || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, emergencyContact: e.target.value })}
                            disabled={!isEditing}
                            placeholder="e.g., Jane Doe - Spouse"
                            className={`w-full px-4 py-3 rounded-xl border bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500 ${
                              isEditing && !profileForm.emergencyContact?.trim() ? 'border-red-300' : 'border-gray-200'
                            }`}
                          />
                          {isEditing && !profileForm.emergencyContact?.trim() && (
                            <p className="text-red-500 text-xs mt-1">Emergency contact name is required</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Emergency Phone <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={profileForm.emergencyPhone || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, emergencyPhone: e.target.value })}
                            disabled={!isEditing}
                            placeholder="e.g., +1 555-987-6543"
                            className={`w-full px-4 py-3 rounded-xl border bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500 ${
                              isEditing && !profileForm.emergencyPhone?.trim() ? 'border-red-300' : 'border-gray-200'
                            }`}
                          />
                          {isEditing && !profileForm.emergencyPhone?.trim() && (
                            <p className="text-red-500 text-xs mt-1">Emergency phone number is required</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Occupation */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <IdentificationIcon className="h-4 w-4" />
                        Other Information
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Occupation</label>
                          <input
                            type="text"
                            value={profileForm.occupation || ''}
                            onChange={(e) => setProfileForm({ ...profileForm, occupation: e.target.value })}
                            disabled={!isEditing}
                            placeholder="Enter your occupation"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 disabled:bg-gray-50 disabled:text-gray-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Password Section */}
            {activeSection === 'password' && (
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-slate-100 rounded-xl">
                    <KeyIcon className="h-6 w-6 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
                    <p className="text-sm text-gray-500">Update your password to keep your account secure</p>
                  </div>
                </div>

                <div className="space-y-5 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                    <div className="relative">
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 pr-12"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500 pr-12"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                      placeholder="Confirm new password"
                    />
                  </div>

                  <button
                    onClick={handleChangePassword}
                    disabled={!currentPassword || !newPassword || !confirmPassword || changePasswordMutation.isPending}
                    className="w-full px-6 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {changePasswordMutation.isPending ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <ShieldCheckIcon className="h-5 w-5" />
                    )}
                    Update Password
                  </button>
                </div>
              </div>
            )}

            {/* Notifications Section */}
            {activeSection === 'notifications' && (
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-slate-100 rounded-xl">
                    <BellIcon className="h-6 w-6 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Notification Preferences</h2>
                    <p className="text-sm text-gray-500">Choose how and when you want to be notified</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Notification Channels */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Notification Channels</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <EnvelopeIcon className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900">Email Notifications</p>
                            <p className="text-sm text-gray-500">Receive updates via email</p>
                          </div>
                        </div>
                        <Switch
                          checked={notificationPrefs.emailNotifications}
                          onChange={(value) => handleNotificationToggle('emailNotifications', value)}
                          className={`${notificationPrefs.emailNotifications ? 'bg-slate-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                          <span className={`${notificationPrefs.emailNotifications ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </Switch>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <DevicePhoneMobileIcon className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900">SMS Notifications</p>
                            <p className="text-sm text-gray-500">Receive updates via text message</p>
                          </div>
                        </div>
                        <Switch
                          checked={notificationPrefs.smsNotifications}
                          onChange={(value) => handleNotificationToggle('smsNotifications', value)}
                          className={`${notificationPrefs.smsNotifications ? 'bg-slate-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                          <span className={`${notificationPrefs.smsNotifications ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </Switch>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <svg className="h-5 w-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          <div>
                            <p className="font-medium text-gray-900">WhatsApp Notifications</p>
                            <p className="text-sm text-gray-500">Receive updates via WhatsApp</p>
                          </div>
                        </div>
                        <Switch
                          checked={notificationPrefs.whatsappNotifications}
                          onChange={(value) => handleNotificationToggle('whatsappNotifications', value)}
                          className={`${notificationPrefs.whatsappNotifications ? 'bg-slate-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                        >
                          <span className={`${notificationPrefs.whatsappNotifications ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                        </Switch>
                      </div>
                    </div>
                  </div>

                  {/* Notification Types */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Notification Types</h4>
                    <div className="space-y-4">
                      {[
                        { key: 'appointmentReminders', label: 'Appointment Reminders', description: 'Get reminded about upcoming appointments' },
                        { key: 'labResultsReady', label: 'Lab Results Ready', description: 'Get notified when your lab results are ready' },
                        { key: 'prescriptionReminders', label: 'Prescription Reminders', description: 'Reminders for medication refills' },
                        { key: 'billingAlerts', label: 'Billing Alerts', description: 'Updates about bills and payments' },
                        { key: 'promotionalEmails', label: 'Promotional Emails', description: 'Health tips and promotional content' },
                      ].map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                          <div>
                            <p className="font-medium text-gray-900">{item.label}</p>
                            <p className="text-sm text-gray-500">{item.description}</p>
                          </div>
                          <Switch
                            checked={notificationPrefs[item.key as keyof NotificationPreferences] as boolean}
                            onChange={(value) => handleNotificationToggle(item.key as keyof NotificationPreferences, value)}
                            className={`${notificationPrefs[item.key as keyof NotificationPreferences] ? 'bg-slate-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                          >
                            <span className={`${notificationPrefs[item.key as keyof NotificationPreferences] ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                          </Switch>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reminder Timing */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Appointment Reminder Timing</h4>
                    <select
                      value={notificationPrefs.reminderTime}
                      onChange={(e) => handleNotificationToggle('reminderTime', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    >
                      <option value="30_MINS">30 minutes before</option>
                      <option value="2_HOURS">2 hours before</option>
                      <option value="1_DAY">1 day before</option>
                      <option value="2_DAYS">2 days before</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Communication Section */}
            {activeSection === 'communication' && (
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-lg p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="p-3 bg-slate-100 rounded-xl">
                    <GlobeAltIcon className="h-6 w-6 text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Communication Preferences</h2>
                    <p className="text-sm text-gray-500">Set your preferred communication methods</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Preferred Contact Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Contact Method</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { value: 'EMAIL', label: 'Email', icon: EnvelopeIcon },
                        { value: 'SMS', label: 'SMS', icon: DevicePhoneMobileIcon },
                        { value: 'WHATSAPP', label: 'WhatsApp', icon: DevicePhoneMobileIcon },
                        { value: 'PHONE', label: 'Phone Call', icon: PhoneIcon },
                      ].map((option) => {
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.value}
                            onClick={() => handleCommunicationChange('preferredContactMethod', option.value as 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PHONE')}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                              communicationPrefs.preferredContactMethod === option.value
                                ? 'border-slate-600 bg-slate-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <Icon className={`h-6 w-6 ${communicationPrefs.preferredContactMethod === option.value ? 'text-slate-600' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${communicationPrefs.preferredContactMethod === option.value ? 'text-slate-700' : 'text-gray-600'}`}>
                              {option.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preferred Language */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Language</label>
                    <select
                      value={communicationPrefs.preferredLanguage}
                      onChange={(e) => handleCommunicationChange('preferredLanguage', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="zh">Chinese</option>
                      <option value="hi">Hindi</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </div>

                  {/* Preferred Time for Calls */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Time for Phone Calls</label>
                    <select
                      value={communicationPrefs.preferredTimeForCalls}
                      onChange={(e) => handleCommunicationChange('preferredTimeForCalls', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
                    >
                      <option value="MORNING">Morning (8 AM - 12 PM)</option>
                      <option value="AFTERNOON">Afternoon (12 PM - 5 PM)</option>
                      <option value="EVENING">Evening (5 PM - 8 PM)</option>
                      <option value="ANYTIME">Anytime</option>
                    </select>
                  </div>

                  {/* Marketing Communications */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">Marketing Communications</p>
                      <p className="text-sm text-gray-500">Receive health tips, news, and promotional content</p>
                    </div>
                    <Switch
                      checked={communicationPrefs.allowMarketingCommunications}
                      onChange={(value) => handleCommunicationChange('allowMarketingCommunications', value)}
                      className={`${communicationPrefs.allowMarketingCommunications ? 'bg-slate-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
                    >
                      <span className={`${communicationPrefs.allowMarketingCommunications ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                    </Switch>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
