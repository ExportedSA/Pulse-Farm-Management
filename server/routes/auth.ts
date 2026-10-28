import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { users, farms, farmMembers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../password';
import { generateToken, generateRefreshToken, verifyToken, requireAuth, AUTH_COOKIE, authCookieOptions, type AuthenticatedRequest } from '../middleware/auth';
import { sanitizeUser } from '../auth-utils';
import { getUserFarm } from '../domain/farms';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  farmName: z.string().optional(),
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
    const { name, email, password, farmName } = validatedData;

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
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
        }).returning();
        await tx.insert(farmMembers).values({ farmId: farm.id, userId: newUser.id, role: 'owner' });
      }

      return { user: newUser, farm };
    });

    // Generate tokens
    const tokenPayload = {
      userId: result.user.id,
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

    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
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
    const { verifyPassword } = await import('../password');
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

    // The user's default farm (first active membership)
    const userFarm = await getUserFarm(user.id);

    // Generate new tokens
    const tokenPayload = {
      userId: user.id,
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

export default router;
