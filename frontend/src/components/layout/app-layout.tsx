import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { useCan } from '../../hooks/use-permission';
import NotificationBell from '../notification/notification-bell';
import SiteFooter from './site-footer';

interface Props {
  children: ReactNode;
}

interface NavItem {
  label: string;
  shortLabel: string;
  path: string;
  visible: boolean;
  icon: ReactNode;
}

function ShellActionButtons({ canCreateDevices, compact = false }: { canCreateDevices: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
      {canCreateDevices && (
        <Link
          to="/devices/new"
          className={compact
            ? 'inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700'
            : 'inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-200 transition-colors hover:bg-indigo-700'}
          title="Thêm thiết bị mới"
          aria-label="Thêm thiết bị mới"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {!compact && <span>Thêm mới</span>}
        </Link>
      )}
    </div>
  );
}

function getPageMeta(path: string): { title: string; eyebrow: string } {
  if (path.includes('/devices/new')) return { title: 'Thêm thiết bị', eyebrow: 'Thiết bị' };
  if (path.includes('/devices/') && path.includes('/edit')) return { title: 'Sửa thiết bị', eyebrow: 'Thiết bị' };
  if (path.includes('/devices/') && path !== '/devices') return { title: 'Chi tiết thiết bị', eyebrow: 'Thiết bị' };
  if (path.startsWith('/devices')) return { title: 'Danh sách thiết bị', eyebrow: 'Quản lý thiết bị' };
  if (path.startsWith('/locations')) return { title: 'Quản lý đơn vị', eyebrow: 'Danh mục' };
  if (path.startsWith('/areas')) return { title: 'Quản lý khu vực', eyebrow: 'Danh mục' };
  if (path.startsWith('/users')) return { title: 'Quản lý người dùng', eyebrow: 'Quản trị' };
  if (path.startsWith('/permissions')) return { title: 'Quản lý phân quyền', eyebrow: 'Quản trị' };
  if (path.startsWith('/audit-logs')) return { title: 'Nhật ký hệ thống', eyebrow: 'Quản trị' };
  if (path.startsWith('/settings')) return { title: 'Cài đặt hệ thống', eyebrow: 'Quản trị' };
  if (path.startsWith('/export')) return { title: 'Xuất Excel', eyebrow: 'Tiện ích' };
  return { title: 'Nora Device Manager', eyebrow: 'BWP Devices' };
}

export default function AppLayout({ children }: Props) {
  const location = useLocation();
  const path = location.pathname;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const canViewDevices = useCan('devices', 'view');
  const canViewLocations = useCan('locations', 'view');
  const canViewAreas = useCan('areas', 'view');
  const canViewUsers = useCan('users', 'view');
  const canViewPermissions = useCan('permissions', 'view');
  const canCreateDevices = useCan('devices', 'create');
  const canExportDevices = useCan('devices', 'export');
  const pageMeta = getPageMeta(path);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [path]);

  const allNavItems: NavItem[] = [
    {
      label: 'Thiết bị',
      shortLabel: 'Thiết bị',
      path: '/devices',
      visible: canViewDevices,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      label: 'Xuất Excel',
      shortLabel: 'Xuất',
      path: '/export',
      visible: canExportDevices,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      label: 'Đơn vị',
      shortLabel: 'Đơn vị',
      path: '/locations',
      visible: canViewLocations,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
      label: 'Khu vực',
      shortLabel: 'Khu vực',
      path: '/areas',
      visible: canViewAreas,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      )
    },
    {
      label: 'Người dùng',
      shortLabel: 'Users',
      path: '/users',
      visible: canViewUsers,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    },
    {
      label: 'Phân quyền',
      shortLabel: 'Quyền',
      path: '/permissions',
      visible: canViewPermissions,
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      label: 'Nhật ký',
      shortLabel: 'Nhật ký',
      path: '/audit-logs',
      visible: user?.role === 'SADMIN',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    },
    {
      label: 'Cài đặt',
      shortLabel: 'Cài đặt',
      path: '/settings',
      visible: user?.role === 'SADMIN',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  const navItems = allNavItems.filter((item) => item.visible);
  const userInitials = user ? user.username.slice(0, 2).toUpperCase() : 'AD';
  const roleLabels: Record<string, string> = { SADMIN: 'Super Admin', ADMIN: 'Quản trị viên', USER: 'Người dùng' };
  const roleLabel = user ? roleLabels[user.role] || user.role : '';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
      <div className="flex-1 lg:flex">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-600"
                aria-label={isMobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
              >
                {isMobileMenuOpen ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{pageMeta.eyebrow}</p>
                <h1 className="truncate text-base font-bold text-slate-800">{pageMeta.title}</h1>
              </div>
            </div>
            <ShellActionButtons canCreateDevices={canCreateDevices} compact />
          </div>
        </header>

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm animate-fade-in lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <aside
          className={[
            'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[88vw] flex-col border-r border-slate-200 bg-white shadow-[4px_0_24px_rgba(0,0,0,0.08)] transform transition-transform duration-300 ease-in-out',
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
            'lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:max-w-none lg:translate-x-0 lg:shadow-[4px_0_24px_rgba(0,0,0,0.02)]'
          ].join(' ')}
        >
          <div className="border-b border-slate-100 px-5 py-5">
            <Link to="/devices" className="flex items-center gap-3 transition-opacity hover:opacity-80">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 shadow-md shadow-indigo-200">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">BWP System</p>
                <h1 className="text-lg font-bold tracking-tight text-slate-800">BWP<span className="text-indigo-600">Devices</span></h1>
              </div>
            </Link>
          </div>

          <div className="border-b border-slate-100 px-5 py-4 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-700">Điều hướng</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Đóng menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-5">
            <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Quản lý</div>
            <div className="space-y-1.5">
              {navItems.map((item) => {
                const isActive = path.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={[
                      'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100/70 ring-1 ring-indigo-100'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'flex h-10 w-10 items-center justify-center rounded-xl border transition-colors',
                        isActive
                          ? 'border-indigo-100 bg-white text-indigo-600'
                          : 'border-transparent bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-indigo-500'
                      ].join(' ')}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0 truncate">{item.label}</div>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="m-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                {userInitials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-700">{user?.username || 'Admin'}</p>
                <p className="truncate text-xs text-slate-500">{roleLabel}</p>
              </div>
              <button
                onClick={logout}
                title="Đăng xuất"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </aside>

        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-20 hidden h-20 items-center justify-between border-b border-slate-200/60 bg-white/80 px-8 backdrop-blur-md lg:flex">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{pageMeta.eyebrow}</p>
              <h2 className="text-xl font-bold text-slate-800">{pageMeta.title}</h2>
            </div>
            <ShellActionButtons canCreateDevices={canCreateDevices} />
          </header>

          <main className="relative z-10 flex-1 overflow-y-auto px-4 pb-28 pt-4 animate-fade-in sm:px-5 sm:pt-5 lg:px-8 lg:pb-8 lg:pt-8">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-3 lg:hidden">
          <div className="pointer-events-auto overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/92 shadow-xl backdrop-blur-xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max items-stretch gap-1 p-2">
              {navItems.map((item) => {
                const isActive = path.startsWith(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={[
                      'min-w-[76px] flex-1 rounded-xl px-3 py-2 text-center transition-all',
                      isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'
                    ].join(' ')}
                  >
                    <div className="mx-auto mb-1 flex h-5 w-5 items-center justify-center">{item.icon}</div>
                    <span className="block text-[10px] font-medium leading-4">{item.shortLabel}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
