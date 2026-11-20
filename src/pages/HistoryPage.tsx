import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Search, ShieldAlert, XCircle } from 'lucide-react';
import { analyticsApi } from '../services/api';
import type { QueryHistoryItem } from '../types/api';
import { Button, Skeleton, Surface } from '../components/ui/Primitives';
import { formatDateTime } from '../utils/formatters';

export function HistoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<QueryHistoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'succeeded' | 'blocked' | 'failed'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      analyticsApi
        .getHistory({ search: search.trim() || undefined, status: statusFilter })
        .then((res) => {
          if (active) setItems(res.items);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 150);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Query History
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Audit trail of natural-language questions, validated PostgreSQL queries, execution timings, and saved summaries.
          </p>
        </div>

        <Button variant="primary" onClick={() => navigate('/analyst')}>
          New Query
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions or SQL..."
            aria-label="Search query history"
            className="w-full h-9 pl-9 pr-3 text-sm rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        <div
          className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80"
          role="tablist"
          aria-label="Filter query history by status"
        >
          {(['all', 'succeeded', 'blocked', 'failed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              role="tab"
              aria-selected={statusFilter === st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === st
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      <Surface className="divide-y divide-slate-200 dark:divide-slate-800">
        {loading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              No matching queries found
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Run an analytical question in AI Analyst or adjust your search and status filters.
            </p>
            <Button variant="secondary" size="sm" onClick={() => navigate('/analyst')}>
              Open AI Analyst
            </Button>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="p-5 space-y-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/25 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                    {item.question}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {item.executionStatus === 'succeeded' && (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Succeeded
                      </span>
                    )}
                    {item.executionStatus === 'blocked' && (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Security Blocked
                      </span>
                    )}
                    {(item.executionStatus === 'failed' || item.executionStatus === 'clarification') && (
                      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        {item.executionStatus === 'clarification' ? 'Clarification' : 'Failed'}
                      </span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{item.rowCount} rows</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{item.executionTimeMs}ms</span>
                    {item.retryCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {item.retryCount} {item.retryCount === 1 ? 'retry' : 'retries'}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/analyst?historyId=${item.id}`)}
                >
                  Reopen
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </div>

              {item.resultSummary && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                  {item.resultSummary}
                </p>
              )}

              {item.generatedSql && (
                <pre className="p-3 rounded-lg bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto max-h-28">
                  <code>{item.generatedSql}</code>
                </pre>
              )}
            </div>
          ))
        )}
      </Surface>
    </div>
  );
}
