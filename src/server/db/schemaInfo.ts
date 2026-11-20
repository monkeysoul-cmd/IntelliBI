import type { PGlite } from '@electric-sql/pglite';
import { config } from '../core/config.ts';

export interface ColumnMetadata {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  foreignKey?: {
    referencesTable: string;
    referencesColumn: string;
  };
}

export interface TableMetadata {
  name: string;
  description: string;
  rowCount: number;
  columns: ColumnMetadata[];
}

export interface RelationshipMetadata {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  constraintName: string;
}

export interface DatabaseSchemaSnapshot {
  dialect: 'PostgreSQL';
  engine: string;
  tables: TableMetadata[];
  relationships: RelationshipMetadata[];
}

const TABLE_DESCRIPTIONS: Record<string, string> = {
  customers:
    'Enterprise customer accounts including company name, contact email, city, geographic region, and acquisition timestamp.',
  products:
    'Product catalog containing SKU names, product categories, unit selling price, unit cost for gross margin analysis, and current inventory stock.',
  orders:
    'Customer purchase orders recording order date, fulfillment status (Completed, Shipped, Processing, Cancelled), and total order revenue.',
  order_items:
    'Order line items linking orders to specific products with quantities and unit selling prices for SKU-level revenue analysis.',
  payments:
    'Payment transactions associated with orders including payment method, settlement status, and settled amount.',
};

export async function inspectAnalyticsSchema(pg: PGlite): Promise<DatabaseSchemaSnapshot> {
  const allowedList = config.allowedAnalyticsTables.map((t) => `'${t}'`).join(', ');

  const colsRes = await pg.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `SELECT table_name, column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name IN (${allowedList})
     ORDER BY table_name, ordinal_position`
  );

  const pkRes = await pg.query<{ table_name: string; column_name: string }>(
    `SELECT kcu.table_name, kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     WHERE tc.constraint_type = 'PRIMARY KEY'
       AND tc.table_schema = 'public'
       AND kcu.table_name IN (${allowedList})`
  );

  const fkRes = await pg.query<{
    constraint_name: string;
    from_table: string;
    from_column: string;
    to_table: string;
    to_column: string;
  }>(
    `SELECT
       tc.constraint_name,
       kcu.table_name AS from_table,
       kcu.column_name AS from_column,
       ccu.table_name AS to_table,
       ccu.column_name AS to_column
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'
       AND kcu.table_name IN (${allowedList})`
  );

  const pkSet = new Set(pkRes.rows.map((r) => `${r.table_name}.${r.column_name}`));
  const fkMap = new Map<string, { referencesTable: string; referencesColumn: string }>();
  const relationships: RelationshipMetadata[] = [];

  for (const fk of fkRes.rows) {
    fkMap.set(`${fk.from_table}.${fk.from_column}`, {
      referencesTable: fk.to_table,
      referencesColumn: fk.to_column,
    });
    relationships.push({
      fromTable: fk.from_table,
      fromColumn: fk.from_column,
      toTable: fk.to_table,
      toColumn: fk.to_column,
      constraintName: fk.constraint_name,
    });
  }

  const tables: TableMetadata[] = [];
  for (const tableName of config.allowedAnalyticsTables) {
    const countRes = await pg.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${tableName}`
    );
    const tableCols = colsRes.rows
      .filter((c) => c.table_name === tableName)
      .map((c) => ({
        name: c.column_name,
        dataType: c.data_type,
        isNullable: c.is_nullable === 'YES',
        isPrimaryKey: pkSet.has(`${tableName}.${c.column_name}`),
        foreignKey: fkMap.get(`${tableName}.${c.column_name}`),
      }));

    tables.push({
      name: tableName,
      description: TABLE_DESCRIPTIONS[tableName] ?? '',
      rowCount: Number(countRes.rows[0]?.count ?? 0),
      columns: tableCols,
    });
  }

  return {
    dialect: 'PostgreSQL',
    engine: 'PostgreSQL 16 (Embedded PGlite)',
    tables,
    relationships,
  };
}

export function formatSchemaForPrompt(
  schema: DatabaseSchemaSnapshot,
  selectedTables?: string[]
): string {
  const tables = selectedTables?.length
    ? schema.tables.filter((t) => selectedTables.includes(t.name))
    : schema.tables;

  const lines: string[] = [
    'PostgreSQL Analytics Schema (strictly read-only):',
    'Current business reference date: 2026-11-20 (data spans 2024-12-01 through 2026-11-20).',
    'Note: Exclude cancelled orders (order_status <> \'Cancelled\') when calculating realized revenue unless asked about cancellations.',
    '',
  ];

  for (const t of tables) {
    lines.push(`TABLE ${t.name} (${t.rowCount} rows) — ${t.description}`);
    for (const c of t.columns) {
      const flags: string[] = [];
      if (c.isPrimaryKey) flags.push('PK');
      if (c.foreignKey) flags.push(`FK -> ${c.foreignKey.referencesTable}.${c.foreignKey.referencesColumn}`);
      if (!c.isNullable) flags.push('NOT NULL');
      lines.push(`  - ${c.name}: ${c.dataType}${flags.length ? ` [${flags.join(', ')}]` : ''}`);
    }
    lines.push('');
  }

  if (schema.relationships.length > 0) {
    lines.push('Foreign Key Relationships:');
    for (const rel of schema.relationships) {
      lines.push(`  - ${rel.fromTable}.${rel.fromColumn} = ${rel.toTable}.${rel.toColumn}`);
    }
  }

  return lines.join('\n');
}
