import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/DELL/.gemini/antigravity/brain/74fd5587-96e6-4d2e-af2b-3da9144cf458/scratch/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('🧪 Starting Admin Sidebar Navigation & Manual Close Verification...\n');

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // 1. Login as Admin
    console.log('▶ [1] Logging in as Admin...');
    await page.goto('http://localhost:3000/login?portal=admin');
    await page.fill('#login-email', 'admin@darksyndicate.com');
    await page.fill('input[type="password"]', 'Admin@123456');
    await Promise.all([
      page.waitForURL('**/admin**', { timeout: 15000 }),
      page.click('#login-submit'),
    ]);

    // 2. Go to /admin/customers
    console.log('▶ [2] Navigating to /admin/customers...');
    await page.goto('http://localhost:3000/admin/customers', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const isSidebarVisible = async () => {
      const aside = page.locator('aside.hidden.md\\:flex');
      const box = await aside.boundingBox();
      return box && box.width > 50;
    };

    const initialOpen = await isSidebarVisible();
    console.log(`   Initial sidebar open: ${initialOpen}`);
    if (!initialOpen) throw new Error('Sidebar should be open initially');

    // 3. Click "Syndicate Passes" in the sidebar
    console.log('▶ [3] Clicking "Syndicate Passes" option in sidebar...');
    const passesLink = page.locator('aside.hidden.md\\:flex a:has-text("Syndicate Passes")');
    await passesLink.click();
    await page.waitForURL('**/admin/memberships', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Verify sidebar is STILL OPEN!
    const stillOpen1 = await isSidebarVisible();
    console.log(`   Sidebar remained OPEN after clicking Syndicate Passes: ${stillOpen1}`);
    if (!stillOpen1) {
      throw new Error('Sidebar automatically closed after clicking Syndicate Passes! It must remain open.');
    }

    // 4. Click "Financial Reports" in the sidebar
    console.log('▶ [4] Clicking "Financial Reports" option in sidebar...');
    const reportsLink = page.locator('aside.hidden.md\\:flex a:has-text("Financial Reports")');
    await reportsLink.click();
    await page.waitForURL('**/admin/reports', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Verify sidebar is STILL OPEN!
    const stillOpen2 = await isSidebarVisible();
    console.log(`   Sidebar remained OPEN after clicking Financial Reports: ${stillOpen2}`);
    if (!stillOpen2) {
      throw new Error('Sidebar automatically closed after clicking Financial Reports! It must remain open.');
    }

    // 5. Click "Customer Directory" in the sidebar
    console.log('▶ [5] Clicking "Customer Directory" option in sidebar...');
    const customersLink = page.locator('aside.hidden.md\\:flex a:has-text("Customer Directory")');
    await customersLink.click();
    await page.waitForURL('**/admin/customers', { timeout: 10000 });
    await page.waitForTimeout(500);

    const stillOpen3 = await isSidebarVisible();
    console.log(`   Sidebar remained OPEN after clicking Customer Directory: ${stillOpen3}`);
    if (!stillOpen3) {
      throw new Error('Sidebar automatically closed after clicking Customer Directory! It must remain open.');
    }

    // 6. Test MANUAL COLLAPSE via header button
    console.log('▶ [6] Manually clicking "Collapse" button in header...');
    const collapseBtn = page.locator('button[aria-label="Toggle sidebar"]').first();
    await collapseBtn.click();
    await page.waitForTimeout(600);

    const nowClosed = !(await isSidebarVisible());
    console.log(`   Sidebar closed MANUALLY: ${nowClosed}`);
    if (!nowClosed) {
      throw new Error('Sidebar failed to close when clicking Collapse button');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'sidebar_manual_closed.png') });

    // 7. Test MANUAL EXPAND via header button
    console.log('▶ [7] Manually clicking "Expand Sidebar" button in header...');
    await collapseBtn.click();
    await page.waitForTimeout(600);

    const nowReopened = await isSidebarVisible();
    console.log(`   Sidebar reopened MANUALLY: ${nowReopened}`);
    if (!nowReopened) {
      throw new Error('Sidebar failed to reopen when clicking Expand Sidebar button');
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'sidebar_manual_reopened.png') });

    await context.close();

    console.log('\n================================================================');
    console.log('🎉 SIDEBAR MANUAL CLOSE & PERSISTENT OPEN VERIFICATIONS PASSED 100%!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Error during sidebar verification:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
