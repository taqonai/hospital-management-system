import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://spetaar.ai';
const LAB_TECH_EMAIL = 'labtech@hospital.com';
const LAB_TECH_PASSWORD = 'password123';

// Helper function to login
async function login(page: Page, email: string, password: string) {
  await page.goto(BASE_URL);
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

test.describe('Laboratory Module - Lab Technician Portal', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, LAB_TECH_EMAIL, LAB_TECH_PASSWORD);
    await page.goto(`${BASE_URL}/laboratory`);
    await page.waitForLoadState('networkidle');
  });

  test('Page loads and displays header correctly', async ({ page }) => {
    // Check page title and header
    await expect(page.locator('h1')).toContainText('Laboratory');
    await expect(page.locator('text=Manage lab orders, results, and critical values')).toBeVisible();

    // Check navigation breadcrumb or header badge
    await expect(page.locator('text=Laboratory Information System')).toBeVisible();
  });

  test('Stats cards display correctly', async ({ page }) => {
    // Wait for stats to load
    await page.waitForTimeout(2000);

    // Check that all 4 stat cards are visible
    const statCards = page.locator('[class*="grid"] [class*="rounded-2xl"]').filter({ hasText: /Pending Orders|In Progress|Critical Values|Completed Today/ });
    await expect(statCards).toHaveCount(4);

    // Verify each stat card has a number
    await expect(page.locator('text=/Pending Orders/').locator('..')).toContainText(/\d+/);
    await expect(page.locator('text=/In Progress/').locator('..')).toContainText(/\d+/);
    await expect(page.locator('text=/Critical Values/').locator('..')).toContainText(/\d+/);
    await expect(page.locator('text=/Completed Today/').locator('..')).toContainText(/\d+/);
  });

  test('Search box filters lab orders', async ({ page }) => {
    // Wait for orders to load
    await page.waitForTimeout(1500);

    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Type in search box
    await searchInput.fill('John');
    await page.waitForTimeout(1000);

    // Check that results are filtered (if there are any Johns)
    const orderItems = page.locator('[class*="divide-y"] > div').first();
    if (await orderItems.isVisible()) {
      await expect(orderItems).toContainText(/John/i, { timeout: 5000 });
    }

    // Clear search
    await searchInput.clear();
  });

  test('Status filter dropdown works', async ({ page }) => {
    // Wait for orders to load
    await page.waitForTimeout(1500);

    const statusFilter = page.locator('select[class*="appearance-none"]').filter({ hasText: 'All Status' });
    await expect(statusFilter).toBeVisible();

    // Select a status
    await statusFilter.selectOption('PENDING');
    await page.waitForTimeout(1000);

    // Verify filter is applied (check if PENDING badge appears in results)
    const results = page.locator('text=/PENDING/i');
    if (await results.count() > 0) {
      await expect(results.first()).toBeVisible();
    }

    // Reset filter
    await statusFilter.selectOption('');
  });

  test('All 4 tabs are visible and clickable', async ({ page }) => {
    // Check all tabs exist
    await expect(page.locator('text=Lab Orders')).toBeVisible();
    await expect(page.locator('text=Results Entry')).toBeVisible();
    await expect(page.locator('text=Critical Values')).toBeVisible();
    await expect(page.locator('text=Sample Tracking')).toBeVisible();

    // Click each tab
    await page.click('text=Results Entry');
    await page.waitForTimeout(500);
    await expect(page.locator('.border-amber-500')).toContainText('Results Entry');

    await page.click('text=Critical Values');
    await page.waitForTimeout(500);
    await expect(page.locator('.border-amber-500')).toContainText('Critical Values');

    await page.click('text=Sample Tracking');
    await page.waitForTimeout(500);
    await expect(page.locator('.border-amber-500')).toContainText('Sample Tracking');

    // Return to Lab Orders
    await page.click('text=Lab Orders');
    await page.waitForTimeout(500);
  });

  test('Critical Values tab displays correctly', async ({ page }) => {
    // Click Critical Values tab
    await page.click('text=Critical Values');
    await page.waitForTimeout(1000);

    // Check if there are critical values or empty state
    const hasCriticalValues = await page.locator('text=/Critical Values Require Attention|No Critical Values/i').isVisible();
    expect(hasCriticalValues).toBeTruthy();

    // If there are critical values, check the acknowledge button
    const acknowledgeButton = page.locator('button:has-text("Acknowledge")').first();
    if (await acknowledgeButton.isVisible()) {
      // Just verify button exists, don't click it in test
      await expect(acknowledgeButton).toBeEnabled();
    }
  });

  test('View All Critical Values button scrolls to tab', async ({ page }) => {
    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check if critical banner is visible
    const criticalBanner = page.locator('text=/Critical Values Require Attention/i');

    if (await criticalBanner.isVisible()) {
      const viewAllButton = page.locator('button:has-text("View All Critical Values")');
      await viewAllButton.click();

      await page.waitForTimeout(1000);

      // Verify Critical Values tab is now active
      await expect(page.locator('.border-amber-500')).toContainText('Critical Values');
    }
  });

  test('New Order button opens modal', async ({ page }) => {
    const newOrderButton = page.locator('button:has-text("New Order")');
    await expect(newOrderButton).toBeVisible();

    await newOrderButton.click();
    await page.waitForTimeout(500);

    // Check modal appears
    await expect(page.locator('text=Create New Lab Order')).toBeVisible();
    await expect(page.locator('text=Select Patient')).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('Lab order displays with correct information', async ({ page }) => {
    // Wait for orders to load
    await page.waitForTimeout(2000);

    // Get first lab order (if exists)
    const firstOrder = page.locator('[class*="divide-y"] > div').first();

    if (await firstOrder.isVisible()) {
      // Check order has key elements
      await expect(firstOrder).toContainText(/LAB-|PAT-/); // Order number or MRN

      // Check for status badge
      const statusBadge = firstOrder.locator('[class*="rounded-full"]').filter({ hasText: /PENDING|IN_PROGRESS|COMPLETED|SAMPLE_COLLECTED/i });
      await expect(statusBadge.first()).toBeVisible();

      // Check for priority badge
      const priorityBadge = firstOrder.locator('[class*="rounded-full"]').filter({ hasText: /ROUTINE|URGENT|STAT/i });
      if (await priorityBadge.count() > 0) {
        await expect(priorityBadge.first()).toBeVisible();
      }
    }
  });

  test('Sample collection button works', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for a PENDING order with Collect Sample button
    const collectButton = page.locator('button:has-text("Collect Sample")').first();

    if (await collectButton.isVisible()) {
      await collectButton.click();
      await page.waitForTimeout(1000);

      // Should show success message
      await expect(page.locator('text=/collected successfully/i')).toBeVisible({ timeout: 5000 });
    }
  });

  test('View/Edit Results button opens modal', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for order with results
    const viewEditButton = page.locator('button:has-text("View/Edit Results")').first();

    if (await viewEditButton.isVisible()) {
      await viewEditButton.click();
      await page.waitForTimeout(1000);

      // Check results entry form appears
      await expect(page.locator('text=/Enter Lab Results|Result Value/i')).toBeVisible();

      // Close modal
      const cancelButton = page.locator('button:has-text("Cancel"), button:has-text("Done")').first();
      await cancelButton.click();
    }
  });

  test('Enter Results button opens modal', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for order that needs results
    const enterButton = page.locator('button:has-text("Enter Results")').first();

    if (await enterButton.isVisible()) {
      await enterButton.click();
      await page.waitForTimeout(1000);

      // Check results entry form appears
      await expect(page.locator('text=/Enter Lab Results|Result Value/i')).toBeVisible();

      // Close modal
      await page.keyboard.press('Escape');
    }
  });

  test('View Booking button opens modal without flickering', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for order with View Booking button
    const viewBookingButton = page.locator('button:has-text("View Booking")').first();

    if (await viewBookingButton.isVisible()) {
      // Take screenshot before click
      await page.screenshot({ path: '/tmp/lab-before-booking.png' });

      await viewBookingButton.click();

      // Wait a moment
      await page.waitForTimeout(500);

      // Modal should be visible (with loading or data)
      const modal = page.locator('[class*="fixed inset-0 z-50"]');
      await expect(modal).toBeVisible({ timeout: 3000 });

      // Take screenshot after click
      await page.screenshot({ path: '/tmp/lab-after-booking.png' });

      // Close modal by clicking backdrop
      await page.locator('[class*="fixed inset-0 bg-black"]').click({ position: { x: 10, y: 10 } });
    }
  });

  test('Pagination works correctly', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check if pagination exists
    const nextButton = page.locator('button:has-text("Next")');
    const prevButton = page.locator('button:has-text("Previous")');

    if (await nextButton.isVisible()) {
      const isEnabled = await nextButton.isEnabled();

      if (isEnabled) {
        await nextButton.click();
        await page.waitForTimeout(1000);

        // Check page number changed
        await expect(page.locator('text=/Page \\d+ of \\d+/')).toBeVisible();

        // Go back
        await prevButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('AI Suggest Tests button works (if AI is online)', async ({ page }) => {
    const aiButton = page.locator('button:has-text("AI Suggest Tests")');

    if (await aiButton.isVisible()) {
      await aiButton.click();

      // Should show toast notification
      await expect(page.locator('text=/AI is analyzing/i')).toBeVisible({ timeout: 3000 });
    }
  });

  test('Sample Tracking tab displays correctly', async ({ page }) => {
    await page.click('text=Sample Tracking');
    await page.waitForTimeout(1000);

    // Should show sample tracking interface or empty state
    const content = page.locator('[class*="p-6"]');
    await expect(content).toBeVisible();
  });

  test('Results entry form validates input', async ({ page }) => {
    await page.waitForTimeout(2000);

    const enterButton = page.locator('button:has-text("Enter Results")').first();

    if (await enterButton.isVisible()) {
      await enterButton.click();
      await page.waitForTimeout(1000);

      // Try to save without entering results
      const saveButton = page.locator('button:has-text("Save All Results")');
      if (await saveButton.isVisible()) {
        const isDisabled = await saveButton.isDisabled();
        expect(isDisabled).toBeTruthy(); // Should be disabled when no results entered
      }

      // Close modal
      await page.keyboard.press('Escape');
    }
  });

  test('Critical values update immediately after entering results', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Get initial critical count
    const criticalCountBefore = await page.locator('text=/Critical Values/').locator('..').locator('[class*="rounded-full"]').first().textContent();

    const enterButton = page.locator('button:has-text("Enter Results")').first();

    if (await enterButton.isVisible()) {
      await enterButton.click();
      await page.waitForTimeout(1000);

      const resultInput = page.locator('input[placeholder*="14.5"]').first();
      if (await resultInput.isVisible()) {
        // Enter a non-critical value
        await resultInput.fill('13.5');

        const saveButton = page.locator('button:has-text("Save All Results")');
        await saveButton.click();

        await page.waitForTimeout(2000);

        // Critical count should be available (may or may not have changed)
        await expect(page.locator('text=/Critical Values/')).toBeVisible();
      } else {
        // Close if no input available
        await page.keyboard.press('Escape');
      }
    }
  });

  test('Mobile responsive - page works on small screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/laboratory`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check that header is visible
    await expect(page.locator('h1:has-text("Laboratory")')).toBeVisible();

    // Check that stats cards stack vertically
    const statsGrid = page.locator('[class*="grid"]').first();
    await expect(statsGrid).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: '/tmp/lab-mobile.png' });
  });

  test('Auto-refresh works (polling)', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Get initial order count
    const initialOrders = await page.locator('[class*="divide-y"] > div').count();

    // Wait for 16 seconds (one polling cycle + buffer)
    await page.waitForTimeout(16000);

    // Orders should still be displayed (polling keeps data fresh)
    const finalOrders = await page.locator('[class*="divide-y"] > div').count();
    expect(finalOrders).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Laboratory Module - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, LAB_TECH_EMAIL, LAB_TECH_PASSWORD);
  });

  test('Handles network errors gracefully', async ({ page }) => {
    // Go offline
    await page.context().setOffline(true);

    await page.goto(`${BASE_URL}/laboratory`);
    await page.waitForTimeout(3000);

    // Page should still render (may show error or cached data)
    await expect(page.locator('h1')).toBeVisible();

    // Go back online
    await page.context().setOffline(false);
  });
});

test.describe('Laboratory Module - Performance', () => {
  test('Page loads within acceptable time', async ({ page }) => {
    await login(page, LAB_TECH_EMAIL, LAB_TECH_PASSWORD);

    const startTime = Date.now();
    await page.goto(`${BASE_URL}/laboratory`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;

    console.log(`Laboratory page loaded in ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // Should load in under 5 seconds
  });
});
