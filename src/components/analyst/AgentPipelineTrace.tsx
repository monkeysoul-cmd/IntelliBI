import React, { useState } from 'react';
import { Activity, CheckCircle2, ChevronDown, ChevronRight, Clock, Loader2, XCircle } from 'lucide-react';
import type { PipelineTraceStep } from '../../types/api';
import { Keycap } from '../ui/Primitives';
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
    <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/70 dark:bg-[#121622]/60 overflow-hidden shadow-2xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-white dark:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-slate-400 shrink-0">
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-slate-100 font-display">
              Multi-Agent Workflow Trace
            </span>
            <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
              {isRunning
                ? `Running Node: ${steps[steps.length - 1]?.label ?? 'Pipeline'}...`
                : `${completedCount} of ${steps.length} nodes completed`}
            </span>
          </div>
        </div>

        {!isRunning && totalMs > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Clock className="w-3 h-3 text-slate-400" />
            <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
              {totalMs >= 1000 ? `${(totalMs / 1000).toFixed(2)}s` : `${totalMs}ms`}
            </span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3.5 pt-2 border-t border-slate-200/80 dark:border-white/[0.06] bg-white/60 dark:bg-black/20">
          <div className="space-y-2">
            {steps.map((step, idx) => (
              <div
                key={`${step.node}-${idx}`}
                className="flex items-start justify-between gap-4 text-xs py-1.5 px-2 rounded-lg hover:bg-slate-100/50 dark:hover:bg-white/[0.02] transition-colors"
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
                      <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'font-medium tracking-tight',
                          step.status === 'failed'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-900 dark:text-slate-200'
                        )}
                      >
                        {step.label}
                      </span>
                      <Keycap className="h-4 text-[9px] px-1">{step.node}</Keycap>
                    </div>
                    {step.detail && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 break-words font-sans">
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
                {typeof step.durationMs === 'number' && step.durationMs > 0 && (
                  <span className="font-mono tabular-nums text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                    {step.durationMs}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
