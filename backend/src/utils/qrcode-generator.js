import QRCode from 'qrcode';

// Generate QR code as PNG buffer — optimized for PT-D610BT 0.94" tape @ 180 dpi
export async function generateQrCode(url) {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 140,       // 0.78 in × 180 dpi ≈ 140px — slightly reduced size
    margin: 1,        // minimal quiet zone for max QR area
    errorCorrectionLevel: 'H', // high correction for small-label scanning
  });
}
