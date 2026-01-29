import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format, parse, isValid, differenceInYears } from 'date-fns';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { useAppDispatch, useAppSelector } from '../../store';
import { refreshProfile } from '../../store/authSlice';
import { authApi } from '../../services/api';

// Country codes data
const COUNTRY_CODES = [
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'United States' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'United Kingdom' },
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+86', country: 'CN', flag: '🇨🇳', name: 'China' },
  { code: '+81', country: 'JP', flag: '🇯🇵', name: 'Japan' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: '+55', country: 'BR', flag: '🇧🇷', name: 'Brazil' },
  { code: '+52', country: 'MX', flag: '🇲🇽', name: 'Mexico' },
  { code: '+7', country: 'RU', flag: '🇷🇺', name: 'Russia' },
  { code: '+82', country: 'KR', flag: '🇰🇷', name: 'South Korea' },
  { code: '+31', country: 'NL', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+46', country: 'SE', flag: '🇸🇪', name: 'Sweden' },
  { code: '+41', country: 'CH', flag: '🇨🇭', name: 'Switzerland' },
  { code: '+65', country: 'SG', flag: '🇸🇬', name: 'Singapore' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', country: 'SA', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+20', country: 'EG', flag: '🇪🇬', name: 'Egypt' },
  { code: '+27', country: 'ZA', flag: '🇿🇦', name: 'South Africa' },
  { code: '+234', country: 'NG', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+254', country: 'KE', flag: '🇰🇪', name: 'Kenya' },
  { code: '+60', country: 'MY', flag: '🇲🇾', name: 'Malaysia' },
  { code: '+63', country: 'PH', flag: '🇵🇭', name: 'Philippines' },
  { code: '+66', country: 'TH', flag: '🇹🇭', name: 'Thailand' },
  { code: '+84', country: 'VN', flag: '🇻🇳', name: 'Vietnam' },
  { code: '+62', country: 'ID', flag: '🇮🇩', name: 'Indonesia' },
  { code: '+92', country: 'PK', flag: '🇵🇰', name: 'Pakistan' },
  { code: '+880', country: 'BD', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+90', country: 'TR', flag: '🇹🇷', name: 'Turkey' },
  { code: '+48', country: 'PL', flag: '🇵🇱', name: 'Poland' },
  { code: '+380', country: 'UA', flag: '🇺🇦', name: 'Ukraine' },
  { code: '+94', country: 'LK', flag: '🇱🇰', name: 'Sri Lanka' },
];

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  phoneCountryCode: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | '';
  bloodGroup: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyPhoneCountryCode: string;
}

interface ValidationErrors {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

// Helper to extract country code from phone number
const extractCountryCode = (phone: string): { code: string; number: string } => {
  if (!phone) return { code: '+1', number: '' };

  // Try to match country codes
  for (const country of COUNTRY_CODES.sort((a, b) => b.code.length - a.code.length)) {
    if (phone.startsWith(country.code)) {
      return { code: country.code, number: phone.slice(country.code.length) };
    }
  }

  // If starts with +, try to extract
  if (phone.startsWith('+')) {
    const match = phone.match(/^\+(\d{1,4})/);
    if (match) {
      return { code: '+' + match[1], number: phone.slice(match[0].length) };
    }
  }

  return { code: '+1', number: phone };
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [errors, setErrors] = useState<ValidationErrors>({});

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerDate, setDatePickerDate] = useState(new Date());

  // Country code picker state
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [activePhoneField, setActivePhoneField] = useState<'phone' | 'emergencyPhone'>('phone');
  const [countrySearch, setCountrySearch] = useState('');

  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    phoneCountryCode: '+1',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyPhoneCountryCode: '+1',
  });

  useEffect(() => {
    if (user) {
      const phoneData = extractCountryCode(user.phone || '');
      // Backend returns emergencyPhone, mobile app may have emergencyContactPhone
      const emergencyPhoneValue = user.emergencyPhone || user.emergencyContactPhone || '';
      const emergencyPhoneData = extractCountryCode(emergencyPhoneValue);
      // Backend returns emergencyContact, mobile app may have emergencyContactName
      const emergencyContactValue = user.emergencyContact || user.emergencyContactName || '';

      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: phoneData.number,
        phoneCountryCode: phoneData.code,
        dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
        gender: user.gender || '',
        bloodGroup: user.bloodGroup || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        zipCode: user.zipCode || '',
        emergencyContactName: emergencyContactValue,
        emergencyContactPhone: emergencyPhoneData.number,
        emergencyPhoneCountryCode: emergencyPhoneData.code,
      });
      setProfilePhoto(user.photo || null);

      // Set date picker initial date
      if (user.dateOfBirth) {
        const dob = new Date(user.dateOfBirth);
        if (isValid(dob)) {
          setDatePickerDate(dob);
        }
      }
    }
  }, [user]);

  const handleChange = (field: keyof ProfileFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Validation functions
  const validatePhone = (phone: string): string | undefined => {
    if (!phone) return undefined; // Optional
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (!/^\d+$/.test(cleanPhone)) {
      return 'Phone number can only contain digits';
    }
    if (cleanPhone.length < 6 || cleanPhone.length > 15) {
      return 'Phone number must be 6-15 digits';
    }
    return undefined;
  };

  const validateDateOfBirth = (dob: string): string | undefined => {
    if (!dob) return undefined; // Optional

    const date = new Date(dob);
    if (!isValid(date)) {
      return 'Please select a valid date';
    }

    const today = new Date();
    if (date > today) {
      return 'Date of birth cannot be in the future';
    }

    const age = differenceInYears(today, date);
    if (age > 150) {
      return 'Please enter a valid date of birth';
    }
    if (age < 0) {
      return 'Date of birth cannot be in the future';
    }

    return undefined;
  };

  const validateName = (name: string, fieldName: string): string | undefined => {
    if (!name.trim()) {
      return `${fieldName} is required`;
    }
    if (name.trim().length < 2) {
      return `${fieldName} must be at least 2 characters`;
    }
    if (name.length > 50) {
      return `${fieldName} cannot exceed 50 characters`;
    }
    if (!/^[a-zA-Z\s'\-\.]+$/.test(name)) {
      return `${fieldName} can only contain letters, spaces, hyphens, apostrophes, and periods`;
    }
    return undefined;
  };

  const validateZipCode = (zip: string): string | undefined => {
    if (!zip) return undefined; // Optional
    if (zip.length > 10) {
      return 'ZIP/Postal code cannot exceed 10 characters';
    }
    if (!/^[a-zA-Z0-9\s\-]+$/.test(zip)) {
      return 'ZIP/Postal code contains invalid characters';
    }
    return undefined;
  };

  const validateAddress = (address: string): string | undefined => {
    if (!address) return undefined; // Optional
    if (address.length > 200) {
      return 'Address cannot exceed 200 characters';
    }
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Required fields
    const firstNameError = validateName(formData.firstName, 'First name');
    if (firstNameError) newErrors.firstName = firstNameError;

    const lastNameError = validateName(formData.lastName, 'Last name');
    if (lastNameError) newErrors.lastName = lastNameError;

    // Optional fields with validation
    const phoneError = validatePhone(formData.phone);
    if (phoneError) newErrors.phone = phoneError;

    const dobError = validateDateOfBirth(formData.dateOfBirth);
    if (dobError) newErrors.dateOfBirth = dobError;

    const zipError = validateZipCode(formData.zipCode);
    if (zipError) newErrors.zipCode = zipError;

    const addressError = validateAddress(formData.address);
    if (addressError) newErrors.address = addressError;

    // Emergency contact validation
    if (formData.emergencyContactName && !formData.emergencyContactPhone) {
      newErrors.emergencyContactPhone = 'Please provide emergency contact phone number';
    }
    if (formData.emergencyContactPhone && !formData.emergencyContactName) {
      newErrors.emergencyContactName = 'Please provide emergency contact name';
    }

    const emergencyPhoneError = validatePhone(formData.emergencyContactPhone);
    if (emergencyPhoneError) newErrors.emergencyContactPhone = emergencyPhoneError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      Alert.alert(
        'Please Fix Errors',
        'Some fields have validation errors. Please review and correct them.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSaving(true);
    try {
      // Build full phone numbers with country codes
      const fullPhone = formData.phone
        ? `${formData.phoneCountryCode}${formData.phone.replace(/[\s\-\(\)]/g, '')}`
        : undefined;
      const fullEmergencyPhone = formData.emergencyContactPhone
        ? `${formData.emergencyPhoneCountryCode}${formData.emergencyContactPhone.replace(/[\s\-\(\)]/g, '')}`
        : undefined;

      // Map to backend field names
      const updateData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: fullPhone,
        address: formData.address?.trim() || undefined,
        city: formData.city?.trim() || undefined,
        state: formData.state?.trim() || undefined,
        zipCode: formData.zipCode?.trim() || undefined,
        // Backend expects 'emergencyContact' not 'emergencyContactName'
        emergencyContact: formData.emergencyContactName?.trim() || undefined,
        // Backend expects 'emergencyPhone' not 'emergencyContactPhone'
        emergencyPhone: fullEmergencyPhone,
        bloodGroup: formData.bloodGroup || undefined,
        dateOfBirth: formData.dateOfBirth || undefined,
        gender: formData.gender || undefined,
      };

      // Remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined && v !== '')
      );

      await authApi.updateProfile(cleanData as any);
      await dispatch(refreshProfile());
      setIsEditing(false);
      Alert.alert('Success', 'Your profile has been updated successfully.');
    } catch (error: any) {
      console.error('Profile update error:', error);
      const message = error.response?.data?.message
        || error.response?.data?.errors?.[0]?.message
        || 'Failed to update profile. Please try again.';
      Alert.alert('Update Failed', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      const phoneData = extractCountryCode(user.phone || '');
      // Backend returns emergencyPhone, mobile app may have emergencyContactPhone
      const emergencyPhoneValue = user.emergencyPhone || user.emergencyContactPhone || '';
      const emergencyPhoneData = extractCountryCode(emergencyPhoneValue);
      // Backend returns emergencyContact, mobile app may have emergencyContactName
      const emergencyContactValue = user.emergencyContact || user.emergencyContactName || '';

      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: phoneData.number,
        phoneCountryCode: phoneData.code,
        dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split('T')[0] : '',
        gender: user.gender || '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        zipCode: user.zipCode || '',
        emergencyContactName: emergencyContactValue,
        emergencyContactPhone: emergencyPhoneData.number,
        emergencyPhoneCountryCode: emergencyPhoneData.code,
      });
      setProfilePhoto(user.photo || null);
    }
    setErrors({});
    setIsEditing(false);
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photo library to change your profile picture.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(
        'Permission Required',
        'Please allow access to your camera to take a profile picture.',
        [{ text: 'OK' }]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setIsUploadingPhoto(true);
    try {
      const response = await authApi.uploadProfilePhoto(uri);
      const photoUrl = response.data?.data?.photoUrl;
      if (photoUrl) {
        setProfilePhoto(photoUrl);
        await dispatch(refreshProfile());
        Alert.alert('Success', 'Profile photo updated successfully.');
      } else {
        throw new Error('No photo URL returned');
      }
    } catch (error: any) {
      console.error('Photo upload error:', error.response?.data || error);

      let errorMessage = 'Failed to upload photo. Please try again.';

      if (error.response?.status === 503) {
        errorMessage = 'Photo storage service is temporarily unavailable. Please try again later.';
      } else if (error.response?.status === 413) {
        errorMessage = 'Photo is too large. Please choose a smaller image (max 5MB).';
      } else if (error.response?.status === 415) {
        errorMessage = 'Invalid image format. Please use JPG, PNG, or GIF.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Change Profile Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickImage },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // Date picker handlers
  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (event.type === 'set' && selectedDate) {
      setDatePickerDate(selectedDate);
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      handleChange('dateOfBirth', formattedDate);
    }

    if (Platform.OS === 'ios' && event.type === 'dismissed') {
      setShowDatePicker(false);
    }
  };

  const openDatePicker = () => {
    if (formData.dateOfBirth) {
      const existingDate = new Date(formData.dateOfBirth);
      if (isValid(existingDate)) {
        setDatePickerDate(existingDate);
      }
    }
    setShowDatePicker(true);
  };

  // Country code picker handlers
  const openCountryPicker = (field: 'phone' | 'emergencyPhone') => {
    setActivePhoneField(field);
    setCountrySearch('');
    setShowCountryPicker(true);
  };

  const selectCountryCode = (code: string) => {
    if (activePhoneField === 'phone') {
      handleChange('phoneCountryCode', code);
    } else {
      handleChange('emergencyPhoneCountryCode', code);
    }
    setShowCountryPicker(false);
  };

  const filteredCountries = COUNTRY_CODES.filter(
    (c) =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.includes(countrySearch) ||
      c.country.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const renderField = (
    label: string,
    field: keyof ProfileFormData,
    options?: {
      keyboardType?: 'default' | 'email-address' | 'phone-pad';
      editable?: boolean;
      placeholder?: string;
      maxLength?: number;
    }
  ) => {
    const { keyboardType = 'default', editable = true, placeholder, maxLength } = options || {};
    const isFieldEditable = isEditing && editable;
    const error = errors[field as keyof ValidationErrors];

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {isFieldEditable ? (
          <>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={formData[field]}
              onChangeText={(value) => handleChange(field, value)}
              placeholder={placeholder || label}
              placeholderTextColor={colors.gray[400]}
              keyboardType={keyboardType}
              editable={!isSaving}
              maxLength={maxLength}
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
          </>
        ) : (
          <Text style={styles.fieldValue}>
            {formData[field] || '-'}
          </Text>
        )}
      </View>
    );
  };

  const renderPhoneField = (
    label: string,
    phoneField: 'phone' | 'emergencyContactPhone',
    countryCodeField: 'phoneCountryCode' | 'emergencyPhoneCountryCode',
    pickerField: 'phone' | 'emergencyPhone'
  ) => {
    const isFieldEditable = isEditing;
    const error = errors[phoneField as keyof ValidationErrors];
    const countryCode = formData[countryCodeField];
    const country = COUNTRY_CODES.find((c) => c.code === countryCode);

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {isFieldEditable ? (
          <>
            <View style={styles.phoneInputContainer}>
              <TouchableOpacity
                style={[styles.countryCodeButton, error && styles.inputError]}
                onPress={() => openCountryPicker(pickerField)}
                disabled={isSaving}
              >
                <Text style={styles.countryFlag}>{country?.flag || '🌐'}</Text>
                <Text style={styles.countryCodeText}>{countryCode}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.gray[500]} />
              </TouchableOpacity>
              <TextInput
                style={[styles.phoneInput, error && styles.inputError]}
                value={formData[phoneField]}
                onChangeText={(value) => handleChange(phoneField, value.replace(/[^\d]/g, ''))}
                placeholder="Phone number"
                placeholderTextColor={colors.gray[400]}
                keyboardType="phone-pad"
                editable={!isSaving}
                maxLength={15}
              />
            </View>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </>
        ) : (
          <Text style={styles.fieldValue}>
            {formData[phoneField]
              ? `${countryCode} ${formData[phoneField]}`
              : '-'}
          </Text>
        )}
      </View>
    );
  };

  const renderDateField = () => {
    const isFieldEditable = isEditing;
    const error = errors.dateOfBirth;

    const displayDate = formData.dateOfBirth
      ? format(new Date(formData.dateOfBirth), 'MMM dd, yyyy')
      : '';

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>Date of Birth</Text>
        {isFieldEditable ? (
          <>
            <TouchableOpacity
              style={[styles.datePickerButton, error && styles.inputError]}
              onPress={openDatePicker}
              disabled={isSaving}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.gray[500]} />
              <Text style={[
                styles.datePickerText,
                !displayDate && styles.datePickerPlaceholder
              ]}>
                {displayDate || 'Select date of birth'}
              </Text>
            </TouchableOpacity>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </>
        ) : (
          <Text style={styles.fieldValue}>
            {displayDate || '-'}
          </Text>
        )}
      </View>
    );
  };

  const genderOptions = ['MALE', 'FEMALE'];

  const renderGenderSelector = () => (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>Gender</Text>
      {isEditing ? (
        <View style={styles.genderContainer}>
          {genderOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.genderOption,
                formData.gender === option && styles.genderOptionSelected,
              ]}
              onPress={() => handleChange('gender', option)}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.genderOptionText,
                  formData.gender === option && styles.genderOptionTextSelected,
                ]}
              >
                {option.charAt(0) + option.slice(1).toLowerCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.fieldValue}>
          {formData.gender
            ? formData.gender.charAt(0) + formData.gender.slice(1).toLowerCase()
            : '-'}
        </Text>
      )}
    </View>
  );

  // Country Code Picker Modal
  const renderCountryPicker = () => (
    <Modal
      visible={showCountryPicker}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowCountryPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country Code</Text>
            <TouchableOpacity
              onPress={() => setShowCountryPicker(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color={colors.gray[600]} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.gray[400]} />
            <TextInput
              style={styles.searchInput}
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search country or code..."
              placeholderTextColor={colors.gray[400]}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.country}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.countryItem}
                onPress={() => selectCountryCode(item.code)}
              >
                <Text style={styles.countryItemFlag}>{item.flag}</Text>
                <Text style={styles.countryItemName}>{item.name}</Text>
                <Text style={styles.countryItemCode}>{item.code}</Text>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.countryItemSeparator} />}
          />
        </View>
      </View>
    </Modal>
  );

  // iOS Date Picker Modal
  const renderIOSDatePicker = () => (
    <Modal
      visible={showDatePicker && Platform.OS === 'ios'}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowDatePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.datePickerModalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Date</Text>
            <TouchableOpacity
              onPress={() => {
                const formattedDate = format(datePickerDate, 'yyyy-MM-dd');
                handleChange('dateOfBirth', formattedDate);
                setShowDatePicker(false);
              }}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={datePickerDate}
            mode="date"
            display="spinner"
            onChange={(event, date) => {
              if (date) setDatePickerDate(date);
            }}
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
          />
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={isEditing ? showPhotoOptions : undefined}
            disabled={isUploadingPhoto}
          >
            {isUploadingPhoto ? (
              <View style={styles.avatar}>
                <ActivityIndicator size="large" color={colors.primary[600]} />
              </View>
            ) : profilePhoto ? (
              <Image
                source={{ uri: profilePhoto }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatar}>
                <Ionicons name="person" size={48} color={colors.primary[600]} />
              </View>
            )}
            {isEditing && (
              <View style={styles.cameraIconOverlay}>
                <Ionicons name="camera" size={20} color={colors.white} />
              </View>
            )}
          </TouchableOpacity>
          {isEditing && (
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={showPhotoOptions}
              disabled={isUploadingPhoto}
            >
              <Ionicons name="camera" size={16} color={colors.primary[600]} />
              <Text style={styles.changePhotoText}>
                {isUploadingPhoto ? 'Uploading...' : 'Change Photo'}
              </Text>
            </TouchableOpacity>
          )}
          <Text style={styles.userName}>
            {formData.firstName} {formData.lastName}
          </Text>
          <Text style={styles.userEmail}>{formData.email}</Text>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.card}>
            {renderField('First Name', 'firstName', { maxLength: 50 })}
            {renderField('Last Name', 'lastName', { maxLength: 50 })}
            {renderField('Email', 'email', { keyboardType: 'email-address', editable: false })}
            {renderPhoneField('Phone', 'phone', 'phoneCountryCode', 'phone')}
            {renderDateField()}
            {renderGenderSelector()}

            {/* Blood Group */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Blood Group</Text>
              {isEditing ? (
                <View style={styles.genderContainer}>
                  {['A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE', 'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.genderOption,
                        { minWidth: 50, paddingHorizontal: 10 },
                        formData.bloodGroup === option && styles.genderOptionSelected,
                      ]}
                      onPress={() => handleChange('bloodGroup', option)}
                      disabled={isSaving}
                    >
                      <Text
                        style={[
                          styles.genderOptionText,
                          { fontSize: 13 },
                          formData.bloodGroup === option && styles.genderOptionTextSelected,
                        ]}
                      >
                        {option.replace('_POSITIVE', '+').replace('_NEGATIVE', '-')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.fieldValue}>
                  {formData.bloodGroup
                    ? formData.bloodGroup.replace('_POSITIVE', '+').replace('_NEGATIVE', '-')
                    : '-'}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address</Text>
          <View style={styles.card}>
            {renderField('Street Address', 'address', { maxLength: 200, placeholder: 'Enter your address' })}
            {renderField('City', 'city', { maxLength: 50 })}
            {renderField('State/Province', 'state', { maxLength: 50 })}
            {renderField('ZIP/Postal Code', 'zipCode', { maxLength: 10 })}
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <View style={styles.card}>
            {renderField('Contact Name', 'emergencyContactName', { maxLength: 100, placeholder: 'Full name' })}
            {renderPhoneField('Contact Phone', 'emergencyContactPhone', 'emergencyPhoneCountryCode', 'emergencyPhone')}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {isEditing ? (
            <>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancel}
                disabled={isSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color={colors.white} />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setIsEditing(true)}
            >
              <Ionicons name="create-outline" size={20} color={colors.white} />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Android Date Picker */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={datePickerDate}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
        />
      )}

      {/* iOS Date Picker Modal */}
      {renderIOSDatePicker()}

      {/* Country Code Picker Modal */}
      {renderCountryPicker()}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.gray[200],
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  changePhotoText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  userName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  userEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  fieldValue: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  input: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  inputError: {
    borderColor: colors.error[500],
  },
  errorText: {
    fontSize: typography.fontSize.xs,
    color: colors.error[500],
    marginTop: spacing.xs,
  },
  // Phone input styles
  phoneInputContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    minWidth: 100,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryCodeText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  // Date picker styles
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  datePickerText: {
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  datePickerPlaceholder: {
    color: colors.gray[400],
  },
  // Gender selector styles
  genderContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  genderOptionSelected: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  genderOptionText: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
  },
  genderOptionTextSelected: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.medium,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalCancelText: {
    fontSize: typography.fontSize.base,
    color: colors.error[500],
  },
  modalDoneText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  datePickerModalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: spacing.xl,
  },
  // Search styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  // Country item styles
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  countryItemFlag: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  countryItemName: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
  },
  countryItemCode: {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    fontWeight: typography.fontWeight.medium,
  },
  countryItemSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  // Action button styles
  actionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  editButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
});

export default ProfileScreen;
