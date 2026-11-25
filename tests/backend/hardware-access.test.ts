// Shed hardware belongs to one farm (migration 0038, server/routes/hardware.ts).
//
// Builds the real API in-process against the database in .env. TEST farm A gets a simulated gateway
// (no real hardware is touched); TEST farm B gets none. Checks that farm B's owner and farm A's
// contractor can't reach farm A's hardware, that a worker can look but not send commands, that an
// owner's commands are logged and the log is farm A's alone, that farms can't add gateways
// themselves, and that demo mode can't be switched without the operator's token. TEST rows are
// removed at the end.
//
// Needs DATABASE_URL and JWT_SECRET; skipped without them.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;

describe.skipIf(!live)('shed hardware access', () => {
  let app: express.Express;
  let systemDb: any;
  let withFarmDb: any;
  let db: any;
  const farm = { a: '', b: '' };
  const user: Record<string, string> = {};
  const token: Record<string, string> = {};
  let gatewayId = '';
  const savedDemoToken = process.env.PULSE_DEMO_ADMIN_TOKEN;

  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const as = (who: string) => ({ Authorization: `Bearer ${token[who]}` });

  beforeAll(async () => {
    delete process.env.PULSE_DEMO_ADMIN_TOKEN;
    ({ systemDb, withFarmDb, db } = await import('../../server/db'));
    const { registerRoutes } = await import('../../server/routes');
    const { generateToken } = await import('../../server/middleware/auth');
    app = express();
    app.use(express.json());
    await registerRoutes(app);

    for (const k of ['a', 'b'] as const) {
      farm[k] = (await one(sql`INSERT INTO farms (name) VALUES (${`TEST Hardware Farm ${k.toUpperCase()}`}) RETURNING id`)).id;
    }
    const people: [string, 'a' | 'b', string][] = [
      ['aOwner', 'a', 'owner'], ['aWorker', 'a', 'worker'], ['aContractor', 'a', 'contractor'], ['bOwner', 'b', 'owner'],
    ];
    for (const [who, f, role] of people) {
      user[who] = (await one(sql`INSERT INTO users (name, email, password)
        VALUES (${`TEST Hardware ${who}`}, ${`test-hardware-${who.toLowerCase()}-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
      await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farm[f]}, ${user[who]}, ${role})`);
      token[who] = generateToken({ userId: user[who], farmId: farm[f], role, name: `TEST Hardware ${who}` } as any);
    }
    gatewayId = (await one(sql`INSERT INTO hardware_gateways (farm_id, name, simulated)
      VALUES (${farm.a}, 'TEST shed', true) RETURNING id`)).id;
  });

  afterAll(async () => {
    if (savedDemoToken === undefined) delete process.env.PULSE_DEMO_ADMIN_TOKEN;
    else process.env.PULSE_DEMO_ADMIN_TOKEN = savedDemoToken;
    if (!systemDb) return;
    const farms = [farm.a, farm.b].filter(Boolean);
    const inFarms = sql.join(farms.map(f => sql`${f}::uuid`), sql`, `);
    const users = Object.values(user);
    await systemDb.execute(sql`DELETE FROM hardware_commands WHERE farm_id IN (${inFarms})`);
    await systemDb.execute(sql`DELETE FROM hardware_gateways WHERE farm_id IN (${inFarms})`);
    await systemDb.execute(sql`DELETE FROM farm_billing WHERE farm_id IN (${inFarms})`);
    await systemDb.execute(sql`DELETE FROM farm_members WHERE farm_id IN (${inFarms})`);
    if (users.length) {
      await systemDb.execute(sql`DELETE FROM users WHERE id IN (${sql.join(users.map(u => sql`${u}::uuid`), sql`, `)})`);
    }
    await systemDb.execute(sql`DELETE FROM farms WHERE id IN (${inFarms})`);
  });

  it("refuses another farm's owner: their farm has no shed hardware", async () => {
    for (const [method, path] of [['get', '/api/hardware/status'], ['get', '/api/hardware/eid/recent'],
      ['post', '/api/hardware/feed/start'], ['post', '/api/hardware/draft'], ['get', '/api/hardware/commands']] as const) {
      const res = await (request(app) as any)[method](path).set(as('bOwner')).send({ bail: 1, grams: 500, direction: 'left' });
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(res.body.code).toBe('no_gateway');
    }
  });

  it('refuses a contractor on the farm that owns the hardware', async () => {
    expect((await request(app).get('/api/hardware/status').set(as('aContractor'))).status).toBe(403);
    expect((await request(app).post('/api/hardware/draft').set(as('aContractor')).send({ direction: 'left' })).status).toBe(403);
    expect((await request(app).post('/api/hardware/feed/start').set(as('aContractor')).send({ bail: 1, grams: 500 })).status).toBe(403);
  });

  it('lets a worker look but not send commands', async () => {
    expect((await request(app).get('/api/hardware/status').set(as('aWorker'))).status).toBe(200);
    expect((await request(app).post('/api/hardware/draft').set(as('aWorker')).send({ direction: 'left' })).status).toBe(403);
    expect((await request(app).post('/api/hardware/feed/stop').set(as('aWorker')).send({ bail: 1 })).status).toBe(403);
    expect((await request(app).get('/api/hardware/commands').set(as('aWorker'))).status).toBe(403);
  });

  it("logs an owner's commands, and nobody else's farm sees the log", async () => {
    const feed = await request(app).post('/api/hardware/feed/start').set(as('aOwner')).send({ bail: 1, grams: 500 });
    expect(feed.status).toBe(200);
    const draft = await request(app).post('/api/hardware/draft').set(as('aOwner')).send({ direction: 'left' });
    expect(draft.status).toBe(200);

    const log = await request(app).get('/api/hardware/commands').set(as('aOwner'));
    expect(log.status).toBe(200);
    expect(log.body.map((r: any) => r.command).sort()).toEqual(['draft', 'feed_start']);
    for (const row of log.body) {
      expect(row.userId).toBe(user.aOwner);
      expect(row.gatewayId).toBe(gatewayId);
      expect(row.ok).toBe(true);
    }

    // Farm B's own database connection sees none of farm A's gateway or log
    const seen = await withFarmDb(farm.b, async () => ({
      gateways: ((await db.execute(sql`SELECT id FROM hardware_gateways`)) as any).rows.length,
      commands: ((await db.execute(sql`SELECT id FROM hardware_commands`)) as any).rows.length,
    }));
    expect(seen).toEqual({ gateways: 0, commands: 0 });
  });

  it("doesn't let a farm add or change a gateway itself", async () => {
    await expect(withFarmDb(farm.b, () =>
      db.execute(sql`INSERT INTO hardware_gateways (farm_id, name, base_url) VALUES (${farm.b}, 'TEST', 'http://example.test')`)))
      .rejects.toThrow(/permission denied/);
    await expect(withFarmDb(farm.a, () =>
      db.execute(sql`UPDATE hardware_gateways SET base_url = 'http://example.test' WHERE id = ${gatewayId}`)))
      .rejects.toThrow(/permission denied/);
    await expect(withFarmDb(farm.a, () =>
      db.execute(sql`DELETE FROM hardware_commands WHERE farm_id = ${farm.a}`)))
      .rejects.toThrow(/permission denied/);
  });

  it("can't switch demo mode without the operator's token", async () => {
    const before = await request(app).get('/api/hardware/demo-mode').set(as('aOwner'));
    expect(before.body.canToggle).toBe(false);
    const res = await request(app).post('/api/hardware/demo-mode').set(as('aOwner')).send({ demo: !before.body.demo });
    expect(res.status).toBe(403);
    expect((await request(app).get('/api/hardware/demo-mode').set(as('aOwner'))).body.demo).toBe(before.body.demo);
  });
});
