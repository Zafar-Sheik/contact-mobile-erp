import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
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
}
