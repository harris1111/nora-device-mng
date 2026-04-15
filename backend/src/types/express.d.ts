import { UserRole } from '../generated/prisma/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: UserRole;
      };
    }
  }
}
export {};
