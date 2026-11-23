import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileDown, FileText, Trash2 } from 'lucide-react';
import { reportsApi } from '../services/api';
import type { SavedReport } from '../types/api';
import { Badge, Button, Skeleton, Surface } from '../components/ui/Primitives';
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-white/[0.06]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
            Analytical Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Archived AI analytical briefs, visualizations, and datasets saved from the analyst workspace
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => navigate('/analyst')}>
          <span>Create Report in AI</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Skeleton className="lg:col-span-4 h-64" />
          <Skeleton className="lg:col-span-8 h-96" />
        </div>
      ) : reports.length === 0 ? (
        <Surface className="p-12 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white font-display">
            No saved reports yet
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Run an analytical inquiry in the AI Analyst and click &ldquo;Save Report&rdquo; to archive it here.
          </p>
          <Button variant="secondary" size="xs" onClick={() => navigate('/analyst')}>
            Go to AI Analyst
          </Button>
        </Surface>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Report Archive List */}
          <Surface className="lg:col-span-4 p-3 space-y-1.5">
            <div className="px-2 pb-1 text-[11px] font-mono uppercase text-slate-400 tracking-wider">
              Saved Archives ({reports.length})
            </div>
            {reports.map((rep) => (
              <button
                key={rep.id}
                type="button"
                onClick={() => setSelectedId(rep.id)}
                className={cn(
                  'w-full p-2.5 rounded-lg text-left transition-all cursor-pointer space-y-1',
                  activeReport?.id === rep.id
                    ? 'bg-slate-900/[0.05] text-slate-950 font-semibold dark:bg-white/[0.08] dark:text-white border border-slate-200/80 dark:border-white/[0.08]'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
                )}
              >
                <p className="text-xs font-semibold leading-snug line-clamp-2">{rep.title}</p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {formatDateTime(rep.createdAt)} · {rep.rows.length} rows
                </p>
              </button>
            ))}
          </Surface>

          {/* Active Report Preview */}
          {activeReport && (
            <Surface className="lg:col-span-8 p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="space-y-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display">
                    {activeReport.title}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Saved {formatDateTime(activeReport.createdAt)} · {activeReport.rows.length} records
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    size="xs"
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
                    <FileDown className="w-3 h-3" />
                    <span>PDF</span>
                  </Button>

                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() =>
                      reportsApi.download(activeReport.id, 'csv', slugify(activeReport.title))
                    }
                  >
                    <Download className="w-3 h-3" />
                    <span>CSV</span>
                  </Button>

                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => handleDelete(activeReport.id)}
                    disabled={deletingId === activeReport.id}
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" />
                  </Button>
                </div>
              </div>

              {/* Inquiry Prompt Context */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] space-y-1">
                <span className="text-[10px] font-mono uppercase text-blue-600 dark:text-blue-400 font-semibold">
                  Original Analytics Query
                </span>
                <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                  {activeReport.question}
                </p>
              </div>

              {/* Summary and Findings */}
              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                  {activeReport.summary}
                </p>

                {activeReport.insights.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      Key Findings
                    </span>
                    <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4 font-sans">
                      {activeReport.insights.map((ins, i) => (
                        <li key={i}>{ins}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Render Chart */}
              {activeReport.visualization && activeReport.rows.length > 0 && (
                <div className="pt-2">
                  <DynamicChart
                    config={activeReport.visualization}
                    columns={activeReport.columns}
                    rows={activeReport.rows}
                  />
                </div>
              )}

              {/* SQL Viewer */}
              {activeReport.generatedSql && (
                <SqlViewer sql={activeReport.generatedSql} explanation={activeReport.description} />
              )}
            </Surface>
          )}
        </div>
      )}
    </div>
  );
}
