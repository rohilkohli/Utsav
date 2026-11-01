import { z } from 'zod';

export type AiProgress = { type: 'thought'; text: string } | { type: 'model'; model: string };
export interface AiRequestOptions {
  signal?: AbortSignal;
  onProgress?: (progress: AiProgress) => void;
}

const frameSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('thought'), text: z.string().max(1000) }),
  z.object({ type: z.literal('model'), model: z.string().max(200) }),
  z.object({ type: z.literal('result'), data: z.unknown() }),
  z.object({ type: z.literal('error'), error: z.string().max(500) }),
]);
const errorSchema = z.object({ error: z.string() });
const MAX_RESPONSE_BYTES = 2_000_000;

async function readStream(response: Response, options: AiRequestOptions): Promise<unknown> {
  if (!response.body) throw new Error('AI_RESPONSE_INVALID');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: unknown;
  const state = { complete: false };
  let size = 0;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const parsed: unknown = JSON.parse(line);
    const frame = frameSchema.parse(parsed);
    if (state.complete) throw new Error('AI_RESPONSE_INVALID');
    if (frame.type === 'error') throw new Error(frame.error);
    if (frame.type === 'result') {
      result = frame.data;
      state.complete = true;
    } else {
      options.onProgress?.(frame);
    }
  };
  try {
    options.signal?.throwIfAborted();
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      options.signal?.throwIfAborted();
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error('AI_RESPONSE_TOO_LARGE');
      buffer += decoder.decode(chunk.value, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        consume(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    }
    buffer += decoder.decode();
    consume(buffer);
    if (!state.complete) throw new Error('AI_RESPONSE_INVALID');
    return result;
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  options: AiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', options.onProgress ? 'application/x-ndjson' : 'application/json');
  const response = await fetch(path, { ...init, headers, signal: options.signal });
  if (!response.ok) {
    const error: unknown = await response.json().catch(() => null);
    const parsed = errorSchema.safeParse(error);
    throw new Error(parsed.success ? parsed.data.error : `Request failed (${response.status})`);
  }
  const data: unknown = response.headers.get('content-type')?.includes('application/x-ndjson')
    ? await readStream(response, options)
    : await response.json();
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error('AI_RESPONSE_INVALID');
  return parsed.data;
}

export function postJson(payload: unknown, token?: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  };
}
