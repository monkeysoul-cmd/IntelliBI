import React, { useState } from 'react';
import { Check, Copy, ShieldAlert, ShieldCheck, Terminal } from 'lucide-react';
import type { SqlValidationPayload } from '../../types/api';
import { Badge } from '../ui/Primitives';

interface SqlViewerProps {
  sql: string;
  explanation?: string | null;
  validation?: SqlValidationPayload | null;
  executionTimeMs?: number;
  rowCount?: number;
  retryCount?: number;
}

export function SqlViewer({
  sql,
  explanation,
  validation,
  executionTimeMs,
  rowCount,
  retryCount,
}: SqlViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback
    }
  };

  const isPassed = validation?.isValid !== false;

  return (
    <div className="rounded-xl border border-slate-200/90 dark:border-white/[0.08] overflow-hidden bg-[#0A0D14] text-slate-200 shadow-sm">
      {/* Terminal Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[#0E121B] border-b border-white/[0.07] text-xs select-none">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mac-style subtle dots */}
          <div className="flex items-center gap-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <div className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px]">
            <Terminal className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-semibold text-slate-100">SQL AST</span>
          </div>

          <span className="text-white/20" aria-hidden="true">
            ·
          </span>

          <Badge variant={isPassed ? 'emerald' : 'rose'} dot>
            {isPassed ? 'Read-only verified' : 'Blocked by AST guard'}
          </Badge>

          {typeof executionTimeMs === 'number' && executionTimeMs > 0 && (
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {executionTimeMs}ms
            </span>
          )}

          {typeof rowCount === 'number' && (
            <span className="font-mono tabular-nums text-[11px] text-slate-400">
              {rowCount} {rowCount === 1 ? 'row' : 'rows'}
            </span>
          )}

          {typeof retryCount === 'number' && retryCount > 0 && (
            <Badge variant="amber">
              {retryCount} self-correction{retryCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy SQL query"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium font-mono text-slate-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-slate-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="p-3.5 overflow-x-auto">
        <pre className="font-mono text-xs leading-relaxed text-blue-100/90 selection:bg-blue-600/30">
          <code>{sql}</code>
        </pre>
      </div>

      {explanation && (
        <div className="px-3.5 py-2 bg-white/[0.02] border-t border-white/[0.05] text-[11px] text-slate-400">
          <span className="font-semibold text-slate-300">Plan:</span> {explanation}
        </div>
      )}
    </div>
  );
}
