import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, neonConfig, type PoolClient } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// The farm limit is set per connection (SET ROLE, app.farm_id), so connections must be real
// database sessions. A transaction pooler (Neon's "-pooler" address, PgBouncer) hands one
// server session to many clients, which would lose the setting or carry it to another
// request, so the direct address is used. DATABASE_URL_DIRECT overrides this.
const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL.replace(/-pooler(?=\.)/, '');

// Each web request holds one connection while it runs, so allow more than the default 10
export const pool = new Pool({ connectionString, max: Number(process.env.DB_POOL_MAX ?? 30) });

type Db = ReturnType<typeof makeDb>;
const makeDb = (client: Pool | PoolClient) => drizzle({ client, schema });

/**
 * The database as its owner: sees every farm. Only for work that isn't a farm's web request
 * (scheduled jobs, scripts, signing in), and that code must filter by farm itself.
 */
export const systemDb = makeDb(pool);

const requestDb = new AsyncLocalStorage<Db>();

/**
 * Run `work` on a connection limited to one farm (or to none, when farmId is null): the
 * pulse_app role with app.farm_id set, so row-level security shows and accepts only that
 * farm's rows. Inside, `db` uses this connection.
 */
export async function withFarmDb<T>(farmId: string | null, work: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SELECT set_config('app.farm_id', $1, false)", [farmId ?? '']);
    await client.query('SET ROLE pulse_app');
    return await requestDb.run(makeDb(client), work);
  } finally {
    await resetAndRelease(client);
  }
}

/**
 * Express middleware: the rest of the request runs on a farm-limited connection. The
 * connection goes back to the pool only once the response is done and no query is still
 * running, so a late query can't run under the next request's farm.
 */
export function farmDbContext(getFarm: (req: any) => Promise<string | null> | string | null) {
  return async (req: any, res: any, next: (err?: unknown) => void) => {
    let client: PoolClient;
    try {
      client = await pool.connect();
    } catch (err) {
      return next(err);
    }
    let running = 0;
    let finished = false;
    let released = false;
    const original = client.query;
    const release = () => {
      if (released || !finished || running > 0) return;
      released = true;
      (client as any).query = original;
      resetAndRelease(client);
    };
    const query = original.bind(client) as (...args: any[]) => any;
    (client as any).query = (...args: any[]) => {
      running++;
      const result = query(...args);
      if (result && typeof result.then === 'function') {
        const done = () => { running--; release(); };
        result.then(done, done);
      } else {
        running--;
      }
      return result;
    };
    res.on('close', () => { finished = true; release(); });
    try {
      const farmId = await getFarm(req);
      await query("SELECT set_config('app.farm_id', $1, false)", [farmId ?? '']);
      await query('SET ROLE pulse_app');
    } catch (err) {
      finished = true;
      release();
      return next(err);
    }
    requestDb.run(makeDb(client), () => next());
  };
}

async function resetAndRelease(client: PoolClient) {
  try {
    await client.query('RESET ROLE');
    await client.query("SELECT set_config('app.farm_id', '', false)");
    client.release();
  } catch (err) {
    // A connection that can't be reset must not be reused
    client.release(err as Error);
  }
}

/**
 * The database for the current work: the request's farm-limited connection inside a web
 * request or withFarmDb(), otherwise the owner connection (scheduled jobs, scripts).
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const current = requestDb.getStore() ?? systemDb;
    const value = (current as any)[prop];
    return typeof value === 'function' ? value.bind(current) : value;
  },
});
