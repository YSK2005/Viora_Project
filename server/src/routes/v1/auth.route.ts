import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma';
import { validateRequest } from '../../middlewares/validate';
import { AppError } from '../../middlewares/errorHandler';
import { sendSuccess } from '../../utils/response';
import {
  hashPassword,
  verifyPassword,
  createSessionRecord,
  invalidateSessionToken,
  setSessionCookie,
  clearSessionCookie,
} from '../../utils/auth';
import { AuthenticatedRequest, requireAuth, requireRole, extractToken } from '../../middlewares/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  businessName: z.string().trim().min(2).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

const switchBusinessSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
});

const addMemberSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  role: z.enum(['OWNER', 'ACCOUNTANT', 'VIEWER']).default('ACCOUNTANT'),
  name: z.string().trim().min(2).optional(),
});

/**
 * POST /api/auth/register
 * Creates a new user account, assigns/creates business, and establishes session
 */
router.post(
  '/register',
  validateRequest({ body: registerSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { email, password, name, businessName } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new AppError('An account with this email already exists', 409, 'ERR_USER_EXISTS');
      }

      const passwordHash = hashPassword(password);

      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
          },
        });

        // Public signup may only create a new, isolated business.
        const newBiz = await tx.business.create({
          data: {
            name: businessName || `${name}'s Business`,
            address: 'Business Address',
            phone: '+91 98765 43210',
            email,
            state: 'Karnataka',
            invoicePrefix: 'INV',
          },
        });
        const targetBusinessId = newBiz.id;

        await tx.businessMembership.create({
          data: {
            userId: newUser.id,
            businessId: targetBusinessId,
            role: 'OWNER',
          },
        });

        return newUser;
      });

      // Get user with memberships
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          memberships: {
            include: { business: true },
          },
        },
      });

      const activeMembership = fullUser!.memberships[0];
      const { rawToken, expiresAt } = await createSessionRecord(
        user.id,
        activeMembership.businessId,
        req.ip,
        req.get('user-agent')
      );

      setSessionCookie(res, rawToken, expiresAt);

      return sendSuccess(
        res,
        {
          // Browser sessions stay in HttpOnly cookies; non-browser clients may use bearer tokens.
          ...(req.get('X-Viora-Client') === 'web' ? {} : { token: rawToken }),
          expiresAt: expiresAt.toISOString(),
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          business: activeMembership.business,
          role: activeMembership.role,
        },
        'Account registered and signed in successfully',
        201
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/login
 * Validates credentials and creates secure session
 */
router.post(
  '/login',
  validateRequest({ body: loginSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          memberships: {
            include: { business: true },
          },
        },
      });

      if (!user || !verifyPassword(password, user.passwordHash)) {
        throw new AppError('Invalid email or password', 401, 'ERR_INVALID_CREDENTIALS');
      }

      const memberships = user.memberships;
      if (memberships.length === 0) {
        throw new AppError('No business access. Contact a business owner.', 403, 'ERR_NO_MEMBERSHIP');
      }

      const activeMembership = memberships[0];
      const { rawToken, expiresAt } = await createSessionRecord(
        user.id,
        activeMembership.businessId,
        req.ip,
        req.get('user-agent')
      );

      setSessionCookie(res, rawToken, expiresAt);

      return sendSuccess(
        res,
        {
          // Browser sessions stay in HttpOnly cookies; non-browser clients may use bearer tokens.
          ...(req.get('X-Viora-Client') === 'web' ? {} : { token: rawToken }),
          expiresAt: expiresAt.toISOString(),
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          business: activeMembership.business,
          role: activeMembership.role,
          memberships: memberships.map((m) => ({
            businessId: m.businessId,
            businessName: m.business.name,
            role: m.role,
          })),
        },
        'Signed in successfully'
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/logout
 * Invalidates session and clears cookie
 */
router.post('/logout', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rawToken = extractToken(req);
    if (rawToken) {
      await invalidateSessionToken(rawToken);
    }
    clearSessionCookie(res);
    return sendSuccess(res, null, 'Signed out successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile, active business, and role
 */
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const fullUser = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: {
      memberships: {
        include: { business: true },
      },
    },
  });

  return sendSuccess(res, {
    user: req.user,
    business: req.business,
    role: req.role,
    memberships: (fullUser?.memberships || []).map((m) => ({
      businessId: m.businessId,
      businessName: m.business.name,
      role: m.role,
    })),
  });
});

/**
 * POST /api/auth/switch-business
 * Changes active business context for current session
 */
router.post(
  '/switch-business',
  requireAuth,
  validateRequest({ body: switchBusinessSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { businessId } = req.body;

      const membership = await prisma.businessMembership.findUnique({
        where: {
          userId_businessId: {
            userId: req.user!.id,
            businessId,
          },
        },
        include: { business: true },
      });

      if (!membership) {
        throw new AppError('You do not have access to this business', 403, 'ERR_FORBIDDEN_BUSINESS');
      }

      await prisma.session.update({
        where: { id: req.session.id },
        data: { activeBusinessId: businessId },
      });

      return sendSuccess(res, {
        business: membership.business,
        role: membership.role,
      }, 'Switched active business');
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/members
 * Invite / add a team member to active business (OWNER only)
 */
router.post(
  '/members',
  requireAuth,
  requireRole(['OWNER']),
  validateRequest({ body: addMemberSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { email, role } = req.body;
      const businessId = req.business.id;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new AppError('This person must register their own account before being added.', 409, 'ERR_MEMBER_REGISTRATION_REQUIRED');
      }

      const existingMembership = await prisma.businessMembership.findUnique({
        where: {
          userId_businessId: {
            userId: user.id,
            businessId,
          },
        },
      });

      if (existingMembership) {
        const updated = await prisma.businessMembership.update({
          where: { id: existingMembership.id },
          data: { role },
        });
        return sendSuccess(res, updated, `Updated member role to ${role}`);
      }

      const membership = await prisma.businessMembership.create({
        data: {
          userId: user.id,
          businessId,
          role,
        },
      });

      return sendSuccess(res, membership, `Added ${email} to business with role ${role}`, 201);
    } catch (error) {
      next(error);
    }
  }
);

export const authRouter = router;
