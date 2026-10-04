import crypto from "crypto";
import env from "../../config/env";

export const OTP_LENGTH = 6;
export const MAX_OTP_ATTEMPTS = 5;
export const PENDING_SIGNUP_PREFIX = "pending-signup:";

export interface PendingSignup {
  email: string;
  name: string;
  existingUserId?: string;
  hashedPassword: string;
  otp: string;
  attempts: number;
  requestedAt: string;
}

export const generateOtp = (): string =>
  crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");

export const pendingIdentifier = (email: string): string =>
  `${PENDING_SIGNUP_PREFIX}${email}`;

export const otpExpiresAt = (): Date =>
  new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000);

export const otpTtlSeconds = (): number => env.OTP_TTL_MINUTES * 60;

export const serializePending = (pending: PendingSignup): string =>
  JSON.stringify(pending);

export const parsePending = (value: string): PendingSignup | null => {
  try {
    const parsed = JSON.parse(value) as PendingSignup;
    if (!parsed?.otp || !parsed?.hashedPassword || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const matchesOtp = (expected: string, received: string): boolean => {
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(received ?? "").trim());
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
};
