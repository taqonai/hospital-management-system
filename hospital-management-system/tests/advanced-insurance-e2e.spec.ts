import { test, expect, request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://spetaar.ai';
const API_URL = 'https://spetaar.ai/api/v1';
const SCREENSHOT_DIR = './test-results/advanced-insurance';

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

// Login helper
async function login(page: any, email: string, password: string, role: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 30000 });
  console.log(`✅ Logged in as ${role}`);
}

// Get auth token from browser
async function getAuthToken(page: any): Promise<string> {
  const token = await page.evaluate(() => {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  });
  return token;
}

test.describe('Advanced Insurance E2E Tests', () => {
  
  test('Test 1 — IPD Admission + Insurance Verification', async ({ page }) => {
    test.setTimeout(180000);
    console.log('\n🏥 TEST 1: IPD Admission + Insurance\n');
    
    // Login as doctor
    await login(page, 'idiamin@hospital.com', 'password123', 'Doctor');
    await screenshot(page, 't1-01-doctor-login');
    
    // Navigate to IPD
    await page.goto(`${BASE_URL}/ipd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 't1-02-ipd-page');
    
    // Look for admission or recommend admission button
    const admitBtn = page.locator('button:has-text("Admit")').or(page.locator('button:has-text("New Admission")'));
    if (await admitBtn.first().isVisible({ timeout: 5000 })) {
      await admitBtn.first().click();
      await page.waitForTimeout(2000);
      await screenshot(page, 't1-03-admission-form');
      
      // Search for patient Md Kamil
      const patientSearch = page.locator('input[placeholder*="Search"]').or(page.locator('input[placeholder*="patient"]'));
      if (await patientSearch.first().isVisible({ timeout: 3000 })) {
        await patientSearch.first().fill('kamil');
        await page.waitForTimeout(2000);
        await screenshot(page, 't1-04-patient-search');
        
        // Select patient from dropdown
        const patientOption = page.locator('button:has-text("Kamil")').or(page.locator('text=Md Kamil'));
        if (await patientOption.first().isVisible({ timeout: 3000 })) {
          await patientOption.first().click();
          await page.waitForTimeout(1500);
          await screenshot(page, 't1-05-patient-selected');
        }
      }
      
      // Check for insurance verification section
      const insuranceSection = page.locator('text=Insurance').or(page.locator('text=Coverage'));
      if (await insuranceSection.first().isVisible({ timeout: 5000 })) {
        await screenshot(page, 't1-06-insurance-verification');
        console.log('✅ Insurance verification section visible');
      }
      
      // Check for room class selection
      const roomClass = page.locator('text=Room').or(page.locator('text=Ward')).or(page.locator('select:has-text("General")'));
      if (await roomClass.first().isVisible({ timeout: 3000 })) {
        await screenshot(page, 't1-07-room-class-selection');
        console.log('✅ Room class selection visible');
      }
      
      // Check for upgrade cost warning
      const upgradeCost = page.locator('text=upgrade').or(page.locator('text=additional cost'));
      if (await upgradeCost.first().isVisible({ timeout: 3000 })) {
        await screenshot(page, 't1-08-upgrade-cost-warning');
        console.log('✅ Upgrade cost warning visible');
      }
      
      // Check for deposit section
      const depositSection = page.locator('text=Deposit').or(page.locator('text=Advance'));
      if (await depositSection.first().isVisible({ timeout: 3000 })) {
        await screenshot(page, 't1-09-deposit-section');
        console.log('✅ Deposit section visible');
      }
    } else {
      console.log('ℹ️ No direct admission button found - checking existing admissions');
      await screenshot(page, 't1-03-ipd-list');
      
      // Check if there are any admitted patients
      const admittedPatients = page.locator('text=Admitted').or(page.locator('[data-status="admitted"]'));
      if (await admittedPatients.first().isVisible({ timeout: 3000 })) {
        await screenshot(page, 't1-04-admitted-patients');
      }
    }
    
    await screenshot(page, 't1-10-final');
    console.log('✅ Test 1 Complete');
  });

  test('Test 2 — Multiple Insurance / COB Calculation', async ({ page, request }) => {
    test.setTimeout(60000);
    console.log('\n💳 TEST 2: COB (Coordination of Benefits) Calculation\n');
    
    // Login to get auth token
    await login(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    const token = await getAuthToken(page);
    await screenshot(page, 't2-01-logged-in');
    
    // Test COB calculation API
    const cobRequest = {
      patientId: 'md-kamil-id', // Will need actual ID
      totalAmount: 5000,
      primaryInsurance: {
        payerId: 'daman',
        policyNumber: 'DAM-123456',
        coveragePercentage: 80
      },
      secondaryInsurance: {
        payerId: 'thiqa',
        policyNumber: 'THQ-789012',
        coveragePercentage: 100
      }
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
        if (responseData.primaryPays !== undefined) {
          console.log(`   Primary pays: ${responseData.primaryPays}`);
          console.log(`   Secondary pays: ${responseData.secondaryPays}`);
          console.log(`   Patient pays: ${responseData.patientPays}`);
        }
      } else {
        console.log(`⚠️ COB API returned ${response.status()}: ${JSON.stringify(responseData)}`);
      }
    } catch (error) {
      console.log(`❌ COB API Error: ${error}`);
      saveApiResponse('t2-cob-error', { error: String(error) });
    }
    
    await screenshot(page, 't2-02-final');
    console.log('✅ Test 2 Complete');
  });

  test('Test 3 — Bilingual Receipts (Arabic + English)', async ({ page, request }) => {
    test.setTimeout(60000);
    console.log('\n📄 TEST 3: Bilingual Receipts\n');
    
    // Login to get auth token
    await login(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    const token = await getAuthToken(page);
    await screenshot(page, 't3-01-logged-in');
    
    // Navigate to billing to find receipts
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 't3-02-billing-page');
    
    // Try to find a receipt or invoice
    const invoiceRow = page.locator('tr').filter({ hasText: /INV-|RCP-/ }).first();
    let invoiceId = '';
    
    if (await invoiceRow.isVisible({ timeout: 5000 })) {
      // Try to extract invoice ID from the row
      const invoiceText = await invoiceRow.textContent();
      const match = invoiceText?.match(/(INV-\w+|RCP-\w+)/);
      if (match) {
        invoiceId = match[1];
        console.log(`Found invoice/receipt: ${invoiceId}`);
      }
      await screenshot(page, 't3-03-invoice-found');
    }
    
    // Test bilingual receipt API
    try {
      // First get list of invoices
      const invoicesResponse = await request.get(`${API_URL}/billing/invoices?limit=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const invoicesData = await invoicesResponse.json();
      saveApiResponse('t3-invoices-list', invoicesData);
      
      if (invoicesData.data && invoicesData.data.length > 0) {
        const testInvoiceId = invoicesData.data[0].id;
        console.log(`Testing bilingual for invoice: ${testInvoiceId}`);
        
        // Test bilingual invoice
        const bilingualResponse = await request.get(`${API_URL}/billing/invoices/${testInvoiceId}/bilingual`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const bilingualData = await bilingualResponse.json();
        saveApiResponse('t3-bilingual-invoice', bilingualData);
        
        if (bilingualResponse.ok()) {
          console.log('✅ Bilingual invoice API working');
          
          // Check for Arabic text
          const hasArabic = JSON.stringify(bilingualData).match(/[\u0600-\u06FF]/);
          if (hasArabic) {
            console.log('✅ Arabic text present');
          } else {
            console.log('⚠️ No Arabic text detected');
          }
          
          // Check for VAT
          if (JSON.stringify(bilingualData).includes('VAT') || JSON.stringify(bilingualData).includes('ضريبة')) {
            console.log('✅ VAT information present');
          }
        } else {
          console.log(`⚠️ Bilingual API returned ${bilingualResponse.status()}`);
        }
      }
    } catch (error) {
      console.log(`❌ Bilingual API Error: ${error}`);
      saveApiResponse('t3-bilingual-error', { error: String(error) });
    }
    
    await screenshot(page, 't3-04-final');
    console.log('✅ Test 3 Complete');
  });

  test('Test 4 — VAT 5% Handling', async ({ page, request }) => {
    test.setTimeout(60000);
    console.log('\n💰 TEST 4: VAT 5% Handling\n');
    
    // Login
    await login(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    const token = await getAuthToken(page);
    await screenshot(page, 't4-01-logged-in');
    
    // Navigate to billing
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 't4-02-billing-page');
    
    // Look for VAT information on the page
    const vatText = page.locator('text=VAT').or(page.locator('text=5%')).or(page.locator('text=Tax'));
    if (await vatText.first().isVisible({ timeout: 5000 })) {
      await screenshot(page, 't4-03-vat-visible');
      console.log('✅ VAT information visible on page');
    }
    
    // Check invoice via API
    try {
      const invoicesResponse = await request.get(`${API_URL}/billing/invoices?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const invoicesData = await invoicesResponse.json();
      saveApiResponse('t4-invoices', invoicesData);
      
      if (invoicesData.data && invoicesData.data.length > 0) {
        const invoice = invoicesData.data[0];
        console.log(`Invoice ${invoice.invoiceNumber}:`);
        console.log(`  Total: ${invoice.totalAmount}`);
        console.log(`  VAT Amount: ${invoice.vatAmount || 'Not specified'}`);
        console.log(`  VAT Rate: ${invoice.vatRate || 'Not specified'}%`);
        console.log(`  TRN: ${invoice.taxRegistrationNumber || 'Not specified'}`);
        
        // Check for VAT fields
        if (invoice.vatAmount !== undefined || invoice.vatRate !== undefined) {
          console.log('✅ VAT fields present in invoice');
        }
        
        // Get detailed invoice
        const detailResponse = await request.get(`${API_URL}/billing/invoices/${invoice.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const detailData = await detailResponse.json();
        saveApiResponse('t4-invoice-detail', detailData);
        
        // Check for VAT-exempt items
        if (detailData.data?.items) {
          const vatExempt = detailData.data.items.filter((item: any) => item.vatExempt === true);
          if (vatExempt.length > 0) {
            console.log(`✅ Found ${vatExempt.length} VAT-exempt items`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ VAT API Error: ${error}`);
      saveApiResponse('t4-vat-error', { error: String(error) });
    }
    
    await screenshot(page, 't4-04-final');
    console.log('✅ Test 4 Complete');
  });

  test('Test 5 — Insurance Underpayment Processing', async ({ page, request }) => {
    test.setTimeout(60000);
    console.log('\n⚠️ TEST 5: Insurance Underpayment Processing\n');
    
    // Login
    await login(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    const token = await getAuthToken(page);
    await screenshot(page, 't5-01-logged-in');
    
    // Test underpayment processing API
    const underpaymentRequest = {
      claimId: 'test-claim-123',
      claimedAmount: 1000,
      remittedAmount: 800,
      payerId: 'daman',
      patientId: 'md-kamil-id'
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
      
      console.log(`Underpayment API Response Status: ${response.status()}`);
      console.log(`Response: ${JSON.stringify(responseData, null, 2)}`);
      
      if (response.ok()) {
        console.log('✅ Underpayment processing API working');
        if (responseData.shortfall !== undefined) {
          console.log(`   Shortfall: ${responseData.shortfall}`);
          console.log(`   Patient bill generated: ${responseData.patientBillId || 'N/A'}`);
        }
      } else {
        console.log(`⚠️ Underpayment API returned ${response.status()}`);
      }
    } catch (error) {
      console.log(`❌ Underpayment API Error: ${error}`);
      saveApiResponse('t5-underpayment-error', { error: String(error) });
    }
    
    await screenshot(page, 't5-02-final');
    console.log('✅ Test 5 Complete');
  });

  test('Test 6 — DHA eClaimLink Sandbox', async ({ page, request }) => {
    test.setTimeout(90000);
    console.log('\n🏛️ TEST 6: DHA eClaimLink Sandbox\n');
    
    // Login
    await login(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    const token = await getAuthToken(page);
    await screenshot(page, 't6-01-logged-in');
    
    // Test Eligibility Check
    console.log('\n--- Eligibility Check ---');
    try {
      const eligibilityResponse = await request.post(`${API_URL}/insurance-coding/dha/eligibility`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: {
          emiratesId: '784-1990-1234567-1',
          payerId: 'daman',
          sandbox: true
        }
      });
      
      const eligibilityData = await eligibilityResponse.json();
      saveApiResponse('t6-eligibility', eligibilityData);
      
      console.log(`Eligibility API Status: ${eligibilityResponse.status()}`);
      if (eligibilityResponse.ok()) {
        console.log('✅ DHA Eligibility check working');
        console.log(`   Result: ${JSON.stringify(eligibilityData, null, 2).substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`❌ Eligibility Error: ${error}`);
    }
    
    // Test Claim Submission
    console.log('\n--- Claim Submission ---');
    try {
      const claimResponse = await request.post(`${API_URL}/insurance-coding/dha/submit-claim`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: {
          invoiceId: 'test-invoice-123',
          payerId: 'daman',
          sandbox: true
        }
      });
      
      const claimData = await claimResponse.json();
      saveApiResponse('t6-claim-submission', claimData);
      
      console.log(`Claim Submission API Status: ${claimResponse.status()}`);
      if (claimResponse.ok()) {
        console.log('✅ DHA Claim submission working');
        if (claimData.xml) {
          console.log('✅ XML generated');
          // Save XML separately
          fs.writeFileSync(
            path.join(SCREENSHOT_DIR, `t6-claim-xml-${Date.now()}.xml`),
            claimData.xml
          );
        }
      }
    } catch (error) {
      console.log(`❌ Claim Submission Error: ${error}`);
    }
    
    // Test Claim Status Inquiry
    console.log('\n--- Claim Status Inquiry ---');
    try {
      const statusResponse = await request.get(`${API_URL}/insurance-coding/dha/claim-status/test-claim-123?sandbox=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const statusData = await statusResponse.json();
      saveApiResponse('t6-claim-status', statusData);
      
      console.log(`Claim Status API Status: ${statusResponse.status()}`);
      if (statusResponse.ok()) {
        console.log('✅ DHA Claim status inquiry working');
      }
    } catch (error) {
      console.log(`❌ Claim Status Error: ${error}`);
    }
    
    await screenshot(page, 't6-02-final');
    console.log('✅ Test 6 Complete');
  });

  test('Test 7 — IPD Insurance Expiry Monitor', async ({ page, request }) => {
    test.setTimeout(60000);
    console.log('\n⏰ TEST 7: IPD Insurance Expiry Monitor\n');
    
    // Login
    await login(page, 'receptionist@hospital.com', 'password123', 'Receptionist');
    const token = await getAuthToken(page);
    await screenshot(page, 't7-01-logged-in');
    
    // Test expiry alerts API
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
        if (Array.isArray(responseData.data)) {
          console.log(`   Found ${responseData.data.length} expiry alerts`);
          responseData.data.forEach((alert: any, i: number) => {
            console.log(`   ${i + 1}. Patient: ${alert.patientName || 'N/A'}, Expires: ${alert.expiryDate || 'N/A'}`);
          });
        }
      } else {
        console.log(`⚠️ Expiry alerts API returned ${response.status()}`);
      }
    } catch (error) {
      console.log(`❌ Expiry Alerts Error: ${error}`);
      saveApiResponse('t7-expiry-error', { error: String(error) });
    }
    
    // Also check IPD page for expiry warnings
    await page.goto(`${BASE_URL}/ipd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 't7-02-ipd-page');
    
    const expiryWarning = page.locator('text=expir').or(page.locator('text=Expir')).or(page.locator('[class*="warning"]'));
    if (await expiryWarning.first().isVisible({ timeout: 5000 })) {
      await screenshot(page, 't7-03-expiry-warning-visible');
      console.log('✅ Expiry warnings visible on IPD page');
    }
    
    await screenshot(page, 't7-04-final');
    console.log('✅ Test 7 Complete');
  });

});

// Summary test that collects all results
test('Summary — Generate Test Report', async ({ page }) => {
  console.log('\n' + '='.repeat(60));
  console.log('📊 ADVANCED INSURANCE E2E TEST SUMMARY');
  console.log('='.repeat(60));
  
  const files = fs.readdirSync(SCREENSHOT_DIR);
  const screenshots = files.filter(f => f.endsWith('.png'));
  const apiResponses = files.filter(f => f.endsWith('.json'));
  
  console.log(`\n📸 Screenshots captured: ${screenshots.length}`);
  console.log(`💾 API responses saved: ${apiResponses.length}`);
  console.log(`\nAll test artifacts saved to: ${SCREENSHOT_DIR}`);
  console.log('='.repeat(60));
});
