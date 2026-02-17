import crypto from "crypto";
import { cookies, headers } from "next/headers";
import type { Types } from "mongoose";
import { Session } from "@/lib/models/Session";
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

export function hashSessionToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export type SessionClaims = {
  userId: string;
  companyId: string;
};

export async function createSession(input: {
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  days?: number;
}) {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);

  const h = await headers();
  const ip = getClientIp(h);
  const userAgent = h.get("user-agent") ?? "";

  const days = input.days ?? SESSION_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await Session.create({
    userId: input.userId,
    companyId: input.companyId,
    tokenHash,
    expiresAt,
    ip,
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

export async function getSessionClaims(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const rawToken = jar.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);

  const s = await Session.findOne({
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).select({ userId: 1, companyId: 1 });

  if (!s) return null;

  // Optional: lastSeen update (write load). Keep it lightweight:
  await Session.updateOne({ _id: s._id }, { $set: { lastSeenAt: new Date() } });

  return { userId: String(s.userId), companyId: String(s.companyId) };
}

export async function requireSessionClaims(): Promise<SessionClaims> {
  const claims = await getSessionClaims();
  if (!claims) throw new Error("UNAUTHENTICATED");
  return claims;
}

export async function destroySession(reason = "logout") {
  const jar = await cookies();
  const rawToken = jar.get(SESSION_COOKIE)?.value;

  if (rawToken) {
    const tokenHash = hashSessionToken(rawToken);
    await Session.updateOne(
      { tokenHash, revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: reason } },
    );
  }

  jar.delete(SESSION_COOKIE);
}