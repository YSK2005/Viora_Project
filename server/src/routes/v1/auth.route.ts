import { ErrorCode } from '../../utils/errorCodes';
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
  normalizePortalScope,
} from '../../utils/auth';
import {
  AuthenticatedRequest,
  requireAuth,
  requireRole,
  extractToken,
  extractRequestedPortal,
  resolveBusinessLicenseState,
} from '../../middlewares/auth';
import { normalize12DigitCode } from '../../utils/accessCodes';
import { PortalScope, UserRole } from '../../generated/prisma-client';
import { logAuditEvent } from '../../utils/audit';

const router = Router();

const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  businessName: z.string().trim().min(2).max(100).optional(),
  role: z.enum(['SUPER_ADMIN', 'OWNER', 'ACCOUNTANT', 'VIEWER', 'CUSTOMER']).optional().default('OWNER'),
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required').max(128),
  portal: z.enum(['CUSTOMER', 'SUPER_ADMIN', 'ADMIN', 'API_LEGACY']).optional(),
  accessCode: z.string().max(32).optional(),
});

const switchBusinessSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
});

const addMemberSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  role: z.enum(['OWNER', 'ACCOUNTANT', 'VIEWER']).default('ACCOUNTANT'),
  name: z.string().trim().min(2).optional(),
});

// In-memory lockout tracker for brute force / credential stuffing protection
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000;

interface LoginAttemptInfo {
  count: number;
  lockedUntil?: number;
}

const failedLoginTracker = new Map<string, LoginAttemptInfo>();

/**
 * Resolves and validates or provisions a Business workspace for an authenticated Customer subscription
 */
async function ensureSubscriptionBusiness(subscription: any, user: any) {
  if (subscription.business) {
    return subscription.business;
  }

  let business = await prisma.business.findFirst({
    where: { ownerUserId: user.id },
  });

  if (!business) {
    const firstMembership = await prisma.businessMembership.findFirst({
      where: { userId: user.id, role: 'OWNER' },
      include: { business: true },
    });
    business = firstMembership?.business || null;
  }

  if (!business) {
    business = await prisma.business.create({
      data: {
        name: `${user.name}'s Enterprise`,
        address: 'Business Address',
        phone: '+91 98765 43210',
        email: user.email,
        state: 'Karnataka',
        invoicePrefix: 'INV',
        ownerUserId: user.id,
        allowAdminBilling: false,
      },
    });
  } else if (!business.ownerUserId) {
    business = await prisma.business.update({
      where: { id: business.id },
      data: { ownerUserId: user.id },
    });
  }

  await prisma.businessMembership.upsert({
    where: {
      userId_businessId: {
        userId: user.id,
        businessId: business.id,
      },
    },
    update: { role: 'OWNER' },
    create: {
      userId: user.id,
      businessId: business.id,
      role: 'OWNER',
    },
  });

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { businessId: business.id },
  });

  return business;
}

/**
 * POST /api/auth/register
 * Registers new accounts. Browser Super Admin and Admin self-registration is blocked.
 */
router.post(
  '/register',
  validateRequest({ body: registerSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const headerPortal = extractRequestedPortal(req);
      if (headerPortal === 'SUPER_ADMIN' || headerPortal === 'ADMIN') {
        throw new AppError(
          'Direct sign-up is disabled on this portal. Purchase a subscription on Customer Portal (Port 5174) for Super Admin access, or receive an Admin Access Code from your Super Admin (Port 5175).',
          403,
          ErrorCode.ERR_FORBIDDEN_ROLE
        );
      }

      const { email, password, name, businessName, role = 'OWNER' } = req.body;
      const effectiveRole: UserRole = headerPortal === 'CUSTOMER' ? 'CUSTOMER' : role;
      const sessionPortal: PortalScope = headerPortal === 'CUSTOMER' ? 'CUSTOMER' : 'API_LEGACY';

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new AppError('An account with this email already exists', 409, ErrorCode.ERR_USER_EXISTS);
      }

      const passwordHash = hashPassword(password);

      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: effectiveRole,
          },
        });

        // Customer accounts do not receive an unlocked billing workspace until they purchase a subscription
        if (effectiveRole !== 'CUSTOMER') {
          const newBiz = await tx.business.create({
            data: {
              name: businessName || `${name}'s Business`,
              address: 'Business Address',
              phone: '+91 98765 43210',
              email,
              state: 'Karnataka',
              invoicePrefix: 'INV',
              ownerUserId: newUser.id,
              allowAdminBilling: true,
            },
          });

          await tx.businessMembership.create({
            data: {
              userId: newUser.id,
              businessId: newBiz.id,
              role: effectiveRole === 'SUPER_ADMIN' ? 'OWNER' : effectiveRole,
            },
          });
        }

        return newUser;
      });

      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          memberships: {
            include: { business: true },
          },
        },
      });

      const activeMembership = fullUser?.memberships?.[0] || null;
      const { rawToken, expiresAt } = await createSessionRecord(
        user.id,
        activeMembership?.businessId,
        req.ip,
        req.get('user-agent'),
        { portal: sessionPortal }
      );

      setSessionCookie(res, rawToken, expiresAt, headerPortal);

      return sendSuccess(
        res,
        {
          ...(req.get('X-Viora-Client') === 'web' ? {} : { token: rawToken }),
          expiresAt: expiresAt.toISOString(),
          portal: sessionPortal,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          business: activeMembership?.business || null,
          role: user.role,
          subscription: null,
          billingAuthorized: false,
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
 * Portal-enforced sign-in:
 * - CUSTOMER (5174): Customer buyer email + password
 * - SUPER_ADMIN (5175): Same Customer email + password + 12-digit Super Admin Access Code from active subscription
 * - ADMIN (5173): Email + password + 12-digit Admin Access Code generated by Super Admin
 */
router.post(
  '/login',
  validateRequest({ body: loginSchema }),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { email, password, accessCode } = req.body;
      const requestedPortal = extractRequestedPortal(req) || normalizePortalScope(req.body.portal);
      const normalizedEmail = email.toLowerCase().trim();

      const attemptInfo = failedLoginTracker.get(normalizedEmail);
      if (attemptInfo?.lockedUntil && attemptInfo.lockedUntil > Date.now()) {
        const remainingMinutes = Math.ceil((attemptInfo.lockedUntil - Date.now()) / 60000);
        throw new AppError(
          `Account is temporarily locked due to excessive failed attempts. Try again in ${remainingMinutes} minute(s).`,
          429,
          ErrorCode.ERR_RATE_LIMIT
        );
      }

      const user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: {
          memberships: {
            include: { business: true },
          },
        },
      });

      if (!user || !verifyPassword(password, user.passwordHash)) {
        const current = failedLoginTracker.get(normalizedEmail) || { count: 0 };
        current.count += 1;
        if (current.count >= MAX_FAILED_LOGIN_ATTEMPTS) {
          current.lockedUntil = Date.now() + ACCOUNT_LOCKOUT_MS;
          failedLoginTracker.set(normalizedEmail, current);
          throw new AppError(
            'Account has been temporarily locked due to 5 consecutive failed login attempts. Try again in 15 minutes.',
            429,
            ErrorCode.ERR_RATE_LIMIT
          );
        } else {
          failedLoginTracker.set(normalizedEmail, current);
          const remainingAttempts = MAX_FAILED_LOGIN_ATTEMPTS - current.count;
          throw new AppError(
            `Invalid email or password. ${remainingAttempts} attempt(s) remaining before temporary lockout.`,
            401,
            ErrorCode.ERR_INVALID_CREDENTIALS
          );
        }
      }

      failedLoginTracker.delete(normalizedEmail);

      // =========================================================================
      // PORTAL 1: SUPER ADMIN (Port 5175) -> Same Customer Email + 12-Digit Code
      // =========================================================================
      if (requestedPortal === 'SUPER_ADMIN') {
        const cleanCode = normalize12DigitCode(accessCode);
        if (!cleanCode) {
          throw new AppError(
            'A valid 12-digit Super Admin Access Code is strictly required. Purchase a software subscription on Customer Portal (Port 5174) to obtain your code.',
            400,
            ErrorCode.ERR_VALIDATION
          );
        }

        const subscription = await prisma.subscription.findUnique({
          where: { superAdminAccessCode: cleanCode },
          include: {
            user: true,
            plan: true,
            business: true,
          },
        });

        if (!subscription) {
          throw new AppError(
            'Invalid 12-digit Super Admin Access Code.',
            401,
            ErrorCode.ERR_INVALID_CREDENTIALS
          );
        }

        if (subscription.user.email.toLowerCase() !== normalizedEmail) {
          throw new AppError(
            'Access Denied: Email mismatch. This 12-digit Super Admin code is locked to the customer email used to buy the subscription.',
            403,
            ErrorCode.ERR_FORBIDDEN_ROLE
          );
        }

        if (subscription.status !== 'ACTIVE' || new Date(subscription.currentPeriodEnd).getTime() <= Date.now()) {
          throw new AppError(
            'Subscription inactive or expired. Please renew your software license in the Customer Portal (Port 5174).',
            403,
            ErrorCode.ERR_FORBIDDEN_ROLE
          );
        }

        const business = await ensureSubscriptionBusiness(subscription, user);
        const { rawToken, expiresAt } = await createSessionRecord(
          user.id,
          business.id,
          req.ip,
          req.get('user-agent'),
          {
            portal: 'SUPER_ADMIN',
            superAdminSubscriptionId: subscription.id,
          }
        );

        await logAuditEvent({
          businessId: business.id,
          userId: user.id,
          action: 'SUPER_ADMIN_PORTAL_LOGIN',
          entityType: 'SUBSCRIPTION',
          entityId: subscription.id,
          details: { email: user.email, portal: 'SUPER_ADMIN' },
          ipAddress: req.ip,
        });

        setSessionCookie(res, rawToken, expiresAt, 'SUPER_ADMIN');
        const licenseState = await resolveBusinessLicenseState(business);

        return sendSuccess(
          res,
          {
            ...(req.get('X-Viora-Client') === 'web' ? {} : { token: rawToken }),
            expiresAt: expiresAt.toISOString(),
            portal: 'SUPER_ADMIN',
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: 'SUPER_ADMIN',
            },
            business,
            role: 'SUPER_ADMIN',
            subscription: licenseState.subscription,
            billingAuthorized: licenseState.billingAuthorized,
            billingBlockReason: licenseState.billingBlockReason,
            memberships: [
              {
                businessId: business.id,
                businessName: business.name,
                role: 'OWNER',
              },
            ],
          },
          'Signed in to Super Admin Product & Billing Control'
        );
      }

      // =========================================================================
      // PORTAL 2: ADMIN BILLING DESK (Port 5173) -> Super Admin Generated Code
      // =========================================================================
      if (requestedPortal === 'ADMIN') {
        const cleanCode = normalize12DigitCode(accessCode);
        if (!cleanCode) {
          throw new AppError(
            'A valid 12-digit Admin Access Code generated by your Super Admin (Port 5175) is strictly required.',
            400,
            ErrorCode.ERR_VALIDATION
          );
        }

        const adminCode = await prisma.adminAccessCode.findUnique({
          where: { code: cleanCode },
          include: { business: true },
        });

        if (!adminCode) {
          throw new AppError(
            'Invalid Admin Access Code. Generate an access code in your Super Admin Panel (Port 5175).',
            401,
            ErrorCode.ERR_INVALID_CREDENTIALS
          );
        }

        if (!adminCode.isActive) {
          throw new AppError(
            'This Admin Access Code has been revoked by your Super Admin.',
            403,
            ErrorCode.ERR_FORBIDDEN_ROLE
          );
        }

        if (adminCode.assignedEmail && adminCode.assignedEmail.toLowerCase() !== normalizedEmail) {
          throw new AppError(
            `Access Denied: This Admin Access Code is assigned exclusively to ${adminCode.assignedEmail}.`,
            403,
            ErrorCode.ERR_FORBIDDEN_ROLE
          );
        }

        const existingMembership = user.memberships.find((m) => m.businessId === adminCode.businessId);
        const isBusinessOwner = adminCode.business.ownerUserId === user.id;
        const isAssignedUser = adminCode.assignedEmail?.toLowerCase() === normalizedEmail;

        if (!existingMembership && !isBusinessOwner && !isAssignedUser) {
          throw new AppError(
            'Access Denied: Your email does not belong to the business workspace for this Admin Access Code.',
            403,
            ErrorCode.ERR_FORBIDDEN_BUSINESS
          );
        }

        // Ensure membership record exists for authorized owner / assigned operator
        if (!existingMembership && (isBusinessOwner || isAssignedUser)) {
          await prisma.businessMembership.create({
            data: {
              userId: user.id,
              businessId: adminCode.businessId,
              role: isBusinessOwner ? 'OWNER' : adminCode.role,
            },
          });
        }

        const licenseState = await resolveBusinessLicenseState(adminCode.business, adminCode);
        if (!licenseState.isSubscriptionActive) {
          throw new AppError(
            'Software subscription is inactive or expired. Please renew in Customer Portal (Port 5174).',
            403,
            ErrorCode.ERR_FORBIDDEN_ROLE
          );
        }

        await prisma.adminAccessCode.update({
          where: { id: adminCode.id },
          data: { lastUsedAt: new Date() },
        });

        const { rawToken, expiresAt } = await createSessionRecord(
          user.id,
          adminCode.businessId,
          req.ip,
          req.get('user-agent'),
          {
            portal: 'ADMIN',
            adminAccessCodeId: adminCode.id,
          }
        );

        await logAuditEvent({
          businessId: adminCode.businessId,
          userId: user.id,
          action: 'ADMIN_PORTAL_LOGIN',
          entityType: 'ADMIN_ACCESS_CODE',
          entityId: adminCode.id,
          details: { label: adminCode.label, email: user.email, portal: 'ADMIN' },
          ipAddress: req.ip,
        });

        const effectiveRole: UserRole = isBusinessOwner ? 'OWNER' : adminCode.role;
        setSessionCookie(res, rawToken, expiresAt, 'ADMIN');

        return sendSuccess(
          res,
          {
            ...(req.get('X-Viora-Client') === 'web' ? {} : { token: rawToken }),
            expiresAt: expiresAt.toISOString(),
            portal: 'ADMIN',
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: effectiveRole,
            },
            business: adminCode.business,
            role: effectiveRole,
            subscription: licenseState.subscription,
            billingAuthorized: licenseState.billingAuthorized,
            billingBlockReason: licenseState.billingBlockReason,
            adminAccessCode: {
              id: adminCode.id,
              label: adminCode.label,
              canGenerateBills: adminCode.canGenerateBills,
              role: adminCode.role,
            },
            memberships: [
              {
                businessId: adminCode.businessId,
                businessName: adminCode.business.name,
                role: effectiveRole,
              },
            ],
          },
          'Signed in to Billing Admin Desk'
        );
      }

      // =========================================================================
      // PORTAL 3: CUSTOMER PURCHASE PORTAL (Port 5174)
      // =========================================================================
      if (requestedPortal === 'CUSTOMER') {
        if (user.role !== 'CUSTOMER' && user.role !== 'SUPER_ADMIN') {
          throw new AppError(
            'This portal (Port 5174) is reserved for Software Buyer (Customer) accounts. Please use your Customer account, or sign into Port 5173/5175 with your access code.',
            403,
            ErrorCode.ERR_FORBIDDEN_ROLE
          );
        }

        const activeMembership = user.memberships[0] || null;
        const { rawToken, expiresAt } = await createSessionRecord(
          user.id,
          activeMembership?.businessId,
          req.ip,
          req.get('user-agent'),
          { portal: 'CUSTOMER' }
        );

        setSessionCookie(res, rawToken, expiresAt, 'CUSTOMER');

        return sendSuccess(
          res,
          {
            ...(req.get('X-Viora-Client') === 'web' ? {} : { token: rawToken }),
            expiresAt: expiresAt.toISOString(),
            portal: 'CUSTOMER',
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: 'CUSTOMER',
            },
            business: activeMembership?.business || null,
            role: 'CUSTOMER',
            memberships: user.memberships.map((m) => ({
              businessId: m.businessId,
              businessName: m.business.name,
              role: m.role,
            })),
          },
          'Signed in to Customer Purchase Portal'
        );
      }

      // =========================================================================
      // LEGACY / NON-PORTAL API TEST FLOW
      // =========================================================================
      const memberships = user.memberships;
      if (memberships.length === 0 && user.role !== 'SUPER_ADMIN' && user.role !== 'CUSTOMER') {
        throw new AppError('No business access. Contact a business owner.', 403, ErrorCode.ERR_NO_MEMBERSHIP);
      }

      const activeMembership = memberships.length > 0 ? memberships[0] : null;
      const { rawToken, expiresAt } = await createSessionRecord(
        user.id,
        activeMembership?.businessId,
        req.ip,
        req.get('user-agent'),
        { portal: 'API_LEGACY' }
      );

      setSessionCookie(res, rawToken, expiresAt);

      return sendSuccess(
        res,
        {
          ...(req.get('X-Viora-Client') === 'web' ? {} : { token: rawToken }),
          expiresAt: expiresAt.toISOString(),
          portal: 'API_LEGACY',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          business: activeMembership?.business || null,
          role:
            user.role === 'SUPER_ADMIN'
              ? 'SUPER_ADMIN'
              : user.role === 'CUSTOMER'
              ? 'CUSTOMER'
              : activeMembership
              ? activeMembership.role
              : user.role,
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
 * Invalidates session and clears portal-specific cookie
 */
router.post('/logout', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const rawToken = extractToken(req);
    const requestedPortal = extractRequestedPortal(req);
    if (rawToken) {
      await invalidateSessionToken(rawToken);
    }
    clearSessionCookie(res, requestedPortal);
    return sendSuccess(res, null, 'Signed out successfully');
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile, active business, role, and license status
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

  // Never leak superAdminAccessCode to an Admin terminal session
  const sanitizedSubscription = req.subscription
    ? {
        ...req.subscription,
        superAdminAccessCode:
          req.portal === 'ADMIN' ? undefined : req.subscription.superAdminAccessCode,
      }
    : null;

  return sendSuccess(res, {
    user: req.user,
    business: req.business,
    role: req.role,
    portal: req.portal,
    subscription: sanitizedSubscription,
    billingAuthorized: Boolean(req.billingAuthorized),
    billingBlockReason: req.billingBlockReason || null,
    adminAccessCode: req.adminAccessCode
      ? {
          id: req.adminAccessCode.id,
          label: req.adminAccessCode.label,
          canGenerateBills: req.adminAccessCode.canGenerateBills,
          role: req.adminAccessCode.role,
        }
      : null,
    memberships: (fullUser?.memberships || []).map((m) => ({
      businessId: m.businessId,
      businessName: m.business.name,
      role: m.role,
    })),
  });
});

/**
 * POST /api/auth/switch-business
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
        throw new AppError('You do not have access to this business', 403, ErrorCode.ERR_FORBIDDEN_BUSINESS);
      }

      await prisma.session.update({
        where: { id: req.session.id },
        data: { activeBusinessId: businessId },
      });

      return sendSuccess(
        res,
        {
          business: membership.business,
          role: membership.role,
        },
        'Switched active business'
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/auth/members
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
        throw new AppError(
          'This person must register their own account before being added.',
          409,
          ErrorCode.ERR_MEMBER_REGISTRATION_REQUIRED
        );
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
