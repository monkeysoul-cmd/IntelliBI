import React, { useEffect, useState } from 'react';
import { Check, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { databaseApi } from '../services/api';
import type { DatabaseStatusInfo } from '../types/api';
import { Button, Surface } from '../components/ui/Primitives';

export function SettingsPage() {
  const { user, settings, updateSettings, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [maxRows, setMaxRows] = useState(settings.maxRows);
  const [queryTimeoutMs, setQueryTimeoutMs] = useState(settings.queryTimeoutMs);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DatabaseStatusInfo | null>(null);

  useEffect(() => {
    setMaxRows(settings.maxRows);
    setQueryTimeoutMs(settings.queryTimeoutMs);
  }, [settings]);

  useEffect(() => {
    databaseApi.getStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedOk(false);
    setSaving(true);
    try {
      const sanitizedRows = Math.min(Math.max(Number(maxRows) || 250, 10), 1000);
      const sanitizedTimeout = Math.min(Math.max(Number(queryTimeoutMs) || 5000, 1000), 30000);
      setMaxRows(sanitizedRows);
      setQueryTimeoutMs(sanitizedTimeout);
      await updateSettings({ maxRows: sanitizedRows, queryTimeoutMs: sanitizedTimeout });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch {
      setError('Failed to save query execution guardrails.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Page Header */}
          <div className="pb-4 border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
            <h1 className="text-2xl sm:text-3xl font-medium text-[#171717] dark:text-[#ededed]">
              Settings
            </h1>
              <p className="text-sm text-[#737373] dark:text-[#85858b] mt-1">
                SQL execution guardrails, appearance, and account session
              </p>
          </div>

          {/* Query Execution Guardrails */}
            <Surface className="p-6 space-y-4">
              <div>
                  <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                    SQL execution guardrails
                  </h2>
                    <p className="text-xs text-[#737373] dark:text-[#85858b] mt-1">
                      Enforced by SQL AST validation and PostgreSQL read-only transactions
                    </p>
                  </div>

                  <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label
                              htmlFor="setting-max-rows"
                              className="block text-xs font-medium text-[#525252] dark:text-[#a1a1a6]"
                            >
                              Max result rows (10–1,000)
                            </label>
                            <input
                              id="setting-max-rows"
                              type="number"
                              min={10}
                              max={1000}
                              value={maxRows}
                              onChange={(e) => setMaxRows(Number(e.target.value))}
                              className="w-full h-9 px-3 text-xs font-mono tabular-nums rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-[#171717]/[0.1] dark:border-[#ededed]/[0.1] text-[#171717] dark:text-[#ededed] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 transition-colors duration-150"
                            />
                          </div>

                            <div className="space-y-1.5">
                              <label
                                htmlFor="setting-timeout"
                                className="block text-xs font-medium text-[#525252] dark:text-[#a1a1a6]"
                              >
                                Statement timeout ms (1,000–30,000)
                              </label>
                              <input
                                id="setting-timeout"
                                type="number"
                                min={1000}
                                max={30000}
                                step={500}
                                value={queryTimeoutMs}
                                onChange={(e) => setQueryTimeoutMs(Number(e.target.value))}
                                className="w-full h-9 px-3 text-xs font-mono tabular-nums rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-[#171717]/[0.1] dark:border-[#ededed]/[0.1] text-[#171717] dark:text-[#ededed] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 transition-colors duration-150"
                              />
                            </div>
                          </div>

                          {error && (
                              <p role="alert" className="text-xs text-[#dc2626] dark:text-[#e5484d]">
                                {error}
                              </p>
          )}

                              <div className="flex items-center gap-3 pt-1">
                                <Button type="submit" variant="primary" size="xs" disabled={saving}>
                                  {saving ? 'Saving...' : 'Save guardrails'}
                                </Button>
                                {savedOk && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#16a34a] dark:text-[#4cc38a]">
                                      <Check className="w-4 h-4" strokeWidth={1.5} />
                                      <span>Saved</span>
                                    </span>
            )}
                                  </div>
        </form>
                            </Surface>

      {/* Interface Theme Appearance */}
                            <Surface className="p-6 flex flex-wrap items-center justify-between gap-4">
                              <div>
                                  <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                                    Appearance
                                  </h2>
                                    <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5">
                                      Light and dark workspace themes
                                    </p>
                                  </div>

                                  <div
                                    className="inline-flex items-center p-1 rounded-lg bg-[#f4f4f5] dark:bg-[#232325] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]"
                                    role="tablist"
                                    aria-label="Color theme preference"
                                  >
                                    <button
                                      type="button"
                                      role="tab"
                                      aria-selected={theme === 'light'}
                                      onClick={() => setTheme('light')}
                                      className={`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md transition-colors duration-150 cursor-pointer ${
                                        theme === 'light'
                                          ? 'bg-white text-[#171717] shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                                          : 'text-[#737373] dark:text-[#85858b] hover:text-[#171717] dark:hover:text-[#ededed]'
                                      }`}
                                    >
                                      <Sun className="w-4 h-4" strokeWidth={1.5} />
                                      <span>Light</span>
                                    </button>
          <button
            type="button"
            role="tab"
            aria-selected={theme === 'dark'}
            onClick={() => setTheme('dark')}
                                      className = {`inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md transition-colors duration-150 cursor-pointer ${theme === 'dark'
                                            ? 'bg-[#19191b] text-[#ededed]'
                                            : 'text-[#737373] dark:text-[#85858b] hover:text-[#171717] dark:hover:text-[#ededed]'
                                        }`}
          >
                                    <Moon className="w-4 h-4" strokeWidth={1.5} />
                                    <span>Dark</span>
                                  </button>
                              </div>
                            </Surface>

                                {/* Engine Configuration */}
                                <Surface className="p-6 space-y-3">
                                  <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                                    Runtime topology
                                  </h2>
                                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
                                    <div>
                                        <dt className="text-[#737373] dark:text-[#85858b]">LLM model</dt>
                                        <dd className="font-mono font-medium text-[#171717] dark:text-[#ededed] mt-1">
                                          {status?.llmProvider || 'Gemini'} ({status?.llmModel || 'gemini-4-hydrogen'})
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-[#737373] dark:text-[#85858b]">Database engine</dt>
                                        <dd className="font-mono font-medium text-[#171717] dark:text-[#ededed] mt-1">
                                          PostgreSQL 16 (Embedded)
                                        </dd>
                                    </div>
                                  </dl>
                                </Surface>

                                {/* Authenticated Account */}
                                      <Surface className="p-6 flex flex-wrap items-center justify-between gap-4">
                                        <div className="space-y-1">
                                          <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                                            Account session
                                          </h2>
                                            <p className="text-xs text-[#525252] dark:text-[#a1a1a6]">
                                              {user?.name} · <span className="font-mono">{user?.email}</span>
                                            </p>
                                              <p className="text-xs text-[#737373] dark:text-[#85858b]">
                                                {user?.role} · Signed JWT session
                                              </p>
                                            </div>

                                            <Button variant="secondary" size="xs" onClick={logout}>
                                              <LogOut className="w-4 h-4" strokeWidth={1.5} />
                                              <span>Sign out</span>
                                            </Button>
                                          </Surface>
                                        </div>
                                        );
}
