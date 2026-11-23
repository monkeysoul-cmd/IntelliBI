import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, Database, KeyRound, Link2, ShieldCheck, Table2 } from 'lucide-react';
import { databaseApi } from '../services/api';
import type {
  DatabaseStatusInfo,
  SchemaRelationship,
  TableSchemaInfo,
} from '../types/api';
import { Badge, Button, Keycap, Skeleton, Surface } from '../components/ui/Primitives';
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
      {/* Page Header */}
      <div className="pb-2 border-b border-slate-200/80 dark:border-white/[0.06]">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight font-display">
          Database Intelligence
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Live PostgreSQL schema metadata, relational constraints, and read-only AST analytics guardrails
        </p>
      </div>

      {/* Connection Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Surface className="p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Database Engine</span>
            <Database className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono">
            {status ? `${status.version}` : 'Connecting...'}
          </p>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>Connected · Latency {status?.latencyMs ?? 0}ms</span>
          </div>
        </Surface>

        <Surface className="p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Analytics Tables</span>
            <Table2 className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {status ? status.tableCount : '—'}
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            {status ? `${formatNumber(status.totalRecords)} records indexed` : ''}
          </p>
        </Surface>

        <Surface className="p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Guardrail Architecture</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <p className="text-xs font-semibold text-slate-900 dark:text-white font-mono">
            Read-Only Transaction + AST
          </p>
          <p className="text-[11px] text-slate-400">
            DDL / DML modification prohibited
          </p>
        </Surface>

        <Surface className="p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium">Foreign Key Graph</span>
            <Link2 className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {relationships.length}
          </p>
          <p className="text-[11px] text-slate-400">
            Auto-resolved multi-table joins
          </p>
        </Surface>
      </div>

      {/* Main Schema Explorer Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Table Selector Column */}
        <Surface className="lg:col-span-4 p-3.5 space-y-2">
          <div className="px-2 pb-1 text-[11px] font-mono uppercase text-slate-400 tracking-wider">
            Exposed Schema Tables
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
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
                    'w-full px-3 py-2 rounded-lg text-left transition-all cursor-pointer flex items-center justify-between gap-2',
                    selectedTable === t.name
                      ? 'bg-slate-900/[0.05] text-slate-950 font-semibold dark:bg-white/[0.08] dark:text-white border border-slate-200/80 dark:border-white/[0.08]'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/[0.04]'
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-medium truncate">{t.name}</p>
                    <span className="text-[10px] text-slate-400 font-sans">
                      {t.columns.length} columns
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                    {formatNumber(t.rowCount)} rows
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Relationships Graph */}
          <div className="pt-3.5 mt-2 border-t border-slate-100 dark:border-white/[0.06] px-2 space-y-2">
            <span className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">
              Entity Relationships
            </span>
            <div className="space-y-1.5 text-[11px] font-mono">
              {relationships.map((rel) => (
                <div
                  key={rel.constraintName}
                  className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5 flex-wrap"
                >
                  <span className="text-slate-800 dark:text-slate-200">
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
        <div className="lg:col-span-8 space-y-4">
          {activeSchema && (
            <Surface className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold font-mono text-slate-900 dark:text-white">
                      public.{activeSchema.name}
                    </h2>
                    <Badge variant="blue">{activeSchema.columns.length} Columns</Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {activeSchema.description}
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="primary"
                  onClick={() =>
                    navigate(
                      `/analyst?q=${encodeURIComponent(
                        `Summarize key metrics, averages, and outliers from the ${activeSchema.name} table.`
                      )}`
                    )
                  }
                >
                  <Bot className="w-3 h-3" />
                  <span>Analyze in AI</span>
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/[0.06] text-[11px] font-mono text-slate-400">
                      <th className="py-2 pr-4 font-medium">Column</th>
                      <th className="py-2 px-3 font-medium">Data Type</th>
                      <th className="py-2 px-3 font-medium">Nullable</th>
                      <th className="py-2 pl-3 font-medium">Index / Constraint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/70 dark:divide-white/[0.04] text-xs">
                    {activeSchema.columns.map((col) => (
                      <tr key={col.name} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                        <td className="py-2 pr-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                          {col.name}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500 dark:text-slate-400">
                          {col.dataType}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {col.isNullable ? 'NULL' : 'NOT NULL'}
                        </td>
                        <td className="py-2 pl-3 font-mono">
                          {col.isPrimaryKey && (
                            <Badge variant="amber" dot>
                              PRIMARY KEY
                            </Badge>
                          )}
                          {col.foreignKey && (
                            <span className="text-[11px] text-blue-600 dark:text-blue-400">
                              FK → {col.foreignKey.referencesTable}.{col.foreignKey.referencesColumn}
                            </span>
                          )}
                          {!col.isPrimaryKey && !col.foreignKey && (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Surface>
          )}

          {/* Sample Data Preview */}
          <Surface className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white font-display">
                  Sample Record Preview
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Read-only snapshot of the first 12 records
                </p>
              </div>
              {preview && (
                <span className="text-[11px] font-mono tabular-nums text-slate-400">
                  {preview.executionTimeMs}ms
                </span>
              )}
            </div>

            {loadingPreview ? (
              <Skeleton className="h-40 w-full" />
            ) : preview && preview.rows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200/80 dark:border-white/[0.07]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-700 dark:text-slate-300 border-b border-slate-200/80 dark:border-white/[0.07]">
                    <tr>
                      {preview.columns.map((c) => (
                        <th key={c} className="py-2 px-3 whitespace-nowrap font-mono font-medium text-[11px]">
                          {formatColumnHeader(c)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                    {preview.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                        {preview.columns.map((c) => (
                          <td
                            key={c}
                            className={cn(
                              'py-1.5 px-3 whitespace-nowrap text-slate-800 dark:text-slate-200',
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
              <p className="text-xs text-slate-400">No preview records returned.</p>
            )}
          </Surface>
        </div>
      </div>
    </div>
  );
}
