import { db } from '../db';
import { farms, farmMembers, users, type Farm } from '@shared/schema';
import { eq, and, asc } from 'drizzle-orm';

export type FarmRole = 'owner' | 'manager' | 'worker' | 'viewer';

export interface FarmWithRole extends Farm {
  role: FarmRole;
}

/**
 * All active farms a user belongs to, oldest membership first
 */
export async function listUserFarms(userId: string): Promise<FarmWithRole[]> {
  const rows = await db
    .select({ farm: farms, role: farmMembers.role })
    .from(farmMembers)
    .innerJoin(farms, eq(farmMembers.farmId, farms.id))
    .where(and(
      eq(farmMembers.userId, userId),
      eq(farmMembers.isActive, true),
      eq(farms.isActive, true),
    ))
    .orderBy(asc(farmMembers.createdAt));

  return rows.map(r => ({ ...r.farm, role: r.role }));
}

/**
 * The farm a user works in by default (their first membership)
 */
export async function getUserFarm(userId: string): Promise<FarmWithRole | undefined> {
  const [farm] = await listUserFarms(userId);
  return farm;
}

/**
 * The user's role on a farm, or undefined when they are not an active member
 */
export async function getFarmRole(userId: string, farmId: string): Promise<FarmRole | undefined> {
  const [member] = await db
    .select({ role: farmMembers.role })
    .from(farmMembers)
    .innerJoin(users, eq(farmMembers.userId, users.id))
    .where(and(
      eq(farmMembers.userId, userId),
      eq(farmMembers.farmId, farmId),
      eq(farmMembers.isActive, true),
      eq(users.isActive, true),
    ))
    .limit(1);

  return member?.role;
}

export async function isFarmMember(userId: string, farmId: string): Promise<boolean> {
  return (await getFarmRole(userId, farmId)) !== undefined;
}

/**
 * IDs of all active users on a farm
 */
export async function listFarmUserIds(farmId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: farmMembers.userId })
    .from(farmMembers)
    .innerJoin(users, eq(farmMembers.userId, users.id))
    .where(and(
      eq(farmMembers.farmId, farmId),
      eq(farmMembers.isActive, true),
      eq(users.isActive, true),
    ));

  return rows.map(r => r.userId);
}

/**
 * Create a farm and make the creating user its owner
 */
export async function createFarmForUser(
  userId: string,
  data: Pick<typeof farms.$inferInsert, 'name'> & Partial<typeof farms.$inferInsert>,
): Promise<FarmWithRole> {
  const { id: _id, createdAt: _c, updatedAt: _u, ...fields } = data;
  const [farm] = await db.insert(farms).values(fields).returning();
  await db.insert(farmMembers).values({ farmId: farm.id, userId, role: 'owner' });
  return { ...farm, role: 'owner' };
}
