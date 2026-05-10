import prisma from './prisma-client.js';

const BASE_URL_KEY = 'base_url';
const FALLBACK_BASE_URL = 'http://localhost:13000';

/**
 * Resolve the base URL used to build public-facing links (e.g. encoded in QR codes).
 * Priority:
 *   1. `Setting` row with key `base_url` (set via SADMIN settings UI)
 *   2. `process.env.BASE_URL`
 *   3. `http://localhost:13000`
 *
 * The returned value never has a trailing slash.
 */
export async function getEffectiveBaseUrl(): Promise<string> {
  let value: string | undefined;
  try {
    const setting = await prisma.setting.findUnique({ where: { key: BASE_URL_KEY } });
    if (setting?.value) value = setting.value;
  } catch (err) {
    // If the settings table doesn't exist yet (pre-migration), fall through to env/default.
    console.warn('getEffectiveBaseUrl: failed to read Setting row, falling back to env', (err as Error).message);
  }
  const raw = value || process.env.BASE_URL || FALLBACK_BASE_URL;
  return raw.replace(/\/+$/, '');
}

/**
 * Persist a new base URL value. Caller is responsible for validation.
 */
export async function setBaseUrl(value: string): Promise<string> {
  const normalized = value.trim().replace(/\/+$/, '');
  await prisma.setting.upsert({
    where: { key: BASE_URL_KEY },
    create: { key: BASE_URL_KEY, value: normalized },
    update: { value: normalized },
  });
  return normalized;
}
