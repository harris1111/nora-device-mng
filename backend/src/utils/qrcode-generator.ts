import QRCode from 'qrcode';

const BASE_URL: string = process.env.BASE_URL || 'http://localhost:13000';

// Generate QR code as PNG buffer — encodes URL to public device page
export async function generateQrCode(deviceId: string): Promise<Buffer> {
  const url = `${BASE_URL}/public/device/${deviceId}`;
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 140,
    margin: 1,
    errorCorrectionLevel: 'H',
  });
}
