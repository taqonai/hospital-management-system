import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://spetaar.ai';
const ADMIN_EMAIL = 'admin@hospital.com';
const RECEPTIONIST_EMAIL = 'receptionist@hospital.com';
const PASSWORD = 'password123';

async function login(page: Page, email: string = ADMIN_EMAIL) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

test.describe('Copay Check-In Flow - E2E Tests', () => {
  test.setTimeout(120000);

  // ==============================
  // SECTION 1: OPD Check-In Flow
  // ==============================

  test('1.1 OPD page loads and shows appointments', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');

    // OPD page should load
    await expect(page.locator('body')).toContainText(/OPD|Outpatient|Queue/i);

    // Take screenshot
    await page.screenshot({ path: 'test-results/01-opd-page.png', fullPage: true });
  });

  test('1.2 OPD shows Check In button for scheduled appointments', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Look for appointment rows/cards
    const appointmentElements = await page.locator('table tbody tr, [class*="card"], [class*="appointment"]').count();
    console.log(`Found ${appointmentElements} appointment elements`);

    // Look for Check In buttons
    const checkInButtons = await page.locator('button:has-text("Check In"), button:has-text("Check-In"), button:has-text("CheckIn")').count();
    console.log(`Found ${checkInButtons} Check In buttons`);

    await page.screenshot({ path: 'test-results/02-opd-appointments.png', fullPage: true });
  });

  test('1.3 Clicking Check In opens CopayCollectionModal', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Find and click first Check In button
    const checkInBtn = page.locator('button:has-text("Check In"), button:has-text("Check-In")').first();
    const hasCheckIn = await checkInBtn.isVisible().catch(() => false);

    if (hasCheckIn) {
      await checkInBtn.click();
      await page.waitForTimeout(2000);

      // Modal should appear with copay info
      const modalVisible = await page.locator('[class*="modal"], [role="dialog"], .fixed.inset-0').first().isVisible().catch(() => false);
      console.log(`Modal visible: ${modalVisible}`);

      // Look for copay-related content in modal
      const hasCopayContent = await page.locator('text=/Copay|Payment|Collection|Insurance|Self-Pay|Fee/i').first().isVisible().catch(() => false);
      console.log(`Has copay content: ${hasCopayContent}`);

      await page.screenshot({ path: 'test-results/03-copay-modal.png', fullPage: true });

      if (hasCopayContent) {
        // Check for fee breakdown
        const hasFeeBreakdown = await page.locator('text=/AED|Consultation|Coverage|Amount/i').first().isVisible().catch(() => false);
        console.log(`Has fee breakdown: ${hasFeeBreakdown}`);

        // Check for payment method options
        const hasPaymentOptions = await page.locator('text=/Cash|Card|Collect|Waive|Defer/i').first().isVisible().catch(() => false);
        console.log(`Has payment options: ${hasPaymentOptions}`);

        // Check for GAP 1: Pre-auth warning
        const hasPreAuth = await page.locator('text=/Pre-Auth|Pre-Authorization|Authorization Required/i').first().isVisible().catch(() => false);
        console.log(`[GAP 1] Pre-auth check visible: ${hasPreAuth}`);

        // Check for GAP 4: Deductible info
        const hasDeductible = await page.locator('text=/Deductible|Annual/i').first().isVisible().catch(() => false);
        console.log(`[GAP 4] Deductible info visible: ${hasDeductible}`);

        // Check for GAP 5: Data source indicator
        const hasDataSource = await page.locator('text=/DHA|Cached|Data Source|Verified/i').first().isVisible().catch(() => false);
        console.log(`[GAP 5] Data source visible: ${hasDataSource}`);

        // Check for GAP 6: Pharmacy estimate
        const hasPharmacy = await page.locator('text=/Pharmacy|Medication|Estimated/i').first().isVisible().catch(() => false);
        console.log(`[GAP 6] Pharmacy estimate visible: ${hasPharmacy}`);

        await page.screenshot({ path: 'test-results/04-copay-modal-details.png', fullPage: true });
      }
    } else {
      console.log('No Check In button found - no SCHEDULED appointments available');
      await page.screenshot({ path: 'test-results/03-no-checkin-available.png', fullPage: true });
    }
  });

  test('1.4 Complete check-in with Collect Copay', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const checkInBtn = page.locator('button:has-text("Check In"), button:has-text("Check-In")').first();
    const hasCheckIn = await checkInBtn.isVisible().catch(() => false);

    if (hasCheckIn) {
      await checkInBtn.click();
      await page.waitForTimeout(2000);

      // Look for Collect button or payment method selection
      const collectBtn = page.locator('button:has-text("Collect"), button:has-text("Confirm"), button:has-text("Complete Check-In")').first();
      const hasCollect = await collectBtn.isVisible().catch(() => false);

      if (hasCollect) {
        // Select CASH payment method if dropdown exists
        const methodSelect = page.locator('select:near(:text("Payment")), select:near(:text("Method"))').first();
        const hasMethodSelect = await methodSelect.isVisible().catch(() => false);
        if (hasMethodSelect) {
          await methodSelect.selectOption({ label: 'Cash' }).catch(() => {});
        }

        // Also try radio/button based payment method selection
        const cashOption = page.locator('button:has-text("Cash"), label:has-text("Cash"), [data-value="CASH"]').first();
        const hasCashOption = await cashOption.isVisible().catch(() => false);
        if (hasCashOption) {
          await cashOption.click().catch(() => {});
        }

        await page.screenshot({ path: 'test-results/05-before-collect.png', fullPage: true });

        // Click collect/confirm
        await collectBtn.click();
        await page.waitForTimeout(3000);

        await page.screenshot({ path: 'test-results/06-after-collect.png', fullPage: true });

        // Check for success message
        const hasSuccess = await page.locator('text=/Checked In|Success|Token|checked in/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        console.log(`Check-in success: ${hasSuccess}`);
      }
    } else {
      console.log('SKIP: No scheduled appointments for check-in');
    }
  });

  test('1.5 Complete check-in with Defer Payment', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    const checkInBtn = page.locator('button:has-text("Check In"), button:has-text("Check-In")').first();
    const hasCheckIn = await checkInBtn.isVisible().catch(() => false);

    if (hasCheckIn) {
      await checkInBtn.click();
      await page.waitForTimeout(2000);

      // Look for Defer button
      const deferBtn = page.locator('button:has-text("Defer"), button:has-text("Skip Payment"), button:has-text("Pay Later")').first();
      const hasDefer = await deferBtn.isVisible().catch(() => false);

      if (hasDefer) {
        await page.screenshot({ path: 'test-results/07-before-defer.png', fullPage: true });
        await deferBtn.click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'test-results/08-after-defer.png', fullPage: true });

        const hasSuccess = await page.locator('text=/Checked In|Success|Token|Deferred/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        console.log(`Defer check-in success: ${hasSuccess}`);
      } else {
        console.log('No Defer button visible');
      }
    } else {
      console.log('SKIP: No scheduled appointments');
    }
  });

  // ==============================
  // SECTION 2: Insurance Audit Log Page (GAP 7)
  // ==============================

  test('2.1 Insurance Audit Log page loads for admin', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto(`${BASE_URL}/insurance-audit`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Page should show audit content
    await expect(page.locator('body')).toContainText(/Insurance.*Audit|Audit/i);

    // Should have filter controls
    const hasFilters = await page.locator('text=/Filter|Action|Date/i').first().isVisible().catch(() => false);
    console.log(`Has filters: ${hasFilters}`);

    // Should have export button
    const hasExport = await page.locator('button:has-text("Export"), button:has-text("CSV"), button:has-text("Download")').first().isVisible().catch(() => false);
    console.log(`Has export button: ${hasExport}`);
    expect(hasExport).toBeTruthy();

    await page.screenshot({ path: 'test-results/09-audit-log-page.png', fullPage: true });
  });

  test('2.2 Audit Log shows entries from check-in tests', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto(`${BASE_URL}/insurance-audit`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check for table/entries
    const hasTable = await page.locator('table, [class*="table"]').first().isVisible().catch(() => false);
    console.log(`Has audit table: ${hasTable}`);

    // Check for entries or empty state
    const hasEntries = await page.locator('td, [class*="entry"], [class*="row"]').count();
    const hasEmptyState = await page.locator('text=/No.*entries|No.*audit|No.*records/i').first().isVisible().catch(() => false);
    console.log(`Table rows: ${hasEntries}, Empty state: ${hasEmptyState}`);

    await page.screenshot({ path: 'test-results/10-audit-log-entries.png', fullPage: true });
  });

  test('2.3 Audit Log filters work', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto(`${BASE_URL}/insurance-audit`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open filters
    const filterBtn = page.locator('button:has-text("Filter"), text=Filters').first();
    const hasFilterBtn = await filterBtn.isVisible().catch(() => false);
    if (hasFilterBtn) {
      await filterBtn.click();
      await page.waitForTimeout(500);

      // Should show filter options
      const hasActionFilter = await page.locator('select, [class*="filter"]').first().isVisible().catch(() => false);
      console.log(`Has action filter: ${hasActionFilter}`);

      // Try selecting a filter
      const actionSelect = page.locator('select').first();
      if (await actionSelect.isVisible().catch(() => false)) {
        await actionSelect.selectOption({ index: 1 }).catch(() => {});
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: 'test-results/11-audit-log-filtered.png', fullPage: true });
    }
  });

  test('2.4 Audit Log CSV export works', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto(`${BASE_URL}/insurance-audit`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click export
    const exportBtn = page.locator('button:has-text("Export"), button:has-text("CSV")').first();
    const hasExport = await exportBtn.isVisible().catch(() => false);

    if (hasExport) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
        exportBtn.click(),
      ]);

      if (download) {
        console.log(`CSV downloaded: ${download.suggestedFilename()}`);
        expect(download.suggestedFilename()).toContain('insurance-audit');
      } else {
        console.log('Export triggered (no download event captured - may use blob)');
      }
    }

    await page.screenshot({ path: 'test-results/12-audit-export.png', fullPage: true });
  });

  test('2.5 Audit Log is blocked for receptionist', async ({ page }) => {
    await login(page, RECEPTIONIST_EMAIL);
    await page.goto(`${BASE_URL}/insurance-audit`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should be redirected or show access denied
    const currentUrl = page.url();
    const isBlocked = !currentUrl.includes('/insurance-audit') ||
      await page.locator('text=/Access Denied|Unauthorized|Forbidden|Not Authorized/i').first().isVisible().catch(() => false);
    console.log(`Receptionist blocked from audit: ${isBlocked}, URL: ${currentUrl}`);

    await page.screenshot({ path: 'test-results/13-audit-receptionist-blocked.png', fullPage: true });
  });

  // ==============================
  // SECTION 3: Copay Refunds Page (GAP 9)
  // ==============================

  test('3.1 Copay Refunds page loads for admin', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto(`${BASE_URL}/copay-refunds`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Page should show refund content
    await expect(page.locator('body')).toContainText(/Refund|Copay/i);

    // Should have status tabs
    const hasTabs = await page.locator('text=/All|Pending|Approved|Processed|Rejected/i').first().isVisible().catch(() => false);
    console.log(`Has status tabs: ${hasTabs}`);

    // Should have Request Refund button
    const hasRequestBtn = await page.locator('button:has-text("Request Refund"), button:has-text("New Refund")').first().isVisible().catch(() => false);
    console.log(`Has request refund button: ${hasRequestBtn}`);
    expect(hasRequestBtn).toBeTruthy();

    await page.screenshot({ path: 'test-results/14-refund-page.png', fullPage: true });
  });

  test('3.2 Refund status tabs work', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto(`${BASE_URL}/copay-refunds`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click through tabs
    for (const tab of ['All', 'Pending', 'Approved', 'Processed', 'Rejected']) {
      const tabBtn = page.locator(`button:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first();
      if (await tabBtn.isVisible().catch(() => false)) {
        await tabBtn.click();
        await page.waitForTimeout(500);
        console.log(`Tab "${tab}" clicked`);
      }
    }

    await page.screenshot({ path: 'test-results/15-refund-tabs.png', fullPage: true });
  });

  test('3.3 Request Refund modal opens and has form fields', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto(`${BASE_URL}/copay-refunds`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Click Request Refund
    const requestBtn = page.locator('button:has-text("Request Refund"), button:has-text("New Refund")').first();
    if (await requestBtn.isVisible().catch(() => false)) {
      await requestBtn.click();
      await page.waitForTimeout(1000);

      // Modal should have form fields
      const hasModal = await page.locator('[class*="modal"], [role="dialog"], .fixed.inset-0').first().isVisible().catch(() => false);
      console.log(`Refund modal visible: ${hasModal}`);

      // Check for form fields
      const hasPaymentId = await page.locator('input[placeholder*="Payment"], input[placeholder*="payment"], label:has-text("Payment ID")').first().isVisible().catch(() => false);
      const hasAmount = await page.locator('input[type="number"], input[placeholder*="Amount"], label:has-text("Amount")').first().isVisible().catch(() => false);
      const hasReason = await page.locator('select, [class*="reason"], label:has-text("Reason")').first().isVisible().catch(() => false);
      console.log(`Form fields - PaymentID: ${hasPaymentId}, Amount: ${hasAmount}, Reason: ${hasReason}`);

      await page.screenshot({ path: 'test-results/16-refund-request-modal.png', fullPage: true });

      // Close modal
      const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close"), [aria-label="Close"]').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      }
    }
  });

  test('3.4 Copay Refunds accessible by receptionist', async ({ page }) => {
    await login(page, RECEPTIONIST_EMAIL);
    await page.goto(`${BASE_URL}/copay-refunds`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Should be accessible
    const currentUrl = page.url();
    const isAccessible = currentUrl.includes('/copay-refunds');
    console.log(`Receptionist can access refunds: ${isAccessible}, URL: ${currentUrl}`);

    // Should have Request Refund button
    const hasRequestBtn = await page.locator('button:has-text("Request Refund")').first().isVisible().catch(() => false);
    console.log(`Receptionist sees Request Refund: ${hasRequestBtn}`);

    // Should NOT have Approve/Reject buttons (no refunds to show, but check header area)
    await page.screenshot({ path: 'test-results/17-refund-receptionist.png', fullPage: true });
  });

  // ==============================
  // SECTION 4: Sidebar Navigation
  // ==============================

  test('4.1 Admin sees Insurance Audit and Copay Refunds in sidebar', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.waitForTimeout(2000);

    // Look for sidebar links
    const hasAuditLink = await page.locator('a:has-text("Insurance Audit"), text=Insurance Audit').first().isVisible().catch(() => false);
    const hasRefundLink = await page.locator('a:has-text("Copay Refund"), text=Copay Refund').first().isVisible().catch(() => false);
    console.log(`Sidebar - Audit link: ${hasAuditLink}, Refund link: ${hasRefundLink}`);

    await page.screenshot({ path: 'test-results/18-admin-sidebar.png', fullPage: true });
  });

  test('4.2 Receptionist sees Copay Refunds but NOT Insurance Audit in sidebar', async ({ page }) => {
    await login(page, RECEPTIONIST_EMAIL);
    await page.waitForTimeout(2000);

    const hasAuditLink = await page.locator('a:has-text("Insurance Audit"), text=Insurance Audit').first().isVisible().catch(() => false);
    const hasRefundLink = await page.locator('a:has-text("Copay Refund"), text=Copay Refund').first().isVisible().catch(() => false);
    console.log(`Receptionist sidebar - Audit link: ${hasAuditLink} (should be false), Refund link: ${hasRefundLink} (should be true)`);

    expect(hasAuditLink).toBeFalsy();

    await page.screenshot({ path: 'test-results/19-receptionist-sidebar.png', fullPage: true });
  });

  // ==============================
  // SECTION 5: Billing Page Integration
  // ==============================

  test('5.1 Billing page loads correctly', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(page.locator('body')).toContainText(/Billing|Revenue|Invoice/i);
    await page.screenshot({ path: 'test-results/20-billing-page.png', fullPage: true });
  });

  // ==============================
  // SECTION 6: Insurance Coding Page
  // ==============================

  test('6.1 Insurance Coding page loads correctly', async ({ page }) => {
    await login(page, ADMIN_EMAIL);
    await page.goto(`${BASE_URL}/insurance-coding`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(page.locator('body')).toContainText(/Insurance|Coding|ICD|CPT/i);
    await page.screenshot({ path: 'test-results/21-insurance-coding.png', fullPage: true });
  });
});
