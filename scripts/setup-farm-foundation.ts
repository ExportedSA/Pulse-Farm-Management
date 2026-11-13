// One-off, idempotent setup for farm membership.
// - Creates the farm_members table (shared/schema.ts `farmMembers`) if it is missing
// - Creates a demo farm when the database has no farms yet
// - When exactly one farm exists: makes every active user a member (with their user role)
//   and attaches rows that have no farm_id yet to that farm
// Usage: npx tsx scripts/setup-farm-foundation.ts
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS farm_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      farm_id uuid NOT NULL REFERENCES farms(id),
      user_id uuid NOT NULL REFERENCES users(id),
      role user_role NOT NULL DEFAULT 'worker',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (farm_id, user_id)
    )`;
  console.log("farm_members table ready");

  let farms = await sql`SELECT id, name FROM farms WHERE is_active = true ORDER BY created_at`;
  if (farms.length === 0) {
    farms = await sql`
      INSERT INTO farms (name, location, timezone)
      VALUES ('Pulse Demo Farm', 'Waikato, New Zealand', 'Pacific/Auckland')
      RETURNING id, name`;
    console.log(`Created farm "${farms[0].name}"`);
  }

  if (farms.length !== 1) {
    console.log(`${farms.length} farms exist; skipping automatic membership and backfill`);
    return;
  }
  const farmId = farms[0].id as string;

  const added = await sql`
    INSERT INTO farm_members (farm_id, user_id, role)
    SELECT ${farmId}, id, role FROM users WHERE is_active = true
    ON CONFLICT (farm_id, user_id) DO NOTHING
    RETURNING user_id`;
  console.log(`Added ${added.length} user(s) to "${farms[0].name}"`);

  const tables = await sql`
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_name = c.table_name AND t.table_schema = c.table_schema AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'farm_id' AND c.table_name <> 'farm_members'
    ORDER BY c.table_name`;
  for (const { table_name } of tables) {
    // Table names come from information_schema, not user input
    const rows = await sql(
      `UPDATE "${table_name}" SET farm_id = $1 WHERE farm_id IS NULL RETURNING 1`,
      [farmId],
    );
    if (rows.length > 0) console.log(`  ${table_name}: attached ${rows.length} row(s)`);
  }
  console.log("Done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
