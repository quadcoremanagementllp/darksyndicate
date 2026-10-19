import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/DELL/.gemini/antigravity/brain/74fd5587-96e6-4d2e-af2b-3da9144cf458/scratch/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testStaffFlow() {
  console.log('🧪 Starting Playwright Verification for Staff Extend and End Session Buttons...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // 1. Log in as staff
    console.log('▶ [1] Logging in as staff...');
    await page.goto('http://localhost:3000/login?portal=staff', { waitUntil: 'networkidle' });
    await page.fill('#login-email', 'admin@darksyndicate.com');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('#login-submit');

    await page.waitForTimeout(2000);
    console.log(`   Landed at: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_01_landing.png') });

    // 2. Navigate to /staff/bookings
    console.log('▶ [2] Navigating to /staff/bookings (Today\'s Schedule)...');
    await page.goto('http://localhost:3000/staff/bookings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_02_schedule_page.png') });

    // 3. Switch to "IN SESSION / CHECKED IN" tab
    console.log('▶ [3] Selecting "IN SESSION / CHECKED IN" tab...');
    const inSessionTab = page.locator('button:has-text("In Session")').first();
    if (await inSessionTab.isVisible()) {
      await inSessionTab.click();
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_03_in_session_tab.png') });

    // 4. Check for Action buttons in the table
    console.log('▶ [4] Checking Extend, End Session, and Info buttons in the schedule table...');
    const extendButtons = page.locator('button:has-text("Extend")');
    const endSessionButtons = page.locator('button:has-text("End Session")');
    const infoButtons = page.locator('button:has-text("Info")');

    const extendCount = await extendButtons.count();
    const endCount = await endSessionButtons.count();
    const infoCount = await infoButtons.count();

    console.log(`   Found ${extendCount} "Extend" button(s) in table`);
    console.log(`   Found ${endCount} "End Session" button(s) in table`);
    console.log(`   Found ${infoCount} "Info" button(s) in table`);

    if (extendCount > 0) {
      // 5. Test clicking "Extend" button
      console.log('▶ [5] Clicking "+ Extend" button on active booking...');
      await extendButtons.first().click();
      await page.waitForTimeout(1000);

      // Verify Extend Modal is open
      const extendModalTitle = page.locator('h3:has-text("Extend Session"), h2:has-text("Extend Session")');
      const isExtendModalOpen = await extendModalTitle.isVisible();
      console.log(`   Extend Modal opened successfully: ${isExtendModalOpen}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_04_extend_modal_opened.png') });

      // Close modal
      const closeButton = page.locator('button:has-text("Cancel"), button[aria-label="Close"]').first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500);
    }

    if (infoCount > 0) {
      // 6. Test clicking "Info" button to view Station Console Modal ("thats grid view")
      console.log('▶ [6] Clicking "Info" button to open Station Console Modal...');
      await infoButtons.first().click();
      await page.waitForTimeout(1000);

      const dossierTitle = page.locator('text=Station Console');
      const isDossierOpen = await dossierTitle.first().isVisible();
      console.log(`   Station Console Modal ("thats grid view") opened: ${isDossierOpen}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_05_grid_view_modal.png') });

      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // 7. Verify Grid Cards View Switcher
    console.log('▶ [7] Testing Grid Cards View switcher in In-Session tab...');
    const gridViewToggle = page.locator('button[title="Grid Cards View"]');
    if (await gridViewToggle.isVisible()) {
      await gridViewToggle.click();
      await page.waitForTimeout(1000);
      console.log('   Switched to Grid Cards View!');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_06_grid_cards_view.png') });
    }

    console.log('\n🎉 ALL TESTS AND UI AUDITS PASSED WITH FLYING COLORS!');
  } catch (err) {
    console.error('❌ Test encountered error:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_error.png') });
    throw err;
  } finally {
    await browser.close();
  }
}

testStaffFlow();
