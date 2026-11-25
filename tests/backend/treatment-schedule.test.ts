// Treatments as MINDA keeps them (migration 0036): meat withholding counted from the last dose like the
// milk, a dose schedule with the next dose due, the separation date, the prescribing vet, and a
// diagnosis list that can be loaded.
//
// The first part is the maths alone. The second builds the real API in-process against the database in
// .env with TEST farms, users, products and vets, and checks what the server works out and refuses.
// All TEST rows are removed at the end. Needs DATABASE_URL and JWT_SECRET for the second part.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { meatClearAt, meatWithheldText, parseFarmTime } from '../../shared/withholding';
import { doseDueState, nextDoseDueAt, parseDoseInterval, plannedDoses } from '../../shared/dose-schedule';
import { parseDiagnosisCsv } from '../../shared/diagnosis-list';

const HOUR = 3_600_000;
const at = (s: string) => parseFarmTime(s)!.toISOString();

describe('dose schedule and meat withholding maths', () => {
  it('reads the interval between doses from a treatment plan', () => {
    expect(parseDoseInterval('2.2 mg/kg, intravenous injection, once daily for up to 3 days')).toBe(24);
    expect(parseDoseInterval('One tube per quarter twice daily for 3 milkings')).toBe(12);
    expect(parseDoseInterval('1 ml per 25 kg, repeat after 48 hours if required')).toBe(48);
    expect(parseDoseInterval('Inject every 72 hours, 3 doses')).toBe(72);
    expect(parseDoseInterval('Infuse one tube at 24 hour intervals')).toBe(24);
    expect(parseDoseInterval('Repeat every 2 days')).toBe(48);
    expect(parseDoseInterval('Drench 250-500 ml orally')).toBeNull();
    expect(parseDoseInterval('')).toBeNull();
  });

  it('plans the next doses from the last one given', () => {
    const course = { totalDoses: 3, doseIntervalHours: 24, dateTime: '2026-11-10T06:56' };
    // Nothing given yet: the first dose is due when recorded
    expect(nextDoseDueAt({ ...course, dosesGiven: 0 })!.toISOString()).toBe(at('2026-11-10T06:56'));
    // Second dose given late, at 09:10 next day: the third is due 24 hours after that, not after the first
    const t = { ...course, dosesGiven: 2, lastDoseAt: '2026-11-11T09:10' };
    expect(nextDoseDueAt(t)!.toISOString()).toBe(at('2026-11-12T09:10'));
    expect(plannedDoses({ ...course, dosesGiven: 1, lastDoseAt: '2026-11-10T06:56' }).map(d => [d.dose, d.dueAt.toISOString()]))
      .toEqual([[2, at('2026-11-11T06:56')], [3, at('2026-11-12T06:56')]]);
    // All given, or no interval for a later dose: nothing to plan
    expect(nextDoseDueAt({ ...course, dosesGiven: 3, lastDoseAt: '2026-11-12T06:56' })).toBeNull();
    expect(nextDoseDueAt({ totalDoses: 3, dosesGiven: 1, lastDoseAt: '2026-11-10T06:56' })).toBeNull();
  });

  it('says when a dose is due or overdue', () => {
    const due = parseFarmTime('2026-11-12T09:10')!;
    const t = { nextDoseDueAt: due };
    expect(doseDueState(t, new Date(due.getTime() - 5 * HOUR))).toBe('later');
    expect(doseDueState(t, new Date(due.getTime() - 1 * HOUR))).toBe('due');
    expect(doseDueState(t, new Date(due.getTime() + 0.25 * HOUR))).toBe('due');
    expect(doseDueState(t, new Date(due.getTime() + 1 * HOUR))).toBe('overdue');
    expect(doseDueState({ totalDoses: 1, dosesGiven: 1 })).toBeNull();
  });

  it('counts the meat withholding from the last dose, and from the last dose given when a course stops early', () => {
    const course = { totalDoses: 3, meatWithholdingHours: 10 * 24, dateTime: '2026-11-10T06:56' };
    expect(meatClearAt({ ...course, dosesGiven: 2, lastDoseAt: '2026-11-11T07:00' })).toBeNull();
    expect(meatClearAt({ ...course, dosesGiven: 3, lastDoseAt: '2026-11-12T07:00' })!.toISOString()).toBe(at('2026-11-22T07:00'));
    expect(meatClearAt({ ...course, dosesGiven: 2, lastDoseAt: '2026-11-11T07:00' }, true)!.toISOString()).toBe(at('2026-11-21T07:00'));
    expect(meatClearAt({ ...course, meatWithholdingHours: null, dosesGiven: 3, lastDoseAt: '2026-11-12T07:00' })).toBeNull();
    expect(meatWithheldText(at('2026-11-22T07:00'), parseFarmTime('2026-11-20T00:00')!)).toMatch(/^Not for slaughter until .*22 Nov.*7:00/);
    expect(meatWithheldText(at('2026-11-22T07:00'), parseFarmTime('2026-11-23T00:00')!)).toBeNull();
  });

  it('reads a diagnosis list from CSV, and refuses one it cannot', () => {
    const rows = parseDiagnosisCsv('﻿Code,Name,Category,Body Part\r\nA1,"Example, one",Group 1,udder\r\nA2,Example two,,\r\n');
    expect(rows).toEqual([
      { code: 'A1', name: 'Example, one', category: 'Group 1', bodyPart: 'udder' },
      { code: 'A2', name: 'Example two', category: null, bodyPart: null },
    ]);
    expect(() => parseDiagnosisCsv('code,category\nA1,x\n')).toThrow(/'name' column/);
    expect(() => parseDiagnosisCsv('name,body_part\nX,leg\n')).toThrow(/udder or foot/);
  });
});

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;

describe.skipIf(!live)('treatment schedule, meat withholding, vet and diagnoses on the server', () => {
  let app: express.Express;
  let systemDb: any;
  const farm = { a: '', b: '' };
  const user = { a: '', b: '' };
  const token = { a: '', b: '', worker: '' };
  let workerId = '';
  let productId = '';
  let vetA = '';
  let vetB = '';
  let animalId = '';
  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });
  const ago = (h: number) => new Date(Date.now() - h * HOUR).toISOString();

  beforeAll(async () => {
    ({ systemDb } = await import('../../server/db'));
    const { registerRoutes } = await import('../../server/routes');
    const { generateToken } = await import('../../server/middleware/auth');
    app = express();
    app.use(express.json());
    await registerRoutes(app);
    for (const k of ['a', 'b'] as const) {
      farm[k] = (await one(sql`INSERT INTO farms (name) VALUES (${`TEST Schedule Farm ${k.toUpperCase()}`}) RETURNING id`)).id;
      user[k] = (await one(sql`INSERT INTO users (name, email, password) VALUES ('TEST Schedule', ${`test-schedule-${k}-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
      await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farm[k]}, ${user[k]}, 'owner')`);
      token[k] = generateToken({ userId: user[k], farmId: farm[k], role: 'owner', name: 'TEST Schedule' });
    }
    workerId = (await one(sql`INSERT INTO users (name, email, password) VALUES ('TEST Schedule Worker', ${`test-schedule-w-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
    await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farm.a}, ${workerId}, 'worker')`);
    token.worker = generateToken({ userId: workerId, farmId: farm.a, role: 'worker', name: 'TEST Schedule Worker' });
    productId = (await one(sql`INSERT INTO products (farm_id, name, milk_withdrawal_days, meat_withdrawal_days) VALUES (${farm.a}, 'TEST Penicillin', 4, 10) RETURNING id`)).id;
    vetA = (await one(sql`INSERT INTO veterinarians (farm_id, name, clinic_name) VALUES (${farm.a}, 'TEST Vet A', 'TEST Clinic') RETURNING id`)).id;
    vetB = (await one(sql`INSERT INTO veterinarians (farm_id, name) VALUES (${farm.b}, 'TEST Vet B') RETURNING id`)).id;
    animalId = (await one(sql`INSERT INTO animals (farm_id, visual_id, sex, status) VALUES (${farm.a}, 'TEST-412', 'female', 'active') RETURNING id`)).id;
  }, 120_000);

  afterAll(async () => {
    if (!systemDb) return;
    for (const f of [farm.a, farm.b].filter(Boolean)) {
      const tables = ((await systemDb.execute(sql`
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'farm_id' AND table_name NOT IN ('farm_members', 'farms')`)) as any).rows.map((r: any) => r.table_name);
      for (let pass = 0; pass < 5; pass++) {
        const results = await Promise.allSettled(tables.map((t: string) =>
          systemDb.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE farm_id = ${f}`)));
        if (results.every(r => r.status === 'fulfilled')) break;
      }
      await systemDb.execute(sql`DELETE FROM farm_members WHERE farm_id = ${f}`);
      await systemDb.execute(sql`DELETE FROM farms WHERE id = ${f}`);
    }
    for (const u of [user.a, user.b, workerId].filter(Boolean)) await systemDb.execute(sql`DELETE FROM users WHERE id = ${u}`);
  }, 120_000);

  it('keeps the schedule, the meat withholding, the separation date and the vet, worked out from the doses', async () => {
    const created = await request(app).post('/api/treatments').set(as(token.a)).send({
      staffMember: 'TEST Schedule', staffMemberId: user.a, dateTime: ago(50), cowId: 'TEST-412',
      condition: 'TEST condition', treatmentType: 'TEST Penicillin', productId,
      totalDoses: 3, doseIntervalHours: 24, dosesGiven: 1, lastDoseAt: ago(50),
      separationDate: '2026-11-20', veterinarianId: vetA,
    });
    expect(created.status).toBe(201);
    const t = created.body;
    expect(t.animalId).toBe(animalId); // found from the cow number
    expect(t.vetName).toBe('TEST Vet A'); // kept with the treatment
    expect(t.separationDate).toBe('2026-11-20');
    expect(t.meatWithholdingHours).toBe(240); // the product's 10 days
    expect(t.meatClearAt).toBeNull(); // doses still to give
    // Second dose due 24 hours after the first: 26 hours ago, so overdue
    expect(Math.abs(new Date(t.nextDoseDueAt).getTime() - (Date.now() - 26 * HOUR))).toBeLessThan(60_000);
    expect((await one(sql`SELECT count(*)::int AS n FROM alerts WHERE treatment_id = ${t.id} AND type = 'treatment_overdue' AND dismissed_at IS NULL`)).n).toBe(1);

    // Second dose given 23 hours ago: the third is due in 1 hour, a day after the second, not after the first
    const second = await request(app).post(`/api/treatments/${t.id}/doses`).set(as(token.a)).send({ administeredAt: ago(23) });
    expect(second.status).toBe(200);
    expect(Math.abs(new Date(second.body.nextDoseDueAt).getTime() - (Date.now() + 1 * HOUR))).toBeLessThan(60_000);
    expect((await one(sql`SELECT count(*)::int AS n FROM alerts WHERE treatment_id = ${t.id} AND type = 'treatment_overdue' AND dismissed_at IS NULL`)).n).toBe(0);

    const last = await request(app).post(`/api/treatments/${t.id}/doses`).set(as(token.a)).send({ administeredAt: ago(1) });
    expect(last.body.nextDoseDueAt).toBeNull();
    // Meat: last dose 1 hour ago + 240 hours; milk: + 96 hours
    expect((new Date(last.body.meatClearAt).getTime() - Date.now()) / HOUR).toBeCloseTo(239, 0);
    expect((new Date(last.body.milkClearAt).getTime() - Date.now()) / HOUR).toBeCloseTo(95, 0);

    // Milk clear (the last dose was in fact 100 hours ago): back in the vat, but still not for slaughter
    await request(app).put(`/api/treatments/${t.id}`).set(as(token.a)).send({ lastDoseAt: ago(100) });
    const back = await request(app).post(`/api/treatments/${t.id}/return-to-vat`).set(as(token.a)).send({});
    expect(back.status).toBe(200);
    expect(back.body.status).toBe('completed');
    expect(new Date(back.body.meatClearAt).getTime()).toBeGreaterThan(Date.now());

    const withheld = await request(app).get('/api/treatment-withholdings').set(as(token.a));
    expect(withheld.status).toBe(200);
    expect(withheld.body.map((w: any) => w.id)).toContain(t.id);
    const onAnimal = await request(app).get(`/api/animals/${animalId}/treatments`).set(as(token.a));
    expect(onAnimal.body.find((x: any) => x.id === t.id)?.meatClearAt).toBeTruthy();
    // Farm B sees none of it
    expect((await request(app).get('/api/treatment-withholdings').set(as(token.b))).body.map((w: any) => w.id)).not.toContain(t.id);
  });

  it('a course moved to monitoring keeps its meat withholding from the last dose given, and has no next dose', async () => {
    const created = await request(app).post('/api/treatments').set(as(token.a)).send({
      staffMember: 'TEST Schedule', staffMemberId: user.a, dateTime: ago(30), cowId: 'TEST-NOT-IN-HERD',
      condition: 'TEST condition', treatmentType: 'TEST Penicillin', productId,
      totalDoses: 3, doseIntervalHours: 12, dosesGiven: 1, lastDoseAt: ago(30), meatWithholdingHours: 48,
    });
    expect(created.body.animalId).toBeNull(); // no such animal: not guessed
    expect(created.body.meatWithholdingHours).toBe(48); // entered, not the product's
    const monitored = await request(app).put(`/api/treatments/${created.body.id}`).set(as(token.a)).send({ monitoring: true, monitoringDays: 3 });
    expect(monitored.body.nextDoseDueAt).toBeNull();
    expect((new Date(monitored.body.meatClearAt).getTime() - Date.now()) / HOUR).toBeCloseTo(18, 0);
  });

  it("won't link a treatment to another farm's vet, and refuses a bad separation date", async () => {
    const base = {
      staffMember: 'TEST Schedule', staffMemberId: user.a, dateTime: ago(1), cowId: 'TEST-412',
      condition: 'TEST condition', treatmentType: 'TEST Penicillin', productId, totalDoses: 1,
    };
    const cross = await request(app).post('/api/treatments').set(as(token.a)).send({ ...base, veterinarianId: vetB });
    expect(cross.status).toBe(403);
    expect((await request(app).post('/api/treatments').set(as(token.a)).send({ ...base, separationDate: '20 Nov' })).status).toBe(400);
    expect((await request(app).post('/api/treatments').set(as(token.a)).send({ ...base, doseIntervalHours: 0 })).status).toBe(400);
    expect((await one(sql`SELECT count(*)::int AS n FROM animal_treatments WHERE veterinarian_id = ${vetB}`)).n).toBe(0);
  });

  it('loads a diagnosis list into the farm, in its order, updating rows already there; workers cannot', async () => {
    const rows = [
      { code: 'T2', name: 'TEST Diagnosis two', category: 'TEST Group' },
      { code: 'T1', name: 'TEST Diagnosis one', category: 'TEST Group', requiresBodyPart: true, bodyPartType: 'udder' },
    ];
    expect((await request(app).post('/api/conditions/import').set(as(token.worker)).send({ rows })).status).toBe(403);
    expect((await request(app).post('/api/conditions/import').set(as(token.a)).send({ rows: [] })).status).toBe(400);
    const first = await request(app).post('/api/conditions/import').set(as(token.a)).send({ rows });
    expect(first.body).toEqual({ added: 2, updated: 0 });
    // Same codes again, one renamed: updated, not added twice
    const again = await request(app).post('/api/conditions/import').set(as(token.a))
      .send({ rows: [{ ...rows[0], name: 'TEST Diagnosis two (renamed)' }, rows[1]] });
    expect(again.body).toEqual({ added: 0, updated: 2 });

    const listA = (await request(app).get('/api/conditions').set(as(token.a))).body;
    const mine = listA.filter((c: any) => c.category === 'TEST Group');
    expect(mine.map((c: any) => [c.code, c.name])).toEqual([['T2', 'TEST Diagnosis two (renamed)'], ['T1', 'TEST Diagnosis one']]);
    expect(mine[1].requiresBodyPart).toBe(true);
    expect(mine[1].bodyPartType).toBe('udder');
    // Farm B's list doesn't have them
    expect((await request(app).get('/api/conditions').set(as(token.b))).body.some((c: any) => c.category === 'TEST Group')).toBe(false);
  });

  it("offers MINDA's diagnosis list only, one name for each condition (0037)", async () => {
    // A farm's own name without a MINDA code isn't offered
    await systemDb.execute(sql`INSERT INTO conditions (farm_id, name) VALUES (${farm.b}, 'TEST own name')`);
    for (const t of [token.a, token.b]) {
      const list = (await request(app).get('/api/conditions').set(as(t))).body;
      expect(list.every((c: any) => c.code)).toBe(true);
      expect(list.some((c: any) => c.name === 'TEST own name' || c.name === 'Mastitis' || c.name === 'Lameness')).toBe(false);
      const minda = list.filter((c: any) => !c.farmId);
      expect(minda.length).toBe(116);
      const mc = minda.find((c: any) => c.code === 'MC');
      expect([mc.name, mc.category, mc.bodyPartType]).toEqual(['Mastitis - Clinical', 'Udder Disorder', 'udder']);
      expect(minda.find((c: any) => c.code === 'LM')?.bodyPartType).toBe('foot');
    }
  });

  it('keeps milk withholding in milkings, the amount per dose without a batch, and works out the hours', async () => {
    const created = await request(app).post('/api/treatments').set(as(token.a)).send({
      staffMember: 'TEST Schedule', staffMemberId: user.a, dateTime: ago(1), cowId: 'TEST-412',
      condition: 'Mastitis - Clinical', treatmentType: 'TEST Penicillin', productId, totalDoses: 1,
      dosesGiven: 1, lastDoseAt: ago(1), milkWithholdingMilkings: 6, milkingIntervalHours: 12,
      doseAmount: '1', doseUnit: 'tube', bodyPart: 'LF,RR',
    });
    expect(created.status).toBe(201);
    const t = created.body;
    expect([t.milkWithholdingMilkings, t.milkingIntervalHours, t.milkWithholdingHours]).toEqual([6, 12, 72]);
    expect((new Date(t.milkClearAt).getTime() - Date.now()) / HOUR).toBeCloseTo(71, 0);
    expect([t.doseAmount, t.doseUnit, t.batchId, t.bodyPart]).toEqual(['1.00', 'tube', null, 'LF,RR']);

    // Back to hours: the milkings go
    const hours = await request(app).put(`/api/treatments/${t.id}`).set(as(token.a))
      .send({ milkWithholdingHours: 24, milkWithholdingMilkings: null, milkingIntervalHours: null });
    expect([hours.body.milkWithholdingMilkings, hours.body.milkWithholdingHours]).toEqual([null, 24]);
    expect((await request(app).post('/api/treatments').set(as(token.a)).send({
      staffMember: 'TEST Schedule', staffMemberId: user.a, dateTime: ago(1), cowId: 'TEST-412',
      condition: 'Mastitis - Clinical', milkWithholdingMilkings: 6, milkingIntervalHours: 0,
    })).status).toBe(400);
  });
});
