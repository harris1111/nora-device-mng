const REQUIRED: string[] = ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET'];

export function validateS3Config(): void {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length) {
    console.warn(`[WARN] Missing S3 env vars: ${missing.join(', ')} — file upload/download will be unavailable.`);
  }
}
