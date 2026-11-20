import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  Download,
  FileDown,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { analyticsApi, reportsApi } from '../services/api';
import type { AnalyticsQueryResponse, PipelineTraceStep } from '../types/api';
import { Button, Surface } from '../components/ui/Primitives';
import { DynamicChart } from '../components/charts/DynamicChart';
import { AgentPipelineTrace } from '../components/analyst/AgentPipelineTrace';
import { SqlViewer } from '../components/analyst/SqlViewer';
import { downloadCsvFile, exportReportToPdf } from '../utils/formatters';

const SUGGESTED_QUESTIONS = [
  'What was our total revenue this month?',
  'Which products generated the highest revenue?',
  'Compare sales between the last two quarters.',
  'Which region has the highest customer acquisition?',
  'Show monthly revenue trends for the previous year.',
  'Identify customers whose purchases have declined.',
  'What are the top five performing products?',
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
    <div className="flex flex-col min-h-[calc(100vh-8.5rem)] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            AI Data Analyst
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ask business questions in plain English. IntelliBI plans, validates read-only PostgreSQL SQL, analyzes rows, and renders charts automatically.
          </p>
        </div>

        {messages.length > 0 && (
          <Button variant="secondary" size="sm" onClick={handleNewSession}>
            <Plus className="w-3.5 h-3.5" />
            New Analysis
          </Button>
        )}
      </div>

      {/* Empty Welcome + Suggested Prompts */}
      {messages.length === 0 && !isStreaming && (
        <Surface className="p-6 sm:p-8 space-y-6">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              What would you like to uncover in your business data?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Every question passes through our 9-node autonomous workflow: Query Analysis, PostgreSQL Schema Intelligence, SQL Generation, AST Security Validation, Read-Only Execution, Self-Correction (up to 2 retries), Statistical Analysis, Visualization Selection, and Executive Synthesis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => runQuestion(q, messages)}
                className="p-3.5 text-left rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 hover:border-blue-400 dark:hover:border-blue-500/60 hover:bg-white dark:hover:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </Surface>
      )}

      {/* Analysis Thread */}
      <div className="flex-1 space-y-6">
        {messages.map((item, idx) => (
          <div key={`${item.queryId}-${idx}`} className="space-y-4">
            {/* User Question Header */}
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                {item.question}
              </h2>
              <span className="text-xs font-mono tabular-nums text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                Query #{item.queryId}
              </span>
            </div>

            <Surface className="p-5 sm:p-6 space-y-5">
              {/* Security Blocked Banner */}
              {item.executionStatus === 'blocked' && (
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-amber-900 dark:text-amber-200">
                      Blocked by Read-Only SQL Security Guard
                    </p>
                    <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}

              {/* Failure Banner */}
              {item.executionStatus === 'failed' && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-red-900 dark:text-red-200">
                      Query Execution Unsuccessful
                    </p>
                    <p className="text-red-800 dark:text-red-300/90 leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}

              {/* Standard Executive Answer */}
              {(item.executionStatus === 'succeeded' || item.executionStatus === 'clarification') && (
                <div className="space-y-4">
                  <p className="text-sm sm:text-[15px] text-slate-800 dark:text-slate-200 leading-relaxed">
                    {item.answer}
                  </p>

                  {item.insights.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-2">
                        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Key Findings
                        </h3>
                        <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300 list-disc pl-4">
                          {item.insights.map((ins, i) => (
                            <li key={i} className="leading-snug">
                              {ins}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {item.recommendations.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Recommendations
                          </h3>
                          <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300 list-disc pl-4">
                            {item.recommendations.map((rec, i) => (
                              <li key={i} className="leading-snug">
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

              {/* Interactive Auto-Selected Visualization */}
              {item.executionStatus === 'succeeded' && item.visualization && item.rows.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <DynamicChart
                    config={item.visualization}
                    columns={item.columns}
                    rows={item.rows}
                  />
                </div>
              )}

              {/* SQL Viewer */}
              {item.generatedSql && (
                <div className="pt-2">
                  <SqlViewer
                    sql={item.generatedSql}
                    explanation={item.sqlExplanation}
                    validation={item.validation}
                    executionTimeMs={item.executionTimeMs}
                    rowCount={item.rowCount}
                    retryCount={item.retryCount}
                  />
                </div>
              )}

              {/* Multi-Agent Trace */}
              {item.pipelineTrace.length > 0 && (
                <AgentPipelineTrace steps={item.pipelineTrace} />
              )}

              {/* Action Toolbar */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {item.executionStatus === 'succeeded' && (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSaveReport(item)}
                        disabled={savingReportId === item.queryId || savedReportIds[item.queryId]}
                      >
                        {savedReportIds[item.queryId] ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Saved to Reports
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3.5 h-3.5" />
                            {savingReportId === item.queryId ? 'Saving...' : 'Save Report'}
                          </>
                        )}
                      </Button>

                      {item.rows.length > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            downloadCsvFile(
                              `intellibi-query-${item.queryId}`,
                              item.columns,
                              item.rows
                            )
                          }
                        >
                          <Download className="w-3.5 h-3.5" />
                          Export CSV
                        </Button>
                      )}

                      <Button
                        size="sm"
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
                        <FileDown className="w-3.5 h-3.5" />
                        PDF Report
                      </Button>
                    </>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => runQuestion(item.question, messages.slice(0, idx))}
                    disabled={isStreaming}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleFeedback(item.queryId, 'helpful')}
                    aria-label={`Mark query ${item.queryId} helpful`}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      feedbackMap[item.queryId] === 'helpful'
                        ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
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
                        ? 'text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Surface>
          </div>
        ))}

        {/* Live Streaming Progress Card */}
        {isStreaming && activeQuestion && (
          <div className="space-y-3">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
              {activeQuestion}
            </h2>
            <Surface className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                <span>Executing multi-agent analytics workflow against PostgreSQL...</span>
              </div>
              <AgentPipelineTrace steps={liveSteps} isRunning defaultExpanded />
            </Surface>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-700 dark:text-red-300 flex items-start gap-3"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Sticky Query Composer */}
      <div className="sticky bottom-4 z-20">
        <Surface className="p-2.5 shadow-sm">
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
                  : 'Ask a question about revenue, products, customers, regions, or payments...'
              }
              className="flex-1 h-10 px-3 text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isStreaming || !input.trim()}
            >
              {isStreaming ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Run Analysis
                </>
              )}
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}
