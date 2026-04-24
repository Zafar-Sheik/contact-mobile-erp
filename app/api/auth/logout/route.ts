import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Handles user logout by destroying their session
 */
export async function POST() {
  try {
    await destroySession("user logout");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Logout] Error:', error);
    return NextResponse.json(
      { error: "Logout failed" },
      { status: 500 }
    );
  }
}