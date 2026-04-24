import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Returns current user information from session
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: session.userId,
        companyId: session.companyId,
        role: session.role,
        firstName: session.firstName,
        lastName: session.lastName,
        email: session.email,
      },
    });
  } catch (error) {
    console.error('[Me] Error retrieving user info:', error);
    return NextResponse.json(
      { error: "Failed to retrieve user information" },
      { status: 500 }
    );
  }
}
