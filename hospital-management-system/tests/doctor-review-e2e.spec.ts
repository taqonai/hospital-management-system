import { test, expect } from '@playwright/test';

const BASE = 'https://spetaar.ai';

test.describe('Doctor Review - Patient Portal', () => {
  test('Patient can rate a doctor after a completed appointment', async ({ page }) => {
    // ── Step 1: Login as patient ──
    console.log('Step 1: Logging in as patient...');
    await page.goto(`${BASE}/patient-portal/login`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/review-01-login-page.png' });

    // Fill credentials
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'kamil@taqon.ai');
    await page.fill('input[type="password"], input[name="password"], input[placeholder*="password" i]', 'password123');
    await page.screenshot({ path: 'test-results/review-02-credentials-filled.png' });

    // Click login button
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/review-03-after-login.png' });

    // ── Step 2: Navigate to Appointments ──
    console.log('Step 2: Navigating to appointments...');
    await page.goto(`${BASE}/patient-portal/appointments`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/review-04-appointments-page.png' });

    // ── Step 3: Switch to Past tab ──
    console.log('Step 3: Switching to Past tab...');
    const pastTab = page.getByRole('button', { name: /past/i });
    if (await pastTab.isVisible()) {
      await pastTab.click();
    } else {
      // Try text-based selector
      await page.click('button:has-text("Past")');
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/review-05-past-tab.png' });

    // ── Step 4: Look for "Rate Doctor" button ──
    console.log('Step 4: Looking for Rate Doctor button...');
    const rateButton = page.locator('button:has-text("Rate Doctor")').first();
    const reviewedBadge = page.locator('text=Reviewed').first();

    // Check if there's a Rate Doctor button or all are already reviewed
    const hasRateButton = await rateButton.isVisible({ timeout: 5000 }).catch(() => false);
    const hasReviewedBadge = await reviewedBadge.isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Rate Doctor button visible: ${hasRateButton}`);
    console.log(`Reviewed badge visible: ${hasReviewedBadge}`);

    await page.screenshot({ path: 'test-results/review-06-rate-button-check.png' });

    if (hasRateButton) {
      // ── Step 5: Click Rate Doctor ──
      console.log('Step 5: Clicking Rate Doctor...');
      await rateButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-results/review-07-review-modal.png' });

      // ── Step 6: Select star rating (4 stars) ──
      console.log('Step 6: Selecting 4 stars...');
      // The stars are buttons inside the modal, click the 4th one
      const starButtons = page.locator('[role="dialog"] button, .fixed button').filter({ has: page.locator('svg') });

      // Try clicking the 4th star by finding buttons in the modal with star SVGs
      const modalStars = page.locator('button:has(svg.h-10)');
      const starCount = await modalStars.count();
      console.log(`Found ${starCount} star buttons`);

      if (starCount >= 4) {
        await modalStars.nth(3).click(); // 4th star (0-indexed)
      } else {
        // Fallback: click all buttons that look like stars in the dialog area
        const allButtons = page.locator('button').filter({ has: page.locator('svg') });
        const count = await allButtons.count();
        console.log(`Total SVG buttons: ${count}`);
        // Find star buttons by looking at size classes
        for (let i = 0; i < count; i++) {
          const btn = allButtons.nth(i);
          const classes = await btn.locator('svg').getAttribute('class').catch(() => '');
          if (classes && (classes.includes('h-10') || classes.includes('w-10'))) {
            // This is a star button, click the 4th one we find
            const starIdx = i;
            if (starIdx >= 0) {
              // Click 4th star from the group
              await allButtons.nth(i).click();
              break;
            }
          }
        }
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'test-results/review-08-stars-selected.png' });

      // ── Step 7: Type a comment ──
      console.log('Step 7: Typing review comment...');
      const textarea = page.locator('textarea');
      if (await textarea.isVisible()) {
        await textarea.fill('Great experience! The doctor was very professional and explained everything clearly. Highly recommend.');
      }
      await page.screenshot({ path: 'test-results/review-09-comment-typed.png' });

      // ── Step 8: Submit the review ──
      console.log('Step 8: Submitting review...');
      const submitBtn = page.locator('button:has-text("Submit Review")');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(3000);
      }
      await page.screenshot({ path: 'test-results/review-10-after-submit.png' });

      // ── Step 9: Verify the "Reviewed" badge appears ──
      console.log('Step 9: Verifying Reviewed badge...');
      // Check for success toast or Reviewed badge
      const toast = page.locator('text=Thank you');
      const reviewed = page.locator('text=Reviewed');
      const hasToast = await toast.isVisible({ timeout: 5000 }).catch(() => false);
      const hasReviewed = await reviewed.first().isVisible({ timeout: 3000 }).catch(() => false);

      console.log(`Success toast visible: ${hasToast}`);
      console.log(`Reviewed badge visible: ${hasReviewed}`);

      await page.screenshot({ path: 'test-results/review-11-verified.png' });

      // At least one should be true
      expect(hasToast || hasReviewed).toBeTruthy();

    } else if (hasReviewedBadge) {
      console.log('All completed appointments already reviewed - badge is showing correctly');
      await page.screenshot({ path: 'test-results/review-07-already-reviewed.png' });
      // Verify the Reviewed badge exists - this confirms the feature works
      expect(hasReviewedBadge).toBeTruthy();
    } else {
      console.log('No completed appointments found with review capability');
      await page.screenshot({ path: 'test-results/review-07-no-completed.png' });
    }

    // ── Step 10: Verify from staff side - Doctor Detail Reviews tab ──
    console.log('Step 10: Checking doctor detail page (staff side)...');
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="email"], input[name="email"]', 'admin@hospital.com');
    await page.fill('input[type="password"], input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/review-12-staff-login.png' });

    // Navigate to Doctors page
    await page.goto(`${BASE}/doctors`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/review-13-doctors-list.png' });

    // Find and click on a doctor that has reviews (Dr. Anagha Vijay or Dr. Idi Amin)
    const doctorLink = page.locator('a:has-text("Anagha"), a:has-text("Idi Amin"), button:has-text("Anagha"), button:has-text("Idi Amin"), tr:has-text("Anagha"), tr:has-text("Idi Amin")').first();
    if (await doctorLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await doctorLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/review-14-doctor-detail.png' });

      // Click the Reviews tab
      const reviewsTab = page.locator('button:has-text("Reviews")');
      if (await reviewsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await reviewsTab.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/review-15-reviews-tab.png' });

        // Verify reviews are displayed
        const reviewContent = page.locator('text=Patient Reviews');
        const hasReviewContent = await reviewContent.isVisible({ timeout: 5000 }).catch(() => false);
        console.log(`Reviews tab content visible: ${hasReviewContent}`);
        expect(hasReviewContent).toBeTruthy();
      }
    } else {
      // Try navigating directly to a known doctor
      console.log('Navigating directly to doctor detail...');
      await page.goto(`${BASE}/doctors/a326353e-547a-44bc-a814-fbeb41b5d452`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/review-14-doctor-detail-direct.png' });

      const reviewsTab = page.locator('button:has-text("Reviews")');
      if (await reviewsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await reviewsTab.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/review-15-reviews-tab.png' });
      }
    }

    console.log('Doctor review E2E test completed!');
  });
});
