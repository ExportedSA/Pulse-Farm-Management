// Live, only Pulse's own address may call the API from a browser. A page on another website gets a
// plain 403 (not a 500 that looks like a crash); Pulse's own pages and tools with no Origin get through.
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import corsConfig from '../../server/config/cors';

describe('CORS', () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, APP_URL: process.env.APP_URL };
  const app = express();
  app.use(corsConfig);
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: 'Internal Server Error' });
  });

  beforeAll(() => {
    process.env.NODE_ENV = 'production';
    process.env.APP_URL = 'https://app.pulse.test';
  });
  afterAll(() => {
    process.env.NODE_ENV = saved.NODE_ENV;
    if (saved.APP_URL === undefined) delete process.env.APP_URL; else process.env.APP_URL = saved.APP_URL;
  });

  it('refuses another website with 403', async () => {
    const res = await request(app).get('/api/ping').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it("allows Pulse's own address", async () => {
    const res = await request(app).get('/api/ping').set('Origin', 'https://app.pulse.test');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://app.pulse.test');
  });

  it('allows requests with no Origin (same-site page loads, health checks)', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
  });
});
