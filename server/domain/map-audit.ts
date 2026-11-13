import { sql } from 'drizzle-orm';
import { db } from '../db';
import { isoUtc, rowsOf } from './farm-map';

// The map's edit history (jobs have their own, with versions): paddocks, boundaries, features,
// exclusions, layers, views and rate plans, newest first, with the name of what changed.
export async function mapAudit(farmId: string, limit: number) {
  const rows = rowsOf(await db.execute(sql`
    SELECT m.id, m.entity_type AS "entityType", m.entity_id AS "entityId", m.action, m.at AT TIME ZONE 'UTC' AS at, u.name AS "by",
      COALESCE(m.after->>'name', m.before->>'name', p.name, e.name, l.name) AS name, m.after->>'note' AS note
    FROM map_audit m
    LEFT JOIN users u ON u.id = m.user_id
    LEFT JOIN pastures p ON p.id = m.entity_id
    LEFT JOIN exclusions e ON e.id = m.entity_id
    LEFT JOIN map_layers l ON l.id = m.entity_id
    WHERE m.farm_id = ${farmId} AND m.entity_type NOT IN ('application', 'restriction')
    ORDER BY m.at DESC LIMIT ${limit}`));
  return rows.map((r: any) => ({ ...r, at: isoUtc(r.at) }));
}
