import { ErrorCode } from '../utils/errorCodes';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { prisma } from '../config/prisma';
import {
  parseCookies,
  validateSessionToken,
  normalizePortalScope,
  getCookieNameForPortal,
  invalidateSessionToken,
} from '../utils/auth';
import { PortalScope, UserRole } from '../generated/prisma-client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role?: UserRole;
  };
  business?: any;
  membership?: any;
  role?: UserRole;
  userRole?: UserRole;
  portal?: PortalScope;
  session?: any;
  sessionToken?: string;
  subscription?: any;
  billingAuthorized?: boolean;
  billingBlockReason?: string | null;
  adminAccessCode?: any;
}

export function extractRequestedPortal(req: Request): PortalScope | null {
  const headerPortal = req.headers['x-viora-portal'];
  if (typeof headerPortal === 'string') {
    return normalizePortalScope(headerPortal);
  }
  return null;
}

export function extractToken(req: Request): string | null {
  // 1. Check HTTP Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  // 2. Check portal-scoped cookies
  const cookies = parseCookies(req.headers.cookie);
  const requestedPortal = extractRequestedPortal(req);
  const cookieName = getCookieNameForPortal(requestedPortal);
  if (cookies[cookieName]) {
    return cookies[cookieName];
  }

  // Fallback for non-portal clients
  if (!requestedPortal && cookies['viora_session']) {
    return cookies['viora_session'];
  }

  // 3. Check X-Session-Token header
  const customHeader = req.headers['x-session-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  return null;
}

/**
 * Computes active SaaS subscription and Super Admin billing permission for a business
 */
export async function resolveBusinessLicenseState(
  business: any,
  adminAccessCode?: any
): Promise<{
  subscription: any | null;
  isSubscriptionActive: boolean;
  billingAuthorized: boolean;
  billingBlockReason: string | null;
}> {
  if (!business) {
    return {
      subscription: null,
      isSubscriptionActive: false,
      billingAuthorized: false,
      billingBlockReason: 'No active business workspace associated with account.',
    };
  }

  const subWhereOr: any[] = [{ businessId: business.id }];
  if (business.ownerUserId) {
    subWhereOr.push({ userId: business.ownerUserId });
  }

  const activeSub = await prisma.subscription.findFirst({
    where: {
      status: 'ACTIVE',
      OR: subWhereOr,
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  const now = Date.now();
  const isSubscriptionActive = Boolean(
    activeSub && new Date(activeSub.currentPeriodEnd).getTime() > now
  );
  const isBusinessBillingAllowed = Boolean(business.allowAdminBilling);
  const isCodeAllowed = adminAccessCode
    ? Boolean(adminAccessCode.isActive && adminAccessCode.canGenerateBills)
    : true;

  let billingBlockReason: string | null = null;
  if (!activeSub) {
    billingBlockReason =
      'No active software subscription found. Purchase a plan on Customer Portal (Port 5174).';
  } else if (!isSubscriptionActive) {
    billingBlockReason =
      'Software subscription has expired. Renew your plan on Customer Portal (Port 5174).';
  } else if (!isBusinessBillingAllowed) {
    billingBlockReason =
      'Billing generation is currently paused by your Super Admin. Enable "Allow Admin Billing" inside Super Admin Panel (Port 5175).';
  } else if (!isCodeAllowed) {
    billingBlockReason =
      'Your Admin Access Code is currently paused or revoked for bill generation by Super Admin.';
  }

  return {
    subscription: activeSub,
    isSubscriptionActive,
    billingAuthorized: isSubscriptionActive && isBusinessBillingAllowed && isCodeAllowed,
    billingBlockReason,
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    const rawToken = extractToken(req);
    if (!rawToken) {
      throw new AppError('Authentication required. Please sign in.', 401, ErrorCode.ERR_UNAUTHORIZED);
    }

    const session = await validateSessionToken(rawToken);
    if (!session || !session.user) {
      throw new AppError('Session expired or invalid. Please sign in again.', 401, ErrorCode.ERR_UNAUTHORIZED);
    }

    const requestedPortal = extractRequestedPortal(req);
    if (
      requestedPortal &&
      session.portal !== 'API_LEGACY' &&
      session.portal !== requestedPortal
    ) {
      throw new AppError(
        `Session portal mismatch. Please sign in to the ${requestedPortal} portal.`,
        401,
        ErrorCode.ERR_UNAUTHORIZED
      );
    }

    // Verify Admin Access Code is still active on every Admin portal request
    if (session.portal === 'ADMIN') {
      if (!session.adminAccessCode || !session.adminAccessCode.isActive) {
        await invalidateSessionToken(rawToken).catch(() => {});
        throw new AppError(
          'Your Admin Access Code has been revoked by Super Admin. Please sign in with a valid code.',
          401,
          ErrorCode.ERR_UNAUTHORIZED
        );
      }
    }

    const user = session.user;
    const memberships = user.memberships || [];

    const isSuperAdminSession = session.portal === 'SUPER_ADMIN' || user.role === 'SUPER_ADMIN';
    const isCustomerSession = session.portal === 'CUSTOMER' || user.role === 'CUSTOMER';

    if (memberships.length === 0 && !isSuperAdminSession && !isCustomerSession) {
      throw new AppError('No business access. Contact a business owner.', 403, ErrorCode.ERR_NO_MEMBERSHIP);
    }

    // Determine active business if user has memberships
    let activeMembership = memberships.length > 0 ? memberships[0] : null;
    const requestedBizId = req.headers['x-business-id'] as string;

    if (requestedBizId && memberships.length > 0) {
      const found = memberships.find((m) => m.businessId === requestedBizId);
      if (found) {
        activeMembership = found;
      } else {
        throw new AppError('You do not have access to the specified business', 403, ErrorCode.ERR_FORBIDDEN_BUSINESS);
      }
    } else if (session.activeBusinessId && memberships.length > 0) {
      const found = memberships.find((m) => m.businessId === session.activeBusinessId);
      if (found) {
        activeMembership = found;
      }
    }

    const activeBusiness = activeMembership ? activeMembership.business : null;

    // Resolve effective role cleanly based on portal scope
    let resolvedRole: UserRole;
    if (session.portal === 'SUPER_ADMIN') {
      resolvedRole = 'SUPER_ADMIN';
    } else if (session.portal === 'CUSTOMER') {
      resolvedRole = 'CUSTOMER';
    } else if (session.portal === 'ADMIN') {
      resolvedRole = session.adminAccessCode?.role || activeMembership?.role || 'OWNER';
    } else {
      resolvedRole =
        user.role === 'SUPER_ADMIN'
          ? 'SUPER_ADMIN'
          : user.role === 'CUSTOMER'
          ? 'CUSTOMER'
          : activeMembership
          ? activeMembership.role
          : user.role;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    req.business = activeBusiness;
    req.membership = activeMembership;
    req.role = resolvedRole;
    req.userRole = user.role;
    req.portal = session.portal;
    req.session = session;
    req.sessionToken = rawToken;
    req.adminAccessCode = session.adminAccessCode || null;

    if (activeBusiness) {
      const licenseState = await resolveBusinessLicenseState(
        activeBusiness,
        session.adminAccessCode
      );
      req.subscription = licenseState.subscription;
      req.billingAuthorized = licenseState.billingAuthorized;
      req.billingBlockReason = licenseState.billingBlockReason;
    } else {
      req.subscription = null;
      req.billingAuthorized = false;
      req.billingBlockReason = null;
    }

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (req.portal === 'SUPER_ADMIN' || req.role === 'SUPER_ADMIN') {
      return next();
    }
    if (!req.role || !allowedRoles.includes(req.role)) {
      return next(
        new AppError(
          `Permission denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.role || 'NONE'}`,
          403,
          ErrorCode.ERR_FORBIDDEN_ROLE
        )
      );
    }
    next();
  };
}

/**
 * Enforces that Admin Portal sessions can only generate/issue bills when authorized by Super Admin
 * and backed by an active SaaS subscription within plan invoice limits.
 */
export async function requireBillingAuthorized(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    // Keep non-portal legacy backend API tests unaffected
    if (req.portal === 'API_LEGACY') {
      return next();
    }

    if (req.portal === 'CUSTOMER') {
      throw new AppError(
        'Billing operations are not available in Customer Purchase Portal. Please log into Admin Desk (Port 5173) using an Admin Access Code.',
        403,
        ErrorCode.ERR_FORBIDDEN_ROLE
      );
    }

    if (req.portal === 'ADMIN') {
      if (!req.billingAuthorized) {
        throw new AppError(
          req.billingBlockReason || 'Bill generation is not authorized by your Super Admin.',
          403,
          ErrorCode.ERR_FORBIDDEN_ROLE
        );
      }

      // Check plan invoice limit
      const limit = req.subscription?.plan?.invoiceLimit;
      if (typeof limit === 'number' && limit > 0 && req.business) {
        const count = await prisma.invoice.count({
          where: { businessId: req.business.id },
        });
        if (count >= limit) {
          throw new AppError(
            `Plan invoice limit (${limit}) reached for ${req.subscription.plan.name}. Upgrade your subscription in Customer Portal (Port 5174).`,
            403,
            ErrorCode.ERR_FORBIDDEN_ROLE
          );
        }
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}
