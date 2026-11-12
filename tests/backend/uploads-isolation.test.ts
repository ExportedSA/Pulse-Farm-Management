// Uploaded files are served only to members of the farm that owns them, with local-disk storage and with
// S3 storage (the bucket is faked here; nothing is sent to AWS).
//
// Builds the real API in-process against the database in .env and makes two TEST farms. Farm A uploads a
// photo and a chat file; farm B, and a signed-out visitor, must not get them back from /uploads. An older
// file whose key has no farm in it is served only to the farm whose row links to it. All TEST rows and files
// are removed at the end.
//
// Needs DATABASE_URL and JWT_SECRET; skipped without them.
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { sql } from 'drizzle-orm';

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;

// A fake private bucket: objects only in memory, signed links on a made-up host. S3_ENDPOINT also points at a
// closed local port, so even if the fake were bypassed nothing would leave this machine.
const bucket = new Map<string, { body: Buffer; type: string }>();
const fakeStore = {
  async put(key: string, body: Buffer, type: string) { bucket.set(key, { body, type }); },
  async remove(key: string) { bucket.delete(key); },
  async signedGetUrl(key: string, opts: { expiresIn: number }) {
    return `https://test-bucket.example/${key}?X-Amz-Expires=${opts.expiresIn}&X-Amz-Signature=fake`;
  },
};

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const S3_ENV = { S3_BUCKET_NAME: 'test-bucket', S3_ENDPOINT: 'http://127.0.0.1:9', AWS_REGION: 'ap-southeast-2',
  AWS_ACCESS_KEY_ID: 'TESTKEY', AWS_SECRET_ACCESS_KEY: 'TESTSECRET' };
const savedEnv: Record<string, string | undefined> = {};

function useEnv(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (!(k in savedEnv)) savedEnv[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

describe.skipIf(!live)('uploaded files stay with their farm', () => {
  let app: express.Express;
  let systemDb: any;
  const farm = { a: '', b: '' };
  const user = { a: '', b: '' };
  const token = { a: '', b: '' };
  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-uploads-test-'));

  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const as = (k: 'a' | 'b') => ({ Authorization: `Bearer ${token[k]}` });

  async function uploadAsA(): Promise<string[]> {
    const photo = await request(app).post('/api/photos/upload').set(as('a'))
      .attach('photo', PNG, { filename: 'TEST photo.png', contentType: 'image/png' });
    expect(photo.status).toBe(200);
    const chat = await request(app).post('/api/chat/upload').set(as('a'))
      .attach('file', PNG, { filename: 'TEST-chat.png', contentType: 'image/png' });
    expect(chat.status).toBe(200);
    const urls = [photo.body.url, chat.body.url];
    for (const url of urls) expect(url).toMatch(new RegExp(`^/uploads/(photos|chat)/${farm.a}/`));
    return urls;
  }

  beforeAll(async () => {
    useEnv({ UPLOADS_DIR: uploadsDir, ...Object.fromEntries(Object.keys(S3_ENV).map(k => [k, undefined])) });
    ({ systemDb } = await import('../../server/db'));
    const { registerRoutes } = await import('../../server/routes');
    const { generateToken } = await import('../../server/middleware/auth');
    (await import('../../server/services/fileStorage')).setObjectStoreForTests(fakeStore);
    app = express();
    app.use(express.json());
    await registerRoutes(app);

    for (const k of ['a', 'b'] as const) {
      farm[k] = (await one(sql`INSERT INTO farms (name) VALUES (${`TEST Uploads Farm ${k.toUpperCase()}`}) RETURNING id`)).id;
      user[k] = (await one(sql`INSERT INTO users (name, email, password) VALUES (${`TEST Uploads ${k}`}, ${`test-uploads-${k}-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
      await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farm[k]}, ${user[k]}, 'owner')`);
      token[k] = generateToken({ userId: user[k], farmId: farm[k], role: 'owner', name: `TEST Uploads ${k}` });
    }
  }, 120_000);

  afterEach(() => useEnv({ ...Object.fromEntries(Object.keys(S3_ENV).map(k => [k, undefined])) }));

  afterAll(async () => {
    for (const [k, v] of Object.entries(savedEnv)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    if (!systemDb) return;
    const farms = [farm.a, farm.b].filter(Boolean);
    if (farms.length) {
      const inFarms = sql.join(farms.map(f => sql`${f}::uuid`), sql`, `);
      await systemDb.execute(sql`DELETE FROM jobs WHERE farm_id IN (${inFarms})`);
      const tables = ((await systemDb.execute(sql`
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'farm_id' AND table_name NOT IN ('farm_members', 'farms')`)) as any).rows.map((r: any) => r.table_name);
      for (let pass = 0; pass < 5; pass++) {
        const results = await Promise.allSettled(tables.map((t: string) =>
          systemDb.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE farm_id IN (${inFarms})`)));
        if (results.every(r => r.status === 'fulfilled')) break;
      }
      await systemDb.execute(sql`DELETE FROM farm_members WHERE farm_id IN (${inFarms})`);
      await systemDb.execute(sql`DELETE FROM farms WHERE id IN (${inFarms})`);
    }
    const users = [user.a, user.b].filter(Boolean);
    if (users.length) await systemDb.execute(sql`DELETE FROM users WHERE id IN (${sql.join(users.map(u => sql`${u}::uuid`), sql`, `)})`);
  }, 120_000);

  it("local disk: farm B and signed-out visitors can't fetch farm A's files", async () => {
    const urls = await uploadAsA();
    for (const url of urls) {
      const own = await request(app).get(url).set(as('a'));
      expect(own.status).toBe(200);
      expect(Buffer.from(own.body).equals(PNG)).toBe(true);
      expect(own.headers['cache-control']).toContain('private');

      const other = await request(app).get(url).set(as('b'));
      expect(other.status).toBe(404);
      expect(Buffer.isBuffer(other.body) && other.body.equals(PNG)).toBe(false);

      expect((await request(app).get(url)).status).toBe(401);
    }
    // Tricks with the path don't get round the check
    const key = urls[0].slice('/uploads/'.length);
    const sneaky = `/uploads/photos/${farm.b}/..%2f..%2f${key}`;
    expect((await request(app).get(sneaky).set(as('b'))).status).toBe(404);
  });

  it("S3: files go to the private bucket, and only farm A gets a signed link to them", async () => {
    useEnv(S3_ENV);
    const before = bucket.size;
    const urls = await uploadAsA();
    expect(bucket.size).toBe(before + 2);
    expect(fs.existsSync(path.join(uploadsDir, urls[0].slice('/uploads/'.length)))).toBe(false);
    for (const url of urls) {
      const key = decodeURIComponent(url.slice('/uploads/'.length));
      expect(bucket.has(key)).toBe(true);

      const own = await request(app).get(url).set(as('a')).redirects(0);
      expect(own.status).toBe(302);
      expect(own.headers.location).toMatch(/^https:\/\/test-bucket\.example\//);
      expect(own.headers.location).toContain(key);
      expect(own.headers['cache-control']).toContain('private');

      const other = await request(app).get(url).set(as('b')).redirects(0);
      expect(other.status).toBe(404);
      expect(other.headers.location).toBeUndefined();

      const visitor = await request(app).get(url).redirects(0);
      expect(visitor.status).toBe(401);
      expect(visitor.headers.location).toBeUndefined();
    }
  });

  it('older files without a farm in the key are served only to the farm whose row links to them', async () => {
    const legacyKey = `photos/TEST-legacy-${Date.now()}.png`;
    fs.mkdirSync(path.join(uploadsDir, 'photos'), { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, legacyKey), PNG);
    await systemDb.execute(sql`INSERT INTO jobs (farm_id, title, created_by_id, photo_urls)
      VALUES (${farm.a}, 'TEST legacy photo job', ${user.a}, ${JSON.stringify([`/uploads/${legacyKey}`])}::jsonb)`);

    expect((await request(app).get(`/uploads/${legacyKey}`).set(as('a'))).status).toBe(200);
    expect((await request(app).get(`/uploads/${legacyKey}`).set(as('b'))).status).toBe(404);
    expect((await request(app).get('/uploads/photos/TEST-nobody-links-to-this.png').set(as('a'))).status).toBe(404);
  });
});
