// Creates the per-animal chat channel for animals added before channels existed.
// Idempotent: animals that already have a channel are left alone.
// Usage: npx tsx scripts/backfill-animal-channels.ts
import "dotenv/config";
import { isNotNull } from "drizzle-orm";
import { animals } from "../shared/schema";

// server/ runs as CommonJS, so its named exports arrive on the module's default export
const load = async <T>(path: string): Promise<T> => {
  const mod: any = await import(path);
  return (mod.default ?? mod) as T;
};

async function main() {
  const { db, pool } = await load<typeof import("../server/db")>("../server/db");
  const { getOrCreateAnimalChannel } = await load<typeof import("../server/domain/chat")>("../server/domain/chat");
  try {
    const rows = await db
      .select({ id: animals.id, name: animals.name, visualId: animals.visualId, farmId: animals.farmId })
      .from(animals)
      .where(isNotNull(animals.farmId));

    for (const animal of rows) {
      await getOrCreateAnimalChannel(animal.id, `Animal: ${animal.name || animal.visualId || animal.id}`, animal.farmId!);
    }
    console.log(`Ensured chat channels for ${rows.length} animal(s)`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
