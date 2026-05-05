import { Outlet } from 'react-router-dom';
import { useCan } from '../../hooks/use-permission';
import { useAuth } from '../../context/auth-context';
import ForbiddenPage from '../../pages/forbidden-page';

type Action = 'view' | 'create' | 'update' | 'delete' | 'export';

interface Props {
  module?: string;
  action?: Action;
  requiredRole?: 'SADMIN' | 'ADMIN' | 'USER';
}

export default function PermissionRoute({ module, action, requiredRole }: Props) {
  const { user, isLoading } = useAuth();
  const hasPermission = useCan(module ?? '', (action ?? 'view') as Action);

  if (isLoading) return null;

  if (requiredRole) {
    if (user?.role !== requiredRole) return <ForbiddenPage />;
    return <Outlet />;
  }

  if (!module) return <Outlet />;
  if (!hasPermission) return <ForbiddenPage />;
  return <Outlet />;
}
