import { test, expect } from '@playwright/test';

const BASE_URL = 'https://spetaar.ai';

test('Check Today\'s Appointments Tab for Check-in Buttons', async ({ page }) => {
  test.setTimeout(60000);
  
  // Login as receptionist
  await page.goto(`${BASE_URL}/login`);
  await page.locator('#email').fill('receptionist@hospital.com');
  await page.locator('#password').fill('password123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  console.log('✅ Logged in');
  
  // Go to OPD
  await page.goto(`${BASE_URL}/opd`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Click Today's Appointments tab
  const todayTab = page.locator('button:has-text("Today\'s Appointments"), [role="tab"]:has-text("Today")');
  if (await todayTab.isVisible({ timeout: 5000 })) {
    await todayTab.click();
    await page.waitForTimeout(2000);
    console.log('✅ Clicked Today\'s Appointments tab');
  }
  
  await page.screenshot({ path: 'test-results/todays-appointments.png' });
  
  // Count Check In buttons
  const checkInButtons = await page.locator('button:has-text("Check In")').all();
  console.log(`\n📊 Found ${checkInButtons.length} Check In buttons`);
  
  // List all appointments
  const appointmentRows = await page.locator('tr, [class*="appointment"], [class*="patient"]').all();
  console.log(`Found ${appointmentRows.length} appointment rows`);
  
  // Get text of visible patients
  const patientNames = await page.locator('text=Kamil, text=Sara, text=Anindya, text=Fatima').allTextContents();
  console.log('Visible patients:', patientNames);
  
  // Check for specific statuses
  const scheduledCount = await page.locator('text=SCHEDULED, text=Scheduled').count();
  const confirmedCount = await page.locator('text=CONFIRMED, text=Confirmed').count();
  const awaitingCount = await page.locator('text=Awaiting').count();
  
  console.log(`\nStatuses: SCHEDULED=${scheduledCount}, CONFIRMED=${confirmedCount}, Awaiting=${awaitingCount}`);
});
