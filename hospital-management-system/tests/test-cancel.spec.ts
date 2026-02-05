import { test, expect } from '@playwright/test';

test('Pre-Auth Cancel Button Closes Modal', async ({ page }) => {
  // Login first
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  
  // Fill login form using IDs
  await page.locator('#email').fill('admin@spetaar.com');
  await page.locator('#password').fill('admin123');
  await page.locator('button:has-text("Sign in")').click();
  
  // Wait for redirect
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('✓ Logged in successfully');
  
  // Navigate to Pre-Auth page
  await page.goto('http://localhost:3000/insurance/pre-auth');
  await page.waitForLoadState('networkidle');
  
  // Click "New Pre-Auth Request" button
  await page.locator('button:has-text("New Pre-Auth Request")').click();
  
  // Verify modal is open
  await expect(page.locator('h2:has-text("New Pre-Authorization Request")')).toBeVisible({ timeout: 5000 });
  console.log('✓ Modal opened');
  
  // Click Cancel button
  await page.locator('button:has-text("Cancel")').click();
  
  // Wait a moment and verify modal is closed
  await page.waitForTimeout(500);
  const isVisible = await page.locator('h2:has-text("New Pre-Authorization Request")').isVisible();
  
  if (isVisible) {
    console.log('✗ BUG CONFIRMED: Modal still visible after clicking Cancel!');
    await page.screenshot({ path: 'test-results/cancel-bug-screenshot.png' });
  } else {
    console.log('✓ Modal closed correctly via Cancel button');
  }
  
  expect(isVisible).toBe(false);
});
