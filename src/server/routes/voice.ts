import type { IncomingMessage, Server } from 'http';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import WebSocket, { WebSocketServer } from 'ws';

const router = Router();
const windows = new Map<string, { startedAt: number; count: number }>();
const MAX_QUEUE_BYTES = 262144;
const MAX_MESSAGE_BYTES = 1048576;
const voiceLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
router.get('/voice/session', voiceLimiter, (_request, response) => {
  response.status(410).json({ error: 'Voice sessions use the server relay.' });
});

function sameOrigin(request: IncomingMessage): boolean {
  const forwarded = request.headers['x-forwarded-host'];
  const host = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? request.headers.host;
  try {
    return Boolean(request.headers.origin && host && new URL(request.headers.origin).host === host);
  } catch {
    return false;
  }
}
function allowConnection(request: IncomingMessage): boolean {
  const now = Date.now();
  for (const [key, value] of windows) if (now - value.startedAt >= 60000) windows.delete(key);
  // Use the rightmost hop, matching Express trust proxy: 1 (not a spoofable first hop).
  const forwarded = request.headers['x-forwarded-for'];
  const hops = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded)?.split(',');
  const key = hops?.at(-1)?.trim() ?? request.socket.remoteAddress ?? 'unknown';
  const value = windows.get(key);
  if (!value) {
    if (windows.size >= 10000) return false;
    windows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (value.count >= 10) return false;
  value.count++;
  return true;
}

/** Internal-only upstream URL: credentials and upstream error details never reach clients. */
export function attachVoiceWebSocket(server: Server): void {
  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  server.on('upgrade', (request, socket, head) => {
    if (request.url?.split('?')[0] !== '/api/voice/ws') return;
    const deny = (status: string) => {
      socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    if (!sameOrigin(request)) {
      deny('403 Forbidden');
      return;
    }
    if (!allowConnection(request)) {
      deny('429 Too Many Requests');
      return;
    }
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === 'your-gemini-api-key-here') {
      deny('503 Service Unavailable');
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) => {
      sockets.emit('connection', client);
    });
  });
  sockets.on('connection', (client) => {
    const upstream = new WebSocket(
      `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY ?? '')}`,
      { handshakeTimeout: 10000, maxPayload: MAX_MESSAGE_BYTES },
    );
    const pending: { data: Buffer; binary: boolean }[] = [];
    let queuedBytes = 0;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      pending.length = 0;
      queuedBytes = 0;
      if (client.readyState === WebSocket.OPEN) client.close(1011, 'Voice connection ended');
      else if (client.readyState !== WebSocket.CLOSED) client.terminate();
      if (upstream.readyState === WebSocket.OPEN) upstream.close();
      else if (upstream.readyState !== WebSocket.CLOSED) upstream.terminate();
    };
    upstream.on('open', () => {
      if (closed) {
        upstream.close();
        return;
      }
      for (const message of pending) upstream.send(message.data, { binary: message.binary });
      pending.length = 0;
      queuedBytes = 0;
    });
    client.on('message', (data, binary) => {
      if (closed) return;
      const buffer = Array.isArray(data)
        ? Buffer.concat(data)
        : Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
      if (upstream.bufferedAmount + buffer.length > MAX_QUEUE_BYTES) {
        close();
        return;
      }
      if (upstream.readyState === WebSocket.OPEN) upstream.send(buffer, { binary });
      else if (
        upstream.readyState === WebSocket.CONNECTING &&
        queuedBytes + buffer.length <= MAX_QUEUE_BYTES
      ) {
        pending.push({ data: buffer, binary });
        queuedBytes += buffer.length;
      } else close();
    });
    upstream.on('message', (data, binary) => {
      if (client.readyState !== WebSocket.OPEN || client.bufferedAmount > MAX_QUEUE_BYTES) {
        close();
        return;
      }
      client.send(data, { binary });
    });
    client.on('error', close);
    upstream.on('error', close);
    client.on('close', close);
    upstream.on('close', close);
  });
  server.on('close', () => {
    for (const client of sockets.clients) client.terminate();
    sockets.close();
  });
}
export default router;
