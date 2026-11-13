import { sql } from "drizzle-orm";
import { systemDb, withFarmDb } from "./db";

/**
 * Seed scripts write into one farm: SEED_FARM_ID, or the first farm. They run limited to it
 * (row-level security), so their deletes and inserts never touch any other farm's data, and
 * the database fills in farm_id on every row they add.
 */
export async function inSeedFarm<T>(work: (farmId: string) => Promise<T>): Promise<T> {
  const chosen = process.env.SEED_FARM_ID;
  const result = (await systemDb.execute(chosen
    ? sql`SELECT id, name FROM farms WHERE id = ${chosen}`
    : sql`SELECT id, name FROM farms ORDER BY created_at LIMIT 1`)) as any;
  const farm = (result.rows ?? result)[0];
  if (!farm) {
    throw new Error(chosen ? `No farm ${chosen}` : "There's no farm to seed. Sign up in the app first, or set SEED_FARM_ID.");
  }
  console.log(`Seeding farm "${farm.name}" (${farm.id})`);
  return withFarmDb(farm.id, () => work(farm.id));
}

/**
 * A person the seed needs: reused when their email is already signed up, otherwise created.
 * Either way they're made a member of the seed farm.
 */
export async function seedUser(farmId: string, user: { name: string; email: string; password: string; role: string }) {
  const found = (await systemDb.execute(sql`SELECT * FROM users WHERE email = ${user.email}`)) as any;
  let row = (found.rows ?? found)[0];
  if (!row) {
    const made = (await systemDb.execute(sql`
      INSERT INTO users (name, email, password, role, is_active, last_login_at)
      VALUES (${user.name}, ${user.email}, ${user.password}, ${user.role}::user_role, true, now()) RETURNING *`)) as any;
    row = (made.rows ?? made)[0];
  }
  await systemDb.execute(sql`
    INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farmId}, ${row.id}, ${user.role}::user_role)
    ON CONFLICT (farm_id, user_id) DO UPDATE SET is_active = true`);
  return { ...row, isActive: row.is_active } as { id: string; name: string; email: string };
}
