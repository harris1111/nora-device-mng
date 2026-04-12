/**
 * One-time migration script: moves device images from DB bytes to S3 primary attachments.
 * Idempotent — skips devices that already have a primary attachment.
 *
 * Run: cd backend && npx tsx src/scripts/migrate-images-to-s3.ts
 */
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma-client.js';
import { uploadFile } from '../lib/s3-client.js';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

async function main() {
  console.log('Starting image migration to S3...');

  const devices = await prisma.device.findMany({
    where: { image: { not: null } },
    select: { id: true, storeId: true, name: true, image: true, imageMime: true },
  });

  console.log(`Found ${devices.length} devices with DB images.`);
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];

    // Check if already has a primary attachment (idempotent)
    const existing = await prisma.attachment.findFirst({
      where: { deviceId: device.id, isPrimary: true },
    });
    if (existing) {
      skipped++;
      console.log(`[${i + 1}/${devices.length}] SKIP ${device.storeId} — already has primary attachment`);
      continue;
    }

    try {
      const mime = device.imageMime || 'image/jpeg';
      const ext = MIME_TO_EXT[mime] || '.jpg';
      const attachmentId = uuidv4();
      const key = `devices/${device.id}/${attachmentId}${ext}`;

      const buffer = Buffer.from(device.image as Uint8Array);
      await uploadFile(key, buffer, mime);

      await prisma.attachment.create({
        data: {
          id: attachmentId,
          deviceId: device.id,
          fileKey: key,
          fileName: `${device.storeId}${ext}`,
          fileType: mime,
          fileSize: buffer.length,
          isPrimary: true,
        },
      });

      migrated++;
      console.log(`[${i + 1}/${devices.length}] OK ${device.storeId} -> ${key}`);
    } catch (err) {
      failed++;
      console.error(`[${i + 1}/${devices.length}] FAIL ${device.storeId}:`, err);
    }
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Migration fatal error:', err);
  process.exit(1);
});
