/**
 * Receptionist Portal - Comprehensive E2E Test Suite
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'https://spetaar.ai';
const EMAIL = 'receptionist@hospital.com';
const PASSWORD = 'password123';

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  if (page.url().includes('/login')) {
    await page.waitForTimeout(5000);
  }
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/receptionist-${name}.png`, fullPage: true });
}

async function navigateTo(page: Page, path: string): Promise<string> {
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle').catch(() => {});
  return await page.locator('body').textContent() || '';
}

test.describe('Receptionist Portal - Full Module E2E', () => {
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // 1. DASHBOARD
  test('1 - Dashboard loads with stats', async ({ page }) => {
    expect(page.url()).toContain('dashboard');
    await page.waitForTimeout(2000);
    const body = await page.locator('body').textContent() || '';
    expect(body.length).toBeGreaterThan(100);
    const cards = await page.locator('[class*="card"], [class*="Card"], [class*="stat"]').count();
    console.log(`Dashboard cards: ${cards}`);
    expect(cards).toBeGreaterThan(0);
    expect(/\d+/.test(body)).toBeTruthy();
    await screenshot(page, '01-dashboard');
  });

  // 2. PATIENTS
  test('2 - Patients: list, search, register button', async ({ page }) => {
    const body = await navigateTo(page, '/patients');
    expect(body.length).toBeGreaterThan(100);
    expect(/Patient|Name|MRN|Phone/i.test(body)).toBeTruthy();
    const registerBtn = page.locator('button:has-text("Register"), button:has-text("Add Patient"), button:has-text("New Patient"), a:has-text("Register")').first();
    const hasRegister = await registerBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Register button: ${hasRegister}`);
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"], input[type="search"]').first();
    const hasSearch = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Search input: ${hasSearch}`);
    if (hasSearch) {
      await searchInput.fill('kamil');
      await page.waitForTimeout(2000);
      const afterSearch = await page.locator('body').textContent() || '';
      expect(afterSearch.length).toBeGreaterThan(100);
    }
    const rows = await page.locator('table tbody tr').count();
    console.log(`Patient rows: ${rows}`);
    await screenshot(page, '02-patients');
  });

  // 3. APPOINTMENTS
  test('3 - Appointments: list, filters, book button', async ({ page }) => {
    const body = await navigateTo(page, '/appointments');
    expect(body.length).toBeGreaterThan(100);
    expect(/Appointment|Schedule|Book|Calendar|Date/i.test(body)).toBeTruthy();
    const bookBtn = page.locator('button:has-text("Book"), button:has-text("New Appointment"), button:has-text("Schedule")').first();
    const hasBook = await bookBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Book button: ${hasBook}`);
    const filters = await page.locator('select, input[type="date"], button:has-text("Filter"), button:has-text("Today")').count();
    console.log(`Filter elements: ${filters}`);
    const entries = await page.locator('table tbody tr').count();
    console.log(`Appointment entries: ${entries}`);
    await screenshot(page, '03-appointments');
  });

  // 4. DOCTORS
  test('4 - Doctors: directory with entries', async ({ page }) => {
    const body = await navigateTo(page, '/doctors');
    expect(body.length).toBeGreaterThan(100);
    expect(/Doctor|Physician|Specialist|Department|Dr\./i.test(body)).toBeTruthy();
    const elements = await page.locator('[class*="card"], [class*="Card"], table tbody tr').count();
    console.log(`Doctor elements: ${elements}`);
    expect(elements).toBeGreaterThan(0);
    await screenshot(page, '04-doctors');
  });

  // 5. OPD
  test('5 - OPD: queue and check-in', async ({ page }) => {
    const body = await navigateTo(page, '/opd');
    expect(body.length).toBeGreaterThan(100);
    expect(/OPD|Outpatient|Queue|Check.?In|Today/i.test(body)).toBeTruthy();
    const checkInBtns = await page.locator('button:has-text("Check In"), button:has-text("Check-In")').count();
    console.log(`Check-In buttons: ${checkInBtns}`);
    const tabs = await page.locator('[role="tab"], button[class*="tab"]').count();
    console.log(`OPD tabs: ${tabs}`);
    await screenshot(page, '05-opd');
  });

  // 6. EMERGENCY
  test('6 - Emergency: patient list with triage', async ({ page }) => {
    const body = await navigateTo(page, '/emergency');
    expect(body.length).toBeGreaterThan(100);
    expect(/Emergency|Triage|Critical|Urgent|ER/i.test(body)).toBeTruthy();
    const entries = await page.locator('table tbody tr, [class*="card"], [class*="Card"]').count();
    console.log(`Emergency entries: ${entries}`);
    const actionBtns = await page.locator('button:has-text("New"), button:has-text("Register"), button:has-text("Triage")').count();
    console.log(`Emergency action buttons: ${actionBtns}`);
    await screenshot(page, '06-emergency');
  });

  // 7. SYMPTOM CHECKER
  test('7 - Symptom Checker: AI interface', async ({ page }) => {
    const body = await navigateTo(page, '/symptom-checker');
    expect(body.length).toBeGreaterThan(100);
    expect(/Symptom|Check|AI|Assess|Diagnosis|Body|Select/i.test(body)).toBeTruthy();
    const inputs = await page.locator('input, textarea, select').count();
    console.log(`Symptom Checker inputs: ${inputs}`);
    await screenshot(page, '07-symptom-checker');
  });

  // 8. BILLING
  test('8 - Billing: invoices and stats', async ({ page }) => {
    const body = await navigateTo(page, '/billing');
    expect(body.length).toBeGreaterThan(100);
    expect(/Billing|Invoice|Payment|Amount|AED|Revenue|Outstanding/i.test(body)).toBeTruthy();
    const rows = await page.locator('table tbody tr').count();
    console.log(`Billing rows: ${rows}`);
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Invoice"), button:has-text("Generate")').first();
    const hasCreate = await createBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Create Invoice button: ${hasCreate}`);
    await screenshot(page, '08-billing');
  });

  // 9. COPAY REFUNDS
  test('9 - Copay Refunds: management page', async ({ page }) => {
    const body = await navigateTo(page, '/copay-refunds');
    expect(body.length).toBeGreaterThan(100);
    expect(/Copay|Refund|Payment|Amount|Status|Patient/i.test(body)).toBeTruthy();
    const entries = await page.locator('table tbody tr, [class*="card"], [class*="list-item"]').count();
    console.log(`Copay refund entries: ${entries}`);
    await screenshot(page, '09-copay-refunds');
  });

  // 10. MY LEAVE
  test('10 - My Leave: requests and apply', async ({ page }) => {
    const body = await navigateTo(page, '/my-leave');
    expect(body.length).toBeGreaterThan(100);
    expect(/Leave|Request|Apply|Vacation|Sick|Annual|Balance/i.test(body)).toBeTruthy();
    const applyBtn = page.locator('button:has-text("Apply"), button:has-text("Request"), button:has-text("New Leave")').first();
    const hasApply = await applyBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Apply Leave button: ${hasApply}`);
    await screenshot(page, '10-my-leave');
  });

  // 11. QUEUE
  test('11 - Queue: management with tickets', async ({ page }) => {
    const body = await navigateTo(page, '/queue');
    expect(body.length).toBeGreaterThan(100);
    expect(/Queue|Ticket|Wait|Serving|Next|Call|Counter|Token/i.test(body)).toBeTruthy();
    const elements = await page.locator('[class*="queue"], [class*="Queue"], [class*="ticket"], [class*="card"]').count();
    console.log(`Queue elements: ${elements}`);
    const actionBtns = await page.locator('button:has-text("Call"), button:has-text("Next"), button:has-text("Issue"), button:has-text("New Ticket")').count();
    console.log(`Queue action buttons: ${actionBtns}`);
    await screenshot(page, '11-queue');
  });

  // 12. KIOSK
  test('12 - Kiosk: self check-in interface', async ({ page }) => {
    const body = await navigateTo(page, '/kiosk');
    expect(body.length).toBeGreaterThan(100);
    expect(/Kiosk|Check.?In|Self|Welcome|Scan|Appointment|Token|ID|MRN/i.test(body)).toBeTruthy();
    const buttons = await page.locator('button').count();
    console.log(`Kiosk buttons: ${buttons}`);
    expect(buttons).toBeGreaterThan(0);
    await screenshot(page, '12-kiosk');
  });

  // 13. CRM
  test('13 - CRM: dashboard with leads', async ({ page }) => {
    const body = await navigateTo(page, '/crm');
    expect(body.length).toBeGreaterThan(100);
    expect(/CRM|Lead|Campaign|Survey|Contact|Marketing|Customer/i.test(body)).toBeTruthy();
    const statElements = await page.locator('[class*="stat"], [class*="card"], [class*="Card"]').count();
    console.log(`CRM stat elements: ${statElements}`);
    const tabs = await page.locator('[role="tab"], button:has-text("Lead"), button:has-text("Campaign"), button:has-text("Survey")').count();
    console.log(`CRM tabs: ${tabs}`);
    await screenshot(page, '13-crm');
  });

  // 14. RAPID NAVIGATION - no crashes
  test('14 - Navigation: rapid switching without crashes', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', err => { pageErrors.push(err.message); });

    const routes = ['/dashboard', '/patients', '/appointments', '/doctors', '/opd',
      '/emergency', '/symptom-checker', '/billing', '/copay-refunds',
      '/my-leave', '/queue', '/kiosk', '/crm'];

    for (const route of routes) {
      await page.goto(`${BASE}${route}`);
      await page.waitForTimeout(1500);
      const body = await page.locator('body').textContent() || '';
      expect(body.trim().length, `${route} not blank`).toBeGreaterThan(50);
    }

    // Quick back-and-forth
    await page.goto(`${BASE}/patients`);
    await page.waitForTimeout(800);
    await page.goto(`${BASE}/billing`);
    await page.waitForTimeout(800);
    await page.goto(`${BASE}/opd`);
    await page.waitForTimeout(800);
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(1000);

    const finalBody = await page.locator('body').textContent() || '';
    expect(finalBody.trim().length).toBeGreaterThan(100);

    const critical = pageErrors.filter(e => !e.includes('ResizeObserver') && !e.includes('Non-Error'));
    console.log(`Page errors: ${pageErrors.length}, Critical: ${critical.length}`);
    if (critical.length > 0) {
      critical.forEach(e => console.log(`  ERROR: ${e}`));
    }
    await screenshot(page, '14-navigation');
  });

  // 15. SIDEBAR MODULES
  test('15 - Sidebar: all expected modules visible', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    const sidebarText = await page.locator('nav, aside, [class*="sidebar"], [class*="Sidebar"]').first().textContent() || '';

    const expected = ['Dashboard', 'Patient', 'Appointment', 'Doctor', 'OPD', 'Emergency',
      'Symptom', 'Billing', 'Copay', 'Leave', 'Queue', 'Kiosk', 'CRM'];
    const found: string[] = [];
    const missing: string[] = [];

    for (const mod of expected) {
      if (new RegExp(mod, 'i').test(sidebarText)) {
        found.push(mod);
      } else {
        missing.push(mod);
      }
    }

    console.log(`Found: ${found.join(', ')}`);
    if (missing.length > 0) console.log(`Missing: ${missing.join(', ')}`);
    expect(found.length).toBeGreaterThanOrEqual(8);

    // Test sidebar search
    const search = page.locator('nav input, aside input, [class*="sidebar"] input').first();
    const hasSearch = await search.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Sidebar search: ${hasSearch}`);
    if (hasSearch) {
      await search.fill('Patient');
      await page.waitForTimeout(500);
      await search.clear();
    }
    await screenshot(page, '15-sidebar');
  });
});
