import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://spetaar.ai';
const SCREENSHOT_DIR = './test-results/radiology-fix';

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

test('Radiology Patient Selection - Detailed Test', async ({ page }) => {
  test.setTimeout(180000);
  
  // Login as doctor
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  
  await page.fill('input[type="email"]', 'idiamin@hospital.com');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await screenshot(page, '01-logged-in');
  
  // Go to radiology
  await page.goto(`${BASE_URL}/radiology`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await screenshot(page, '02-radiology-page');
  
  // Click New Order
  await page.locator('button:has-text("New Order")').click();
  await page.waitForTimeout(1500);
  await screenshot(page, '03-new-order-modal');
  
  // Find the patient search input
  const searchInput = page.locator('input[placeholder*="Search by name"]').or(page.locator('input[placeholder*="MRN"]'));
  
  // Try different search terms
  const searchTerms = ['a', 'test', 'md', 'david', 'patient', 'lee'];
  
  for (const term of searchTerms) {
    await searchInput.first().clear();
    await searchInput.first().type(term, { delay: 100 }); // Type slowly
    await page.waitForTimeout(2500); // Wait for API
    
    await screenshot(page, `04-search-${term}`);
    
    // Check for dropdown
    const dropdown = page.locator('.absolute.z-10 button').or(page.locator('[role="listbox"] button')).or(page.locator('button.w-full.text-left'));
    const dropdownCount = await dropdown.count();
    
    console.log(`Search "${term}": Found ${dropdownCount} dropdown items`);
    
    if (dropdownCount > 0) {
      await screenshot(page, `05-dropdown-found-${term}`);
      
      // Try to click first result
      await dropdown.first().click();
      await page.waitForTimeout(1000);
      await screenshot(page, `06-after-click-${term}`);
      
      // Check if patient was selected
      const changeBtn = page.locator('button:has-text("Change")').or(page.locator('text=Change'));
      const selectedPatient = page.locator('.bg-green-50').or(page.locator('[class*="green"]'));
      
      if (await changeBtn.first().isVisible({ timeout: 3000 }) || await selectedPatient.first().isVisible({ timeout: 3000 })) {
        console.log(`✅ Patient selected successfully with search term "${term}"!`);
        await screenshot(page, `07-patient-selected-${term}`);
        
        // Now try to complete the form
        // Select MRI modality
        const modalitySelect = page.locator('select').first();
        await modalitySelect.selectOption({ label: 'MRI' });
        await page.waitForTimeout(500);
        await screenshot(page, '08-mri-selected');
        
        // Select body part
        const bodyPartSelect = page.locator('select').nth(1);
        await bodyPartSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);
        await screenshot(page, '09-bodypart-selected');
        
        // Check submit button
        const submitBtn = page.locator('button:has-text("Create Order")');
        const isDisabled = await submitBtn.isDisabled();
        console.log(`Submit button disabled: ${isDisabled}`);
        await screenshot(page, `10-submit-button-${isDisabled ? 'disabled' : 'enabled'}`);
        
        if (!isDisabled) {
          console.log('✅ BUG 2 VERIFIED FIXED: Submit button is enabled!');
          
          // Check for cost estimate
          const costEst = page.locator('text=AED').or(page.locator('text=Insurance')).or(page.locator('text=Coverage'));
          if (await costEst.first().isVisible({ timeout: 2000 })) {
            console.log('✅ Cost estimate visible!');
            await screenshot(page, '11-cost-estimate');
          }
          
          // Check for pre-auth warning
          const preAuth = page.locator('text=pre-auth').or(page.locator('text=authorization')).or(page.locator('text=requires'));
          if (await preAuth.first().isVisible({ timeout: 2000 })) {
            console.log('✅ Pre-auth warning visible!');
            await screenshot(page, '12-preauth-warning');
          }
        }
        
        return; // Success, exit
      }
    }
  }
  
  console.log('⚠️ No patients found in dropdown with any search term');
  
  // Try Walk-in Patient mode
  const walkinTab = page.locator('button:has-text("Walk-in Patient")');
  if (await walkinTab.isVisible({ timeout: 3000 })) {
    await walkinTab.click();
    await page.waitForTimeout(1500);
    await screenshot(page, '13-walkin-mode');
    console.log('Switched to Walk-in Patient mode');
  }
});
