import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileDown, FileText, Trash2 } from 'lucide-react';
import { reportsApi } from '../services/api';
import type { SavedReport } from '../types/api';
import { Button, Skeleton, Surface } from '../components/ui/Primitives';
import { DynamicChart } from '../components/charts/DynamicChart';
import { SqlViewer } from '../components/analyst/SqlViewer';
import { exportReportToPdf, formatDateTime } from '../utils/formatters';
import { cn } from '../utils/cn';

export function ReportsPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    reportsApi
      .list()
      .then((res) => {
        if (!active) return;
        setReports(res.reports);
        if (res.reports.length > 0) {
          setSelectedId(res.reports[0].id);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activeReport = reports.find((r) => r.id === selectedId) ?? reports[0] ?? null;

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await reportsApi.remove(id);
      setReports((prev) => {
        const next = prev.filter((r) => r.id !== id);
        if (selectedId === id) {
          setSelectedId(next[0]?.id ?? null);
        }
        return next;
      });
    } finally {
      setDeletingId(null);
    }
  };

  const slugify = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'intellibi-report';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Analytical Reports
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Saved AI analyses persisted in PostgreSQL. Export formatted PDF reports, raw CSV datasets, or Markdown briefs.
          </p>
        </div>

        <Button variant="primary" onClick={() => navigate('/analyst')}>
          Create Report in AI Analyst
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-4 h-72" />
          <Skeleton className="lg:col-span-8 h-96" />
        </div>
      ) : reports.length === 0 ? (
        <Surface className="p-12 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-base font-semibold text-slate-900 dark:text-white">
            No saved reports yet
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Run any analytical question in AI Analyst and click &ldquo;Save Report&rdquo; to archive its visualization, SQL, and executive findings here.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/analyst')}>
            Go to AI Analyst
          </Button>
        </Surface>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Report List */}
          <Surface className="lg:col-span-4 p-3 space-y-1">
            <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2.5 py-1.5">
              Saved Reports ({reports.length})
            </h2>
            {reports.map((rep) => (
              <button
                key={rep.id}
                type="button"
                onClick={() => setSelectedId(rep.id)}
                className={cn(
                  'w-full p-3 rounded-lg text-left transition-colors cursor-pointer space-y-1',
                  activeReport?.id === rep.id
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/12 dark:text-blue-400'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                )}
              >
                <p className="text-sm font-semibold leading-snug line-clamp-2">{rep.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(rep.createdAt)} · {rep.rows.length} rows
                </p>
              </button>
            ))}
          </Surface>

          {/* Active Report Preview */}
          {activeReport && (
            <Surface className="lg:col-span-8 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {activeReport.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Saved {formatDateTime(activeReport.createdAt)} · {activeReport.rows.length} returned rows
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() =>
                      exportReportToPdf({
                        title: activeReport.title,
                        question: activeReport.question,
                        summary: activeReport.summary,
                        insights: activeReport.insights,
                        generatedSql: activeReport.generatedSql,
                        columns: activeReport.columns,
                        rows: activeReport.rows,
                        createdAt: activeReport.createdAt,
                      })
                    }
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Download PDF
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      reportsApi.download(activeReport.id, 'csv', slugify(activeReport.title))
                    }
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      reportsApi.download(activeReport.id, 'md', slugify(activeReport.title))
                    }
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Summary
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete report ${activeReport.title}`}
                    disabled={deletingId === activeReport.id}
                    onClick={() => handleDelete(activeReport.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Executive Summary
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {activeReport.summary || activeReport.description}
                </p>
              </div>

              {activeReport.insights.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Key Business Observations
                  </h3>
                  <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300 list-disc pl-4">
                    {activeReport.insights.map((ins, idx) => (
                      <li key={idx}>{ins}</li>
                    ))}
                  </ul>
                </div>
              )}

              {activeReport.visualization && activeReport.rows.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <DynamicChart
                    config={activeReport.visualization}
                    columns={activeReport.columns}
                    rows={activeReport.rows}
                    height={280}
                  />
                </div>
              )}

              {activeReport.generatedSql && (
                <SqlViewer
                  sql={activeReport.generatedSql}
                  rowCount={activeReport.rows.length}
                />
              )}
            </Surface>
          )}
        </div>
      )}
    </div>
  );
}
