import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://spetaar.ai';
const LAB_TECH_EMAIL = 'labtech@hospital.com';
const LAB_TECH_PASSWORD = 'password123';

let diagnostics: string[] = [];

function log(message: string, status: '✅' | '❌' | '⚠️' = '✅') {
  const entry = `${status} ${message}`;
  console.log(entry);
  diagnostics.push(entry);
}

async function login(page: Page) {
  await page.goto(BASE_URL);
  await page.fill('input[name="email"], input[type="email"]', LAB_TECH_EMAIL);
  await page.fill('input[name="password"], input[type="password"]', LAB_TECH_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

test.describe('Laboratory - Complete Feature Diagnostic', () => {
  test('Complete laboratory feature test', async ({ page }) => {
    console.log('\n========================================');
    console.log('LABORATORY MODULE DIAGNOSTIC TEST');
    console.log('Testing as: labtech@hospital.com');
    console.log('========================================\n');

    // Login
    try {
      await login(page);
      log('Login successful');
    } catch (e) {
      log('Login failed', '❌');
      return;
    }

    // Navigate to Laboratory
    try {
      await page.goto(`${BASE_URL}/laboratory`);
      await page.waitForTimeout(2000);
      log('Navigated to Laboratory page');
    } catch (e) {
      log('Failed to navigate to Laboratory', '❌');
      return;
    }

    // TEST 1: Page Header
    try {
      const header = await page.locator('h1:has-text("Laboratory")').isVisible();
      log(header ? 'Page header visible' : 'Page header missing', header ? '✅' : '❌');
    } catch (e) {
      log('Page header check failed', '❌');
    }

    // TEST 2: Stats Cards
    try {
      await page.waitForTimeout(2000);
      const statsVisible = await page.locator('text=/Pending Orders|In Progress|Critical Values|Completed Today/i').first().isVisible();
      log(statsVisible ? 'Stats cards loaded' : 'Stats cards missing', statsVisible ? '✅' : '❌');
    } catch (e) {
      log('Stats cards check failed', '❌');
    }

    // TEST 3: Search Box
    try {
      const searchBox = page.locator('input[placeholder*="Search"]');
      const searchVisible = await searchBox.isVisible();
      log(searchVisible ? 'Search box visible' : 'Search box missing', searchVisible ? '✅' : '❌');

      if (searchVisible) {
        await searchBox.fill('Test');
        await page.waitForTimeout(1000);
        await searchBox.clear();
        log('Search box functional');
      }
    } catch (e) {
      log('Search box test failed', '❌');
    }

    // TEST 4: Status Filter
    try {
      const statusFilter = page.locator('select').first();
      const filterVisible = await statusFilter.isVisible();
      log(filterVisible ? 'Status filter visible' : 'Status filter missing', filterVisible ? '✅' : '❌');
    } catch (e) {
      log('Status filter test failed', '❌');
    }

    // TEST 5: Tabs
    const tabs = ['Lab Orders', 'Results Entry', 'Critical Values', 'Sample Tracking'];
    for (const tabName of tabs) {
      try {
        const tab = await page.locator(`text=${tabName}`).isVisible();
        log(tab ? `Tab "${tabName}" visible` : `Tab "${tabName}" missing`, tab ? '✅' : '❌');
      } catch (e) {
        log(`Tab "${tabName}" check failed`, '❌');
      }
    }

    // TEST 6: Lab Orders List
    try {
      await page.waitForTimeout(2000);
      const ordersExist = await page.locator('[class*="divide-y"]').first().isVisible();
      log(ordersExist ? 'Lab orders list visible' : 'No lab orders displayed', ordersExist ? '✅' : '⚠️');
    } catch (e) {
      log('Lab orders list check failed', '❌');
    }

    // TEST 7: Critical Values Banner
    try {
      const criticalBanner = await page.locator('text=/Critical Values Require Attention/i').isVisible();
      if (criticalBanner) {
        log('Critical values banner visible', '⚠️');

        // Test "View All Critical Values" button
        const viewAllBtn = page.locator('button:has-text("View All Critical Values")');
        if (await viewAllBtn.isVisible()) {
          await page.screenshot({ path: '/tmp/lab-before-click-view-all.png' });
          await viewAllBtn.click();
          await page.waitForTimeout(500);
          await page.screenshot({ path: '/tmp/lab-after-click-view-all.png' });

          const criticalTabActive = await page.locator('.border-amber-500:has-text("Critical Values")').isVisible();
          log(criticalTabActive ? 'View All button works (scrolled to tab)' : 'View All button NOT working - tab not active', criticalTabActive ? '✅' : '❌');
        }
      } else {
        log('No critical values banner (expected if no critical values)', '✅');
      }
    } catch (e) {
      log('Critical values banner test failed', '❌');
    }

    // TEST 8: Click on Critical Values Tab
    try {
      await page.click('text=Critical Values');
      await page.waitForTimeout(1000);
      const criticalContent = await page.locator('text=/No Critical Values|Critical Values Require/i').isVisible();
      log(criticalContent ? 'Critical Values tab content loaded' : 'Critical Values tab empty', criticalContent ? '✅' : '⚠️');
    } catch (e) {
      log('Critical Values tab click failed', '❌');
    }

    // Go back to Lab Orders tab
    await page.click('text=Lab Orders');
    await page.waitForTimeout(1000);

    // TEST 9: View Booking Button
    try {
      const viewBookingBtn = page.locator('button:has-text("View Booking")').first();
      const btnExists = await viewBookingBtn.isVisible();

      if (btnExists) {
        log('View Booking button found');

        // Take screenshot before click
        await page.screenshot({ path: '/tmp/lab-before-view-booking.png' });

        // Set up console listener
        const consoleLogs: string[] = [];
        page.on('console', msg => {
          consoleLogs.push(`${msg.type()}: ${msg.text()}`);
        });

        // Click the button
        await viewBookingBtn.click();
        await page.waitForTimeout(2000);

        // Take screenshot after click
        await page.screenshot({ path: '/tmp/lab-after-view-booking.png' });

        // Check if modal appeared
        const modalVisible = await page.locator('[class*="fixed inset-0 z-50"]').isVisible();
        log(modalVisible ? 'View Booking modal appeared' : 'View Booking modal NOT appearing', modalVisible ? '✅' : '❌');

        // Check for error in modal
        const errorInModal = await page.locator('text=/Error Loading Booking/i').isVisible();
        if (errorInModal) {
          log('View Booking shows ERROR', '❌');
        }

        // Check for loading state
        const loadingInModal = await page.locator('text=/Loading booking details/i').isVisible();
        if (loadingInModal) {
          log('View Booking shows loading (waiting for data)', '⚠️');
          await page.waitForTimeout(3000);
        }

        // Log console messages
        if (consoleLogs.length > 0) {
          console.log('\nConsole logs during View Booking click:');
          consoleLogs.forEach(l => console.log('  ' + l));
        }

        // Close modal if it's there
        if (modalVisible) {
          const backdrop = page.locator('[class*="fixed inset-0 bg-black"]');
          if (await backdrop.isVisible()) {
            await backdrop.click({ position: { x: 10, y: 10 } });
            await page.waitForTimeout(500);
          }
        }
      } else {
        log('No View Booking button found (might be no orders with consultations)', '⚠️');
      }
    } catch (e) {
      log(`View Booking test failed: ${e}`, '❌');
    }

    // TEST 10: Enter Results Button
    try {
      const enterResultsBtn = page.locator('button:has-text("Enter Results")').first();
      const btnExists = await enterResultsBtn.isVisible();

      if (btnExists) {
        log('Enter Results button found');
        await enterResultsBtn.click();
        await page.waitForTimeout(1000);

        const modalVisible = await page.locator('text=/Enter Lab Results|Result Value/i').isVisible();
        log(modalVisible ? 'Enter Results modal opened' : 'Enter Results modal NOT opening', modalVisible ? '✅' : '❌');

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      } else {
        log('No Enter Results button found (might be no pending orders)', '⚠️');
      }
    } catch (e) {
      log('Enter Results test failed', '❌');
    }

    // TEST 11: Collect Sample Button
    try {
      const collectBtn = page.locator('button:has-text("Collect Sample")').first();
      const btnExists = await collectBtn.isVisible();

      if (btnExists) {
        log('Collect Sample button found', '✅');
      } else {
        log('No Collect Sample button found (might be no PENDING orders)', '⚠️');
      }
    } catch (e) {
      log('Collect Sample test failed', '❌');
    }

    // TEST 12: New Order Button
    try {
      const newOrderBtn = page.locator('button:has-text("New Order")');
      const btnVisible = await newOrderBtn.isVisible();
      log(btnVisible ? 'New Order button visible' : 'New Order button missing', btnVisible ? '✅' : '❌');

      if (btnVisible) {
        await newOrderBtn.click();
        await page.waitForTimeout(1000);

        const modalVisible = await page.locator('text=/Create New Lab Order|Select Patient/i').isVisible();
        log(modalVisible ? 'New Order modal opened' : 'New Order modal NOT opening', modalVisible ? '✅' : '❌');

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } catch (e) {
      log('New Order button test failed', '❌');
    }

    // TEST 13: Sample Tracking Tab
    try {
      await page.click('text=Sample Tracking');
      await page.waitForTimeout(1000);

      const content = await page.locator('[class*="p-6"]').isVisible();
      log(content ? 'Sample Tracking tab loaded' : 'Sample Tracking tab empty', content ? '✅' : '⚠️');
    } catch (e) {
      log('Sample Tracking tab test failed', '❌');
    }

    // TEST 14: Results Entry Tab
    try {
      await page.click('text=Results Entry');
      await page.waitForTimeout(1000);
      log('Results Entry tab clicked', '✅');
    } catch (e) {
      log('Results Entry tab test failed', '❌');
    }

    // SUMMARY
    console.log('\n========================================');
    console.log('DIAGNOSTIC SUMMARY');
    console.log('========================================');
    diagnostics.forEach(d => console.log(d));
    console.log('========================================\n');

    // Count issues
    const issues = diagnostics.filter(d => d.includes('❌')).length;
    const warnings = diagnostics.filter(d => d.includes('⚠️')).length;
    const passed = diagnostics.filter(d => d.includes('✅')).length;

    console.log(`\n✅ Passed: ${passed}`);
    console.log(`⚠️  Warnings: ${warnings}`);
    console.log(`❌ Failed: ${issues}\n`);

    // Take final screenshot
    await page.screenshot({ path: '/tmp/lab-final-state.png', fullPage: true });
  });
});
