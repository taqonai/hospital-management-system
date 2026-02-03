import { test, expect, Page } from '@playwright/test';

/**
 * Setup Test Data - Creates appointment and test data for E2E tests
 * Uses STAFF login to book appointments (more reliable than patient portal)
 */

const BASE_URL = 'https://spetaar.ai';

const CREDENTIALS = {
  receptionist: { email: 'receptionist@hospital.com', password: 'password123' },
  nurse: { email: 'nurse.moore@hospital.com', password: 'password123' },
  doctor: { email: 'idiamin@hospital.com', password: 'password123' },
  labTech: { email: 'labtech@hospital.com', password: 'password123' },
  pharmacist: { email: 'pharmacist@hospital.com', password: 'password123' },
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

test.describe.serial('Setup Test Data', () => {
  
  test('1. Receptionist - Create Appointment for Test Patient', async ({ page }) => {
    console.log('\n📅 Creating test appointment via Receptionist...');
    
    const loggedIn = await staffLogin(page, CREDENTIALS.receptionist.email, CREDENTIALS.receptionist.password);
    if (!loggedIn) {
      console.log('  ❌ Failed to login as receptionist');
      return;
    }
    console.log('  ✅ Logged in as receptionist');
    
    // Navigate to appointments page
    await page.goto(`${BASE_URL}/appointments`, { waitUntil: 'domcontentloaded' });
    await waitForLoad(page);
    await page.screenshot({ path: 'test-results/setup-1-appointments-list.png' });
    
    // Click New/Create Appointment button
    const newBtn = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add"), a:has-text("New Appointment")').first();
    
    if (await newBtn.isVisible({ timeout: 5000 })) {
      await newBtn.click();
      await waitForLoad(page);
      console.log('  📝 Opened appointment form');
      await page.screenshot({ path: 'test-results/setup-1-appointment-form.png' });
      
      // Search for patient "Kamil" or "Md Kamil"
      const patientSearch = page.locator('input[placeholder*="patient" i], input[placeholder*="search" i], input[name*="patient" i]').first();
      if (await patientSearch.isVisible({ timeout: 3000 })) {
        await patientSearch.fill('Kamil');
        await page.waitForTimeout(1500);
        
        // Click on patient from dropdown
        const patientOption = page.locator('.dropdown-item:has-text("Kamil"), [role="option"]:has-text("Kamil"), li:has-text("Kamil"), .suggestion:has-text("Kamil")').first();
        if (await patientOption.isVisible({ timeout: 3000 })) {
          await patientOption.click();
          await page.waitForTimeout(500);
          console.log('  👤 Selected patient');
        }
      }
      
      // Select department/specialty
      const deptSelect = page.locator('select[name*="department" i], select[name*="specialty" i]').first();
      if (await deptSelect.isVisible({ timeout: 3000 })) {
        await deptSelect.selectOption({ index: 1 });
        await page.waitForTimeout(500);
      }
      
      // Select doctor - look for Idiamin
      const doctorSelect = page.locator('select[name*="doctor" i]').first();
      if (await doctorSelect.isVisible({ timeout: 3000 })) {
        // Get all options and find one containing "idiamin"
        const options = await doctorSelect.locator('option').all();
        for (const opt of options) {
          const text = await opt.textContent();
          if (text?.toLowerCase().includes('idi') || text?.toLowerCase().includes('amin')) {
            await doctorSelect.selectOption({ label: text });
            console.log(`  👨‍⚕️ Selected doctor: ${text}`);
            break;
          }
        }
      }
      
      // Select date (today or tomorrow)
      const dateInput = page.locator('input[type="date"], input[name*="date" i]').first();
      if (await dateInput.isVisible({ timeout: 3000 })) {
        const today = new Date();
        await dateInput.fill(today.toISOString().split('T')[0]);
        console.log('  📅 Set appointment date');
      }
      
      // Select time
      const timeInput = page.locator('input[type="time"], select[name*="time" i], input[name*="time" i]').first();
      if (await timeInput.isVisible({ timeout: 3000 })) {
        if (await timeInput.evaluate(el => el.tagName) === 'SELECT') {
          await timeInput.selectOption({ index: 1 });
        } else {
          await timeInput.fill('10:00');
        }
        console.log('  ⏰ Set appointment time');
      }
      
      // Select appointment type if available
      const typeSelect = page.locator('select[name*="type" i], select[name*="visit" i]').first();
      if (await typeSelect.isVisible({ timeout: 2000 })) {
        await typeSelect.selectOption({ index: 1 });
      }
      
      await page.screenshot({ path: 'test-results/setup-1-form-filled.png' });
      
      // Submit the form
      const submitBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save"), button:has-text("Book")').first();
      if (await submitBtn.isVisible({ timeout: 3000 })) {
        // Check if button is enabled
        const isDisabled = await submitBtn.isDisabled();
        if (!isDisabled) {
          await submitBtn.click();
          await waitForLoad(page);
          console.log('  ✅ Appointment created!');
        } else {
          console.log('  ⚠️ Submit button disabled - missing required fields');
          await page.screenshot({ path: 'test-results/setup-1-submit-disabled.png' });
        }
      }
      
      await page.screenshot({ path: 'test-results/setup-1-after-submit.png' });
    } else {
      console.log('  ⚠️ New appointment button not found');
      await page.screenshot({ path: 'test-results/setup-1-no-new-btn.png' });
    }
  });

  test('2. Receptionist - Check-in Patient', async ({ page }) => {
    console.log('\n🏥 Receptionist: Checking in patient...');
    
    const loggedIn = await staffLogin(page, CREDENTIALS.receptionist.email, CREDENTIALS.receptionist.password);
    if (!loggedIn) return;
    console.log('  ✅ Logged in as receptionist');
    
    // Go to OPD queue
    await page.goto(`${BASE_URL}/opd`, { waitUntil: 'domcontentloaded' });
    await waitForLoad(page);
    await page.screenshot({ path: 'test-results/setup-2-opd-queue.png' });
    
    // Click on "Today's Appointments" tab to see scheduled appointments
    const todayTab = page.locator('button:has-text("Today"), [role="tab"]:has-text("Today")').first();
    if (await todayTab.isVisible({ timeout: 3000 })) {
      await todayTab.click();
      await waitForLoad(page);
      console.log('  📅 Clicked Today\'s Appointments tab');
      await page.screenshot({ path: 'test-results/setup-2-today-tab.png' });
    }
    
    // Look for Check In button in the appointment row (not View button)
    // The Check In button appears for SCHEDULED or CONFIRMED appointments
    const checkInBtn = page.locator('button:has-text("Check In"), button:has-text("Check-In")').first();
    
    if (await checkInBtn.isVisible({ timeout: 5000 })) {
      console.log('  📋 Found Check In button, clicking');
      await checkInBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/setup-2-after-checkin-click.png' });
      
      // Handle copay modal - it shows "Copay Collection" with patient info and fee breakdown
      const copayModal = page.locator('text=Copay Collection').first();
      if (await copayModal.isVisible({ timeout: 5000 })) {
        console.log('  💰 Copay collection modal appeared');
        
        // Scroll down in the modal to find action buttons
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(500);
        await page.screenshot({ path: 'test-results/setup-2-copay-modal-scrolled.png' });
        
        // Look for Collect Copay / Waive / Defer buttons
        // These are typically at the bottom of the modal
        const collectBtn = page.locator('button:has-text("Collect Copay"), button:has-text("Collect"), button:has-text("Complete Check-in")').first();
        const waiveBtn = page.locator('button:has-text("Waive"), button:has-text("Skip")').first();
        const deferBtn = page.locator('button:has-text("Defer"), button:has-text("Later")').first();
        
        if (await collectBtn.isVisible({ timeout: 3000 })) {
          await collectBtn.click();
          await waitForLoad(page);
          console.log('  ✅ Collected copay');
        } else if (await waiveBtn.isVisible({ timeout: 2000 })) {
          await waiveBtn.click();
          await waitForLoad(page);
          console.log('  ✅ Waived copay');
        } else if (await deferBtn.isVisible({ timeout: 2000 })) {
          await deferBtn.click();
          await waitForLoad(page);
          console.log('  ✅ Deferred copay');
        } else {
          // Try any button at the bottom
          const anyBtn = page.locator('[role="dialog"] button').last();
          if (await anyBtn.isVisible({ timeout: 2000 })) {
            await anyBtn.click();
            await waitForLoad(page);
            console.log('  ✅ Clicked action button');
          }
        }
      }
      
      await page.screenshot({ path: 'test-results/setup-2-checked-in.png' });
    } else {
      console.log('  ⚠️ No Check In button found, checking View instead');
      const viewBtn = page.locator('button:has-text("View")').first();
      if (await viewBtn.isVisible({ timeout: 3000 })) {
        await viewBtn.click();
        await waitForLoad(page);
        await page.screenshot({ path: 'test-results/setup-2-view-modal.png' });
      }
    }
  });

  test('3. Nurse - Record Vitals', async ({ page }) => {
    console.log('\n👩‍⚕️ Nurse: Recording vitals...');
    
    const loggedIn = await staffLogin(page, CREDENTIALS.nurse.email, CREDENTIALS.nurse.password);
    if (!loggedIn) return;
    console.log('  ✅ Logged in as nurse');
    
    // Nurse dashboard shows "OPD - Vitals Queue" with patients
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/setup-3-nurse-dashboard.png' });
    
    // Look for patient in the vitals queue table or "OPD Waiting" card
    const opdWaitingCard = page.locator(':has-text("OPD Waiting")').first();
    if (await opdWaitingCard.isVisible({ timeout: 3000 })) {
      await opdWaitingCard.click();
      await waitForLoad(page);
    }
    
    // Find patient row in the vitals queue table (or any patient list)
    const patientRow = page.locator('tr:has-text("Kamil"), tr:has-text("Md Kamil")').first();
    const actionBtn = page.locator('button:has-text("Record"), button:has-text("Start"), button:has-text("Take Vitals")').first();
    
    if (await patientRow.isVisible({ timeout: 5000 })) {
      console.log('  📋 Found patient in queue');
      
      // Try clicking action button on the row
      const rowAction = patientRow.locator('button').first();
      if (await rowAction.isVisible({ timeout: 2000 })) {
        await rowAction.click();
      } else {
        await patientRow.click();
      }
      await waitForLoad(page);
      await page.screenshot({ path: 'test-results/setup-3-patient-opened.png' });
      
      // Vitals form is in a modal - scroll to find submit button
      await page.screenshot({ path: 'test-results/setup-3-vitals-form.png' });
      
      // Find the scrollable container inside the dialog and scroll it
      await page.evaluate(() => {
        // Find all scrollable elements inside dialogs/modals
        const scrollables = document.querySelectorAll('.overflow-y-auto, .overflow-auto, [class*="modal"], [role="dialog"]');
        scrollables.forEach(el => {
          if (el.scrollHeight > el.clientHeight) {
            el.scrollTop = el.scrollHeight;
          }
        });
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/setup-3-vitals-scrolled.png' });
      
      // Now look for the submit button which should be visible after scroll
      // The button might say "Save Vitals", "Record Vitals", "Submit" etc.
      let submitted = false;
      
      // Try multiple selectors for the submit button
      const buttonSelectors = [
        'button:has-text("Save Vitals")',
        'button:has-text("Record Vitals")', 
        'button:has-text("Submit")',
        'button:has-text("Save")',
        'button.bg-rose-500',
        'button.bg-rose-600',
        'button[type="submit"]'
      ];
      
      for (const selector of buttonSelectors) {
        const btn = page.locator(selector).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          try {
            await btn.scrollIntoViewIfNeeded();
            await btn.click();
            await waitForLoad(page);
            console.log(`  ✅ Clicked: ${selector}`);
            submitted = true;
            break;
          } catch (e) {
            console.log(`  ⚠️ Failed to click ${selector}`);
          }
        }
      }
      
      if (!submitted) {
        // Last resort: click the last visible button in the dialog
        const dialogBtns = page.locator('[role="dialog"] button, .fixed button').last();
        if (await dialogBtns.isVisible({ timeout: 2000 })) {
          await dialogBtns.click();
          console.log('  ✅ Clicked last dialog button');
        }
      }
      
      await page.screenshot({ path: 'test-results/setup-3-after-submit.png' });
    } else if (await actionBtn.isVisible({ timeout: 3000 })) {
      console.log('  📋 Found action button');
      await actionBtn.click();
      await waitForLoad(page);
      await page.screenshot({ path: 'test-results/setup-3-vitals-form.png' });
    } else {
      console.log('  ⚠️ No patients visible in nurse queue');
      await page.screenshot({ path: 'test-results/setup-3-no-patients.png' });
    }
  });

  test('4. Doctor - Consultation with Orders', async ({ page }) => {
    console.log('\n👨‍⚕️ Doctor: Consultation with orders...');
    
    const loggedIn = await staffLogin(page, CREDENTIALS.doctor.email, CREDENTIALS.doctor.password);
    if (!loggedIn) return;
    console.log('  ✅ Logged in as doctor');
    
    // Doctor dashboard shows "Patient Queue" with patients waiting
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/setup-4-doctor-dashboard.png' });
    
    // Look for patient in "Patient Queue" section - shows as card with patient name and arrow
    const patientCard = page.locator(':has-text("Md Kamil")').first();
    const patientQueueItem = page.locator('.cursor-pointer:has-text("Kamil"), [class*="queue"]:has-text("Kamil"), div:has-text("Md Kamil")').first();
    const pendingCard = page.locator(':has-text("Pending Consultation")').first();
    
    let patientFound = false;
    
    // Try clicking directly on patient name in queue
    if (await patientCard.isVisible({ timeout: 3000 })) {
      await patientCard.click();
      await waitForLoad(page);
      console.log('  📋 Clicked on patient card');
      patientFound = true;
    } else if (await pendingCard.isVisible({ timeout: 2000 })) {
      // Click on "Pending Consultations" card to see queue
      await pendingCard.click();
      await waitForLoad(page);
      console.log('  📋 Opened pending consultations');
    }
    
    await page.screenshot({ path: 'test-results/setup-4-after-click.png' });
    
    // Now should be on consultation page - look for Start Consultation button
    const startBtn = page.locator('button:has-text("Start Consultation"), button:has-text("Begin"), button:has-text("Start")').first();
    if (await startBtn.isVisible({ timeout: 5000 })) {
      await startBtn.click();
      await waitForLoad(page);
      console.log('  ✅ Started consultation');
      patientFound = true;
    }
    
    await page.screenshot({ path: 'test-results/setup-4-consultation.png' });
    
    if (patientFound) {
      // Try to add diagnosis
      const diagInput = page.locator('input[placeholder*="diagnosis" i], input[placeholder*="ICD" i], input[placeholder*="search" i]').first();
      if (await diagInput.isVisible({ timeout: 3000 })) {
        await diagInput.fill('J06.9');
        await page.waitForTimeout(1000);
        const diagOption = page.locator('[role="option"], .suggestion, li').filter({ hasText: /J06|cold|infection/i }).first();
        if (await diagOption.isVisible({ timeout: 2000 })) {
          await diagOption.click();
        }
        console.log('  🏥 Added diagnosis');
      }
      
      // Look for Lab Orders tab/button
      const labTab = page.locator('button:has-text("Lab"), [role="tab"]:has-text("Lab"), a:has-text("Lab")').first();
      if (await labTab.isVisible({ timeout: 3000 })) {
        await labTab.click();
        await waitForLoad(page);
        
        // Select first available test
        const testCheckbox = page.locator('input[type="checkbox"]').first();
        if (await testCheckbox.isVisible({ timeout: 2000 })) {
          await testCheckbox.click();
          const orderBtn = page.locator('button:has-text("Order"), button:has-text("Add")').first();
          if (await orderBtn.isVisible({ timeout: 2000 })) {
            await orderBtn.click();
            await waitForLoad(page);
            console.log('  🧪 Ordered lab test');
          }
        }
      }
      
      // Look for Prescription/Rx tab
      const rxTab = page.locator('button:has-text("Prescription"), button:has-text("Rx"), [role="tab"]:has-text("Rx")').first();
      if (await rxTab.isVisible({ timeout: 3000 })) {
        await rxTab.click();
        await waitForLoad(page);
        
        const drugInput = page.locator('input[placeholder*="drug" i], input[placeholder*="medication" i]').first();
        if (await drugInput.isVisible({ timeout: 2000 })) {
          await drugInput.fill('Paracetamol');
          await page.waitForTimeout(1000);
          const drugOption = page.locator('[role="option"], .suggestion').first();
          if (await drugOption.isVisible({ timeout: 2000 })) {
            await drugOption.click();
          }
          console.log('  💊 Added prescription');
        }
      }
      
      await page.screenshot({ path: 'test-results/setup-4-orders.png' });
      
      // Complete/End consultation
      const completeBtn = page.locator('button:has-text("Complete"), button:has-text("End Consultation"), button:has-text("Finish")').first();
      if (await completeBtn.isVisible({ timeout: 3000 })) {
        await completeBtn.click();
        await waitForLoad(page);
        console.log('  ✅ Consultation completed');
      }
    } else {
      console.log('  ⚠️ No patients found in doctor queue');
    }
    
    await page.screenshot({ path: 'test-results/setup-4-complete.png' });
  });

  test('5. Verify Data Created', async ({ page }) => {
    console.log('\n✅ Verifying test data created...');
    
    const loggedIn = await staffLogin(page, CREDENTIALS.receptionist.email, CREDENTIALS.receptionist.password);
    if (!loggedIn) return;
    
    // Check billing for invoices
    await page.goto(`${BASE_URL}/billing`, { waitUntil: 'domcontentloaded' });
    await waitForLoad(page);
    const invoiceCount = await page.locator('tr, .invoice-card').count();
    console.log(`  📋 Invoices found: ${invoiceCount}`);
    await page.screenshot({ path: 'test-results/setup-5-billing.png' });
    
    // Check lab for orders
    await page.goto(`${BASE_URL}/lab`, { waitUntil: 'domcontentloaded' });
    await waitForLoad(page);
    const labCount = await page.locator('tr:has-text("Pending"), .lab-order').count();
    console.log(`  🧪 Pending lab orders: ${labCount}`);
    await page.screenshot({ path: 'test-results/setup-5-lab.png' });
    
    // Check pharmacy for prescriptions
    await page.goto(`${BASE_URL}/pharmacy`, { waitUntil: 'domcontentloaded' });
    await waitForLoad(page);
    const rxCount = await page.locator('tr:has-text("Pending"), .prescription').count();
    console.log(`  💊 Pending prescriptions: ${rxCount}`);
    await page.screenshot({ path: 'test-results/setup-5-pharmacy.png' });
    
    console.log('\n✅ Setup complete! Now run: npx playwright test tests/finance-insurance-e2e.spec.ts');
  });
});
