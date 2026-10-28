/**
 * Farms and farm membership API (mounted at /api/farms behind requireAuth)
 * Responses keep the { success, data } shape the multi-farm page already uses.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { farms, farmMembers, users } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { getUserId } from '../middleware/auth';
import { listUserFarms, getFarmRole, createFarmForUser, type FarmRole } from '../domain/farms';

const router = Router();

const uuidSchema = z.string().uuid();
const roleSchema = z.enum(['owner', 'manager', 'worker', 'viewer']);

const farmFieldsSchema = z.object({
  name: z.string().min(1).max(255),
  location: z.string().max(255).nullish(),
  address: z.string().nullish(),
  naitNumber: z.string().max(50).nullish(),
  contactEmail: z.string().email().max(255).nullish(),
  contactPhone: z.string().max(50).nullish(),
  timezone: z.string().max(50).nullish(),
  settings: z.record(z.any()).nullish(),
});

const MANAGE_ROLES: FarmRole[] = ['owner', 'manager'];

/**
 * Resolve :farmId and the caller's role on it, replying 404 when the caller is not a member
 * (so farm IDs the user can't see are indistinguishable from ones that don't exist)
 */
async function loadMembership(req: Request, res: Response): Promise<{ farmId: string; role: FarmRole } | null> {
  const parsed = uuidSchema.safeParse(req.params.farmId);
  const role = parsed.success ? await getFarmRole(getUserId(req)!, parsed.data) : undefined;
  if (!parsed.success || !role) {
    res.status(404).json({ success: false, error: 'Farm not found' });
    return null;
  }
  return { farmId: parsed.data, role };
}

function requireManage(role: FarmRole, res: Response): boolean {
  if (MANAGE_ROLES.includes(role)) return true;
  res.status(403).json({ success: false, error: 'Only farm owners and managers can do this' });
  return false;
}

// GET /api/farms - Farms the signed-in user belongs to
router.get('/', async (req, res) => {
  try {
    res.json({ success: true, data: await listUserFarms(getUserId(req)!) });
  } catch (error) {
    console.error('Error listing farms:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch farms' });
  }
});

// POST /api/farms - Create a farm; the creator becomes its owner
router.post('/', async (req, res) => {
  try {
    const data = farmFieldsSchema.parse(req.body);
    const farm = await createFarmForUser(getUserId(req)!, data);
    res.status(201).json({ success: true, data: farm });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating farm:', error);
    res.status(500).json({ success: false, error: 'Failed to create farm' });
  }
});

// GET /api/farms/:farmId
router.get('/:farmId', async (req, res) => {
  try {
    const membership = await loadMembership(req, res);
    if (!membership) return;
    const [farm] = await db.select().from(farms).where(eq(farms.id, membership.farmId));
    res.json({ success: true, data: { ...farm, role: membership.role } });
  } catch (error) {
    console.error('Error fetching farm:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch farm' });
  }
});

// PUT /api/farms/:farmId - Update farm details
router.put('/:farmId', async (req, res) => {
  try {
    const membership = await loadMembership(req, res);
    if (!membership || !requireManage(membership.role, res)) return;
    const updates = farmFieldsSchema.partial().parse(req.body);
    const [farm] = await db
      .update(farms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(farms.id, membership.farmId))
      .returning();
    res.json({ success: true, data: { ...farm, role: membership.role } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    console.error('Error updating farm:', error);
    res.status(500).json({ success: false, error: 'Failed to update farm' });
  }
});

// POST /api/farms/:farmId/archive - Owners only; the farm and its data are kept
router.post('/:farmId/archive', async (req, res) => {
  try {
    const membership = await loadMembership(req, res);
    if (!membership) return;
    if (membership.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only the farm owner can archive it' });
    }
    await db.update(farms).set({ isActive: false, updatedAt: new Date() }).where(eq(farms.id, membership.farmId));
    res.json({ success: true });
  } catch (error) {
    console.error('Error archiving farm:', error);
    res.status(500).json({ success: false, error: 'Failed to archive farm' });
  }
});

// GET /api/farms/:farmId/members
router.get('/:farmId/members', async (req, res) => {
  try {
    const membership = await loadMembership(req, res);
    if (!membership) return;
    const members = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: farmMembers.role,
        isActive: farmMembers.isActive,
        joinedAt: farmMembers.createdAt,
      })
      .from(farmMembers)
      .innerJoin(users, eq(farmMembers.userId, users.id))
      .where(eq(farmMembers.farmId, membership.farmId));
    res.json({ success: true, data: members });
  } catch (error) {
    console.error('Error listing farm members:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch farm members' });
  }
});

// POST /api/farms/:farmId/members - Add an existing user (by email) or reactivate/re-role them
router.post('/:farmId/members', async (req, res) => {
  try {
    const membership = await loadMembership(req, res);
    if (!membership || !requireManage(membership.role, res)) return;
    const { email, role } = z.object({ email: z.string().email(), role: roleSchema.default('worker') }).parse(req.body);
    // Only owners can create other owners
    if (role === 'owner' && membership.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only owners can add owners' });
    }
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return res.status(404).json({ success: false, error: 'No user with that email' });
    }
    const [member] = await db
      .insert(farmMembers)
      .values({ farmId: membership.farmId, userId: user.id, role })
      .onConflictDoUpdate({
        target: [farmMembers.farmId, farmMembers.userId],
        set: { role, isActive: true, updatedAt: new Date() },
      })
      .returning();
    res.status(201).json({ success: true, data: member });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.errors });
    }
    console.error('Error adding farm member:', error);
    res.status(500).json({ success: false, error: 'Failed to add farm member' });
  }
});

// DELETE /api/farms/:farmId/members/:userId - Deactivate a membership (history is kept)
router.delete('/:farmId/members/:userId', async (req, res) => {
  try {
    const membership = await loadMembership(req, res);
    if (!membership || !requireManage(membership.role, res)) return;
    const target = uuidSchema.safeParse(req.params.userId);
    if (!target.success) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }
    const targetRole = await getFarmRole(target.data, membership.farmId);
    if (targetRole === 'owner' && membership.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only owners can remove owners' });
    }
    const updated = await db
      .update(farmMembers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(farmMembers.farmId, membership.farmId), eq(farmMembers.userId, target.data)))
      .returning();
    if (updated.length === 0) {
      return res.status(404).json({ success: false, error: 'Member not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing farm member:', error);
    res.status(500).json({ success: false, error: 'Failed to remove farm member' });
  }
});

export default router;
