/**
 * Farms and farm membership API (mounted at /api/farms behind requireAuth)
 * Responses keep the { success, data } shape the multi-farm page already uses.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { farms, farmMembers, users } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { getFarmId, getUserId, generateToken, AUTH_COOKIE, authCookieOptions } from '../middleware/auth';
import { listUserFarms, getFarmRole, createFarmForUser, type FarmRole } from '../domain/farms';
import { listOpenInvites, createInvite, resendInvite, revokeInvite, InviteError } from '../domain/accounts';
import { buildFarmExport } from '../domain/farm-export';

const router = Router();

const uuidSchema = z.string().uuid();
const roleSchema = z.enum(['owner', 'manager', 'worker', 'viewer', 'contractor']);

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

// The farm's emergency details, printed on the hazard map
const emergencySchema = z.object({
  address111: z.string().max(300).nullish(),
  rapidNumber: z.string().max(50).nullish(),
  medicalCentre: z.string().max(200).nullish(),
  medicalPhone: z.string().max(50).nullish(),
});

// GET /api/farms/current - The farm the user is working in
router.get('/current', async (req, res) => {
  try {
    const farmId = getFarmId(req);
    const role = farmId ? await getFarmRole(getUserId(req)!, farmId) : undefined;
    if (!farmId || !role) return res.status(404).json({ error: 'No farm selected' });
    const [farm] = await db.select().from(farms).where(eq(farms.id, farmId));
    res.json({ ...farm, role });
  } catch (error) {
    console.error('Error fetching current farm:', error);
    res.status(500).json({ error: 'Failed to fetch farm' });
  }
});

// What the setup wizard keeps in farms.settings.onboarding: the step reached, steps skipped, and when
// setup was finished
const onboardingSchema = z.object({
  step: z.string().max(40).optional(),
  skipped: z.array(z.string().max(40)).max(20).optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

// PATCH /api/farms/current - Owners and managers change the farm's details and emergency details.
// areaHa is the farm's total area as the owner gives it (it sets the onboarding fee band), kept in
// settings.areaHa; onboarding is the setup wizard's progress.
router.patch('/current', async (req, res) => {
  try {
    const farmId = getFarmId(req);
    const role = farmId ? await getFarmRole(getUserId(req)!, farmId) : undefined;
    if (!farmId || !role) return res.status(404).json({ error: 'No farm selected' });
    if (!MANAGE_ROLES.includes(role)) return res.status(403).json({ error: 'Only farm owners and managers can change the farm profile' });
    const { emergency, areaHa, onboarding, ...fields } = farmFieldsSchema.omit({ settings: true }).partial()
      .extend({
        emergency: emergencySchema.optional(),
        areaHa: z.number().positive().max(1_000_000).nullable().optional(),
        onboarding: onboardingSchema.optional(),
      }).parse(req.body);
    const [current] = await db.select({ settings: farms.settings }).from(farms).where(eq(farms.id, farmId));
    const settings: Record<string, any> = { ...(current?.settings ?? {}) };
    if (emergency) settings.emergency = { ...(settings.emergency ?? {}), ...emergency };
    if (areaHa !== undefined) settings.areaHa = areaHa;
    if (onboarding) settings.onboarding = { ...(settings.onboarding ?? {}), ...onboarding };
    const [farm] = await db.update(farms).set({ ...fields, settings, updatedAt: new Date() }).where(eq(farms.id, farmId)).returning();
    res.json({ ...farm, role });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error updating current farm:', error);
    res.status(500).json({ error: 'Failed to update farm' });
  }
});

// GET /api/farms/current/export - The farm owner downloads all of the farm's data as a zip of
// CSV and JSON files
router.get('/current/export', async (req, res) => {
  try {
    const farmId = getFarmId(req);
    const role = farmId ? await getFarmRole(getUserId(req)!, farmId) : undefined;
    if (!farmId || !role) return res.status(404).json({ error: 'No farm selected' });
    if (role !== 'owner') return res.status(403).json({ error: "Only the farm's owner can download all of its data" });
    const { zip, filename } = await buildFarmExport(farmId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(Buffer.from(zip));
  } catch (error) {
    console.error('Error exporting farm data:', error);
    res.status(500).json({ error: 'Failed to export the farm data' });
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

// POST /api/farms/:farmId/switch - Work in another of the user's farms. The farm is part of the
// sign-in token (every request is limited to it), so this issues a new one.
router.post('/:farmId/switch', async (req, res) => {
  try {
    const membership = await loadMembership(req, res);
    if (!membership) return;
    const user = (req as any).user;
    const token = generateToken({ userId: user.userId, name: user.name, email: user.email, role: user.role, farmId: membership.farmId });
    res.cookie(AUTH_COOKIE, token, authCookieOptions);
    res.json({ success: true, data: { farmId: membership.farmId, role: membership.role } });
  } catch (error) {
    console.error('Error switching farm:', error);
    res.status(500).json({ success: false, error: 'Failed to switch farm' });
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

// GET /api/farms/:farmId/invites - Invites not yet used or withdrawn (owners and managers)
router.get('/:farmId/invites', async (req, res) => {
  try {
    const membership = await loadMembership(req, res);
    if (!membership || !requireManage(membership.role, res)) return;
    res.json({ success: true, data: await listOpenInvites(membership.farmId) });
  } catch (error) {
    console.error('Error listing invites:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invites' });
  }
});

function inviteError(res: Response, error: unknown, what: string) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ success: false, error: error.errors[0]?.message ?? 'Validation failed', details: error.errors });
  }
  if (error instanceof InviteError) return res.status(error.status).json({ success: false, error: error.message });
  console.error(`Error ${what}:`, error);
  res.status(500).json({ success: false, error: `Failed ${what}` });
}

function inviter(req: Request) {
  const user = (req as any).user;
  return { userId: user.userId as string, name: user.name as string | undefined };
}

// POST /api/farms/:farmId/invites - Email someone a link to join with a role. Inviting the same
// email again renews their open invite. Only owners can invite owners.
router.post('/:farmId/invites', async (req, res) => {
  try {
    const membership = await loadMembership(req, res);
    if (!membership || !requireManage(membership.role, res)) return;
    const { email, role } = z.object({ email: z.string().trim().email('Enter a valid email address').max(255), role: roleSchema.default('worker') }).parse(req.body);
    if (role === 'owner' && membership.role !== 'owner') {
      return res.status(403).json({ success: false, error: 'Only owners can invite owners' });
    }
    const result = await createInvite(membership.farmId, inviter(req), email, role);
    res.status(201).json({ success: true, data: result.invite, emailSent: result.emailSent, emailError: result.emailError });
  } catch (error) {
    inviteError(res, error, 'sending invite');
  }
});

// POST /api/farms/:farmId/invites/:inviteId/resend - New link and expiry, emailed again
router.post('/:farmId/invites/:inviteId/resend', async (req, res) => {
  try {
    const membership = await loadMembership(req, res);
    if (!membership || !requireManage(membership.role, res)) return;
    const inviteId = uuidSchema.safeParse(req.params.inviteId);
    if (!inviteId.success) return res.status(404).json({ success: false, error: 'Invite not found' });
    const result = await resendInvite(membership.farmId, inviteId.data, inviter(req), membership.role === 'owner');
    res.json({ success: true, data: result.invite, emailSent: result.emailSent, emailError: result.emailError });
  } catch (error) {
    inviteError(res, error, 'resending invite');
  }
});

// DELETE /api/farms/:farmId/invites/:inviteId - Withdraw an invite; its link stops working
router.delete('/:farmId/invites/:inviteId', async (req, res) => {
  try {
    const membership = await loadMembership(req, res);
    if (!membership || !requireManage(membership.role, res)) return;
    const inviteId = uuidSchema.safeParse(req.params.inviteId);
    if (!inviteId.success || !(await revokeInvite(membership.farmId, inviteId.data))) {
      return res.status(404).json({ success: false, error: 'Invite not found' });
    }
    res.json({ success: true });
  } catch (error) {
    inviteError(res, error, 'withdrawing invite');
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
