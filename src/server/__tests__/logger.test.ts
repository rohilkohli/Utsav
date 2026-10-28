import { describe, it, expect, vi, afterEach } from 'vitest';

describe('Logger utility', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  describe('in test environment', () => {
    it('logger.info suppresses output when NODE_ENV=test', async () => {
      process.env.NODE_ENV = 'test';
      vi.resetModules();
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      const { logger } = await import('../lib/logger.js');
      logger.info('should be silent');
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('logger.warn suppresses output when NODE_ENV=test', async () => {
      process.env.NODE_ENV = 'test';
      vi.resetModules();
      const writeSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      const { logger } = await import('../lib/logger.js');
      logger.warn('should be silent');
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('logger.error suppresses output when NODE_ENV=test', async () => {
      process.env.NODE_ENV = 'test';
      vi.resetModules();
      const writeSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      const { logger } = await import('../lib/logger.js');
      logger.error('should be silent');
      expect(writeSpy).not.toHaveBeenCalled();
    });
  });

  describe('in production environment', () => {
    it('logger.info writes to stdout with INFO level and message', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      const { logger } = await import('../lib/logger.js');
      logger.info('server started on port 8080');
      expect(writeSpy).toHaveBeenCalledOnce();
      const output = String(writeSpy.mock.calls[0][0]);
      expect(output).toContain('INFO');
      expect(output).toContain('server started on port 8080');
    });

    it('logger.warn writes to stderr with WARN level and message', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const writeSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      const { logger } = await import('../lib/logger.js');
      logger.warn('falling back to in-memory store');
      expect(writeSpy).toHaveBeenCalledOnce();
      const output = String(writeSpy.mock.calls[0][0]);
      expect(output).toContain('WARN');
      expect(output).toContain('falling back to in-memory store');
    });

    it('logger.error writes to stderr with ERROR level and message', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const writeSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      const { logger } = await import('../lib/logger.js');
      logger.error('unhandled exception');
      expect(writeSpy).toHaveBeenCalledOnce();
      const output = String(writeSpy.mock.calls[0][0]);
      expect(output).toContain('ERROR');
      expect(output).toContain('unhandled exception');
    });

    it('output includes an ISO 8601 timestamp', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      const { logger } = await import('../lib/logger.js');
      logger.info('timestamp check');
      const output = String(writeSpy.mock.calls[0][0]);
      expect(output).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });

    it('output ends with a newline', async () => {
      process.env.NODE_ENV = 'production';
      vi.resetModules();
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      const { logger } = await import('../lib/logger.js');
      logger.info('newline check');
      const output = String(writeSpy.mock.calls[0][0]);
      expect(output).toMatch(/\n$/);
    });
  });
});
