import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { dbConnect } from "@/lib/db";
import { User } from "@/lib/models/User";
import { verifyPassword, hashPassword, needsRehash } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Rate limiting configuration
const LOGIN_RATE_LIMIT = 5; // attempts
const LOGIN_RATE_WINDOW = 15 * 60 * 1000; // 15 minutes

/**
 * Validates login request data
 */
function validateLoginData(body: any): { email: string; password: string } | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const { email, password } = body;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return null;
  }

  if (!password || typeof password !== 'string') {
    return null;
  }

  return {
    email: email.trim().toLowerCase(),
    password
  };
}

/**
 * Gets client IP for rate limiting
 */
async function getClientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "";
  return h.get("x-real-ip") ?? "";
}

/**
 * Handles user login with comprehensive validation and security
 */
export async function POST(req: Request) {
  try {
    // Rate limiting
    const clientIp = await getClientIp();
    if (isRateLimited(`login:${clientIp}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW)) {
      console.warn(`[Login] Rate limit exceeded for IP: ${clientIp}`);
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    await dbConnect();

    // Parse and validate request body
    const body = await req.json().catch(() => null);
    const loginData = validateLoginData(body);

    if (!loginData) {
      return NextResponse.json(
        { error: "Invalid request data. Email and password are required." },
        { status: 400 }
      );
    }

    const { email, password } = loginData;

    console.log(`[Login] Attempt for email: ${email}, IP: ${clientIp}`);

    // Find user
    const user = await User.findOne({
      email,
      isDeleted: false,
    }).select("+passHash");

    if (!user) {
      console.log(`[Login] User not found: ${email}`);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.isActive) {
      console.log(`[Login] Inactive account: ${user._id}`);
      return NextResponse.json({ error: "Account is disabled" }, { status: 403 });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passHash);
    if (!isValidPassword) {
      console.log(`[Login] Invalid password for user: ${user._id}`);
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Rehash password if needed (security upgrade)
    if (needsRehash(user.passHash)) {
      console.log(`[Login] Rehashing password for user: ${user._id}`);
      try {
        const newHash = await hashPassword(password);
        await User.updateOne({ _id: user._id }, { $set: { passHash: newHash } });
      } catch (error) {
        console.error(`[Login] Failed to rehash password for user ${user._id}:`, error);
        // Continue with login even if rehash fails
      }
    }

    // Create session
    await createSession({
      _id: user._id,
      companyId: user.companyId,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    }, req, { reason: "User login" });

    console.log(`[Login] Success for user: ${user._id} (${email})`);

    return NextResponse.json({
      success: true,
      user: {
        id: String(user._id),
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('[Login] Unexpected error:', error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}