import QRCode from 'qrcode';

/**
 * Generate a QR code as a base64 Data URL (PNG format).
 * High error correction (H) ensures readability even if partially obscured or on low-contrast screens.
 */
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      scale: 8,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (error) {
    console.error('Failed to generate QR data URL:', error);
    throw new Error('QR code generation failed');
  }
}

/**
 * Generate a QR code as an SVG string.
 */
export async function generateQrSvg(text: string): Promise<string> {
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  } catch (error) {
    console.error('Failed to generate QR SVG:', error);
    throw new Error('QR code generation failed');
  }
}
