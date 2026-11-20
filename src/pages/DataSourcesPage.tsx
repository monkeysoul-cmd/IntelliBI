import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Database, KeyRound, Link2, ShieldCheck, Table2 } from 'lucide-react';
import { databaseApi } from '../services/api';
import type {
  DatabaseStatusInfo,
  SchemaRelationship,
  TableSchemaInfo,
} from '../types/api';
import { Button, Skeleton, Surface } from '../components/ui/Primitives';
import { formatCellValue, formatColumnHeader, formatNumber } from '../utils/formatters';
import { cn } from '../utils/cn';

export function DataSourcesPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<DatabaseStatusInfo | null>(null);
  const [tables, setTables] = useState<TableSchemaInfo[]>([]);
  const [relationships, setRelationships] = useState<SchemaRelationship[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('orders');
  const [preview, setPreview] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
    executionTimeMs: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([databaseApi.getStatus(), databaseApi.getSchema()])
      .then(([statusRes, schemaRes]) => {
        if (!active) return;
        setStatus(statusRes);
        setTables(schemaRes.tables);
        setRelationships(schemaRes.relationships);
        if (schemaRes.tables.length > 0 && !schemaRes.tables.some((t) => t.name === selectedTable)) {
          setSelectedTable(schemaRes.tables[0].name);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    let active = true;
    setLoadingPreview(true);
    databaseApi
      .getTablePreview(selectedTable)
      .then((res) => {
        if (active) setPreview(res);
      })
      .catch(() => {
        if (active) setPreview(null);
      })
      .finally(() => {
        if (active) setLoadingPreview(false);
      });
    return () => {
      active = false;
    };
  }, [selectedTable]);

  const activeSchema = tables.find((t) => t.name === selectedTable) ?? tables[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Database Intelligence
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Live PostgreSQL schema metadata, foreign-key relationships, and read-only analytics guardrails used by the Schema Intelligence Agent.
        </p>
      </div>

      {/* Connection Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Surface className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Engine Status</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
            {status ? `${status.version} · Connected` : 'Connecting...'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
            {status ? `Latency ${status.latencyMs}ms` : 'Checking engine'}
          </p>
        </Surface>

        <Surface className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Table2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Exposed Analytics Tables</span>
          </div>
          <p className="mt-2 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {status ? status.tableCount : '—'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
            {status ? `${formatNumber(status.totalRecords)} total records` : ''}
          </p>
        </Surface>

        <Surface className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Execution Guardrails</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
            Read-Only Transaction + AST
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            DDL/DML & internal tables blocked
          </p>
        </Surface>

        <Surface className="p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Link2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Foreign Key Relations</span>
          </div>
          <p className="mt-2 text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {relationships.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Auto-mapped for multi-table joins
          </p>
        </Surface>
      </div>

      {/* Main Schema Explorer Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Table List */}
        <Surface className="lg:col-span-4 p-4 space-y-2">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 pb-1">
            Analytics Schema Tables
          </h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {tables.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setSelectedTable(t.name)}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer flex items-center justify-between gap-2',
                    selectedTable === t.name
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/12 dark:text-blue-400'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                  )}
                >
                  <div>
                    <p className="text-sm font-mono font-semibold">{t.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.columns.length} columns
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {formatNumber(t.rowCount)} rows
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Relationships Summary */}
          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 px-2 space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Table Relationships
            </h3>
            <div className="space-y-2 text-xs font-mono">
              {relationships.map((rel) => (
                <div
                  key={rel.constraintName}
                  className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5 flex-wrap"
                >
                  <span>
                    {rel.fromTable}.{rel.fromColumn}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="text-blue-600 dark:text-blue-400">
                    {rel.toTable}.{rel.toColumn}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Surface>

        {/* Active Table Columns + Sample Data Preview */}
        <div className="lg:col-span-8 space-y-6">
          {activeSchema && (
            <Surface className="p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    public.{activeSchema.name}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {activeSchema.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    navigate(
                      `/analyst?q=${encodeURIComponent(
                        `Summarize key trends and top metrics from the ${activeSchema.name} table.`
                      )}`
                    )
                  }
                >
                  Analyze Table
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-4">Column</th>
                      <th className="py-2 px-3">PostgreSQL Type</th>
                      <th className="py-2 px-3">Nullable</th>
                      <th className="py-2 pl-3">Key / Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                    {activeSchema.columns.map((col) => (
                      <tr key={col.name}>
                        <td className="py-2.5 pr-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                          {col.name}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {col.dataType}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                          {col.isNullable ? 'Nullable' : 'Not null'}
                        </td>
                        <td className="py-2.5 pl-3 font-mono text-slate-600 dark:text-slate-300">
                          {col.isPrimaryKey && (
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                              <KeyRound className="w-3 h-3" />
                              PRIMARY KEY
                            </span>
                          )}
                          {col.foreignKey && (
                            <span className="text-blue-600 dark:text-blue-400">
                              FK → {col.foreignKey.referencesTable}.{col.foreignKey.referencesColumn}
                            </span>
                          )}
                          {!col.isPrimaryKey && !col.foreignKey && (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          )}

          {/* Live Read-Only Sample Preview */}
          <Surface className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Sample Records Preview
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  First 12 rows fetched via read-only PostgreSQL transaction
                </p>
              </div>
              {preview && (
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {preview.executionTimeMs}ms
                </span>
              )}
            </div>

            {loadingPreview ? (
              <Skeleton className="h-44 w-full" />
            ) : preview && preview.rows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {preview.columns.map((c) => (
                        <th key={c} className="py-2 px-3 whitespace-nowrap">
                          {formatColumnHeader(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                    {preview.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        {preview.columns.map((c) => (
                          <td
                            key={c}
                            className={cn(
                              'py-2 px-3 whitespace-nowrap text-slate-700 dark:text-slate-200',
                              typeof row[c] === 'number' && 'font-mono tabular-nums text-right'
                            )}
                          >
                            {formatCellValue(c, row[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No preview rows available.</p>
            )}
          </Surface>
        </div>
      </div>
    </div>
  );
}
