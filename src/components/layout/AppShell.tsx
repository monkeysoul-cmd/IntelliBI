import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bot,
  Database,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { databaseApi } from '../../services/api';
import type { DatabaseStatusInfo } from '../../types/api';
import { Keycap } from '../ui/Primitives';
import { cn } from '../../utils/cn';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/analyst', label: 'AI Analyst', icon: Bot, badge: 'Pro' },
  { to: '/dashboards', label: 'Dashboards', icon: BarChart3 },
  { to: '/data-sources', label: 'Data Sources', icon: Database },
  { to: '/history', label: 'Query History', icon: History },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickAsk, setQuickAsk] = useState('');
  const [dbStatus, setDbStatus] = useState<DatabaseStatusInfo | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'Escape') {
        if (mobileOpen) setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    let active = true;
    databaseApi
      .getStatus()
      .then((res) => {
        if (active) setDbStatus(res);
      })
      .catch(() => {
        if (active) setDbStatus(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleQuickSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = quickAsk.trim();
    if (!q) return;
    setQuickAsk('');
    navigate(`/analyst?q=${encodeURIComponent(q)}`);
  };

  const initials = (user?.name || 'IB')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-[#0D1017] select-none">
      {/* Brand header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] shrink-0">
        <NavLink
          to="/"
          className="flex items-center gap-2.5 text-slate-900 dark:text-white group"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-xs shadow-blue-500/20 group-hover:scale-105 transition-transform duration-150">
            IB
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold tracking-tight font-display text-slate-900 dark:text-white">
              IntelliBI
            </span>
            <span className="text-[10px] font-mono px-1 py-0.2 rounded text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400 font-semibold border border-blue-200/60 dark:border-blue-500/20">
              v2.4
            </span>
          </div>
        </NavLink>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-2.5 py-3.5 space-y-0.5 overflow-y-auto" aria-label="Main navigation">
        <div className="px-2 pb-1.5 text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-500 uppercase">
          Workspace
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-all duration-120 group cursor-pointer',
                  isActive
                    ? 'bg-slate-900/[0.05] text-slate-950 font-semibold dark:bg-white/[0.08] dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-white/[0.04]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={cn(
                        'w-4 h-4 shrink-0 transition-colors',
                        isActive
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 font-medium">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile Footer */}
      <div className="p-3 border-t border-slate-200/80 dark:border-white/[0.07] shrink-0 bg-slate-50/50 dark:bg-white/[0.01]">
        <div className="flex items-center justify-between gap-2 px-1.5 py-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-slate-900 dark:bg-white/10 text-white dark:text-slate-200 text-xs font-semibold flex items-center justify-center shrink-0 border border-slate-700/50 dark:border-white/10">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-900 dark:text-slate-200 truncate">
                {user?.name || 'Analyst'}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">
                {user?.email || 'authenticated'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out of IntelliBI"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#090A0F] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-56 shrink-0 border-r border-slate-200/80 dark:border-white/[0.07] sticky top-0 h-screen z-20">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-60 max-w-[80vw] border-r border-slate-200 dark:border-white/[0.08] h-full z-10 shadow-xl">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-14 sticky top-0 z-30 bg-white/80 dark:bg-[#090A0F]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-white/[0.07] px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0 max-w-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <form onSubmit={handleQuickSearchSubmit} className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={quickAsk}
                onChange={(e) => setQuickAsk(e.target.value)}
                placeholder="Ask a question (e.g. Top 5 products by revenue)..."
                aria-label="Quick natural language analytics query"
                className="w-full h-8.5 pl-8.5 pr-14 text-xs rounded-lg bg-slate-100/70 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center gap-0.5">
                <Keycap>⌘K</Keycap>
              </div>
            </form>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Live Database Status Beacon */}
            <NavLink
              to="/data-sources"
              className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-mono border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
            >
              <span className="relative flex h-2 w-2">
                {dbStatus?.connected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={cn(
                    'relative inline-flex rounded-full h-2 w-2',
                    dbStatus?.connected ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                />
              </span>
              <span className="text-[11px] font-medium">PostgreSQL 16</span>
              <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                ·
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {dbStatus?.connected ? 'Live' : 'Connecting'}
              </span>
            </NavLink>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
