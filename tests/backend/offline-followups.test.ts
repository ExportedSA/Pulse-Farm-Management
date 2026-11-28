// What's left of the offline queue (build guide F4, follow-ups).
//
// Builds the real API in-process against the database in .env with a TEST farm, and checks that:
// a treatment recorded offline keeps the id the phone gave it, so a dose given before it sent can
// name it, and a dose sent twice is given once; a photo and a voice note each save in one go, once
// per request id, and a file of the wrong kind is refused (so the queue flags it rather than
// retrying it for ever); a pasture walk change is checked field by field; vaccination and drench
// records for a group load; and the old /api/sync routes, which wrote to any table, are gone.
// Files go to a temporary folder, removed at the end with the TEST rows.
// Needs DATABASE_URL and JWT_SECRET; skipped without them.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;

describe.skipIf(!live)('the offline queue: doses, photos, voice notes and the rest', () => {
  let app: express.Express;
  let systemDb: any;
  let farmId = '';
  let userId = '';
  let token = '';
  let animalId = '';
  let productId = '';
  let uploads = '';
  const savedEnv = { UPLOADS_DIR: process.env.UPLOADS_DIR, S3_BUCKET_NAME: process.env.S3_BUCKET_NAME };

  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const count = async (q: any) => Number((await one(q)).n);
  const as = (key?: string) => ({ Authorization: `Bearer ${token}`, ...(key ? { 'Idempotency-Key': key } : {}) });
  async function kept(key: string) {
    for (let i = 0; i < 60; i++) {
      const r = await one(sql`SELECT state FROM request_receipts WHERE farm_id = ${farmId} AND request_key = ${key}`);
      if (r?.state === 'done') return true;
      await new Promise(r => setTimeout(r, 100));
    }
    return false;
  }

  beforeAll(async () => {
    // Files on local disk in a folder of this test's own, never the farm's real store
    uploads = mkdtempSync(path.join(tmpdir(), 'pulse-test-uploads-'));
    process.env.UPLOADS_DIR = uploads;
    delete process.env.S3_BUCKET_NAME;

    ({ systemDb } = await import('../../server/db'));
    const { registerRoutes } = await import('../../server/routes');
    const { generateToken } = await import('../../server/middleware/auth');
    app = express();
    app.use(express.json());
    await registerRoutes(app);
    farmId = (await one(sql`INSERT INTO farms (name) VALUES ('TEST Followups Farm') RETURNING id`)).id;
    userId = (await one(sql`INSERT INTO users (name, email, password)
      VALUES ('TEST Followups worker', ${`test-followups-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
    await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farmId}, ${userId}, 'worker')`);
    token = generateToken({ userId, farmId, role: 'worker', name: 'TEST Followups worker' } as any);
    animalId = (await one(sql`INSERT INTO animals (farm_id, visual_id, sex, status) VALUES (${farmId}, 'TEST-FU1', 'female', 'active') RETURNING id`)).id;
    productId = (await one(sql`INSERT INTO products (farm_id, name, milk_withdrawal_days, meat_withdrawal_days) VALUES (${farmId}, 'TEST Followups Penicillin', 4, 10) RETURNING id`)).id;
  }, 120_000);

  afterAll(async () => {
    if (systemDb && farmId) {
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
    }
    if (uploads) rmSync(uploads, { recursive: true, force: true });
    for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }, 120_000);

  it('keeps the id the phone gave a treatment, and gives a dose sent twice once', async () => {
    const id = randomUUID();
    const created = await request(app).post('/api/treatments').set(as(randomUUID())).send({
      id, staffMember: 'TEST Followups', dateTime: new Date(Date.now() - 2 * 3600_000).toISOString(), cowId: 'TEST-FU1',
      condition: 'TEST condition', treatmentType: 'TEST Followups Penicillin', productId, totalDoses: 3,
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.id).toBe(id);

    // The dose waited in the queue behind it, named by that id; its answer was lost and it was sent again
    const key = randomUUID();
    const at = new Date(Date.now() - 3600_000).toISOString();
    const first = await request(app).post(`/api/treatments/${id}/doses`).set(as(key)).send({ administeredAt: at });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(await kept(key)).toBe(true);
    const again = await request(app).post(`/api/treatments/${id}/doses`).set(as(key)).send({ administeredAt: at });
    expect(again.headers['idempotent-replayed']).toBe('true');
    const row = await one(sql`SELECT doses_given FROM animal_treatments WHERE id = ${id}`);
    expect(row.doses_given).toBe(1);

    // The same id again, without a request id: refused, not a second treatment
    const dup = await request(app).post('/api/treatments').set(as()).send({
      id, staffMember: 'TEST Followups', dateTime: new Date().toISOString(), cowId: 'TEST-FU1', condition: 'TEST', treatmentType: 'x',
    });
    expect(dup.status).toBe(409);
    expect(await count(sql`SELECT count(*) n FROM animal_treatments WHERE farm_id = ${farmId}`)).toBe(1);
  }, 60_000);

  it('saves a photo in one go, once per request id, and refuses a file that is not a photo', async () => {
    const key = randomUUID();
    const post = () => request(app).post('/api/photos/attachments/with-photo').set(as(key))
      .field('animalId', animalId).field('caption', 'TEST sore foot')
      .attach('photo', Buffer.from('TEST photo bytes'), { filename: 'foot.jpg', contentType: 'image/jpeg' });
    const first = await post();
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body).toMatchObject({ animalId, caption: 'TEST sore foot', fileName: 'foot.jpg', mimeType: 'image/jpeg', uploadedBy: userId });
    expect(first.body.photoUrl).toMatch(/^\/uploads\/photos\//);
    expect(await kept(key)).toBe(true);
    const again = await post();
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(await count(sql`SELECT count(*) n FROM photo_attachments WHERE farm_id = ${farmId}`)).toBe(1);

    const wrong = await request(app).post('/api/photos/attachments/with-photo').set(as(randomUUID()))
      .attach('photo', Buffer.from('TEST'), { filename: 'notes.txt', contentType: 'text/plain' });
    expect(wrong.status).toBe(415);
  }, 60_000);

  it('saves a voice note in one go, recorded by the person signed in at the time it was made', async () => {
    const key = randomUUID();
    const recordedAt = new Date(Date.now() - 30 * 60_000).toISOString();
    const post = () => request(app).post('/api/voice-notes/with-audio').set(as(key))
      .field('animalId', animalId).field('duration', '12').field('recordedAt', recordedAt)
      .attach('audio', Buffer.from('TEST audio bytes'), { filename: 'recording.webm', contentType: 'audio/webm;codecs=opus' });
    const first = await post();
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body).toMatchObject({ animalId, duration: 12, recordedBy: userId });
    expect(new Date(first.body.recordedAt).getTime()).toBe(new Date(recordedAt).getTime());
    expect(await kept(key)).toBe(true);
    expect((await post()).headers['idempotent-replayed']).toBe('true');
    expect(await count(sql`SELECT count(*) n FROM voice_notes WHERE farm_id = ${farmId}`)).toBe(1);

    const future = await request(app).post('/api/voice-notes/with-audio').set(as())
      .field('recordedAt', '2999-01-01T00:00:00Z')
      .attach('audio', Buffer.from('TEST'), { filename: 'r.webm', contentType: 'audio/webm' });
    expect(future.status).toBe(400);
  }, 60_000);

  it('checks a pasture walk change field by field', async () => {
    const walk = await request(app).post('/api/pasture-walks/sessions').set(as()).send({ walkDate: '2026-11-20' });
    expect(walk.status).toBe(201);
    const ok = await request(app).put(`/api/pasture-walks/sessions/${walk.body.id}`).set(as()).send({ notes: 'TEST wet in the gateways' });
    expect(ok.status).toBe(200);
    expect(ok.body.notes).toBe('TEST wet in the gateways');
    for (const bad of [{ farmId: randomUUID() }, { id: randomUUID() }, { createdAt: '2020-01-01' }, { temperature: 'warm' }]) {
      const r = await request(app).put(`/api/pasture-walks/sessions/${walk.body.id}`).set(as()).send(bad);
      expect(r.status, JSON.stringify(bad)).toBe(400);
    }
    const row = await one(sql`SELECT farm_id FROM pasture_walk_sessions WHERE id = ${walk.body.id}`);
    expect(row.farm_id).toBe(farmId);
  });

  it("loads a group's vaccination and drench records", async () => {
    const groupId = (await one(sql`INSERT INTO animal_groups (farm_id, name) VALUES (${farmId}, 'TEST Followups mob') RETURNING id`)).id;
    await systemDb.execute(sql`INSERT INTO animal_group_members (group_id, animal_id) VALUES (${groupId}, ${animalId})`);
    await systemDb.execute(sql`INSERT INTO animal_treatments (farm_id, animal_id, cow_id, staff_member, staff_member_id, date_time, condition, treatment_type, category)
      VALUES (${farmId}, ${animalId}, 'TEST-FU1', 'TEST Followups', ${userId}, ${new Date().toISOString()}, 'TEST', 'TEST Followups vaccine', 'vaccination')`);
    const r = await request(app).get(`/api/vaccination/records/group/${groupId}`).set(as());
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.map((t: any) => t.treatmentType)).toEqual(['TEST Followups vaccine']);
  });

  it('no longer has the /api/sync routes that wrote to any table', async () => {
    const push = await request(app).post('/api/sync/push').set(as())
      .send({ ops: [{ table: 'animals', action: 'update', data: { name: 'TEST hijacked' }, where: { id: animalId } }] });
    expect(push.status).toBe(404);
    expect((await one(sql`SELECT name FROM animals WHERE id = ${animalId}`)).name).not.toBe('TEST hijacked');
    expect((await request(app).post('/api/sync/pull').set(as()).send({})).status).toBe(404);
  });
});
