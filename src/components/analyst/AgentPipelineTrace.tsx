import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, XCircle } from 'lucide-react';
import type { PipelineTraceStep } from '../../types/api';
import { cn } from '../../utils/cn';

interface AgentPipelineTraceProps {
  steps: PipelineTraceStep[];
  isRunning?: boolean;
  defaultExpanded?: boolean;
}

export function AgentPipelineTrace({
  steps,
  isRunning = false,
  defaultExpanded = false,
}: AgentPipelineTraceProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || isRunning);

  React.useEffect(() => {
    if (isRunning) setExpanded(true);
  }, [isRunning]);

  if (steps.length === 0) return null;

  const totalMs = steps.reduce((acc, s) => acc + (s.durationMs || 0), 0);
  const completedCount = steps.filter((s) => s.status === 'completed').length;

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/70 dark:bg-slate-900/50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            Multi-Agent Workflow Trace
          </span>
          <span className="text-slate-400" aria-hidden="true">·</span>
          <span className="text-slate-500 dark:text-slate-400 truncate">
            {isRunning
              ? `Running ${steps[steps.length - 1]?.label ?? 'workflow'}...`
              : `${completedCount}/${steps.length} agents completed`}
          </span>
        </span>
        {!isRunning && totalMs > 0 && (
          <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
            {totalMs >= 1000 ? `${(totalMs / 1000).toFixed(2)}s` : `${totalMs}ms`}
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3 pt-1 border-t border-slate-200/80 dark:border-slate-800/80 divide-y divide-slate-200/60 dark:divide-slate-800/60">
          {steps.map((step, idx) => (
            <div
              key={`${step.node}-${idx}`}
              className="py-2 flex items-start justify-between gap-4 text-xs"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-0.5 shrink-0">
                  {step.status === 'running' && (
                    <Loader2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
                  )}
                  {step.status === 'completed' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {step.status === 'failed' && (
                    <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  )}
                </span>
                <div className="min-w-0">
                  <span
                    className={cn(
                      'font-medium',
                      step.status === 'failed'
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-slate-800 dark:text-slate-200'
                    )}
                  >
                    {step.label}
                  </span>
                  {step.detail && (
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5 break-words">
                      {step.detail}
                    </p>
                  )}
                </div>
              </div>
              {step.durationMs > 0 && (
                <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                  {step.durationMs}ms
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
