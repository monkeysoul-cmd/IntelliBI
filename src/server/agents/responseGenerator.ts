import { ThinkingLevel, Type } from '@google/genai';
import { getActiveModelName, getGeminiClient, parseGeminiJson, withGeminiRetry } from '../core/gemini.ts';
import type { DataAnalysisResult, VisualizationConfig } from './types.ts';

export interface GeneratedBusinessResponse {
  answer: string;
  insights: string[];
  recommendations: string[];
}

/**
 * Node 9: Response Generation Agent
 * Produces an executive natural-language response strictly grounded in the actual
 * PostgreSQL result rows and deterministic statistics computed by Node 7.
 */
export async function generateFinalResponse(
  question: string,
  executedSql: string,
  rows: Record<string, unknown>[],
  dataAnalysis: DataAnalysisResult,
  visualization: VisualizationConfig
): Promise<GeneratedBusinessResponse> {
  if (rows.length === 0) {
    return {
      answer:
        'The query ran safely against PostgreSQL, but no matching records were found for the specified criteria. Try widening the time range or removing a filter.',
      insights: dataAnalysis.insights,
      recommendations: [
        'Verify the date range (dataset covers December 2024 through November 2026).',
        'Try removing narrow category or region filters to inspect the broader baseline.',
      ],
    };
  }

  const ai = getGeminiClient();
  const model = getActiveModelName();

  // Bound row sample passed to LLM so tokens stay fast and focused
  const sampleRows = rows.slice(0, 20);

  const prompt = `Write a concise, executive-grade business intelligence answer strictly grounded in the real PostgreSQL query results below.

User Question:
"""
${question}
"""

Executed SQL:
${executedSql}

Deterministic Statistical Findings (verified math):
${JSON.stringify(dataAnalysis.columnStats, null, 2)}

Detected Insights & Anomalies:
${JSON.stringify(dataAnalysis.insights, null, 2)}

Returned Rows (showing ${sampleRows.length} of ${rows.length} total rows):
${JSON.stringify(sampleRows, null, 2)}

Selected Visualization: ${visualization.chartType} (${visualization.title})

Strict Rules:
1. NEVER invent or extrapolate numbers that are not present in the Returned Rows or Statistical Findings above.
2. Answer directly in 2-4 clear sentences citing exact figures (formatted cleanly, e.g., $124,500.00 or 18.4%).
3. Provide 2-4 crisp bullet insights grounded in the rows.
4. Provide 1-2 actionable business recommendations directly supported by the data.`;

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        systemInstruction:
          'You are Node 9 (Response Generation Agent) for IntelliBI. Synthesize clear, accurate business narratives strictly grounded in database outputs. Return valid JSON.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: {
              type: Type.STRING,
              description: 'Executive summary paragraph answering the user question with exact figures.',
            },
            insights: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2 to 4 concise, data-backed observations.',
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '1 to 2 practical business recommendations.',
            },
          },
          required: ['answer', 'insights', 'recommendations'],
        },
      },
    })
  );

  const parsed = parseGeminiJson<Partial<GeneratedBusinessResponse>>(response.text, {});
  return {
    answer:
      parsed.answer?.trim() ||
      dataAnalysis.insights.join(' ') ||
      `Returned ${rows.length} records from PostgreSQL.`,
    insights:
      Array.isArray(parsed.insights) && parsed.insights.length > 0
        ? parsed.insights
        : dataAnalysis.insights,
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
  };
}
