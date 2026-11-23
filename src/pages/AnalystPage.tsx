import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookmarkPlus,
  Bot,
  Check,
  Download,
  FileDown,
  Layers,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { analyticsApi, reportsApi } from '../services/api';
import type { AnalyticsQueryResponse, PipelineTraceStep } from '../types/api';
import { Badge, Button, Keycap, Surface } from '../components/ui/Primitives';
import { DynamicChart } from '../components/charts/DynamicChart';
import { AgentPipelineTrace } from '../components/analyst/AgentPipelineTrace';
import { SqlViewer } from '../components/analyst/SqlViewer';
import { downloadCsvFile, exportReportToPdf } from '../utils/formatters';

const SUGGESTED_QUESTIONS = [
  { label: 'Revenue Trends', q: 'What was our total revenue this month compared to last month?' },
  { label: 'Product Margin', q: 'Which products generated the highest revenue and margins?' },
  { label: 'Regional Share', q: 'Which region has the highest customer acquisition and order volume?' },
  { label: 'Quarterly Sales', q: 'Compare quarterly sales trends between 2025 and 2026.' },
  { label: 'Churn Risk', q: 'Identify customers whose purchases have declined or ceased.' },
  { label: 'Average Ticket', q: 'What is the average order value by region and category?' },
];

export function AnalystPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversationId, setConversationId] = useState(() => `conv-${Date.now()}`);
  const [messages, setMessages] = useState<AnalyticsQueryResponse[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [liveSteps, setLiveSteps] = useState<PipelineTraceStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedReportIds, setSavedReportIds] = useState<Record<number, boolean>>({});
  const [savingReportId, setSavingReportId] = useState<number | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<number, 'helpful' | 'needs_improvement'>>({});
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const initializedParamRef = useRef<string | null>(null);

  const runQuestion = useCallback(
    async (questionText: string, existingHistory: AnalyticsQueryResponse[]) => {
      const cleaned = questionText.trim();
      if (!cleaned || isStreaming) return;

      setError(null);
      setIsStreaming(true);
      setActiveQuestion(cleaned);
      setLiveSteps([]);

      const historyContext = existingHistory
        .filter((m) => m.executionStatus === 'succeeded')
        .slice(-4)
        .map((m) => ({
          question: m.question,
          generatedSql: m.generatedSql,
          summary: m.answer,
        }));

      try {
        await analyticsApi.queryStream(
          {
            question: cleaned,
            conversationId,
            conversationHistory: historyContext,
          },
          {
            onNodeEvent: (step) => {
              setLiveSteps((prev) => {
                const idx = prev.findIndex(
                  (s) => s.node === step.node && s.status === 'running'
                );
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = step;
                  return next;
                }
                return [...prev, step];
              });
            },
            onResult: (result) => {
              setMessages((prev) => [...prev, result]);
              setActiveQuestion(null);
              setLiveSteps([]);
              setIsStreaming(false);
            },
            onError: (msg) => {
              setError(msg);
              setActiveQuestion(null);
              setIsStreaming(false);
            },
          }
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unexpected network error during analysis.');
        setActiveQuestion(null);
        setIsStreaming(false);
      }
    },
    [conversationId, isStreaming]
  );

  // Handle incoming ?q= or ?historyId= query parameters
  useEffect(() => {
    const qParam = searchParams.get('q');
    const historyIdParam = searchParams.get('historyId');
    const paramKey = `${qParam ?? ''}|${historyIdParam ?? ''}`;
    if (!qParam && !historyIdParam) return;
    if (initializedParamRef.current === paramKey) return;
    initializedParamRef.current = paramKey;

    if (historyIdParam) {
      const id = Number(historyIdParam);
      if (Number.isInteger(id) && id > 0) {
        analyticsApi
          .getHistoryItem(id)
          .then((record) => {
            setConversationId(record.conversationId || `conv-${Date.now()}`);
            setMessages([record]);
            if (record.feedback) {
              setFeedbackMap({ [record.queryId]: record.feedback });
            }
          })
          .catch(() => setError('Could not reopen the selected historical query.'));
      }
      setSearchParams({}, { replace: true });
      return;
    }

    if (qParam) {
      setSearchParams({}, { replace: true });
      runQuestion(qParam, []);
    }
  }, [searchParams, setSearchParams, runQuestion]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, liveSteps.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const nextQ = input.trim();
    setInput('');
    runQuestion(nextQ, messages);
  };

  const handleNewSession = () => {
    setConversationId(`conv-${Date.now()}`);
    setMessages([]);
    setError(null);
    setLiveSteps([]);
    setActiveQuestion(null);
  };

  const handleSaveReport = async (item: AnalyticsQueryResponse) => {
    if (savingReportId === item.queryId || savedReportIds[item.queryId]) return;
    setSavingReportId(item.queryId);
    try {
      await reportsApi.generate({
        title: item.visualization?.title || item.question.slice(0, 120),
        description: item.sqlExplanation || 'Generated from IntelliBI AI Analyst session.',
        queryHistoryId: item.queryId,
        question: item.question,
        generatedSql: item.generatedSql,
        summary: item.answer,
        insights: item.insights,
        visualization: item.visualization,
        columns: item.columns,
        rows: item.rows,
      });
      setSavedReportIds((prev) => ({ ...prev, [item.queryId]: true }));
    } catch {
      setError('Unable to save analytical report. Please try again.');
    } finally {
      setSavingReportId(null);
    }
  };

  const handleFeedback = async (queryId: number, value: 'helpful' | 'needs_improvement') => {
    setFeedbackMap((prev) => ({ ...prev, [queryId]: value }));
    try {
      await analyticsApi.submitFeedback(queryId, value);
    } catch {
      // Ignore silent feedback failure
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)] space-y-5">
      {/* Page Title & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
                AI Business Analyst
              </h1>
              <Badge variant="blue">Autonomous Graph</Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Natural language questions compiled to AST-verified read-only PostgreSQL SQL
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <Button variant="secondary" size="sm" onClick={handleNewSession}>
            <Plus className="w-3.5 h-3.5" />
            <span>New Analysis</span>
          </Button>
        )}
      </div>

      {/* Empty State Welcome & Prompt Deck */}
      {messages.length === 0 && !isStreaming && (
        <Surface className="p-6 sm:p-8 space-y-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Agent LangGraph Architecture</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight font-display">
              Ask any business inquiry in natural language
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
              IntelliBI autonomously orchestrates 7 specialized agents: Query Analyzer → Schema Intelligence → SQL Generator → AST Security Validator → PostgreSQL Executor → Statistical Analysis → Visualization Selection.
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">
              Suggested Business Inquiries
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SUGGESTED_QUESTIONS.map((item) => (
                <button
                  key={item.q}
                  type="button"
                  onClick={() => runQuestion(item.q, messages)}
                  className="p-3 text-left rounded-xl border border-slate-200/80 dark:border-white/[0.07] bg-slate-50/50 dark:bg-white/[0.02] hover:border-blue-400/60 dark:hover:border-blue-500/40 hover:bg-white dark:hover:bg-white/[0.05] transition-all cursor-pointer group"
                >
                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold block mb-1">
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors leading-snug">
                    {item.q}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Surface>
      )}

      {/* Analysis Thread */}
      <div className="flex-1 space-y-6">
        {messages.map((item, idx) => (
          <div key={`${item.queryId}-${idx}`} className="space-y-3.5">
            {/* User Question Header */}
            <div className="flex items-center justify-between gap-4 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white font-display">
                  {item.question}
                </h2>
              </div>
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                Query #{item.queryId}
              </span>
            </div>

            <Surface className="p-5 sm:p-6 space-y-5">
              {/* Security Blocked Banner */}
              {item.executionStatus === 'blocked' && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex items-start gap-3">
                  <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-semibold text-amber-900 dark:text-amber-200 font-display">
                      Blocked by Read-Only AST Security Guard
                    </p>
                    <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed font-sans">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}

              {/* Failure Banner */}
              {item.executionStatus === 'failed' && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-semibold text-rose-900 dark:text-rose-200 font-display">
                      Execution Unsuccessful
                    </p>
                    <p className="text-rose-800 dark:text-rose-300/90 leading-relaxed font-sans">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}

              {/* Standard Executive Answer */}
              {(item.executionStatus === 'succeeded' || item.executionStatus === 'clarification') && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                    {item.answer}
                  </p>

                  {item.insights.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 font-display">
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>Key Findings</span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4 font-sans">
                          {item.insights.map((ins, i) => (
                            <li key={i} className="leading-relaxed">
                              {ins}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {item.recommendations.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-display">
                            <Target className="w-3.5 h-3.5" />
                            <span>Recommendations</span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4 font-sans">
                            {item.recommendations.map((rec, i) => (
                              <li key={i} className="leading-relaxed">
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Interactive Visualization */}
              {item.executionStatus === 'succeeded' && item.visualization && item.rows.length > 0 && (
                <div className="pt-2">
                  <DynamicChart
                    config={item.visualization}
                    columns={item.columns}
                    rows={item.rows}
                  />
                </div>
              )}

              {/* SQL Viewer */}
              {item.generatedSql && (
                <SqlViewer
                  sql={item.generatedSql}
                  explanation={item.sqlExplanation}
                  validation={item.validation}
                  executionTimeMs={item.executionTimeMs}
                  rowCount={item.rowCount}
                  retryCount={item.retryCount}
                />
              )}

              {/* Multi-Agent Pipeline Trace */}
              {item.pipelineTrace.length > 0 && (
                <AgentPipelineTrace steps={item.pipelineTrace} />
              )}

              {/* Actions Footer */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-white/[0.05] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {item.executionStatus === 'succeeded' && (
                    <>
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => handleSaveReport(item)}
                        disabled={savingReportId === item.queryId || savedReportIds[item.queryId]}
                      >
                        {savedReportIds[item.queryId] ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Saved to Reports</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3 h-3" />
                            <span>{savingReportId === item.queryId ? 'Saving...' : 'Save Report'}</span>
                          </>
                        )}
                      </Button>

                      {item.rows.length > 0 && (
                        <Button
                          size="xs"
                          variant="secondary"
                          onClick={() =>
                            downloadCsvFile(
                              `intellibi-query-${item.queryId}.csv`,
                              item.columns,
                              item.rows
                            )
                          }
                        >
                          <Download className="w-3 h-3" />
                          <span>CSV</span>
                        </Button>
                      )}

                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() =>
                          exportReportToPdf({
                            title: item.visualization?.title || item.question,
                            question: item.question,
                            summary: item.answer,
                            insights: item.insights,
                            generatedSql: item.generatedSql,
                            columns: item.columns,
                            rows: item.rows,
                            createdAt: item.createdAt,
                          })
                        }
                      >
                        <FileDown className="w-3 h-3" />
                        <span>PDF Report</span>
                      </Button>
                    </>
                  )}

                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => runQuestion(item.question, messages.slice(0, idx))}
                    disabled={isStreaming}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Regenerate</span>
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleFeedback(item.queryId, 'helpful')}
                    aria-label={`Mark query ${item.queryId} helpful`}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      feedbackMap[item.queryId] === 'helpful'
                        ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(item.queryId, 'needs_improvement')}
                    aria-label={`Mark query ${item.queryId} needs improvement`}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      feedbackMap[item.queryId] === 'needs_improvement'
                        ? 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Surface>
          </div>
        ))}

        {/* Live Streaming State */}
        {isStreaming && activeQuestion && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white font-display">
                {activeQuestion}
              </h2>
            </div>
            <Surface className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                <span>Executing multi-agent analytics pipeline against PostgreSQL...</span>
              </div>
              <AgentPipelineTrace steps={liveSteps} isRunning defaultExpanded />
            </Surface>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Sticky Query Input Console */}
      <div className="sticky bottom-4 z-20">
        <Surface className="p-2 sm:p-2.5 shadow-lg border border-slate-200/90 dark:border-white/[0.1] backdrop-blur-lg bg-white/95 dark:bg-[#11141D]/95">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <label htmlFor="analyst-question-input" className="sr-only">
              Ask a natural language question about your PostgreSQL data
            </label>
            <input
              id="analyst-question-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStreaming}
              placeholder={
                messages.length > 0
                  ? 'Ask a follow-up question (context is preserved)...'
                  : 'Ask a question about revenue, orders, customers, or products...'
              }
              className="flex-1 h-9 px-3 text-xs bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
            />
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 px-1">
              <Keycap>Enter</Keycap>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isStreaming || !input.trim()}
            >
              {isStreaming ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Thinking</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Run Query</span>
                </>
              )}
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}
