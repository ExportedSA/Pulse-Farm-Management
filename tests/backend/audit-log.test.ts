// The activity log (build guide F3; server/middleware/audit.ts, server/routes/audit.ts).
//
// Builds the real API in-process against the database in .env with two TEST farms. Checks that a
// create, an update and a delete each add a row naming the person, the kind of record and its id;
// that a refused request adds nothing; that field values and secret-looking field names are never
// kept; that a full export is logged; and that only the farm's owner can read the log, filtered by
// person and date, and only their own farm's. TEST rows are removed at the end.
// Needs DATABASE_URL and JWT_SECRET; skipped without them.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;

describe.skipIf(!live)('activity log', () => {
  let app: express.Express;
  let systemDb: any;
  const farm = { a: '', b: '' };
  const user: Record<string, string> = {};
  const token: Record<string, string> = {};
  let groupId = '';

  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const as = (who: string) => ({ Authorization: `Bearer ${token[who]}` });
  // The log is written once the response has gone, so wait for it
  async function logRows(where: any, atLeast = 1) {
    for (let i = 0; i < 60; i++) {
      const rows = (await systemDb.execute(sql`SELECT * FROM audit_events WHERE ${where} ORDER BY created_at`)).rows;
      if (rows.length >= atLeast) return rows;
      await new Promise(r => setTimeout(r, 100));
    }
    return (await systemDb.execute(sql`SELECT * FROM audit_events WHERE ${where} ORDER BY created_at`)).rows;
  }

  beforeAll(async () => {
    ({ systemDb } = await import('../../server/db'));
    const { registerRoutes } = await import('../../server/routes');
    const { generateToken } = await import('../../server/middleware/auth');
    app = express();
    app.use(express.json());
    await registerRoutes(app);
    for (const k of ['a', 'b'] as const) {
      farm[k] = (await one(sql`INSERT INTO farms (name) VALUES (${`TEST Audit Farm ${k.toUpperCase()}`}) RETURNING id`)).id;
    }
    for (const [who, f, role] of [['aOwner', 'a', 'owner'], ['aWorker', 'a', 'worker'], ['bOwner', 'b', 'owner']] as const) {
      user[who] = (await one(sql`INSERT INTO users (name, email, password)
        VALUES (${`TEST Audit ${who}`}, ${`test-audit-${who.toLowerCase()}-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
      await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farm[f]}, ${user[who]}, ${role})`);
      token[who] = generateToken({ userId: user[who], farmId: farm[f], role, name: `TEST Audit ${who}` } as any);
    }
  });

  afterAll(async () => {
    if (!systemDb) return;
    const inFarms = sql.join([farm.a, farm.b].filter(Boolean).map(f => sql`${f}::uuid`), sql`, `);
    for (const table of ['audit_events', 'animal_group_members', 'animal_groups', 'farm_billing', 'farm_members']) {
      await systemDb.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE farm_id IN (${inFarms})`);
    }
    const users = Object.values(user);
    if (users.length) await systemDb.execute(sql`DELETE FROM users WHERE id IN (${sql.join(users.map(u => sql`${u}::uuid`), sql`, `)})`);
    await systemDb.execute(sql`DELETE FROM farms WHERE id IN (${inFarms})`);
  });

  it('records a create, an update and a delete, with who made them', async () => {
    const created = await request(app).post('/api/groups').set(as('aWorker'))
      .send({ name: 'TEST Audit mob', password: 'not-kept', apiToken: 'not-kept' });
    expect(created.status).toBe(201);
    groupId = created.body.id;
    const [create] = await logRows(sql`farm_id = ${farm.a} AND action = 'create'`);
    expect(create).toMatchObject({ user_id: user.aWorker, record_type: 'groups', record_id: groupId, method: 'POST', path: '/api/groups' });
    expect(create.details.fields).toContain('name');
    // Field names that look like secrets are left out, and values are never kept
    expect(create.details.fields).not.toContain('password');
    expect(create.details.fields).not.toContain('apiToken');
    expect(JSON.stringify(create)).not.toContain('not-kept');
    expect(JSON.stringify(create)).not.toContain('TEST Audit mob');

    expect((await request(app).put(`/api/groups/${groupId}`).set(as('aOwner')).send({ name: 'TEST Audit mob 2' })).status).toBe(200);
    const [update] = await logRows(sql`farm_id = ${farm.a} AND action = 'update'`);
    expect(update).toMatchObject({ user_id: user.aOwner, record_type: 'groups', record_id: groupId });
    expect(update.details).toEqual({ fields: ['name'] });

    expect((await request(app).delete(`/api/groups/${groupId}`).set(as('aOwner'))).status).toBeLessThan(300);
    const [del] = await logRows(sql`farm_id = ${farm.a} AND action = 'delete'`);
    expect(del).toMatchObject({ user_id: user.aOwner, record_type: 'groups', record_id: groupId });
  });

  it('records nothing for a refused request', async () => {
    const bad = await request(app).post('/api/hardware/draft-rules').set(as('aOwner')).send({ name: 'x', lane: 'LEFT', conditionType: 'heat' });
    expect(bad.status).toBe(400);
    const worker = await request(app).post('/api/hardware/draft-rules').set(as('aWorker'))
      .send({ name: 'TEST', lane: 'LEFT', conditionType: 'milk_withholding' });
    expect(worker.status).toBe(403);
    await new Promise(r => setTimeout(r, 500));
    const rows = (await systemDb.execute(sql`SELECT id FROM audit_events WHERE farm_id = ${farm.a} AND path LIKE '%draft-rules%'`)).rows;
    expect(rows).toEqual([]);
  });

  it("records a full export of the farm's data", async () => {
    const res = await request(app).get('/api/farms/current/export').set(as('aOwner'));
    expect(res.status).toBe(200);
    const [exp] = await logRows(sql`farm_id = ${farm.a} AND action = 'export'`);
    expect(exp).toMatchObject({ user_id: user.aOwner, record_type: 'farms/export', record_id: farm.a });
  }, 120_000); // the export reads every farm table

  it('shows the owner the log, filtered by person and date, and no one else', async () => {
    const all = await request(app).get('/api/audit').set(as('aOwner'));
    expect(all.status).toBe(200);
    expect(all.body.map((r: any) => r.action).sort()).toEqual(['create', 'delete', 'export', 'update']);
    expect(all.body.find((r: any) => r.action === 'create').person).toBe('TEST Audit aWorker');

    const worker = await request(app).get(`/api/audit?userId=${user.aWorker}`).set(as('aOwner'));
    expect(worker.body.map((r: any) => r.action)).toEqual(['create']);

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date());
    expect((await request(app).get(`/api/audit?from=${today}&to=${today}`).set(as('aOwner'))).body.length).toBe(4);
    expect((await request(app).get('/api/audit?to=2000-01-01').set(as('aOwner'))).body).toEqual([]);
    expect((await request(app).get('/api/audit?action=delete').set(as('aOwner'))).body.length).toBe(1);

    expect((await request(app).get('/api/audit').set(as('aWorker'))).status).toBe(403);
    expect((await request(app).get('/api/audit').set(as('bOwner'))).body).toEqual([]);
    const people = await request(app).get('/api/audit/people').set(as('aOwner'));
    expect(people.body.map((p: any) => p.name).sort()).toEqual(['TEST Audit aOwner', 'TEST Audit aWorker']);
  });

  it("can't be changed or deleted by a farm's own requests", async () => {
    const { withFarmDb, db } = await import('../../server/db');
    await expect(withFarmDb(farm.a, () => db.execute(sql`DELETE FROM audit_events WHERE farm_id = ${farm.a}`)))
      .rejects.toThrow(/permission denied/);
    await expect(withFarmDb(farm.a, () => db.execute(sql`UPDATE audit_events SET action = 'view' WHERE farm_id = ${farm.a}`)))
      .rejects.toThrow(/permission denied/);
  });
});
