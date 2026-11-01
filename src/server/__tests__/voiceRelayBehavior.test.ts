import { EventEmitter } from 'node:events';
import { createServer, IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

interface TestSocket extends EventEmitter {
  readyState: number;
  bufferedAmount: number;
  send: Mock<(data: unknown, options?: { binary: boolean }) => void>;
  close: Mock<(code?: number, reason?: string) => void>;
  terminate: Mock<() => void>;
}
interface TestSocketServer extends EventEmitter {
  clients: Set<TestSocket>;
  close: Mock<() => void>;
}
const harness = vi.hoisted(() => ({
  sockets: [] as TestSocket[],
  servers: [] as TestSocketServer[],
}));
vi.mock('ws', async () => {
  const { EventEmitter: Emitter } = await import('node:events');
  class FakeSocket extends Emitter {
    static OPEN = 1;
    static CLOSED = 3;
    static CONNECTING = 0;
    readyState = 0;
    bufferedAmount = 0;
    send = vi.fn((_data: unknown, _options?: { binary: boolean }) => undefined);
    close = vi.fn((_code?: number, _reason?: string) => {
      this.readyState = 3;
    });
    terminate = vi.fn(() => {
      this.readyState = 3;
    });
    constructor(..._arguments: unknown[]) {
      super();
      harness.sockets.push(this);
    }
  }
  class FakeServer extends Emitter {
    clients = new Set<TestSocket>();
    close = vi.fn(() => undefined);
    constructor(..._arguments: unknown[]) {
      super();
      harness.servers.push(this);
    }
    handleUpgrade(
      _request: unknown,
      _socket: unknown,
      _head: unknown,
      callback: (client: TestSocket) => void,
    ) {
      const client = new FakeSocket();
      client.readyState = 1;
      this.clients.add(client);
      callback(client);
    }
  }
  return { default: FakeSocket, WebSocketServer: FakeServer };
});

beforeEach(() => {
  harness.sockets.length = 0;
  harness.servers.length = 0;
  vi.stubEnv('GEMINI_API_KEY', 'relay-test-not-a-real-key');
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

async function relay(headers: IncomingMessage['headers'] = {}) {
  const { attachVoiceWebSocket } = await import('../routes/voice');
  const server = createServer();
  attachVoiceWebSocket(server);
  const socket = new Socket();
  const write = vi.spyOn(socket, 'write').mockReturnValue(true);
  const destroy = vi.spyOn(socket, 'destroy').mockReturnValue(socket);
  const request = new IncomingMessage(socket);
  request.url = '/api/voice/ws?transport=audio';
  request.headers = { host: 'localhost:3001', origin: 'http://localhost:3001', ...headers };
  server.emit('upgrade', request, socket, Buffer.alloc(0));
  return { server, request, socket, write, destroy };
}
function pair() {
  const [client, upstream] = harness.sockets;
  if (!client || !upstream) throw new Error('Expected relay endpoints');
  return { client, upstream };
}

describe('server voice relay transport behavior', () => {
  it('queues setup and binary audio until upstream is ready, preserving frame types and byte order', async () => {
    await relay();
    const { client, upstream } = pair();
    client.emit('message', Buffer.from('{"setup":{}}'), false);
    client.emit('message', [Buffer.from([1, 2]), Buffer.from([3])], true);
    client.emit('message', new Uint8Array([4, 5]).buffer, true);
    expect(upstream.send).not.toHaveBeenCalled();
    upstream.readyState = 1;
    upstream.emit('open');
    expect(upstream.send.mock.calls).toEqual([
      [Buffer.from('{"setup":{}}'), { binary: false }],
      [Buffer.from([1, 2, 3]), { binary: true }],
      [Buffer.from([4, 5]), { binary: true }],
    ]);
    client.emit('message', Buffer.from('live'), false);
    expect(upstream.send).toHaveBeenLastCalledWith(Buffer.from('live'), { binary: false });
    upstream.emit('message', Buffer.from('{"audio":"abc"}'), false);
    expect(client.send).toHaveBeenCalledWith(Buffer.from('{"audio":"abc"}'), { binary: false });
  });
  it('fails closed when queued audio exceeds its bounded startup buffer', async () => {
    await relay();
    const { client, upstream } = pair();
    client.emit('message', Buffer.alloc(200000), true);
    client.emit('message', Buffer.alloc(100000), true);
    expect(client.close).toHaveBeenCalledWith(1011, 'Voice connection ended');
    expect(upstream.terminate).toHaveBeenCalledOnce();
    upstream.readyState = 1;
    upstream.emit('open');
    expect(upstream.close).toHaveBeenCalledOnce();
    expect(upstream.send).not.toHaveBeenCalled();
    client.emit('message', Buffer.from('after close'), false);
    expect(upstream.send).not.toHaveBeenCalled();
  });
  it('closes both endpoints when upstream output backpressure exceeds its cap', async () => {
    await relay();
    const { client, upstream } = pair();
    upstream.readyState = 1;
    upstream.bufferedAmount = 262144;
    client.emit('message', Buffer.from('x'), false);
    expect(client.close).toHaveBeenCalledOnce();
    expect(upstream.close).toHaveBeenCalledOnce();
    upstream.emit('close');
    client.emit('close');
    expect(client.close).toHaveBeenCalledOnce();
  });
  it.each([
    ['client closed', 3, 0],
    ['slow browser', 1, 262145],
  ])('stops upstream delivery for %s', async (_name, state, buffered) => {
    await relay();
    const { client, upstream } = pair();
    client.readyState = state;
    client.bufferedAmount = buffered;
    upstream.emit('message', Buffer.from('audio'), true);
    expect(client.send).not.toHaveBeenCalled();
    expect(upstream.terminate).toHaveBeenCalledOnce();
  });
  it('terminates a connecting client and ignores already-closed upstream sockets', async () => {
    await relay();
    const { client, upstream } = pair();
    client.readyState = 0;
    upstream.readyState = 3;
    client.emit('error', new Error('browser disconnected'));
    expect(client.terminate).toHaveBeenCalledOnce();
    expect(upstream.close).not.toHaveBeenCalled();
    expect(upstream.terminate).not.toHaveBeenCalled();
  });
  it('closes instead of queuing onto an upstream that is closing', async () => {
    await relay();
    const { client, upstream } = pair();
    upstream.readyState = 2;
    client.emit('message', Buffer.from('x'), false);
    expect(upstream.send).not.toHaveBeenCalled();
    expect(upstream.terminate).toHaveBeenCalledOnce();
  });
  it('does not leak upstream exceptions and releases all clients when the HTTP server closes', async () => {
    const { server } = await relay();
    const { client, upstream } = pair();
    upstream.emit('error', new Error('private upstream credential detail'));
    expect(client.close).toHaveBeenCalledWith(1011, 'Voice connection ended');
    expect(client.send).not.toHaveBeenCalled();
    server.emit('close');
    expect(client.terminate).toHaveBeenCalledOnce();
    expect(harness.servers[0]?.close).toHaveBeenCalledOnce();
  });
  it('validates forwarded host arrays and ignores missing origin', async () => {
    const valid = await relay({
      host: 'internal:3001',
      'x-forwarded-host': ['public.example'],
      origin: 'https://public.example',
    });
    expect(valid.write).not.toHaveBeenCalled();
    expect(harness.sockets).toHaveLength(2);
    const invalid = await relay({ origin: 'not a URL' });
    expect(invalid.write).toHaveBeenCalledWith(expect.stringContaining('403 Forbidden'));
    const missing = await relay({ origin: undefined });
    expect(missing.destroy).toHaveBeenCalledOnce();
  });
  it('expires IP windows after one minute and groups forwarded arrays by trusted rightmost hop', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    vi.stubEnv('GEMINI_API_KEY', '');
    for (let index = 0; index < 10; index++) {
      const result = await relay({ 'x-forwarded-for': [`192.0.2.${index}`, '203.0.113.17'] });
      expect(result.write).toHaveBeenCalledWith(expect.stringContaining('503 Service Unavailable'));
    }
    const limited = await relay({ 'x-forwarded-for': ['198.51.100.1', '203.0.113.17'] });
    expect(limited.write).toHaveBeenCalledWith(expect.stringContaining('429 Too Many Requests'));
    vi.advanceTimersByTime(60000);
    const fresh = await relay({ 'x-forwarded-for': ['198.51.100.1', '203.0.113.17'] });
    expect(fresh.write).toHaveBeenCalledWith(expect.stringContaining('503 Service Unavailable'));
  });
});
