import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET;

export async function uploadFile(key: string, buffer: Buffer, contentType: string): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return key;
}

export async function downloadFile(key: string): Promise<{ stream: Readable; contentType: string | undefined }> {
  const resp = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
  return { stream: resp.Body as Readable, contentType: resp.ContentType };
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

export async function deleteFiles(keys: string[]): Promise<void> {
  await Promise.all(keys.map(k => deleteFile(k)));
}
