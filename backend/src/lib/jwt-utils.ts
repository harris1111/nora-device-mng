import jwt from 'jsonwebtoken';

function getSecret(): string {
  return process.env.JWT_SECRET!;
}
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  role: string;
}

export function signToken(payload: TokenPayload): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return jwt.sign(payload, getSecret(), { expiresIn: EXPIRES_IN } as any);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret()) as TokenPayload;
}
