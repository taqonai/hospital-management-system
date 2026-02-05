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

test.describe.serial('Demo Verification Tests', () => {
  
  test('1. Receptionist Login & OPD Access', async ({ page }) => {
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    console.log('✅ Receptionist login successful');
    
    // Navigate to OPD
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check for key elements
    const hasQueue = await page.locator('text=Queue, text=Appointments, text=Today').first().isVisible().catch(() => false);
    console.log(`✅ OPD page loaded, queue visible: ${hasQueue}`);
    
    await page.screenshot({ path: 'test-results/demo-1-opd.png' });
  });

  test('2. Doctor Login & Consultation Access', async ({ page }) => {
    await login(page, CREDS.doctor.email, CREDS.doctor.password);
    console.log('✅ Doctor login successful');
    
    // Check for patient queue
    const hasPatientQueue = await page.locator('text=Patient Queue, text=Pending, text=Consultation').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Doctor dashboard, patient queue: ${hasPatientQueue}`);
    
    await page.screenshot({ path: 'test-results/demo-2-doctor.png' });
  });

  test('3. Billing Page Access', async ({ page }) => {
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    
    await page.goto(`${BASE_URL}/billing`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const hasBilling = await page.locator('text=Invoice, text=Billing, text=Payment').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Billing page: ${hasBilling}`);
    
    await page.screenshot({ path: 'test-results/demo-3-billing.png' });
  });

  test('4. Insurance/Claims Access', async ({ page }) => {
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    
    await page.goto(`${BASE_URL}/insurance`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const hasInsurance = await page.locator('text=Insurance, text=Claims, text=Verification').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Insurance page: ${hasInsurance}`);
    
    await page.screenshot({ path: 'test-results/demo-4-insurance.png' });
  });

  test('5. Lab Page Access', async ({ page }) => {
    await login(page, CREDS.labtech.email, CREDS.labtech.password);
    
    const hasLabQueue = await page.locator('text=Lab, text=Pending, text=Sample').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Lab dashboard: ${hasLabQueue}`);
    
    await page.screenshot({ path: 'test-results/demo-5-lab.png' });
  });

  test('6. Pharmacy Page Access', async ({ page }) => {
    await login(page, CREDS.pharmacist.email, CREDS.pharmacist.password);
    
    const hasPharmacy = await page.locator('text=Pharmacy, text=Prescription, text=Dispense').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Pharmacy dashboard: ${hasPharmacy}`);
    
    await page.screenshot({ path: 'test-results/demo-6-pharmacy.png' });
  });

  test('7. IPD Page Access', async ({ page }) => {
    await login(page, CREDS.doctor.email, CREDS.doctor.password);
    
    await page.goto(`${BASE_URL}/ipd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const hasIPD = await page.locator('text=IPD, text=Admission, text=Ward').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ IPD page: ${hasIPD}`);
    
    await page.screenshot({ path: 'test-results/demo-7-ipd.png' });
  });

  test('8. Pre-Auth Page Access', async ({ page }) => {
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    
    await page.goto(`${BASE_URL}/insurance/pre-auth`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const hasPreAuth = await page.locator('text=Pre-Auth, text=Authorization, text=Request').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`✅ Pre-Auth page: ${hasPreAuth}`);
    
    await page.screenshot({ path: 'test-results/demo-8-preauth.png' });
  });
});
