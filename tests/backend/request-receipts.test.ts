// One offline queue for every form (build guide F4; server/middleware/request-receipts.ts).
//
// Builds the real API in-process against the database in .env with two TEST farms. A save sent again
// with the same request id (Idempotency-Key), as a phone's offline queue does after a lost answer,
// must make one record and get the first answer back. Checks this for a group, a treatment, a mob
// move, a pasture walk and a hazard; that a refused save frees its id; that an id can't be reused by
// someone else or for another address; that two at once make one record; that another farm's ids are
// its own; and that a repeat isn't logged twice. Moves and pasture covers keep the time they were
// recorded on the phone. TEST rows are removed at the end.
// Needs DATABASE_URL and JWT_SECRET; skipped without them.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;

describe.skipIf(!live)('a save sent twice is done once', () => {
  let app: express.Express;
  let systemDb: any;
  const farm = { a: '', b: '' };
  const user: Record<string, string> = {};
  const token: Record<string, string> = {};
  let productId = '';
  let animalId = '';
  let pastureId = '';

  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const count = async (q: any) => Number((await one(q)).n);
  const as = (who: string, key?: string) => ({ Authorization: `Bearer ${token[who]}`, ...(key ? { 'Idempotency-Key': key } : {}) });
  // The answer is kept once the response has gone, so wait for it
  async function kept(f: string, key: string) {
    for (let i = 0; i < 60; i++) {
      const r = await one(sql`SELECT state FROM request_receipts WHERE farm_id = ${f} AND request_key = ${key}`);
      if (r?.state === 'done') return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }
  /** Sends the same save twice with one request id; the second must be the first's answer */
  async function twice(who: string, f: string, method: 'post' | 'put', url: string, body: any) {
    const key = randomUUID();
    const first = await (request(app) as any)[method](url).set(as(who, key)).send(body);
    expect(first.status, JSON.stringify(first.body)).toBeLessThan(300);
    expect(await kept(f, key)).toBe(true);
    const again = await (request(app) as any)[method](url).set(as(who, key)).send(body);
    expect(again.status).toBe(first.status);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(again.body).toEqual(first.body);
    return first;
  }

  beforeAll(async () => {
    ({ systemDb } = await import('../../server/db'));
    const { registerRoutes } = await import('../../server/routes');
    const { generateToken } = await import('../../server/middleware/auth');
    app = express();
    app.use(express.json());
    await registerRoutes(app);
    for (const k of ['a', 'b'] as const) {
      farm[k] = (await one(sql`INSERT INTO farms (name) VALUES (${`TEST Receipts Farm ${k.toUpperCase()}`}) RETURNING id`)).id;
    }
    for (const [who, f, role] of [['aOwner', 'a', 'owner'], ['aWorker', 'a', 'worker'], ['bOwner', 'b', 'owner']] as const) {
      user[who] = (await one(sql`INSERT INTO users (name, email, password)
        VALUES (${`TEST Receipts ${who}`}, ${`test-receipts-${who.toLowerCase()}-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
      await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farm[f]}, ${user[who]}, ${role})`);
      token[who] = generateToken({ userId: user[who], farmId: farm[f], role, name: `TEST Receipts ${who}` } as any);
    }
    productId = (await one(sql`INSERT INTO products (farm_id, name, milk_withdrawal_days, meat_withdrawal_days) VALUES (${farm.a}, 'TEST Receipts Penicillin', 4, 10) RETURNING id`)).id;
    animalId = (await one(sql`INSERT INTO animals (farm_id, visual_id, sex, status) VALUES (${farm.a}, 'TEST-R1', 'female', 'active') RETURNING id`)).id;
    pastureId = (await one(sql`INSERT INTO pastures (farm_id, name) VALUES (${farm.a}, 'TEST Receipts paddock') RETURNING id`)).id;
  }, 120_000);

  afterAll(async () => {
    if (!systemDb) return;
    for (const f of [farm.a, farm.b].filter(Boolean)) {
      const tables = ((await systemDb.execute(sql`
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'farm_id' AND table_name NOT IN ('farm_members', 'farms')`)) as any).rows.map((r: any) => r.table_name);
      for (let pass = 0; pass < 6; pass++) {
        const results = await Promise.allSettled(tables.map((t: string) =>
          systemDb.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE farm_id = ${f}`)));
        if (results.every(r => r.status === 'fulfilled')) break;
      }
      await systemDb.execute(sql`DELETE FROM farm_members WHERE farm_id = ${f}`);
      await systemDb.execute(sql`DELETE FROM farms WHERE id = ${f}`);
    }
    for (const u of Object.values(user)) await systemDb.execute(sql`DELETE FROM users WHERE id = ${u}`);
  }, 120_000);

  it('makes one group from a save sent twice, and logs it once', async () => {
    const first = await twice('aWorker', farm.a, 'post', '/api/groups', { name: 'TEST Receipts mob' });
    expect(await count(sql`SELECT count(*) n FROM animal_groups WHERE farm_id = ${farm.a} AND name = 'TEST Receipts mob'`)).toBe(1);
    await new Promise(r => setTimeout(r, 500));
    expect(await count(sql`SELECT count(*) n FROM audit_events WHERE farm_id = ${farm.a} AND record_id = ${first.body.id}`)).toBe(1);
  });

  it('makes one treatment, one move, one walk and one hazard from saves sent twice', async () => {
    const recordedAt = new Date(Date.now() - 3 * 3600_000).toISOString();
    await twice('aWorker', farm.a, 'post', '/api/treatments', {
      staffMember: 'TEST Receipts', staffMemberId: user.aWorker, dateTime: recordedAt, cowId: 'TEST-R1',
      condition: 'TEST condition', treatmentType: 'TEST Receipts Penicillin', productId, totalDoses: 1,
    });
    expect(await count(sql`SELECT count(*) n FROM animal_treatments WHERE farm_id = ${farm.a}`)).toBe(1);

    // A move recorded three hours ago keeps that time
    await twice('aWorker', farm.a, 'post', '/api/pasture-movements/bulk', {
      animalIds: [animalId], toPastureId: pastureId, movedBy: 'TEST Receipts', movedAt: recordedAt,
    });
    // moved_at has no time zone and is kept in UTC, like the default now() on the server
    const moves = (await systemDb.execute(sql`SELECT to_char(moved_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS at, moved_by FROM pasture_movements WHERE animal_id = ${animalId}`)).rows;
    expect(moves).toHaveLength(1);
    expect(moves[0].at).toBe(recordedAt.slice(0, 19));
    expect(moves[0].moved_by).toBe(user.aWorker); // the person signed in, not a name sent
    expect((await request(app).post('/api/pasture-movements/bulk').set(as('aWorker'))
      .send({ animalIds: [animalId], toPastureId: pastureId, movedBy: 'x', movedAt: '2999-01-01T00:00:00Z' })).status).toBe(400);

    // A walk started offline brings its own id; its covers name it and keep the day they were measured
    const walkId = randomUUID();
    const walk = await twice('aWorker', farm.a, 'post', '/api/pasture-walks/sessions', { id: walkId, walkDate: '2026-11-20', recordedBy: user.aWorker });
    expect(walk.body.id).toBe(walkId);
    await twice('aWorker', farm.a, 'post', '/api/pasture-walks/measurements/quick', {
      sessionId: walkId, measurementDate: '2026-11-20', measurementTime: '07:15', measurements: [{ pastureId, coverKgDmHa: 2400 }],
    });
    const covers = (await systemDb.execute(sql`SELECT measurement_date::text d, measurement_time t FROM pasture_cover_measurements WHERE session_id = ${walkId}`)).rows;
    expect(covers).toEqual([{ d: '2026-11-20', t: '07:15' }]);

    await twice('aWorker', farm.a, 'post', '/api/compliance/hazards', { title: 'TEST Receipts hazard', type: 'terrain', riskLevel: 3 });
    expect(await count(sql`SELECT count(*) n FROM farm_hazards WHERE farm_id = ${farm.a} AND title = 'TEST Receipts hazard'`)).toBe(1);
  }, 60_000);

  it('frees the id of a refused save, so the corrected save goes through', async () => {
    const key = randomUUID();
    const bad = await request(app).post('/api/pasture-walks/sessions').set(as('aOwner', key)).send({});
    expect(bad.status).toBe(400);
    await new Promise(r => setTimeout(r, 300));
    const good = await request(app).post('/api/pasture-walks/sessions').set(as('aOwner', key)).send({ walkDate: '2026-11-21' });
    expect(good.status).toBe(201);
    expect(good.headers['idempotent-replayed']).toBeUndefined();
  });

  it("won't let an id be used by someone else or for another address", async () => {
    const key = randomUUID();
    expect((await request(app).post('/api/groups').set(as('aOwner', key)).send({ name: 'TEST Receipts mob 2' })).status).toBe(201);
    expect(await kept(farm.a, key)).toBe(true);
    const other = await request(app).post('/api/groups').set(as('aWorker', key)).send({ name: 'TEST Receipts mob 2' });
    expect(other.status).toBe(422);
    const elsewhere = await request(app).post('/api/compliance/hazards').set(as('aOwner', key)).send({ title: 'TEST x', type: 'terrain', riskLevel: 1 });
    expect(elsewhere.status).toBe(422);
    expect((await request(app).post('/api/groups').set(as('aOwner', 'short')).send({ name: 'x' })).status).toBe(400);
  });

  it('makes one record when the same save arrives twice at once', async () => {
    const key = randomUUID();
    const body = { name: 'TEST Receipts mob 3' };
    const [x, y] = await Promise.all([
      request(app).post('/api/groups').set(as('aOwner', key)).send(body),
      request(app).post('/api/groups').set(as('aOwner', key)).send(body),
    ]);
    const statuses = [x.status, y.status].sort();
    expect(statuses[0]).toBe(201);
    expect([201, 409]).toContain(statuses[1]);
    if (statuses[1] === 409) expect([x, y].find(r => r.status === 409)!.body.code).toBe('request_in_progress');
    await new Promise(r => setTimeout(r, 300));
    expect(await count(sql`SELECT count(*) n FROM animal_groups WHERE farm_id = ${farm.a} AND name = 'TEST Receipts mob 3'`)).toBe(1);
  });

  it("keeps each farm's ids to itself", async () => {
    const key = randomUUID();
    expect((await request(app).post('/api/groups').set(as('aOwner', key)).send({ name: 'TEST Receipts shared id' })).status).toBe(201);
    const b = await request(app).post('/api/groups').set(as('bOwner', key)).send({ name: 'TEST Receipts shared id' });
    expect(b.status).toBe(201);
    expect(b.headers['idempotent-replayed']).toBeUndefined();
    expect(await count(sql`SELECT count(*) n FROM animal_groups WHERE farm_id = ${farm.b} AND name = 'TEST Receipts shared id'`)).toBe(1);
    // A farm's own requests can't read or change the receipts
    const { withFarmDb, db } = await import('../../server/db');
    await expect(withFarmDb(farm.a, () => db.execute(sql`SELECT * FROM request_receipts`))).rejects.toThrow(/permission denied/);
  });
});
