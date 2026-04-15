import { ReactNode } from 'react';
import { useCan } from '../hooks/use-permission';

interface Props {
  module: string;
  action: 'view' | 'create' | 'update' | 'delete';
  children: ReactNode;
  fallback?: ReactNode;
}

export default function RequirePermission({ module, action, children, fallback = null }: Props) {
  return useCan(module, action) ? <>{children}</> : <>{fallback}</>;
}
