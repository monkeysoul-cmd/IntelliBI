import { GoogleGenAI } from '@google/genai';
import { config } from './config.ts';

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add your Gemini API key in Settings > Secrets to run AI analysis.'
    );
  }
    if (!cachedClient || cachedApiKey !== apiKey) {
      cachedClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          timeout: 25000,
        },
      });
      cachedApiKey = apiKey;
    }
    return cachedClient;
  }

  export function parseGeminiJson<T>(rawText: string | undefined | null, fallback: T): T {
    const trimmed = (rawText ?? '').trim();
    if (!trimmed) return fallback;

    const unfenced = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      return JSON.parse(unfenced) as T;
    } catch {
      const firstBrace = unfenced.indexOf('{');
      const lastBrace = unfenced.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
          return JSON.parse(unfenced.slice(firstBrace, lastBrace + 1)) as T;
        } catch {
          return fallback;
        }
      }
      return fallback;
    }
  }

  export function getActiveModelName(): string {
    return process.env.GEMINI_MODEL || config.geminiModel;
  }

  export function hasGeminiKeyConfigured(): boolean {
    const apiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;
    return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
  }

  export async function withGeminiRetry<T>(
    operation: () => Promise<T>,
    maxAttempts = 2
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isRetryable =
          msg.includes('429') ||
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('ECONNRESET');
        if (!isRetryable || attempt === maxAttempts) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
      }
    }
    throw lastError;
  }
