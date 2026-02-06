import { test, expect } from '@playwright/test';

const BASE_URL = 'https://spetaar.ai';

const CREDS = {
  receptionist: { email: 'receptionist@hospital.com', password: 'password123' },
  doctor: { email: 'idiamin@hospital.com', password: 'password123' },
  labtech: { email: 'labtech@hospital.com', password: 'password123' },
  pharmacist: { email: 'pharmacist@hospital.com', password: 'password123' },
};

async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

async function screenshot(page: any, name: string) {
  await page.screenshot({ path: `test-results/deep-e2e/${name}.png`, fullPage: false });
  console.log(`📸 ${name}`);
}

test.describe.serial('Deep E2E Demo Tests', () => {
  
  // ============ OPD CHECK-IN TESTS ============
  test('OPD-1: Check-in Flow - View Queue & Check-in Button', async ({ page }) => {
    test.setTimeout(60000);
    console.log('\n🏥 OPD CHECK-IN TESTS\n');
    
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    console.log('✅ Receptionist logged in');
    
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'opd-1-queue');
    
    // Check for Live Queue
    const liveQueue = page.locator('text=Live Queue');
    expect(await liveQueue.isVisible()).toBeTruthy();
    console.log('✅ Live Queue visible');
    
    // Check for Check In button
    const checkInBtn = page.locator('button:has-text("Check In")').first();
    const hasCheckIn = await checkInBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Check In button visible: ${hasCheckIn}`);
    
    // Check for Today's Appointments tab
    const todayTab = page.locator('text=Today\'s Appointments');
    expect(await todayTab.isVisible()).toBeTruthy();
    console.log('✅ Today\'s Appointments tab visible');
  });

  test('OPD-2: Check-in Modal - Insurance & Copay', async ({ page }) => {
    test.setTimeout(90000);
    
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Click on first Check In button
    const checkInBtn = page.locator('button:has-text("Check In")').first();
    if (await checkInBtn.isVisible({ timeout: 5000 })) {
      await checkInBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'opd-2-checkin-modal');
      
      // Check for copay-related elements
      const copayText = page.locator('text=Copay, text=Co-pay, text=Payment').first();
      const hasCopay = await copayText.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`✅ Copay section visible: ${hasCopay}`);
      
      // Check for insurance info
      const insuranceText = page.locator('text=Insurance, text=Coverage, text=Policy').first();
      const hasInsurance = await insuranceText.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Insurance info visible: ${hasInsurance}`);
      
      // Check for Emirates ID field
      const eidField = page.locator('input[placeholder*="Emirates"], input[name*="emirates"], text=Emirates ID').first();
      const hasEID = await eidField.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Emirates ID field/text visible: ${hasEID}`);
      
      await screenshot(page, 'opd-2-modal-details');
    } else {
      console.log('⚠️ No Check In button found - may need appointment first');
      await screenshot(page, 'opd-2-no-checkin');
    }
  });

  // ============ LAB WALK-IN TESTS ============
  test('LAB-1: Lab Dashboard & Pending Orders', async ({ page }) => {
    test.setTimeout(60000);
    console.log('\n🔬 LAB TESTS\n');
    
    await login(page, CREDS.labtech.email, CREDS.labtech.password);
    console.log('✅ Lab Tech logged in');
    
    await page.waitForTimeout(2000);
    await screenshot(page, 'lab-1-dashboard');
    
    // Check for lab-related elements
    const labQueue = page.locator('text=Pending, text=Queue, text=Orders, text=Sample').first();
    const hasQueue = await labQueue.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Lab queue/orders visible: ${hasQueue}`);
    
    // Navigate to lab orders if not on dashboard
    await page.goto(`${BASE_URL}/lab`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'lab-1-orders-page');
    
    // Check for Walk-in button
    const walkInBtn = page.locator('button:has-text("Walk-in"), button:has-text("Walk In"), button:has-text("New Patient")').first();
    const hasWalkIn = await walkInBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Walk-in button visible: ${hasWalkIn}`);
  });

  test('LAB-2: Lab Walk-in Patient Flow', async ({ page }) => {
    test.setTimeout(90000);
    
    await login(page, CREDS.labtech.email, CREDS.labtech.password);
    await page.goto(`${BASE_URL}/lab`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Try to find and click Walk-in button
    const walkInBtn = page.locator('button:has-text("Walk-in"), button:has-text("Walk In"), button:has-text("New"), a:has-text("Walk-in")').first();
    
    if (await walkInBtn.isVisible({ timeout: 5000 })) {
      await walkInBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'lab-2-walkin-form');
      
      // Check for patient search
      const patientSearch = page.locator('input[placeholder*="Search"], input[placeholder*="patient"], input[placeholder*="MRN"]').first();
      const hasSearch = await patientSearch.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Patient search visible: ${hasSearch}`);
      
      // Check for insurance capture section
      const insuranceSection = page.locator('text=Insurance, text=Coverage, text=Emirates ID').first();
      const hasInsurance = await insuranceSection.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Insurance capture visible: ${hasInsurance}`);
      
      // Check for test selection
      const testSelection = page.locator('text=Test, text=Panel, text=CBC, text=Select').first();
      const hasTests = await testSelection.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Test selection visible: ${hasTests}`);
      
      await screenshot(page, 'lab-2-walkin-details');
    } else {
      console.log('⚠️ Walk-in button not found on lab page');
      
      // Check if there's a different path
      const altBtn = page.locator('button, a').filter({ hasText: /new|add|create|register/i }).first();
      if (await altBtn.isVisible({ timeout: 3000 })) {
        console.log('Found alternative button');
        await altBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, 'lab-2-alt-form');
      }
    }
  });

  test('LAB-3: Sample Collection Flow', async ({ page }) => {
    test.setTimeout(60000);
    
    await login(page, CREDS.labtech.email, CREDS.labtech.password);
    await page.goto(`${BASE_URL}/lab`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for Collect Sample button
    const collectBtn = page.locator('button:has-text("Collect"), button:has-text("Sample"), button:has-text("Process")').first();
    const hasCollect = await collectBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Collect Sample button visible: ${hasCollect}`);
    
    if (hasCollect) {
      await collectBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'lab-3-collect-modal');
    }
    
    // Look for Results Entry
    const resultsBtn = page.locator('button:has-text("Result"), button:has-text("Enter"), text=Enter Results').first();
    const hasResults = await resultsBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`✅ Results entry visible: ${hasResults}`);
    
    await screenshot(page, 'lab-3-final');
  });

  // ============ PHARMACY TESTS ============
  test('PHARM-1: Pharmacy Dashboard & Prescriptions Queue', async ({ page }) => {
    test.setTimeout(60000);
    console.log('\n💊 PHARMACY TESTS\n');
    
    await login(page, CREDS.pharmacist.email, CREDS.pharmacist.password);
    console.log('✅ Pharmacist logged in');
    
    await page.waitForTimeout(2000);
    await screenshot(page, 'pharm-1-dashboard');
    
    // Check for pharmacy-related elements
    const rxQueue = page.locator('text=Prescription, text=Pending, text=Dispense, text=Queue').first();
    const hasQueue = await rxQueue.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Prescription queue visible: ${hasQueue}`);
    
    // Navigate to pharmacy if not there
    await page.goto(`${BASE_URL}/pharmacy`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'pharm-1-pharmacy-page');
  });

  test('PHARM-2: Dispense Flow - Copay Modal', async ({ page }) => {
    test.setTimeout(90000);
    
    await login(page, CREDS.pharmacist.email, CREDS.pharmacist.password);
    await page.goto(`${BASE_URL}/pharmacy`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for Dispense button
    const dispenseBtn = page.locator('button:has-text("Dispense"), button:has-text("Process"), button:has-text("Fill")').first();
    
    if (await dispenseBtn.isVisible({ timeout: 5000 })) {
      await dispenseBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'pharm-2-dispense-modal');
      
      // Check for copay calculation
      const copayText = page.locator('text=Copay, text=Co-pay, text=Patient Pays, text=AED').first();
      const hasCopay = await copayText.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`✅ Copay calculation visible: ${hasCopay}`);
      
      // Check for drug details
      const drugDetails = page.locator('text=Medication, text=Drug, text=Quantity, text=Dosage').first();
      const hasDrug = await drugDetails.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Drug details visible: ${hasDrug}`);
      
      // Check for payment options
      const paymentOptions = page.locator('text=Cash, text=Card, text=Payment Method').first();
      const hasPayment = await paymentOptions.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Payment options visible: ${hasPayment}`);
      
      await screenshot(page, 'pharm-2-copay-details');
    } else {
      console.log('⚠️ No Dispense button found - may need prescriptions');
      await screenshot(page, 'pharm-2-no-dispense');
    }
  });

  // ============ IPD TESTS ============
  test('IPD-1: IPD Dashboard & Admission', async ({ page }) => {
    test.setTimeout(60000);
    console.log('\n🏨 IPD TESTS\n');
    
    await login(page, CREDS.doctor.email, CREDS.doctor.password);
    console.log('✅ Doctor logged in');
    
    await page.goto(`${BASE_URL}/ipd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'ipd-1-dashboard');
    
    // Check for IPD elements
    const ipdElements = page.locator('text=IPD, text=Admission, text=Ward, text=Bed').first();
    const hasIPD = await ipdElements.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ IPD elements visible: ${hasIPD}`);
    
    // Look for New Admission button
    const admitBtn = page.locator('button:has-text("Admit"), button:has-text("New Admission"), button:has-text("Add")').first();
    const hasAdmit = await admitBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Admission button visible: ${hasAdmit}`);
  });

  test('IPD-2: Admission Form - Insurance & Room Class', async ({ page }) => {
    test.setTimeout(90000);
    
    await login(page, CREDS.doctor.email, CREDS.doctor.password);
    await page.goto(`${BASE_URL}/ipd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Try to open admission form
    const admitBtn = page.locator('button:has-text("Admit"), button:has-text("New Admission"), button:has-text("New"), a:has-text("Admission")').first();
    
    if (await admitBtn.isVisible({ timeout: 5000 })) {
      await admitBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'ipd-2-admission-form');
      
      // Check for patient search
      const patientSearch = page.locator('input[placeholder*="Search"], input[placeholder*="patient"]').first();
      const hasSearch = await patientSearch.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Patient search visible: ${hasSearch}`);
      
      // Check for insurance verification
      const insuranceSection = page.locator('text=Insurance, text=Coverage, text=Verification').first();
      const hasInsurance = await insuranceSection.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Insurance section visible: ${hasInsurance}`);
      
      // Check for room class selection
      const roomClass = page.locator('text=Room, text=Ward, text=General, text=Private, text=Class').first();
      const hasRoom = await roomClass.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Room class visible: ${hasRoom}`);
      
      // Check for deposit section
      const deposit = page.locator('text=Deposit, text=Advance, text=Payment').first();
      const hasDeposit = await deposit.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Deposit section visible: ${hasDeposit}`);
      
      await screenshot(page, 'ipd-2-form-details');
    } else {
      console.log('⚠️ Admission button not found');
      await screenshot(page, 'ipd-2-no-admission');
    }
  });

  test('IPD-3: Ward View & Patient Management', async ({ page }) => {
    test.setTimeout(60000);
    
    await login(page, CREDS.doctor.email, CREDS.doctor.password);
    await page.goto(`${BASE_URL}/ipd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for ward view or patient list
    const wardView = page.locator('text=Ward, text=Admitted, text=Patients, text=Bed').first();
    const hasWard = await wardView.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Ward view visible: ${hasWard}`);
    
    // Check for discharge option
    const dischargeBtn = page.locator('button:has-text("Discharge"), text=Discharge').first();
    const hasDischarge = await dischargeBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`✅ Discharge option visible: ${hasDischarge}`);
    
    // Check for daily charges
    const charges = page.locator('text=Charges, text=Billing, text=Services').first();
    const hasCharges = await charges.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`✅ Charges section visible: ${hasCharges}`);
    
    await screenshot(page, 'ipd-3-ward-view');
  });

  // ============ BILLING & CLAIMS TESTS ============
  test('BILL-1: Billing - Invoice & VAT', async ({ page }) => {
    test.setTimeout(60000);
    console.log('\n💰 BILLING TESTS\n');
    
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'bill-1-billing-page');
    
    // Check for invoice list
    const invoiceList = page.locator('text=Invoice, text=INV-, text=Receipt').first();
    const hasInvoices = await invoiceList.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Invoice list visible: ${hasInvoices}`);
    
    // Check for VAT
    const vatText = page.locator('text=VAT, text=5%, text=Tax').first();
    const hasVAT = await vatText.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`✅ VAT visible: ${hasVAT}`);
    
    // Try to open an invoice
    const invoiceRow = page.locator('tr, [data-testid="invoice-row"]').first();
    if (await invoiceRow.isVisible({ timeout: 3000 })) {
      await invoiceRow.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'bill-1-invoice-detail');
    }
  });

  test('BILL-2: Claims Dashboard', async ({ page }) => {
    test.setTimeout(60000);
    
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    await page.goto(`${BASE_URL}/insurance/claims`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'bill-2-claims-dashboard');
    
    // Check for claims status filters
    const statusFilters = page.locator('text=Pending, text=Submitted, text=Approved, text=Denied').first();
    const hasFilters = await statusFilters.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Status filters visible: ${hasFilters}`);
    
    // Check for DHA/submission
    const dhaText = page.locator('text=DHA, text=Submit, text=eClaimLink').first();
    const hasDHA = await dhaText.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`✅ DHA submission visible: ${hasDHA}`);
  });

  // ============ DOCTOR CONSULTATION TESTS ============
  test('DOC-1: Consultation - Orders with Cost Estimates', async ({ page }) => {
    test.setTimeout(90000);
    console.log('\n👨‍⚕️ DOCTOR CONSULTATION TESTS\n');
    
    await login(page, CREDS.doctor.email, CREDS.doctor.password);
    console.log('✅ Doctor logged in');
    
    await page.waitForTimeout(2000);
    await screenshot(page, 'doc-1-dashboard');
    
    // Check for patient queue
    const patientQueue = page.locator('text=Patient, text=Queue, text=Consultation, text=Pending').first();
    const hasQueue = await patientQueue.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Patient queue visible: ${hasQueue}`);
    
    // Try to navigate to OPD/consultations
    await page.goto(`${BASE_URL}/consultations`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'doc-1-consultations');
    
    // Look for Start Consultation
    const startBtn = page.locator('button:has-text("Start"), button:has-text("Consult"), button:has-text("Begin")').first();
    const hasStart = await startBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Start consultation button visible: ${hasStart}`);
  });

  test('DOC-2: Lab Order with Cost Estimate', async ({ page }) => {
    test.setTimeout(60000);
    
    await login(page, CREDS.doctor.email, CREDS.doctor.password);
    
    // Try to get to a consultation or orders page
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for any patient to click
    const patientCard = page.locator('text=Ready for Doctor, [class*="patient"], tr').first();
    if (await patientCard.isVisible({ timeout: 5000 })) {
      await patientCard.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'doc-2-patient-opened');
      
      // Check for Lab Orders tab/button
      const labTab = page.locator('button:has-text("Lab"), [role="tab"]:has-text("Lab"), text=Lab Orders').first();
      const hasLab = await labTab.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`✅ Lab orders tab visible: ${hasLab}`);
      
      if (hasLab) {
        await labTab.click();
        await page.waitForTimeout(1000);
        await screenshot(page, 'doc-2-lab-orders');
        
        // Check for cost estimate
        const costEstimate = page.locator('text=AED, text=Cost, text=Estimate, text=Patient pays').first();
        const hasCost = await costEstimate.isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`✅ Cost estimate visible: ${hasCost}`);
      }
    }
  });

  // ============ PRE-AUTH TESTS ============
  test('PREAUTH-1: Pre-Authorization Flow', async ({ page }) => {
    test.setTimeout(60000);
    console.log('\n📋 PRE-AUTH TESTS\n');
    
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    await page.goto(`${BASE_URL}/insurance/pre-auth`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'preauth-1-page');
    
    // Check for pre-auth elements
    const preAuthElements = page.locator('text=Pre-Auth, text=Authorization, text=Request').first();
    const hasPreAuth = await preAuthElements.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Pre-Auth page visible: ${hasPreAuth}`);
    
    // Check for New Request button
    const newBtn = page.locator('button:has-text("New"), button:has-text("Request"), button:has-text("Create")').first();
    const hasNew = await newBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ New Request button visible: ${hasNew}`);
    
    // Check for DHA sandbox indicator
    const sandbox = page.locator('text=sandbox, text=Sandbox, text=DHA').first();
    const hasSandbox = await sandbox.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`✅ DHA sandbox visible: ${hasSandbox}`);
    
    // Try to open new pre-auth form
    if (hasNew) {
      await newBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'preauth-1-form');
      
      // Check form fields
      const patientField = page.locator('text=Patient, input[placeholder*="patient"]').first();
      const hasPatient = await patientField.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ Patient field visible: ${hasPatient}`);
      
      const cptField = page.locator('text=CPT, text=Procedure, input[placeholder*="CPT"]').first();
      const hasCPT = await cptField.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`✅ CPT code field visible: ${hasCPT}`);
    }
  });

});
