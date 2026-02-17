import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  try {
    await dbConnect();
    const session = await getSessionClaims();
    
    return NextResponse.json({
      connected: true,
      hasSession: !!session,
      session: session ? {
        companyId: session.companyId,
        userId: session.userId,
      } : null,
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
