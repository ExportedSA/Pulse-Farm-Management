// Medicines (the treatment form's products) are changed and removed only by a farm's owners and
// managers, and only on their own farm (server/routes.ts, PUT and DELETE /api/products/:id).
//
// Builds the real API in-process against the database in .env, with two TEST farms. TEST rows are
// removed at the end. Needs DATABASE_URL and JWT_SECRET; skipped without them.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;

describe.skipIf(!live)('medicine products: who can change them', () => {
  let app: express.Express;
  let systemDb: any;
  const farm = { a: '', b: '' };
  const user: Record<string, string> = {};
  const token: Record<string, string> = {};
  const product = { a: '', b: '' };

  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const as = (who: string) => ({ Authorization: `Bearer ${token[who]}` });

  beforeAll(async () => {
    ({ systemDb } = await import('../../server/db'));
    const { registerRoutes } = await import('../../server/routes');
    const { generateToken } = await import('../../server/middleware/auth');
    app = express();
    app.use(express.json());
    await registerRoutes(app);

    for (const k of ['a', 'b'] as const) {
      farm[k] = (await one(sql`INSERT INTO farms (name) VALUES (${`TEST Products Farm ${k.toUpperCase()}`}) RETURNING id`)).id;
      product[k] = (await one(sql`INSERT INTO products (farm_id, name, milk_withdrawal_days)
        VALUES (${farm[k]}, ${`TEST Medicine ${k.toUpperCase()}`}, 4) RETURNING id`)).id;
    }
    for (const [who, f, role] of [['aOwner', 'a', 'owner'], ['aWorker', 'a', 'worker'], ['bManager', 'b', 'manager']] as const) {
      user[who] = (await one(sql`INSERT INTO users (name, email, password)
        VALUES (${`TEST Products ${who}`}, ${`test-products-${who.toLowerCase()}-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
      await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farm[f]}, ${user[who]}, ${role})`);
      token[who] = generateToken({ userId: user[who], farmId: farm[f], role, name: `TEST Products ${who}` } as any);
    }
  });

  afterAll(async () => {
    if (!systemDb) return;
    const inFarms = sql.join([farm.a, farm.b].filter(Boolean).map(f => sql`${f}::uuid`), sql`, `);
    await systemDb.execute(sql`DELETE FROM products WHERE farm_id IN (${inFarms})`);
    await systemDb.execute(sql`DELETE FROM farm_billing WHERE farm_id IN (${inFarms})`);
    await systemDb.execute(sql`DELETE FROM farm_members WHERE farm_id IN (${inFarms})`);
    const users = Object.values(user);
    if (users.length) await systemDb.execute(sql`DELETE FROM users WHERE id IN (${sql.join(users.map(u => sql`${u}::uuid`), sql`, `)})`);
    await systemDb.execute(sql`DELETE FROM farms WHERE id IN (${inFarms})`);
  });

  it("refuses a worker's change and removal", async () => {
    const put = await request(app).put(`/api/products/${product.a}`).set(as('aWorker')).send({ name: 'TEST renamed' });
    expect(put.status).toBe(403);
    expect((await request(app).delete(`/api/products/${product.a}`).set(as('aWorker'))).status).toBe(403);
    const row = await one(sql`SELECT name, deleted_at FROM products WHERE id = ${product.a}`);
    expect(row).toEqual({ name: 'TEST Medicine A', deleted_at: null });
  });

  it("doesn't let another farm's manager change or remove it", async () => {
    expect((await request(app).put(`/api/products/${product.a}`).set(as('bManager')).send({ name: 'TEST renamed' })).status).toBe(404);
    expect((await request(app).delete(`/api/products/${product.a}`).set(as('bManager'))).status).toBe(404);
    const row = await one(sql`SELECT name, deleted_at FROM products WHERE id = ${product.a}`);
    expect(row).toEqual({ name: 'TEST Medicine A', deleted_at: null });
  });

  it("saves an owner's change, and removes the product from the list", async () => {
    const put = await request(app).put(`/api/products/${product.a}`).set(as('aOwner')).send({ name: 'TEST Medicine A2', milkWithdrawalDays: 5 });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ name: 'TEST Medicine A2', milkWithdrawalDays: 5 });

    expect((await request(app).delete(`/api/products/${product.a}`).set(as('aOwner'))).status).toBe(204);
    const list = await request(app).get('/api/products').set(as('aOwner'));
    expect(list.body.map((p: any) => p.id)).not.toContain(product.a);
    // Kept (soft-deleted), so past treatments that used it still show its name
    expect((await one(sql`SELECT deleted_at FROM products WHERE id = ${product.a}`)).deleted_at).not.toBeNull();
  });
});
