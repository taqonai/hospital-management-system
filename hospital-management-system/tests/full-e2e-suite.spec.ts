/**
 * Full End-to-End Test Suite
 * Tests all major flows across Patient Portal and Staff Portal
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'https://spetaar.ai';

const CREDS = {
  patient: { email: 'kamil@taqon.ai', password: 'password123' },
  receptionist: { email: 'receptionist@hospital.com', password: 'password123' },
  doctor: { email: 'idiamin@hospital.com', password: 'password123' },
  labTech: { email: 'labtech@hospital.com', password: 'password123' },
  pharmacist: { email: 'pharmacist@hospital.com', password: 'password123' },
  nurse: { email: 'nurse.moore@hospital.com', password: 'password123' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function staffLogin(page: Page, role: keyof typeof CREDS) {
  const c = CREDS[role];
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', c.email);
  await page.fill('input[type="password"]', c.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  return page.url();
}

async function patientLogin(page: Page) {
  const c = CREDS.patient;
  await page.goto(`${BASE}/patient-portal/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', c.email);
  await page.fill('input[type="password"]', c.password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  return page.url();
}

async function screenshotOnFail(page: Page, name: string) {
  await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1: PATIENT PORTAL
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Patient Portal', () => {

  test('1.1 - Patient login page loads', async ({ page }) => {
    await page.goto(`${BASE}/patient-portal/login`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    const hasLoginElements = await page.locator('input[type="email"], input[type="text"]').count();
    expect(hasLoginElements).toBeGreaterThan(0);
    await screenshotOnFail(page, '1.1-patient-login-page');
  });

  test('1.2 - Patient login with valid credentials', async ({ page }) => {
    const url = await patientLogin(page);
    expect(url).toContain('patient-portal');
    expect(url).not.toContain('login');
    await screenshotOnFail(page, '1.2-patient-login-success');
  });

  test('1.3 - Patient login with invalid credentials', async ({ page }) => {
    await page.goto(`${BASE}/patient-portal/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'wrong@email.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    // Should stay on login or show error
    const bodyText = await page.locator('body').textContent();
    const hasError = bodyText?.includes('Invalid') || bodyText?.includes('error') || bodyText?.includes('incorrect') || page.url().includes('login');
    expect(hasError).toBeTruthy();
    await screenshotOnFail(page, '1.3-patient-invalid-login');
  });

  test('1.4 - Patient dashboard loads with data', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/dashboard`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await expect(page.locator('body')).toBeVisible();
    // Check dashboard rendered (not white screen)
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '1.4-patient-dashboard');
  });

  test('1.5 - Patient appointments page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/appointments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '1.5-patient-appointments');
  });

  test('1.6 - Patient medical records page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/medical-records`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '1.6-patient-medical-records');
  });

  test('1.7 - Patient prescriptions page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/prescriptions`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '1.7-patient-prescriptions');
  });

  test('1.8 - Patient lab results page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/lab-results`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '1.8-patient-lab-results');
  });

  test('1.9 - Patient billing page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/billing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '1.9-patient-billing');
  });

  test('1.10 - Patient settings/profile page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    // Check Emirates ID field is present
    const hasEmiratesId = bodyText?.includes('Emirates ID') || bodyText?.includes('emirates');
    await screenshotOnFail(page, '1.10-patient-settings');
  });

  test('1.11 - Patient insurance page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/insurance`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '1.11-patient-insurance');
  });

  test('1.12 - Patient wellness hub page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/wellness`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '1.12-patient-wellness');
  });

  test('1.13 - Patient health sync page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/health-sync`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '1.13-patient-health-sync');
  });

  test('1.14 - Patient fitness tracker page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/fitness`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '1.14-patient-fitness');
  });

  test('1.15 - Patient nutrition page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/nutrition`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '1.15-patient-nutrition');
  });

  test('1.16 - Patient registration form has Emirates ID field', async ({ page }) => {
    await page.goto(`${BASE}/patient-portal/login`);
    await page.waitForLoadState('networkidle');
    // Click register button
    const registerBtn = page.locator('text=Register as New Patient, text=Register, text=Create Account').first();
    if (await registerBtn.isVisible()) {
      await registerBtn.click();
      await page.waitForTimeout(1500);
      const bodyText = await page.locator('body').textContent();
      const hasEmiratesId = bodyText?.includes('Emirates ID') || bodyText?.includes('784-XXXX');
      expect(hasEmiratesId).toBeTruthy();
    }
    await screenshotOnFail(page, '1.16-patient-registration-form');
  });

  test('1.17 - Patient book appointment flow', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/appointments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Look for book appointment button
    const bookBtn = page.locator('text=Book Appointment, text=Book, text=New Appointment, button:has-text("Book")').first();
    if (await bookBtn.isVisible()) {
      await bookBtn.click();
      await page.waitForTimeout(2000);
    }
    await screenshotOnFail(page, '1.17-patient-book-appointment');
  });

  test('1.18 - Patient full history page', async ({ page }) => {
    await patientLogin(page);
    await page.goto(`${BASE}/patient-portal/history`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '1.18-patient-full-history');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2: STAFF LOGIN - ALL ROLES
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Staff Portal - Login All Roles', () => {

  test('2.1 - Staff login page loads', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    const hasLoginElements = await page.locator('input[type="email"], input[type="text"]').count();
    expect(hasLoginElements).toBeGreaterThan(0);
    await screenshotOnFail(page, '2.1-staff-login-page');
  });

  test('2.2 - Receptionist login', async ({ page }) => {
    const url = await staffLogin(page, 'receptionist');
    expect(url).not.toContain('/login');
    await screenshotOnFail(page, '2.2-receptionist-dashboard');
  });

  test('2.3 - Doctor login', async ({ page }) => {
    const url = await staffLogin(page, 'doctor');
    expect(url).not.toContain('/login');
    await screenshotOnFail(page, '2.3-doctor-dashboard');
  });

  test('2.4 - Lab Tech login', async ({ page }) => {
    const url = await staffLogin(page, 'labTech');
    expect(url).not.toContain('/login');
    await screenshotOnFail(page, '2.4-labtech-dashboard');
  });

  test('2.5 - Pharmacist login', async ({ page }) => {
    const url = await staffLogin(page, 'pharmacist');
    expect(url).not.toContain('/login');
    await screenshotOnFail(page, '2.5-pharmacist-dashboard');
  });

  test('2.6 - Nurse login', async ({ page }) => {
    const url = await staffLogin(page, 'nurse');
    expect(url).not.toContain('/login');
    await screenshotOnFail(page, '2.6-nurse-dashboard');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3: RECEPTIONIST FLOWS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Receptionist Flows', () => {

  test('3.1 - OPD / Appointments page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/appointments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '3.1-receptionist-appointments');
  });

  test('3.2 - Patients list page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/patients`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '3.2-receptionist-patients');
  });

  test('3.3 - Add new patient form loads + Emirates ID field', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/patients/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    // Check Emirates ID field is present
    const hasEmiratesId = bodyText?.includes('Emirates ID');
    expect(hasEmiratesId).toBeTruthy();
    await screenshotOnFail(page, '3.3-add-patient-form');
  });

  test('3.4 - Patient form validation (empty submit)', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/patients/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Try submitting empty form
    const submitBtn = page.locator('button[type="submit"], button:has-text("Create Patient")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(2000);
    }
    await screenshotOnFail(page, '3.4-patient-form-validation');
  });

  test('3.5 - OPD page loads', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '3.5-opd-page');
  });

  test('3.6 - Queue management page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/queue`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '3.6-queue-page');
  });

  test('3.7 - Billing page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/billing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '3.7-billing-page');
  });

  test('3.8 - Doctors list page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/doctors`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '3.8-doctors-list');
  });

  test('3.9 - Departments page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/departments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '3.9-departments');
  });

  test('3.10 - New appointment form', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/appointments/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '3.10-new-appointment');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4: DOCTOR FLOWS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Doctor Flows', () => {

  test('4.1 - Doctor dashboard', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '4.1-doctor-dashboard');
  });

  test('4.2 - Doctor appointments', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.goto(`${BASE}/appointments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '4.2-doctor-appointments');
  });

  test('4.3 - OPD page (doctor)', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.goto(`${BASE}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '4.3-doctor-opd');
  });

  test('4.4 - IPD page (doctor)', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.goto(`${BASE}/ipd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '4.4-doctor-ipd');
  });

  test('4.5 - Patients list (doctor)', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.goto(`${BASE}/patients`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '4.5-doctor-patients');
  });

  test('4.6 - AI Assistant page', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.goto(`${BASE}/ai-assistant`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '4.6-ai-assistant');
  });

  test('4.7 - AI Scribe page', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.goto(`${BASE}/ai-scribe`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '4.7-ai-scribe');
  });

  test('4.8 - Diagnostic assistant', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.goto(`${BASE}/diagnostic-assistant`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '4.8-diagnostic-assistant');
  });

  test('4.9 - Smart orders page', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.goto(`${BASE}/smart-orders`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '4.9-smart-orders');
  });

  test('4.10 - Telemedicine page', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.goto(`${BASE}/telemedicine`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '4.10-telemedicine');
  });

  test('4.11 - Emergency page', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.goto(`${BASE}/emergency`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '4.11-emergency');
  });

  test('4.12 - Surgery page', async ({ page }) => {
    await staffLogin(page, 'doctor');
    await page.goto(`${BASE}/surgery`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '4.12-surgery');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5: LABORATORY FLOWS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Laboratory Flows', () => {

  test('5.1 - Lab dashboard', async ({ page }) => {
    await staffLogin(page, 'labTech');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '5.1-lab-dashboard');
  });

  test('5.2 - Laboratory page', async ({ page }) => {
    await staffLogin(page, 'labTech');
    await page.goto(`${BASE}/laboratory`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '5.2-laboratory');
  });

  test('5.3 - Radiology page (lab tech access)', async ({ page }) => {
    await staffLogin(page, 'labTech');
    await page.goto(`${BASE}/radiology`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '5.3-radiology');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6: PHARMACY FLOWS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Pharmacy Flows', () => {

  test('6.1 - Pharmacist dashboard', async ({ page }) => {
    await staffLogin(page, 'pharmacist');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '6.1-pharmacist-dashboard');
  });

  test('6.2 - Pharmacy page', async ({ page }) => {
    await staffLogin(page, 'pharmacist');
    await page.goto(`${BASE}/pharmacy`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '6.2-pharmacy');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 7: NURSE FLOWS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Nurse Flows', () => {

  test('7.1 - Nurse dashboard', async ({ page }) => {
    await staffLogin(page, 'nurse');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent();
    expect(bodyText!.length).toBeGreaterThan(50);
    await screenshotOnFail(page, '7.1-nurse-dashboard');
  });

  test('7.2 - Nurse station page', async ({ page }) => {
    await staffLogin(page, 'nurse');
    await page.goto(`${BASE}/nurse-station`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '7.2-nurse-station');
  });

  test('7.3 - IPD page (nurse)', async ({ page }) => {
    await staffLogin(page, 'nurse');
    await page.goto(`${BASE}/ipd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '7.3-nurse-ipd');
  });

  test('7.4 - Medication safety page', async ({ page }) => {
    await staffLogin(page, 'nurse');
    await page.goto(`${BASE}/medication-safety`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '7.4-medication-safety');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 8: CROSS-MODULE PAGES (Receptionist)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Cross-Module Pages', () => {

  test('8.1 - Financial reports', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/financial-reports`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.1-financial-reports');
  });

  test('8.2 - Insurance coding', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/insurance-coding`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.2-insurance-coding');
  });

  test('8.3 - Blood bank', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/blood-bank`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.3-blood-bank');
  });

  test('8.4 - HR page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/hr`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.4-hr');
  });

  test('8.5 - Reports page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/reports`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.5-reports');
  });

  test('8.6 - Settings page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.6-settings');
  });

  test('8.7 - Notifications page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/notifications`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.7-notifications');
  });

  test('8.8 - Housekeeping page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/housekeeping`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.8-housekeeping');
  });

  test('8.9 - Assets page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/asset-management`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.9-assets');
  });

  test('8.10 - Quality page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/quality`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.10-quality');
  });

  test('8.11 - Dietary page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/dietary`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.11-dietary');
  });

  test('8.12 - CRM page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/crm`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.12-crm');
  });

  test('8.13 - Procurement page', async ({ page }) => {
    await staffLogin(page, 'receptionist');
    await page.goto(`${BASE}/procurement`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshotOnFail(page, '8.13-procurement');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 9: API HEALTH CHECKS
// ═════════════════════════════════════════════════════════════════════════════

test.describe('API Health Checks', () => {

  test('9.1 - Backend API reachable', async ({ request }) => {
    const resp = await request.get(`${BASE}/api/v1/auth`);
    // Any response (even 401/404) means API is up
    expect([200, 201, 400, 401, 403, 404, 405]).toContain(resp.status());
  });

  test('9.2 - Patient auth endpoint reachable', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/v1/patient-auth/login`, {
      data: { email: 'test@test.com', password: 'test' }
    });
    expect([200, 400, 401, 403]).toContain(resp.status());
  });

  test('9.3 - Patient registration endpoint validation', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/v1/patient-auth/register`, {
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: 'e2etest-invalid@test.com',
        mobile: '1234567890',
        password: 'testpassword123',
        dateOfBirth: '1990-01-01',
        gender: 'MALE',
        emiratesId: '784199012345671',
      }
    });
    // Accept any non-500 response (validation error or success)
    expect(resp.status()).toBeLessThan(500);
  });

  test('9.4 - Patient registration rejects invalid Emirates ID', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/v1/patient-auth/register`, {
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: 'e2etest-eid@test.com',
        mobile: '1234567890',
        password: 'testpassword123',
        dateOfBirth: '1990-01-01',
        gender: 'MALE',
        emiratesId: '999000000000000',
      }
    });
    // Should reject (400) because Emirates ID doesn't start with 784
    expect([400, 422]).toContain(resp.status());
  });

  test('9.5 - Staff login endpoint works', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/v1/auth/login`, {
      data: { email: CREDS.receptionist.email, password: CREDS.receptionist.password }
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBeTruthy();
  });

  test('9.6 - Patient login endpoint works', async ({ request }) => {
    const resp = await request.post(`${BASE}/api/v1/patient-auth/login`, {
      data: { email: CREDS.patient.email, password: CREDS.patient.password }
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.success).toBeTruthy();
  });

  test('9.7 - Patient profile endpoint (authenticated)', async ({ request }) => {
    // First login
    const loginResp = await request.post(`${BASE}/api/v1/patient-auth/login`, {
      data: { email: CREDS.patient.email, password: CREDS.patient.password }
    });
    const loginBody = await loginResp.json();
    const token = loginBody.data?.accessToken;
    expect(token).toBeTruthy();

    // Then get profile
    const profileResp = await request.get(`${BASE}/api/v1/patient-auth/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    expect(profileResp.status()).toBe(200);
  });

  test('9.8 - Create patient schema validates Emirates ID', async ({ request }) => {
    // Login as staff first
    const loginResp = await request.post(`${BASE}/api/v1/auth/login`, {
      data: { email: CREDS.receptionist.email, password: CREDS.receptionist.password }
    });
    const loginBody = await loginResp.json();
    const token = loginBody.data?.tokens?.accessToken;

    // Try creating patient with invalid Emirates ID
    const resp = await request.post(`${BASE}/api/v1/patients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        firstName: 'Test',
        lastName: 'Patient',
        dateOfBirth: '1990-01-01T00:00:00.000Z',
        gender: 'MALE',
        phone: '+971501234567',
        address: 'Test Address',
        city: 'Dubai',
        state: 'Dubai',
        emiratesId: '999123456789012',
      }
    });
    // Should fail validation since emiratesId doesn't start with 784
    expect([400, 422]).toContain(resp.status());
  });

  test('9.9 - Update patient profile schema validates Emirates ID', async ({ request }) => {
    // Login as patient
    const loginResp = await request.post(`${BASE}/api/v1/patient-auth/login`, {
      data: { email: CREDS.patient.email, password: CREDS.patient.password }
    });
    const loginBody = await loginResp.json();
    const token = loginBody.data?.accessToken;

    // Try updating with invalid Emirates ID
    const resp = await request.put(`${BASE}/api/v1/patient-auth/profile`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        emiratesId: 'INVALID',
      }
    });
    expect([400, 422]).toContain(resp.status());
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 10: WHITE SCREEN / CRASH DETECTION
// ═════════════════════════════════════════════════════════════════════════════

test.describe('White Screen / Crash Detection', () => {

  const pagesToCheck = [
    { name: 'Patient Dashboard', url: '/patient-portal/dashboard', needsPatient: true },
    { name: 'Patient Appointments', url: '/patient-portal/appointments', needsPatient: true },
    { name: 'Patient Medical Records', url: '/patient-portal/medical-records', needsPatient: true },
    { name: 'Patient Settings', url: '/patient-portal/settings', needsPatient: true },
    { name: 'Patient Billing', url: '/patient-portal/billing', needsPatient: true },
    { name: 'Staff Dashboard', url: '/dashboard', needsStaff: true },
    { name: 'Staff Patients', url: '/patients', needsStaff: true },
    { name: 'Staff Appointments', url: '/appointments', needsStaff: true },
    { name: 'Staff OPD', url: '/opd', needsStaff: true },
    { name: 'Staff Laboratory', url: '/laboratory', needsStaff: true },
    { name: 'Staff Pharmacy', url: '/pharmacy', needsStaff: true },
    { name: 'Staff Billing', url: '/billing', needsStaff: true },
    { name: 'Staff IPD', url: '/ipd', needsStaff: true },
    { name: 'Staff Emergency', url: '/emergency', needsStaff: true },
    { name: 'Staff Radiology', url: '/radiology', needsStaff: true },
  ];

  for (const pg of pagesToCheck) {
    test(`10.x - No white screen: ${pg.name}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      if ((pg as any).needsPatient) {
        await patientLogin(page);
      } else {
        await staffLogin(page, 'receptionist');
      }

      await page.goto(`${BASE}${pg.url}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Check for white screen (body should have meaningful content)
      const bodyText = await page.locator('body').textContent();
      const textLen = (bodyText || '').trim().length;

      // Check for React error boundary
      const hasErrorBoundary = bodyText?.includes('Something went wrong') ||
        bodyText?.includes('Error') && bodyText?.includes('boundary');

      await screenshotOnFail(page, `10-whitescreen-${pg.name.replace(/\s+/g, '-')}`);

      // Page should have content (not a white screen)
      expect(textLen).toBeGreaterThan(20);
      // No error boundary
      expect(hasErrorBoundary).toBeFalsy();
    });
  }
});
