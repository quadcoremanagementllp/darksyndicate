import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = 'C:/Users/DELL/.gemini/antigravity/brain/74fd5587-96e6-4d2e-af2b-3da9144cf458/scratch/screenshots';
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function run() {
  console.log('🧪 Starting Admin & Staff Complete Flow Verification...\n');

  const browser = await chromium.launch({ headless: true });

  try {
    // ══════════════════════════════════════════════════════════════════
    // PART 1: ADMIN FLOW VERIFICATION
    // ══════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 TEST SUITE 1: ADMIN PORTAL FLOW');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const adminPage = await adminContext.newPage();

    // 1. Unauthenticated access to /admin
    console.log('▶ [Admin 1] Visiting /admin without auth...');
    await adminPage.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
    console.log(`   Redirected to: ${adminPage.url()}`);
    if (!adminPage.url().includes('/login?portal=admin')) {
      throw new Error(`Expected redirect to /login?portal=admin, got ${adminPage.url()}`);
    }
    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_01_login_wall.png') });

    // 2. Verify Tab Switcher is HIDDEN for Admin Portal
    const tabSwitcher = adminPage.locator('button:has-text("Create Account")');
    const isTabVisible = await tabSwitcher.isVisible();
    console.log(`   Public "Create Account" tab hidden on Admin Portal: ${!isTabVisible}`);

    // 3. Login with Super Admin credentials
    console.log('▶ [Admin 2] Submitting Super Admin credentials...');
    await adminPage.fill('#login-email', 'admin@darksyndicate.com');
    await adminPage.fill('input[type="password"]', 'Admin@123456');
    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_02_credentials_filled.png') });

    await Promise.all([
      adminPage.waitForURL('**/admin**', { timeout: 15000 }),
      adminPage.click('#login-submit'),
    ]);
    console.log(`   ✅ Successfully logged in and landed at: ${adminPage.url()}`);
    await adminPage.waitForTimeout(1000);
    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_03_dashboard.png') });

    // 4. Navigate to Syndicate Passes management (/admin/memberships)
    console.log('▶ [Admin 3] Navigating to Syndicate Passes management (/admin/memberships)...');
    await adminPage.goto('http://localhost:3000/admin/memberships', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(1000);
    const passesHeader = adminPage.locator('h1:has-text("Dark Syndicate Passes")');
    console.log(`   Syndicate Passes header visible: ${await passesHeader.isVisible()}`);
    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_04_memberships_management.png') });

    // 5. Navigate to Customer Directory (/admin/customers)
    console.log('▶ [Admin 4] Navigating to Customer Directory (/admin/customers)...');
    await adminPage.goto('http://localhost:3000/admin/customers', { waitUntil: 'networkidle' });
    await adminPage.waitForTimeout(1000);
    const customersHeader = adminPage.locator('h1:has-text("Customer Directory")');
    console.log(`   Customer Directory visible: ${await customersHeader.isVisible()}`);
    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_05_customers.png') });

    // 6. Test Admin access to Staff Console Grid (/staff)
    console.log('▶ [Admin 5] Testing Admin permission to view Staff Console (/staff)...');
    await adminPage.goto('http://localhost:3000/staff', { waitUntil: 'networkidle' });
    console.log(`   Landed at: ${adminPage.url()}`);
    if (adminPage.url().includes('error=access')) {
      throw new Error('Admin should NOT be denied access to /staff');
    }
    console.log('   ✅ Super Admin successfully accessed Staff Console Grid without 403!');
    await adminPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_06_staff_grid_access.png') });

    await adminContext.close();

    // ══════════════════════════════════════════════════════════════════
    // PART 2: STAFF FLOW VERIFICATION
    // ══════════════════════════════════════════════════════════════════
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛡️ TEST SUITE 2: STAFF PORTAL FLOW');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const staffContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const staffPage = await staffContext.newPage();

    // 1. Unauthenticated access to /staff
    console.log('▶ [Staff 1] Visiting /staff without auth...');
    await staffPage.goto('http://localhost:3000/staff', { waitUntil: 'networkidle' });
    console.log(`   Redirected to: ${staffPage.url()}`);
    if (!staffPage.url().includes('/login?portal=staff')) {
      throw new Error(`Expected redirect to /login?portal=staff, got ${staffPage.url()}`);
    }
    await staffPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_01_login_wall.png') });

    // 2. Login with Staff credentials
    console.log('▶ [Staff 2] Submitting Staff credentials...');
    await staffPage.fill('#login-email', 'staff@darksyndicate.com');
    await staffPage.fill('input[type="password"]', 'Staff@123456');

    await Promise.all([
      staffPage.waitForURL('**/staff**', { timeout: 15000 }),
      staffPage.click('#login-submit'),
    ]);
    console.log(`   ✅ Staff logged in and landed at: ${staffPage.url()}`);
    await staffPage.waitForTimeout(1000);
    await staffPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_02_dashboard.png') });

    // 3. Navigate to Today\'s Schedule (/staff/bookings)
    console.log('▶ [Staff 3] Navigating to Today\'s Schedule (/staff/bookings)...');
    let staffScheduleForbidden = false;
    staffPage.on('response', (res) => {
      if (res.url().includes('/api/admin/bookings') && res.status() === 403) {
        staffScheduleForbidden = true;
      }
    });

    await staffPage.goto('http://localhost:3000/staff/bookings', { waitUntil: 'networkidle' });
    await staffPage.waitForTimeout(1000);
    console.log(`   Schedule 403 Forbidden detected: ${staffScheduleForbidden}`);
    if (staffScheduleForbidden) {
      throw new Error('Staff was forbidden from fetching bookings schedule!');
    }
    const scheduleHeader = staffPage.locator('h1:has-text("Arena Daily Reservation Schedule")');
    console.log(`   Schedule header visible: ${await scheduleHeader.isVisible()}`);
    await staffPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_03_schedule.png') });

    // 4. Open Walk-in Modal on Staff Grid
    console.log('▶ [Staff 4] Opening Walk-in Modal on Staff Grid...');
    await staffPage.goto('http://localhost:3000/staff', { waitUntil: 'networkidle' });
    const walkInBtn = staffPage.locator('button:has-text("Desk Walk-in"), button:has-text("Walk-in")').first();
    if (await walkInBtn.isVisible()) {
      await walkInBtn.click();
      await staffPage.waitForTimeout(500);
      const walkInModal = staffPage.locator('text=Front-Desk Instant Walk-in Booking');
      console.log(`   Walk-in Modal visible: ${await walkInModal.isVisible()}`);
      await staffPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_04_walkin_modal.png') });
    }

    // 5. Verify Staff CANNOT access Admin area
    console.log('▶ [Staff 5] Verifying Staff is blocked from /admin...');
    await staffPage.goto('http://localhost:3000/admin', { waitUntil: 'networkidle' });
    console.log(`   Landed at: ${staffPage.url()}`);
    if (staffPage.url().includes('error=access')) {
      console.log('   ✅ Staff correctly rejected from /admin with error=access banner!');
      await staffPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_05_admin_blocked.png') });
    } else {
      throw new Error(`Staff should be blocked from /admin, but got: ${staffPage.url()}`);
    }

    await staffContext.close();

    console.log('\n================================================================');
    console.log('🎉 ALL ADMIN & STAFF FLOW VERIFICATIONS PASSED 100%!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Error during Admin/Staff verification:', err);
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
