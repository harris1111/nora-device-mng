import { useState, useEffect, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

export default function AppLayout({ children }: Props) {
  const location = useLocation();
  const path = location.pathname;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [path]);

  const navItems = [
    {
      label: 'Thiết bị',
      path: '/devices',
      icon: (
        <svg className="w-5 h-5 md:mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      label: 'Đơn vị',
      path: '/locations',
      icon: (
        <svg className="w-5 h-5 md:mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  const getPageTitle = () => {
    if (path.includes('/devices/new')) return 'Thêm Thiết bị';
    if (path.includes('/devices/') && path.includes('/edit')) return 'Sửa Thiết bị';
    if (path.includes('/devices/') && path !== '/devices') return 'Chi tiết Thiết bị';
    if (path.startsWith('/devices')) return 'Danh sách Thiết bị';
    if (path.startsWith('/locations')) return 'Quản lý Đơn vị';
    return '';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      
      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <span className="font-bold text-slate-800 tracking-tight text-lg">BWP<span className="text-indigo-600">Dev</span></span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 -mr-2 text-slate-600 hover:text-indigo-600 transition-colors focus:outline-none"
        >
          {isMobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </header>

      {/* Mobile Slide-out Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-800/40 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Desktop & Mobile Slide-out) */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 
        w-64 bg-white border-r border-slate-200 shadow-[4px_0_24px_rgba(0,0,0,0.02)]
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        flex flex-col
      `}>
        <Link to="/devices" className="p-6 flex-shrink-0 hidden md:flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">BWP<span className="text-indigo-600">Devices</span></h1>
        </Link>
        
        {/* Mobile Sidebar Header */}
        <div className="p-4 md:hidden flex justify-between items-center border-b border-slate-100">
          <span className="font-semibold text-slate-700">Menu</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">Quản lý</div>
          {navItems.map((item) => {
            const isActive = path.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center px-4 py-3 rounded-xl transition-all duration-200 font-medium group
                  ${isActive 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100/50' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-600'}
                `}
              >
                <div className={`
                  ${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'} 
                  transition-colors
                `}>
                  {item.icon}
                </div>
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        {/* User Profile placeholder at bottom */}
        <div className="p-4 border-t border-slate-100 m-4 rounded-xl bg-slate-50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700 truncate">Admin</p>
            <p className="text-xs text-slate-500 truncate">Quản trị viên</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Desktop Top Header */}
        <header className="hidden md:flex h-20 items-center justify-between px-8 bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{getPageTitle()}</h2>
          </div>
          <div className="flex items-center gap-4">
             <Link to="/devices/new" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 flex items-center gap-2">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
               </svg>
               Thêm mới
             </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 animate-fade-in relative z-10 pb-24 md:pb-8">
          <div className="w-full max-w-6xl mx-auto">
            {children}
          </div>
        </main>
        
      </div>
      
      {/* Retain Bottom Nav for very quick mobile actions (optional, but requested by standard mobile UX). I will adapt it into a floating FAB or keep the bottom nav sleek. */}
      {/* Mobile Bottom Navigation - Redesigned to be floating */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 z-20 pointer-events-none">
         <div className="bg-slate-800/90 backdrop-blur-lg rounded-2xl shadow-xl flex items-center justify-between p-2 pointer-events-auto border border-white/10 relative">
           
           {/* Item 1 */}
           <Link
             to={navItems[0].path}
             className={`flex-1 flex flex-col items-center p-2 rounded-xl transition-all ${
               path.startsWith(navItems[0].path) ? 'text-white' : 'text-slate-400 hover:text-slate-200'
             }`}
           >
             <div className={`mb-1 transition-transform duration-300 ${path.startsWith(navItems[0].path) ? 'scale-110' : ''}`}>
               {navItems[0].icon}
             </div>
             <span className="text-[10px] font-medium">{navItems[0].label}</span>
           </Link>

           {/* Floating FAB (Center) */}
           <div className="flex-shrink-0 w-16 flex justify-center">
             <Link 
               to="/devices/new"
               className="absolute -top-5 w-14 h-14 bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-500/40 border-4 border-slate-50 transition-transform active:scale-95"
             >
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
               </svg>
             </Link>
           </div>

           {/* Item 2 */}
           <Link
             to={navItems[1].path}
             className={`flex-1 flex flex-col items-center p-2 rounded-xl transition-all ${
               path.startsWith(navItems[1].path) ? 'text-white' : 'text-slate-400 hover:text-slate-200'
             }`}
           >
             <div className={`mb-1 transition-transform duration-300 ${path.startsWith(navItems[1].path) ? 'scale-110' : ''}`}>
               {navItems[1].icon}
             </div>
             <span className="text-[10px] font-medium">{navItems[1].label}</span>
           </Link>
           
         </div>
      </div>
    </div>
  );
}
