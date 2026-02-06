import { test, expect } from '@playwright/test';

/**
 * Setup Demo Appointments
 * Books appointments for multiple patients to ensure SCHEDULED status for check-in demo
 */

const BASE_URL = 'https://spetaar.ai';

const CREDS = {
  receptionist: { email: 'receptionist@hospital.com', password: 'password123' },
  patient: { email: 'kamil@taqon.ai', password: 'password123' },
};

// Test patients to book appointments for
const TEST_PATIENTS = [
  { name: 'Kamil', search: 'Kamil', scenario: 'Standard insured - Daman' },
  { name: 'Sara', search: 'Sara', scenario: 'Pre-auth required' },
  { name: 'Anindya', search: 'Anindya', scenario: 'Regular patient' },
  { name: 'Fatima', search: 'Fatima', scenario: 'Expired insurance' },
];

async function login(page: any, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

async function screenshot(page: any, name: string) {
  await page.screenshot({ path: `test-results/setup-appointments/${name}.png`, fullPage: false });
  console.log(`📸 ${name}`);
}

test.describe.serial('Setup Demo Appointments', () => {
  
  test('1. Book Appointments via Receptionist for All Test Patients', async ({ page }) => {
    test.setTimeout(300000); // 5 minutes for all bookings
    
    console.log('\n📅 BOOKING APPOINTMENTS FOR DEMO\n');
    
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    console.log('✅ Receptionist logged in');
    await screenshot(page, '01-logged-in');
    
    // Navigate to Appointments
    await page.goto(`${BASE_URL}/appointments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, '02-appointments-page');
    
    for (let i = 0; i < TEST_PATIENTS.length; i++) {
      const patient = TEST_PATIENTS[i];
      console.log(`\n--- Booking for ${patient.name} (${patient.scenario}) ---`);
      
      // Look for New/Create Appointment button
      const newBtn = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Book"), button:has-text("Add"), a:has-text("New")').first();
      
      if (await newBtn.isVisible({ timeout: 5000 })) {
        await newBtn.click();
        await page.waitForTimeout(2000);
        await screenshot(page, `03-${i+1}-new-form-${patient.name}`);
        
        // Search for patient
        const patientSearch = page.locator('input[placeholder*="Search"], input[placeholder*="patient"], input[placeholder*="name"], input[placeholder*="MRN"]').first();
        if (await patientSearch.isVisible({ timeout: 3000 })) {
          await patientSearch.fill(patient.search);
          await page.waitForTimeout(2000);
          await screenshot(page, `04-${i+1}-patient-search-${patient.name}`);
          
          // Click on patient from dropdown
          const patientOption = page.locator(`[role="option"]:has-text("${patient.search}"), .dropdown-item:has-text("${patient.search}"), li:has-text("${patient.search}"), button:has-text("${patient.search}")`).first();
          if (await patientOption.isVisible({ timeout: 3000 })) {
            await patientOption.click();
            await page.waitForTimeout(1000);
            console.log(`  ✅ Selected patient: ${patient.name}`);
          } else {
            // Try clicking first result
            const firstResult = page.locator('.suggestion, [class*="dropdown"] button, [class*="dropdown"] li, [class*="option"]').first();
            if (await firstResult.isVisible({ timeout: 2000 })) {
              await firstResult.click();
              await page.waitForTimeout(1000);
            }
          }
        }
        
        // Select Department/Specialty
        const deptSelect = page.locator('select[name*="department"], select[name*="specialty"], [data-testid="department"]').first();
        if (await deptSelect.isVisible({ timeout: 3000 })) {
          const options = await deptSelect.locator('option').all();
          if (options.length > 1) {
            await deptSelect.selectOption({ index: 1 });
            console.log('  ✅ Selected department');
          }
        }
        
        // Select Doctor
        const doctorSelect = page.locator('select[name*="doctor"], select[name*="provider"], [data-testid="doctor"]').first();
        if (await doctorSelect.isVisible({ timeout: 3000 })) {
          await page.waitForTimeout(1000); // Wait for doctors to load
          const options = await doctorSelect.locator('option').all();
          if (options.length > 1) {
            await doctorSelect.selectOption({ index: 1 });
            console.log('  ✅ Selected doctor');
          }
        }
        
        // Set Date (today)
        const dateInput = page.locator('input[type="date"], input[name*="date"]').first();
        if (await dateInput.isVisible({ timeout: 3000 })) {
          const today = new Date().toISOString().split('T')[0];
          await dateInput.fill(today);
          console.log(`  ✅ Set date: ${today}`);
        }
        
        // Select Time Slot
        const timeSelect = page.locator('select[name*="time"], select[name*="slot"], input[type="time"]').first();
        if (await timeSelect.isVisible({ timeout: 3000 })) {
          if (await timeSelect.evaluate((el: any) => el.tagName === 'SELECT')) {
            const options = await timeSelect.locator('option').all();
            // Select different time for each patient
            const timeIndex = Math.min(i + 1, options.length - 1);
            if (options.length > 1) {
              await timeSelect.selectOption({ index: timeIndex });
              console.log('  ✅ Selected time slot');
            }
          } else {
            // It's an input
            const times = ['09:00', '10:00', '11:00', '14:00'];
            await timeSelect.fill(times[i % times.length]);
            console.log(`  ✅ Set time: ${times[i % times.length]}`);
          }
        }
        
        // Try clicking on time slot buttons if they exist
        const timeSlotBtn = page.locator('button:has-text(":"), button[class*="slot"], [data-testid*="slot"]').nth(i);
        if (await timeSlotBtn.isVisible({ timeout: 2000 })) {
          await timeSlotBtn.click();
          console.log('  ✅ Clicked time slot button');
        }
        
        await screenshot(page, `05-${i+1}-form-filled-${patient.name}`);
        
        // Submit the appointment
        const submitBtn = page.locator('button[type="submit"], button:has-text("Book"), button:has-text("Create"), button:has-text("Save"), button:has-text("Confirm")').first();
        if (await submitBtn.isVisible({ timeout: 3000 })) {
          const isDisabled = await submitBtn.isDisabled();
          if (!isDisabled) {
            await submitBtn.click();
            await page.waitForTimeout(3000);
            console.log(`  ✅ Appointment booked for ${patient.name}!`);
            await screenshot(page, `06-${i+1}-booked-${patient.name}`);
          } else {
            console.log(`  ⚠️ Submit disabled for ${patient.name} - check required fields`);
            await screenshot(page, `06-${i+1}-submit-disabled-${patient.name}`);
          }
        }
        
        // Close any modal if still open
        const closeBtn = page.locator('button:has-text("Close"), button:has-text("×"), [aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 2000 })) {
          await closeBtn.click();
          await page.waitForTimeout(1000);
        }
        
        // Go back to appointments list for next booking
        await page.goto(`${BASE_URL}/appointments`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
      } else {
        console.log(`  ⚠️ New appointment button not found`);
        await screenshot(page, `03-${i+1}-no-new-btn`);
      }
    }
    
    // Final check - go to OPD to verify
    console.log('\n--- Verifying appointments in OPD ---');
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, '07-opd-after-booking');
    
    // Check Today's Appointments
    const todayTab = page.locator('text=Today\'s Appointments, button:has-text("Today")').first();
    if (await todayTab.isVisible({ timeout: 3000 })) {
      await todayTab.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '08-today-appointments');
    }
    
    // Count Check In buttons
    const checkInButtons = await page.locator('button:has-text("Check In")').count();
    console.log(`\n✅ Found ${checkInButtons} Check In buttons available`);
    
    await screenshot(page, '09-final-opd-state');
  });

  test('2. Alternative: Book via Quick Appointment if Available', async ({ page }) => {
    test.setTimeout(120000);
    
    console.log('\n📅 TRYING QUICK APPOINTMENT METHOD\n');
    
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    
    // Go to OPD and try Walk-in
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Look for Walk-in Patient button
    const walkInBtn = page.locator('button:has-text("Walk-in"), button:has-text("Walk In"), button:has-text("Quick")').first();
    
    if (await walkInBtn.isVisible({ timeout: 5000 })) {
      console.log('Found Walk-in Patient button');
      await walkInBtn.click();
      await page.waitForTimeout(2000);
      await screenshot(page, 'quick-1-walkin-form');
      
      // Search for patient
      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="patient"]').first();
      if (await searchInput.isVisible({ timeout: 3000 })) {
        await searchInput.fill('Kamil');
        await page.waitForTimeout(2000);
        
        const result = page.locator('[role="option"], .dropdown-item, li:has-text("Kamil")').first();
        if (await result.isVisible({ timeout: 3000 })) {
          await result.click();
          console.log('Selected Kamil');
        }
      }
      
      // Select doctor if needed
      const doctorSelect = page.locator('select[name*="doctor"]').first();
      if (await doctorSelect.isVisible({ timeout: 2000 })) {
        await doctorSelect.selectOption({ index: 1 });
      }
      
      // Submit
      const submitBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Book")').first();
      if (await submitBtn.isVisible({ timeout: 3000 })) {
        if (!(await submitBtn.isDisabled())) {
          await submitBtn.click();
          await page.waitForTimeout(3000);
          console.log('✅ Walk-in appointment created');
        }
      }
      
      await screenshot(page, 'quick-2-after-submit');
    } else {
      console.log('Walk-in button not found on OPD page');
    }
    
    // Final screenshot
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'quick-3-final-opd');
    
    const checkInCount = await page.locator('button:has-text("Check In")').count();
    console.log(`\n✅ Final Check In button count: ${checkInCount}`);
  });

  test('3. Direct API Appointment Creation (Fallback)', async ({ page, request }) => {
    test.setTimeout(60000);
    
    console.log('\n📅 TRYING API METHOD FOR APPOINTMENT CREATION\n');
    
    // Login to get token
    await login(page, CREDS.receptionist.email, CREDS.receptionist.password);
    
    // Get token from browser
    const token = await page.evaluate(() => {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    });
    
    if (!token) {
      console.log('⚠️ No auth token found');
      return;
    }
    
    console.log('✅ Got auth token');
    
    // Get list of patients first
    try {
      const patientsRes = await request.get(`${BASE_URL}/api/v1/patients?limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const patientsData = await patientsRes.json();
      console.log(`Found ${patientsData.data?.length || 0} patients`);
      
      if (patientsData.data && patientsData.data.length > 0) {
        // Get doctors
        const doctorsRes = await request.get(`${BASE_URL}/api/v1/doctors?limit=5`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const doctorsData = await doctorsRes.json();
        
        const doctorId = doctorsData.data?.[0]?.id;
        console.log(`Using doctor: ${doctorId}`);
        
        // Create appointments for first 3 patients
        for (let i = 0; i < Math.min(3, patientsData.data.length); i++) {
          const patient = patientsData.data[i];
          
          const appointmentData = {
            patientId: patient.id,
            doctorId: doctorId,
            appointmentDate: new Date().toISOString().split('T')[0],
            appointmentTime: `${9 + i}:00`,
            type: 'CONSULTATION',
            status: 'SCHEDULED',
            reason: 'Demo appointment'
          };
          
          try {
            const createRes = await request.post(`${BASE_URL}/api/v1/appointments`, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              data: appointmentData
            });
            
            const result = await createRes.json();
            if (createRes.ok()) {
              console.log(`✅ Created appointment for ${patient.firstName} ${patient.lastName}`);
            } else {
              console.log(`⚠️ Failed for ${patient.firstName}: ${JSON.stringify(result)}`);
            }
          } catch (e) {
            console.log(`❌ Error creating appointment: ${e}`);
          }
        }
      }
    } catch (e) {
      console.log(`❌ API Error: ${e}`);
    }
    
    // Verify in OPD
    await page.goto(`${BASE_URL}/opd`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await screenshot(page, 'api-final-opd');
    
    const checkInCount = await page.locator('button:has-text("Check In")').count();
    console.log(`\n✅ Final Check In button count: ${checkInCount}`);
  });
});
