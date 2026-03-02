import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { dbConnect } from "@/lib/db";
import { User } from "@/lib/models/User";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Rate limit: 5 login attempts per 15 minutes per IP
const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW = 15 * 60 * 1000; // 15 minutes

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function getClientIp() {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "";
  return h.get("x-real-ip") ?? "";
}

export async function POST(req: Request) {
  // Rate limit by IP
  const ip = await getClientIp();
  if (isRateLimited(`login:${ip}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }

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
  // Session rotation is enabled by default (invalidates old sessions)
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