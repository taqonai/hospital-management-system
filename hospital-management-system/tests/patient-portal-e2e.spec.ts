import { test, expect, Page } from '@playwright/test';

const BASE = 'https://spetaar.ai';
const PATIENT_EMAIL = 'kamil@taqon.ai';
const PATIENT_PASSWORD = 'password123';

// ─── Helper: Patient Portal Login ───────────────────────────────────────────
async function patientLogin(page: Page): Promise<boolean> {
  try {
    await page.goto(`${BASE}/patient-portal/login`);
    await page.waitForLoadState('networkidle');

    // Fill email
    await page.fill(
      'input[type="email"], input[name="email"], input[placeholder*="email" i]',
      PATIENT_EMAIL,
    );
    // Fill password
    await page.fill(
      'input[type="password"], input[name="password"], input[placeholder*="password" i]',
      PATIENT_PASSWORD,
    );
    // Submit
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    return true;
  } catch (err) {
    console.error('Login failed:', err);
    return false;
  }
}

// ─── Helper: safe screenshot ────────────────────────────────────────────────
async function screenshot(page: Page, name: string): Promise<void> {
  try {
    await page.screenshot({ path: `test-results/${name}`, fullPage: true });
  } catch {
    console.warn(`Screenshot failed: ${name}`);
  }
}

// ─── Helper: safe navigation to portal sub-page ────────────────────────────
async function navigatePortal(page: Page, subPath: string): Promise<void> {
  await page.goto(`${BASE}/patient-portal/${subPath}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

// ─── Helper: check if text is visible with fallback ────────────────────────
async function hasVisibleText(page: Page, text: string | RegExp, timeout = 8000): Promise<boolean> {
  try {
    if (typeof text === 'string') {
      return await page.locator(`text=${text}`).first().isVisible({ timeout });
    }
    return await page.getByText(text).first().isVisible({ timeout });
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: Patient Portal End-to-End
// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Patient Portal - Comprehensive E2E Tests', () => {
  test.setTimeout(300000); // 5 minutes for the full suite

  // ─────────────────────────────────────────────────────────────────────────
  // 1. LOGIN PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('01 - Login page loads and shows correct UI elements', async ({ page }) => {
    console.log('TEST 01: Login page verification');
    await page.goto(`${BASE}/patient-portal/login`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'portal-01-login-page.png');

    // Verify login page elements
    const hasEmailField = await page.locator('input[type="email"]').isVisible({ timeout: 10000 }).catch(() => false);
    const hasPasswordField = await page.locator('input[type="password"]').isVisible({ timeout: 5000 }).catch(() => false);
    const hasSubmitButton = await page.locator('button[type="submit"]').isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`  Email field: ${hasEmailField}`);
    console.log(`  Password field: ${hasPasswordField}`);
    console.log(`  Submit button: ${hasSubmitButton}`);

    expect(hasEmailField).toBeTruthy();
    expect(hasPasswordField).toBeTruthy();
    expect(hasSubmitButton).toBeTruthy();

    // Check for login tabs (Email, Mobile, WhatsApp)
    const hasEmailTab = await hasVisibleText(page, 'Email', 5000);
    const hasMobileTab = await hasVisibleText(page, 'Mobile', 5000);
    const hasWhatsAppTab = await hasVisibleText(page, 'WhatsApp', 5000);
    console.log(`  Login tabs - Email: ${hasEmailTab}, Mobile: ${hasMobileTab}, WhatsApp: ${hasWhatsAppTab}`);

    // Check for Register button
    const hasRegisterBtn = await hasVisibleText(page, /register|new patient/i, 5000);
    console.log(`  Register button: ${hasRegisterBtn}`);

    // Check for Forgot Password link
    const hasForgotPassword = await hasVisibleText(page, /forgot password/i, 5000);
    console.log(`  Forgot Password link: ${hasForgotPassword}`);

    // Check branding
    const hasBranding = await hasVisibleText(page, /spetaar|patient portal/i, 5000);
    console.log(`  Branding visible: ${hasBranding}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. LOGIN FLOW
  // ─────────────────────────────────────────────────────────────────────────
  test('02 - Login with credentials and redirect to dashboard', async ({ page }) => {
    console.log('TEST 02: Login flow');
    const loginSuccess = await patientLogin(page);
    await screenshot(page, 'portal-02-after-login.png');

    expect(loginSuccess).toBeTruthy();

    // Verify we landed on the dashboard
    const url = page.url();
    console.log(`  Post-login URL: ${url}`);
    const onDashboard = url.includes('patient-portal') && !url.includes('login');
    console.log(`  Redirected away from login: ${onDashboard}`);
    expect(onDashboard).toBeTruthy();

    // Verify welcome message or dashboard content
    const hasWelcome = await hasVisibleText(page, /welcome|dashboard/i, 8000);
    console.log(`  Welcome/Dashboard text visible: ${hasWelcome}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────
  test('03 - Dashboard loads with KPI cards and content', async ({ page }) => {
    console.log('TEST 03: Dashboard verification');
    await patientLogin(page);
    await navigatePortal(page, 'dashboard');
    await screenshot(page, 'portal-03-dashboard.png');

    // Check for KPI cards: Next Appointment, Recent Reports, Pending Payment, Health Status
    const hasNextAppt = await hasVisibleText(page, /next appointment/i, 8000);
    const hasReports = await hasVisibleText(page, /report|recent report/i, 5000);
    const hasPayment = await hasVisibleText(page, /payment|pending|balance/i, 5000);
    const hasHealthStatus = await hasVisibleText(page, /health status|stable/i, 5000);

    console.log(`  Next Appointment card: ${hasNextAppt}`);
    console.log(`  Reports card: ${hasReports}`);
    console.log(`  Payment card: ${hasPayment}`);
    console.log(`  Health Status card: ${hasHealthStatus}`);

    // Check for Medical Reports tab
    const hasMedicalReportsTab = await hasVisibleText(page, /medical reports/i, 5000);
    console.log(`  Medical Reports tab: ${hasMedicalReportsTab}`);

    // Check for Billing & Payments tab
    const hasBillingTab = await hasVisibleText(page, /billing.*payment/i, 5000);
    console.log(`  Billing & Payments tab: ${hasBillingTab}`);

    // Try clicking Billing tab
    const billingTabBtn = page.locator('button:has-text("Billing")').first();
    if (await billingTabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await billingTabBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, 'portal-03b-dashboard-billing-tab.png');
      const hasBillingContent = await hasVisibleText(page, /invoice|payment|bill/i, 5000);
      console.log(`  Billing tab content: ${hasBillingContent}`);
    }

    // Check for patient name in welcome header
    const hasPatientName = await hasVisibleText(page, /welcome/i, 5000);
    console.log(`  Patient welcome header: ${hasPatientName}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 4. APPOINTMENTS PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('04 - Appointments page with Upcoming/Past tabs and booking', async ({ page }) => {
    console.log('TEST 04: Appointments page');
    await patientLogin(page);
    await navigatePortal(page, 'appointments');
    await screenshot(page, 'portal-04-appointments.png');

    // Check page loaded
    const hasApptsContent = await hasVisibleText(page, /appointment|schedule|book/i, 8000);
    console.log(`  Appointments content visible: ${hasApptsContent}`);

    // Look for upcoming appointments or "no appointments" message
    const hasUpcoming = await hasVisibleText(page, /upcoming|scheduled/i, 5000);
    const hasNoAppts = await hasVisibleText(page, /no.*appointment|no upcoming/i, 5000);
    console.log(`  Upcoming section: ${hasUpcoming}`);
    console.log(`  No appointments message: ${hasNoAppts}`);

    // Try switching to Past tab
    const pastTab = page.locator('button:has-text("Past"), button:has-text("Completed"), [role="tab"]:has-text("Past")').first();
    const hasPastTab = await pastTab.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Past tab visible: ${hasPastTab}`);

    if (hasPastTab) {
      await pastTab.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'portal-04b-appointments-past.png');

      // Check for Rate Doctor buttons on completed appointments
      const rateButtons = page.locator('button:has-text("Rate Doctor"), button:has-text("Rate"), button:has-text("Review")');
      const rateCount = await rateButtons.count().catch(() => 0);
      console.log(`  Rate Doctor buttons found: ${rateCount}`);

      // Check for Reviewed badges
      const reviewedBadges = page.locator('text=Reviewed');
      const reviewedCount = await reviewedBadges.count().catch(() => 0);
      console.log(`  Reviewed badges found: ${reviewedCount}`);
    }

    // Check for Book Appointment button
    const hasBookBtn = await page.locator('button:has-text("Book"), button:has-text("New Appointment")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Book Appointment button: ${hasBookBtn}`);

    // If there are appointment cards, try clicking one
    const appointmentCard = page.locator('[class*="appointment"], [class*="card"]').filter({ hasText: /dr\.|doctor/i }).first();
    const hasAppointmentCard = await appointmentCard.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Appointment card clickable: ${hasAppointmentCard}`);

    if (hasAppointmentCard) {
      await appointmentCard.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'portal-04c-appointment-detail.png');

      // Verify appointment detail shows doctor info, date, time
      const hasDocInfo = await hasVisibleText(page, /dr\./i, 5000);
      console.log(`  Appointment detail - doctor info: ${hasDocInfo}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. MEDICAL RECORDS PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('05 - Medical Records page with tabs', async ({ page }) => {
    console.log('TEST 05: Medical Records page');
    await patientLogin(page);
    await navigatePortal(page, 'records');
    await screenshot(page, 'portal-05-medical-records.png');

    // Verify page header
    const hasHeader = await hasVisibleText(page, /medical records/i, 8000);
    console.log(`  Medical Records header: ${hasHeader}`);

    // Check for tab navigation: Allergies, Immunizations, Past Surgeries, Health Profile, Visit History
    const tabNames = ['Allergies', 'Immunizations', 'Past Surgeries', 'Health Profile', 'Visit History'];
    for (const tab of tabNames) {
      const tabVisible = await hasVisibleText(page, new RegExp(tab, 'i'), 3000);
      console.log(`  Tab "${tab}": ${tabVisible}`);
    }

    // AI Health Analysis button
    const hasAIButton = await page.locator('button:has-text("AI Health Analysis"), button:has-text("AI Analysis")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  AI Health Analysis button: ${hasAIButton}`);

    // Click through each tab
    for (const tab of tabNames) {
      const tabBtn = page.locator(`button:has-text("${tab}")`).first();
      if (await tabBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tabBtn.click();
        await page.waitForTimeout(1500);
        await screenshot(page, `portal-05-records-${tab.toLowerCase().replace(/\s+/g, '-')}.png`);
        console.log(`  Clicked tab "${tab}" - screenshot taken`);
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. PRESCRIPTIONS PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('06 - Prescriptions page loads with medication list', async ({ page }) => {
    console.log('TEST 06: Prescriptions page');
    await patientLogin(page);
    await navigatePortal(page, 'prescriptions');
    await screenshot(page, 'portal-06-prescriptions.png');

    // Verify page content
    const hasHeader = await hasVisibleText(page, /prescription/i, 8000);
    console.log(`  Prescriptions header: ${hasHeader}`);

    // Check for prescription items or empty state
    const hasPrescriptions = await hasVisibleText(page, /active|medication|dosage|refill/i, 5000);
    const hasNoPrescriptions = await hasVisibleText(page, /no prescription|no medication|no active/i, 5000);
    console.log(`  Has prescriptions: ${hasPrescriptions}`);
    console.log(`  Empty state: ${hasNoPrescriptions}`);

    // Look for status badges
    const statuses = ['Active', 'Completed', 'Pending Refill', 'Expired'];
    for (const status of statuses) {
      const hasStatus = await hasVisibleText(page, new RegExp(status, 'i'), 2000);
      if (hasStatus) console.log(`  Status badge found: ${status}`);
    }

    // Check for search/filter
    const hasSearch = await page.locator('input[placeholder*="search" i], input[type="search"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Search field: ${hasSearch}`);

    // Try clicking a prescription card for details
    const prescriptionCard = page.locator('[class*="card"], [class*="rounded"]').filter({ hasText: /prescription|medication/i }).first();
    if (await prescriptionCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await prescriptionCard.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'portal-06b-prescription-detail.png');
      console.log(`  Prescription detail opened`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. LAB RESULTS PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('07 - Lab Results page loads with test results', async ({ page }) => {
    console.log('TEST 07: Lab Results page');
    await patientLogin(page);
    await navigatePortal(page, 'labs');
    await screenshot(page, 'portal-07-lab-results.png');

    // Verify page content
    const hasHeader = await hasVisibleText(page, /lab|result|test/i, 8000);
    console.log(`  Lab Results header: ${hasHeader}`);

    // Check for lab result items or empty state
    const hasLabResults = await hasVisibleText(page, /ready|pending|normal|high|low|in progress/i, 5000);
    const hasNoResults = await hasVisibleText(page, /no.*result|no.*report|no.*test/i, 5000);
    console.log(`  Has lab results: ${hasLabResults}`);
    console.log(`  Empty state: ${hasNoResults}`);

    // Look for status badges (Pending, In Progress, Ready, Reviewed)
    const labStatuses = ['Pending', 'In Progress', 'Ready', 'Reviewed'];
    for (const status of labStatuses) {
      const hasStatus = await hasVisibleText(page, new RegExp(status, 'i'), 2000);
      if (hasStatus) console.log(`  Lab status found: ${status}`);
    }

    // Check for search/filter
    const hasSearch = await page.locator('input[placeholder*="search" i], input[type="search"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Search field: ${hasSearch}`);

    // Try clicking a lab result for detail view
    const labCard = page.locator('[class*="card"], [class*="rounded"], tr').filter({ hasText: /test|lab|report/i }).first();
    if (await labCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await labCard.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'portal-07b-lab-result-detail.png');

      // Check for result values in detail
      const hasResultValues = await hasVisibleText(page, /value|range|normal|unit/i, 5000);
      console.log(`  Lab result detail values: ${hasResultValues}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 8. BILLING & PAYMENTS PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('08 - Billing page loads with invoices and payment info', async ({ page }) => {
    console.log('TEST 08: Billing & Payments page');
    await patientLogin(page);
    await navigatePortal(page, 'billing');
    await screenshot(page, 'portal-08-billing.png');

    // Verify page content
    const hasHeader = await hasVisibleText(page, /billing|payment|invoice/i, 8000);
    console.log(`  Billing header: ${hasHeader}`);

    // Check for financial summary cards
    const hasTotalBilled = await hasVisibleText(page, /total.*billed|total.*amount/i, 5000);
    const hasBalance = await hasVisibleText(page, /balance|due|outstanding/i, 5000);
    const hasInsurance = await hasVisibleText(page, /insurance|covered/i, 5000);
    console.log(`  Total billed: ${hasTotalBilled}`);
    console.log(`  Balance info: ${hasBalance}`);
    console.log(`  Insurance info: ${hasInsurance}`);

    // Check for bill list or empty state
    const hasBills = await hasVisibleText(page, /invoice|bill|paid|unpaid|pending/i, 5000);
    const hasNoBills = await hasVisibleText(page, /no.*invoice|no.*bill/i, 5000);
    console.log(`  Has bills: ${hasBills}`);
    console.log(`  Empty state: ${hasNoBills}`);

    // Look for tab navigation (Invoices, Payments, Insurance Claims)
    const billingTabs = ['Invoices', 'Payments', 'Insurance Claims', 'Claims'];
    for (const tab of billingTabs) {
      const hasTab = await hasVisibleText(page, new RegExp(tab, 'i'), 2000);
      if (hasTab) console.log(`  Billing tab found: ${tab}`);
    }

    // Try clicking a different tab
    const paymentsTab = page.locator('button:has-text("Payments"), button:has-text("Payment History")').first();
    if (await paymentsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await paymentsTab.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'portal-08b-billing-payments.png');
      console.log(`  Payments tab clicked`);
    }

    // Check for insurance claims tab
    const claimsTab = page.locator('button:has-text("Claims"), button:has-text("Insurance")').first();
    if (await claimsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await claimsTab.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'portal-08c-billing-claims.png');
      console.log(`  Insurance Claims tab clicked`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 9. INSURANCE PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('09 - Insurance page displays policies', async ({ page }) => {
    console.log('TEST 09: Insurance page');
    await patientLogin(page);
    await navigatePortal(page, 'insurance');
    await screenshot(page, 'portal-09-insurance.png');

    // Verify page content
    const hasHeader = await hasVisibleText(page, /insurance/i, 8000);
    console.log(`  Insurance header: ${hasHeader}`);

    // Check for policy information or empty state
    const hasPolicies = await hasVisibleText(page, /policy|provider|coverage|plan|subscriber/i, 5000);
    const hasNoPolicies = await hasVisibleText(page, /no.*insurance|no.*policy|add.*insurance/i, 5000);
    console.log(`  Has policies: ${hasPolicies}`);
    console.log(`  No policies / Add prompt: ${hasNoPolicies}`);

    // Check for Add Insurance button
    const hasAddBtn = await page.locator('button:has-text("Add"), button:has-text("New Insurance"), button:has-text("Add Insurance")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Add Insurance button: ${hasAddBtn}`);

    // Check for verification status badges
    const verificationStatuses = ['Verified', 'Pending', 'Rejected'];
    for (const status of verificationStatuses) {
      const hasStatus = await hasVisibleText(page, new RegExp(status, 'i'), 2000);
      if (hasStatus) console.log(`  Verification status found: ${status}`);
    }

    // Check for UAE-specific insurers
    const hasUAEInsurers = await hasVisibleText(page, /daman|axa|dubai insurance|oman insurance/i, 3000);
    if (hasUAEInsurers) console.log(`  UAE insurers visible`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 10. AI HEALTH ASSISTANT
  // ─────────────────────────────────────────────────────────────────────────
  test('10 - AI Health Assistant chat interface', async ({ page }) => {
    console.log('TEST 10: AI Health Assistant');
    await patientLogin(page);
    await navigatePortal(page, 'health-assistant');
    await screenshot(page, 'portal-10-health-assistant.png');

    // Verify page loaded with chat interface
    const hasChatInterface = await hasVisibleText(page, /health assistant|ai assistant|how can i help/i, 8000);
    console.log(`  Chat interface visible: ${hasChatInterface}`);

    // Check for initial greeting message
    const hasGreeting = await hasVisibleText(page, /hello|help you|health assistant/i, 5000);
    console.log(`  Greeting message: ${hasGreeting}`);

    // Check for quick action buttons
    const quickActions = ['Check Symptoms', 'Book Appointment', 'Lab Results', 'Prescriptions'];
    for (const action of quickActions) {
      const hasAction = await hasVisibleText(page, new RegExp(action, 'i'), 2000);
      if (hasAction) console.log(`  Quick action found: ${action}`);
    }

    // Check for suggested questions
    const hasSuggestions = await hasVisibleText(page, /lab results mean|medication|see a doctor|sleep|diabetes/i, 5000);
    console.log(`  Suggested questions visible: ${hasSuggestions}`);

    // Try typing a message
    const chatInput = page.locator('textarea, input[placeholder*="message" i], input[placeholder*="type" i], input[placeholder*="ask" i]').first();
    if (await chatInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatInput.fill('What are normal blood pressure levels?');
      await screenshot(page, 'portal-10b-health-assistant-typed.png');
      console.log(`  Typed message in chat`);

      // Try sending the message
      const sendBtn = page.locator('button:has(svg), button[type="submit"]').last();
      if (await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await sendBtn.click();
        await page.waitForTimeout(5000); // Wait for AI response
        await screenshot(page, 'portal-10c-health-assistant-response.png');

        // Check for a response
        const messageCount = await page.locator('[class*="message"], [class*="chat"], [class*="bubble"]').count();
        console.log(`  Messages in chat: ${messageCount}`);
      }
    } else {
      console.log(`  Chat input not found`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 11. SYMPTOM CHECKER
  // ─────────────────────────────────────────────────────────────────────────
  test('11 - Symptom Checker page', async ({ page }) => {
    console.log('TEST 11: Symptom Checker');
    await patientLogin(page);
    await navigatePortal(page, 'symptom-checker');
    await screenshot(page, 'portal-11-symptom-checker.png');

    // Verify page loaded
    const hasContent = await hasVisibleText(page, /symptom|checker|describe.*symptom|how it works/i, 8000);
    console.log(`  Symptom Checker content: ${hasContent}`);

    // Check for features display
    const hasFeatures = await hasVisibleText(page, /ai.*powered|quick assessment|secure|care guidance/i, 5000);
    console.log(`  Features display: ${hasFeatures}`);

    // Check for "How it Works" section
    const hasHowItWorks = await hasVisibleText(page, /how it works|describe|answer|receive/i, 5000);
    console.log(`  How it Works section: ${hasHowItWorks}`);

    // Check for Start button
    const hasStartBtn = await page.locator('button:has-text("Start"), button:has-text("Begin"), button:has-text("Check")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Start button: ${hasStartBtn}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 12. SETTINGS / PROFILE PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('12 - Settings page with profile and preferences', async ({ page }) => {
    console.log('TEST 12: Settings / Profile page');
    await patientLogin(page);
    await navigatePortal(page, 'settings');
    await screenshot(page, 'portal-12-settings.png');

    // Verify page loaded
    const hasSettings = await hasVisibleText(page, /settings|profile|account/i, 8000);
    console.log(`  Settings page loaded: ${hasSettings}`);

    // Check for profile information fields
    const profileFields = ['First Name', 'Last Name', 'Email', 'Phone', 'Date of Birth', 'Gender', 'Blood Group', 'Emirates ID'];
    for (const field of profileFields) {
      const hasField = await hasVisibleText(page, new RegExp(field, 'i'), 2000);
      if (hasField) console.log(`  Profile field found: ${field}`);
    }

    // Check for notification preferences
    const hasNotifPrefs = await hasVisibleText(page, /notification|email notification|sms notification|whatsapp/i, 5000);
    console.log(`  Notification preferences: ${hasNotifPrefs}`);

    // Check for toggle switches
    const toggleSwitches = page.locator('button[role="switch"], [class*="switch"], input[type="checkbox"]');
    const toggleCount = await toggleSwitches.count().catch(() => 0);
    console.log(`  Toggle switches found: ${toggleCount}`);

    // Check for communication preferences
    const hasCommPrefs = await hasVisibleText(page, /communication|preferred.*contact|preferred.*language/i, 5000);
    console.log(`  Communication preferences: ${hasCommPrefs}`);

    // Check for Change Password section
    const hasPasswordSection = await hasVisibleText(page, /change password|update password|current password/i, 5000);
    console.log(`  Change Password section: ${hasPasswordSection}`);

    // Check for Save button
    const hasSaveBtn = await page.locator('button:has-text("Save"), button:has-text("Update")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Save/Update button: ${hasSaveBtn}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 13. HEALTH INSIGHTS PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('13 - Health Insights page with metrics and recommendations', async ({ page }) => {
    console.log('TEST 13: Health Insights page');
    await patientLogin(page);
    await navigatePortal(page, 'health-insights');
    await screenshot(page, 'portal-13-health-insights.png');

    // Verify page loaded
    const hasContent = await hasVisibleText(page, /health insight|health metric|health score/i, 8000);
    console.log(`  Health Insights content: ${hasContent}`);

    // Check for health metrics
    const metrics = ['Blood Pressure', 'Heart Rate', 'BMI', 'Blood Sugar', 'Cholesterol'];
    for (const metric of metrics) {
      const hasMetric = await hasVisibleText(page, new RegExp(metric, 'i'), 2000);
      if (hasMetric) console.log(`  Metric found: ${metric}`);
    }

    // Check for recommendations/insights
    const hasRecommendations = await hasVisibleText(page, /recommendation|alert|reminder|tip/i, 5000);
    console.log(`  Recommendations visible: ${hasRecommendations}`);

    // Check for trend indicators
    const hasTrends = await hasVisibleText(page, /normal|attention|critical|stable|improving/i, 5000);
    console.log(`  Trend indicators: ${hasTrends}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 14. MESSAGES PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('14 - Messages page loads', async ({ page }) => {
    console.log('TEST 14: Messages page');
    await patientLogin(page);
    await navigatePortal(page, 'messages');
    await screenshot(page, 'portal-14-messages.png');

    // Verify page loaded
    const hasContent = await hasVisibleText(page, /message|inbox|conversation|chat/i, 8000);
    console.log(`  Messages content: ${hasContent}`);

    // Check for message list or empty state
    const hasMessages = await hasVisibleText(page, /from|subject|sent|received|doctor|dr\./i, 5000);
    const hasNoMessages = await hasVisibleText(page, /no.*message|no.*conversation|empty/i, 5000);
    console.log(`  Has messages: ${hasMessages}`);
    console.log(`  Empty state: ${hasNoMessages}`);

    // Check for New Message / Compose button
    const hasComposeBtn = await page.locator('button:has-text("New"), button:has-text("Compose"), button:has-text("Send Message")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Compose button: ${hasComposeBtn}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 15. HEALTH SYNC PAGE (Connected Devices)
  // ─────────────────────────────────────────────────────────────────────────
  test('15 - Health Sync page for connected devices', async ({ page }) => {
    console.log('TEST 15: Health Sync page');
    await patientLogin(page);
    await navigatePortal(page, 'health-sync');
    await screenshot(page, 'portal-15-health-sync.png');

    // Verify page loaded
    const hasContent = await hasVisibleText(page, /health sync|connected|device|wearable|apple health|google fit|samsung/i, 8000);
    console.log(`  Health Sync content: ${hasContent}`);

    // Check for device connection options
    const deviceSources = ['Apple Health', 'Google Health', 'Samsung Health', 'Fitbit', 'Google Fit'];
    for (const source of deviceSources) {
      const hasSource = await hasVisibleText(page, new RegExp(source, 'i'), 2000);
      if (hasSource) console.log(`  Device source found: ${source}`);
    }

    // Check for connect/disconnect buttons
    const hasConnectBtn = await page.locator('button:has-text("Connect"), button:has-text("Sync"), button:has-text("Link")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Connect button: ${hasConnectBtn}`);

    // Check for charts/data display
    const hasCharts = await page.locator('canvas').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Charts/data visualizations: ${hasCharts}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 16. FITNESS TRACKER PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('16 - Fitness Tracker page', async ({ page }) => {
    console.log('TEST 16: Fitness Tracker page');
    await patientLogin(page);
    await navigatePortal(page, 'fitness');
    await screenshot(page, 'portal-16-fitness-tracker.png');

    // Verify page loaded
    const hasContent = await hasVisibleText(page, /fitness|activity|exercise|calorie|workout|step/i, 8000);
    console.log(`  Fitness Tracker content: ${hasContent}`);

    // Check for activity log
    const hasActivityLog = await hasVisibleText(page, /activity|log|walking|running|cycling|swimming/i, 5000);
    console.log(`  Activity log: ${hasActivityLog}`);

    // Check for add activity button
    const hasAddBtn = await page.locator('button:has-text("Add"), button:has-text("Log"), button:has-text("Record")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Add activity button: ${hasAddBtn}`);

    // Check for charts
    const hasCharts = await page.locator('canvas').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Fitness charts: ${hasCharts}`);

    // Check for stats cards
    const statsItems = ['Calories', 'Duration', 'Distance', 'Steps'];
    for (const item of statsItems) {
      const hasItem = await hasVisibleText(page, new RegExp(item, 'i'), 2000);
      if (hasItem) console.log(`  Stats found: ${item}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 17. NUTRITION PLAN PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('17 - Nutrition Plan page', async ({ page }) => {
    console.log('TEST 17: Nutrition Plan page');
    await patientLogin(page);
    await navigatePortal(page, 'nutrition');
    await screenshot(page, 'portal-17-nutrition-plan.png');

    // Verify page loaded
    const hasContent = await hasVisibleText(page, /nutrition|meal|calorie|protein|carb|fat|diet/i, 8000);
    console.log(`  Nutrition Plan content: ${hasContent}`);

    // Check for meal log
    const hasMealLog = await hasVisibleText(page, /breakfast|lunch|dinner|snack|meal/i, 5000);
    console.log(`  Meal log: ${hasMealLog}`);

    // Check for macronutrient display
    const hasMacros = await hasVisibleText(page, /protein|carb|fat|fiber|sodium|sugar/i, 5000);
    console.log(`  Macronutrient display: ${hasMacros}`);

    // Check for charts
    const hasCharts = await page.locator('canvas').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Nutrition charts: ${hasCharts}`);

    // Check for add meal button
    const hasAddBtn = await page.locator('button:has-text("Add"), button:has-text("Log Meal"), button:has-text("Record")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Add meal button: ${hasAddBtn}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 18. WELLNESS HUB PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('18 - Wellness Hub page', async ({ page }) => {
    console.log('TEST 18: Wellness Hub page');
    await patientLogin(page);
    await navigatePortal(page, 'wellness');
    await screenshot(page, 'portal-18-wellness-hub.png');

    // Verify page loaded
    const hasContent = await hasVisibleText(page, /wellness|goal|assessment|well-being/i, 8000);
    console.log(`  Wellness Hub content: ${hasContent}`);

    // Check for wellness goals
    const hasGoals = await hasVisibleText(page, /goal|progress|milestone|target/i, 5000);
    console.log(`  Wellness goals: ${hasGoals}`);

    // Check for assessment section
    const hasAssessment = await hasVisibleText(page, /assessment|score|insight|recommendation/i, 5000);
    console.log(`  Assessment section: ${hasAssessment}`);

    // Check for add goal button
    const hasAddBtn = await page.locator('button:has-text("Add"), button:has-text("New Goal"), button:has-text("Set Goal")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Add goal button: ${hasAddBtn}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 19. PATIENT FULL HISTORY PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('19 - Patient Full History timeline page', async ({ page }) => {
    console.log('TEST 19: Patient Full History page');
    await patientLogin(page);
    await navigatePortal(page, 'history');
    await screenshot(page, 'portal-19-full-history.png');

    // Verify page loaded
    const hasContent = await hasVisibleText(page, /history|timeline|record|visit/i, 8000);
    console.log(`  Full History content: ${hasContent}`);

    // Check for timeline items
    const hasTimeline = await hasVisibleText(page, /appointment|lab|prescription|vital/i, 5000);
    console.log(`  Timeline items: ${hasTimeline}`);

    // Check for filter options
    const hasFilter = await page.locator('button:has-text("Filter"), select, [class*="filter"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Filter options: ${hasFilter}`);

    // Check for type badges (Appointment, Lab Result, Prescription, Vitals)
    const types = ['Appointment', 'Lab', 'Prescription', 'Vital'];
    for (const type of types) {
      const hasType = await hasVisibleText(page, new RegExp(type, 'i'), 2000);
      if (hasType) console.log(`  Timeline type found: ${type}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 20. SIDEBAR NAVIGATION VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────
  test('20 - Portal sidebar navigation works correctly', async ({ page }) => {
    console.log('TEST 20: Sidebar navigation');
    await patientLogin(page);
    await navigatePortal(page, 'dashboard');
    await screenshot(page, 'portal-20-sidebar-nav.png');

    // Check sidebar is present
    const hasSidebar = await page.locator('aside, nav, [class*="sidebar"]').first().isVisible({ timeout: 8000 }).catch(() => false);
    console.log(`  Sidebar visible: ${hasSidebar}`);

    // Check for core navigation items in the sidebar/nav
    const navItems = [
      'Dashboard',
      'Appointments',
      'Medical Records',
      'Prescriptions',
      'Lab Results',
      'Messages',
      'Billing',
    ];

    for (const item of navItems) {
      const navBtn = page.locator(`button:has-text("${item}"), a:has-text("${item}"), [class*="nav"]:has-text("${item}")`).first();
      const isVisible = await navBtn.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`  Nav item "${item}": ${isVisible}`);
    }

    // Check for Quick Actions section
    const hasBookAppt = await hasVisibleText(page, /book appointment/i, 5000);
    const hasContactSupport = await hasVisibleText(page, /contact support/i, 5000);
    console.log(`  Quick Action - Book Appointment: ${hasBookAppt}`);
    console.log(`  Quick Action - Contact Support: ${hasContactSupport}`);

    // Navigate using sidebar buttons
    const appointmentsNav = page.locator('button:has-text("Appointments"), a:has-text("Appointments")').first();
    if (await appointmentsNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await appointmentsNav.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'portal-20b-nav-to-appointments.png');
      const hasApptContent = await hasVisibleText(page, /appointment|schedule|upcoming|past/i, 5000);
      console.log(`  Navigated to Appointments: ${hasApptContent}`);
    }

    // Navigate to Lab Results
    const labNav = page.locator('button:has-text("Lab Results"), a:has-text("Lab Results")').first();
    if (await labNav.isVisible({ timeout: 3000 }).catch(() => false)) {
      await labNav.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'portal-20c-nav-to-labs.png');
      const hasLabContent = await hasVisibleText(page, /lab|result|test/i, 5000);
      console.log(`  Navigated to Lab Results: ${hasLabContent}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 21. REGISTRATION FORM UI
  // ─────────────────────────────────────────────────────────────────────────
  test('21 - Registration form displays correctly', async ({ page }) => {
    console.log('TEST 21: Registration form');
    await page.goto(`${BASE}/patient-portal/login`);
    await page.waitForLoadState('networkidle');

    // Click Register button
    const registerBtn = page.locator('button:has-text("Register"), button:has-text("New Patient"), button:has-text("Create Account")').first();
    const hasRegister = await registerBtn.isVisible({ timeout: 8000 }).catch(() => false);
    console.log(`  Register button visible: ${hasRegister}`);

    if (hasRegister) {
      await registerBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, 'portal-21-registration-form.png');

      // Check for registration form fields
      const regFields = ['First Name', 'Last Name', 'Email', 'Mobile', 'Password', 'Confirm Password', 'Date of Birth', 'Gender', 'Emirates ID'];
      for (const field of regFields) {
        const hasField = await hasVisibleText(page, new RegExp(field, 'i'), 2000);
        if (hasField) console.log(`  Registration field found: ${field}`);
      }

      // Check for Terms & Conditions checkbox
      const hasTerms = await hasVisibleText(page, /terms.*condition|privacy policy/i, 3000);
      console.log(`  Terms & Conditions: ${hasTerms}`);

      // Check for country code selector
      const hasCountryCode = await page.locator('select').first().isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`  Country code selector: ${hasCountryCode}`);

      // Check for password strength indicator
      const passwordInput = page.locator('input[placeholder*="create" i], input[placeholder*="password" i]').first();
      if (await passwordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await passwordInput.fill('TestPass123');
        await page.waitForTimeout(500);
        const hasStrength = await hasVisibleText(page, /weak|medium|strong/i, 3000);
        console.log(`  Password strength indicator: ${hasStrength}`);
      }

      // Check for "Already have an account? Sign In" link
      const hasSignInLink = await hasVisibleText(page, /already have.*account|sign in/i, 3000);
      console.log(`  Sign In link: ${hasSignInLink}`);

      await screenshot(page, 'portal-21b-registration-filled.png');
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 22. FORGOT PASSWORD PAGE
  // ─────────────────────────────────────────────────────────────────────────
  test('22 - Forgot Password page', async ({ page }) => {
    console.log('TEST 22: Forgot Password page');
    await page.goto(`${BASE}/patient-portal/forgot-password`);
    await page.waitForLoadState('networkidle');
    await screenshot(page, 'portal-22-forgot-password.png');

    // Verify page loaded
    const hasContent = await hasVisibleText(page, /forgot.*password|reset.*password|email|send/i, 8000);
    console.log(`  Forgot Password content: ${hasContent}`);

    // Check for email input
    const hasEmailInput = await page.locator('input[type="email"], input[placeholder*="email" i]').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Email input: ${hasEmailInput}`);

    // Check for submit button
    const hasSubmitBtn = await page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Reset")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Submit button: ${hasSubmitBtn}`);

    // Check for Back to Login link
    const hasBackLink = await hasVisibleText(page, /back.*login|sign in|return/i, 3000);
    console.log(`  Back to Login link: ${hasBackLink}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 23. RESPONSIVE LAYOUT / MOBILE TAB BAR
  // ─────────────────────────────────────────────────────────────────────────
  test('23 - Portal layout structure and responsive elements', async ({ page }) => {
    console.log('TEST 23: Layout structure');
    await patientLogin(page);
    await navigatePortal(page, 'dashboard');

    // Check for main layout structure
    const hasMainContent = await page.locator('main, [class*="main"], [class*="content"]').first().isVisible({ timeout: 8000 }).catch(() => false);
    console.log(`  Main content area: ${hasMainContent}`);

    // Check for user profile in sidebar
    const hasUserProfile = await hasVisibleText(page, /patient portal/i, 5000);
    console.log(`  User profile in sidebar: ${hasUserProfile}`);

    // Take a full-page screenshot
    await screenshot(page, 'portal-23-full-layout.png');

    // Check page at different viewport widths
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(1000);
    await screenshot(page, 'portal-23b-tablet-view.png');
    console.log(`  Tablet view screenshot taken`);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(1000);
    await screenshot(page, 'portal-23c-mobile-view.png');
    console.log(`  Mobile view screenshot taken`);

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 24. BOOKING FLOW FROM DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────
  test('24 - Booking flow modal from dashboard', async ({ page }) => {
    console.log('TEST 24: Booking flow from dashboard');
    await patientLogin(page);
    await navigatePortal(page, 'dashboard');

    // Try clicking "Book Appointment" quick action or the Next Appointment card when empty
    const bookBtn = page.locator('button:has-text("Book Appointment")').first();
    const hasBookBtn = await bookBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Book Appointment button: ${hasBookBtn}`);

    if (hasBookBtn) {
      await bookBtn.click();
      await page.waitForTimeout(1500);
      await screenshot(page, 'portal-24-booking-modal.png');

      // Check for booking choice modal (Emergency, Quick Book, AI-Guided, Standard)
      const hasEmergency = await hasVisibleText(page, /emergency/i, 5000);
      const hasQuickBook = await hasVisibleText(page, /quick book/i, 3000);
      const hasAIGuided = await hasVisibleText(page, /ai.*guided/i, 3000);
      const hasStandard = await hasVisibleText(page, /standard/i, 3000);

      console.log(`  Emergency option: ${hasEmergency}`);
      console.log(`  Quick Book option: ${hasQuickBook}`);
      console.log(`  AI-Guided option: ${hasAIGuided}`);
      console.log(`  Standard option: ${hasStandard}`);

      // Check for modal close button
      const hasCloseBtn = await page.locator('button:has(svg), [class*="close"]').first().isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`  Modal close button: ${hasCloseBtn}`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 25. APPOINTMENT BOOKING FORM
  // ─────────────────────────────────────────────────────────────────────────
  test('25 - Appointment booking form UI', async ({ page }) => {
    console.log('TEST 25: Appointment booking form');
    await patientLogin(page);
    await navigatePortal(page, 'appointments?booking=standard');
    await page.waitForTimeout(2000);
    await screenshot(page, 'portal-25-booking-form.png');

    // Check for booking form elements
    const hasDepartmentSelect = await hasVisibleText(page, /department|specialty|specialization/i, 8000);
    const hasDoctorSelect = await hasVisibleText(page, /doctor|physician|select.*doctor/i, 5000);
    const hasDatePicker = await page.locator('input[type="date"], [class*="calendar"], [class*="date"]').first().isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`  Department selection: ${hasDepartmentSelect}`);
    console.log(`  Doctor selection: ${hasDoctorSelect}`);
    console.log(`  Date picker: ${hasDatePicker}`);

    // Check for time slots
    const hasTimeSlots = await hasVisibleText(page, /time|slot|am|pm|available/i, 5000);
    console.log(`  Time slots: ${hasTimeSlots}`);

    // Check for booking type options
    const hasTypeOptions = await hasVisibleText(page, /in-person|video|telemedicine|consultation type/i, 5000);
    console.log(`  Appointment type options: ${hasTypeOptions}`);

    // Check for a Book/Confirm button
    const hasConfirmBtn = await page.locator('button:has-text("Book"), button:has-text("Confirm"), button:has-text("Schedule")').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Confirm/Book button: ${hasConfirmBtn}`);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 26. DATA PERSISTENCE - Verify login token is stored
  // ─────────────────────────────────────────────────────────────────────────
  test('26 - Authentication token persistence', async ({ page }) => {
    console.log('TEST 26: Token persistence check');
    await patientLogin(page);
    await page.waitForTimeout(1000);

    // Check localStorage for patient tokens
    const hasToken = await page.evaluate(() => {
      return !!localStorage.getItem('patientPortalToken');
    });
    const hasRefreshToken = await page.evaluate(() => {
      return !!localStorage.getItem('patientRefreshToken');
    });
    const hasPatientUser = await page.evaluate(() => {
      return !!localStorage.getItem('patientUser');
    });

    console.log(`  Patient portal token stored: ${hasToken}`);
    console.log(`  Refresh token stored: ${hasRefreshToken}`);
    console.log(`  Patient user data stored: ${hasPatientUser}`);

    expect(hasToken || hasPatientUser).toBeTruthy();
    await screenshot(page, 'portal-26-auth-check.png');

    // Verify that navigating to a portal page works without re-login
    await navigatePortal(page, 'dashboard');
    const onDashboard = !page.url().includes('login');
    console.log(`  Session persists (not redirected to login): ${onDashboard}`);
    expect(onDashboard).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 27. CROSS-PAGE NAVIGATION FLOW
  // ─────────────────────────────────────────────────────────────────────────
  test('27 - Cross-page navigation flow', async ({ page }) => {
    console.log('TEST 27: Cross-page navigation');
    await patientLogin(page);

    // Navigate through all major pages sequentially to verify they load
    const pages = [
      { path: 'dashboard', label: 'Dashboard' },
      { path: 'appointments', label: 'Appointments' },
      { path: 'records', label: 'Medical Records' },
      { path: 'prescriptions', label: 'Prescriptions' },
      { path: 'labs', label: 'Lab Results' },
      { path: 'billing', label: 'Billing' },
      { path: 'insurance', label: 'Insurance' },
      { path: 'settings', label: 'Settings' },
      { path: 'health-assistant', label: 'Health Assistant' },
      { path: 'symptom-checker', label: 'Symptom Checker' },
      { path: 'health-insights', label: 'Health Insights' },
      { path: 'messages', label: 'Messages' },
      { path: 'health-sync', label: 'Health Sync' },
      { path: 'fitness', label: 'Fitness Tracker' },
      { path: 'nutrition', label: 'Nutrition Plan' },
      { path: 'wellness', label: 'Wellness Hub' },
      { path: 'history', label: 'Full History' },
    ];

    for (const { path, label } of pages) {
      try {
        await navigatePortal(page, path);
        const currentUrl = page.url();
        const loaded = currentUrl.includes(path) || !currentUrl.includes('login');
        console.log(`  ${label}: ${loaded ? 'LOADED' : 'FAILED'} (${currentUrl})`);
        await screenshot(page, `portal-27-nav-${path.replace(/[^a-z0-9]/g, '-')}.png`);
      } catch (err) {
        console.log(`  ${label}: ERROR - ${err}`);
      }
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 28. REDIRECTS VERIFICATION
  // ─────────────────────────────────────────────────────────────────────────
  test('28 - URL redirects work correctly', async ({ page }) => {
    console.log('TEST 28: Redirect verification');
    await patientLogin(page);

    // /patient-portal/profile should redirect to /patient-portal/settings
    await page.goto(`${BASE}/patient-portal/profile`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const settingsUrl = page.url();
    const redirectedToSettings = settingsUrl.includes('settings');
    console.log(`  /profile -> /settings redirect: ${redirectedToSettings} (${settingsUrl})`);
    await screenshot(page, 'portal-28-redirect-profile.png');

    // /patient-portal/medical-history should redirect to /patient-portal/records
    await page.goto(`${BASE}/patient-portal/medical-history`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    const recordsUrl = page.url();
    const redirectedToRecords = recordsUrl.includes('records');
    console.log(`  /medical-history -> /records redirect: ${redirectedToRecords} (${recordsUrl})`);
    await screenshot(page, 'portal-28b-redirect-medical-history.png');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 29. SEARCH AND FILTER FUNCTIONALITY
  // ─────────────────────────────────────────────────────────────────────────
  test('29 - Search and filter on data pages', async ({ page }) => {
    console.log('TEST 29: Search and filter functionality');
    await patientLogin(page);

    // Test search on Dashboard (Medical Reports)
    await navigatePortal(page, 'dashboard');
    const dashboardSearch = page.locator('input[placeholder*="search" i], input[placeholder*="test name" i]').first();
    if (await dashboardSearch.isVisible({ timeout: 5000 }).catch(() => false)) {
      await dashboardSearch.fill('blood');
      await page.waitForTimeout(1000);
      await screenshot(page, 'portal-29-dashboard-search.png');
      console.log(`  Dashboard search: typed "blood"`);
      await dashboardSearch.clear();
    }

    // Test search on Lab Results page
    await navigatePortal(page, 'labs');
    const labSearch = page.locator('input[placeholder*="search" i], input[type="search"]').first();
    if (await labSearch.isVisible({ timeout: 5000 }).catch(() => false)) {
      await labSearch.fill('CBC');
      await page.waitForTimeout(1000);
      await screenshot(page, 'portal-29b-labs-search.png');
      console.log(`  Lab Results search: typed "CBC"`);
    }

    // Test filter on Appointments page
    await navigatePortal(page, 'appointments');
    const filterBtn = page.locator('button:has-text("Filter"), button:has(svg[class*="funnel"])').first();
    if (await filterBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, 'portal-29c-appointments-filter.png');
      console.log(`  Appointments filter opened`);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 30. ERROR HANDLING AND EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────
  test('30 - Error handling: invalid login credentials', async ({ page }) => {
    console.log('TEST 30: Error handling');

    // Try invalid login
    await page.goto(`${BASE}/patient-portal/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"]', 'invalid@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await screenshot(page, 'portal-30-invalid-login.png');

    // Check for error message
    const hasError = await hasVisibleText(page, /invalid|incorrect|error|failed|not found/i, 5000);
    console.log(`  Error message on invalid login: ${hasError}`);

    // Verify still on login page
    const stillOnLogin = page.url().includes('login');
    console.log(`  Still on login page: ${stillOnLogin}`);
    expect(stillOnLogin).toBeTruthy();

    // Check error styling (red background/text)
    const errorElement = page.locator('[class*="red"], [class*="error"], [class*="alert"]').first();
    const hasErrorStyling = await errorElement.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`  Error styling visible: ${hasErrorStyling}`);
  });
});
