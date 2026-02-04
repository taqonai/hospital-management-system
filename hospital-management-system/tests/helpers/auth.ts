/**
 * Authentication Helpers for E2E Tests
 * Reusable login functions for Staff and Patient portals
 */

import { Page, expect } from '@playwright/test';

// Staff Portal Credentials
export const STAFF_CREDENTIALS = {
  receptionist: { email: 'receptionist@hospital.com', password: 'password123' },
  doctor: { email: 'idiamin@hospital.com', password: 'password123' },
  labTech: { email: 'labtech@hospital.com', password: 'password123' },
  pharmacist: { email: 'pharmacist@hospital.com', password: 'password123' },
  nurse: { email: 'nurse.moore@hospital.com', password: 'password123' },
};

// Patient Portal Credentials
export const PATIENT_CREDENTIALS = {
  patient: { email: 'kamil@taqon.ai', password: 'password123' },
};

// URLs
export const URLS = {
  staffPortal: 'https://spetaar.ai/login',
  patientPortal: 'https://spetaar.ai/patient-portal/login',
  staffDashboard: 'https://spetaar.ai/dashboard',
  patientDashboard: 'https://spetaar.ai/patient-portal/dashboard',
};

/**
 * Login to Staff Portal
 */
export async function loginStaff(
  page: Page,
  role: keyof typeof STAFF_CREDENTIALS
): Promise<void> {
  const creds = STAFF_CREDENTIALS[role];
  
  await page.goto(URLS.staffPortal);
  await page.waitForLoadState('networkidle');
  
  // Fill login form
  await page.fill('input[name="email"], input[type="email"]', creds.email);
  await page.fill('input[name="password"], input[type="password"]', creds.password);
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Wait for redirect to dashboard
  await page.waitForURL(/\/(dashboard|reception|doctor|lab|pharmacy|nurse)/i, { timeout: 30000 });
  
  // Verify logged in
  await expect(page.locator('body')).not.toContainText('Invalid credentials');
}

/**
 * Login to Patient Portal
 */
export async function loginPatient(page: Page): Promise<void> {
  const creds = PATIENT_CREDENTIALS.patient;
  
  await page.goto(URLS.patientPortal);
  await page.waitForLoadState('networkidle');
  
  // Fill login form
  await page.fill('input[name="email"], input[type="email"]', creds.email);
  await page.fill('input[name="password"], input[type="password"]', creds.password);
  
  // Submit
  await page.click('button[type="submit"]');
  
  // Wait for patient dashboard
  await page.waitForURL(/patient-portal\/(dashboard|home)/i, { timeout: 30000 });
}

/**
 * Logout from current session
 */
export async function logout(page: Page): Promise<void> {
  // Try common logout patterns
  try {
    // Click user menu/avatar
    await page.click('[data-testid="user-menu"], .user-avatar, .profile-menu', { timeout: 5000 });
    await page.click('text=Logout, text=Sign out', { timeout: 3000 });
  } catch {
    // Direct logout URL
    await page.goto('/logout');
  }
  
  await page.waitForURL(/login/i, { timeout: 10000 });
}

/**
 * Take screenshot with descriptive name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ 
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true 
  });
}

/**
 * Wait for toast/notification message
 */
export async function waitForToast(page: Page, expectedText?: string): Promise<string> {
  const toast = page.locator('.toast, .notification, [role="alert"], .Toastify__toast');
  await toast.first().waitFor({ timeout: 10000 });
  
  const text = await toast.first().textContent();
  
  if (expectedText) {
    expect(text).toContain(expectedText);
  }
  
  return text || '';
}

/**
 * Navigate to specific module
 */
export async function navigateTo(page: Page, module: string): Promise<void> {
  const moduleUrls: Record<string, string> = {
    reception: '/reception',
    opd: '/opd',
    laboratory: '/laboratory',
    radiology: '/radiology',
    pharmacy: '/pharmacy',
    billing: '/billing',
    ipd: '/ipd',
  };
  
  const url = moduleUrls[module.toLowerCase()];
  if (url) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
  }
}
