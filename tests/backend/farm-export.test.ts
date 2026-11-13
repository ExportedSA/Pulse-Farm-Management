// The farm data export: the owner gets all of the farm's rows, and nothing from any other farm.
//
// Runs the real farms routes in-process against the database in .env, with two TEST farms that
// are removed at the end. Needs DATABASE_URL and JWT_SECRET; skipped without them.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { unzipSync, strFromU8 } from 'fflate';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;
const MARK_A = 'TESTEXPORTA9K';
const MARK_B = 'TESTEXPORTB4Z';
const stamp = Date.now();

const binary = (res: any, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
};

describe.skipIf(!live)('farm data export', () => {
  let app: express.Express;
  let systemDb: any;
  const farm = { a: '', b: '' };
  const user: Record<string, string> = {};
  const tokens: Record<string, string> = {};
  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];

  beforeAll(async () => {
    const dbm = await import('../../server/db');
    systemDb = dbm.systemDb;
    const auth = await import('../../server/middleware/auth');
    const farmsRouter = (await import('../../server/routes/farms')).default;
    app = express();
    app.use(express.json());
    app.use('/api/farms', auth.requireAuth as any, dbm.farmDbContext((req: any) => auth.getFarmId(req) ?? null), farmsRouter);

    for (const [k, mark] of [['a', MARK_A], ['b', MARK_B]] as const) {
      farm[k] = (await one(sql`INSERT INTO farms (name) VALUES (${`TEST Export Farm ${k}`}) RETURNING id`)).id;
      await one(sql`INSERT INTO animals (farm_id, name, cow_id) VALUES (${farm[k]}, ${mark}, ${mark}) RETURNING id`);
      await one(sql`INSERT INTO pastures (farm_id, name) VALUES (${farm[k]}, ${`${mark}, "quoted"`}) RETURNING id`);
      const tag = (await one(sql`INSERT INTO tags (farm_id, name, slug) VALUES (${farm[k]}, ${mark}, ${`${mark}-${stamp}`.toLowerCase()}) RETURNING id`)).id;
      // A child row with no farm_id of its own
      await systemDb.execute(sql`INSERT INTO taggings (tag_id, entity_type, entity_id) VALUES (${tag}, ${mark}, ${tag})`);
      await systemDb.execute(sql`INSERT INTO farm_invitations (farm_id, email, token_hash, expires_at) VALUES (${farm[k]}, ${`test-export-${k}-${stamp}@example.test`}, ${`${k}${stamp}`.padEnd(64, '0')}, now() + interval '1 day')`);
    }
    for (const who of ['owner', 'manager']) {
      user[who] = (await one(sql`INSERT INTO users (name, email, password) VALUES (${`TEST Export ${who}`}, ${`test-export-${who}-${stamp}@example.test`}, 'x') RETURNING id`)).id;
      await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farm.a}, ${user[who]}, ${who}::user_role)`);
      tokens[who] = auth.generateToken({ userId: user[who], farmId: farm.a, role: who });
    }
  }, 60_000);

  afterAll(async () => {
    if (!systemDb) return;
    const inFarms = sql.join([farm.a, farm.b].filter(Boolean).map(f => sql`${f}::uuid`), sql`, `);
    await systemDb.execute(sql`DELETE FROM taggings WHERE tag_id IN (SELECT id FROM tags WHERE farm_id IN (${inFarms}))`);
    for (const t of ['tags', 'animals', 'pastures', 'farm_invitations', 'farm_members']) {
      await systemDb.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE farm_id IN (${inFarms})`);
    }
    await systemDb.execute(sql`DELETE FROM farms WHERE id IN (${inFarms})`);
    await systemDb.execute(sql`DELETE FROM users WHERE email LIKE ${`test-export-%-${stamp}@example.test`}`);
  }, 60_000);

  it('only the owner can download it', async () => {
    const res = await request(app).get('/api/farms/current/export').set({ Authorization: `Bearer ${tokens.manager}` });
    expect(res.status).toBe(403);
  });

  it("holds the farm's rows and none of another farm's", async () => {
    const res = await request(app).get('/api/farms/current/export').set({ Authorization: `Bearer ${tokens.owner}` })
      .buffer(true).parse(binary);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="pulse-test-export-farm-a-\d{4}-\d{2}-\d{2}\.zip"/);

    const files = unzipSync(new Uint8Array(res.body));
    const text = Object.fromEntries(Object.entries(files).map(([name, data]) => [name, strFromU8(data)]));
    const everything = Object.values(text).join('\n');

    expect(Object.keys(text)).toEqual(expect.arrayContaining(['README.txt', 'farm.json', 'people.csv', 'people.json',
      'csv/animals.csv', 'json/animals.json', 'json/pastures.json', 'json/taggings.json', 'json/farm_invitations.json']));
    expect(everything).toContain(MARK_A);
    expect(everything).not.toContain(MARK_B);
    expect(everything).not.toContain(farm.b);

    expect(JSON.parse(text['json/animals.json']).map((a: any) => a.cow_id)).toEqual([MARK_A]);
    expect(JSON.parse(text['json/taggings.json']).map((t: any) => t.entity_type)).toEqual([MARK_A]);
    // Link secrets never leave the database
    expect(JSON.parse(text['json/farm_invitations.json'])[0]).not.toHaveProperty('token_hash');
    // CSV quoting survives commas and quotes
    expect(text['csv/pastures.csv']).toContain(`"${MARK_A}, ""quoted"""`);
    const people = JSON.parse(text['people.json']);
    expect(people.map((p: any) => p.role).sort()).toEqual(['manager', 'owner']);
    expect(people[0]).not.toHaveProperty('password');
  }, 120_000);
});
