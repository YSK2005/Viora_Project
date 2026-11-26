import crypto from 'crypto';
import { prisma } from '../config/prisma';

/**
 * Generates a cryptographically secure 12-digit numeric access code.
 */
export function generate12DigitCode(): string {
  return crypto.randomInt(100_000_000_000, 1_000_000_000_000).toString();
}

/**
 * Normalizes user input (strips spaces and hyphens) and verifies strictly 12 digits.
 */
export function normalize12DigitCode(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input.replace(/[\s-]/g, '').trim();
  return /^\d{12}$/.test(cleaned) ? cleaned : null;
}

/**
 * Generates a unique 12-digit Super Admin Access Code persisted on Subscription records.
 */
export async function generateUniqueSuperAdminCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = generate12DigitCode();
    const existing = await prisma.subscription.findUnique({
      where: { superAdminAccessCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error('Unable to allocate unique 12-digit Super Admin Access Code');
}

/**
 * Generates a unique 12-digit Admin Access Code created by Super Admin for Billing Admins.
 */
export async function generateUniqueAdminCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = generate12DigitCode();
    const existing = await prisma.adminAccessCode.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error('Unable to allocate unique 12-digit Admin Access Code');
}
