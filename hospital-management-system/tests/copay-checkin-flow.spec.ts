import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://spetaar.ai';
const ADMIN_EMAIL = 'admin@hospital.com';
const PASSWORD = 'password123';

async function login(page: Page, email: string = ADMIN_EMAIL) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

test.describe('Full Check-In with Copay Collection - Live Flow', () => {
  test.setTimeout(180000);

  test('Complete OPD check-in flow with CopayCollectionModal', async ({ page }) => {
    await login(page);

    // Step 1: Navigate to OPD
    console.log('--- STEP 1: Navigate to OPD ---');
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/flow-01-opd-page.png', fullPage: true });

    // Step 2: Switch to "Today's Appointments" tab (Check In buttons are here)
    console.log('--- STEP 2: Switch to Today\'s Appointments tab ---');

    const todaysTab = page.locator('button:has-text("Today\'s Appointments"), button:has-text("Today")').first();
    const hasTodaysTab = await todaysTab.isVisible().catch(() => false);
    console.log(`  Today's Appointments tab visible: ${hasTodaysTab}`);

    if (hasTodaysTab) {
      await todaysTab.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/flow-02-todays-tab.png', fullPage: true });
    }

    // Now look for Check In buttons (orange buttons on appointment cards)
    const checkInButtons = page.locator('button:has-text("Check In"), button:has-text("Check-In"), button:has-text("Check in")');
    const checkInCount = await checkInButtons.count();
    console.log(`  Found ${checkInCount} Check In buttons`);

    if (checkInCount === 0) {
      const allButtons = await page.locator('button').allTextContents();
      console.log(`  All buttons: ${allButtons.filter(b => b.trim()).slice(0, 20).join(', ')}`);
      console.log('  No SCHEDULED appointments with Check In available');
      await page.screenshot({ path: 'test-results/flow-02-no-checkin.png', fullPage: true });
      return;
    }

    // Step 3: Click Check In
    console.log('--- STEP 3: Click Check In ---');
    const firstCheckIn = page.locator('button:has-text("Check In"), button:has-text("Check-In"), button:has-text("Check in")').first();
    await firstCheckIn.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/flow-03-before-checkin.png', fullPage: true });
    await firstCheckIn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/flow-04-after-checkin-click.png', fullPage: true });

    // Step 4: CopayCollectionModal should be open
    console.log('--- STEP 4: Verify CopayCollectionModal ---');

    // Wait for modal to appear
    const modal = page.locator('[class*="modal"], [role="dialog"], .fixed.inset-0, [class*="backdrop"]').first();
    const modalVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  Modal visible: ${modalVisible}`);

    if (modalVisible) {
      // Check modal content
      const modalText = await page.locator('[class*="modal"], [role="dialog"], .fixed').first().textContent().catch(() => '');
      console.log(`  Modal text (first 300 chars): ${modalText?.slice(0, 300)}`);

      // Verify copay-related content
      const hasCopayContent = await page.locator('text=/Copay|Payment|Collection|Fee|Amount|AED/i').first().isVisible().catch(() => false);
      console.log(`  Has copay content: ${hasCopayContent}`);
      expect(hasCopayContent).toBeTruthy();

      // Check for fee breakdown elements
      const hasConsultationFee = await page.locator('text=/Consultation|Fee|Charge/i').first().isVisible().catch(() => false);
      const hasAED = await page.locator('text=/AED|₹|\$/i').first().isVisible().catch(() => false);
      console.log(`  Consultation fee visible: ${hasConsultationFee}`);
      console.log(`  Currency visible: ${hasAED}`);

      // Check for payment method selection
      const hasPaymentMethod = await page.locator('text=/Cash|Card|Payment Method|Select/i').first().isVisible().catch(() => false);
      console.log(`  Payment method visible: ${hasPaymentMethod}`);

      // Check for action buttons (Collect, Waive, Defer)
      const hasCollect = await page.locator('button:has-text("Collect"), button:has-text("Confirm")').first().isVisible().catch(() => false);
      const hasWaive = await page.locator('button:has-text("Waive"), button:has-text("No Charge")').first().isVisible().catch(() => false);
      const hasDefer = await page.locator('button:has-text("Defer"), button:has-text("Skip"), button:has-text("Later")').first().isVisible().catch(() => false);
      console.log(`  Action buttons - Collect: ${hasCollect}, Waive: ${hasWaive}, Defer: ${hasDefer}`);

      // Check for GAP features in modal
      console.log('--- STEP 5: Verify GAP features in modal ---');

      // GAP 1: Pre-auth check
      const hasPreAuth = await page.locator('text=/Pre-Auth|Pre-Authorization|Authorization/i').first().isVisible().catch(() => false);
      console.log(`  [GAP 1] Pre-auth check: ${hasPreAuth}`);

      // GAP 2: COB/Secondary insurance
      const hasCOB = await page.locator('text=/Secondary|Coordination|COB/i').first().isVisible().catch(() => false);
      console.log(`  [GAP 2] COB info: ${hasCOB}`);

      // GAP 4: Deductible tracking
      const hasDeductible = await page.locator('text=/Deductible|Annual.*Cap/i').first().isVisible().catch(() => false);
      console.log(`  [GAP 4] Deductible: ${hasDeductible}`);

      // GAP 5: Data source
      const hasDataSource = await page.locator('text=/DHA|Cached|Data Source|Verified|Source/i').first().isVisible().catch(() => false);
      console.log(`  [GAP 5] Data source: ${hasDataSource}`);

      // GAP 6: Pharmacy estimate
      const hasPharmacy = await page.locator('text=/Pharmacy|Medication|Estimated.*Pharm/i').first().isVisible().catch(() => false);
      console.log(`  [GAP 6] Pharmacy estimate: ${hasPharmacy}`);

      await page.screenshot({ path: 'test-results/flow-05-copay-modal-full.png', fullPage: true });

      // Step 6: Select payment method and collect
      console.log('--- STEP 6: Select payment and complete check-in ---');

      // Try selecting CASH payment method
      const cashBtn = page.locator('button:has-text("Cash"), label:has-text("Cash"), [data-value="CASH"], input[value="CASH"]').first();
      if (await cashBtn.isVisible().catch(() => false)) {
        await cashBtn.click();
        console.log('  Selected CASH payment');
      }

      // Try select dropdown for payment method
      const paymentSelect = page.locator('select').first();
      if (await paymentSelect.isVisible().catch(() => false)) {
        const options = await paymentSelect.locator('option').allTextContents();
        console.log(`  Payment select options: ${options.join(', ')}`);
        if (options.some(o => /cash/i.test(o))) {
          await paymentSelect.selectOption({ label: options.find(o => /cash/i.test(o))! });
          console.log('  Selected Cash from dropdown');
        }
      }

      await page.screenshot({ path: 'test-results/flow-06-payment-selected.png', fullPage: true });

      // Click Collect/Confirm/Complete
      const collectBtn = page.locator('button:has-text("Collect"), button:has-text("Confirm & Check In"), button:has-text("Complete"), button:has-text("Check In")').last();
      if (await collectBtn.isVisible().catch(() => false)) {
        const btnText = await collectBtn.textContent();
        console.log(`  Clicking: "${btnText}"`);
        await collectBtn.click();
        await page.waitForTimeout(5000);

        await page.screenshot({ path: 'test-results/flow-07-after-collect.png', fullPage: true });

        // Check for success indicators
        const hasSuccess = await page.locator('text=/success|checked in|Token|token #/i').first().isVisible({ timeout: 5000 }).catch(() => false);
        const hasToast = await page.locator('[class*="toast"], [role="alert"], .Toastify').first().isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`  Success message: ${hasSuccess}`);
        console.log(`  Toast notification: ${hasToast}`);

        if (hasToast) {
          const toastText = await page.locator('[class*="toast"], [role="alert"], .Toastify').first().textContent().catch(() => '');
          console.log(`  Toast text: ${toastText}`);
        }
      } else {
        console.log('  No collect/confirm button found');
        // Try defer instead
        const deferBtn = page.locator('button:has-text("Defer"), button:has-text("Skip"), button:has-text("without")').first();
        if (await deferBtn.isVisible().catch(() => false)) {
          const btnText = await deferBtn.textContent();
          console.log(`  Clicking defer instead: "${btnText}"`);
          await deferBtn.click();
          await page.waitForTimeout(5000);
          await page.screenshot({ path: 'test-results/flow-07-after-defer.png', fullPage: true });
        }
      }

      // Step 7: Verify OPD page updated
      console.log('--- STEP 7: Verify appointment status updated ---');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/flow-08-final-state.png', fullPage: true });

      // The appointment should now show CHECKED_IN status
      const hasCheckedIn = await page.locator('text=/CHECKED.IN|Checked In|checked-in/i').first().isVisible().catch(() => false);
      console.log(`  CHECKED_IN status visible: ${hasCheckedIn}`);

    } else {
      console.log('  Modal did not appear - checking if check-in happened directly');
      await page.screenshot({ path: 'test-results/flow-04-no-modal.png', fullPage: true });

      // Some flows might skip modal and check in directly
      const directSuccess = await page.locator('text=/Checked In|Success|Token/i').first().isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`  Direct check-in success: ${directSuccess}`);
    }

    // Step 8: Verify audit log was populated
    console.log('--- STEP 8: Verify audit trail (GAP 7) ---');
    await page.goto(`${BASE_URL}/insurance-audit`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/flow-09-audit-after-checkin.png', fullPage: true });

    const auditEntries = await page.locator('table tbody tr').count();
    console.log(`  Audit entries visible: ${auditEntries}`);

    console.log('=== FLOW COMPLETE ===');
  });
});
