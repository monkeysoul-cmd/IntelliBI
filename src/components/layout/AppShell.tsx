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
  { to: '/analyst', label: 'AI Analyst', icon: Bot },
  { to: '/dashboards', label: 'Dashboards', icon: BarChart3 },
  { to: '/data-sources', label: 'Data sources', icon: Database },
  { to: '/history', label: 'Query history', icon: History },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function BrandMark() {
  return (
    <div className="w-7 h-7 rounded-lg bg-[#171717] dark:bg-[#ededed] text-white dark:text-[#141415] flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <rect x="2" y="7" width="2.5" height="5" rx="0.75" fill="currentColor" />
        <rect x="5.75" y="4" width="2.5" height="8" rx="0.75" fill="currentColor" />
        <rect x="9.5" y="2" width="2.5" height="10" rx="0.75" fill="#2563eb" />
      </svg>
    </div>
  );
}

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
        if (e.key === 'Escape' && mobileOpen) {
          setMobileOpen(false);
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
      <div className="flex flex-col h-full bg-white dark:bg-[#0f0f10] select-none">
        {/* Brand header */}
            <div className="h-14 px-4 flex items-center justify-between border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] shrink-0">
              <NavLink to="/" className="flex items-center gap-2.5 text-[#171717] dark:text-[#ededed]">
                <BrandMark />
                <span className="text-base font-medium tracking-tight text-[#171717] dark:text-[#ededed]">
                  IntelliBI
                </span>
              </NavLink>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="lg:hidden p-1.5 rounded-md text-[#737373] hover:text-[#171717] hover:bg-[#f4f4f5] dark:text-[#85858b] dark:hover:text-[#ededed] dark:hover:bg-[#232325] transition-colors duration-150 cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Navigation links */}
                <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Main navigation">
                  <div className="px-2.5 mt-2 mb-2 text-xs font-normal text-[#737373] dark:text-[#85858b]">
                    Workspace
                  </div>
                              <div className="space-y-1">
                                {NAV_ITEMS.map((item) => {
                                  const Icon = item.icon;
                                  return (
                                    <NavLink
                                      key={item.to}
                                      to={item.to}
                                      end={item.to === '/'}
                                      className={({ isActive }) =>
                                        cn(
                                          'flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer',
                                          isActive
                                            ? 'bg-[#f4f4f5] text-[#171717] font-medium dark:bg-[#232325] dark:text-[#ededed] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                            : 'text-[#525252] hover:text-[#171717] hover:bg-[#f4f4f5]/60 dark:text-[#a1a1a6] dark:hover:text-[#ededed] dark:hover:bg-[#232325]/60 font-normal'
                                        )
                                      }
                                    >
                                      {({ isActive }) => (
                                        <>
                                          <span className="w-4 h-4 flex items-center justify-center shrink-0">
                                            <Icon
                                              className={cn(
                                                'w-4 h-4',
                                                isActive
                                                  ? 'text-[#171717] dark:text-[#ededed]'
                                                  : 'text-[#737373] dark:text-[#85858b]'
                                              )}
                                              strokeWidth={1.5}
                                            />
                                          </span>
                                          <span className="truncate">{item.label}</span>
                            </>
                )}
                          </NavLink>
                        );
          })}
                      </div>
      </nav>

                {/* User Profile Footer */}
                    <div className="p-3 border-t border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] shrink-0">
                      <div className="flex items-center justify-between gap-2 px-1 py-1">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-[#f4f4f5] dark:bg-[#232325] text-[#171717] dark:text-[#ededed] text-xs font-medium flex items-center justify-center shrink-0 border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
                              {initials}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-[#171717] dark:text-[#ededed] truncate">
                                  {user?.name || 'Analyst'}
                                </p>
                                  <p className="text-[11px] text-[#737373] dark:text-[#85858b] truncate font-mono">
                                    {user?.email || 'authenticated'}
                                  </p>
                                </div>
                            </div>
                            <button
                              type="button"
                              onClick={logout}
                              title="Sign out"
                              aria-label="Sign out of IntelliBI"
                              className="p-2 rounded-md text-[#737373] hover:text-[#171717] hover:bg-[#f4f4f5] dark:text-[#85858b] dark:hover:text-[#ededed] dark:hover:bg-[#232325] transition-colors duration-150 cursor-pointer shrink-0"
                            >
                              <LogOut className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      </div>
                      );

                      return (
                        <div className="min-h-screen flex bg-[#fafafa] dark:bg-[#141415] text-[#171717] dark:text-[#ededed]">
                          {/* Desktop Sidebar */}
                            <aside className="hidden lg:block w-60 shrink-0 border-r border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] sticky top-0 h-screen z-20">
                              {renderSidebarContent()}
                            </aside>

                            {/* Mobile Drawer */}
                            {mobileOpen && (
                              <div className="fixed inset-0 z-50 lg:hidden flex">
                                <div
                                  className="fixed inset-0 bg-black/45 transition-opacity duration-150"
                                  onClick={() => setMobileOpen(false)}
                                />
                                  <aside className="relative w-64 max-w-[80vw] border-r border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] h-full z-10 shadow-lg">
                                    {renderSidebarContent()}
                                  </aside>
                              </div>
                            )}

                            {/* Main Column */}
                            <div className="flex-1 flex flex-col min-w-0">
                              {/* Top Header Bar */}
                                  <header className="h-14 sticky top-0 z-30 bg-[#fafafa]/95 dark:bg-[#141415]/95 backdrop-blur-sm border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] px-6 lg:px-8 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 flex-1 min-w-0 max-w-md">
                                      <button
                                        type="button"
                                        onClick={() => setMobileOpen(true)}
                                        aria-label="Open navigation menu"
                                        className="lg:hidden p-1.5 rounded-lg text-[#525252] dark:text-[#a1a1a6] hover:bg-[#f4f4f5] dark:hover:bg-[#232325] transition-colors duration-150 cursor-pointer"
                                      >
                                        <Menu className="w-4 h-4" strokeWidth={1.5} />
                                      </button>

                                      <form onSubmit={handleQuickSearchSubmit} className="relative flex-1 min-w-0">
                                        <Search
                                          className="w-4 h-4 text-[#737373] dark:text-[#85858b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                          strokeWidth={1.5}
                                        />
                                        <input
                                          ref={searchInputRef}
                                          type="text"
                                          value={quickAsk}
                                          onChange={(e) => setQuickAsk(e.target.value)}
                                          placeholder="Ask a question"
                                          aria-label="Quick natural language analytics query"
                                          className="w-full h-9 pl-9 pr-12 text-xs rounded-lg bg-white dark:bg-[#19191b] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] text-[#171717] dark:text-[#ededed] placeholder:text-[#737373] dark:placeholder:text-[#85858b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 dark:focus:ring-[#3b82f6]/40 transition-colors duration-150"
                                        />
                                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center">
                                            <Keycap>⌘K</Keycap>
                                          </div>
                                      </form>
                                    </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <NavLink
                                          to="/data-sources"
                                          className="hidden sm:inline-flex items-center gap-2 h-8 px-3 rounded-lg text-xs font-mono border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] bg-white dark:bg-[#19191b] text-[#525252] dark:text-[#a1a1a6] hover:text-[#171717] dark:hover:text-[#ededed] transition-colors duration-150"
                                        >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  dbStatus?.connected ? 'bg-[#16a34a] dark:bg-[#4cc38a]' : 'bg-[#d97706]'
                )}
              />
                                            <span>PostgreSQL 16</span>
                                            <span className="text-[#737373] dark:text-[#85858b]" aria-hidden="true">
                                              ·
                                            </span>
                                              <span
                                                className={
                                                  dbStatus?.connected
                                                    ? 'text-[#16a34a] dark:text-[#4cc38a]'
                                                    : 'text-[#737373] dark:text-[#85858b]'
                                                }
                                              >
                                                {dbStatus?.connected ? 'Live' : 'Connecting'}
                                              </span>
                                            </NavLink>

                                            <button
                                              type="button"
                                              onClick={toggleTheme}
                                              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] bg-white dark:bg-[#19191b] text-[#525252] dark:text-[#a1a1a6] hover:text-[#171717] dark:hover:text-[#ededed] hover:bg-[#f4f4f5] dark:hover:bg-[#232325] transition-colors duration-150 cursor-pointer shrink-0"
                                            >
                                              {theme === 'dark' ? (
                                                <Sun className="w-4 h-4" strokeWidth={1.5} />
                                              ) : (
                                                <Moon className="w-4 h-4" strokeWidth={1.5} />
                                              )}
                                            </button>
                                          </div>
                                        </header>

                                        {/* Page Content Viewport */}
                                        <main className="flex-1 p-6 lg:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
                                      </div>
                                    </div>
                                    );
}
