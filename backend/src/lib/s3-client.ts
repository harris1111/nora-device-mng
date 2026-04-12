import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

// Lazy-init: env vars are loaded from root .env AFTER ESM imports resolve,
// so we must read them at call time, not at module load time.
let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY!,
        secretAccessKey: process.env.S3_SECRET_KEY!,
      },
      forcePathStyle: true,
    });
  }
  return _s3;
}

function getBucket(): string {
  return process.env.S3_BUCKET || '';
}

export async function uploadFile(key: string, buffer: Buffer, contentType: string): Promise<string> {
  await getS3().send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return key;
}

export async function downloadFile(key: string): Promise<{ stream: Readable; contentType: string | undefined }> {
  const resp = await getS3().send(new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }));
  return { stream: resp.Body as Readable, contentType: resp.ContentType };
}

export async function deleteFile(key: string): Promise<void> {
  await getS3().send(new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }));
}

export async function deleteFiles(keys: string[]): Promise<void> {
  await Promise.all(keys.map(k => deleteFile(k)));
}
