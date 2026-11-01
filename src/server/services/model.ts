import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { sanitizeObject } from '../lib/sanitize.js';
import { SYSTEM_INSTRUCTION } from '../prompts/plan.js';

export const FIRST_CHUNK_TIMEOUT_MS = 5_000;
export const IDLE_TIMEOUT_MS = 10_000;
export const MODEL_TIMEOUT_MS = 30_000;
const DEFAULT_MODELS = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
];
const cooldowns = new Map<string, number>();

export class AiResponseInvalidError extends Error {
  constructor() {
    super('AI_RESPONSE_INVALID');
    this.name = 'AiResponseInvalidError';
  }
}
export class ModelTimeoutError extends Error {
  constructor() {
    super('Model response timed out');
    this.name = 'ModelTimeoutError';
  }
}
export interface AiCallContext {
  signal?: AbortSignal;
  onProgress?: (text: string) => void;
}
export type ModelCallContext = AiCallContext;
export interface ModelRequest {
  model: string;
  prompt: string;
  systemInstruction: string;
  jsonSchema: Record<string, unknown>;
  signal: AbortSignal;
}
export type ModelTransport = (request: ModelRequest) => Promise<AsyncIterable<string>>;

const sdkTransport: ModelTransport = async (request) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
  const stream = await ai.models.generateContentStream({
    model: request.model,
    contents: request.prompt,
    config: {
      systemInstruction: request.systemInstruction,
      responseMimeType: 'application/json',
      responseJsonSchema: request.jsonSchema,
      abortSignal: request.signal,
      temperature: 0.5,
    },
  });
  return (async function* () {
    for await (const chunk of stream) {
      // Private model reasoning is never forwarded to the browser or accumulated.
      yield (chunk.candidates?.[0]?.content?.parts ?? [])
        .filter((part) => !part.thought)
        .map((part) => part.text ?? '')
        .join('');
    }
  })();
};
let transport: ModelTransport = sdkTransport;

/** Deterministic transport injection keeps model/error/watchdog tests offline. */
export function setModelTransport(next?: ModelTransport): void {
  transport = next ?? sdkTransport;
  cooldowns.clear();
}
export function modelChain(): string[] {
  return [
    ...new Set([
      ...(process.env.GEMINI_MODEL ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
      ...DEFAULT_MODELS,
    ]),
  ];
}
function cooldownFor(error: unknown): number {
  if (error instanceof ModelTimeoutError) return 300_000;
  const status =
    typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 0;
  if (status === 429) return 60_000;
  if (status === 404) return 3_600_000;
  return 30_000;
}

async function consume(
  request: Omit<ModelRequest, 'signal'>,
  context: AiCallContext,
  remainingMs: number,
): Promise<string> {
  const controller = new AbortController();
  let watchdog: ReturnType<typeof setTimeout>;
  let rejectAbort!: (error: Error) => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const abort = () => {
    const reason: unknown = context.signal?.reason;
    controller.abort(reason);
    rejectAbort(new DOMException('Request cancelled', 'AbortError'));
  };
  const timeout = () => {
    controller.abort();
    rejectAbort(new ModelTimeoutError());
  };
  const overall = setTimeout(timeout, Math.min(MODEL_TIMEOUT_MS, remainingMs));
  watchdog = setTimeout(timeout, FIRST_CHUNK_TIMEOUT_MS);
  context.signal?.addEventListener('abort', abort, { once: true });
  if (context.signal?.aborted) abort();
  try {
    const read = async () => {
      const chunks = await transport({ ...request, signal: controller.signal });
      let output = '';
      for await (const chunk of chunks) {
        controller.signal.throwIfAborted();
        clearTimeout(watchdog);
        watchdog = setTimeout(timeout, IDLE_TIMEOUT_MS);
        output += chunk;
        if (output.length > 1_000_000) throw new AiResponseInvalidError();
      }
      return output;
    };
    return await Promise.race([read(), aborted]);
  } finally {
    clearTimeout(watchdog);
    clearTimeout(overall);
    context.signal?.removeEventListener('abort', abort);
  }
}

export async function callModel<T>(
  options: AiCallContext & {
    schema: z.ZodType<T>;
    prompt: string;
    systemInstruction?: string;
  },
): Promise<{ data: T; model: string } | null> {
  options.signal?.throwIfAborted();
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your-gemini-api-key-here') return null;
  const deadline = Date.now() + MODEL_TIMEOUT_MS;
  let invalidResponse = false;
  for (const model of modelChain()) {
    if ((cooldowns.get(model) ?? 0) > Date.now()) continue;
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    options.onProgress?.('Preparing a structured answer using the current plan.');
    try {
      const raw = await consume(
        {
          model,
          prompt: options.prompt,
          systemInstruction: `${SYSTEM_INSTRUCTION}\n${options.systemInstruction ?? ''}`,
          jsonSchema: z.toJSONSchema(options.schema),
        },
        options,
        remaining,
      );
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new AiResponseInvalidError();
      }
      const checked = options.schema.safeParse(sanitizeObject(parsed));
      if (!checked.success) throw new AiResponseInvalidError();
      options.onProgress?.('Checked the response against the required structure.');
      return { data: checked.data, model };
    } catch (error) {
      if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
      if (error instanceof AiResponseInvalidError) invalidResponse = true;
      cooldowns.set(model, Date.now() + cooldownFor(error));
      options.onProgress?.('Trying another available model.');
    }
  }
  if (invalidResponse) throw new AiResponseInvalidError();
  return null;
}
