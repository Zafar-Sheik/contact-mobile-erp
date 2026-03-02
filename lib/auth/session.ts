import crypto from "crypto";
import { cookies, headers } from "next/headers";
import type { Types } from "mongoose";
import { Session } from "@/lib/models/Session";
import { User } from "@/lib/models/User";
import { dbConnect } from "@/lib/db";
import { SESSION_COOKIE } from "./constants";

// Re-export for backward compatibility
export { SESSION_COOKIE };

// Prefer env override; default 14 days
const SESSION_DAYS = Number(process.env.SESSION_DAYS ?? 14);

function isProd() {
  return process.env.NODE_ENV === "production";
}

function getClientIp(h: Headers) {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "";
  return h.get("x-real-ip") ?? "";
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString("hex"); // 64 chars
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
 * Create a new session for a user.
 * @param user - User object (from DB, must have _id, companyId, role, firstName, lastName, email)
 * @param request - Request object (optional, for IP/userAgent)
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
  _request?: Request
) {
  const rawToken = generateSessionToken();

  const h = await headers();
  const ipAddress = getClientIp(h);
  const userAgent = h.get("user-agent") ?? "";

  const days = SESSION_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await Session.create({
    userId: user._id,
    companyId: user.companyId,
    sessionToken: rawToken,
    expiresAt,
    ipAddress,
    userAgent,
  });

  (await cookies()).set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return { expiresAt };
}

/**
 * Get current session and validate.
 * Returns user data if session is valid, null otherwise.
 */
export async function getSession(): Promise<SessionClaims | null> {
  // Ensure database connection before querying
  await dbConnect();
  
  const jar = await cookies();
  const rawToken = jar.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const s = await Session.findOne({
    sessionToken: rawToken,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).populate<{ userId: { role: string; firstName: string; lastName: string; email: string } }>(
    "userId",
    "role firstName lastName email"
  );

  if (!s) return null;

  // Optional: lastSeen update (write load). Keep it lightweight:
  await Session.updateOne({ _id: s._id }, { $set: { lastSeenAt: new Date() } });

  return { 
    userId: String(s.userId._id), 
    companyId: String(s.companyId),
    role: s.userId.role,
    firstName: s.userId.firstName,
    lastName: s.userId.lastName,
    email: s.userId.email,
  };
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
 * Destroy session (logout).
 */
export async function destroySession(_reason = "logout") {
  const jar = await cookies();
  const rawToken = jar.get(SESSION_COOKIE)?.value;

  if (rawToken) {
    await Session.updateOne(
      { sessionToken: rawToken, revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: _reason } },
    );
  }

  jar.delete(SESSION_COOKIE);
}