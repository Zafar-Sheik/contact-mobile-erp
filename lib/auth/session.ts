import crypto from "crypto";
import { cookies, headers } from "next/headers";
import type { Types } from "mongoose";
import { Session } from "@/lib/models/Session";
import { User } from "@/lib/models/User";
import { Supplier } from "@/lib/models/Supplier";
import { dbConnect } from "@/lib/db";
import { hashPassword } from "./password";

// Session configuration
const SESSION_COOKIE = 'session_token';
const SESSION_DAYS = Number(process.env.SESSION_DAYS ?? 7); // Default 7 days
const INACTIVITY_DAYS = Number(process.env.INACTIVITY_DAYS ?? 1); // Inactivity timeout
const MAX_SESSIONS_PER_USER = Number(process.env.MAX_SESSIONS_PER_USER ?? 5); // Max concurrent sessions

function isProd() {
  return process.env.NODE_ENV === "production";
}

function getClientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "";
  return h.get("x-real-ip") ?? "";
}

function getUserAgent(h: Headers): string {
  return h.get("user-agent") ?? "Unknown";
}

/**
 * Generates a cryptographically secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex"); // 64 characters
}

export type SessionClaims = {
  userId: string;
  companyId: string;
  role: string;
  firstName: string;
  lastName: string;
  email: string;
};

/**
 * Cleans up expired sessions and old indexes (migration)
 */
async function cleanupSessions() {
  try {
    // Remove expired sessions
    const expiredCount = await Session.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    if (expiredCount.deletedCount > 0) {
      console.log(`[Session] Cleaned up ${expiredCount.deletedCount} expired sessions`);
    }

    // Drop old tokenHash index if exists
    const sessionModel = Session;
    const collection = sessionModel.collection;
    const indexes = await collection.indexes();
    const hasOldIndex = indexes.some((idx: any) => idx.key && idx.key.tokenHash === 1);
    if (hasOldIndex) {
      console.log("[Session] Dropping old tokenHash index...");
      await collection.dropIndex("tokenHash_1").catch(() => {});
    }
  } catch (error) {
    console.warn("[Session] Cleanup error:", error);
  }
}

/**
 * Invalidate old sessions for a user, keeping only recent ones
 */
async function rotateUserSessions(userId: Types.ObjectId, reason: string, keepRecent = MAX_SESSIONS_PER_USER) {
  // Get all active sessions for user, sorted by creation
  const activeSessions = await Session.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (activeSessions.length > keepRecent) {
    // Revoke excess sessions
    const toRevoke = activeSessions.slice(keepRecent);
    await Session.updateMany(
      { _id: { $in: toRevoke.map(s => s._id) } },
      { $set: { revokedAt: new Date(), revokeReason: `${reason} - session limit` } }
    );
    console.log(`[Session] Revoked ${toRevoke.length} excess sessions for user ${userId}`);
  }
}

/**
 * Creates a new session for a user with enhanced security
 * - Rotates old sessions to prevent session fixation
 * - Sets secure HTTP-only cookies
 * - Includes device fingerprinting
 */
export async function createSession(
  user: {
    _id: Types.ObjectId;
    companyId: Types.ObjectId;
    role: string;
    firstName: string;
    lastName: string;
    email: string;
  },
  _request?: Request,
  options?: { rotateSession?: boolean; reason?: string }
) {
  await dbConnect();
  await cleanupSessions();

  const rotateSession = options?.rotateSession ?? true;
  const reason = options?.reason || "New login";

  // Rotate sessions to prevent fixation attacks and limit concurrent sessions
  if (rotateSession) {
    await rotateUserSessions(user._id, reason);
  }

  const rawToken = generateSessionToken();
  const h = await headers();
  const ipAddress = getClientIp(h);
  const userAgent = getUserAgent(h);

  // Create expiration date
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  // Create session document
  const session = await Session.create({
    userId: user._id,
    companyId: user.companyId,
    sessionToken: rawToken,
    expiresAt,
    ipAddress,
    userAgent,
    createdAt: new Date(),
    lastSeenAt: new Date(),
  });

  // Set secure HTTP-only cookie
  (await cookies()).set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_DAYS * 24 * 60 * 60, // seconds
  });

  console.log(`[Session] Created new session for user ${user._id} (${reason})`);
  return { sessionId: session._id, expiresAt };
}

/**
 * Retrieves and validates the current session
 * - Implements sliding expiration for active users
 * - Updates last seen timestamp
 * - Validates session integrity
 */
export async function getSession(): Promise<SessionClaims | null> {
  await dbConnect();

  // Force model registration to prevent schema errors in dev
  await User.findOne({}).select('_id').limit(1).lean();
  await Supplier.findOne({}).select('_id').limit(1).lean();

  const jar = await cookies();
  const rawToken = jar.get(SESSION_COOKIE)?.value;

  if (!rawToken || typeof rawToken !== 'string' || rawToken.length !== 64) {
    return null;
  }

  try {
    const session = await Session.findOne({
      sessionToken: rawToken,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).populate<{
      userId: { role: string; firstName: string; lastName: string; email: string; isActive: boolean; isDeleted: boolean }
    }>(
      "userId",
      "role firstName lastName email isActive isDeleted"
    );

    if (!session || !session.userId || session.userId.isDeleted || !session.userId.isActive) {
      return null;
    }

    const now = new Date();
    const daysUntilExpiry = (session.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    // Sliding expiration: extend if close to expiry
    if (daysUntilExpiry < INACTIVITY_DAYS) {
      const newExpiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
      await Session.updateOne(
        { _id: session._id },
        { $set: { lastSeenAt: now, expiresAt: newExpiresAt } }
      );

      // Extend cookie
      (await cookies()).set(SESSION_COOKIE, rawToken, {
        httpOnly: true,
        secure: isProd(),
        sameSite: "lax",
        path: "/",
        expires: newExpiresAt,
      });

      console.log(`[Session] Extended session for user ${session.userId._id}`);
    } else {
      // Update last seen
      await Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: now } });
    }

    return {
      userId: String(session.userId._id),
      companyId: String(session.companyId),
      role: session.userId.role,
      firstName: session.userId.firstName,
      lastName: session.userId.lastName,
      email: session.userId.email,
    };
  } catch (error) {
    console.error('[Session] Error retrieving session:', error);
    return null;
  }
}

export async function requireSession(): Promise<SessionClaims> {
  const claims = await getSession();
  if (!claims) throw new Error("UNAUTHENTICATED");
  return claims;
}

// Backward compatibility aliases
export const getSessionClaims = getSession;
export const requireSessionClaims = requireSession;

/**
 * Destroys the current session (logout)
 */
export async function destroySession(reason = "logout") {
  const jar = await cookies();
  const rawToken = jar.get(SESSION_COOKIE)?.value;

  if (rawToken) {
    try {
      await Session.updateOne(
        { sessionToken: rawToken, revokedAt: null },
        { $set: { revokedAt: new Date(), revokeReason: reason } }
      );
      console.log(`[Session] Destroyed session (${reason})`);
    } catch (error) {
      console.error('[Session] Error destroying session:', error);
    }
  }

  jar.delete(SESSION_COOKIE);
}

/**
 * Destroys all sessions for a specific user
 */
export async function destroyUserSessions(userId: Types.ObjectId, reason = "admin action") {
  const result = await Session.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokeReason: reason } }
  );

  console.log(`[Session] Destroyed ${result.modifiedCount} sessions for user ${userId} (${reason})`);
  return result.modifiedCount;
}

/**
 * Validates session token without retrieving user data
 */
export async function validateSessionToken(token: string): Promise<boolean> {
  if (!token || typeof token !== 'string' || token.length !== 64) {
    return false;
  }

  try {
    const session = await Session.findOne({
      sessionToken: token,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    }).select('_id');

    return !!session;
  } catch {
    return false;
  }
}

// Export constants for use in other modules
export { SESSION_COOKIE };