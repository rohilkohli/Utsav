import type { Request, Response } from 'express';
import { AiResponseInvalidError, type AiCallContext } from '../services/model.js';

/** Streams public progress summaries only, never model-private reasoning. */
export async function runAiResponse<T>(
  req: Request,
  res: Response,
  operation: (context: AiCallContext) => Promise<T>,
): Promise<void> {
  const streaming =
    req.accepts('application/x-ndjson') === 'application/x-ndjson' &&
    req.headers.accept?.includes('application/x-ndjson');
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on('close', onClose);
  const write = (event: object) => {
    if (!res.destroyed && !res.writableEnded) {
      res.write(`${JSON.stringify(event)}\n`);
      if (Object.hasOwn(res, 'flush')) res.flush();
    }
  };
  if (streaming) {
    res.status(200).set({
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    write({ type: 'thought', text: 'Reading your request and the current plan.' });
  }
  try {
    const data = await operation({
      signal: controller.signal,
      onProgress: streaming
        ? (text) => {
            write({ type: 'thought', text });
          }
        : undefined,
    });
    if (controller.signal.aborted) return;
    if (streaming) {
      const record = data as Record<string, unknown>;
      const meta = record.meta;
      const model =
        record.model ??
        (typeof meta === 'object' && meta !== null && 'model' in meta ? meta.model : undefined);
      if (typeof model === 'string') write({ type: 'model', model });
      write({ type: 'result', data });
      res.end();
    } else res.status(200).json(data);
  } catch (error) {
    if (controller.signal.aborted) return;
    const invalid = error instanceof AiResponseInvalidError;
    const code = invalid ? 'AI_RESPONSE_INVALID' : 'AI_REQUEST_FAILED';
    if (streaming) {
      write({ type: 'error', error: code });
      res.end();
    } else res.status(invalid ? 502 : 500).json({ error: code });
  } finally {
    res.removeListener('close', onClose);
  }
}
