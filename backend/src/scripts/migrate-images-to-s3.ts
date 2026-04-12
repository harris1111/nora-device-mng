/**
 * One-time migration script: moves device images from DB bytes to S3 primary attachments.
 * Idempotent — skips devices that already have a primary attachment.
 * Safe after schema cleanup — exits cleanly when legacy columns are gone.
 *
 * Run: cd backend && npx tsx src/scripts/migrate-images-to-s3.ts
 */
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '../generated/prisma/client.js';
import prisma from '../lib/prisma-client.js';
import { uploadFile, deleteFile } from '../lib/s3-client.js';

interface LegacyDeviceRow {
  id: string;
  store_id: string;
  name: string;
  image: Uint8Array | Buffer | null;
  image_mime: string | null;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const REQUIRED_S3_VARS = ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET'] as const;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: false });

function sniffMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  const gifHeader = buffer.subarray(0, 6).toString('ascii');
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
    return 'image/gif';
  }

  if (
    buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

function resolveMime(buffer: Buffer, imageMime: string | null): string | null {
  if (imageMime && MIME_TO_EXT[imageMime]) {
    return imageMime;
  }

  return sniffMime(buffer);
}

function ensureS3Config(): void {
  const missing = REQUIRED_S3_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required S3 env vars: ${missing.join(', ')}`);
  }
}

function toBuffer(value: Uint8Array | Buffer): Buffer {
  return Buffer.isBuffer(value) ? value : Buffer.from(value);
}

async function getLegacyColumnNames(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'devices'
      AND column_name IN ('image', 'image_mime')
  `;

  return new Set(rows.map((row) => row.column_name));
}

async function getLegacyDevices(hasImageMime: boolean): Promise<LegacyDeviceRow[]> {
  const query = hasImageMime
    ? `
      SELECT id, store_id, name, image, image_mime
      FROM devices
      WHERE image IS NOT NULL
      ORDER BY created_at ASC
    `
    : `
      SELECT id, store_id, name, image, NULL::text AS image_mime
      FROM devices
      WHERE image IS NOT NULL
      ORDER BY created_at ASC
    `;

  return prisma.$queryRawUnsafe<LegacyDeviceRow[]>(query);
}

async function main() {
  console.log('Starting image migration to S3...');
  ensureS3Config();

  const legacyColumns = await getLegacyColumnNames();
  if (!legacyColumns.has('image')) {
    console.log('Legacy image column does not exist. Nothing to migrate.');
    return;
  }

  const devices = await getLegacyDevices(legacyColumns.has('image_mime'));

  console.log(`Found ${devices.length} devices with DB images.`);
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    let uploadedKey: string | null = null;

    // Check if already has a primary attachment (idempotent)
    const existing = await prisma.attachment.findFirst({
      where: { deviceId: device.id, isPrimary: true },
    });
    if (existing) {
      skipped++;
      console.log(`[${i + 1}/${devices.length}] SKIP ${device.store_id} — already has primary attachment`);
      continue;
    }

    try {
      if (!device.image) {
        skipped++;
        console.log(`[${i + 1}/${devices.length}] SKIP ${device.store_id} — image payload missing`);
        continue;
      }

      const buffer = toBuffer(device.image);
      const mime = resolveMime(buffer, device.image_mime);
      if (!mime) {
        failed++;
        console.error(`[${i + 1}/${devices.length}] FAIL ${device.store_id}: unsupported or unknown legacy image format`);
        continue;
      }

      const ext = MIME_TO_EXT[mime] || '.jpg';
      const attachmentId = uuidv4();
      const key = `devices/${device.id}/${attachmentId}${ext}`;

      await uploadFile(key, buffer, mime);
      uploadedKey = key;

      const created = await prisma.$transaction(async (tx) => {
        const currentPrimary = await tx.attachment.findFirst({
          where: { deviceId: device.id, isPrimary: true },
          select: { id: true },
        });

        if (currentPrimary) {
          return false;
        }

        await tx.attachment.create({
          data: {
            id: attachmentId,
            deviceId: device.id,
            fileKey: key,
            fileName: `${device.store_id}${ext}`,
            fileType: mime,
            fileSize: buffer.length,
            isPrimary: true,
          },
        });

        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      if (!created) {
        skipped++;
        if (uploadedKey) {
          try { await deleteFile(uploadedKey); } catch (cleanupErr: unknown) { console.warn(`[${i + 1}/${devices.length}] cleanup warning ${device.store_id}:`, cleanupErr); }
        }
        console.log(`[${i + 1}/${devices.length}] SKIP ${device.store_id} — primary attachment created concurrently`);
        continue;
      }

      migrated++;
      console.log(`[${i + 1}/${devices.length}] OK ${device.store_id} -> ${key}`);
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2034') {
        console.error(`[${i + 1}/${devices.length}] FAIL ${device.store_id}: concurrent transaction conflict, safe to rerun`);
      } else {
        console.error(`[${i + 1}/${devices.length}] FAIL ${device.store_id}:`, message);
      }

      if (uploadedKey) {
        try { await deleteFile(uploadedKey); } catch (cleanupErr: unknown) { console.warn(`[${i + 1}/${devices.length}] cleanup warning ${device.store_id}:`, cleanupErr); }
      }
    }
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed.`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Migration fatal error:', err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
