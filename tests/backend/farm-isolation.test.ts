// Each farm sees and changes only its own data.
//
// Builds the real API in-process against the database in .env, makes two TEST farms, puts a
// marker in a row of every kind for farm B, then calls every GET route as farm A (with farm B's
// ids filled into the path) and checks the marker never comes back. Routes are read from the
// router, so a new route is covered without being listed here. All TEST rows are removed at
// the end.
//
// Needs DATABASE_URL and JWT_SECRET; skipped without them.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';

const MARK = 'TESTBSECRET7Q';
const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;

// Calls out to other services, or change something just by being read
const SKIP = [/^\/api\/weather/, /^\/api\/integrations/, /^\/api\/gallagher/, /^\/api\/hardware/, /^\/api\/iot/,
  /^\/api\/auth/, /^\/api\/visitor\/qr/, /^\/api\/health$/, /^\/api\/health\/db$/];

type Route = { method: string; path: string };

function mountOf(layer: any): string {
  if (layer.regexp?.fast_slash) return '';
  const src: string = layer.regexp?.source ?? '';
  const path = src.replace(/^\^/, '').replace(/\\\/\?\(\?=\\\/\|\$\)$/i, '').replace(/\\\//g, '/');
  return /[()[\]|?*+]/.test(path) ? '' : path;
}

function routesOf(stack: any[], prefix = ''): Route[] {
  const out: Route[] = [];
  for (const layer of stack) {
    if (layer.route && typeof layer.route.path === 'string') {
      for (const method of Object.keys(layer.route.methods)) out.push({ method, path: prefix + layer.route.path });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      out.push(...routesOf(layer.handle.stack, prefix + mountOf(layer)));
    }
  }
  return out;
}

describe.skipIf(!live)('farm data isolation', () => {
  let app: express.Express;
  let systemDb: any;
  let tokenA = '';
  let tokenB = '';
  const farm = { a: '', b: '' };
  const user = { a: '', b: '' };
  const bIds: Record<string, string> = {};

  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];

  beforeAll(async () => {
    ({ systemDb } = await import('../../server/db'));
    const { registerRoutes } = await import('../../server/routes');
    const { generateToken } = await import('../../server/middleware/auth');
    app = express();
    app.use(express.json());
    await registerRoutes(app);

    for (const k of ['a', 'b'] as const) {
      farm[k] = (await one(sql`INSERT INTO farms (name) VALUES (${`TEST Isolation Farm ${k.toUpperCase()}`}) RETURNING id`)).id;
      user[k] = (await one(sql`INSERT INTO users (name, email, password) VALUES (${`TEST Isolation ${k}`}, ${`test-isolation-${k}-${Date.now()}@example.test`}, 'x') RETURNING id`)).id;
      await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farm[k]}, ${user[k]}, 'owner')`);
    }
    tokenA = generateToken({ userId: user.a, farmId: farm.a, role: 'owner', name: 'TEST Isolation a' });
    tokenB = generateToken({ userId: user.b, farmId: farm.b, role: 'owner', name: 'TEST Isolation b' });

    // One row of each main kind for farm B, each carrying the marker
    const f = farm.b;
    const category = (await one(sql`SELECT (enum_range(NULL::expense_category))[1]::text AS v`)).v;
    const vehicleType = (await one(sql`SELECT id FROM vehicle_types WHERE farm_id IS NULL LIMIT 1`))?.id;
    const add = async (key: string, q: any) => { bIds[key] = (await one(q)).id; };
    await add('animal', sql`INSERT INTO animals (farm_id, name, cow_id) VALUES (${f}, ${MARK}, ${MARK}) RETURNING id`);
    await add('pasture', sql`INSERT INTO pastures (farm_id, name) VALUES (${f}, ${MARK}) RETURNING id`);
    await add('product', sql`INSERT INTO products (farm_id, name) VALUES (${f}, ${MARK}) RETURNING id`);
    await add('group', sql`INSERT INTO animal_groups (farm_id, name) VALUES (${f}, ${MARK}) RETURNING id`);
    await add('budget', sql`INSERT INTO budgets (farm_id, name, start_date, end_date) VALUES (${f}, ${MARK}, now(), now()) RETURNING id`);
    await add('expense', sql`INSERT INTO expenses (farm_id, amount, description, category, date) VALUES (${f}, 1, ${MARK}, ${category}::expense_category, now()) RETURNING id`);
    await add('milk', sql`INSERT INTO milk_records (farm_id, total_volume, date, notes) VALUES (${f}, 1, now(), ${MARK}) RETURNING id`);
    await add('visitor', sql`INSERT INTO visitors (farm_id, name, company, phone, emergency_contact, emergency_phone) VALUES (${f}, ${MARK}, ${MARK}, '0', ${MARK}, '0') RETURNING id`);
    await add('contractor', sql`INSERT INTO contractors (farm_id, company_name) VALUES (${f}, ${MARK}) RETURNING id`);
    await add('channel', sql`INSERT INTO chat_channels (farm_id, name, created_by) VALUES (${f}, ${MARK}, ${user.b}) RETURNING id`);
    await add('hazard', sql`INSERT INTO farm_hazards (farm_id, title, type, severity, geom) VALUES (${f}, ${MARK}, 'terrain', 'low', ST_SetSRID(ST_MakePoint(175.27, -37.79), 4326)::geography) RETURNING id`);
    await add('safetyDocument', sql`INSERT INTO safety_documents (farm_id, title, doc_type) VALUES (${f}, ${MARK}, 'safety_plan') RETURNING id`);
    await add('incident', sql`INSERT INTO safety_incidents (farm_id, type, description, severity, occurred_at, reported_by) VALUES (${f}, 'near_miss', ${MARK}, 'minor', now(), ${user.b}) RETURNING id`);
    await add('task', sql`INSERT INTO tasks (farm_id, title, created_by_id) VALUES (${f}, ${MARK}, ${user.b}) RETURNING id`);
    await add('job', sql`INSERT INTO jobs (farm_id, title, created_by_id) VALUES (${f}, ${MARK}, ${user.b}) RETURNING id`);
    await add('equipment', sql`INSERT INTO equipment (farm_id, name, type) VALUES (${f}, ${MARK}, 'other') RETURNING id`);
    await add('killsheet', sql`INSERT INTO killsheets (farm_id, animal_count, date, processor_name) VALUES (${f}, 1, now(), ${MARK}) RETURNING id`);
    if (vehicleType) {
      await add('vehicle', sql`INSERT INTO vehicles (farm_id, type_id, year, make, model, registration) VALUES (${f}, ${vehicleType}, 2020, ${MARK}, ${MARK}, ${MARK}) RETURNING id`);
    }
    await add('treatment', sql`INSERT INTO animal_treatments (farm_id, animal_id, staff_member_id, staff_member, date_time, condition, treatment_type) VALUES (${f}, ${bIds.animal}, ${user.b}, ${MARK}, '2026-01-01T00:00', ${MARK}, ${MARK}) RETURNING id`);
    await add('weight', sql`INSERT INTO weight_records (animal_id, weight, date, recorded_by, notes) VALUES (${bIds.animal}, 1, now(), ${user.b}, ${MARK}) RETURNING id`);
    // A child row with no farm_id given: the farm guard fills it from the tag
    await add('tag', sql`INSERT INTO tags (farm_id, name, slug) VALUES (${f}, ${MARK}, ${MARK.toLowerCase()}) RETURNING id`);
    await systemDb.execute(sql`INSERT INTO taggings (tag_id, entity_type, entity_id) VALUES (${bIds.tag}, ${MARK}, ${bIds.animal})`);
    // Farm B's own product, with an earlier version of it
    await add('inputProduct', sql`INSERT INTO input_products (farm_id, kind, name, verification) VALUES (${f}, 'fertiliser', ${MARK}, 'farm_entered') RETURNING id`);
    await systemDb.execute(sql`INSERT INTO product_versions (product_id, version, data) VALUES (${bIds.inputProduct}, 1, ${JSON.stringify({ name: MARK })}::jsonb)`);
  }, 120_000);

  afterAll(async () => {
    if (!systemDb) return;
    const farms = [farm.a, farm.b].filter(Boolean);
    const inFarms = sql.join(farms.map(f => sql`${f}::uuid`), sql`, `);
    const testUsers = sql.join([user.a, user.b].filter(Boolean).map(u => sql`${u}::uuid`), sql`, `);
    const tables = ((await systemDb.execute(sql`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'farm_id' AND table_name NOT IN ('farm_members', 'farms')`)) as any).rows.map((r: any) => r.table_name);
    // Delete children before parents: retry until nothing is left or nothing more can go
    for (let pass = 0; pass < 15; pass++) {
      const results = await Promise.allSettled(tables.map((t: string) =>
        systemDb.execute(sql`DELETE FROM ${sql.identifier(t)} WHERE farm_id IN (${inFarms})`)));
      if (results.every(r => r.status === 'fulfilled')) break;
    }
    await systemDb.execute(sql`DELETE FROM farm_members WHERE farm_id IN (${inFarms})`);
    await systemDb.execute(sql`DELETE FROM farms WHERE id IN (${inFarms})`);
    await systemDb.execute(sql`DELETE FROM users WHERE id IN (${testUsers})`);
  }, 600_000);

  it('farm B can see its own rows (the check below would mean nothing otherwise)', async () => {
    const res = await request(app).get('/api/animals').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain(MARK);
  });

  it("no GET route shows farm A any of farm B's rows", async () => {
    const gets = routesOf((app as any)._router.stack)
      .filter(r => r.method === 'get' && r.path.startsWith('/api') && !SKIP.some(s => s.test(r.path)));
    expect(gets.length).toBeGreaterThan(100);
    const leaks: string[] = [];
    const calls: string[] = [];
    for (const r of gets) {
      if (!r.path.includes(':')) calls.push(r.path);
      else for (const id of Object.values(bIds)) calls.push(r.path.replace(/:\w+\??/g, id));
    }
    for (let i = 0; i < calls.length; i += 8) {
      await Promise.all(calls.slice(i, i + 8).map(async path => {
        const res = await request(app).get(path).set('Authorization', `Bearer ${tokenA}`);
        const body = res.text ?? (Buffer.isBuffer(res.body) ? res.body.toString('latin1') : JSON.stringify(res.body ?? ''));
        if (body.includes(MARK)) leaks.push(`${path} -> ${res.status}`);
      }));
    }
    expect(leaks).toEqual([]);
  }, 900_000);

  it("farm A can't change or delete farm B's rows", async () => {
    const writes = routesOf((app as any)._router.stack)
      .filter(r => ['put', 'patch', 'delete'].includes(r.method) && /\/:(id|animalId)\b/.test(r.path) && r.path.startsWith('/api'));
    for (const r of writes) {
      for (const id of Object.values(bIds)) {
        await (request(app) as any)[r.method](r.path.replace(/:\w+\??/g, id))
          .set('Authorization', `Bearer ${tokenA}`).send({ name: 'changed by A', title: 'changed by A', notes: 'changed by A' });
      }
    }
    const intact = (await one(sql`
      SELECT (SELECT count(*) FROM animals WHERE id = ${bIds.animal} AND name = ${MARK})::int
           + (SELECT count(*) FROM pastures WHERE id = ${bIds.pasture} AND name = ${MARK})::int
           + (SELECT count(*) FROM products WHERE id = ${bIds.product} AND name = ${MARK})::int
           + (SELECT count(*) FROM farm_hazards WHERE id = ${bIds.hazard} AND title = ${MARK})::int
           + (SELECT count(*) FROM tasks WHERE id = ${bIds.task} AND title = ${MARK})::int
           + (SELECT count(*) FROM jobs WHERE id = ${bIds.job} AND title = ${MARK})::int
           + (SELECT count(*) FROM animal_treatments WHERE id = ${bIds.treatment} AND condition = ${MARK})::int AS n`)).n;
    expect(intact).toBe(7);
  }, 900_000);

  it("farm A can't attach its records to farm B's animal", async () => {
    const res = await request(app).post('/api/treatments').set('Authorization', `Bearer ${tokenA}`)
      .send({ animalId: bIds.animal, condition: 'TEST', treatmentType: 'TEST' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const n = (await one(sql`SELECT count(*)::int AS n FROM animal_treatments WHERE animal_id = ${bIds.animal}`)).n;
    expect(n).toBe(1);
  });

  it('the farm guard checks every link between farm tables', async () => {
    const rows = async (q: any) => ((await systemDb.execute(q)) as any).rows;
    const links = await rows(sql`
      SELECT c.relname AS child, a.attname AS col, p.relname AS parent
      FROM pg_constraint k
      JOIN pg_class c ON c.oid = k.conrelid
      JOIN pg_class p ON p.oid = k.confrelid
      JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
      WHERE k.contype = 'f' AND k.connamespace = 'public'::regnamespace AND array_length(k.conkey, 1) = 1
        AND a.attname <> 'farm_id' AND p.relname <> 'farms' AND c.relname <> 'farm_members'
        AND EXISTS (SELECT 1 FROM pg_attribute f WHERE f.attrelid = c.oid AND f.attname = 'farm_id' AND NOT f.attisdropped)
        AND EXISTS (SELECT 1 FROM pg_attribute f WHERE f.attrelid = p.oid AND f.attname = 'farm_id' AND NOT f.attisdropped)`);
    const checked = new Set<string>();
    for (const g of await rows(sql`SELECT tgrelid::regclass::text AS t, encode(tgargs, 'hex') AS h FROM pg_trigger WHERE tgname = 'pulse_farm_guard'`)) {
      const parts = Buffer.from(g.h, 'hex').toString('utf8').split('\0').filter(Boolean);
      for (let i = 0; i < parts.length; i += 2) checked.add(`${g.t}.${parts[i + 1]} -> ${parts[i]}`);
    }
    expect(links.length).toBeGreaterThan(100);
    expect(links.map((l: any) => `${l.child}.${l.col} -> ${l.parent}`).filter((l: string) => !checked.has(l))).toEqual([]);
  });

  it('every farm table has its own farm_id and row-level security', async () => {
    // Read before a farm is chosen (signing in, picking a farm)
    const shared = ['farms', 'farm_members'];
    // A farm table: one with farm_id, or one linked to a farm table. Each must carry farm_id and
    // the farm_isolation policy, so a query that forgets its farm filter can't reach other farms.
    const tables = ((await systemDb.execute(sql`
      WITH farm_tables AS (
        SELECT c.oid FROM pg_class c
        WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
          AND (c.relname = 'farms' OR EXISTS (SELECT 1 FROM pg_attribute f WHERE f.attrelid = c.oid AND f.attname = 'farm_id' AND NOT f.attisdropped))
          AND (c.relname = 'farms' OR c.relname <> ALL (${`{${shared.join(',')}}`}::text[]))
      )
      SELECT c.relname AS name,
        EXISTS (SELECT 1 FROM pg_attribute f WHERE f.attrelid = c.oid AND f.attname = 'farm_id' AND NOT f.attisdropped) AS has_farm,
        c.relrowsecurity AS rls,
        EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND p.polname = 'farm_isolation') AS policy
      FROM pg_class c
      WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
        AND c.relname <> ALL (${`{${shared.join(',')}}`}::text[])
        AND (c.oid IN (SELECT oid FROM farm_tables)
          OR EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'f' AND k.confrelid IN (SELECT oid FROM farm_tables)))`)) as any).rows;
    expect(tables.length).toBeGreaterThan(100);
    expect(tables.map((t: any) => t.name)).toContain('taggings');
    const open = tables.filter((t: any) => !(t.has_farm && t.rls && t.policy))
      .map((t: any) => `${t.name}:${t.has_farm ? '' : ' no farm_id'}${t.rls ? '' : ' no row-level security'}${t.policy ? '' : ' no farm_isolation policy'}`);
    expect(open).toEqual([]);
  });

  it("a farm's connection can't see or link to another farm's child rows", async () => {
    const { withFarmDb, db } = await import('../../server/db');
    // The guard filled the child's farm from its parent
    expect((await one(sql`SELECT farm_id FROM taggings WHERE tag_id = ${bIds.tag}`)).farm_id).toBe(farm.b);
    const seen = await withFarmDb(farm.a, async () =>
      ((await db.execute(sql`SELECT count(*)::int AS n FROM taggings WHERE tag_id = ${bIds.tag}`)) as any).rows[0].n);
    expect(seen).toBe(0);
    await expect(withFarmDb(farm.a, () =>
      db.execute(sql`INSERT INTO taggings (tag_id, entity_type, entity_id) VALUES (${bIds.tag}, 'record', ${bIds.animal})`))).rejects.toThrow();
    expect((await one(sql`SELECT count(*)::int AS n FROM taggings WHERE tag_id = ${bIds.tag}`)).n).toBe(1);
  });

  it("a farm's connection reads the shared product catalogue but only its own products", async () => {
    const { withFarmDb, db } = await import('../../server/db');
    const asFarm = async (farmId: string | null, q: any) => withFarmDb(farmId, async () => ((await db.execute(q)) as any).rows);
    const builtIn = (await one(sql`SELECT id, name FROM input_products WHERE farm_id IS NULL LIMIT 1`));
    expect(builtIn).toBeTruthy();
    expect((await one(sql`SELECT farm_id FROM product_versions WHERE product_id = ${bIds.inputProduct}`)).farm_id).toBe(farm.b);

    // Farm A: the shared catalogue, and nothing of farm B's
    const [seen] = await asFarm(farm.a, sql`
      SELECT (SELECT count(*) FROM input_products WHERE farm_id IS NULL)::int AS shared,
             (SELECT count(*) FROM input_products WHERE id = ${bIds.inputProduct})::int AS theirs,
             (SELECT count(*) FROM product_versions WHERE product_id = ${bIds.inputProduct})::int AS versions`);
    expect(seen.shared).toBeGreaterThan(0);
    expect(seen.theirs).toBe(0);
    expect(seen.versions).toBe(0);
    // Farm B sees its own
    const [own] = await asFarm(farm.b, sql`SELECT count(*)::int AS n FROM input_products WHERE id = ${bIds.inputProduct}`);
    expect(own.n).toBe(1);

    // Farm A can't change farm B's product or the shared catalogue, or add to either
    await asFarm(farm.a, sql`UPDATE input_products SET name = 'changed by A' WHERE id IN (${bIds.inputProduct}, ${builtIn.id})`);
    await asFarm(farm.a, sql`DELETE FROM input_products WHERE id IN (${bIds.inputProduct}, ${builtIn.id})`);
    await asFarm(farm.a, sql`DELETE FROM product_versions WHERE product_id = ${bIds.inputProduct}`);
    await expect(asFarm(farm.a, sql`INSERT INTO input_products (farm_id, kind, name) VALUES (NULL, 'fertiliser', 'TEST shared by A')`)).rejects.toThrow();
    await expect(asFarm(farm.a, sql`INSERT INTO input_products (farm_id, kind, name) VALUES (${farm.b}, 'fertiliser', 'TEST for B by A')`)).rejects.toThrow();
    await expect(asFarm(farm.a, sql`INSERT INTO product_versions (product_id, version, data) VALUES (${bIds.inputProduct}, 2, '{}'::jsonb)`)).rejects.toThrow();
    const after = await one(sql`
      SELECT (SELECT name FROM input_products WHERE id = ${bIds.inputProduct}) AS theirs,
             (SELECT name FROM input_products WHERE id = ${builtIn.id}) AS shared,
             (SELECT count(*) FROM product_versions WHERE product_id = ${bIds.inputProduct})::int AS versions,
             (SELECT count(*) FROM input_products WHERE name IN ('TEST shared by A', 'TEST for B by A'))::int AS added`);
    expect(after).toEqual({ theirs: MARK, shared: builtIn.name, versions: 1, added: 0 });

    // A product added without naming a farm is the request's farm's own
    const [mine] = await asFarm(farm.a, sql`INSERT INTO input_products (kind, name) VALUES ('fertiliser', 'TEST product of A') RETURNING farm_id`);
    expect(mine.farm_id).toBe(farm.a);
  });
});
