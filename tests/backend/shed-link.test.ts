// The shed link (docs/shed-link-protocol.md, server/shed-link.ts, server/domain/shed.ts).
//
// Runs the real API and the /ws/shed link on a local port against the database in .env, with two TEST
// farms, each with a Stride gateway, and fake Stride clients. Checks that a link token only reaches its
// own farm; that Stride is sent its farm's herd, draft list and feed levels, worked out from TEST
// records and rules; that events are stored once and only seen by their farm; that commands go only to
// the farm's own Stride and its answer comes back; and that stopped gateways and unknown tokens are
// refused. TEST rows are removed at the end. Needs DATABASE_URL and JWT_SECRET; skipped without them.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import WebSocket from 'ws';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;
const EID = { a1: 'TESTSHEDA0001', a2: 'TESTSHEDA0002', b1: 'TESTSHEDB0001' };

type Stride = {
  ws: WebSocket;
  messages: any[];
  next: (type: string, after?: number) => Promise<any>;
  closed: Promise<number>;
  send: (msg: unknown) => void;
};

describe.skipIf(!live)('shed link', () => {
  let app: express.Express;
  let server: Server;
  let url = '';
  let systemDb: any;
  let withFarmDb: any;
  let db: any;
  let shedLink: any;
  const farm = { a: '', b: '' };
  const user: Record<string, string> = {};
  const token: Record<string, string> = {};
  const link = { a: '', b: '' };
  const gateway = { a: '', b: '' };
  const animal: Record<string, string> = {};
  let groupId = '';
  const strides: Stride[] = [];

  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const as = (who: string) => ({ Authorization: `Bearer ${token[who]}` });

  function connect(linkToken: string): Stride {
    const ws = new WebSocket(`${url}/ws/shed`, { headers: linkToken ? { Authorization: `Bearer ${linkToken}` } : {} });
    const messages: any[] = [];
    ws.on('message', data => messages.push(JSON.parse(data.toString())));
    const closed = new Promise<number>(resolve => ws.on('close', code => resolve(code)));
    const next = async (type: string, after = 0) => {
      for (let i = 0; i < 100; i++) {
        const found = messages.slice(after).find(m => m.type === type);
        if (found) return found;
        await new Promise(r => setTimeout(r, 50));
      }
      throw new Error(`no ${type} message`);
    };
    const send = (msg: unknown) => ws.send(JSON.stringify(msg));
    const s = { ws, messages, next, closed, send };
    strides.push(s);
    return s;
  }

  beforeAll(async () => {
    ({ systemDb, withFarmDb, db } = await import('../../server/db'));
    const { registerRoutes } = await import('../../server/routes');
    const { generateToken } = await import('../../server/middleware/auth');
    const { newLinkToken } = await import('../../server/domain/shed');
    ({ shedLink } = await import('../../server/shed-link'));
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    shedLink.initialize(server);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
    url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;

    for (const k of ['a', 'b'] as const) {
      farm[k] = (await one(sql`INSERT INTO farms (name) VALUES (${`TEST Shed Farm ${k.toUpperCase()}`}) RETURNING id`)).id;
      const t = newLinkToken();
      link[k] = t.token;
      gateway[k] = (await one(sql`INSERT INTO hardware_gateways (farm_id, name, kind, link_token_hash)
        VALUES (${farm[k]}, 'TEST shed', 'stride', ${t.hash}) RETURNING id`)).id;
    }
    for (const [who, f, role] of [['aOwner', 'a', 'owner'], ['aWorker', 'a', 'worker'], ['bOwner', 'b', 'owner']] as const) {
      user[who] = (await one(sql`INSERT INTO users (name, email, password)
        VALUES (${`TEST Shed ${who}`}, ${`test-shed-${who.toLowerCase()}-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
      await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farm[f]}, ${user[who]}, ${role})`);
      token[who] = generateToken({ userId: user[who], farmId: farm[f], role, name: `TEST Shed ${who}` } as any);
    }
    for (const [key, f, eid, vid] of [['a1', 'a', EID.a1, 'T901'], ['a2', 'a', EID.a2, 'T902'], ['b1', 'b', EID.b1, 'T901']] as const) {
      animal[key] = (await one(sql`INSERT INTO animals (farm_id, eid, visual_id, status)
        VALUES (${farm[f]}, ${eid}, ${vid}, 'active') RETURNING id`)).id;
    }
    groupId = (await one(sql`INSERT INTO animal_groups (farm_id, name) VALUES (${farm.a}, 'TEST Mob') RETURNING id`)).id;
    for (const k of ['a1', 'a2']) {
      await systemDb.execute(sql`INSERT INTO animal_group_members (farm_id, group_id, animal_id) VALUES (${farm.a}, ${groupId}, ${animal[k]})`);
    }
    // Cow a1 is on milk withholding until tomorrow
    const clear = new Date(Date.now() + 24 * 3600_000);
    await systemDb.execute(sql`INSERT INTO animal_treatments (farm_id, animal_id, cow_id, staff_member_id, staff_member, date_time,
      status, milk_withholding_hours, milk_clear_at)
      VALUES (${farm.a}, ${animal.a1}, 'T901', ${user.aOwner}, 'TEST', ${new Date().toISOString()}, 'active', 72, ${clear.toISOString()})`);
  });

  afterAll(async () => {
    for (const s of strides) s.ws.terminate();
    shedLink?.close();
    await new Promise(resolve => server?.close(resolve));
    if (!systemDb) return;
    const inFarms = sql.join([farm.a, farm.b].filter(Boolean).map(f => sql`${f}::uuid`), sql`, `);
    for (const table of ['shed_events', 'shed_draft_rules', 'shed_feed_levels', 'hardware_commands', 'animal_treatments',
      'animal_group_members', 'animal_groups', 'animals', 'hardware_gateways', 'farm_billing', 'farm_members']) {
      await systemDb.execute(sql`DELETE FROM ${sql.identifier(table)} WHERE farm_id IN (${inFarms})`);
    }
    const users = Object.values(user);
    if (users.length) await systemDb.execute(sql`DELETE FROM users WHERE id IN (${sql.join(users.map(u => sql`${u}::uuid`), sql`, `)})`);
    await systemDb.execute(sql`DELETE FROM farms WHERE id IN (${inFarms})`);
  });

  it('refuses an unknown link token, and one with none', async () => {
    expect(await connect('pst_not-a-real-token').closed).toBe(4401);
    expect(await connect('').closed).toBe(4401);
  });

  it('lets only owners and managers set draft rules and feed levels', async () => {
    const rule = { name: 'TEST Withheld', lane: 'LEFT', priority: 10, conditionType: 'milk_withholding' };
    expect((await request(app).post('/api/hardware/draft-rules').set(as('aWorker')).send(rule)).status).toBe(403);
    expect((await request(app).post('/api/hardware/draft-rules').set(as('aOwner')).send(rule)).status).toBe(201);
    const mob = { name: 'TEST Mob rule', lane: 'RIGHT', priority: 5, conditionType: 'in_group', groupId };
    expect((await request(app).post('/api/hardware/draft-rules').set(as('aOwner')).send(mob)).status).toBe(201);
    // Another farm's group can't be used
    expect((await request(app).post('/api/hardware/draft-rules').set(as('bOwner')).send(mob)).status).toBe(403);
    expect((await request(app).post('/api/hardware/feed-levels').set(as('aOwner')).send({ groupId, gramsPerVisit: 1500 })).status).toBe(201);
    // A rule needs what its condition uses
    const bad = await request(app).post('/api/hardware/draft-rules').set(as('aOwner')).send({ name: 'x', lane: 'LEFT', conditionType: 'heat' });
    expect(bad.status).toBe(400);
    expect((await request(app).get('/api/hardware/draft-rules').set(as('bOwner'))).body).toEqual([]);
  });

  it("sends a farm's Stride its own herd, draft list and feed levels", async () => {
    const stride = connect(link.a);
    const welcome = await stride.next('welcome');
    expect(welcome).toMatchObject({ protocol: 1, gatewayId: gateway.a, farmName: 'TEST Shed Farm A' });
    const snapshot = await stride.next('snapshot');
    expect(snapshot.herd.map((c: any) => c.eid).sort()).toEqual([EID.a1, EID.a2]);
    expect(snapshot.herd.find((c: any) => c.eid === EID.a1)).toMatchObject({ cowNumber: 'T901', groups: ['TEST Mob'] });
    // Highest priority first: the withheld cow goes left even though she's in the mob
    const a1 = snapshot.draft.find((d: any) => d.eid === EID.a1);
    expect(a1.lane).toBe('LEFT');
    expect(a1.reason).toMatch(/^TEST Withheld: Milk withholding until /);
    expect(snapshot.draft.find((d: any) => d.eid === EID.a2)).toMatchObject({ lane: 'RIGHT', reason: 'TEST Mob rule: In TEST Mob' });
    expect(snapshot.feed.map((f: any) => [f.eid, f.gramsPerVisit]).sort()).toEqual([[EID.a1, 1500], [EID.a2, 1500]]);
    expect(JSON.stringify(snapshot)).not.toContain(EID.b1);

    // A rule change reaches Stride straight away
    const seen = stride.messages.length;
    const rules = (await request(app).get('/api/hardware/draft-rules').set(as('aOwner'))).body;
    const mobRule = rules.find((r: any) => r.name === 'TEST Mob rule');
    expect((await request(app).put(`/api/hardware/draft-rules/${mobRule.id}`).set(as('aOwner'))
      .send({ ...mobRule, lane: 'STRAIGHT' })).status).toBe(200);
    const changed = await stride.next('snapshot', seen);
    expect(changed.draft.find((d: any) => d.eid === EID.a2).lane).toBe('STRAIGHT');
    expect(changed.version).not.toBe(snapshot.version);
  });

  it('stores events once, under the farm whose token sent them', async () => {
    const stride = connect(link.a);
    await stride.next('snapshot');
    const at = new Date().toISOString();
    const events = [
      { id: 'test-e1', kind: 'eid', at, eid: EID.a1, reader: 'gate' },
      { id: 'test-e2', kind: 'draft', at, eid: EID.a1, lane: 'LEFT', source: 'pulse', reason: 'TEST' },
      { id: 'test-e3', kind: 'feed', at, eid: EID.b1, bail: 1, targetGrams: 1500, actualGrams: 1495 },
    ];
    stride.send({ type: 'events', events });
    expect((await stride.next('events_ack')).ids.sort()).toEqual(['test-e1', 'test-e2', 'test-e3']);
    const seen = stride.messages.length;
    stride.send({ type: 'events', events });
    expect((await stride.next('events_ack', seen)).ids.sort()).toEqual(['test-e1', 'test-e2', 'test-e3']);

    const rows = (await systemDb.execute(sql`SELECT client_id, farm_id, animal_id FROM shed_events
      WHERE gateway_id = ${gateway.a} ORDER BY client_id`)).rows;
    expect(rows.map((r: any) => r.client_id)).toEqual(['test-e1', 'test-e2', 'test-e3']);
    expect(rows.every((r: any) => r.farm_id === farm.a)).toBe(true);
    expect(rows[0].animal_id).toBe(animal.a1);
    // Farm B's cow's tag, read on farm A, isn't matched to farm B's animal
    expect(rows[2].animal_id).toBeNull();

    expect((await request(app).get('/api/hardware/events').set(as('aOwner'))).body.length).toBe(3);
    expect((await request(app).get('/api/hardware/events').set(as('bOwner'))).body).toEqual([]);
    const seenByB = await withFarmDb(farm.b, async () => ((await db.execute(sql`SELECT id FROM shed_events`)) as any).rows.length);
    expect(seenByB).toBe(0);
  });

  it("sends a command only to the farm's own Stride, and returns its answer", async () => {
    const a = connect(link.a);
    const b = connect(link.b);
    await a.next('snapshot');
    await b.next('snapshot');
    const aSeen = a.messages.length;
    const bSeen = b.messages.length;

    const pending = request(app).post('/api/hardware/draft').set(as('aOwner')).send({ direction: 'left' });
    const command = await (async () => {
      const p = pending.then(r => r);
      const cmd = await a.next('command', aSeen);
      a.send({ type: 'command_result', id: cmd.id, ok: true });
      const res = await p;
      expect(res.status).toBe(200);
      return cmd;
    })();
    expect(command).toMatchObject({ action: 'draft', lane: 'LEFT' });
    expect(b.messages.slice(bSeen).some(m => m.type === 'command')).toBe(false);

    // Stride can say no (remote control off in the shed); the Shed page sees why
    const refused = request(app).post('/api/hardware/feed/start').set(as('aOwner')).send({ bail: 1, grams: 1500 }).then(r => r);
    const feed = await a.next('command', aSeen + 1);
    expect(feed).toMatchObject({ action: 'feed_start', bail: 1, grams: 1500 });
    a.send({ type: 'command_result', id: feed.id, ok: false, error: 'Remote control is off in Stride' });
    const res = await refused;
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Remote control is off in Stride');

    const log = (await request(app).get('/api/hardware/commands').set(as('aOwner'))).body;
    expect(log.map((r: any) => [r.command, r.ok]).sort()).toEqual([['draft', true], ['feed_start', false]]);
  });

  it('stops drafting and feeding by a group once the group is removed', async () => {
    const before = (await request(app).get('/api/hardware/snapshot').set(as('aOwner'))).body;
    expect(before.draft.map((d: any) => d.eid).sort()).toEqual([EID.a1, EID.a2]);
    expect(before.feed.length).toBe(2);
    expect((await request(app).delete(`/api/groups/${groupId}`).set(as('aOwner'))).status).toBe(204);
    const after = (await request(app).get('/api/hardware/snapshot').set(as('aOwner'))).body;
    // The withheld cow still goes left; the mob's rule and feed level no longer apply to anyone
    expect(after.draft.map((d: any) => [d.eid, d.lane])).toEqual([[EID.a1, 'LEFT']]);
    expect(after.feed).toEqual([]);
    expect(after.herd.find((c: any) => c.eid === EID.a2).groups).toEqual([]);
  });

  it("refuses a stopped gateway's token", async () => {
    await systemDb.execute(sql`UPDATE hardware_gateways SET is_active = false WHERE id = ${gateway.b}`);
    expect(await connect(link.b).closed).toBe(4403);
  });
});
