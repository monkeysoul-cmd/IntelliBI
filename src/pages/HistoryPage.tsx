import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, CheckCircle2, Clock, Plus, Search, ShieldAlert, XCircle } from 'lucide-react';
import { analyticsApi } from '../services/api';
import type { QueryHistoryItem } from '../types/api';
import { Badge, Button, Skeleton, Surface } from '../components/ui/Primitives';
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
          if (active) setItems(res.items ?? []);
        })
        .catch((err) => {
          console.error('Failed to load query history', err);
          if (active) setItems([]);
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-white/[0.06]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
            Query Audit History
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit trail of natural language questions, AST-verified SQL statements, and execution performance
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => navigate('/analyst')}>
          <Plus className="w-3.5 h-3.5" />
          <span>New Query</span>
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions or SQL statements..."
            aria-label="Search query history"
            className="w-full h-8.5 pl-8.5 pr-3 text-xs rounded-lg bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div
          className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.08]"
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
              className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === st
                  ? 'bg-white dark:bg-[#1C212E] text-slate-950 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      <Surface className="divide-y divide-slate-100 dark:divide-white/[0.05]">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2.5">
            <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white font-display">
              No matching queries found
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Execute an inquiry in the AI Analyst or adjust your search filter.
            </p>
            <Button variant="secondary" size="xs" onClick={() => navigate('/analyst')}>
              Launch AI Analyst
            </Button>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-4.5 space-y-2.5 hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white font-display">
                    {item.question}
                  </h2>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <Badge
                      variant={
                        item.executionStatus === 'succeeded'
                          ? 'emerald'
                          : item.executionStatus === 'blocked'
                            ? 'amber'
                            : 'rose'
                      }
                      dot
                    >
                      {item.executionStatus}
                    </Badge>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{item.rowCount} rows</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{item.executionTimeMs}ms</span>
                    {item.retryCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums text-amber-500">
                          {item.retryCount} correction{item.retryCount > 1 ? 's' : ''}
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-sans">{formatDateTime(item.createdAt)}</span>
                  </div>
                </div>

                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => navigate(`/analyst?historyId=${item.id}`)}
                >
                  <span>Reopen</span>
                  <ArrowUpRight className="w-3 h-3" />
                </Button>
              </div>

              {item.resultSummary && (
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 font-sans">
                  {item.resultSummary}
                </p>
              )}

              {item.generatedSql && (
                <pre className="p-2.5 rounded-lg bg-[#0A0D14] border border-white/[0.06] text-blue-100 font-mono text-[11px] overflow-x-auto max-h-24">
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
