import { ThinkingLevel, Type } from '@google/genai';
import { getActiveModelName, getGeminiClient, withGeminiRetry } from '../core/gemini.ts';
import type {
  ConversationTurn,
  QueryAnalysisResult,
  SchemaContextResult,
} from './types.ts';

export interface GeneratedSqlPayload {
  sql: string;
  explanation: string;
}

/**
 * Node 3: SQL Generation Agent
 * Generates valid, optimized PostgreSQL SELECT SQL grounded exclusively in the verified schema.
 */
export async function generateSqlQuery(
  question: string,
  analysis: QueryAnalysisResult,
  schemaContext: SchemaContextResult,
  conversationHistory: ConversationTurn[],
  maxRows: number
): Promise<GeneratedSqlPayload> {
  const ai = getGeminiClient();
  const model = getActiveModelName();

  const historyBlock =
    conversationHistory.length > 0
      ? conversationHistory
          .slice(-3)
          .map(
            (turn, idx) =>
              `Previous Turn ${idx + 1}:\nQuestion: ${turn.question}\nSQL: ${turn.generatedSql ?? 'N/A'}`
          )
          .join('\n\n')
      : 'None.';

  const prompt = `Generate a single PostgreSQL read-only SELECT query to answer the user's business question.

${schemaContext.formattedSchema}

Business Metric Definitions:
${schemaContext.businessMetricsNotes.map((n) => `- ${n}`).join('\n')}

Analyzed Intent:
- Metrics: ${analysis.metrics.join(', ') || 'inferred from question'}
- Dimensions: ${analysis.dimensions.join(', ') || 'none'}
- Filters: ${analysis.filters.join(', ') || 'none'}
- Time Range: ${analysis.timeRange || 'not specified'}

Conversation History:
${historyBlock}

User Question:
"""
${question}
"""

Strict PostgreSQL Rules:
1. Return ONLY a single read-only SELECT statement (or WITH ... SELECT CTE). Never generate INSERT, UPDATE, DELETE, DROP, ALTER, or multiple statements.
2. Use ONLY tables and columns explicitly listed in the schema above. Never invent column names.
3. Current business date is 2026-11-20. Use DATE '2026-11-20' (not CURRENT_DATE) when interpreting relative dates like "this month", "last quarter", or "previous year" so results align accurately with the dataset.
4. For time trends, format periods cleanly using TO_CHAR(DATE_TRUNC('month', order_date), 'YYYY-MM') or TO_CHAR(DATE_TRUNC('quarter', order_date), 'YYYY-"Q"Q') and ORDER BY period ASC.
5. Cast monetary totals with ROUND(SUM(...)::numeric, 2) and give clear snake_case aliases (e.g. total_revenue, order_count, avg_order_value).
6. Include an explicit LIMIT <= ${maxRows} on multi-row queries.
7. Exclude cancelled orders (order_status <> 'Cancelled') when measuring revenue or sales unless the user explicitly asks about cancellations or order statuses.`;

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are Node 3 (SQL Generation Agent) for IntelliBI. You write accurate, clean PostgreSQL queries strictly adhering to the provided schema. Return valid JSON matching the schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sql: {
              type: Type.STRING,
              description: 'A single valid PostgreSQL SELECT query without markdown fences.',
            },
            explanation: {
              type: Type.STRING,
              description: 'Clear 1-2 sentence human-readable explanation of what the query calculates.',
            },
          },
          required: ['sql', 'explanation'],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<GeneratedSqlPayload>;
  return {
    sql: (parsed.sql ?? '').trim(),
    explanation: (parsed.explanation ?? 'Executes a read-only PostgreSQL query against the analytics dataset.').trim(),
  };
}

/**
 * Node 6: SQL Correction Agent
 * Analyzes PostgreSQL execution or validation errors and produces a corrected read-only query.
 */
export async function correctSqlQuery(
  question: string,
  failedSql: string,
  errorMessage: string,
  schemaContext: SchemaContextResult,
  maxRows: number,
  attemptNumber: number
): Promise<GeneratedSqlPayload> {
  const ai = getGeminiClient();
  const model = getActiveModelName();

  const prompt = `A previously generated PostgreSQL query failed validation or execution (Retry attempt ${attemptNumber} of 2). Fix the query using ONLY the verified schema below.

${schemaContext.formattedSchema}

Original User Question:
"""
${question}
"""

Failed SQL:
${failedSql}

Error Reported:
${errorMessage}

Fix Requirements:
1. Resolve the exact PostgreSQL or validation error above.
2. Use ONLY tables in [customers, products, orders, order_items, payments] and their exact column names.
3. Ensure the query is a single read-only SELECT (or WITH ... SELECT) with LIMIT <= ${maxRows}.
4. Do not repeat the same syntax or column error.`;

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are Node 6 (SQL Correction Agent) for IntelliBI. Fix the broken PostgreSQL query cleanly using only verified schema columns. Return valid JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sql: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ['sql', 'explanation'],
        },
      },
    })
  );

  const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<GeneratedSqlPayload>;
  return {
    sql: (parsed.sql ?? '').trim(),
    explanation: (parsed.explanation ?? 'Corrected PostgreSQL query after analyzing the execution error.').trim(),
  };
}
