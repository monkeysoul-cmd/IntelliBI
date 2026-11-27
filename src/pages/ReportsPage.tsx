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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    reportsApi
      .list()
      .then((res) => {
        if (!active) return;
        const list = res.reports ?? [];
        setReports(list);
        if (list.length > 0) {
          setSelectedId(list[0].id);
        }
      })
      .catch(() => {
        if (active) setError('Unable to load saved reports from PostgreSQL.');
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
    setError(null);
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
    } catch {
      setError('Failed to delete report. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (id: number, format: 'csv' | 'md', filename: string) => {
    setError(null);
    try {
      await reportsApi.download(id, format, filename);
    } catch {
      setError(`Failed to download ${format.toUpperCase()} export.`);
    }
  };

  const slugify = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'intellibi-report';

  return (
    <div className="space-y-6">
      {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
          <div>
              <h1 className="text-2xl sm:text-3xl font-medium text-[#171717] dark:text-[#ededed]">
                Reports
              </h1>
                <p className="text-sm text-[#737373] dark:text-[#85858b] mt-1">
                  Saved analytical briefs, visualizations, and query datasets
                </p>
              </div>

              <Button variant="primary" size="sm" onClick={() => navigate('/analyst')}>
                <span>New analysis</span>
              </Button>
          </div>

          {error && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-[#fef2f2] dark:bg-[#e5484d]/10 border border-[#dc2626]/20 dark:border-[#e5484d]/25 text-xs text-[#dc2626] dark:text-[#e5484d]"
            >
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Skeleton className="lg:col-span-4 h-64" />
              <Skeleton className="lg:col-span-8 h-96" />
            </div>
          ) : reports.length === 0 ? (
            <Surface className="p-12 text-center space-y-3">
                <FileText className="w-6 h-6 text-[#737373] dark:text-[#85858b] mx-auto" strokeWidth={1.5} />
                <p className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
                  No saved reports
                </p>
                  <p className="text-xs text-[#737373] dark:text-[#85858b] max-w-sm mx-auto">
                    Run an inquiry in the AI Analyst and save the result to archive it here.
                  </p>
                  <Button variant="secondary" size="xs" onClick={() => navigate('/analyst')}>
                    Open AI Analyst
                  </Button>
                </Surface>
                ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Left Report Archive List */}
                      <Surface className="lg:col-span-4 p-4 space-y-2">
                        <div className="px-2 pb-1 text-xs text-[#737373] dark:text-[#85858b] font-mono tabular-nums">
                          Saved reports ({reports.length})
                        </div>
                        <div className="space-y-1">
                          {reports.map((rep) => (
                            <button
                              key={rep.id}
                              type="button"
                              onClick={() => setSelectedId(rep.id)}
                              className={cn(
                                'w-full p-3 rounded-lg text-left transition-colors duration-150 cursor-pointer space-y-1',
                                activeReport?.id === rep.id
                                  ? 'bg-[#f4f4f5] text-[#171717] font-medium dark:bg-[#232325] dark:text-[#ededed]'
                                  : 'text-[#525252] dark:text-[#a1a1a6] hover:bg-[#f4f4f5]/60 dark:hover:bg-[#232325]/60'
                              )}
                            >
                              <p className="text-xs font-medium leading-snug line-clamp-2">{rep.title}</p>
                              <p className="text-xs text-[#737373] dark:text-[#85858b] font-mono tabular-nums">
                                {formatDateTime(rep.createdAt)} · {rep.rows?.length ?? 0} rows
                              </p>
                            </button>
                          ))}
                        </div>
                      </Surface>

                      {/* Active Report Preview */}
                      {activeReport && (
                                <Surface className="lg:col-span-8 p-6 space-y-6">
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
                                    <div className="space-y-1">
                                      <h2 className="text-lg font-medium text-[#171717] dark:text-[#ededed]">
                                        {activeReport.title}
                                      </h2>
                                        <p className="text-xs text-[#737373] dark:text-[#85858b] font-mono tabular-nums">
                                          Saved {formatDateTime(activeReport.createdAt)} · {activeReport.rows?.length ?? 0} records
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
                                        <FileDown className="w-4 h-4" strokeWidth={1.5} />
                                        <span>PDF</span>
                                      </Button>

                                      <Button
                                        size="xs"
                                        variant="secondary"
                                        onClick={() =>
                                          handleDownload(activeReport.id, 'csv', slugify(activeReport.title))
                                        }
                                      >
                                        <Download className="w-4 h-4" strokeWidth={1.5} />
                                        <span>CSV</span>
                                      </Button>

                                      <Button
                                        size="xs"
                                        variant="secondary"
                                        onClick={() =>
                                          handleDownload(activeReport.id, 'md', slugify(activeReport.title))
                                        }
                                      >
                                        <Download className="w-4 h-4" strokeWidth={1.5} />
                                        <span>MD</span>
                                      </Button>

                                      <Button
                                        size="xs"
                                        variant="ghost"
                                        aria-label="Delete report"
                                        onClick={() => handleDelete(activeReport.id)}
                                        disabled={deletingId === activeReport.id}
                                      >
                                        <Trash2 className="w-4 h-4 text-[#dc2626] dark:text-[#e5484d]" strokeWidth={1.5} />
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Inquiry Prompt Context */}
                                      <div className="p-4 rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] space-y-1">
                                        <span className="text-xs font-mono text-[#2563eb] dark:text-[#3b82f6] block">
                                          Question
                                        </span>
                                          <p className="text-xs text-[#171717] dark:text-[#ededed] font-medium">
                                            {activeReport.question}
                                          </p>
                                      </div>

                                      {/* Summary and Findings */}
                                          <div className="space-y-4">
                                            <p className="text-sm text-[#171717] dark:text-[#ededed] leading-relaxed">
                                              {activeReport.summary}
                                            </p>

                                            {activeReport.insights && activeReport.insights.length > 0 && (
                                                  <div className="space-y-2">
                                                    <span className="text-xs font-medium text-[#737373] dark:text-[#85858b] block">
                                                      Key findings
                                                    </span>
                                                      <ul className="space-y-1.5 text-xs text-[#525252] dark:text-[#a1a1a6] list-disc pl-4">
                                                        {activeReport.insights.map((ins, i) => (
                        <li key={i} className="leading-relaxed">
                          {ins}
                        </li>
                                                        ))}
                                                      </ul>
                                                  </div>
                )}
                                              </div>

              {/* Render Chart */}
                                            {activeReport.visualization && activeReport.rows && activeReport.rows.length > 0 && (
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
