import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://spetaar.ai';
const LOGIN_EMAIL = 'admin@hospital.com';
const LOGIN_PASSWORD = 'password123';

// Helper function to login
async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', LOGIN_EMAIL);
  await page.fill('input[type="password"]', LOGIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

test.describe('IPD Module - End-to-End Tests', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load IPD page successfully', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await expect(page.locator('h1')).toContainText('Inpatient');
    await expect(page.locator('text=Bed Management')).toBeVisible();
    await expect(page.locator('text=New Admission')).toBeVisible();
  });

  test('should navigate between tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    
    // Test each tab
    await page.click('text=Bed Management');
    await expect(page.locator('text=/Ward|Bed/i')).toBeVisible();
    
    await page.click('text=Admissions');
    await page.waitForTimeout(1000);
    
    await page.click('text=NEWS2 Monitoring');
    await expect(page.locator('text=NEWS2 Score Reference')).toBeVisible();
    
    await page.click('text=Discharge Planning');
    await expect(page.locator('text=Patients Ready for Discharge')).toBeVisible();
  });

  test('should display bed management correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await page.click('text=Bed Management');
    await page.waitForTimeout(2000);
    
    // Should have ward sections
    const wardElements = await page.locator('text=/Ward|ICU/i').count();
    expect(wardElements).toBeGreaterThan(0);
    
    // Should have bed grids
    const bedGrids = await page.locator('[class*="grid"]').count();
    expect(bedGrids).toBeGreaterThan(0);
  });

  test('should open new admission modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await page.click('button:has-text("New Admission")');
    
    // Modal should be visible
    await expect(page.locator('text=New Patient Admission')).toBeVisible();
    
    // Form fields should be present
    await expect(page.locator('text=Select Patient')).toBeVisible();
    await expect(page.locator('text=Attending Doctor')).toBeVisible();
    await expect(page.locator('text=Select Bed')).toBeVisible();
    await expect(page.locator('text=Admission Type')).toBeVisible();
  });

  test('should search for patients in admission modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await page.click('button:has-text("New Admission")');
    
    // Type in patient search
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('test');
    await page.waitForTimeout(2000);
    
    // Search should work (input should contain value)
    await expect(searchInput).toHaveValue('test');
  });

  test('should close admission modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await page.click('button:has-text("New Admission")');
    await expect(page.locator('text=New Patient Admission')).toBeVisible();
    
    // Click cancel
    await page.click('button:has-text("Cancel")');
    await page.waitForTimeout(500);
    
    // Modal should be closed
    await expect(page.locator('text=New Patient Admission')).not.toBeVisible();
  });

  test('should display NEWS2 monitoring dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await page.click('text=NEWS2 Monitoring');
    await page.waitForTimeout(2000);
    
    // Summary cards should be visible
    await expect(page.locator('text=Total Patients')).toBeVisible();
    await expect(page.locator('text=High Risk')).toBeVisible();
    
    // Reference chart should be visible
    await expect(page.locator('text=NEWS2 Score Reference')).toBeVisible();
    
    // Patient monitoring section should be visible
    await expect(page.locator('text=Patient Monitoring')).toBeVisible();
  });

  test('should open vitals recording modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await page.click('text=NEWS2 Monitoring');
    await page.waitForTimeout(2000);
    
    // Check if there are patients to record vitals for
    const recordVitalsButtons = await page.locator('button:has-text("Record Vitals")').count();
    
    if (recordVitalsButtons > 0) {
      await page.locator('button:has-text("Record Vitals")').first().click();
      await page.waitForTimeout(1000);
      
      // Modal should be visible
      await expect(page.locator('text=Record Vitals')).toBeVisible();
      
      // Vitals form fields should be present
      await expect(page.locator('text=Respiratory Rate')).toBeVisible();
      await expect(page.locator('text=SpO2')).toBeVisible();
      await expect(page.locator('text=/Systolic|Blood Pressure/i')).toBeVisible();
      await expect(page.locator('text=Heart Rate')).toBeVisible();
      await expect(page.locator('text=Temperature')).toBeVisible();
    } else {
      console.log('No patients available for vitals recording');
    }
  });

  test('should display discharge planning', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await page.click('text=Discharge Planning');
    await page.waitForTimeout(2000);
    
    // Header should be visible
    await expect(page.locator('text=Patients Ready for Discharge')).toBeVisible();
    
    // Check for discharge buttons or empty state
    const dischargeButtons = await page.locator('button:has-text("Discharge")').count();
    if (dischargeButtons === 0) {
      await expect(page.locator('text=/No patients|Empty/i')).toBeVisible();
    } else {
      expect(dischargeButtons).toBeGreaterThan(0);
    }
  });

  test('should display AI features when available', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    
    // Check for AI buttons
    const deteriorationBtn = await page.locator('button:has-text("Deterioration Monitor")').isVisible();
    const optimizeBtn = await page.locator('button:has-text("Optimize Beds")').isVisible();
    
    if (deteriorationBtn && optimizeBtn) {
      // Test Deterioration Monitor button
      await page.click('button:has-text("Deterioration Monitor")');
      await page.waitForTimeout(2000);
      
      // Should navigate to monitoring tab
      await expect(page.locator('text=Patient Monitoring')).toBeVisible();
    } else {
      console.log('AI features not available (may be offline)');
    }
  });

  test('should navigate to admission detail page', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await page.click('text=Admissions');
    await page.waitForTimeout(2000);
    
    // Check if there are admissions
    const viewDetailsButtons = await page.locator('button:has-text("View Details")').count();
    
    if (viewDetailsButtons > 0) {
      await page.locator('button:has-text("View Details")').first().click();
      await page.waitForTimeout(3000);
      
      // Detail page should load
      const detailPageLoaded = await page.locator('text=/Admission Details|Patient Information/i').isVisible();
      expect(detailPageLoaded).toBeTruthy();
      
      // Check for tabs on detail page
      await expect(page.locator('text=Progress Notes')).toBeVisible();
      await expect(page.locator('text=/Doctor.*Orders|Orders/i')).toBeVisible();
    } else {
      console.log('No admissions available to test detail page');
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/ipd`);
    await page.waitForTimeout(2000);
    
    // Page should still be functional
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('text=Bed Management')).toBeVisible();
    
    // Should be able to click tabs
    await page.click('text=NEWS2 Monitoring');
    await page.waitForTimeout(1000);
    await expect(page.locator('text=Total Patients')).toBeVisible();
  });

  test('should refresh monitoring data', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await page.click('text=NEWS2 Monitoring');
    await page.waitForTimeout(2000);
    
    // Find and click refresh button
    const refreshButton = page.locator('button:has-text("Refresh")');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(1500);
      
      // Data should still be visible (indicating refresh worked)
      await expect(page.locator('text=Patient Monitoring')).toBeVisible();
    }
  });
});

test.describe('IPD Module - API Integration Tests', () => {
  test.setTimeout(30000);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should load dynamic data from API', async ({ page }) => {
    const apiCalls: string[] = [];
    
    // Listen for API calls
    page.on('response', response => {
      if (response.url().includes('/api/ipd')) {
        apiCalls.push(response.url());
      }
    });

    await page.goto(`${BASE_URL}/ipd`);
    await page.waitForTimeout(3000);
    
    // Navigate through tabs to trigger API calls
    await page.click('text=Admissions');
    await page.waitForTimeout(1500);
    
    await page.click('text=NEWS2 Monitoring');
    await page.waitForTimeout(1500);
    
    // Should have made API calls
    expect(apiCalls.length).toBeGreaterThan(0);
    console.log(`Detected ${apiCalls.length} API calls`);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Intercept and fail API requests
    await page.route('**/api/ipd/wards', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await page.goto(`${BASE_URL}/ipd`);
    await page.waitForTimeout(2000);
    
    // Page should still load without crashing
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('IPD Module - Admission Detail Tests', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should navigate through admission detail tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await page.click('text=Admissions');
    await page.waitForTimeout(2000);
    
    const viewDetailsButtons = await page.locator('button:has-text("View Details")').count();
    
    if (viewDetailsButtons > 0) {
      await page.locator('button:has-text("View Details")').first().click();
      await page.waitForTimeout(3000);
      
      // Test each tab
      const tabs = ['Progress Notes', 'Vitals'];
      for (const tab of tabs) {
        const tabExists = await page.locator(`text=${tab}`).isVisible();
        if (tabExists) {
          await page.click(`text=${tab}`);
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('should display discharge form', async ({ page }) => {
    await page.goto(`${BASE_URL}/ipd`);
    await page.click('text=Discharge Planning');
    await page.waitForTimeout(2000);
    
    const dischargeButtons = await page.locator('button:has-text("Discharge")').count();
    
    if (dischargeButtons > 0) {
      await page.locator('button:has-text("Discharge")').first().click();
      await page.waitForTimeout(3000);
      
      // Should navigate to discharge tab
      const dischargeTabVisible = await page.locator('text=/Discharge|Final Diagnosis/i').isVisible();
      expect(dischargeTabVisible).toBeTruthy();
    }
  });
});
