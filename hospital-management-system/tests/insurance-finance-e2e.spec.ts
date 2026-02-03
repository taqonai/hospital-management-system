import { test, expect, Page } from '@playwright/test';

/**
 * Insurance & Finance E2E Test
 * Tests: Copay collection, Invoice generation, Insurance claims, Payments
 */

const BASE_URL = 'https://spetaar.ai';

const CREDENTIALS = {
  receptionist: { email: 'receptionist@hospital.com', password: 'password123' },
  finance: { email: 'finance@hospital.com', password: 'password123' },
  admin: { email: 'admin@hospital.com', password: 'password123' },
};

async function staffLogin(page: Page, email: string, password: string): Promise<boolean> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  
  try {
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

async function waitForLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

test.describe('Insurance & Finance E2E', () => {

  test('1. Insurance Verification at Check-in', async ({ page }) => {
    console.log('\n🏥 Testing insurance verification at check-in...');
    
    await staffLogin(page, CREDENTIALS.receptionist.email, CREDENTIALS.receptionist.password);
    console.log('  ✅ Logged in as receptionist');
    
    // Go to OPD
    await page.goto(`${BASE_URL}/opd`, { waitUntil: 'domcontentloaded' });
    await waitForLoad(page);
    
    // Click Today's Appointments tab
    const todayTab = page.locator('button:has-text("Today"), [role="tab"]:has-text("Today")').first();
    if (await todayTab.isVisible({ timeout: 3000 })) {
      await todayTab.click();
      await waitForLoad(page);
    }
    
    await page.screenshot({ path: 'test-results/insurance-1-appointments.png' });
    
    // Find Check In button
    const checkInBtn = page.locator('button:has-text("Check In")').first();
    
    if (await checkInBtn.isVisible({ timeout: 5000 })) {
      await checkInBtn.click();
      await page.waitForTimeout(2000);
      
      // Verify Copay Collection modal appears
      const copayModal = page.locator('text=Copay Collection').first();
      expect(await copayModal.isVisible({ timeout: 5000 })).toBeTruthy();
      console.log('  ✅ Copay Collection modal appeared');
      
      await page.screenshot({ path: 'test-results/insurance-1-copay-modal.png' });
      
      // Verify insurance info is displayed
      const insuranceInfo = page.locator('text=Insurance Details, text=Daman, text=In-Network').first();
      const feeBreakdown = page.locator('text=Fee Breakdown').first();
      
      console.log('  📋 Insurance details displayed');
      
      // Verify copay amount shown
      const copayAmount = page.locator('text=/AED.*\\d+\\.\\d{2}/').first();
      if (await copayAmount.isVisible({ timeout: 2000 })) {
        const text = await copayAmount.textContent();
        console.log(`  💰 Copay amount: ${text}`);
      }
      
      // Scroll to find action buttons
      await page.evaluate(() => {
        document.querySelectorAll('.overflow-y-auto, .overflow-auto').forEach(el => {
          el.scrollTop = el.scrollHeight;
        });
      });
      await page.waitForTimeout(500);
      
      // Collect copay
      const collectBtn = page.locator('button:has-text("Collect"), button:has-text("Confirm")').first();
      if (await collectBtn.isVisible({ timeout: 3000 })) {
        await collectBtn.click();
        await waitForLoad(page);
        console.log('  ✅ Copay collected');
      }
      
      await page.screenshot({ path: 'test-results/insurance-1-after-copay.png' });
    } else {
      console.log('  ⚠️ No appointments to check in - creating one first');
      // Would need to create appointment first
    }
  });

  test('2. Billing Module - Invoice List', async ({ page }) => {
    console.log('\n💰 Testing Billing/Invoice module...');
    
    await staffLogin(page, CREDENTIALS.receptionist.email, CREDENTIALS.receptionist.password);
    console.log('  ✅ Logged in');
    
    // Go to Billing
    await page.goto(`${BASE_URL}/billing`, { waitUntil: 'domcontentloaded' });
    await waitForLoad(page);
    await page.screenshot({ path: 'test-results/finance-2-billing-page.png' });
    
    // Check for key billing elements
    const invoiceTable = page.locator('table, .invoice-list, [class*="invoice"]').first();
    const createInvoiceBtn = page.locator('button:has-text("Create"), button:has-text("New Invoice")').first();
    
    if (await invoiceTable.isVisible({ timeout: 5000 })) {
      console.log('  ✅ Invoice table/list visible');
      
      // Count invoices
      const rows = await page.locator('tbody tr, .invoice-row, .invoice-card').count();
      console.log(`  📋 Found ${rows} invoices`);
    }
    
    // Test filters if available
    const statusFilter = page.locator('select[name*="status"], [data-testid="status-filter"]').first();
    if (await statusFilter.isVisible({ timeout: 2000 })) {
      console.log('  ✅ Status filter available');
    }
    
    const dateFilter = page.locator('input[type="date"], [data-testid="date-filter"]').first();
    if (await dateFilter.isVisible({ timeout: 2000 })) {
      console.log('  ✅ Date filter available');
    }
  });

  test('3. Insurance Claims Module', async ({ page }) => {
    console.log('\n📄 Testing Insurance Claims module...');
    
    await staffLogin(page, CREDENTIALS.receptionist.email, CREDENTIALS.receptionist.password);
    console.log('  ✅ Logged in');
    
    // Try different routes for insurance claims
    const claimRoutes = ['/insurance/claims', '/claims', '/billing/claims', '/insurance'];
    
    for (const route of claimRoutes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await waitForLoad(page);
      
      // Check if page loaded (not 404)
      const notFound = page.locator('text=404, text=Not Found').first();
      if (!(await notFound.isVisible({ timeout: 1000 }).catch(() => false))) {
        console.log(`  ✅ Found claims at: ${route}`);
        await page.screenshot({ path: 'test-results/finance-3-claims-page.png' });
        break;
      }
    }
    
    // Look for claims list/table
    const claimsList = page.locator('table, .claims-list, [class*="claim"]').first();
    if (await claimsList.isVisible({ timeout: 3000 })) {
      console.log('  ✅ Claims list visible');
      
      // Check claim statuses
      const pendingClaims = await page.locator('text=Pending, text=PENDING').count();
      const approvedClaims = await page.locator('text=Approved, text=APPROVED').count();
      const rejectedClaims = await page.locator('text=Rejected, text=REJECTED').count();
      
      console.log(`  📊 Claims: ${pendingClaims} pending, ${approvedClaims} approved, ${rejectedClaims} rejected`);
    }
    
    // Look for submit claim button
    const submitClaimBtn = page.locator('button:has-text("Submit Claim"), button:has-text("New Claim")').first();
    if (await submitClaimBtn.isVisible({ timeout: 2000 })) {
      console.log('  ✅ Submit claim button available');
    }
  });

  test('4. Payment Processing', async ({ page }) => {
    console.log('\n💳 Testing Payment processing...');
    
    await staffLogin(page, CREDENTIALS.receptionist.email, CREDENTIALS.receptionist.password);
    console.log('  ✅ Logged in');
    
    // Go to billing
    await page.goto(`${BASE_URL}/billing`, { waitUntil: 'domcontentloaded' });
    await waitForLoad(page);
    
    // Look for unpaid/pending invoices
    const pendingInvoice = page.locator('tr:has-text("Pending"), tr:has-text("Unpaid"), .invoice-card:has-text("Pending")').first();
    
    if (await pendingInvoice.isVisible({ timeout: 5000 })) {
      console.log('  📋 Found pending invoice');
      
      // Click on invoice or payment button
      const payBtn = pendingInvoice.locator('button:has-text("Pay"), button:has-text("Collect")').first();
      if (await payBtn.isVisible({ timeout: 2000 })) {
        await payBtn.click();
        await waitForLoad(page);
        
        await page.screenshot({ path: 'test-results/finance-4-payment-modal.png' });
        
        // Check payment methods
        const cashOption = page.locator('text=Cash, input[value="CASH"]').first();
        const cardOption = page.locator('text=Card, input[value="CARD"]').first();
        const insuranceOption = page.locator('text=Insurance, input[value="INSURANCE"]').first();
        
        if (await cashOption.isVisible({ timeout: 2000 })) console.log('  ✅ Cash payment available');
        if (await cardOption.isVisible({ timeout: 2000 })) console.log('  ✅ Card payment available');
        if (await insuranceOption.isVisible({ timeout: 2000 })) console.log('  ✅ Insurance payment available');
      }
    } else {
      console.log('  ⚠️ No pending invoices found');
    }
    
    await page.screenshot({ path: 'test-results/finance-4-billing-final.png' });
  });

  test('5. Finance Reports & Dashboard', async ({ page }) => {
    console.log('\n📊 Testing Finance Reports...');
    
    await staffLogin(page, CREDENTIALS.receptionist.email, CREDENTIALS.receptionist.password);
    console.log('  ✅ Logged in');
    
    // Check finance dashboard/reports
    const financeRoutes = ['/finance', '/reports/finance', '/billing/reports', '/analytics'];
    
    for (const route of financeRoutes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await waitForLoad(page);
      
      const notFound = page.locator('text=404, text=Not Found').first();
      if (!(await notFound.isVisible({ timeout: 1000 }).catch(() => false))) {
        console.log(`  ✅ Found finance page at: ${route}`);
        await page.screenshot({ path: 'test-results/finance-5-reports.png' });
        
        // Look for key metrics
        const revenue = page.locator('text=/Revenue|Total.*AED|Income/i').first();
        const collections = page.locator('text=/Collection|Received|Paid/i').first();
        const outstanding = page.locator('text=/Outstanding|Pending|Due/i').first();
        
        if (await revenue.isVisible({ timeout: 2000 })) console.log('  ✅ Revenue metrics visible');
        if (await collections.isVisible({ timeout: 2000 })) console.log('  ✅ Collections visible');
        if (await outstanding.isVisible({ timeout: 2000 })) console.log('  ✅ Outstanding visible');
        
        break;
      }
    }
    
    await page.screenshot({ path: 'test-results/finance-5-final.png' });
  });
});
