import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST() {
  await destroySession("logout");
  return NextResponse.json({ success: true });
}