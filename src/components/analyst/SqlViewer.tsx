import React, { useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
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
      // Fallback ignored
    }
  };

  const isPassed = validation?.isValid !== false;

  return (
      <div className="rounded-lg border border-[#171717]/[0.1] dark:border-[#ededed]/[0.08] overflow-hidden bg-[#0f0f10] text-[#ededed]">
        {/* Terminal Title Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#161618] border-b border-[#ededed]/[0.08] text-xs select-none">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 text-[#a1a1a6] font-mono">
                  <Terminal className="w-4 h-4 text-[#85858b]" strokeWidth={1.5} />
                  <span className="font-medium text-[#ededed]">SQL AST</span>
                </div>

                  <span className="text-[#ededed]/20" aria-hidden="true">
                    ·
                  </span>

                  <Badge variant={isPassed ? 'emerald' : 'rose'} dot>
                    {isPassed ? 'Read-only verified' : 'Blocked by AST guard'}
                  </Badge>

                  {typeof executionTimeMs === 'number' && executionTimeMs > 0 && (
                      <span className="font-mono tabular-nums text-xs text-[#85858b]">
                        {executionTimeMs}ms
                      </span>
          )}

                      {typeof rowCount === 'number' && (
            <span className="font-mono tabular-nums text-xs text-[#85858b]">
              {rowCount} {rowCount === 1 ? 'row' : 'rows'}
            </span>
          )}

          {typeof retryCount === 'number' && retryCount > 0 && (
            <Badge variant="amber">
              {retryCount} correction{retryCount > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy SQL query"
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-mono text-[#a1a1a6] hover:text-[#ededed] bg-[#232325] hover:bg-[#2c2c2f] transition-colors duration-150 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#4cc38a]" strokeWidth={1.5} />
              <span className="text-[#4cc38a]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
                      <div className="p-4 overflow-x-auto">
                        <pre className="font-mono text-xs leading-relaxed text-[#ededed]/90 selection:bg-[#2563eb]/30">
                          <code>{sql}</code>
                        </pre>
                      </div>

                      {explanation && (
                          <div className="px-4 py-2.5 bg-[#141415] border-t border-[#ededed]/[0.06] text-xs text-[#a1a1a6]">
                            <span className="font-medium text-[#ededed]">Plan:</span> {explanation}
                          </div>
      )}
                        </div>
                      );
}
