/**
 * Common Validation & Normalization Utilities
 * Implements strict Indian GSTIN & 10-Digit Mobile Number Rules
 */

/**
 * Validates and normalizes Indian mobile phone numbers.
 * Supported formats:
 * - Exactly 10 digits (e.g. 9876543210)
 * - With +91 prefix (e.g. +91 98765 43210, +91-9876543210)
 * - With leading 0 (e.g. 09876543210)
 * Rejects numbers containing letters.
 * Rejects unsupported lengths (e.g. 11 digits without 0, 9 digits).
 */
export function validateAndNormalizeIndianPhone(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val !== 'string') {
    throw new Error('Phone number must be a valid string');
  }

  const trimmed = val.trim();
  if (trimmed === '') return '';

  if (/[a-zA-Z]/.test(trimmed)) {
    throw new Error('Phone number must not contain letters');
  }

  let cleaned = trimmed.replace(/[\s\-\(\)\.]/g, '');

  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }

  if (!/^\d{10}$/.test(cleaned)) {
    throw new Error('Phone number must be a valid 10-digit Indian mobile number');
  }

  return cleaned;
}

/**
 * Validates and normalizes Indian Goods and Services Tax Identification Numbers (GSTIN).
 * Expected structure:
 * - 2 digits (State code)
 * - 5 letters (PAN letters)
 * - 4 digits (PAN digits)
 * - 1 letter (PAN letter)
 * - 1 entity number (1-9, A-Z)
 * - 'Z' character
 * - 1 check digit/letter
 * Total: 15 alphanumeric characters
 */
export function validateAndNormalizeGSTIN(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val !== 'string') {
    throw new Error('GSTIN must be a string');
  }

  const trimmed = val.trim().toUpperCase();
  if (trimmed === '') return null;

  const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!GSTIN_REGEX.test(trimmed)) {
    throw new Error(
      'Invalid GSTIN format. Expected 15-character alphanumeric format (e.g., 29ABCDE1234F1Z5)'
    );
  }

  return trimmed;
}

/**
 * Sanitizes user text by stripping dangerous HTML and script tags to prevent Stored XSS.
 */
export function sanitizePlainText(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val !== 'string') return String(val);
  return val
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[<>]/g, '')     // Strip any loose angle brackets
    .trim();
}

