import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Clock, Plus, Search } from 'lucide-react';
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
          <div>
              <h1 className="text-2xl sm:text-3xl font-medium text-[#171717] dark:text-[#ededed]">
                Query history
              </h1>
                <p className="text-sm text-[#737373] dark:text-[#85858b] mt-1">
                  Audit log of natural-language inquiries, AST-verified SQL, and latency
                </p>
              </div>

              <Button variant="primary" size="sm" onClick={() => navigate('/analyst')}>
                <Plus className="w-4 h-4" strokeWidth={1.5} />
                <span>New query</span>
              </Button>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search
                className="w-4 h-4 text-[#737373] dark:text-[#85858b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                aria-label="Search query history"
                className="w-full h-9 pl-9 pr-3 text-xs rounded-lg bg-white dark:bg-[#19191b] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] text-[#171717] dark:text-[#ededed] placeholder:text-[#737373] dark:placeholder:text-[#85858b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 transition-colors duration-150"
              />
            </div>

            <div
              className="inline-flex items-center p-1 rounded-lg bg-[#f4f4f5] dark:bg-[#232325] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]"
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
                          ? 'bg-white dark:bg-[#19191b] text-[#171717] dark:text-[#ededed] shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none'
                          : 'text-[#737373] dark:text-[#85858b] hover:text-[#171717] dark:hover:text-[#ededed]'
                      }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      <Surface className="divide-y divide-[#171717]/[0.06] dark:divide-[#ededed]/[0.06]">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Clock className="w-6 h-6 text-[#737373] dark:text-[#85858b] mx-auto" strokeWidth={1.5} />
            <p className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
              No matching queries
            </p>
            <p className="text-xs text-[#737373] dark:text-[#85858b] max-w-sm mx-auto">
              Run a question in the AI Analyst or adjust your status filter.
            </p>
            <Button variant="secondary" size="xs" onClick={() => navigate('/analyst')}>
              Open AI Analyst
            </Button>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="p-5 space-y-3 hover:bg-[#fafafa] dark:hover:bg-[#232325]/30 transition-colors duration-150"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <h2 className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
                    {item.question}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#737373] dark:text-[#85858b] font-mono">
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
                    <span className="tabular-nums">{item.rowCount} rows</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{item.executionTimeMs}ms</span>
                    {item.retryCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums text-[#b45309] dark:text-[#fbbf24]">
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
                  onClick={() => navigate(`/ analyst ? historyId = ${item.id}`)}
                >
                  <span>Reopen</span>
                  <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                </Button>
              </div>

              {item.resultSummary && (
                <p className="text-xs text-[#525252] dark:text-[#a1a1a6] line-clamp-2">
                  {item.resultSummary}
                </p>
              )}

              {item.generatedSql && (
                <pre className="p-3 rounded-lg bg-[#0f0f10] border border-[#171717]/[0.1] dark:border-[#ededed]/[0.08] text-[#ededed]/90 font-mono text-xs overflow-x-auto max-h-24">
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
