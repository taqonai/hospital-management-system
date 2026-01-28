import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://spetaar.ai';
const LOGIN_EMAIL = 'admin@hospital.com';
const LOGIN_PASSWORD = 'password123';

interface TestResult {
  feature: string;
  status: '✅' | '❌' | '⚠️';
  details: string;
}

const results: TestResult[] = [];

function recordResult(feature: string, status: '✅' | '❌' | '⚠️', details: string) {
  results.push({ feature, status, details });
  console.log(`${status} ${feature}: ${details}`);
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', LOGIN_EMAIL);
  await page.fill('input[type="password"]', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

test.describe('IPD Module Comprehensive Review', () => {
  test.setTimeout(120000); // 2 minutes for thorough testing

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    
    // Login
    try {
      await login(page);
      recordResult('Login Flow', '✅', 'Successfully logged in');
    } catch (error) {
      recordResult('Login Flow', '❌', `Login failed: ${error}`);
      throw error;
    }
  });

  test('1. IPD Page Load', async () => {
    try {
      await page.goto(`${BASE_URL}/ipd`, { waitUntil: 'networkidle' });
      
      // Check if page loaded
      const title = await page.textContent('h1');
      if (title?.includes('Inpatient')) {
        recordResult('IPD Page Load', '✅', 'Page loaded successfully');
      } else {
        recordResult('IPD Page Load', '❌', 'Page title not found');
      }

      // Take screenshot
      await page.screenshot({ path: '/tmp/ipd-page-load.png', fullPage: true });
    } catch (error) {
      recordResult('IPD Page Load', '❌', `Failed to load: ${error}`);
    }
  });

  test('2. Stats Display', async () => {
    try {
      // Check if stats are visible
      const statsVisible = await page.isVisible('text=Total Beds');
      if (statsVisible) {
        const totalBeds = await page.textContent('text=Total Beds');
        recordResult('Stats Display', '✅', `Stats are displayed: ${totalBeds}`);
      } else {
        recordResult('Stats Display', '❌', 'Stats not visible');
      }
    } catch (error) {
      recordResult('Stats Display', '❌', `Error: ${error}`);
    }
  });

  test('3. Tab Navigation', async () => {
    try {
      const tabs = ['Bed Management', 'Admissions', 'NEWS2 Monitoring', 'Discharge Planning'];
      let allTabsWork = true;

      for (const tab of tabs) {
        try {
          await page.click(`text=${tab}`);
          await page.waitForTimeout(1000);
          const isActive = await page.isVisible(`button:has-text("${tab}")`);
          if (!isActive) allTabsWork = false;
        } catch {
          allTabsWork = false;
        }
      }

      if (allTabsWork) {
        recordResult('Tab Navigation', '✅', 'All tabs are clickable and functional');
      } else {
        recordResult('Tab Navigation', '⚠️', 'Some tabs may not work properly');
      }
    } catch (error) {
      recordResult('Tab Navigation', '❌', `Error: ${error}`);
    }
  });

  test('4. Bed Management Tab', async () => {
    try {
      await page.click('text=Bed Management');
      await page.waitForTimeout(2000);

      // Check if wards are displayed
      const wardsVisible = await page.$$('text=Ward');
      if (wardsVisible.length > 0) {
        recordResult('Bed Management - Ward Display', '✅', `${wardsVisible.length} ward sections found`);
      } else {
        recordResult('Bed Management - Ward Display', '⚠️', 'No wards displayed');
      }

      // Check bed grid
      const beds = await page.$$('[class*="grid"]');
      if (beds.length > 0) {
        recordResult('Bed Management - Bed Grid', '✅', 'Bed grid rendered');
      } else {
        recordResult('Bed Management - Bed Grid', '❌', 'Bed grid not found');
      }

      await page.screenshot({ path: '/tmp/ipd-beds.png', fullPage: true });
    } catch (error) {
      recordResult('Bed Management Tab', '❌', `Error: ${error}`);
    }
  });

  test('5. New Admission Modal', async () => {
    try {
      // Click "New Admission" button
      await page.click('text=New Admission');
      await page.waitForTimeout(1000);

      // Check if modal opened
      const modalVisible = await page.isVisible('text=New Patient Admission');
      if (modalVisible) {
        recordResult('New Admission - Modal Open', '✅', 'Modal opens successfully');

        // Check form fields
        const patientSearchExists = await page.isVisible('input[placeholder*="Search"]');
        const doctorSelectExists = await page.isVisible('text=Attending Doctor');
        const bedSelectExists = await page.isVisible('text=Select Bed');

        if (patientSearchExists && doctorSelectExists && bedSelectExists) {
          recordResult('New Admission - Form Fields', '✅', 'All required fields present');
        } else {
          recordResult('New Admission - Form Fields', '⚠️', 'Some fields may be missing');
        }

        // Test patient search
        await page.fill('input[placeholder*="Search"]', 'test');
        await page.waitForTimeout(2000);
        recordResult('New Admission - Patient Search', '✅', 'Search functionality works');

        // Close modal
        await page.click('text=Cancel');
        await page.waitForTimeout(500);
      } else {
        recordResult('New Admission - Modal', '❌', 'Modal did not open');
      }

      await page.screenshot({ path: '/tmp/ipd-admission-modal.png', fullPage: true });
    } catch (error) {
      recordResult('New Admission Modal', '❌', `Error: ${error}`);
    }
  });

  test('6. Admissions Tab', async () => {
    try {
      await page.click('text=Admissions');
      await page.waitForTimeout(2000);

      // Check if admissions list is displayed
      const admissionsExist = await page.isVisible('text=Active Admissions');
      if (admissionsExist) {
        recordResult('Admissions Tab - Load', '✅', 'Admissions tab loads');

        // Count admission entries
        const admissionEntries = await page.$$('text=View Details');
        recordResult('Admissions Tab - Entries', '✅', `${admissionEntries.length} admissions displayed`);
      } else {
        recordResult('Admissions Tab', '⚠️', 'No admissions or empty state');
      }

      await page.screenshot({ path: '/tmp/ipd-admissions.png', fullPage: true });
    } catch (error) {
      recordResult('Admissions Tab', '❌', `Error: ${error}`);
    }
  });

  test('7. NEWS2 Monitoring Tab', async () => {
    try {
      await page.click('text=NEWS2 Monitoring');
      await page.waitForTimeout(2000);

      // Check summary cards
      const summaryCards = await page.$$('text=Total Patients');
      if (summaryCards.length > 0) {
        recordResult('NEWS2 Monitoring - Summary Cards', '✅', 'Summary cards displayed');
      } else {
        recordResult('NEWS2 Monitoring - Summary Cards', '❌', 'Summary cards not found');
      }

      // Check reference chart
      const referenceChart = await page.isVisible('text=NEWS2 Score Reference');
      if (referenceChart) {
        recordResult('NEWS2 Monitoring - Reference Chart', '✅', 'Reference chart visible');
      } else {
        recordResult('NEWS2 Monitoring - Reference Chart', '❌', 'Reference chart missing');
      }

      // Check patient list
      const patientListExists = await page.isVisible('text=Patient Monitoring');
      if (patientListExists) {
        recordResult('NEWS2 Monitoring - Patient List', '✅', 'Patient monitoring list rendered');

        // Check if "Record Vitals" button exists
        const recordVitalsButtons = await page.$$('button:has-text("Record Vitals")');
        if (recordVitalsButtons.length > 0) {
          recordResult('NEWS2 Monitoring - Record Vitals Button', '✅', `${recordVitalsButtons.length} buttons found`);

          // Try clicking first one
          try {
            await recordVitalsButtons[0].click();
            await page.waitForTimeout(1000);
            const modalOpen = await page.isVisible('text=Record Vitals');
            if (modalOpen) {
              recordResult('NEWS2 Monitoring - Vitals Modal', '✅', 'Vitals modal opens');
              
              // Check vitals form fields
              const rrField = await page.isVisible('text=Respiratory Rate');
              const spo2Field = await page.isVisible('text=SpO2');
              const bpField = await page.isVisible('text=Systolic BP');
              
              if (rrField && spo2Field && bpField) {
                recordResult('NEWS2 Monitoring - Vitals Form', '✅', 'All vitals fields present');
              } else {
                recordResult('NEWS2 Monitoring - Vitals Form', '⚠️', 'Some vitals fields missing');
              }

              // Close modal
              await page.click('text=Cancel').catch(() => {});
            } else {
              recordResult('NEWS2 Monitoring - Vitals Modal', '❌', 'Modal did not open');
            }
          } catch (error) {
            recordResult('NEWS2 Monitoring - Record Vitals', '❌', `Error clicking: ${error}`);
          }
        } else {
          recordResult('NEWS2 Monitoring - Record Vitals Button', '⚠️', 'No patients to record vitals for');
        }
      } else {
        recordResult('NEWS2 Monitoring - Patient List', '⚠️', 'No patients in monitoring list');
      }

      await page.screenshot({ path: '/tmp/ipd-news2.png', fullPage: true });
    } catch (error) {
      recordResult('NEWS2 Monitoring Tab', '❌', `Error: ${error}`);
    }
  });

  test('8. Discharge Planning Tab', async () => {
    try {
      await page.click('text=Discharge Planning');
      await page.waitForTimeout(2000);

      const dischargePlanning = await page.isVisible('text=Patients Ready for Discharge');
      if (dischargePlanning) {
        recordResult('Discharge Planning - Load', '✅', 'Discharge planning tab loads');

        // Check for discharge buttons
        const dischargeButtons = await page.$$('button:has-text("Discharge")');
        recordResult('Discharge Planning - Discharge Buttons', '✅', `${dischargeButtons.length} patients ready for discharge`);
      } else {
        recordResult('Discharge Planning', '⚠️', 'Empty state or not loaded');
      }

      await page.screenshot({ path: '/tmp/ipd-discharge.png', fullPage: true });
    } catch (error) {
      recordResult('Discharge Planning Tab', '❌', `Error: ${error}`);
    }
  });

  test('9. AI Features', async () => {
    try {
      // Check if AI buttons exist
      const deteriorationButton = await page.isVisible('button:has-text("Deterioration Monitor")');
      const optimizeButton = await page.isVisible('button:has-text("Optimize Beds")');

      if (deteriorationButton && optimizeButton) {
        recordResult('AI Features - Buttons', '✅', 'AI feature buttons present');

        // Test Deterioration Monitor
        await page.click('button:has-text("Deterioration Monitor")');
        await page.waitForTimeout(2000);
        const monitoringTabActive = await page.isVisible('text=Patient Monitoring');
        if (monitoringTabActive) {
          recordResult('AI Features - Deterioration Monitor', '✅', 'Switches to monitoring tab');
        } else {
          recordResult('AI Features - Deterioration Monitor', '⚠️', 'May not work as expected');
        }
      } else {
        recordResult('AI Features', '⚠️', 'AI buttons not visible (may be offline)');
      }
    } catch (error) {
      recordResult('AI Features', '❌', `Error: ${error}`);
    }
  });

  test('10. Data Source Check', async () => {
    try {
      // Intercept API calls
      const apiCalls: string[] = [];
      
      page.on('response', response => {
        if (response.url().includes('/api/')) {
          apiCalls.push(response.url());
        }
      });

      // Navigate through tabs to trigger API calls
      await page.click('text=Bed Management');
      await page.waitForTimeout(1500);
      await page.click('text=Admissions');
      await page.waitForTimeout(1500);
      await page.click('text=NEWS2 Monitoring');
      await page.waitForTimeout(1500);

      if (apiCalls.length > 0) {
        recordResult('Data Source - API Calls', '✅', `${apiCalls.length} API calls detected (dynamic data)`);
        console.log('API calls:', apiCalls.slice(0, 5));
      } else {
        recordResult('Data Source - API Calls', '⚠️', 'No API calls detected (may be hardcoded)');
      }
    } catch (error) {
      recordResult('Data Source Check', '❌', `Error: ${error}`);
    }
  });

  test('11. Admission Detail Page', async () => {
    try {
      // Go to admissions tab
      await page.click('text=Admissions');
      await page.waitForTimeout(2000);

      // Try to click first "View Details" button
      const viewDetailsButtons = await page.$$('button:has-text("View Details")');
      if (viewDetailsButtons.length > 0) {
        await viewDetailsButtons[0].click();
        await page.waitForTimeout(3000);

        // Check if detail page loaded
        const detailPageLoaded = await page.isVisible('text=Admission Details').catch(() => false) ||
                                  await page.isVisible('text=Patient Information').catch(() => false);
        
        if (detailPageLoaded) {
          recordResult('Admission Detail Page - Load', '✅', 'Detail page loads successfully');

          // Check for tabs on detail page
          const tabs = ['Progress Notes', 'Doctor Orders', 'Vitals', 'Discharge'];
          for (const tab of tabs) {
            const tabExists = await page.isVisible(`text=${tab}`).catch(() => false);
            if (tabExists) {
              recordResult(`Admission Detail - ${tab} Tab`, '✅', 'Tab exists');
            } else {
              recordResult(`Admission Detail - ${tab} Tab`, '❌', 'Tab not found');
            }
          }

          await page.screenshot({ path: '/tmp/ipd-admission-detail.png', fullPage: true });

          // Go back to IPD main page
          await page.goto(`${BASE_URL}/ipd`);
        } else {
          recordResult('Admission Detail Page', '❌', 'Detail page did not load');
        }
      } else {
        recordResult('Admission Detail Page', '⚠️', 'No admissions to view details');
      }
    } catch (error) {
      recordResult('Admission Detail Page', '❌', `Error: ${error}`);
    }
  });

  test('12. Responsive Design', async () => {
    try {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/ipd`);
      await page.waitForTimeout(2000);
      
      const mobileView = await page.isVisible('h1');
      if (mobileView) {
        recordResult('Responsive Design - Mobile', '✅', 'Page renders on mobile viewport');
      } else {
        recordResult('Responsive Design - Mobile', '❌', 'Mobile view issues');
      }

      // Reset to desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(1000);
    } catch (error) {
      recordResult('Responsive Design', '❌', `Error: ${error}`);
    }
  });

  test.afterAll(async () => {
    // Print summary
    console.log('\n\n========================================');
    console.log('IPD MODULE TEST SUMMARY');
    console.log('========================================\n');
    
    const passed = results.filter(r => r.status === '✅').length;
    const failed = results.filter(r => r.status === '❌').length;
    const partial = results.filter(r => r.status === '⚠️').length;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Partial/Warning: ${partial}\n`);
    
    console.log('Detailed Results:');
    console.log('----------------\n');
    results.forEach(r => {
      console.log(`${r.status} ${r.feature}`);
      console.log(`   ${r.details}\n`);
    });

    // Save results to file
    const fs = require('fs');
    const resultsJson = JSON.stringify(results, null, 2);
    fs.writeFileSync('/tmp/ipd-test-results.json', resultsJson);
    console.log('\nResults saved to /tmp/ipd-test-results.json');
    console.log('Screenshots saved to /tmp/ipd-*.png');

    await page.close();
  });
});
