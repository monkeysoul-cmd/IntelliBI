import React, { useState } from 'react';
import { Check, Copy, ShieldAlert, ShieldCheck, Terminal } from 'lucide-react';
import type { SqlValidationPayload } from '../../types/api';

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
      // Fallback ignored
    }
  };

  const isPassed = validation?.isValid !== false;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-900 border-b border-slate-800 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-300">
          <Terminal className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-100">PostgreSQL</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span
            className={
              isPassed
                ? 'inline-flex items-center gap-1 text-emerald-400 font-medium'
                : 'inline-flex items-center gap-1 text-red-400 font-medium'
            }
          >
            {isPassed ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                Read-only AST verified
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                Blocked by validator
              </>
            )}
          </span>
          {typeof executionTimeMs === 'number' && executionTimeMs > 0 && (
            <>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-400">
                {executionTimeMs}ms
              </span>
            </>
          )}
          {typeof rowCount === 'number' && (
            <>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-400">
                {rowCount} {rowCount === 1 ? 'row' : 'rows'}
              </span>
            </>
          )}
          {typeof retryCount === 'number' && retryCount > 0 && (
            <>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="text-amber-400 font-mono tabular-nums">
                {retryCount} {retryCount === 1 ? 'auto-retry' : 'auto-retries'}
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy generated SQL"
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy SQL
            </>
          )}
        </button>
      </div>

      <pre className="p-3.5 text-xs font-mono leading-relaxed overflow-x-auto text-slate-200">
        <code>{sql}</code>
      </pre>

      {explanation && (
        <div className="px-3.5 py-2.5 border-t border-slate-800/90 bg-slate-900/60 text-xs text-slate-400">
          {explanation}
        </div>
      )}
    </div>
  );
}
