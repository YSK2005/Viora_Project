import {ErrorCode} from '../utils/errorCodes';
import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { parseCookies, validateSessionToken } from '../utils/auth';
import { UserRole } from '../generated/prisma-client';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  business?: any;
  membership?: any;
  role?: UserRole;
  session?: any;
  sessionToken?: string;
}

export function extractToken(req: Request): string | null {
  // 1. Check HTTP Authorization header: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  // 2. Check cookies
  const cookies = parseCookies(req.headers.cookie);
  if (cookies['viora_session']) {
    return cookies['viora_session'];
  }

  // 3. Check X-Session-Token header
  const customHeader = req.headers['x-session-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  return null;
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

    const user = session.user;
    const memberships = user.memberships || [];

    // Revoked or orphaned users must never gain access implicitly.
    if (memberships.length === 0) {
      throw new AppError('No business access. Contact a business owner.', 403, ErrorCode.ERR_NO_MEMBERSHIP);
    }

    // Determine active business
    const requestedBizId = req.headers['x-business-id'] as string;
    let activeMembership = memberships[0];

    if (requestedBizId) {
      const found = memberships.find((m) => m.businessId === requestedBizId);
      if (found) {
        activeMembership = found;
      } else {
        throw new AppError('You do not have access to the specified business', 403, ErrorCode.ERR_FORBIDDEN_BUSINESS);
      }
    } else if (session.activeBusinessId) {
      const found = memberships.find((m) => m.businessId === session.activeBusinessId);
      if (found) {
        activeMembership = found;
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };
    req.business = activeMembership.business;
    req.membership = activeMembership;
    req.role = activeMembership.role;
    req.session = session;
    req.sessionToken = rawToken;

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
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
