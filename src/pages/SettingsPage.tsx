import React, { useEffect, useState } from 'react';
import { Check, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
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
      await updateSettings({ maxRows: Number(maxRows), queryTimeoutMs: Number(queryTimeoutMs) });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch {
      setError('Failed to save query execution guardrails.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Workspace Settings
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure SQL execution guardrails, display preferences, and your authenticated analyst account.
        </p>
      </div>

      {/* Query Execution Guardrails */}
      <Surface className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            SQL Execution Guardrails
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Applied automatically by Node 4 (SQL Validation) and Node 5 (SQL Execution) on every AI-generated query.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="setting-max-rows" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Maximum Result Rows (10 – 1,000)
              </label>
              <input
                id="setting-max-rows"
                type="number"
                min={10}
                max={1000}
                value={maxRows}
                onChange={(e) => setMaxRows(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm font-mono tabular-nums rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="setting-timeout" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Statement Timeout in ms (1,000 – 30,000)
              </label>
              <input
                id="setting-timeout"
                type="number"
                min={1000}
                max={30000}
                step={500}
                value={queryTimeoutMs}
                onChange={(e) => setQueryTimeoutMs(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm font-mono tabular-nums rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? 'Saving...' : 'Save Guardrails'}
            </Button>
            {savedOk && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                Saved to PostgreSQL
              </span>
            )}
          </div>
        </form>
      </Surface>

      {/* Appearance */}
      <Surface className="p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Interface Theme
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Switch between crisp daylight and low-glare dark mode.
          </p>
        </div>

        <div
          className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80"
          role="tablist"
          aria-label="Color theme preference"
        >
          <button
            type="button"
            role="tab"
            aria-selected={theme === 'light'}
            onClick={() => setTheme('light')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              theme === 'light'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            Light
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={theme === 'dark'}
            onClick={() => setTheme('dark')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              theme === 'dark'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            Dark
          </button>
        </div>
      </Surface>

      {/* Runtime Architecture Summary (Read-Only, no API key inputs) */}
      <Surface className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            AI & Security Configuration
          </h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 text-sm">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">LLM Provider</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5 capitalize">
              {status?.llmProvider || 'Gemini'} ({status?.llmModel || 'gemini-4-hydrogen'})
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Database Mode</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
              PostgreSQL Read-Only Analytics Sandbox
            </dd>
          </div>
        </dl>
      </Surface>

      {/* Account */}
      <Surface className="p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Signed-In Analyst Account
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
            {user?.name} · <span className="font-mono text-xs">{user?.email}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Role: {user?.role} · Protected by signed JWT session
          </p>
        </div>

        <Button variant="secondary" size="sm" onClick={logout}>
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </Button>
      </Surface>
    </div>
  );
}
