import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { User } from "@/lib/models/User";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  await dbConnect();

  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const { email, password, companyId } = body as {
    email?: string;
    password?: string;
    companyId?: string;
  };

  if (!companyId?.trim()) return badRequest("companyId is required");
  if (!email?.trim()) return badRequest("Email is required");
  if (!password) return badRequest("Password is required");

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    companyId: companyId.trim(),
    email: normalizedEmail,
    isDeleted: false,
  }).select("+passHash");

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  if (!user.isActive) {
    return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
  }

  const ok = await verifyPassword(password, user.passHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  await createSession({ userId: user._id, companyId: user.companyId });

  // Get callback URL or default to dashboard
  const callbackUrl = req.headers.get("x-callback-url") || "/";

  // Return success with redirect URL
  return NextResponse.json({
    ok: true,
    user: {
      id: String(user._id),
      companyId: String(user.companyId),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
    },
    callbackUrl,
  });
}