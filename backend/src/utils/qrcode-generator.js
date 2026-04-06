import QRCode from 'qrcode';

// Generate QR code as PNG buffer
export async function generateQrCode(url) {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 300,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
}
