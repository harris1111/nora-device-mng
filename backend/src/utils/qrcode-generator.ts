import QRCode from 'qrcode';

// Generate QR code as PNG buffer — encodes URL to public device page.
// baseUrl is supplied by the caller (typically via getEffectiveBaseUrl()) so the
// encoded URL reflects the currently configured domain at generation time.
export async function generateQrCode(deviceId: string, baseUrl: string): Promise<Buffer> {
  const normalized = baseUrl.replace(/\/+$/, '');
  const url = `${normalized}/public/device/${deviceId}`;
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 140,
    margin: 1,
    errorCorrectionLevel: 'H',
  });
}
