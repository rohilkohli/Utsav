import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';

function makeReqResNext(body: unknown) {
  const req = { body } as Request;
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next, status, json };
}

const schema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

describe('validateBody middleware', () => {
  it('calls next() when body matches the schema', () => {
    const { req, res, next } = makeReqResNext({ name: 'Alice', age: 25 });
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('replaces req.body with the parsed/coerced value on success', () => {
    const { req, res, next } = makeReqResNext({ name: 'Bob', age: 30 });
    validateBody(schema)(req, res, next);
    expect(req.body).toEqual({ name: 'Bob', age: 30 });
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 400 when body is missing a required field', () => {
    const { req, res, next, status, json } = makeReqResNext({ name: 'Charlie' });
    validateBody(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed', details: expect.any(Array) }),
    );
  });

  it('returns 400 for empty body {}', () => {
    const { req, res, next, status } = makeReqResNext({});
    validateBody(schema)(req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('includes the failing field path in the details array', () => {
    const { req, res, next, status, json } = makeReqResNext({ name: '', age: 25 });
    validateBody(schema)(req, res, next);
    expect(status).toHaveBeenCalledWith(400);
    const payload = json.mock.calls[0][0] as { details: Array<{ path: string; message: string }> };
    expect(payload.details.some((d) => d.path === 'name')).toBe(true);
  });

  it('returns 400 for null body', () => {
    const { req, res, next, status } = makeReqResNext(null);
    validateBody(schema)(req, res, next);
    expect(status).toHaveBeenCalledWith(400);
  });

  it('does not call next() when body has wrong type for a field', () => {
    const { req, res, next, status } = makeReqResNext({ name: 'Dave', age: 'not-a-number' });
    validateBody(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });

  it('handles nested schema objects', () => {
    const nested = z.object({ user: z.object({ uid: z.string().min(1) }) });
    const { req, res, next } = makeReqResNext({ user: { uid: 'abc123' } });
    validateBody(nested)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('includes nested field path when nested validation fails', () => {
    const nested = z.object({ user: z.object({ uid: z.string().min(1) }) });
    const { req, res, json, status } = makeReqResNext({ user: { uid: '' } });
    validateBody(nested)(req, res, vi.fn() as unknown as NextFunction);
    expect(status).toHaveBeenCalledWith(400);
    const payload = json.mock.calls[0][0] as { details: Array<{ path: string }> };
    expect(payload.details[0].path).toContain('uid');
  });
});
