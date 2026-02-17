import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { destroySession } from "@/lib/auth/session";

export async function POST() {
  await dbConnect();
  await destroySession("logout");
  return NextResponse.json({ ok: true });
}