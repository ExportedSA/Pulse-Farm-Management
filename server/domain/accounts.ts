/**
 * Joining a farm by emailed invite, and resetting a forgotten password.
 *
 * Each link carries a random secret; only its sha256 is stored, so the database alone can't be
 * used to join a farm or take over an account. Invites last 7 days, reset links 1 hour, and each
 * works once.
 */
import crypto from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db, withFarmDb } from '../db';
import { farms, farmMembers, users } from '@shared/schema';
import { farmInvitations, passwordResetTokens, type FarmInvitation } from '@shared/platform-schema';
import { emailService } from '../services/email-service';
import type { FarmRole } from './farms';

export const INVITE_DAYS = 7;
export const RESET_MINUTES = 60;
export const MIN_PASSWORD = 8;

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export function newSecret(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, hash: hashSecret(token) };
}

export const hashSecret = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * The address links in emails point at. Live, it must be set (APP_URL): taking it from the
 * request's Host header would let anyone make Pulse email links to their own site.
 */
export function appUrl(): string {
  const url = process.env.APP_URL?.replace(/\/+$/, '');
  if (url) return url;
  if (process.env.NODE_ENV === 'production') throw new Error('APP_URL must be set to send email links');
  return `http://localhost:${process.env.PORT || 4000}`;
}

/** The user with this email (any case), if there is one */
export async function findUserByEmail(email: string) {
  const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${normaliseEmail(email)}`).limit(1);
  return user;
}

const ROLE_WORDS: Record<FarmRole, string> = {
  owner: 'an owner', manager: 'a manager', worker: 'a worker', viewer: 'a viewer', contractor: 'a contractor',
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function emailHtml(heading: string, paragraphs: string[], button: { label: string; url: string }, footer: string) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333">
<div style="max-width:600px;margin:0 auto;padding:20px">
<div style="background:#1e3932;color:#fff;padding:16px 20px"><strong>Pulse</strong></div>
<div style="padding:20px;background:#f9f9f9">
<h2 style="margin-top:0">${escapeHtml(heading)}</h2>
${paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('\n')}
<p><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:10px 20px;background:#1e3932;color:#fff;text-decoration:none;border-radius:5px">${escapeHtml(button.label)}</a></p>
<p style="font-size:12px;color:#666">Or paste this into your browser: ${escapeHtml(button.url)}</p>
</div>
<p style="font-size:12px;color:#666;text-align:center">${escapeHtml(footer)}</p>
</div></body></html>`;
}

export async function sendInviteEmail(invite: { email: string; role: FarmRole }, token: string, farmName: string, inviterName: string | undefined) {
  const url = `${appUrl()}/join/${token}`;
  const who = inviterName ? `${inviterName} has invited you` : 'You have been invited';
  const lines = [
    `${who} to join ${farmName} on Pulse as ${ROLE_WORDS[invite.role] ?? invite.role}.`,
    `The link works for ${INVITE_DAYS} days. If you don't have a Pulse sign-in yet, you'll set a password when you join.`,
  ];
  const footer = "If you weren't expecting this, you can ignore this email.";
  return emailService.sendEmail({
    to: invite.email,
    subject: `Join ${farmName} on Pulse`,
    html: emailHtml(`Join ${farmName} on Pulse`, lines, { label: 'Join the farm', url }, footer),
    text: `${lines.join('\n\n')}\n\nJoin: ${url}\n\n${footer}`,
  });
}

async function sendResetEmail(email: string, token: string) {
  const url = `${appUrl()}/reset-password/${token}`;
  const lines = [
    'Someone asked to reset the password for your Pulse sign-in.',
    `The link works once, for ${RESET_MINUTES} minutes.`,
  ];
  const footer = "If it wasn't you, ignore this email: your password stays the same.";
  return emailService.sendEmail({
    to: email,
    subject: 'Reset your Pulse password',
    html: emailHtml('Reset your Pulse password', lines, { label: 'Choose a new password', url }, footer),
    text: `${lines.join('\n\n')}\n\nReset: ${url}\n\n${footer}`,
  });
}

export type InviteView = Omit<FarmInvitation, 'tokenHash'> & { expired: boolean };
const view = ({ tokenHash: _h, ...rest }: FarmInvitation): InviteView => ({ ...rest, expired: rest.expiresAt < new Date() });

const openInvite = (farmId: string) => and(
  eq(farmInvitations.farmId, farmId), isNull(farmInvitations.acceptedAt), isNull(farmInvitations.revokedAt));

/** A farm's invites that haven't been used or withdrawn (including expired ones), newest first */
export function listOpenInvites(farmId: string): Promise<InviteView[]> {
  return withFarmDb(farmId, async () =>
    (await db.select().from(farmInvitations).where(openInvite(farmId)).orderBy(sql`${farmInvitations.createdAt} desc`)).map(view));
}

export class InviteError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/**
 * Invite someone by email, or renew their open invite (new link, new expiry, the new role).
 * Returns the invite and whether the email went.
 */
export async function createInvite(farmId: string, inviter: { userId: string; name?: string }, emailIn: string, role: FarmRole) {
  const email = normaliseEmail(emailIn);
  const existing = await findUserByEmail(email);
  if (existing) {
    const [member] = await db.select({ isActive: farmMembers.isActive }).from(farmMembers)
      .where(and(eq(farmMembers.farmId, farmId), eq(farmMembers.userId, existing.id)));
    if (member?.isActive) throw new InviteError(409, `${email} is already on this farm`);
  }
  const { token, hash } = newSecret();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
  const invite = await withFarmDb(farmId, async () => {
    const [renewed] = await db.update(farmInvitations)
      .set({ role, tokenHash: hash, expiresAt, lastSentAt: new Date(), invitedBy: inviter.userId })
      .where(and(openInvite(farmId), eq(farmInvitations.email, email))).returning();
    if (renewed) return renewed;
    const [created] = await db.insert(farmInvitations)
      .values({ farmId, email, role, tokenHash: hash, expiresAt, invitedBy: inviter.userId }).returning();
    return created;
  });
  const [farm] = await db.select({ name: farms.name }).from(farms).where(eq(farms.id, farmId));
  const sent = await sendInviteEmail({ email, role }, token, farm?.name ?? 'a farm', inviter.name);
  return { invite: view(invite), emailSent: sent.success, emailError: sent.error };
}

/** Send an open invite again with a new link and expiry */
export async function resendInvite(farmId: string, inviteId: string, inviter: { userId: string; name?: string }, mayInviteOwners: boolean) {
  const [current] = await withFarmDb(farmId, () =>
    db.select().from(farmInvitations).where(and(openInvite(farmId), eq(farmInvitations.id, inviteId))));
  if (!current) throw new InviteError(404, 'Invite not found');
  if (current.role === 'owner' && !mayInviteOwners) throw new InviteError(403, 'Only owners can invite owners');
  return createInvite(farmId, inviter, current.email, current.role);
}

export async function revokeInvite(farmId: string, inviteId: string): Promise<boolean> {
  const rows = await withFarmDb(farmId, () => db.update(farmInvitations).set({ revokedAt: new Date() })
    .where(and(openInvite(farmId), eq(farmInvitations.id, inviteId))).returning({ id: farmInvitations.id }));
  return rows.length > 0;
}

// ---- Used by the public join page (runs as the database owner, before any farm is chosen) ----

/** The invite a join link is for, with why it can't be used when it can't */
export async function lookupInvite(token: string) {
  const [row] = await db.select({ invite: farmInvitations, farmName: farms.name, farmActive: farms.isActive, inviterName: users.name })
    .from(farmInvitations)
    .innerJoin(farms, eq(farms.id, farmInvitations.farmId))
    .leftJoin(users, eq(users.id, farmInvitations.invitedBy))
    .where(eq(farmInvitations.tokenHash, hashSecret(token)));
  if (!row || row.invite.revokedAt || !row.farmActive) throw new InviteError(404, "This invite link isn't valid. Ask the farm for a new one.");
  if (row.invite.acceptedAt) throw new InviteError(410, 'This invite has already been used. Sign in to reach the farm.');
  if (row.invite.expiresAt < new Date()) throw new InviteError(410, 'This invite has expired. Ask the farm to send a new one.');
  const account = await findUserByEmail(row.invite.email);
  return { invite: row.invite, farmName: row.farmName, inviterName: row.inviterName ?? undefined, account };
}

/**
 * Use an invite: the user joins the farm with the invite's role (an earlier membership is
 * reactivated). Marking the invite used and adding the membership happen together, and only
 * while the invite is still open, so a link can't be used twice.
 */
export async function acceptInvite(token: string, userId: string) {
  return db.transaction(async tx => {
    const [invite] = await tx.update(farmInvitations)
      .set({ acceptedAt: new Date(), acceptedBy: userId })
      .where(and(eq(farmInvitations.tokenHash, hashSecret(token)), isNull(farmInvitations.acceptedAt),
        isNull(farmInvitations.revokedAt), gt(farmInvitations.expiresAt, new Date())))
      .returning();
    if (!invite) throw new InviteError(410, 'This invite is no longer open. Ask the farm for a new one.');
    await tx.insert(farmMembers).values({ farmId: invite.farmId, userId, role: invite.role })
      .onConflictDoUpdate({ target: [farmMembers.farmId, farmMembers.userId], set: { role: invite.role, isActive: true, updatedAt: new Date() } });
    return invite;
  });
}

// ---- Password reset ----

/**
 * Email a reset link when the address belongs to an active account. Says nothing either way,
 * so the form can't be used to find out who has a Pulse sign-in.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user || !user.isActive || !user.email) return;
  const { token, hash } = newSecret();
  await db.transaction(async tx => {
    // Only the newest link works
    await tx.update(passwordResetTokens).set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));
    await tx.insert(passwordResetTokens).values({ userId: user.id, tokenHash: hash, expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) });
  });
  const sent = await sendResetEmail(user.email, token);
  if (!sent.success) console.error('[accounts] Password reset email failed:', sent.error);
}

/** Set a new password from a reset link; the link can't be used again */
export async function resetPassword(token: string, passwordHash: string): Promise<boolean> {
  return db.transaction(async tx => {
    const [used] = await tx.update(passwordResetTokens).set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.tokenHash, hashSecret(token)), isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())))
      .returning();
    if (!used) return false;
    const updated = await tx.update(users).set({ password: passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, used.userId), eq(users.isActive, true))).returning({ id: users.id });
    if (updated.length === 0) return false;
    return true;
  });
}
