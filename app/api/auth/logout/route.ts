import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { dbConnect } from "@/lib/db";
import { Session } from "@/lib/models/Session";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export const runtime = "nodejs";

export async function POST() {
  await dbConnect();
  const jar = await cookies();
  const rawToken = jar.get(SESSION_COOKIE)?.value;

  if (rawToken) {
    await Session.updateOne(
      { sessionToken: rawToken, revokedAt: null },
      { $set: { revokedAt: new Date(), revokeReason: "logout" } },
    );
  }

  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}