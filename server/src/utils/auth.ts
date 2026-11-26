import crypto from 'crypto';
import { Response } from 'express';
import { PortalScope } from '../generated/prisma-client';
import { prisma } from '../config/prisma';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    const keyBuf = Buffer.from(key, 'hex');
    const hashBuf = Buffer.from(hash, 'hex');
    if (keyBuf.length !== hashBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, hashBuf);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach((part) => {
    const [k, ...v] = part.trim().split('=');
    if (k) {
      try {
        cookies[k] = decodeURIComponent(v.join('='));
      } catch {
        /* Ignore malformed cookies. */
      }
    }
  });
  return cookies;
}

export function normalizePortalScope(raw?: string | null): PortalScope | null {
  if (!raw || typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  if (upper === 'CUSTOMER') return 'CUSTOMER';
  if (upper === 'SUPER_ADMIN' || upper === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (upper === 'ADMIN') return 'ADMIN';
  if (upper === 'API_LEGACY') return 'API_LEGACY';
  return null;
}

export function getCookieNameForPortal(portal?: PortalScope | string | null): string {
  const scope = typeof portal === 'string' ? normalizePortalScope(portal) : portal;
  switch (scope) {
    case 'CUSTOMER':
      return 'viora_session_customer';
    case 'SUPER_ADMIN':
      return 'viora_session_superadmin';
    case 'ADMIN':
      return 'viora_session_admin';
    default:
      return 'viora_session';
  }
}

export function setSessionCookie(
  res: Response,
  token: string,
  expiresAt: Date,
  portal?: PortalScope | null
) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieName = getCookieNameForPortal(portal);
  const cookieOptions = [
    `${cookieName}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (isProd) {
    cookieOptions.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieOptions.join('; '));
}

export function clearSessionCookie(res: Response, portal?: PortalScope | null) {
  const cookieName = getCookieNameForPortal(portal);
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
}

export const SESSION_EXPIRY_DAYS = 7;

export async function createSessionRecord(
  userId: string,
  activeBusinessId?: string,
  ipAddress?: string,
  userAgent?: string,
  options?: {
    portal?: PortalScope;
    adminAccessCodeId?: string;
    superAdminSubscriptionId?: string;
  }
) {
  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      tokenHash,
      userId,
      activeBusinessId: activeBusinessId || null,
      portal: options?.portal || 'API_LEGACY',
      adminAccessCodeId: options?.adminAccessCodeId || null,
      superAdminSubscriptionId: options?.superAdminSubscriptionId || null,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  });

  return { rawToken, session, expiresAt };
}

export async function validateSessionToken(rawToken: string) {
  if (!rawToken || typeof rawToken !== 'string') return null;
  const tokenHash = hashToken(rawToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      adminAccessCode: true,
      user: {
        include: {
          memberships: {
            include: {
              business: true,
            },
          },
        },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session;
}

export async function invalidateSessionToken(rawToken: string) {
  if (!rawToken || typeof rawToken !== 'string') return;
  const tokenHash = hashToken(rawToken);
  await prisma.session.deleteMany({ where: { tokenHash } });
}
