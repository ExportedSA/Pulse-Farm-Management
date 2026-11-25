// The NAIT check, end to end through the real API: upload NAIT's list of animals at the location and
// check that Pulse flags animals that are in NAIT but not in Pulse's records, and animals in Pulse's
// records that NAIT doesn't have, both ways, without flagging animals that have legitimately left.
//
// Builds the API in-process against the database in .env with a TEST farm and made-up TEST animals,
// and removes them at the end. Needs DATABASE_URL and JWT_SECRET.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;

describe.skipIf(!live)('NAIT check against Pulse records', () => {
  let app: express.Express;
  let systemDb: any;
  let farmId = '';
  let userId = '';
  let token = '';
  const id: Record<string, string> = {};
  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ({ systemDb } = await import('../../server/db'));
    const { registerRoutes } = await import('../../server/routes');
    const { generateToken } = await import('../../server/middleware/auth');
    app = express();
    app.use(express.json());
    await registerRoutes(app);
    farmId = (await one(sql`INSERT INTO farms (name) VALUES ('TEST NAIT Farm') RETURNING id`)).id;
    userId = (await one(sql`INSERT INTO users (name, email, password) VALUES ('TEST NAIT', ${`test-nait-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
    await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farmId}, ${userId}, 'owner')`);
    token = generateToken({ userId, farmId, role: 'owner', name: 'TEST NAIT' });

    // Pulse's records (made-up TEST animals)
    const add = async (key: string, cols: { visual: string; eid?: string | null; status?: string; removed?: string | null }) => {
      id[key] = (await one(sql`
        INSERT INTO animals (farm_id, visual_id, eid, date_of_birth, sex, status, date_removed)
        VALUES (${farmId}, ${cols.visual}, ${cols.eid ?? null}, '2022-08-01', 'female', ${cols.status ?? 'active'}::animal_status, ${cols.removed ?? null})
        RETURNING id`)).id;
    };
    await add('both', { visual: 'TEST-22-101', eid: '982000000000101' });              // in NAIT too, matched by RFID
    await add('byTag', { visual: 'TEST-22-104', eid: null });                          // in NAIT too, matched by its NAIT visual tag
    await add('pulseOnly', { visual: 'TEST-22-102', eid: '982000000000102' });         // NOT in NAIT: should be flagged
    await add('soldEarlier', { visual: 'TEST-22-103', eid: '982000000000103', status: 'sold', removed: '2026-10-01' }); // left before the list: not flagged
  }, 120_000);

  afterAll(async () => {
    if (!systemDb || !farmId) return;
    const tables = ((await systemDb.execute(sql`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'farm_id' AND table_name NOT IN ('farm_members', 'farms')`)) as any).rows.map((r: any) => r.table_name);
    for (let pass = 0; pass < 6; pass++) {
      const results = await Promise.allSettled(tables.map((t: string) =>
        systemDb.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE farm_id = ${farmId}`)));
      if (results.every(r => r.status === 'fulfilled')) break;
    }
    await systemDb.execute(sql`DELETE FROM farm_members WHERE farm_id = ${farmId}`);
    await systemDb.execute(sql`DELETE FROM farms WHERE id = ${farmId}`);
    if (userId) await systemDb.execute(sql`DELETE FROM users WHERE id = ${userId}`);
  }, 120_000);

  it('flags animals in NAIT but not in Pulse, and in Pulse but not in NAIT', async () => {
    // NAIT's own export layout (shortened set of its headings); the animals are made up
    const head = ['NAIT RFID', 'NAIT Visual Tag Number', 'Date Of Birth', 'Gender', 'Date Of Death', 'Slaughter'];
    const row = (c: Record<string, string>) => head.map(h => `"${c[h] ?? ''}"`).join(',');
    const csv = [
      head.map(h => `"${h}"`).join(','),
      row({ 'NAIT RFID': '982 000000000101', 'NAIT Visual Tag Number': 'TEST-22-101', 'Gender': 'F' }),   // in Pulse (by RFID)
      row({ 'NAIT RFID': '982 000000000104', 'NAIT Visual Tag Number': 'TEST-22-104', 'Gender': 'F' }),   // in Pulse (by visual tag)
      row({ 'NAIT RFID': '982 000000000105', 'NAIT Visual Tag Number': 'TEST-22-105', 'Gender': 'F' }),   // NOT in Pulse: should be flagged
      row({ 'NAIT RFID': '982 000000000106', 'NAIT Visual Tag Number': 'TEST-22-106', 'Date Of Death': '01/09/2026' }), // dead in NAIT: not flagged
    ].join('\r\n');

    const upload = await request(app).post('/api/stock-recon/nait/snapshots').set(auth())
      .field('asAt', '2026-11-15').attach('file', Buffer.from(csv), { filename: 'TEST nait.csv', contentType: 'text/csv' });
    expect(upload.status).toBe(201);
    expect(upload.body.head).toBe(3); // the dead animal isn't counted as at the location

    const check = await request(app).get('/api/stock-recon/nait').set(auth());
    expect(check.status).toBe(200);
    const s = check.body.snapshot;
    expect(s.registerThatDay).toBe(3); // both, byTag, pulseOnly (the one sold in October had left)
    expect(s.matched).toBe(2);
    // In NAIT but not in Pulse's records
    expect(s.onlyInNaitCount).toBe(1);
    expect(s.onlyInNait.map((n: any) => n.visualId)).toEqual(['TEST-22-105']);
    // In Pulse's records but not in NAIT
    expect(s.onlyInPulseCount).toBe(1);
    expect(s.onlyInPulse.map((a: any) => a.id)).toEqual([id.pulseOnly]);
  });
});
