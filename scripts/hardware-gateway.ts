// Gives a farm its shed hardware gateway, or takes it away (migration 0038). Run by whoever runs the
// service, as the database owner: farms can't add or change gateways from the app, because a
// gateway's address is somewhere the server sends commands.
//
// Usage (DATABASE_URL in .env, or set for the database you mean):
//   npx tsx scripts/hardware-gateway.ts list
//   npx tsx scripts/hardware-gateway.ts add <farm id> --simulated            the built-in simulator
//   npx tsx scripts/hardware-gateway.ts add <farm id>                        the server's PULSE_GATEWAY_URL
//   npx tsx scripts/hardware-gateway.ts add <farm id> --url https://... [--name "Shed 2"]
//   npx tsx scripts/hardware-gateway.ts remove <farm id>                     stops it (kept for the log)
import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const [action, farmId] = process.argv.slice(2);

  if (action === "list") {
    const { rows } = await pool.query(`
      SELECT f.name AS farm, g.farm_id, g.name, coalesce(g.base_url, '(server gateway)') AS gateway,
             g.simulated, g.is_active, g.created_at
      FROM hardware_gateways g JOIN farms f ON f.id = g.farm_id
      ORDER BY g.is_active DESC, f.name`);
    if (!rows.length) console.log("No farm has shed hardware.");
    for (const r of rows) {
      console.log(`${r.is_active ? "active " : "stopped"}  ${r.farm} (${r.farm_id})  ${r.name}: ` +
        `${r.simulated ? "simulator" : r.gateway}`);
    }
    return;
  }

  if (!farmId || !UUID.test(farmId)) throw new Error("Give the farm's id (a UUID). `list` shows farms that have one.");
  const farm = (await pool.query("SELECT name FROM farms WHERE id = $1", [farmId])).rows[0];
  if (!farm) throw new Error(`No farm with id ${farmId}`);

  if (action === "add") {
    const simulated = process.argv.includes("--simulated");
    const url = option("url") ?? null;
    if (url && !/^https?:\/\/[^\s/]+/.test(url)) throw new Error("--url must be an http(s) address");
    if (url && simulated) throw new Error("Use --simulated or --url, not both");
    const name = option("name") ?? "Shed";
    // The guard and default read the farm from app.farm_id, as a farm's own request would
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.farm_id', $1, true)", [farmId]);
      await client.query(
        "INSERT INTO hardware_gateways (farm_id, name, base_url, simulated) VALUES ($1, $2, $3, $4)",
        [farmId, name, url, simulated]);
      await client.query("COMMIT");
    } catch (e: any) {
      await client.query("ROLLBACK");
      if (e.code === "23505") throw new Error("That farm already has a gateway, or that gateway already belongs to another farm. `remove` first.");
      throw e;
    } finally {
      client.release();
    }
    console.log(`${farm.name}: shed hardware added (${simulated ? "simulator" : url ?? "the server's gateway"}).`);
    return;
  }

  if (action === "remove") {
    const { rowCount } = await pool.query(
      "UPDATE hardware_gateways SET is_active = false WHERE farm_id = $1 AND is_active", [farmId]);
    console.log(rowCount ? `${farm.name}: shed hardware stopped.` : `${farm.name} had no active shed hardware.`);
    return;
  }

  throw new Error("Use list, add or remove (see the top of this file).");
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
