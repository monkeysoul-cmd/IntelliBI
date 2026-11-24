import React, { useEffect, useState } from 'react';
import { Check, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { databaseApi } from '../services/api';
import type { DatabaseStatusInfo } from '../types/api';
import { Badge, Button, Surface } from '../components/ui/Primitives';

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
      <div className="pb-2 border-b border-slate-200/80 dark:border-white/[0.06]">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
          Workspace Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure SQL execution guardrails, interface appearance, and account preferences
        </p>
      </div>

      {/* Query Execution Guardrails */}
      <Surface className="p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
            SQL Execution Guardrails
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Enforced by Node 4 (SQL Validation AST) and Node 5 (PostgreSQL Execution) on every query
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label
                htmlFor="setting-max-rows"
                className="block text-[11px] font-medium text-slate-700 dark:text-slate-300"
              >
                Max Result Rows (10 – 1,000)
              </label>
              <input
                id="setting-max-rows"
                type="number"
                min={10}
                max={1000}
                value={maxRows}
                onChange={(e) => setMaxRows(Number(e.target.value))}
                className="w-full h-8.5 px-3 text-xs font-mono tabular-nums rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="setting-timeout"
                className="block text-[11px] font-medium text-slate-700 dark:text-slate-300"
              >
                Statement Timeout ms (1,000 – 30,000)
              </label>
              <input
                id="setting-timeout"
                type="number"
                min={1000}
                max={30000}
                step={500}
                value={queryTimeoutMs}
                onChange={(e) => setQueryTimeoutMs(Number(e.target.value))}
                className="w-full h-8.5 px-3 text-xs font-mono tabular-nums rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" variant="primary" size="xs" disabled={saving}>
              {saving ? 'Saving...' : 'Save Guardrails'}
            </Button>
            {savedOk && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                <span>Saved to database</span>
              </span>
            )}
          </div>
        </form>
      </Surface>

      {/* Interface Theme Appearance */}
      <Surface className="p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
            Interface Theme
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Switch between daylight and low-glare dark mode
          </p>
        </div>

        <div
          className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.08]"
          role="tablist"
          aria-label="Color theme preference"
        >
          <button
            type="button"
            role="tab"
            aria-selected={theme === 'light'}
            onClick={() => setTheme('light')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              theme === 'light'
                ? 'bg-white text-slate-950 shadow-2xs font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={theme === 'dark'}
            onClick={() => setTheme('dark')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
              theme === 'dark'
                ? 'bg-[#1C212E] text-white shadow-2xs font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark</span>
          </button>
        </div>
      </Surface>

      {/* Architecture & AI Config (Read-Only) */}
      <Surface className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
            AI & Engine Topology
          </h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 font-mono">
          <div>
            <dt className="text-slate-400 font-sans">LLM Engine</dt>
            <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {status?.llmProvider || 'Gemini'} ({status?.llmModel || 'gemini-4-hydrogen'})
            </dd>
          </div>
          <div>
            <dt className="text-slate-400 font-sans">Database Engine</dt>
            <dd className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              PostgreSQL 16 Embedded Analytics
            </dd>
          </div>
        </dl>
      </Surface>

      {/* Authenticated Account */}
      <Surface className="p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
            Authenticated Analyst Session
          </h2>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
            {user?.name} · <span className="font-mono">{user?.email}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Role: {user?.role} · Secured via signed JWT session
          </p>
        </div>

        <Button variant="secondary" size="xs" onClick={logout}>
          <LogOut className="w-3 h-3" />
          <span>Sign Out</span>
        </Button>
      </Surface>
    </div>
  );
}
