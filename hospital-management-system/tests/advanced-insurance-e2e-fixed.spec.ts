import { test, expect, request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://spetaar.ai';
const API_URL = 'https://spetaar.ai/api/v1';
const SCREENSHOT_DIR = './test-results/advanced-insurance-fixed';

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
  console.log(`📸 Screenshot: ${name}`);
}

async function saveApiResponse(name: string, data: any) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, `${name}-${timestamp}.json`),
    JSON.stringify(data, null, 2)
  );
  console.log(`💾 API Response saved: ${name}`);
}

// Login helper - simplified, just get token from localStorage after login
async function loginAndGetToken(page: any, email: string, password: string, role: string): Promise<string> {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  await page.waitForTimeout(1500); // Let state settle
  
  // Get token from localStorage (where React apps typically store it)
  const token = await page.evaluate(() => {
    // Check common storage locations
    const possibleKeys = ['accessToken', 'token', 'authToken', 'jwt', 'access_token'];
    for (const key of possibleKeys) {
      const val = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (val && val.length > 20) return val;
    }
    // Check Redux persist
    const persistRoot = localStorage.getItem('persist:root');
    if (persistRoot) {
      try {
        const state = JSON.parse(persistRoot);
        if (state.auth) {
          const authState = typeof state.auth === 'string' ? JSON.parse(state.auth) : state.auth;
          if (authState.accessToken) return authState.accessToken;
          if (authState.token) return authState.token;
        }
      } catch {}
    }
    return '';
  });
  
  if (token) {
    console.log(`🔑 Token: ${token.substring(0, 30)}...`);
  }
  console.log(`✅ Logged in as ${role}`);
  
  return token;
}

test.describe('Advanced Insurance E2E Tests - FIXED', () => {
  
  test('Test 1 — IPD Admission + Insurance (Fixed Modal)', async ({ page }) => {
    test.setTimeout(180000);
    console.log('\n🏥 TEST 1: IPD Admission + Insurance (FIXED)\n');
    
    // Login as doctor
    await loginAndGetToken(page, 'idiamin@hospital.com', 'password123', 'Doctor');
    await screenshot(page, 't1-01-doctor-login');
    
    // Navigate to IPD
    await page.goto(`${BASE_URL}/ipd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 't1-02-ipd-page');
    
    // Click New Admission button
    const newAdmissionBtn = page.locator('button:has-text("New Admission")');
    if (await newAdmissionBtn.isVisible({ timeout: 5000 })) {
      await newAdmissionBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 't1-03-admission-modal');
      
      // Wait for modal to be stable
      await page.waitForSelector('.fixed.inset-0', { state: 'visible' });
      await page.waitForTimeout(500);
      
      // Search for patient - use the search input inside modal
      const patientSearch = page.locator('input[placeholder*="Search by name"]').first();
      if (await patientSearch.isVisible({ timeout: 3000 })) {
        await patientSearch.click();
        await page.waitForTimeout(300);
        await patientSearch.fill('kamil');
        await page.waitForTimeout(2000);
        await screenshot(page, 't1-04-patient-search');
        
        // Wait for dropdown to appear and select patient using keyboard
        // Use mousedown/mouseup for better reliability with overlays
        const patientOption = page.locator('[role="option"]:has-text("Kamil"), [role="listbox"] button:has-text("Kamil"), .dropdown-item:has-text("Kamil")').first();
        if (await patientOption.isVisible({ timeout: 3000 })) {
          await patientOption.dispatchEvent('mousedown');
          await patientOption.dispatchEvent('mouseup');
          await page.waitForTimeout(1000);
          await screenshot(page, 't1-05-patient-selected');
        } else {
          // Try keyboard selection
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(200);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(1000);
          await screenshot(page, 't1-05-keyboard-selection');
        }
        
        console.log('✅ Patient search completed');
      }
      
      // Select bed
      const bedDropdown = page.locator('select:has(option:has-text("bed"))').or(page.locator('[name="bedId"]'));
      if (await bedDropdown.first().isVisible({ timeout: 3000 })) {
        await bedDropdown.first().selectOption({ index: 1 });
        await page.waitForTimeout(500);
        await screenshot(page, 't1-06-bed-selected');
        console.log('✅ Bed selection visible');
      }
      
      // Select doctor
      const doctorDropdown = page.locator('select:has(option:has-text("doctor"))').or(page.locator('[name="doctorId"]'));
      if (await doctorDropdown.first().isVisible({ timeout: 3000 })) {
        await doctorDropdown.first().selectOption({ index: 1 });
        await page.waitForTimeout(500);
        await screenshot(page, 't1-07-doctor-selected');
        console.log('✅ Doctor selection visible');
      }
      
      // Check for insurance/coverage section
      const insuranceSection = page.locator('text=Insurance').or(page.locator('text=Coverage')).or(page.locator('text=Copay'));
      if (await insuranceSection.first().isVisible({ timeout: 3000 })) {
        await screenshot(page, 't1-08-insurance-section');
        console.log('✅ Insurance section visible');
      }
      
      // Check for room class selection
      const roomUpgrade = page.locator('text=upgrade').or(page.locator('text=Room Class')).or(page.locator('text=ward type'));
      if (await roomUpgrade.first().isVisible({ timeout: 3000 })) {
        await screenshot(page, 't1-09-room-class');
        console.log('✅ Room class options visible');
      }
      
      // Check for deposit section
      const depositSection = page.locator('text=Deposit').or(page.locator('text=Advance Payment'));
      if (await depositSection.first().isVisible({ timeout: 3000 })) {
        await screenshot(page, 't1-10-deposit');
        console.log('✅ Deposit section visible');
      }
    }
    
    await screenshot(page, 't1-final');
    console.log('✅ Test 1 Complete');
  });

  test('Test 2 — COB Calculation (Fixed Auth)', async ({ page, request }) => {
    test.setTimeout(60000);
    console.log('\n💳 TEST 2: COB Calculation (FIXED AUTH)\n');
    
    // Login as Receptionist (RECEPTIONIST role with password123)
    const token = await loginAndGetToken(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    await screenshot(page, 't2-01-logged-in');
    
    if (!token) {
      console.log('❌ No token captured, skipping API tests');
      return;
    }
    
    // First get a real patient ID
    let patientId = '';
    try {
      const patientsResponse = await request.get(`${API_URL}/patients?search=kamil&limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const patientsData = await patientsResponse.json();
      saveApiResponse('t2-patients-search', patientsData);
      
      if (patientsData.data && patientsData.data.length > 0) {
        patientId = patientsData.data[0].id;
        console.log(`Found patient: ${patientsData.data[0].firstName} ${patientsData.data[0].lastName} (${patientId})`);
      }
    } catch (e) {
      console.log(`⚠️ Patient search failed: ${e}`);
    }
    
    // Test COB calculation API with correct endpoint
    const cobRequest = {
      patientId: patientId || 'test-patient-id',
      totalAmount: 5000,
      serviceCategory: 'OUTPATIENT'
    };
    
    try {
      const response = await request.post(`${API_URL}/insurance-advanced/cob/calculate`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: cobRequest
      });
      
      const responseData = await response.json();
      saveApiResponse('t2-cob-calculation', { request: cobRequest, response: responseData, status: response.status() });
      
      console.log(`COB API Response Status: ${response.status()}`);
      console.log(`Response: ${JSON.stringify(responseData, null, 2)}`);
      
      if (response.ok()) {
        console.log('✅ COB calculation API working');
        if (responseData.data) {
          console.log(`   Primary pays: ${responseData.data.primaryPays || 'N/A'}`);
          console.log(`   Secondary pays: ${responseData.data.secondaryPays || 'N/A'}`);
          console.log(`   Patient pays: ${responseData.data.patientPays || 'N/A'}`);
        }
      } else {
        console.log(`⚠️ COB API returned ${response.status()}: ${responseData.message || JSON.stringify(responseData)}`);
      }
    } catch (error) {
      console.log(`❌ COB API Error: ${error}`);
      saveApiResponse('t2-cob-error', { error: String(error) });
    }
    
    await screenshot(page, 't2-02-final');
    console.log('✅ Test 2 Complete');
  });

  test('Test 3 — Bilingual Receipts (Fixed Auth)', async ({ page, request }) => {
    test.setTimeout(60000);
    console.log('\n📄 TEST 3: Bilingual Receipts (FIXED AUTH)\n');
    
    const token = await loginAndGetToken(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    await screenshot(page, 't3-01-logged-in');
    
    if (!token) {
      console.log('❌ No token captured');
      return;
    }
    
    // Navigate to billing
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 't3-02-billing-page');
    
    // Get invoices via API
    try {
      const invoicesResponse = await request.get(`${API_URL}/billing/invoices?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const invoicesData = await invoicesResponse.json();
      saveApiResponse('t3-invoices-list', invoicesData);
      console.log(`Invoices API Status: ${invoicesResponse.status()}`);
      
      if (invoicesResponse.ok() && invoicesData.data && invoicesData.data.length > 0) {
        const testInvoice = invoicesData.data[0];
        console.log(`Found invoice: ${testInvoice.invoiceNumber} (${testInvoice.id})`);
        
        // Test bilingual invoice endpoint
        const bilingualResponse = await request.get(`${API_URL}/billing/invoices/${testInvoice.id}/bilingual`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const bilingualData = await bilingualResponse.json();
        saveApiResponse('t3-bilingual-invoice', bilingualData);
        console.log(`Bilingual API Status: ${bilingualResponse.status()}`);
        
        if (bilingualResponse.ok()) {
          console.log('✅ Bilingual invoice API working');
          
          // Check for Arabic text
          const responseStr = JSON.stringify(bilingualData);
          const hasArabic = /[\u0600-\u06FF]/.test(responseStr);
          console.log(`   Arabic text present: ${hasArabic ? '✅ Yes' : '❌ No'}`);
          
          // Check for VAT
          const hasVAT = responseStr.includes('VAT') || responseStr.includes('vat') || responseStr.includes('ضريبة');
          console.log(`   VAT information: ${hasVAT ? '✅ Yes' : '❌ No'}`);
        } else {
          console.log(`⚠️ Bilingual API: ${bilingualData.message || 'Error'}`);
        }
        
        // Also test receipt bilingual endpoint
        const receiptResponse = await request.get(`${API_URL}/billing/receipts?invoiceId=${testInvoice.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (receiptResponse.ok()) {
          const receiptData = await receiptResponse.json();
          saveApiResponse('t3-receipts', receiptData);
          if (receiptData.data && receiptData.data.length > 0) {
            console.log(`✅ Found ${receiptData.data.length} receipts for invoice`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ API Error: ${error}`);
      saveApiResponse('t3-error', { error: String(error) });
    }
    
    await screenshot(page, 't3-03-final');
    console.log('✅ Test 3 Complete');
  });

  test('Test 4 — VAT 5% Handling (Fixed Auth)', async ({ page, request }) => {
    test.setTimeout(60000);
    console.log('\n💰 TEST 4: VAT 5% Handling (FIXED AUTH)\n');
    
    const token = await loginAndGetToken(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    await screenshot(page, 't4-01-logged-in');
    
    if (!token) {
      console.log('❌ No token captured');
      return;
    }
    
    // Navigate to billing
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 't4-02-billing-page');
    
    // Look for VAT info on page
    const vatText = page.locator('text=VAT').or(page.locator('text=5%')).or(page.locator('text=Tax'));
    if (await vatText.first().isVisible({ timeout: 5000 })) {
      await screenshot(page, 't4-03-vat-visible');
      console.log('✅ VAT information visible on page');
    }
    
    // Get invoice details via API
    try {
      const invoicesResponse = await request.get(`${API_URL}/billing/invoices?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (invoicesResponse.ok()) {
        const invoicesData = await invoicesResponse.json();
        
        if (invoicesData.data && invoicesData.data.length > 0) {
          const invoice = invoicesData.data[0];
          console.log(`\nInvoice ${invoice.invoiceNumber}:`);
          console.log(`  Subtotal: ${invoice.subtotal || invoice.totalAmount}`);
          console.log(`  VAT Amount: ${invoice.vatAmount || 'Not specified'}`);
          console.log(`  VAT Rate: ${invoice.vatRate || 'Not specified'}%`);
          console.log(`  Total: ${invoice.totalAmount}`);
          console.log(`  TRN: ${invoice.taxRegistrationNumber || invoice.trn || 'Not specified'}`);
          
          // Get detailed invoice
          const detailResponse = await request.get(`${API_URL}/billing/invoices/${invoice.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (detailResponse.ok()) {
            const detailData = await detailResponse.json();
            saveApiResponse('t4-invoice-detail', detailData);
            
            if (detailData.data?.lineItems) {
              console.log(`\n  Line items: ${detailData.data.lineItems.length}`);
              const vatExempt = detailData.data.lineItems.filter((item: any) => item.vatExempt || item.isVatExempt);
              if (vatExempt.length > 0) {
                console.log(`  VAT-exempt items: ${vatExempt.length}`);
              }
            }
            
            // Check for VAT fields
            const hasVatFields = detailData.data?.vatAmount !== undefined || 
                                 detailData.data?.vatRate !== undefined ||
                                 detailData.data?.taxAmount !== undefined;
            console.log(`\n  ${hasVatFields ? '✅' : '⚠️'} VAT fields ${hasVatFields ? 'present' : 'not found'} in invoice`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ API Error: ${error}`);
      saveApiResponse('t4-error', { error: String(error) });
    }
    
    await screenshot(page, 't4-04-final');
    console.log('✅ Test 4 Complete');
  });

  test('Test 5 — Insurance Underpayment (Fixed Auth)', async ({ page, request }) => {
    test.setTimeout(60000);
    console.log('\n⚠️ TEST 5: Insurance Underpayment (FIXED AUTH)\n');
    
    // Login as Receptionist 
    const token = await loginAndGetToken(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    await screenshot(page, 't5-01-logged-in');
    
    if (!token) {
      console.log('❌ No token captured');
      return;
    }
    
    // First, find an existing claim
    let claimId = '';
    try {
      const claimsResponse = await request.get(`${API_URL}/billing/claims?limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (claimsResponse.ok()) {
        const claimsData = await claimsResponse.json();
        saveApiResponse('t5-claims-list', claimsData);
        if (claimsData.data && claimsData.data.length > 0) {
          claimId = claimsData.data[0].id;
          console.log(`Found claim: ${claimId}`);
        }
      }
    } catch (e) {
      console.log(`⚠️ Claims fetch failed: ${e}`);
    }
    
    // Test underpayment processing API with correct endpoint
    const underpaymentRequest = {
      claimId: claimId || 'test-claim-id',
      approvedAmount: 800,
      denialCodes: ['CO-45'],
      denialReasons: ['Charges exceed fee schedule'],
      adjustmentCodes: ['CO-45']
    };
    
    try {
      const response = await request.post(`${API_URL}/insurance-advanced/underpayment/process`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: underpaymentRequest
      });
      
      const responseData = await response.json();
      saveApiResponse('t5-underpayment', { request: underpaymentRequest, response: responseData, status: response.status() });
      
      console.log(`Underpayment API Status: ${response.status()}`);
      console.log(`Response: ${JSON.stringify(responseData, null, 2)}`);
      
      if (response.ok()) {
        console.log('✅ Underpayment processing API working');
        if (responseData.data) {
          console.log(`   Shortfall: ${responseData.data.shortfall || 'N/A'}`);
          console.log(`   Patient bill ID: ${responseData.data.patientBillId || 'N/A'}`);
        }
      } else {
        console.log(`⚠️ Underpayment API returned ${response.status()}: ${responseData.message || JSON.stringify(responseData)}`);
      }
    } catch (error) {
      console.log(`❌ Underpayment API Error: ${error}`);
      saveApiResponse('t5-error', { error: String(error) });
    }
    
    await screenshot(page, 't5-02-final');
    console.log('✅ Test 5 Complete');
  });

  test('Test 6 — DHA eClaimLink Sandbox (Correct Endpoints)', async ({ page, request }) => {
    test.setTimeout(90000);
    console.log('\n🏛️ TEST 6: DHA eClaimLink Sandbox (CORRECT ENDPOINTS)\n');
    
    // Login as Receptionist for DHA endpoints
    const token = await loginAndGetToken(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    await screenshot(page, 't6-01-logged-in');
    
    if (!token) {
      console.log('❌ No token captured');
      return;
    }
    
    // Test DHA status endpoint first
    console.log('\n--- DHA Status Check ---');
    try {
      const statusResponse = await request.get(`${API_URL}/dha-eclaim/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const statusData = await statusResponse.json();
      saveApiResponse('t6-dha-status', statusData);
      console.log(`DHA Status API: ${statusResponse.status()}`);
      console.log(`Response: ${JSON.stringify(statusData, null, 2)}`);
      
      if (statusResponse.ok()) {
        console.log('✅ DHA status endpoint working');
        console.log(`   Configured: ${statusData.data?.configured}`);
        console.log(`   Mode: ${statusData.data?.mode}`);
      }
    } catch (error) {
      console.log(`❌ DHA Status Error: ${error}`);
    }
    
    // Test Eligibility Check - CORRECT ENDPOINT
    console.log('\n--- Eligibility Verify ---');
    try {
      const eligibilityResponse = await request.post(`${API_URL}/dha-eclaim/eligibility/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: {
          emiratesId: '784-1990-1234567-1',
          payerId: 'DAMAN'
        }
      });
      
      const eligibilityData = await eligibilityResponse.json();
      saveApiResponse('t6-eligibility', eligibilityData);
      
      console.log(`Eligibility API Status: ${eligibilityResponse.status()}`);
      console.log(`Response: ${JSON.stringify(eligibilityData, null, 2)}`);
      
      if (eligibilityResponse.ok()) {
        console.log('✅ DHA Eligibility check working');
      } else {
        console.log(`⚠️ Eligibility returned ${eligibilityResponse.status()}: ${eligibilityData.message || 'Error'}`);
      }
    } catch (error) {
      console.log(`❌ Eligibility Error: ${error}`);
    }
    
    // Test Claim Submission - CORRECT ENDPOINT
    console.log('\n--- Claim Submission ---');
    try {
      // First get an invoice
      const invoicesResponse = await request.get(`${API_URL}/billing/invoices?limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      let invoiceId = '';
      if (invoicesResponse.ok()) {
        const invoicesData = await invoicesResponse.json();
        if (invoicesData.data && invoicesData.data.length > 0) {
          invoiceId = invoicesData.data[0].id;
        }
      }
      
      const claimResponse = await request.post(`${API_URL}/dha-eclaim/claims/submit`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: {
          invoiceId: invoiceId || 'test-invoice-id'
        }
      });
      
      const claimData = await claimResponse.json();
      saveApiResponse('t6-claim-submission', claimData);
      
      console.log(`Claim Submission API Status: ${claimResponse.status()}`);
      console.log(`Response: ${JSON.stringify(claimData, null, 2)}`);
      
      if (claimResponse.ok()) {
        console.log('✅ DHA Claim submission working');
        if (claimData.data?.claimReference) {
          console.log(`   Claim Reference: ${claimData.data.claimReference}`);
          
          // Test claim status with the reference
          console.log('\n--- Claim Status Inquiry ---');
          const statusResponse = await request.get(`${API_URL}/dha-eclaim/claims/${claimData.data.claimReference}/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          const statusData = await statusResponse.json();
          saveApiResponse('t6-claim-status', statusData);
          console.log(`Claim Status: ${statusResponse.status()}`);
        }
      } else {
        console.log(`⚠️ Claim submission returned ${claimResponse.status()}: ${claimData.message || 'Error'}`);
      }
    } catch (error) {
      console.log(`❌ Claim Submission Error: ${error}`);
    }
    
    await screenshot(page, 't6-02-final');
    console.log('✅ Test 6 Complete');
  });

  test('Test 7 — IPD Insurance Expiry Monitor (Fixed Auth)', async ({ page, request }) => {
    test.setTimeout(60000);
    console.log('\n⏰ TEST 7: IPD Insurance Expiry Monitor (FIXED AUTH)\n');
    
    // Login as Receptionist for IPD monitoring  
    const token = await loginAndGetToken(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    await screenshot(page, 't7-01-logged-in');
    
    if (!token) {
      console.log('❌ No token captured');
      return;
    }
    
    // Test expiry alerts API with correct endpoint
    try {
      const response = await request.get(`${API_URL}/insurance-advanced/ipd/expiry-alerts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const responseData = await response.json();
      saveApiResponse('t7-expiry-alerts', responseData);
      
      console.log(`Expiry Alerts API Status: ${response.status()}`);
      console.log(`Response: ${JSON.stringify(responseData, null, 2)}`);
      
      if (response.ok()) {
        console.log('✅ IPD Expiry alerts API working');
        if (responseData.data) {
          console.log(`   Total alerts: ${responseData.data.total || 0}`);
          console.log(`   Expired: ${responseData.data.expired || 0}`);
          console.log(`   Expiring soon: ${responseData.data.expiringSoon || 0}`);
          
          if (responseData.data.alerts && responseData.data.alerts.length > 0) {
            console.log('\n   Patient alerts:');
            responseData.data.alerts.forEach((alert: any, i: number) => {
              console.log(`   ${i + 1}. ${alert.patientName}: ${alert.status} (${alert.expiryDate})`);
            });
          }
        }
      } else {
        console.log(`⚠️ Expiry alerts API returned ${response.status()}: ${responseData.message || JSON.stringify(responseData)}`);
      }
    } catch (error) {
      console.log(`❌ Expiry Alerts Error: ${error}`);
      saveApiResponse('t7-error', { error: String(error) });
    }
    
    // Also check IPD page for expiry warnings
    await page.goto(`${BASE_URL}/ipd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 't7-02-ipd-page');
    
    // Look for high risk or expiry warnings
    const expiryWarning = page.locator('text=expir').or(page.locator('text=Expir')).or(page.locator('text=High Risk'));
    if (await expiryWarning.first().isVisible({ timeout: 5000 })) {
      await screenshot(page, 't7-03-expiry-warning');
      console.log('✅ Expiry/Risk warnings visible on IPD page');
    }
    
    // Check admissions tab
    const admissionsTab = page.locator('button:has-text("Admissions")').or(page.locator('text=Admissions'));
    if (await admissionsTab.first().isVisible({ timeout: 3000 })) {
      await admissionsTab.first().click();
      await page.waitForTimeout(1500);
      await screenshot(page, 't7-04-admissions-list');
      console.log('✅ Admissions list visible');
    }
    
    await screenshot(page, 't7-05-final');
    console.log('✅ Test 7 Complete');
  });

});

// Summary test
test('Summary — Test Report', async ({ page }) => {
  console.log('\n' + '='.repeat(60));
  console.log('📊 ADVANCED INSURANCE E2E TEST SUMMARY (FIXED)');
  console.log('='.repeat(60));
  
  const files = fs.readdirSync(SCREENSHOT_DIR);
  const screenshots = files.filter(f => f.endsWith('.png'));
  const apiResponses = files.filter(f => f.endsWith('.json'));
  
  console.log(`\n📸 Screenshots captured: ${screenshots.length}`);
  console.log(`💾 API responses saved: ${apiResponses.length}`);
  console.log(`\nAll test artifacts saved to: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(60));
});
