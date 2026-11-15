// Milk withholding is counted from the LAST dose, to the minute, and a cow can't be put back in the vat
// before it ends (shared/withholding.ts, the treatment routes in server/routes.ts).
//
// The first part is the maths alone. The second builds the real API in-process against the database in
// .env with a TEST farm, user and product, gives a 3-dose course and checks what the server works out.
// All TEST rows are removed at the end. Needs DATABASE_URL and JWT_SECRET for the second part.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  clearAfterDosesGiven, farmDate, milkClearAt, parseFarmTime, returnToVatProblem,
} from '../../shared/withholding';

const HOUR = 3_600_000;

describe('milk withholding maths', () => {
  it('reads a date-and-time box as New Zealand time, summer and winter', () => {
    expect(parseFarmTime('2026-11-10T06:56')!.toISOString()).toBe('2026-11-09T17:56:00.000Z'); // NZDT +13
    expect(parseFarmTime('2026-06-10T06:56')!.toISOString()).toBe('2026-06-09T18:56:00.000Z'); // NZST +12
    expect(parseFarmTime('2026-11-10T06:56:00.000Z')!.toISOString()).toBe('2026-11-10T06:56:00.000Z');
    expect(parseFarmTime('not a time')).toBeNull();
    expect(farmDate(new Date('2026-11-09T17:56:00Z'))).toBe('2026-11-10');
  });

  it('counts from the last dose, not the first (MINDA cow 308: 3 doses, 120 hours)', () => {
    const course = { totalDoses: 3, milkWithholdingHours: 120 };
    // Still being treated: the clear time isn't known yet
    expect(milkClearAt({ ...course, dosesGiven: 2, lastDoseAt: '2026-11-11T07:00', dateTime: '2026-11-10T06:56' })).toBeNull();
    // Third dose given late on 13 Nov 06:38: clear 18 Nov 06:38, not 15 Nov (first dose + 5 days)
    const clear = milkClearAt({ ...course, dosesGiven: 3, lastDoseAt: '2026-11-13T06:38', dateTime: '2026-11-10T06:56' })!;
    expect(clear.toISOString()).toBe(parseFarmTime('2026-11-18T06:38')!.toISOString());
  });

  it('a single dose given when recorded counts from the record time; an unknown last dose is never guessed', () => {
    expect(milkClearAt({ totalDoses: 1, dosesGiven: 1, dateTime: '2026-11-10T06:56', milkWithholdingHours: 96 })!.toISOString())
      .toBe(parseFarmTime('2026-11-14T06:56')!.toISOString());
    expect(milkClearAt({ totalDoses: 3, dosesGiven: 3, dateTime: '2026-11-10T06:56', milkWithholdingHours: 96 })).toBeNull();
  });

  it('says why the cow can\'t go back in the vat yet', () => {
    const t = { totalDoses: 3, dosesGiven: 3, lastDoseAt: '2026-11-13T06:38', milkWithholdingHours: 120 };
    expect(returnToVatProblem({ ...t, dosesGiven: 2 }, parseFarmTime('2026-11-20T00:00')!)).toBe('1 of 3 doses still to give');
    expect(returnToVatProblem(t, parseFarmTime('2026-11-18T06:37')!)).toMatch(/^Milk withholding ends .*18 Nov.*6:38/);
    expect(returnToVatProblem(t, parseFarmTime('2026-11-18T06:38')!)).toBeNull();
    expect(returnToVatProblem({ totalDoses: 2, dosesGiven: 2, milkWithholdingHours: 48 }, new Date())).toMatch(/isn't recorded/);
  });

  it('a course stopped early still counts from the last dose given', () => {
    expect(clearAfterDosesGiven({ totalDoses: 3, dosesGiven: 1, lastDoseAt: '2026-11-10T06:56', milkWithholdingHours: 120 })!.toISOString())
      .toBe(parseFarmTime('2026-11-15T06:56')!.toISOString());
    expect(clearAfterDosesGiven({ totalDoses: 3, dosesGiven: 0, milkWithholdingHours: 120 })).toBeNull();
  });
});

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;

describe.skipIf(!live)('treatments on the server', () => {
  let app: express.Express;
  let systemDb: any;
  let farmId = '';
  let userId = '';
  let token = '';
  let productId = '';
  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    ({ systemDb } = await import('../../server/db'));
    const { registerRoutes } = await import('../../server/routes');
    const { generateToken } = await import('../../server/middleware/auth');
    app = express();
    app.use(express.json());
    await registerRoutes(app);
    farmId = (await one(sql`INSERT INTO farms (name) VALUES ('TEST Withholding Farm') RETURNING id`)).id;
    userId = (await one(sql`INSERT INTO users (name, email, password) VALUES ('TEST Withholding', ${`test-withholding-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
    await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farmId}, ${userId}, 'owner')`);
    token = generateToken({ userId, farmId, role: 'owner', name: 'TEST Withholding' });
    productId = (await one(sql`INSERT INTO products (farm_id, name, milk_withdrawal_days, meat_withdrawal_days) VALUES (${farmId}, 'TEST Intracillin', 5, 10) RETURNING id`)).id;
  }, 120_000);

  afterAll(async () => {
    if (!systemDb || !farmId) return;
    const tables = ((await systemDb.execute(sql`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'farm_id' AND table_name NOT IN ('farm_members', 'farms')`)) as any).rows.map((r: any) => r.table_name);
    for (let pass = 0; pass < 5; pass++) {
      const results = await Promise.allSettled(tables.map((t: string) =>
        systemDb.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE farm_id = ${farmId}`)));
      if (results.every(r => r.status === 'fulfilled')) break;
    }
    await systemDb.execute(sql`DELETE FROM farm_members WHERE farm_id = ${farmId}`);
    await systemDb.execute(sql`DELETE FROM farms WHERE id = ${farmId}`);
    if (userId) await systemDb.execute(sql`DELETE FROM users WHERE id = ${userId}`);
  }, 120_000);

  it('works out the clear time after the last dose, and refuses the vat until then', async () => {
    const ago = (h: number) => new Date(Date.now() - h * HOUR).toISOString();
    const created = await request(app).post('/api/treatments').set(auth()).send({
      staffMember: 'TEST Withholding', staffMemberId: userId, dateTime: ago(72), cowId: 'TEST-308',
      condition: 'Mastitis - Clinical', treatmentType: 'TEST Intracillin', productId,
      totalDoses: 3, dosesGiven: 1, lastDoseAt: ago(72),
      // What an older app would send: the end worked out from the first dose. The server ignores it.
      milkWithdrawalEndDate: farmDate(new Date(Date.now() + 48 * HOUR)),
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect(created.body.milkWithholdingHours).toBe(120); // from the product's 5 days
    expect(created.body.milkClearAt).toBeNull(); // 2 doses still to give
    expect(created.body.milkWithdrawalEndDate).toBeNull();

    expect((await request(app).post(`/api/treatments/${id}/return-to-vat`).set(auth()).send({})).body.error)
      .toBe('Not yet: 2 of 3 doses still to give');

    expect((await request(app).post(`/api/treatments/${id}/doses`).set(auth()).send({ administeredAt: ago(48) })).body.dosesGiven).toBe(2);
    expect((await request(app).post(`/api/treatments/${id}/doses`).set(auth()).send({ administeredAt: ago(60) })).status)
      .toBe(400); // before the previous dose
    const last = await request(app).post(`/api/treatments/${id}/doses`).set(auth()).send({ administeredAt: ago(24) });
    expect(last.status).toBe(200);
    expect(last.body.dosesGiven).toBe(3);
    // Last dose 24 hours ago + 120 hours = 96 hours from now (the first dose + 5 days would be 48 hours from now)
    const clearIn = (new Date(last.body.milkClearAt).getTime() - Date.now()) / HOUR;
    expect(clearIn).toBeGreaterThan(95.9);
    expect(clearIn).toBeLessThan(96.1);
    expect(last.body.milkWithdrawalEndDate).toBe(farmDate(new Date(last.body.milkClearAt)));
    expect((await request(app).post(`/api/treatments/${id}/doses`).set(auth()).send({})).status).toBe(409); // all given

    const early = await request(app).post(`/api/treatments/${id}/return-to-vat`).set(auth()).send({});
    expect(early.status).toBe(409);
    expect(early.body.error).toMatch(/^Not yet: Milk withholding ends /);
    expect((await one(sql`SELECT count(*)::int AS n FROM alerts WHERE treatment_id = ${id} AND type = 'rtv_ready' AND dismissed_at IS NULL`)).n).toBe(0);

    // The last dose was in fact 130 hours ago: now she's clear
    const moved = await request(app).put(`/api/treatments/${id}`).set(auth()).send({ lastDoseAt: ago(130) });
    expect(moved.status).toBe(200);
    expect(new Date(moved.body.milkClearAt).getTime()).toBeLessThan(Date.now());
    const back = await request(app).post(`/api/treatments/${id}/return-to-vat`).set(auth()).send({});
    expect(back.status).toBe(200);
    expect(back.body.status).toBe('completed');
    expect(back.body.returnedToVatAt).toBeTruthy();
    expect((await request(app).post(`/api/treatments/${id}/return-to-vat`).set(auth()).send({})).status).toBe(409);
  });
});
