// Joining a farm by emailed invite, and resetting a password.
//
// Runs the real auth and farms routes in-process against the database in .env, with TEST users
// and a TEST farm that are removed at the end. Emails aren't sent: the test reads the link out
// of the email Pulse would have sent.
//
// Needs DATABASE_URL and JWT_SECRET; skipped without them.
import 'dotenv/config';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { sql } from 'drizzle-orm';

const live = !!process.env.DATABASE_URL && !!process.env.JWT_SECRET;
const stamp = Date.now();
const mail = (name: string) => `test-invite-${name}-${stamp}@example.test`;

describe.skipIf(!live)('invites and password reset', () => {
  let app: express.Express;
  let systemDb: any;
  let withFarmDb: any;
  let verifyToken: any;
  const sent: { to: string; text: string }[] = [];
  const farm = { a: '', other: '' };
  const user: Record<string, string> = {};
  const tokens: Record<string, string> = {};

  const one = async (q: any) => ((await systemDb.execute(q)) as any).rows[0];
  const lastLink = (kind: 'join' | 'reset-password', to: string) => {
    const email = [...sent].reverse().find(m => m.to === to);
    const match = email && new RegExp(`/${kind}/([A-Za-z0-9_-]+)`).exec(email.text);
    if (!match) throw new Error(`no ${kind} email to ${to}`);
    return match[1];
  };
  const asUser = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    ({ systemDb, withFarmDb } = await import('../../server/db'));
    const { farmDbContext } = await import('../../server/db');
    const auth = await import('../../server/middleware/auth');
    verifyToken = auth.verifyToken;
    const { hashPassword } = await import('../../server/password');
    const { emailService } = await import('../../server/services/email-service');
    vi.spyOn(emailService, 'sendEmail').mockImplementation(async (o: any) => {
      sent.push({ to: o.to, text: o.text });
      return { success: true, messageId: 'test' };
    });
    const authRouter = (await import('../../server/routes/auth')).default;
    const farmsRouter = (await import('../../server/routes/farms')).default;
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    app.use('/api/farms', auth.requireAuth as any, farmDbContext((req: any) => auth.getFarmId(req) ?? null), farmsRouter);

    farm.a = (await one(sql`INSERT INTO farms (name) VALUES ('TEST Invite Farm') RETURNING id`)).id;
    farm.other = (await one(sql`INSERT INTO farms (name) VALUES ('TEST Invite Other Farm') RETURNING id`)).id;
    const pw = await hashPassword('old-password-1');
    for (const [who, role] of [['owner', 'owner'], ['manager', 'manager'], ['existing', null]] as const) {
      user[who] = (await one(sql`INSERT INTO users (name, email, password) VALUES (${`TEST Invite ${who}`}, ${mail(who)}, ${pw}) RETURNING id`)).id;
      if (role) {
        await systemDb.execute(sql`INSERT INTO farm_members (farm_id, user_id, role) VALUES (${farm.a}, ${user[who]}, ${role}::user_role)`);
        tokens[who] = auth.generateToken({ userId: user[who], farmId: farm.a, role, name: `TEST Invite ${who}` });
      }
    }
  }, 60_000);

  afterAll(async () => {
    if (!systemDb) return;
    const farms = [farm.a, farm.other].filter(Boolean);
    const inFarms = sql.join(farms.map(f => sql`${f}::uuid`), sql`, `);
    const testUsers = sql`SELECT id FROM users WHERE email LIKE ${`test-invite-%-${stamp}@example.test`}`;
    await systemDb.execute(sql`DELETE FROM farm_invitations WHERE farm_id IN (${inFarms})`);
    await systemDb.execute(sql`DELETE FROM password_reset_tokens WHERE user_id IN (${testUsers})`);
    await systemDb.execute(sql`DELETE FROM farm_members WHERE farm_id IN (${inFarms})`);
    await systemDb.execute(sql`DELETE FROM farms WHERE id IN (${inFarms})`);
    await systemDb.execute(sql`DELETE FROM users WHERE id IN (${testUsers})`);
    vi.restoreAllMocks();
  }, 60_000);

  it('a new person joins by invite, sets a password and lands in the farm', async () => {
    const email = mail('new');
    const created = await request(app).post(`/api/farms/${farm.a}/invites`).set(asUser('manager'))
      .send({ email: email.toUpperCase(), role: 'worker' });
    expect(created.status).toBe(201);
    expect(created.body.emailSent).toBe(true);
    expect(created.body.data.email).toBe(email);
    expect(created.body.data.tokenHash).toBeUndefined();

    const list = await request(app).get(`/api/farms/${farm.a}/invites`).set(asUser('owner'));
    expect(list.body.data.map((i: any) => i.email)).toContain(email);

    const token = lastLink('join', email);
    const info = await request(app).get(`/api/auth/invite/${token}`);
    expect(info.status).toBe(200);
    expect(info.body).toMatchObject({ farmName: 'TEST Invite Farm', email, role: 'worker', hasAccount: false });

    const short = await request(app).post(`/api/auth/invite/${token}/accept`).send({ name: 'TEST New', password: 'short' });
    expect(short.status).toBe(400);

    const joined = await request(app).post(`/api/auth/invite/${token}/accept`).send({ name: 'TEST New', password: 'new-password-1' });
    expect(joined.status).toBe(200);
    expect(joined.headers['set-cookie']?.[0]).toMatch(/^pulse_token=/);
    expect(verifyToken(joined.body.accessToken).farmId).toBe(farm.a);
    const member = await one(sql`SELECT m.role FROM farm_members m JOIN users u ON u.id = m.user_id WHERE m.farm_id = ${farm.a} AND u.email = ${email} AND m.is_active`);
    expect(member?.role).toBe('worker');

    const again = await request(app).post(`/api/auth/invite/${token}/accept`).send({ name: 'TEST New', password: 'new-password-1' });
    expect(again.status).toBe(410);

    const login = await request(app).post('/api/auth/login').send({ email, password: 'new-password-1' });
    expect(login.status).toBe(200);
  });

  it('someone already on Pulse joins with their own password', async () => {
    const email = mail('existing');
    await request(app).post(`/api/farms/${farm.a}/invites`).set(asUser('owner')).send({ email, role: 'viewer' }).expect(201);
    const token = lastLink('join', email);
    expect((await request(app).get(`/api/auth/invite/${token}`)).body.hasAccount).toBe(true);
    expect((await request(app).post(`/api/auth/invite/${token}/accept`).send({ password: 'wrong-password' })).status).toBe(401);
    const joined = await request(app).post(`/api/auth/invite/${token}/accept`).send({ password: 'old-password-1' });
    expect(joined.status).toBe(200);
    expect(verifyToken(joined.body.accessToken)).toMatchObject({ userId: user.existing, farmId: farm.a });
    // Already on the farm now
    expect((await request(app).post(`/api/farms/${farm.a}/invites`).set(asUser('owner')).send({ email })).status).toBe(409);
  });

  it('only owners and managers invite, and only owners invite owners', async () => {
    const worker = await one(sql`SELECT id FROM users WHERE email = ${mail('new')}`);
    const workerToken = (await import('../../server/middleware/auth')).generateToken({ userId: worker.id, farmId: farm.a, role: 'worker' });
    expect((await request(app).post(`/api/farms/${farm.a}/invites`).set({ Authorization: `Bearer ${workerToken}` }).send({ email: mail('x') })).status).toBe(403);
    expect((await request(app).get(`/api/farms/${farm.a}/invites`).set({ Authorization: `Bearer ${workerToken}` })).status).toBe(403);
    expect((await request(app).post(`/api/farms/${farm.a}/invites`).set(asUser('manager')).send({ email: mail('o'), role: 'owner' })).status).toBe(403);
    // Not a member of the other farm: it looks like it doesn't exist
    expect((await request(app).post(`/api/farms/${farm.other}/invites`).set(asUser('owner')).send({ email: mail('x') })).status).toBe(404);
  });

  it('withdrawn, renewed and expired invites stop working', async () => {
    const email = mail('later');
    const first = await request(app).post(`/api/farms/${farm.a}/invites`).set(asUser('owner')).send({ email }).expect(201);
    const firstToken = lastLink('join', email);
    // Inviting again renews the same invite with a new link; the old link stops working
    const renewed = await request(app).post(`/api/farms/${farm.a}/invites/${first.body.data.id}/resend`).set(asUser('owner')).expect(200);
    expect(renewed.body.data.id).toBe(first.body.data.id);
    const secondToken = lastLink('join', email);
    expect(secondToken).not.toBe(firstToken);
    expect((await request(app).get(`/api/auth/invite/${firstToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/auth/invite/${secondToken}`)).status).toBe(200);

    await systemDb.execute(sql`UPDATE farm_invitations SET expires_at = now() - interval '1 minute' WHERE id = ${first.body.data.id}`);
    expect((await request(app).get(`/api/auth/invite/${secondToken}`)).status).toBe(410);
    expect((await request(app).post(`/api/auth/invite/${secondToken}/accept`).send({ name: 'TEST Late', password: 'late-password-1' })).status).toBe(410);

    await request(app).delete(`/api/farms/${farm.a}/invites/${first.body.data.id}`).set(asUser('owner')).expect(200);
    expect((await request(app).get(`/api/auth/invite/${secondToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/farms/${farm.a}/invites`).set(asUser('owner'))).body.data.map((i: any) => i.email)).not.toContain(email);
  });

  it("a farm's invites are kept to that farm by the database", async () => {
    const mine = await withFarmDb(farm.a, async () => (await import('../../server/db')).db.execute(sql`SELECT count(*)::int AS n FROM farm_invitations`));
    const other = await withFarmDb(farm.other, async () => (await import('../../server/db')).db.execute(sql`SELECT count(*)::int AS n FROM farm_invitations`));
    expect((mine as any).rows[0].n).toBeGreaterThan(0);
    expect((other as any).rows[0].n).toBe(0);
    const resets = await withFarmDb(farm.a, async () => (await import('../../server/db')).db.execute(sql`SELECT count(*)::int AS n FROM password_reset_tokens`));
    expect((resets as any).rows[0].n).toBe(0);
  });

  it('a forgotten password is reset once with the emailed link', async () => {
    const email = mail('owner');
    const before = sent.length;
    expect((await request(app).post('/api/auth/forgot-password').send({ email: mail('nobody') })).status).toBe(200);
    expect(sent.length).toBe(before); // no account, no email, same answer

    await request(app).post('/api/auth/forgot-password').send({ email: email.toUpperCase() }).expect(200);
    const firstToken = lastLink('reset-password', email);
    await request(app).post('/api/auth/forgot-password').send({ email }).expect(200);
    const token = lastLink('reset-password', email);
    // Only the newest link works
    expect((await request(app).post('/api/auth/reset-password').send({ token: firstToken, password: 'brand-new-pass' })).status).toBe(410);

    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'brand-new-pass' })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'another-pass-1' })).status).toBe(410);
    expect((await request(app).post('/api/auth/login').send({ email, password: 'old-password-1' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email, password: 'brand-new-pass' })).status).toBe(200);
  });
});
