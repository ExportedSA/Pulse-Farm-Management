import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { users, farms, farmMembers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../password';
import { generateToken, generateRefreshToken, verifyToken, requireAuth, optionalAuth, AUTH_COOKIE, authCookieOptions, type AuthenticatedRequest } from '../middleware/auth';
import { sanitizeUser } from '../auth-utils';
import { getUserFarm, getFarmRole } from '../domain/farms';
import {
  MIN_PASSWORD, InviteError, normaliseEmail, findUserByEmail, lookupInvite, acceptInvite,
  requestPasswordReset, resetPassword,
} from '../domain/accounts';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(MIN_PASSWORD, `Password must be at least ${MIN_PASSWORD} characters`),
  farmName: z.string().trim().min(1).max(255).optional(),
  acceptTerms: z.boolean().optional(), // the sign-up page's "I agree to the terms" box
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { name, password, farmName, acceptTerms } = validatedData;
    const email = normaliseEmail(validatedData.email);

    // Check if user already exists (emails are matched ignoring case)
    if (await findUserByEmail(email)) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Start transaction to create user and optionally farm
    const result = await db.transaction(async (tx) => {
      // Create user
      const [newUser] = await tx.insert(users).values({
        name,
        email,
        password: hashedPassword,
        role: 'owner', // First user is owner
        isActive: true,
        lastLoginAt: new Date(),
      }).returning();

      // Create a default farm for the user if farmName provided
      let farm = null;
      if (farmName) {
        [farm] = await tx.insert(farms).values({
          name: farmName,
          contactEmail: email,
          isActive: true,
          // When the owner agreed to the (draft) terms on the sign-up page
          settings: acceptTerms ? { signup: { termsAcceptedAt: new Date().toISOString() } } : undefined,
        }).returning();
        await tx.insert(farmMembers).values({ farmId: farm.id, userId: newUser.id, role: 'owner' });
      }

      return { user: newUser, farm };
    });

    // Generate tokens
    const tokenPayload = {
      userId: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
      farmId: result.farm?.id,
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Update last login
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, result.user.id));

    res.cookie(AUTH_COOKIE, accessToken, authCookieOptions);

    // Return user data without password
    res.status(201).json({
      user: sanitizeUser(result.user),
      farm: result.farm,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An error occurred during registration'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Find user (emails are matched ignoring case)
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account disabled',
        message: 'Your account has been disabled'
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password'
      });
    }

    // The user's default farm (first active membership)
    const userFarm = await getUserFarm(user.id);

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      farmId: userFarm?.id,
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Update last login
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    res.cookie(AUTH_COOKIE, accessToken, authCookieOptions);

    // Return user data without password
    res.json({
      user: sanitizeUser(user),
      farm: userFarm,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login'
    });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const validatedData = refreshTokenSchema.parse(req.body);
    const { refreshToken } = validatedData;

    // Verify refresh token
    const payload = verifyToken(refreshToken);

    // Get fresh user data
    const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'User not found or inactive'
      });
    }

    // Stay on the farm the token was for while the user is still a member of it, otherwise
    // their default farm (first active membership)
    const keepFarm = payload.farmId && (await getFarmRole(user.id, payload.farmId)) ? { id: payload.farmId } : undefined;
    const userFarm = keepFarm ?? await getUserFarm(user.id);

    // Generate new tokens
    const tokenPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      farmId: userFarm?.id,
    };

    const newAccessToken = generateToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    res.cookie(AUTH_COOKIE, newAccessToken, authCookieOptions);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    res.status(401).json({
      error: 'Token refresh failed',
      message: 'Invalid or expired refresh token'
    });
  }
});

// POST /api/auth/logout - Clear the auth cookie
router.post('/logout', (_req, res) => {
  const { maxAge, ...clearOptions } = authCookieOptions;
  res.clearCookie(AUTH_COOKIE, clearOptions);
  res.json({ success: true });
});

// GET /api/auth/me (and /user, which the web client queries) - Get current user info
router.get(['/me', '/user'], requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
        message: 'No valid token provided'
      });
    }

    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.id, req.user.userId)).limit(1);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User account not found'
      });
    }

    // The user's default farm (first active membership)
    const userFarm = await getUserFarm(user.id);

    res.json({
      user: sanitizeUser(user),
      farm: userFarm,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user info',
      message: 'An error occurred while fetching user information'
    });
  }
});

// Sign a user in to one farm: the farm is part of the sign-in token
function signInTo(res: any, user: typeof users.$inferSelect, farmId: string | undefined) {
  const payload = { userId: user.id, name: user.name, email: user.email ?? undefined, role: user.role, farmId };
  const accessToken = generateToken(payload);
  res.cookie(AUTH_COOKIE, accessToken, authCookieOptions);
  return { accessToken, refreshToken: generateRefreshToken(payload) };
}

function inviteFailure(res: any, error: unknown, what: string) {
  if (error instanceof InviteError) return res.status(error.status).json({ error: error.message });
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0]?.message ?? 'Validation failed', details: error.errors });
  console.error(`${what} error:`, error);
  res.status(500).json({ error: `${what} failed` });
}

const tokenParam = z.string().min(20).max(100);

// GET /api/auth/invite/:token - What a join link is for (shown before joining)
router.get('/invite/:token', optionalAuth as any, async (req, res) => {
  const signedIn = (req as AuthenticatedRequest).user;
  try {
    const { invite, farmName, inviterName, account } = await lookupInvite(tokenParam.parse(req.params.token));
    res.json({
      farmName, inviterName, email: invite.email, role: invite.role, expiresAt: invite.expiresAt,
      hasAccount: !!account,
      signedInAsInvitee: !!account && signedIn?.userId === account.id,
    });
  } catch (error) {
    inviteFailure(res, error, 'Invite lookup');
  }
});

// POST /api/auth/invite/:token/accept - Join the farm. New to Pulse: name and a password make the
// account. Already on Pulse: their password (or being signed in as them) proves it's them.
router.post('/invite/:token/accept', optionalAuth as any, async (req, res) => {
  const signedIn = (req as AuthenticatedRequest).user;
  try {
    const token = tokenParam.parse(req.params.token);
    const { invite, account } = await lookupInvite(token);
    let user = account;
    if (user) {
      if (!user.isActive) return res.status(403).json({ error: 'This account has been disabled' });
      if (signedIn?.userId !== user.id) {
        const { password } = z.object({ password: z.string().min(1, 'Enter your password') }).parse(req.body);
        if (!(await verifyPassword(password, user.password))) return res.status(401).json({ error: 'Wrong password for this account' });
      }
    } else {
      const { name, password } = z.object({
        name: z.string().trim().min(2, 'Enter your name'),
        password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters for your password`),
      }).parse(req.body);
      [user] = await db.insert(users).values({
        name, email: invite.email, password: await hashPassword(password), role: invite.role, isActive: true,
      }).returning();
    }
    await acceptInvite(token, user.id);
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    const tokens = signInTo(res, user, invite.farmId);
    res.json({ user: sanitizeUser(user), farmId: invite.farmId, ...tokens });
  } catch (error) {
    inviteFailure(res, error, 'Joining the farm');
  }
});

// POST /api/auth/forgot-password - Email a reset link. Always the same answer, so it can't be
// used to find out who has an account.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email('Enter a valid email address') }).parse(req.body);
    await requestPasswordReset(email);
    res.json({ success: true });
  } catch (error) {
    inviteFailure(res, error, 'Password reset request');
  }
});

// POST /api/auth/reset-password - Choose a new password with a reset link
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = z.object({
      token: tokenParam,
      password: z.string().min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters`),
    }).parse(req.body);
    const ok = await resetPassword(token, await hashPassword(password));
    if (!ok) return res.status(410).json({ error: 'This reset link has expired or was already used. Ask for a new one.' });
    res.json({ success: true });
  } catch (error) {
    inviteFailure(res, error, 'Password reset');
  }
});

export default router;
