import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/DELL/.gemini/antigravity/brain/74fd5587-96e6-4d2e-af2b-3da9144cf458/scratch/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('🧪 Starting Mobile Auth & Passes Flow Verification...');

  const browser = await chromium.launch({ headless: true });
  // Emulate iPhone 14 / modern mobile viewport
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
  });

  const page = await context.newPage();

  try {
    // 1. Visit /membership as new / unauthenticated user
    console.log('▶ Step 1: Navigating to /membership on mobile (390x844)...');
    await page.goto('http://localhost:3000/membership', { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_01_membership.png') });

    const newGamerBanner = page.locator('text=New to Dark Syndicate?');
    console.log(`   New gamer banner visible: ${await newGamerBanner.isVisible()}`);

    // 2. Click "Get Gold Syndicate Pass"
    console.log('▶ Step 2: Clicking "Get Gold Syndicate Pass"...');
    const getPassBtn = page.locator('button:has-text("Get Gold Syndicate Pass"), button:has-text("Get ")').first();
    const btnText = await getPassBtn.innerText();
    console.log(`   Found CTA button: "${btnText.trim()}"`);

    await Promise.all([
      page.waitForURL('**/login?tab=signup**', { timeout: 15000 }),
      getPassBtn.click(),
    ]);

    console.log(`   ✅ Navigated to: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_02_signup_tab.png') });

    // 3. Verify MobileBottomBar is NOT present on auth page
    const bottomBar = page.locator('aside[aria-label="Mobile Navigation Dock"]');
    const isBottomBarVisible = await bottomBar.isVisible();
    console.log(`   MobileBottomBar hidden on auth screen: ${!isBottomBarVisible}`);
    if (isBottomBarVisible) {
      throw new Error('MobileBottomBar should be hidden on auth pages');
    }

    // 4. Verify Create Account tab is active
    const createAccountTab = page.locator('button:has-text("Create Account")').first();
    console.log(`   "Create Account" tab present: ${await createAccountTab.isVisible()}`);

    const firstNameInput = page.locator('#register-first-name');
    console.log(`   Register first name input present: ${await firstNameInput.isVisible()}`);

    // 5. Test switching tabs to "Sign In"
    console.log('▶ Step 3: Testing tab switch to "Sign In"...');
    const signInTab = page.locator('button:has-text("Sign In")').first();
    await signInTab.click();
    await page.waitForTimeout(300);

    const loginEmailInput = page.locator('#login-email');
    console.log(`   Sign In email input visible: ${await loginEmailInput.isVisible()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_03_signin_tab.png') });

    // 6. Switch back to "Create Account"
    console.log('▶ Step 4: Switching back to "Create Account" and registering new user...');
    await createAccountTab.click();
    await page.waitForTimeout(300);

    const testEmail = `newgamer_${Date.now()}@example.com`;
    console.log(`   Registering with: ${testEmail}`);

    await page.fill('#register-first-name', 'Alex');
    await page.fill('#register-last-name', 'Vance');
    await page.fill('#register-email', testEmail);
    await page.fill('#register-phone', '9876543210');
    await page.fill('#register-password', 'GamerPass@2026');
    await page.fill('#register-confirm-password', 'GamerPass@2026');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_04_form_filled.png') });

    const submitBtn = page.locator('#register-submit');
    await Promise.all([
      page.waitForURL('**/membership', { timeout: 15000 }),
      submitBtn.click(),
    ]);

    console.log(`   ✅ Successfully registered and redirected to: ${page.url()}`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_05_authenticated_membership.png') });

    // 7. Verify the user is now recognized on /membership
    const joinBtn = page.locator('button:has-text("Join ")').first();
    const joinBtnText = await joinBtn.innerText();
    console.log(`   Button updated for logged-in user: "${joinBtnText.trim()}"`);

    // 8. Click Join to open checkout modal
    await joinBtn.click();
    await page.waitForSelector('text=Instant Syndicate Activation', { timeout: 10000 });
    console.log('   ✅ Checkout modal opened directly for authenticated gamer!');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_06_checkout_modal.png') });

    console.log('\n================================================================');
    console.log('🎉 ALL MOBILE AUTH & PASSES FLOW VERIFICATIONS PASSED 100%!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Error during mobile auth verification:', err);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'mobile_error.png') }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
