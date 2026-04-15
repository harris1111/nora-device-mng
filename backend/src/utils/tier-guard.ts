import { UserRole } from '../generated/prisma/enums.js';

export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === 'SADMIN') return false;
  if (actorRole === 'SADMIN') return true;
  if (actorRole === 'ADMIN' && targetRole === 'USER') return true;
  return false;
}

export function canEditPermissions(actorRole: UserRole, targetRole: UserRole): boolean {
  if (targetRole === 'SADMIN') return false;
  if (actorRole === 'SADMIN') return true;
  if (actorRole === 'ADMIN' && targetRole === 'USER') return true;
  return false;
}
