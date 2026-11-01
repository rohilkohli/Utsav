import type { IncomingMessage, Server } from 'http';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import WebSocket, { WebSocketServer } from 'ws';

const voiceLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();
const upstreamPath =
  '/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const connectionWindows = new Map<string, { startedAt: number; count: number }>();

function clientIp(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-for'];
  return (
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]) ||
    request.socket.remoteAddress ||
    'unknown'
  );
}

function isSameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  const forwardedHost = request.headers['x-forwarded-host'];
  const host =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || request.headers.host;
  try {
    return Boolean(origin && host && new URL(origin).host === host);
  } catch {
    return false;
  }
}

function allowConnection(request: IncomingMessage): boolean {
  const now = Date.now();
  const key = clientIp(request);
  const window = connectionWindows.get(key);
  if (!window || now - window.startedAt >= 60_000) {
    connectionWindows.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (window.count >= 10) return false;
  window.count += 1;
  return true;
}

router.get('/voice/session', voiceLimiter, (_req, res) => {
  res.status(410).json({ error: 'Voice sessions use the server relay.' });
});

export function attachVoiceWebSocket(server: Server): void {
  const socketServer = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (requestUrl.pathname !== '/api/voice/ws') return;

    if (!isSameOrigin(request) || !allowConnection(request)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your-gemini-api-key-here') {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    socketServer.handleUpgrade(request, socket, head, (client) => {
      socketServer.emit('connection', client, request);
    });
  });

  socketServer.on('connection', (client, request) => {
    const upstream = new WebSocket(
      `wss://generativelanguage.googleapis.com${upstreamPath}?key=${encodeURIComponent(process.env.GEMINI_API_KEY || '')}`,
    );
    const pending: Buffer[] = [];

    upstream.on('open', () => {
      for (const message of pending) upstream.send(message);
      pending.length = 0;
    });
    client.on('message', (message) => {
      if (upstream.readyState === WebSocket.OPEN) upstream.send(message);
      else pending.push(Buffer.from(message as Uint8Array));
    });
    upstream.on('message', (message) => {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    });
    const closeBoth = () => {
      if (client.readyState === WebSocket.OPEN) client.close();
      if (upstream.readyState === WebSocket.OPEN) upstream.close();
    };
    client.on('close', closeBoth);
    upstream.on('close', closeBoth);
    client.on('error', closeBoth);
    upstream.on('error', closeBoth);
    void request;
  });
}

export default router;
