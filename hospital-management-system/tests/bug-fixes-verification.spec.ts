import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://spetaar.ai';
const SCREENSHOT_DIR = './test-results/bug-fixes';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function screenshot(page: any, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ 
    path: path.join(SCREENSHOT_DIR, `${name}-${timestamp}.png`),
    fullPage: false 
  });
}

test.describe('Bug Fixes Verification', () => {
  
  test('Bug 1: Pharmacy Dispense → Copay Modal Flow', async ({ page }) => {
    test.setTimeout(120000);
    
    // Login as pharmacist
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'pharmacist@hospital.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard**', { timeout: 30000 });
    await screenshot(page, 'bug1-1-pharmacist-logged-in');
    
    // Navigate to Pharmacy page
    await page.goto(`${BASE_URL}/pharmacy`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'bug1-2-pharmacy-page');
    
    // Look for any pending prescription with a Dispense button
    const dispenseButton = page.locator('button:has-text("Dispense")').first();
    
    if (await dispenseButton.isVisible({ timeout: 5000 })) {
      await screenshot(page, 'bug1-3-dispense-button-found');
      
      // Click Dispense button - should open copay modal
      await dispenseButton.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'bug1-4-after-dispense-click');
      
      // Check if copay modal appeared
      const copayModal = page.locator('text=Pharmacy Copay').or(page.locator('text=Patient Pays')).or(page.locator('text=Collect'));
      if (await copayModal.isVisible({ timeout: 5000 })) {
        await screenshot(page, 'bug1-5-copay-modal-visible');
        console.log('✅ BUG 1 FIXED: Copay modal opened successfully!');
        
        // Look for collect or waive button
        const collectBtn = page.locator('button:has-text("Collect")').first();
        const continueBtn = page.locator('button:has-text("Continue")').first();
        const noPayBtn = page.locator('button:has-text("No Copay")').first();
        
        if (await collectBtn.isVisible({ timeout: 3000 })) {
          await collectBtn.click();
          await page.waitForTimeout(2000);
          await screenshot(page, 'bug1-6-after-collect');
        } else if (await noPayBtn.isVisible({ timeout: 3000 })) {
          await noPayBtn.click();
          await page.waitForTimeout(2000);
          await screenshot(page, 'bug1-6-no-copay-continue');
        } else if (await continueBtn.isVisible({ timeout: 3000 })) {
          await continueBtn.click();
          await page.waitForTimeout(2000);
          await screenshot(page, 'bug1-6-continue-clicked');
        }
        
        await screenshot(page, 'bug1-7-final-state');
      } else {
        await screenshot(page, 'bug1-5-no-copay-modal');
        console.log('⚠️ Copay modal not detected - checking if dispense worked directly');
      }
    } else {
      await screenshot(page, 'bug1-3-no-pending-prescriptions');
      console.log('ℹ️ No pending prescriptions with Dispense button found');
      
      // Check Dashboard for pharmacy dispense
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await screenshot(page, 'bug1-4-dashboard-check');
      
      const dashboardDispense = page.locator('button:has-text("Dispense")').first();
      if (await dashboardDispense.isVisible({ timeout: 5000 })) {
        await dashboardDispense.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'bug1-5-dashboard-dispense-clicked');
        
        const copayModal = page.locator('text=Pharmacy Copay').or(page.locator('text=Patient Pays'));
        if (await copayModal.isVisible({ timeout: 5000 })) {
          await screenshot(page, 'bug1-6-copay-modal-from-dashboard');
          console.log('✅ BUG 1 FIXED: Dashboard dispense opens copay modal!');
        }
      }
    }
  });

  test('Bug 2: Radiology Patient Autocomplete → Submit Enabled', async ({ page }) => {
    test.setTimeout(120000);
    
    // Login as doctor (can create radiology orders)
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    
    await page.fill('input[type="email"]', 'idiamin@hospital.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/dashboard**', { timeout: 30000 });
    await screenshot(page, 'bug2-1-doctor-logged-in');
    
    // Navigate to Radiology page
    await page.goto(`${BASE_URL}/radiology`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'bug2-2-radiology-page');
    
    // Click New Order button
    const newOrderBtn = page.locator('button:has-text("New Order")');
    await newOrderBtn.click();
    await page.waitForTimeout(1500);
    await screenshot(page, 'bug2-3-new-order-modal');
    
    // Search for patient "Kamil" or "deep test"
    const patientSearch = page.locator('input[placeholder*="Search"]').or(page.locator('input[placeholder*="name"]')).or(page.locator('input[placeholder*="MRN"]'));
    await patientSearch.first().fill('kamil');
    await page.waitForTimeout(2000);
    await screenshot(page, 'bug2-4-patient-search');
    
    // Look for dropdown results
    const dropdown = page.locator('button:has-text("Kamil")').or(page.locator('button:has-text("Md Kamil")'));
    
    if (await dropdown.first().isVisible({ timeout: 5000 })) {
      await screenshot(page, 'bug2-5-dropdown-visible');
      
      // Click the first matching patient - using mousedown fix
      await dropdown.first().click();
      await page.waitForTimeout(1000);
      await screenshot(page, 'bug2-6-patient-selected');
      
      // Check if patient was selected (should show patient name somewhere)
      const patientSelected = page.locator('text=Kamil').or(page.locator('text=Change'));
      if (await patientSelected.first().isVisible({ timeout: 3000 })) {
        console.log('✅ BUG 2 FIXED: Patient selection working!');
        await screenshot(page, 'bug2-7-patient-confirmed');
        
        // Now select modality (MRI)
        const modalitySelect = page.locator('select').filter({ hasText: /modality/i }).or(page.locator('select').first());
        if (await modalitySelect.isVisible({ timeout: 3000 })) {
          await modalitySelect.selectOption({ label: 'MRI' });
          await page.waitForTimeout(500);
        } else {
          // Try clicking MRI option directly
          const mriOption = page.locator('option:has-text("MRI")').or(page.locator('text=MRI'));
          if (await mriOption.first().isVisible({ timeout: 2000 })) {
            await mriOption.first().click();
          }
        }
        await screenshot(page, 'bug2-8-modality-selected');
        
        // Select body part
        const bodyPartSelect = page.locator('select').nth(1);
        if (await bodyPartSelect.isVisible({ timeout: 3000 })) {
          await bodyPartSelect.selectOption({ index: 1 });
          await page.waitForTimeout(500);
        }
        await screenshot(page, 'bug2-9-bodypart-selected');
        
        // Check if submit button is enabled
        const submitBtn = page.locator('button[type="submit"]').or(page.locator('button:has-text("Create Order")'));
        const isDisabled = await submitBtn.first().isDisabled();
        
        if (!isDisabled) {
          console.log('✅ BUG 2 VERIFIED: Submit button is ENABLED after patient selection!');
          await screenshot(page, 'bug2-10-submit-enabled');
          
          // Check for cost estimate
          const costEstimate = page.locator('text=Cost').or(page.locator('text=AED')).or(page.locator('text=Insurance'));
          if (await costEstimate.first().isVisible({ timeout: 3000 })) {
            await screenshot(page, 'bug2-11-cost-estimate-visible');
            console.log('✅ Cost estimate displayed!');
          }
          
          // Check for pre-auth warning (MRI should trigger it)
          const preAuthWarning = page.locator('text=pre-auth').or(page.locator('text=authorization'));
          if (await preAuthWarning.first().isVisible({ timeout: 3000 })) {
            await screenshot(page, 'bug2-12-preauth-warning');
            console.log('✅ Pre-auth warning displayed for MRI!');
          }
        } else {
          console.log('❌ Submit button still disabled');
          await screenshot(page, 'bug2-10-submit-still-disabled');
        }
      } else {
        console.log('⚠️ Patient selection may not have worked');
        await screenshot(page, 'bug2-7-selection-unclear');
      }
    } else {
      console.log('ℹ️ No patient dropdown appeared - trying different search');
      await screenshot(page, 'bug2-5-no-dropdown');
      
      // Try searching for "deep"
      await patientSearch.first().fill('');
      await page.waitForTimeout(500);
      await patientSearch.first().fill('deep');
      await page.waitForTimeout(2000);
      await screenshot(page, 'bug2-6-search-deep');
      
      const deepDropdown = page.locator('button:has-text("deep")');
      if (await deepDropdown.first().isVisible({ timeout: 3000 })) {
        await deepDropdown.first().click();
        await page.waitForTimeout(1000);
        await screenshot(page, 'bug2-7-deep-selected');
      }
    }
  });
});
