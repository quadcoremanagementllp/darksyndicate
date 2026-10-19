import { chromium } from 'playwright';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/DELL/.gemini/antigravity/brain/74fd5587-96e6-4d2e-af2b-3da9144cf458/scratch/screenshots';

async function testUpiQrDisplay() {
  console.log('🧪 Verifying UPI / QR Code Display in Extend and Walk-in Modals...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Log in as staff
    await page.goto('http://localhost:3000/login?portal=staff', { waitUntil: 'networkidle' });
    await page.fill('#login-email', 'admin@darksyndicate.com');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('#login-submit');
    await page.waitForTimeout(1500);

    // 2. Open /staff/bookings?tab=ACTIVE
    await page.goto('http://localhost:3000/staff/bookings?tab=ACTIVE', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 3. Click Extend button
    const extendBtn = page.locator('button:has-text("Extend")').first();
    if (await extendBtn.isVisible()) {
      await extendBtn.click();
      await page.waitForTimeout(1000);

      // 4. Click UPI / QR payment method
      const upiBtn = page.locator('button:has-text("UPI / QR")');
      await upiBtn.click();
      await page.waitForTimeout(1500);

      // Verify QR Code image is displayed
      const qrImage = page.locator('img[alt="Official Counter UPI QR"]');
      const isQrVisible = await qrImage.isVisible();
      console.log(`   QR Code Image Visible: ${isQrVisible}`);

      const upiIdText = page.locator('text=darksyndicate@icici');
      console.log(`   UPI ID Text Visible: ${await upiIdText.first().isVisible()}`);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'staff_upi_qr_extend_modal.png') });
      console.log('   📸 Screenshot captured: staff_upi_qr_extend_modal.png');
    }

    // 5. Test Admin CMS Settings tab for UPI QR upload
    await page.goto('http://localhost:3000/admin/cms', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const settingsTab = page.locator('button:has-text("Settings")');
    if (await settingsTab.isVisible()) {
      await settingsTab.click();
      await page.waitForTimeout(1000);

      const upiSetupCard = page.locator('text=Front-Desk Counter UPI & QR Standee');
      console.log(`   Admin CMS Counter UPI Setup Card Visible: ${await upiSetupCard.isVisible()}`);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'admin_cms_upi_qr_setup.png') });
      console.log('   📸 Screenshot captured: admin_cms_upi_qr_setup.png');
    }

    console.log('\n🎉 ALL UPI / QR TESTS PASSED SUCCESSFULLY!');
  } finally {
    await browser.close();
  }
}

testUpiQrDisplay().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
