/**
 * UAE-specific validation utilities
 * Emirates ID, phone numbers, etc.
 */

export interface EmiratesIdValidationResult {
  isValid: boolean;
  formatted?: string;
  error?: string;
}

/**
 * Validate UAE Emirates ID format
 * Format: 784-YYYY-NNNNNNN-C
 * - 784: Country code for UAE
 * - YYYY: Year of birth or registration year
 * - NNNNNNN: 7-digit serial number
 * - C: Single check digit
 * 
 * Examples:
 * - 784-1990-1234567-1
 * - 784-2000-7654321-9
 */
export function validateEmiratesId(emiratesId: string): EmiratesIdValidationResult {
  if (!emiratesId) {
    return {
      isValid: false,
      error: 'Emirates ID is required',
    };
  }

  // Remove all non-digit characters for validation
  const digitsOnly = emiratesId.replace(/\D/g, '');

  // Check length (should be 15 digits: 3 + 4 + 7 + 1)
  if (digitsOnly.length !== 15) {
    return {
      isValid: false,
      error: 'Emirates ID must be 15 digits',
    };
  }

  // Check if starts with 784 (UAE country code)
  if (!digitsOnly.startsWith('784')) {
    return {
      isValid: false,
      error: 'Emirates ID must start with 784 (UAE country code)',
    };
  }

  // Extract parts
  const countryCode = digitsOnly.substring(0, 3);
  const year = digitsOnly.substring(3, 7);
  const serialNumber = digitsOnly.substring(7, 14);
  const checkDigit = digitsOnly.substring(14, 15);

  // Validate year (should be reasonable - between 1900 and current year + 10)
  const yearNum = parseInt(year, 10);
  const currentYear = new Date().getFullYear();
  if (yearNum < 1900 || yearNum > currentYear + 10) {
    return {
      isValid: false,
      error: `Year portion (${year}) is invalid`,
    };
  }

  // Luhn algorithm check for checksum validation (optional - uncomment if needed)
  // if (!luhnCheck(digitsOnly)) {
  //   return {
  //     isValid: false,
  //     error: 'Invalid Emirates ID checksum',
  //   };
  // }

  // Format as 784-YYYY-NNNNNNN-C
  const formatted = `${countryCode}-${year}-${serialNumber}-${checkDigit}`;

  return {
    isValid: true,
    formatted,
  };
}

/**
 * Luhn algorithm for checksum validation
 * Used for Emirates ID validation (if DHA enforces it)
 */
function luhnCheck(cardNumber: string): boolean {
  let sum = 0;
  let shouldDouble = false;

  // Loop through values starting from the rightmost digit
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber.charAt(i), 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Normalize Emirates ID to digits-only format
 */
export function normalizeEmiratesId(emiratesId: string): string {
  return emiratesId.replace(/\D/g, '');
}

/**
 * Format Emirates ID for display (784-YYYY-NNNNNNN-C)
 */
export function formatEmiratesId(emiratesId: string): string {
  const digitsOnly = normalizeEmiratesId(emiratesId);
  
  if (digitsOnly.length !== 15) {
    return emiratesId; // Return as-is if invalid length
  }

  return `${digitsOnly.substring(0, 3)}-${digitsOnly.substring(3, 7)}-${digitsOnly.substring(7, 14)}-${digitsOnly.substring(14, 15)}`;
}

/**
 * Validate UAE mobile number
 * Format: +971-XX-XXX-XXXX or 0XX-XXX-XXXX
 */
export function validateUAEMobile(phone: string): {
  isValid: boolean;
  formatted?: string;
  error?: string;
} {
  if (!phone) {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // UAE numbers should start with 971 (country code) or 0 (local)
  let normalized: string;
  if (digitsOnly.startsWith('971')) {
    normalized = digitsOnly;
  } else if (digitsOnly.startsWith('0')) {
    normalized = '971' + digitsOnly.substring(1);
  } else if (digitsOnly.startsWith('5')) {
    // Assume UAE mobile if starts with 5 (common mobile prefix)
    normalized = '971' + digitsOnly;
  } else {
    return { isValid: false, error: 'Invalid UAE phone number' };
  }

  // UAE mobile numbers should be 12 digits (971 + 9 digits)
  if (normalized.length !== 12) {
    return { isValid: false, error: 'UAE mobile number must be 9 digits after country code' };
  }

  // Mobile numbers typically start with 50, 52, 54, 55, 56, 58
  const mobilePrefix = normalized.substring(3, 5);
  const validPrefixes = ['50', '52', '54', '55', '56', '58'];
  if (!validPrefixes.includes(mobilePrefix)) {
    return { isValid: false, error: `Mobile prefix ${mobilePrefix} is not valid for UAE` };
  }

  // Format as +971-XX-XXX-XXXX
  const formatted = `+${normalized.substring(0, 3)}-${normalized.substring(3, 5)}-${normalized.substring(5, 8)}-${normalized.substring(8, 12)}`;

  return {
    isValid: true,
    formatted,
  };
}

/**
 * Validate UAE ICP (Insurance Card Policy) number
 * Stub for future DHA ICP verification integration
 */
export function validateICPNumber(icpNumber: string): {
  isValid: boolean;
  error?: string;
} {
  // TODO: Implement actual ICP verification with DHA when API is available
  if (!icpNumber || icpNumber.length < 5) {
    return { isValid: false, error: 'ICP number must be at least 5 characters' };
  }

  return { isValid: true };
}
