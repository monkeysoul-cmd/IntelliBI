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
      <div className="rounded-lg border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] bg-[#fafafa] dark:bg-[#141415] overflow-hidden">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-xs font-medium text-[#525252] dark:text-[#a1a1a6] hover:bg-[#f4f4f5] dark:hover:bg-[#232325]/60 transition-colors duration-150 cursor-pointer select-none"
        >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-4 h-4 flex items-center justify-center text-[#737373] dark:text-[#85858b] shrink-0">
                  {expanded ? (
              <ChevronDown className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                  )}
            </span>
            <Activity className="w-4 h-4 text-[#737373] dark:text-[#85858b] shrink-0" strokeWidth={1.5} />
            <span className="font-medium text-[#171717] dark:text-[#ededed]">
              Workflow trace
            </span>
            <span className="text-[#737373] dark:text-[#85858b]" aria-hidden="true">
              ·
            </span>
            <span className="text-[#737373] dark:text-[#85858b] font-normal truncate">
              {isRunning
                ? `Running ${steps[steps.length - 1]?.label ?? 'pipeline'}...`
                : `${completedCount} of ${steps.length} nodes completed`}
            </span>
          </div>

          {!isRunning && totalMs > 0 && (
                <div className="flex items-center gap-1.5 shrink-0 text-[#737373] dark:text-[#85858b]">
                  <Clock className="w-4 h-4" strokeWidth={1.5} />
                  <span className="font-mono tabular-nums text-xs">
                    {totalMs >= 1000 ? `${(totalMs / 1000).toFixed(2)}s` : `${totalMs}ms`}
                  </span>
                </div>
        )}
              </button>

              {expanded && (
                    <div className="px-4 py-3 border-t border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] bg-white dark:bg-[#19191b]">
                      <div className="space-y-1">
                        {steps.map((step, idx) => (
                          <div
                            key={`${step.node}-${idx}`}
                            className="flex items-start justify-between gap-4 text-xs py-2 px-2 rounded-md hover:bg-[#fafafa] dark:hover:bg-[#232325]/50 transition-colors duration-150"
                          >
                            <div className="flex items-start gap-2.5 min-w-0">
                                <span className="w-4 h-4 mt-0.5 flex items-center justify-center shrink-0">
                                  {step.status === 'running' && (
                      <Loader2 className="w-4 h-4 text-[#2563eb] dark:text-[#3b82f6] animate-spin" strokeWidth={1.5} />
                                  )}
                                  {step.status === 'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-[#16a34a] dark:text-[#4cc38a]" strokeWidth={1.5} />
                                  )}
                                  {step.status === 'failed' && (
                      <XCircle className="w-4 h-4 text-[#dc2626] dark:text-[#e5484d]" strokeWidth={1.5} />
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        'font-medium',
                                        step.status === 'failed'
                                            ? 'text-[#dc2626] dark:text-[#e5484d]'
                                            : 'text-[#171717] dark:text-[#ededed]'
                                      )}
                                    >
                                      {step.label}
                                    </span>
                                    <Keycap className="h-4 px-1 text-[10px]">{step.node}</Keycap>
                                  </div>
                                  {step.detail && (
                                      <p className="text-xs text-[#737373] dark:text-[#85858b] mt-1 break-words">
                                        {step.detail}
                                      </p>
                    )}
                                    </div>
                </div>
                                {typeof step.durationMs === 'number' && step.durationMs > 0 && (
                                    <span className="font-mono tabular-nums text-xs text-[#737373] dark:text-[#85858b] shrink-0">
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
