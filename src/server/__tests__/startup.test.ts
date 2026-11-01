import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  listen: vi.fn(),
  validate: vi.fn(),
  init: vi.fn(),
  voice: vi.fn(),
  stdout: vi.fn(),
  stderr: vi.fn(),
  exit: vi.fn(),
}));
vi.mock('http', async (original) => ({
  ...(await original<typeof import('http')>()),
  createServer: () => ({ listen: mocks.listen }),
}));
vi.mock('../env.js', () => ({ validateEnv: mocks.validate }));
vi.mock('../repositories/index.js', async (original) => ({
  ...(await original<typeof import('../repositories/index.js')>()),
  initRepositories: mocks.init,
}));
vi.mock('../routes/voice.js', async () => {
  const { Router } = await import('express');
  return { default: Router(), attachVoiceWebSocket: mocks.voice };
});
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('PORT', '3999');
  mocks.validate.mockReset();
  mocks.init.mockReset();
  mocks.listen.mockImplementation((_port: number, _host: string, ready: () => void) => {
    ready();
  });
  mocks.stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
  mocks.stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it('validates configuration and storage before listening and attaching the voice relay', async () => {
  await import('../index.js');
  expect(mocks.validate).toHaveBeenCalledOnce();
  expect(mocks.init).toHaveBeenCalledOnce();
  expect(mocks.voice).toHaveBeenCalledOnce();
  expect(mocks.listen).toHaveBeenCalledWith(3999, '0.0.0.0', expect.any(Function));
  expect(mocks.stdout).toHaveBeenCalledWith(expect.stringContaining('3999'));
});
it('reports startup failures and exits before accepting traffic', async () => {
  mocks.validate.mockImplementation(() => {
    throw new Error('Missing required configuration');
  });
  mocks.exit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('Stopped startup');
  });
  await expect(import('../index.js')).rejects.toThrow('Stopped startup');
  expect(mocks.stderr).toHaveBeenCalledWith('Missing required configuration\n');
  expect(mocks.exit).toHaveBeenCalledWith(1);
});
