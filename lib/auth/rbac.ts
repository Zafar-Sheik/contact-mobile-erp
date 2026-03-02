import { NextResponse } from "next/server";
import { getSession } from "./session";

export type { SessionClaims } from "./session";

/**
 * Require authentication - validates session and returns user claims.
 * Returns 401 if not authenticated.
 */
export async function requireAuth() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  return session;
}

/**
 * Require specific roles - validates session and checks user role.
 * Returns 403 if role not allowed, 401 if not authenticated.
 */
export async function requireRole(allowedRoles: string[]) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  if (!allowedRoles.includes(session.role)) {
    return NextResponse.json(
      { error: "Forbidden - insufficient permissions" },
      { status: 403 }
    );
  }
  
  return session;
}

/**
 * Require admin role (shortcut for requireRole(["admin"]))
 */
export async function requireAdmin() {
  return requireRole(["admin"]);
}

/**
 * Require manager or admin role
 */
export async function requireManager() {
  return requireRole(["admin", "manager"]);
}
