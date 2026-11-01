import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { apiRequest, postJson, type AiProgress } from '../lib/apiTransport';

const schema = z.object({ answer: z.string() });
const encoder = new TextEncoder();
function stream(text: string, split = 9) {
  const bytes = encoder.encode(text);
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += split)
          controller.enqueue(bytes.slice(offset, offset + split));
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'application/x-ndjson' } },
  );
}
afterEach(() => vi.unstubAllGlobals());

describe('validated API transport', () => {
  it('sends JSON, token and abort signal without changing credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ answer: 'ok' }));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    expect(
      await apiRequest('/api/test', schema, postJson({ input: 'hello' }, 'id-token'), {
        signal: controller.signal,
      }),
    ).toEqual({ answer: 'ok' });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'POST',
        body: '{"input":"hello"}',
        signal: controller.signal,
      }),
    );
    const init = fetcher.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer id-token');
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json');
    expect(postJson({ test: 1 }).headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('streams split UTF-8 progress and only returns a schema-validated terminal result', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        stream(
          [
            '{"type":"thought","text":"Reading your celebration"}',
            '{"type":"model","model":"gemini-test"}',
            '{"type":"result","data":{"answer":"नमस्ते"}}',
          ].join('\r\n'),
          1,
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const progress: AiProgress[] = [];
    expect(
      await apiRequest('/api/test', schema, {}, { onProgress: (item) => progress.push(item) }),
    ).toEqual({ answer: 'नमस्ते' });
    expect(progress).toEqual([
      { type: 'thought', text: 'Reading your celebration' },
      { type: 'model', model: 'gemini-test' },
    ]);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Accept')).toBe(
      'application/x-ndjson',
    );
  });

  it('accepts optional empty progress lines and a final newline', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(stream('\n{"type":"result","data":{"answer":"ok"}}\n')),
    );
    expect(await apiRequest('/api/test', schema)).toEqual({ answer: 'ok' });
  });

  it.each([
    '{"type":"thought","text":"working"}\n',
    '{"type":"result","data":{"answer":1}}',
    '{"type":"result","data":{"answer":"one"}}\n{"type":"result","data":{"answer":"two"}}',
    '{"type":"unknown"}',
    'not-json',
  ])('rejects missing, malformed or duplicate result frames: %s', async (text) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(stream(text)));
    await expect(apiRequest('/api/test', schema)).rejects.toThrow();
  });

  it('rejects explicit AI errors without returning partial data', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(stream('{"type":"error","error":"AI_RESPONSE_INVALID"}')),
    );
    await expect(apiRequest('/api/test', schema)).rejects.toThrow('AI_RESPONSE_INVALID');
  });

  it('requires a response stream body', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(null, { headers: { 'Content-Type': 'application/x-ndjson' } }),
        ),
    );
    await expect(apiRequest('/api/test', schema)).rejects.toThrow('AI_RESPONSE_INVALID');
  });

  it('caps untrusted stream memory', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(stream('x'.repeat(2_000_001), 2_000_001)),
    );
    await expect(apiRequest('/api/test', schema)).rejects.toThrow('AI_RESPONSE_TOO_LARGE');
  });

  it('checks abort even when a custom fetch has ignored its signal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(stream('{"type":"result","data":{"answer":"old"}}')),
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      apiRequest('/api/test', schema, {}, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it.each([
    [Response.json({ error: 'FORBIDDEN_ORIGIN' }, { status: 403 }), 'FORBIDDEN_ORIGIN'],
    [Response.json({ other: 'bad' }, { status: 502 }), 'Request failed (502)'],
    [new Response('unavailable', { status: 503 }), 'Request failed (503)'],
  ])('handles HTTP failure status safely', async (response, message) => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response));
    await expect(apiRequest('/api/test', schema)).rejects.toThrow(message);
  });

  it('validates plain JSON responses as strictly as streamed responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ answer: false })),
    );
    await expect(apiRequest('/api/test', schema)).rejects.toThrow('AI_RESPONSE_INVALID');
  });
});
