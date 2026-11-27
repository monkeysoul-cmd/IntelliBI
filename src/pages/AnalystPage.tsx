import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  Download,
  FileDown,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Target,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { analyticsApi, reportsApi } from '../services/api';
import type { AnalyticsQueryResponse, PipelineTraceStep } from '../types/api';
import { Button, Keycap, Surface } from '../components/ui/Primitives';
import { DynamicChart } from '../components/charts/DynamicChart';
import { AgentPipelineTrace } from '../components/analyst/AgentPipelineTrace';
import { SqlViewer } from '../components/analyst/SqlViewer';
import { downloadCsvFile, exportReportToPdf } from '../utils/formatters';

const SUGGESTED_QUESTIONS = [
  { label: 'Revenue trends', q: 'What was our total revenue this month compared to last month?' },
  { label: 'Product margin', q: 'Which products generated the highest revenue and margins?' },
  { label: 'Regional share', q: 'Which region has the highest customer acquisition and order volume?' },
  { label: 'Quarterly sales', q: 'Compare quarterly sales trends between 2025 and 2026.' },
  { label: 'Churn risk', q: 'Identify customers whose purchases have declined or ceased.' },
  { label: 'Average ticket', q: 'What is the average order value by region and category?' },
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
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const runQuestion = useCallback(
    async (questionText: string, existingHistory: AnalyticsQueryResponse[], forceReplace = false) => {
      const cleaned = questionText.trim();
      if (!cleaned) return;
      if (isStreaming && !forceReplace) return;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

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
              if (controller.signal.aborted) return;
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
              if (controller.signal.aborted) return;
              setMessages((prev) => [...prev, result]);
              setActiveQuestion(null);
              setLiveSteps([]);
              setIsStreaming(false);
            },
            onError: (msg) => {
              if (controller.signal.aborted) return;
              setError(msg);
              setActiveQuestion(null);
              setIsStreaming(false);
            },
          },
          controller.signal
        );
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unexpected network error during analysis.');
        setActiveQuestion(null);
        setIsStreaming(false);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [conversationId, isStreaming]
  );

  useEffect(() => {
    const qParam = searchParams.get('q');
    const historyIdParam = searchParams.get('historyId');
    const paramKey = `${qParam ?? ''}|${historyIdParam ?? ''}`;
    if (!qParam && !historyIdParam) {
      initializedParamRef.current = null;
      return;
    }
    if (initializedParamRef.current === paramKey) return;
    initializedParamRef.current = paramKey;

    if (historyIdParam) {
      const id = Number(historyIdParam);
      if (Number.isInteger(id) && id > 0) {
        abortControllerRef.current?.abort();
        setIsStreaming(false);
        setActiveQuestion(null);
        setLiveSteps([]);
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
      runQuestion(qParam, [], true);
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
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
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
        insights: item.insights ?? [],
        visualization: item.visualization,
        columns: item.columns ?? [],
        rows: item.rows ?? [],
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
      <div className="flex flex-col min-h-[calc(100vh-8rem)] space-y-6">
        {/* Page Title & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
              <div>
                <h1 className="text-2xl sm:text-3xl font-medium text-[#171717] dark:text-[#ededed]">
                  AI Business Analyst
                </h1>
                <p className="text-sm text-[#737373] dark:text-[#85858b] mt-1">
                  Natural-language questions compiled into AST-verified read-only PostgreSQL queries
                </p>
              </div>

              {messages.length > 0 && (
                <Button variant="secondary" size="sm" onClick={handleNewSession}>
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                  <span>New analysis</span>
                </Button>
              )}
            </div>

            {/* Empty State Welcome & Prompt Deck */}
            {messages.length === 0 && !isStreaming && (
                <Surface className="p-6 space-y-6">
                  <div className="max-w-2xl space-y-2">
                      <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                        Query the PostgreSQL dataset in plain English
                      </h2>
                        <p className="text-sm text-[#525252] dark:text-[#a1a1a6] leading-relaxed">
                          Each inquiry runs through a 9-node verification graph that inspects schema relationships, generates read-only SQL, checks AST constraints, executes in a bounded transaction, and summarizes exact results.
                        </p>
                      </div>

                          <div className="space-y-3">
                            <span className="text-xs text-[#737373] dark:text-[#85858b] block">
                              Suggested inquiries
                            </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {SUGGESTED_QUESTIONS.map((item) => (
                                  <button
                                    key={item.q}
                                    type="button"
                                    onClick={() => runQuestion(item.q, messages)}
                                    className="p-4 text-left rounded-lg border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] bg-[#fafafa] dark:bg-[#141415] hover:border-[#171717]/[0.18] dark:hover:border-[#ededed]/[0.18] transition-colors duration-150 cursor-pointer group"
                                  >
                                      <span className="text-xs font-mono text-[#2563eb] dark:text-[#3b82f6] block mb-1">
                                        {item.label}
                                      </span>
                                        <span className="text-xs text-[#171717] dark:text-[#ededed] leading-snug block">
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
                                    <div key={`${item.queryId}-${idx}`} className="space-y-3">
                                      <div className="flex items-center justify-between gap-4 px-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <span className="w-2 h-2 rounded-full bg-[#2563eb] dark:bg-[#3b82f6] shrink-0" />
                                              <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed] truncate">
                                                {item.question}
                                              </h2>
                                            </div>
                                              <span className="text-xs font-mono tabular-nums text-[#737373] dark:text-[#85858b] whitespace-nowrap shrink-0">
                                                Query #{item.queryId}
                                              </span>
                                            </div>

                                              <Surface className="p-6 space-y-5">
                                                {/* Security Blocked Banner */}
                                                {item.executionStatus === 'blocked' && (
                                                        <div className="p-4 rounded-lg bg-[#fffbeb] dark:bg-[#d97706]/10 border border-[#d97706]/25 flex items-start gap-3">
                                                          <ShieldAlert
                                                            className="w-4 h-4 text-[#b45309] dark:text-[#fbbf24] shrink-0 mt-0.5"
                                                            strokeWidth={1.5}
                                                          />
                                                          <div className="space-y-1 text-xs">
                                                            <p className="font-medium text-[#171717] dark:text-[#ededed]">
                                                              Blocked by read-only AST guard
                                                            </p>
                                                              <p className="text-[#525252] dark:text-[#a1a1a6] leading-relaxed">
                                                                {item.answer}
                                                              </p>
                                                          </div>
                                                        </div>
              )}

                                                        {/* Failure Banner */}
                                                        {item.executionStatus === 'failed' && (
                                                          <div className="space-y-3">
                                                                  <div className="p-4 rounded-lg bg-[#fef2f2] dark:bg-[#e5484d]/10 border border-[#dc2626]/20 dark:border-[#e5484d]/25 flex items-start gap-3">
                                                                    <AlertTriangle
                                                                      className="w-4 h-4 text-[#dc2626] dark:text-[#e5484d] shrink-0 mt-0.5"
                                                                      strokeWidth={1.5}
                                                                    />
                                                                    <div className="space-y-1 text-xs">
                                                                      <p className="font-medium text-[#171717] dark:text-[#ededed]">
                                                                        Execution unsuccessful
                                                                      </p>
                                                                        <p className="text-[#525252] dark:text-[#a1a1a6] leading-relaxed">
                                                                          {item.answer}
                                                                        </p>
                                                                    </div>
                                                                  </div>
                                                                  {item.recommendations && item.recommendations.length > 0 && (
                                                                        <div className="p-4 rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] space-y-2">
                                                                          <div className="flex items-center gap-2 text-xs font-medium text-[#171717] dark:text-[#ededed]">
                                                                            <Target className="w-4 h-4 text-[#737373] dark:text-[#85858b]" strokeWidth={1.5} />
                                                                            <span>Suggested next steps</span>
                                                                          </div>
                                                                            <ul className="space-y-1 text-xs text-[#525252] dark:text-[#a1a1a6] list-disc pl-4">
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

                                                                      {/* Standard Executive Answer */}
                                                                      {(item.executionStatus === 'succeeded' || item.executionStatus === 'clarification') && (
                                                                        <div className="space-y-4">
                                                                            <p className="text-sm text-[#171717] dark:text-[#ededed] leading-relaxed">
                                                                              {item.answer}
                                                                            </p>

                                                                            {((item.insights && item.insights.length > 0) ||
                                                                              (item.recommendations && item.recommendations.length > 0)) && (
                                                                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                                                    {item.insights && item.insights.length > 0 && (
                                                                                          <div className="p-4 rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] space-y-2">
                                                                                            <div className="flex items-center gap-2 text-xs font-medium text-[#171717] dark:text-[#ededed]">
                                                                                              <Lightbulb className="w-4 h-4 text-[#2563eb] dark:text-[#3b82f6]" strokeWidth={1.5} />
                                                                                              <span>Key findings</span>
                                                                                            </div>
                                                                                              <ul className="space-y-1.5 text-xs text-[#525252] dark:text-[#a1a1a6] list-disc pl-4">
                                                                                                {item.insights.map((ins, i) => (
                                                                                                  <li key={i} className="leading-relaxed">
                                                                                                    {ins}
                                                                                                  </li>
                                                                                                ))}
                                                                                              </ul>
                                                                                          </div>
                      )}

                                                                                          {item.recommendations && item.recommendations.length > 0 && (
                                                                                                <div className="p-4 rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] space-y-2">
                                                                                                  <div className="flex items-center gap-2 text-xs font-medium text-[#171717] dark:text-[#ededed]">
                                                                                                    <Target className="w-4 h-4 text-[#16a34a] dark:text-[#4cc38a]" strokeWidth={1.5} />
                                                                                                    <span>Recommendations</span>
                                                                                                  </div>
                                                                                                    <ul className="space-y-1.5 text-xs text-[#525252] dark:text-[#a1a1a6] list-disc pl-4">
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
                                                                                          {item.executionStatus === 'succeeded' && item.visualization && item.rows && item.rows.length > 0 && (
                                                                                            <div className="pt-2">
                                                                                              <DynamicChart
                                                                                                config={item.visualization}
                                                                                                columns={item.columns ?? []}
                                                                                                rows={item.rows ?? []}
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
                                                                                          {item.pipelineTrace && item.pipelineTrace.length > 0 && (
                                                                                            <AgentPipelineTrace steps={item.pipelineTrace} />
                                                                                          )}

                                                                                          {/* Actions Footer */}
                                                                                            <div className="pt-3 border-t border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] flex flex-wrap items-center justify-between gap-3">
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
                                                                                                          <Check className="w-4 h-4 text-[#16a34a] dark:text-[#4cc38a]" strokeWidth={1.5} />
                                                                                                          <span>Saved</span>
                                                                                                        </>
                                                                                                      ) : (
                                                                                                        <>
                                                                                                          <BookmarkPlus className="w-4 h-4" strokeWidth={1.5} />
                                                                                                          <span>{savingReportId === item.queryId ? 'Saving...' : 'Save report'}</span>
                                                                                                        </>
                                                                                                      )}
                                                                                                    </Button>

                                                                                                    {item.rows && item.rows.length > 0 && (
                                                                                                      <Button
                                                                                                        size="xs"
                                                                                                        variant="secondary"
                                                                                                        onClick={() =>
                                                                                                          downloadCsvFile(
                                                                                                            `intellibi-query-${item.queryId}.csv`,
                                                                                                            item.columns ?? [],
                                                                                                            item.rows ?? []
                                                                                                          )
                                                                                                        }
                                                                                                      >
                                                                                                        <Download className="w-4 h-4" strokeWidth={1.5} />
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
                                                                                                          insights: item.insights ?? [],
                                                                                                          generatedSql: item.generatedSql,
                                                                                                          columns: item.columns ?? [],
                                                                                                          rows: item.rows ?? [],
                                                                                                          createdAt: item.createdAt,
                                                                                                        })
                                                                                                      }
                                                                                                    >
                                                                                                      <FileDown className="w-4 h-4" strokeWidth={1.5} />
                                                                                                      <span>PDF</span>
                                                                                                    </Button>
                                                                                                  </>
                                                                                                )}

                                                                                                <Button
                                                                                                  size="xs"
                                                                                                  variant="ghost"
                                                                                                  onClick={() => runQuestion(item.question, messages.slice(0, idx))}
                                                                                                  disabled={isStreaming}
                                                                                                >
                                                                                                  <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
                                                                                                  <span>Regenerate</span>
                                                                                                </Button>
                                                                                              </div>

                                                                                              <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleFeedback(item.queryId, 'helpful')}
                    aria-label={`Mark query ${item.queryId} helpful`}
                    className={`p-1.5 rounded-md transition-colors duration-150 cursor-pointer ${
                      feedbackMap[item.queryId] === 'helpful'
                        ? 'text-[#16a34a] bg-[#f0fdf4] dark:bg-[#4cc38a]/12 dark:text-[#4cc38a]'
                        : 'text-[#737373] hover:text-[#171717] dark:text-[#85858b] dark:hover:text-[#ededed] hover:bg-[#f4f4f5] dark:hover:bg-[#232325]'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(item.queryId, 'needs_improvement')}
                    aria-label={`Mark query ${item.queryId} needs improvement`}
                    className={`p-1.5 rounded-md transition-colors duration-150 cursor-pointer ${
                      feedbackMap[item.queryId] === 'needs_improvement'
                        ? 'text-[#dc2626] bg-[#fef2f2] dark:bg-[#e5484d]/12 dark:text-[#e5484d]'
                        : 'text-[#737373] hover:text-[#171717] dark:text-[#85858b] dark:hover:text-[#ededed] hover:bg-[#f4f4f5] dark:hover:bg-[#232325]'
                    }`}
                  >
                    <ThumbsDown className="w-4 h-4" strokeWidth={1.5} />
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
              <Loader2 className="w-4 h-4 text-[#2563eb] dark:text-[#3b82f6] animate-spin shrink-0" strokeWidth={1.5} />
              <h2 className="text-base font-medium text-[#171717] dark:text-[#ededed]">
                {activeQuestion}
              </h2>
            </div>
            <Surface className="p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs text-[#525252] dark:text-[#a1a1a6]">
                <span>Executing verification pipeline against PostgreSQL...</span>
              </div>
              <AgentPipelineTrace steps={liveSteps} isRunning defaultExpanded />
            </Surface>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-4 rounded-lg bg-[#fef2f2] dark:bg-[#e5484d]/10 border border-[#dc2626]/20 dark:border-[#e5484d]/25 text-xs text-[#dc2626] dark:text-[#e5484d] flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>{error}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Sticky Query Input Console */}
      <div className="sticky bottom-4 z-20">
        <Surface className="p-2 shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:shadow-none border border-[#171717]/[0.12] dark:border-[#ededed]/[0.12]">
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
              placeholder={messages.length > 0 ? 'Ask a follow-up question' : 'Ask a question'}
              className="flex-1 h-9 px-3 text-sm bg-transparent text-[#171717] dark:text-[#ededed] placeholder:text-[#737373] dark:placeholder:text-[#85858b] focus:outline-none"
            />
            <div className="hidden sm:flex items-center px-1">
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
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                  <span>Running</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" strokeWidth={1.5} />
                  <span>Run query</span>
                </>
              )}
            </Button>
          </form>
        </Surface>
      </div>
    </div>
  );
}
