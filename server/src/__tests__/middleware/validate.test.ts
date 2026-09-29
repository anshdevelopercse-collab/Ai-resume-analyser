import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

function mockReq(body: unknown): Request {
  return { body } as unknown as Request;
}

function mockRes(): Response {
  return {} as Response;
}

describe('validate middleware', () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int().positive() });

  it('calls next() with valid data and replaces req.body with parsed output', () => {
    const req = mockReq({ name: 'Alice', age: 30 });
    const next = vi.fn();
    validate(schema)(req, mockRes(), next as unknown as NextFunction);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('calls next(error) with ZodError on invalid data', () => {
    const req = mockReq({ name: '', age: -1 });
    const next = vi.fn();
    validate(schema)(req, mockRes(), next as unknown as NextFunction);
    expect(next).toHaveBeenCalledOnce();
    const [err] = next.mock.calls[0];
    expect(err).toBeDefined();
    expect(err.name).toBe('ZodError');
  });

  it('strips unknown fields from req.body', () => {
    const req = mockReq({ name: 'Bob', age: 25, injected: true, _id: 'hack' });
    const next = vi.fn();
    validate(schema)(req, mockRes(), next as unknown as NextFunction);
    expect(next).toHaveBeenCalledWith();
    expect((req.body as any).injected).toBeUndefined();
    expect((req.body as any)._id).toBeUndefined();
  });

  it('validates query params when source is "query"', () => {
    const querySchema = z.object({ page: z.string().optional() });
    const req = { query: { page: '2', extra: 'x' } } as unknown as Request;
    const next = vi.fn();
    validate(querySchema, 'query')(req, mockRes(), next as unknown as NextFunction);
    expect(next).toHaveBeenCalledWith();
    expect((req.query as any).extra).toBeUndefined();
  });
});
