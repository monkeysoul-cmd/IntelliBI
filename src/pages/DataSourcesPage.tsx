import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot } from 'lucide-react';
import { databaseApi } from '../services/api';
import type {
  DatabaseStatusInfo,
  SchemaRelationship,
  TableSchemaInfo,
} from '../types/api';
import { Badge, Button, Skeleton, Surface } from '../components/ui/Primitives';
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
        setTables(schemaRes.tables ?? []);
        setRelationships(schemaRes.relationships ?? []);
        if (schemaRes.tables?.length > 0 && !schemaRes.tables.some((t) => t.name === selectedTable)) {
          setSelectedTable(schemaRes.tables[0].name);
        }
      })
      .catch((err) => {
        console.error('Failed to load database schema', err);
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
          <div className="pb-4 border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
            <h1 className="text-2xl sm:text-3xl font-medium text-[#171717] dark:text-[#ededed]">
              Data sources
            </h1>
              <p className="text-sm text-[#737373] dark:text-[#85858b] mt-1">
                PostgreSQL schema metadata, foreign-key constraints, and read-only guardrails
              </p>
          </div>

          {/* Connection Summary Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Surface className="p-5 space-y-2">
                    <span className="text-xs text-[#737373] dark:text-[#85858b] block">Database engine</span>
                    <p className="text-sm font-medium text-[#171717] dark:text-[#ededed] font-mono">
                      {status ? `${status.version}` : 'Connecting...'}
                    </p>
                      <div className="flex items-center gap-2 text-xs font-mono text-[#16a34a] dark:text-[#4cc38a]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] dark:bg-[#4cc38a] shrink-0" />
                        <span>Connected · {status?.latencyMs ?? 0}ms</span>
                      </div>
                  </Surface>

                      <Surface className="p-5 space-y-2">
                        <span className="text-xs text-[#737373] dark:text-[#85858b] block">Analytics tables</span>
                        <p className="text-2xl font-medium font-mono tabular-nums text-[#171717] dark:text-[#ededed]">
                          {status ? status.tableCount : '—'}
                        </p>
                          <p className="text-xs text-[#737373] dark:text-[#85858b] font-mono tabular-nums">
                            {status ? `${formatNumber(status.totalRecords)} records indexed` : '—'}
                          </p>
                      </Surface>

                          <Surface className="p-5 space-y-2">
                            <span className="text-xs text-[#737373] dark:text-[#85858b] block">Guardrail policy</span>
                            <p className="text-sm font-medium text-[#171717] dark:text-[#ededed] font-mono">
                              Read-only + AST
                            </p>
                              <p className="text-xs text-[#737373] dark:text-[#85858b]">
                                DDL and DML statements blocked
                              </p>
                          </Surface>

                              <Surface className="p-5 space-y-2">
                                <span className="text-xs text-[#737373] dark:text-[#85858b] block">Foreign-key graph</span>
                                <p className="text-2xl font-medium font-mono tabular-nums text-[#171717] dark:text-[#ededed]">
                                  {relationships.length}
                                </p>
                                  <p className="text-xs text-[#737373] dark:text-[#85858b]">
                                    Verified multi-table joins
                                  </p>
                              </Surface>
                            </div>

                            {/* Main Schema Explorer Split */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                              {/* Table Selector Column */}
                                  <Surface className="lg:col-span-4 p-4 space-y-3">
                                    <div className="px-2 text-xs text-[#737373] dark:text-[#85858b]">
                                      Analytics tables
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
                                              'w-full px-3 py-2 rounded-lg text-left transition-colors duration-150 cursor-pointer flex items-center justify-between gap-2',
                                              selectedTable === t.name
                                                  ? 'bg-[#f4f4f5] text-[#171717] font-medium dark:bg-[#232325] dark:text-[#ededed]'
                                                  : 'text-[#525252] dark:text-[#a1a1a6] hover:bg-[#f4f4f5]/60 dark:hover:bg-[#232325]/60'
                                            )}
                                          >
                                            <div className="min-w-0">
                                              <p className="text-xs font-mono font-medium truncate">{t.name}</p>
                                                <span className="text-xs text-[#737373] dark:text-[#85858b]">
                                                  {t.columns.length} columns
                                                </span>
                                            </div>
                                              <span className="text-xs font-mono tabular-nums text-[#737373] dark:text-[#85858b] shrink-0">
                                                {formatNumber(t.rowCount)} rows
                                              </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}

                                    {/* Relationships Graph */}
                                        <div className="pt-4 border-t border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] px-2 space-y-2">
                                          <span className="text-xs text-[#737373] dark:text-[#85858b] block">
                                            Entity relationships
                                          </span>
                                            <div className="space-y-2 text-xs font-mono">
                                              {relationships.map((rel) => (
                                                <div
                                                  key={rel.constraintName}
                                                  className="text-[#525252] dark:text-[#a1a1a6] flex items-center gap-1.5 flex-wrap"
                                                >
                                                    <span className="text-[#171717] dark:text-[#ededed]">
                                                      {rel.fromTable}.{rel.fromColumn}
                                                    </span>
                                                      <ArrowRight className="w-3.5 h-3.5 text-[#737373] shrink-0" strokeWidth={1.5} />
                                                      <span className="text-[#2563eb] dark:text-[#3b82f6]">
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
                                                  <Surface className="p-6 space-y-4">
                                                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
                                                      <div>
                                                        <div className="flex items-center gap-2">
                                                            <h2 className="text-base font-medium font-mono text-[#171717] dark:text-[#ededed]">
                                                              public.{activeSchema.name}
                                                            </h2>
                                                            <Badge variant="neutral">{activeSchema.columns?.length ?? 0} columns</Badge>
                                                        </div>
                                                          <p className="text-xs text-[#737373] dark:text-[#85858b] mt-1">
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
                                                        <Bot className="w-4 h-4" strokeWidth={1.5} />
                                                        <span>Analyze table</span>
                                                      </Button>
                                                    </div>

                                                    <div className="overflow-x-auto">
                                                      <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] text-xs font-mono text-[#737373] dark:text-[#85858b]">
                                                              <th className="py-2 pr-4 font-normal">Column</th>
                                                              <th className="py-2 px-3 font-normal">Type</th>
                                                              <th className="py-2 px-3 font-normal">Nullable</th>
                                                              <th className="py-2 pl-3 font-normal">Constraint</th>
                                                            </tr>
                                                        </thead>
                                                          <tbody className="divide-y divide-[#171717]/[0.06] dark:divide-[#ededed]/[0.06] text-xs">
                                                            {(activeSchema.columns ?? []).map((col) => (
                                                                  <tr
                                                                    key={col.name}
                                                                    className="hover:bg-[#fafafa] dark:hover:bg-[#232325]/40 transition-colors duration-150"
                                                                  >
                                                                    <td className="py-2.5 pr-4 font-mono font-medium text-[#171717] dark:text-[#ededed]">
                                                                      {col.name}
                                                                    </td>
                                                                      <td className="py-2.5 px-3 font-mono text-[#525252] dark:text-[#a1a1a6]">
                                                                        {col.dataType}
                                                                      </td>
                                                                        <td className="py-2.5 px-3 text-[#737373] dark:text-[#85858b] font-mono">
                                                                          {col.isNullable ? 'NULL' : 'NOT NULL'}
                                                                        </td>
                                                                          <td className="py-2.5 pl-3 font-mono">
                                                                            {col.isPrimaryKey && (
                                                                              <Badge variant="amber" dot>
                                                                                PRIMARY KEY
                                                                              </Badge>
                                                                            )}
                                                                            {col.foreignKey && (
                                                                                <span className="text-xs text-[#2563eb] dark:text-[#3b82f6]">
                                                                                  FK → {col.foreignKey.referencesTable}.{col.foreignKey.referencesColumn}
                                                                                </span>
                          )}
                                                                                {!col.isPrimaryKey && !col.foreignKey && (
                            <span className="text-[#737373] dark:text-[#85858b]">—</span>
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
                                                                    <Surface className="p-6 space-y-4">
                                                                      <div className="flex items-center justify-between gap-3">
                                                                        <div>
                                                                            <h3 className="text-sm font-medium text-[#171717] dark:text-[#ededed]">
                                                                              Sample records
                                                                            </h3>
                                                                              <p className="text-xs text-[#737373] dark:text-[#85858b] mt-0.5">
                                                                                First 12 rows (read-only)
                                                                              </p>
                                                                            </div>
                                                                            {preview && (
                                                                                <span className="text-xs font-mono tabular-nums text-[#737373] dark:text-[#85858b]">
                                                                                  {preview.executionTimeMs}ms
                                                                                </span>
              )}
                                                                              </div>

            {loadingPreview ? (
                                                                              <Skeleton className="h-40 w-full" />
                                                                            ) : preview && preview.rows && preview.rows.length > 0 ? (
                                                                                <div className="overflow-x-auto rounded-lg border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
                                                                                  <table className="w-full text-left border-collapse text-xs">
                                                                                      <thead className="bg-[#fafafa] dark:bg-[#141415] text-[#525252] dark:text-[#a1a1a6] border-b border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]">
                                                                                        <tr>
                                                                                          {(preview.columns ?? []).map((c) => (
                                                                                              <th key={c} className="py-2 px-3 whitespace-nowrap font-mono font-normal">
                                                                                                {formatColumnHeader(c)}
                                                                                              </th>
                      ))}
                                                                                            </tr>
                  </thead>
                                                                                        <tbody className="divide-y divide-[#171717]/[0.06] dark:divide-[#ededed]/[0.06]">
                                                                                          {(preview.rows ?? []).map((row, idx) => (
                                                                                              <tr
                                                                                                key={idx}
                                                                                                className="hover:bg-[#fafafa] dark:hover:bg-[#232325]/40 transition-colors duration-150"
                                                                                              >
                                                                                                {(preview.columns ?? []).map((c) => (
                                                                                                  <td
                                                                                                    key={c}
                                                                                                    className={cn(
                                                                                                      'py-2 px-3 whitespace-nowrap text-[#171717] dark:text-[#ededed]',
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
                                                                                      <p className="text-xs text-[#737373] dark:text-[#85858b]">No preview records returned</p>
            )}
                                                                                    </Surface>
                                                                                </div>
                                                                              </div>
    </div>
                                                                        );
}
