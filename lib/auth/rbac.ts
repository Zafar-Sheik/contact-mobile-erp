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
  
  // Case-insensitive role check
  const userRoleLower = session.role?.toLowerCase();
  const hasAllowedRole = allowedRoles.some(role => role.toLowerCase() === userRoleLower);
  
  if (!hasAllowedRole) {
    console.log("[RBAC] Role check failed:", { userRole: session.role, allowedRoles });
    return NextResponse.json(
      { error: `Forbidden - your role (${session.role}) doesn't have permission for this action` },
      { status: 403 }
    );
  }
  
  return session;
}

/**
 * Require admin role (shortcut for requireRole(["admin"]))
 */
export async function requireAdmin() {
  return requireRole(["admin", "owner"]);
}

/**
 * Require manager or admin role
 */
export async function requireManager() {
  return requireRole(["admin", "manager", "owner"]);
}
