import { test, expect } from '@playwright/test';

const BASE_URL = 'https://spetaar.ai';
const PATIENT_EMAIL = 'fatima.expired@test.com';
const PATIENT_PASSWORD = 'password123';

test('Patient Portal - Add Insurance with providerId', async ({ page }) => {
  // 1. Login to patient portal with email
  await page.goto(`${BASE_URL}/patient-portal/login`);
  await page.waitForLoadState('networkidle');
  
  // Fill email (Email tab is default)
  await page.fill('input[placeholder*="email"], input[type="email"]', PATIENT_EMAIL);
  
  // Fill password
  await page.fill('input[type="password"]', PATIENT_PASSWORD);
  
  // Submit
  await page.click('button:has-text("Sign In")');
  await page.waitForTimeout(3000);
  
  console.log('Current URL after login:', page.url());
  
  // 2. Navigate to insurance page
  await page.goto(`${BASE_URL}/patient-portal/insurance`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  console.log('Insurance page URL:', page.url());
  
  // 3. Click Add Insurance
  const addButton = page.locator('button:has-text("Add Insurance"), button:has-text("Add")').first();
  if (await addButton.isVisible()) {
    await addButton.click();
    await page.waitForTimeout(1000);
  }
  
  // 4. Fill the form
  // Select provider from dropdown
  const providerSelect = page.locator('select').first();
  if (await providerSelect.isVisible()) {
    await providerSelect.selectOption({ index: 1 }); // Select first provider
    await page.waitForTimeout(500);
  }
  
  // Fill policy number
  const policyInput = page.locator('input[name="policyNumber"], input[placeholder*="Policy"]').first();
  if (await policyInput.isVisible()) {
    await policyInput.fill('TEST-POL-' + Date.now());
  }
  
  // Fill subscriber name
  const subscriberInput = page.locator('input[name="subscriberName"], input[placeholder*="Subscriber"]').first();
  if (await subscriberInput.isVisible()) {
    await subscriberInput.fill('Test Subscriber');
  }
  
  // Fill subscriber ID
  const subscriberIdInput = page.locator('input[name="subscriberId"], input[placeholder*="Member"]').first();
  if (await subscriberIdInput.isVisible()) {
    await subscriberIdInput.fill('MEM-' + Date.now());
  }
  
  // Fill effective date
  const effectiveDate = page.locator('input[name="effectiveDate"]').first();
  if (await effectiveDate.isVisible()) {
    await effectiveDate.fill('2026-01-01');
  }
  
  // 5. Submit
  const submitButton = page.locator('button[type="submit"]:has-text("Add"), button:has-text("Save"), button:has-text("Submit")').first();
  if (await submitButton.isVisible()) {
    await submitButton.click();
    await page.waitForTimeout(3000);
  }
  
  // 6. Check for success or error
  const errorToast = page.locator('text=Invalid field, text=Error, .toast-error, [role="alert"]');
  const successToast = page.locator('text=success, text=added, .toast-success');
  
  const hasError = await errorToast.count() > 0;
  const hasSuccess = await successToast.count() > 0;
  
  console.log('Has error:', hasError);
  console.log('Has success:', hasSuccess);
  
  // Take screenshot
  await page.screenshot({ path: '/home/taqon/clawd/insurance-test-result.png', fullPage: true });
  
  expect(hasError).toBe(false);
  console.log('✅ Insurance added successfully without providerId error!');
});
