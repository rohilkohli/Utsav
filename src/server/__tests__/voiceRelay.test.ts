import { createServer, IncomingMessage } from 'http';
import { Socket } from 'net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachVoiceWebSocket } from '../routes/voice';

const original = process.env.GEMINI_API_KEY;
afterEach(() => {
  if (original === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = original;
});
function upgrade(origin: string | undefined, ip: string, route = '/api/voice/ws') {
  const server = createServer();
  attachVoiceWebSocket(server);
  const socket = new Socket();
  const write = vi.spyOn(socket, 'write').mockImplementation(() => true);
  const destroy = vi.spyOn(socket, 'destroy').mockReturnValue(socket);
  const request = new IncomingMessage(socket);
  request.url = route;
  request.headers = { host: 'localhost:3001', origin, 'x-forwarded-for': ip };
  server.emit('upgrade', request, socket, Buffer.alloc(0));
  return { write, destroy };
}
describe('voice relay upgrade security', () => {
  it('rejects a missing or hostile origin before opening any upstream connection', () => {
    expect(upgrade(undefined, '203.0.113.201').write).toHaveBeenCalledWith(
      expect.stringContaining('403 Forbidden'),
    );
    expect(upgrade('https://hostile.example', '203.0.113.201').write).toHaveBeenCalledWith(
      expect.stringContaining('403 Forbidden'),
    );
  });
  it('returns service unavailable for the documented fallback sentinel', () => {
    process.env.GEMINI_API_KEY = 'your-gemini-api-key-here';
    const result = upgrade('http://localhost:3001', '203.0.113.202');
    expect(result.write).toHaveBeenCalledWith(expect.stringContaining('503 Service Unavailable'));
    expect(result.destroy).toHaveBeenCalledOnce();
    expect(JSON.stringify(result.write.mock.calls)).not.toContain('your-gemini-api-key-here');
  });
  it('limits attempted connections per trusted rightmost proxy hop', () => {
    delete process.env.GEMINI_API_KEY;
    for (let attempt = 0; attempt < 10; attempt++)
      upgrade('http://localhost:3001', `192.0.2.${attempt}, 203.0.113.203`);
    expect(
      upgrade('http://localhost:3001', '198.51.100.1, 203.0.113.203').write,
    ).toHaveBeenCalledWith(expect.stringContaining('429 Too Many Requests'));
  });
  it('leaves unrelated upgrades to their own handlers', () => {
    expect(
      upgrade('http://localhost:3001', '203.0.113.204', '/different-service').write,
    ).not.toHaveBeenCalled();
  });
});
