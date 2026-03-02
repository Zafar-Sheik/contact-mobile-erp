import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { User } from "@/lib/models/User";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  await dbConnect();

  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const { email, password } = body as {
    email?: string;
    password?: string;
  };

  if (!email?.trim()) return badRequest("Email is required");
  if (!password) return badRequest("Password is required");

  const normalizedEmail = email.trim().toLowerCase();

  // Find user by email only
  const user = await User.findOne({
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

  // Create session (sets HTTP-only cookie automatically)
  await createSession({
    _id: user._id,
    companyId: user.companyId,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  });

  // Return success - token is in HTTP-only cookie, not returned
  return NextResponse.json({
    success: true,
    user: {
      id: String(user._id),
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
    },
  });
}