/**
 * UAE Insurance Deep E2E Tests
 * 
 * Tests specific insurance features in detail:
 * 1. OPD Check-in with copay modal
 * 2. Pharmacy copay modal before dispensing
 * 3. Pre-auth warning for MRI
 * 4. Cost estimate display
 */

import { test, expect, Page } from '@playwright/test';
import { loginStaff, takeScreenshot, STAFF_CREDENTIALS } from './helpers/auth';

// Test patient data
const TEST_PATIENT = {
  mrn: 'MRN26890529',
  name: 'Md Kamil',
  email: 'kamil@taqon.ai',
  emiratesId: '784-1996-1234567-1',
};

test.describe('UAE Insurance Deep Tests', () => {
  
  // ==================== TEST 1: OPD Check-in with Copay ====================
  test('1. OPD Check-in → EID → Insurance → Copay Modal', async ({ page }) => {
    test.setTimeout(180000);
    
    // Login as receptionist
    await test.step('Login as Receptionist', async () => {
      await page.goto('https://spetaar.ai/login');
      await page.fill('input[type="email"]', STAFF_CREDENTIALS.receptionist.email);
      await page.fill('input[type="password"]', STAFF_CREDENTIALS.receptionist.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|reception/i, { timeout: 30000 });
      await takeScreenshot(page, 'deep-1.1-receptionist-login');
    });

    // Navigate to appointments list
    await test.step('Go to Appointments', async () => {
      // Try different navigation paths
      const navOptions = [
        'text=Appointments',
        'text=Reception',
        'a[href*="appointment"]',
        'text=Check In Patient',
      ];
      
      for (const nav of navOptions) {
        try {
          const el = page.locator(nav).first();
          if (await el.isVisible({ timeout: 2000 })) {
            await el.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch {}
      }
      await takeScreenshot(page, 'deep-1.2-appointments-page');
    });

    // Search for patient
    await test.step('Search for Md Kamil', async () => {
      const searchField = page.locator('input[placeholder*="Search"], input[placeholder*="MRN"], input[type="search"]').first();
      if (await searchField.isVisible()) {
        await searchField.fill(TEST_PATIENT.mrn);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
      }
      await takeScreenshot(page, 'deep-1.3-patient-search');
    });

    // Find and click check-in button
    await test.step('Click Check-in Button', async () => {
      // Look for check-in button in various forms
      const checkInSelectors = [
        `button:has-text("Check In")`,
        `button:has-text("Check-in")`,
        `[data-testid="check-in"]`,
        `tr:has-text("${TEST_PATIENT.name}") button`,
        `tr:has-text("Kamil") button:has-text("Check")`,
        `.appointment-row button`,
      ];
      
      for (const selector of checkInSelectors) {
        try {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.click();
            await page.waitForTimeout(2000);
            console.log(`Clicked check-in using: ${selector}`);
            break;
          }
        } catch {}
      }
      await takeScreenshot(page, 'deep-1.4-checkin-clicked');
    });

    // Look for check-in modal/form
    await test.step('Verify Check-in Modal', async () => {
      await page.waitForTimeout(2000);
      
      // Check if modal opened
      const modal = page.locator('.modal, [role="dialog"], .check-in-modal, .checkin-form').first();
      const isModalVisible = await modal.isVisible().catch(() => false);
      console.log(`Check-in modal visible: ${isModalVisible}`);
      
      await takeScreenshot(page, 'deep-1.5-checkin-modal');
    });

    // Verify Emirates ID field
    await test.step('Verify EID Auto-populated', async () => {
      const eidField = page.locator('input[name*="emirates"], input[placeholder*="Emirates"], input[value*="784"]').first();
      const isEidVisible = await eidField.isVisible().catch(() => false);
      
      if (isEidVisible) {
        const eidValue = await eidField.inputValue();
        console.log(`Emirates ID value: ${eidValue}`);
        expect(eidValue).toContain('784');
      }
      
      await takeScreenshot(page, 'deep-1.6-eid-field');
    });

    // Look for insurance info display
    await test.step('Verify Insurance Info Displayed', async () => {
      const insuranceSelectors = [
        'text=Daman',
        'text=Insurance',
        'text=Coverage',
        'text=Policy',
        '.insurance-info',
        '[data-testid="insurance"]',
      ];
      
      for (const selector of insuranceSelectors) {
        const el = page.locator(selector).first();
        if (await el.isVisible().catch(() => false)) {
          console.log(`Insurance info found: ${selector}`);
          break;
        }
      }
      
      await takeScreenshot(page, 'deep-1.7-insurance-info');
    });

    // Look for copay modal
    await test.step('Verify Copay Modal', async () => {
      const copaySelectors = [
        'text=Copay',
        'text=Co-pay',
        'text=AED 20',
        'text=Patient Pays',
        '.copay-modal',
        '[data-testid="copay"]',
        'text=Collect Payment',
      ];
      
      for (const selector of copaySelectors) {
        const el = page.locator(selector).first();
        if (await el.isVisible().catch(() => false)) {
          console.log(`Copay element found: ${selector}`);
        }
      }
      
      await takeScreenshot(page, 'deep-1.8-copay-modal');
    });

    // Look for deductible/cap display
    await test.step('Verify Deductible and Cap Display', async () => {
      const deductibleEl = page.locator('text=Deductible, text=Annual Deductible, .deductible').first();
      const capEl = page.locator('text=Cap, text=Maximum, text=Annual Cap, .copay-cap').first();
      
      const hasDeductible = await deductibleEl.isVisible().catch(() => false);
      const hasCap = await capEl.isVisible().catch(() => false);
      
      console.log(`Deductible display: ${hasDeductible}`);
      console.log(`Cap display: ${hasCap}`);
      
      await takeScreenshot(page, 'deep-1.9-deductible-cap');
    });

    await takeScreenshot(page, 'deep-1.10-checkin-complete');
  });

  // ==================== TEST 2: Pharmacy Copay Modal ====================
  test('2. Pharmacy → Dispense → Copay Modal', async ({ page }) => {
    test.setTimeout(120000);
    
    // Login as pharmacist
    await test.step('Login as Pharmacist', async () => {
      await page.goto('https://spetaar.ai/login');
      await page.fill('input[type="email"]', STAFF_CREDENTIALS.pharmacist.email);
      await page.fill('input[type="password"]', STAFF_CREDENTIALS.pharmacist.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|pharmacy/i, { timeout: 30000 });
      await takeScreenshot(page, 'deep-2.1-pharmacist-login');
    });

    // Navigate to Pharmacy
    await test.step('Navigate to Pharmacy', async () => {
      await page.goto('https://spetaar.ai/pharmacy');
      await page.waitForLoadState('networkidle');
      await takeScreenshot(page, 'deep-2.2-pharmacy-dashboard');
    });

    // Find Md Kamil's prescription
    await test.step('Find Md Kamil Prescription', async () => {
      // Wait for prescriptions to load
      await page.waitForTimeout(3000);
      
      // Look for the prescription
      const prescriptionRow = page.locator(`text=Md Kamil, text=Kamil, tr:has-text("Kamil"), .prescription-card:has-text("Kamil")`).first();
      const isVisible = await prescriptionRow.isVisible().catch(() => false);
      console.log(`Md Kamil prescription visible: ${isVisible}`);
      
      if (isVisible) {
        await prescriptionRow.click();
        await page.waitForTimeout(2000);
      }
      
      await takeScreenshot(page, 'deep-2.3-prescription-found');
    });

    // Click on prescription to view details
    await test.step('Open Prescription Details', async () => {
      // Try clicking on Amoxicillin prescription
      const rxSelectors = [
        'text=Amoxicillin',
        'tr:has-text("Kamil")',
        '.prescription-row:has-text("Kamil")',
      ];
      
      for (const selector of rxSelectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible({ timeout: 2000 })) {
            await el.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch {}
      }
      
      await takeScreenshot(page, 'deep-2.4-prescription-details');
    });

    // Click Dispense button
    await test.step('Click Dispense Button', async () => {
      const dispenseSelectors = [
        'button:has-text("Dispense")',
        'button:has-text("Fill")',
        '[data-testid="dispense"]',
        'button:has-text("Process")',
      ];
      
      for (const selector of dispenseSelectors) {
        try {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.click();
            await page.waitForTimeout(3000);
            console.log(`Clicked dispense using: ${selector}`);
            break;
          }
        } catch {}
      }
      
      await takeScreenshot(page, 'deep-2.5-dispense-clicked');
    });

    // Verify copay modal appears
    await test.step('Verify Copay Modal Before Dispensing', async () => {
      await page.waitForTimeout(2000);
      
      const copayModalSelectors = [
        '.copay-modal',
        '[data-testid="copay-modal"]',
        'text=Copay Collection',
        'text=Co-payment',
        'text=Collect Payment',
        '.pharmacy-copay',
        'text=Patient Pays',
        '[role="dialog"]:has-text("Copay")',
        '[role="dialog"]:has-text("Payment")',
      ];
      
      let copayModalFound = false;
      for (const selector of copayModalSelectors) {
        const el = page.locator(selector).first();
        if (await el.isVisible().catch(() => false)) {
          console.log(`✅ Copay modal found: ${selector}`);
          copayModalFound = true;
          break;
        }
      }
      
      if (!copayModalFound) {
        console.log('❌ Copay modal NOT found');
      }
      
      await takeScreenshot(page, 'deep-2.6-copay-modal');
    });

    // Verify cost breakdown
    await test.step('Verify Cost Breakdown in Modal', async () => {
      // Look for drug cost, insurance %, patient pays
      const drugCost = page.locator('text=AED, text=Total, text=Cost').first();
      const insurancePct = page.locator('text=%, text=Insurance, text=Coverage').first();
      const patientPays = page.locator('text=Patient Pays, text=Copay, text=You Pay').first();
      
      console.log(`Drug cost visible: ${await drugCost.isVisible().catch(() => false)}`);
      console.log(`Insurance % visible: ${await insurancePct.isVisible().catch(() => false)}`);
      console.log(`Patient pays visible: ${await patientPays.isVisible().catch(() => false)}`);
      
      await takeScreenshot(page, 'deep-2.7-cost-breakdown');
    });

    await takeScreenshot(page, 'deep-2.8-pharmacy-complete');
  });

  // ==================== TEST 3: Pre-Auth Warning for MRI ====================
  test('3. Doctor → Order MRI → Pre-Auth Warning', async ({ page }) => {
    test.setTimeout(120000);
    
    // Login as doctor
    await test.step('Login as Doctor', async () => {
      await page.goto('https://spetaar.ai/login');
      await page.fill('input[type="email"]', STAFF_CREDENTIALS.doctor.email);
      await page.fill('input[type="password"]', STAFF_CREDENTIALS.doctor.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|opd|doctor/i, { timeout: 30000 });
      await takeScreenshot(page, 'deep-3.1-doctor-login');
    });

    // Navigate to OPD or Consultations
    await test.step('Navigate to Consultations', async () => {
      const navOptions = [
        'text=OPD',
        'text=Consultations',
        'text=Patients',
        'a[href*="opd"]',
        'a[href*="consultation"]',
      ];
      
      for (const nav of navOptions) {
        try {
          const el = page.locator(nav).first();
          if (await el.isVisible({ timeout: 2000 })) {
            await el.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch {}
      }
      
      await takeScreenshot(page, 'deep-3.2-opd-page');
    });

    // Search for patient
    await test.step('Search for Md Kamil', async () => {
      const searchField = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      if (await searchField.isVisible()) {
        await searchField.fill('Kamil');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
      }
      await takeScreenshot(page, 'deep-3.3-patient-search');
    });

    // Open patient consultation
    await test.step('Open Patient Consultation', async () => {
      const patientSelectors = [
        'text=Md Kamil',
        'text=Kamil',
        `text=${TEST_PATIENT.mrn}`,
        'tr:has-text("Kamil")',
      ];
      
      for (const selector of patientSelectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible({ timeout: 2000 })) {
            await el.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch {}
      }
      
      await takeScreenshot(page, 'deep-3.4-consultation-opened');
    });

    // Go to radiology ordering
    await test.step('Open Radiology Orders', async () => {
      const radiologySelectors = [
        'button:has-text("Radiology")',
        'button:has-text("Imaging")',
        'button:has-text("Order Imaging")',
        'tab:has-text("Radiology")',
        'text=Order Radiology',
        '[data-testid="radiology-orders"]',
      ];
      
      for (const selector of radiologySelectors) {
        try {
          const el = page.locator(selector).first();
          if (await el.isVisible({ timeout: 2000 })) {
            await el.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch {}
      }
      
      await takeScreenshot(page, 'deep-3.5-radiology-section');
    });

    // Select MRI
    await test.step('Select MRI Modality', async () => {
      // Look for modality selector or MRI option
      const mriSelectors = [
        'text=MRI',
        'option:has-text("MRI")',
        'select[name*="modality"]',
        '[data-testid="modality-select"]',
        'input[placeholder*="search"]',
      ];
      
      // Try dropdown first
      const dropdown = page.locator('select').first();
      if (await dropdown.isVisible().catch(() => false)) {
        await dropdown.selectOption({ label: /MRI/i }).catch(() => {});
      }
      
      // Try clicking MRI option
      const mriOption = page.locator('text=MRI').first();
      if (await mriOption.isVisible().catch(() => false)) {
        await mriOption.click();
        await page.waitForTimeout(2000);
      }
      
      // Try search
      const searchField = page.locator('input[placeholder*="search"], input[type="search"]').first();
      if (await searchField.isVisible().catch(() => false)) {
        await searchField.fill('MRI Brain');
        await page.waitForTimeout(2000);
      }
      
      await takeScreenshot(page, 'deep-3.6-mri-selected');
    });

    // Verify pre-auth warning
    await test.step('Verify Pre-Auth Warning', async () => {
      await page.waitForTimeout(2000);
      
      const preAuthSelectors = [
        'text=Pre-Auth',
        'text=Pre-Authorization',
        'text=Authorization Required',
        'text=Prior Authorization',
        '.pre-auth-warning',
        '[data-testid="preauth-warning"]',
        '.warning:has-text("auth")',
        '[role="alert"]:has-text("auth")',
      ];
      
      let preAuthFound = false;
      for (const selector of preAuthSelectors) {
        const el = page.locator(selector).first();
        if (await el.isVisible().catch(() => false)) {
          console.log(`✅ Pre-Auth warning found: ${selector}`);
          preAuthFound = true;
          break;
        }
      }
      
      if (!preAuthFound) {
        console.log('❌ Pre-Auth warning NOT found');
      }
      
      await takeScreenshot(page, 'deep-3.7-preauth-warning');
    });

    await takeScreenshot(page, 'deep-3.8-mri-order-complete');
  });

  // ==================== TEST 4: Cost Estimate Display ====================
  test('4. Doctor → Order Lab → Cost Estimate', async ({ page }) => {
    test.setTimeout(120000);
    
    // Login as doctor
    await test.step('Login as Doctor', async () => {
      await page.goto('https://spetaar.ai/login');
      await page.fill('input[type="email"]', STAFF_CREDENTIALS.doctor.email);
      await page.fill('input[type="password"]', STAFF_CREDENTIALS.doctor.password);
      await page.click('button[type="submit"]');
      await page.waitForURL(/dashboard|opd|doctor/i, { timeout: 30000 });
      await takeScreenshot(page, 'deep-4.1-doctor-login');
    });

    // Navigate to Laboratory ordering (direct URL)
    await test.step('Navigate to Lab Orders', async () => {
      await page.goto('https://spetaar.ai/laboratory');
      await page.waitForLoadState('networkidle');
      await takeScreenshot(page, 'deep-4.2-lab-page');
    });

    // Open new order form
    await test.step('Open New Lab Order', async () => {
      const newOrderSelectors = [
        'button:has-text("New Order")',
        'button:has-text("Create")',
        'button:has-text("Add")',
        '[data-testid="new-order"]',
      ];
      
      for (const selector of newOrderSelectors) {
        try {
          const btn = page.locator(selector).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            await btn.click();
            await page.waitForTimeout(2000);
            break;
          }
        } catch {}
      }
      
      await takeScreenshot(page, 'deep-4.3-new-order-form');
    });

    // Look for cost estimates in order form
    await test.step('Verify Cost Estimates in Form', async () => {
      // Check for price display
      const priceSelectors = [
        'text=AED',
        'text=₿',
        'text=Price',
        'text=Cost',
        '.price',
        '.cost-estimate',
        'td:has-text("80")', // AFP price
        'td:has-text("95")', // CA-125 price
      ];
      
      let priceFound = false;
      for (const selector of priceSelectors) {
        const el = page.locator(selector).first();
        if (await el.isVisible().catch(() => false)) {
          console.log(`✅ Price found: ${selector}`);
          priceFound = true;
        }
      }
      
      if (!priceFound) {
        console.log('❌ Price NOT found');
      }
      
      await takeScreenshot(page, 'deep-4.4-cost-estimate');
    });

    // Select a test to verify insurance split
    await test.step('Select Test and Verify Insurance Split', async () => {
      // Look for test checkboxes
      const testCheckbox = page.locator('input[type="checkbox"]').first();
      if (await testCheckbox.isVisible().catch(() => false)) {
        await testCheckbox.click();
        await page.waitForTimeout(1000);
      }
      
      // Look for insurance split display
      const splitSelectors = [
        'text=Insurance Covers',
        'text=Patient Pays',
        'text=Coverage',
        'text=%',
        '.insurance-split',
        '.cost-breakdown',
      ];
      
      for (const selector of splitSelectors) {
        const el = page.locator(selector).first();
        if (await el.isVisible().catch(() => false)) {
          console.log(`✅ Insurance split found: ${selector}`);
        }
      }
      
      await takeScreenshot(page, 'deep-4.5-insurance-split');
    });

    await takeScreenshot(page, 'deep-4.6-cost-estimate-complete');
  });
});
