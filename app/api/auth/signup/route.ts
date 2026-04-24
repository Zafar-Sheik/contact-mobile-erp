import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Company } from "@/lib/models/Company";
import { User } from "@/lib/models/User";
import { createSession } from "@/lib/auth/session";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";

export const runtime = "nodejs";

/**
 * Validates signup request data and returns specific error messages
 */
function validateSignupData(body: any): {
  data: {
    companyName: string;
    isVatRegistered: boolean;
    vatNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone: string;
  };
  error?: string;
} | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: "Request body must be a valid JSON object" };
  }

  const {
    companyName,
    isVatRegistered = false,
    vatNumber = "",
    firstName,
    lastName,
    email,
    password,
    phone = "",
  } = body;

  // Required field validation
  if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
    return { error: "Company name is required and must be a non-empty string" };
  }

  if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
    return { error: "First name is required and must be a non-empty string" };
  }

  if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
    return { error: "Last name is required and must be a non-empty string" };
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return { error: "Email is required and must be a valid string" };
  }

  if (!password || typeof password !== 'string') {
    return { error: "Password is required and must be a string" };
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { error: "Email must be a valid email address format" };
  }

  return {
    data: {
      companyName: companyName.trim(),
      isVatRegistered: Boolean(isVatRegistered),
      vatNumber: typeof vatNumber === 'string' ? vatNumber.trim() : "",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: typeof phone === 'string' ? phone.trim() : "",
    }
  };
}

/**
 * Handles user signup with comprehensive validation
 */
export async function POST(req: Request) {
  try {
    await dbConnect();

    // Parse and validate request
    const body = await req.json().catch(() => null);
    console.log(`[Signup] Received request body:`, JSON.stringify(body, null, 2));
    const validation = validateSignupData(body);

    if ('error' in validation) {
      console.log(`[Signup] Validation error: ${validation.error}`);
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const {
      companyName,
      isVatRegistered,
      vatNumber,
      firstName,
      lastName,
      email,
      password,
      phone,
    } = validation.data;

    // Validate password strength
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    console.log(`[Signup] Creating company and user: ${email}`);

    // Check if email already exists globally (since emails should be unique across companies)
    const existingUser = await User.findOne({ email, isDeleted: false });
    if (existingUser) {
      console.log(`[Signup] Email already exists: ${email}`);
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Create company
    const company = new Company({
      companyId: null, // Will be set to own _id
      createdBy: null, // Will be set after user creation
      updatedBy: null,

      profile: {
        legalName: companyName,
        isVatRegistered,
        vatNumber,
      },
      status: "Active",
    });

    // Set companyId to own _id for first company
    company.companyId = company._id;
    await company.save({ validateBeforeSave: false });

    // Hash password
    const passHash = await hashPassword(password);

    // Create user
    const user = new User({
      companyId: company._id,
      createdBy: null, // Will be set after creation
      updatedBy: null,

      firstName,
      lastName,
      email,
      phone,

      role: "admin",
      passHash,
      isActive: true,
      permissions: [],
    });

    await user.save({ validateBeforeSave: false });

    // Update audit fields
    const now = new Date();
    await Promise.all([
      Company.updateOne(
        { _id: company._id },
        { $set: { createdBy: user._id, updatedBy: user._id, createdAt: now, updatedAt: now } }
      ),
      User.updateOne(
        { _id: user._id },
        { $set: { createdBy: user._id, updatedBy: user._id, createdAt: now, updatedAt: now } }
      ),
    ]);

    // Create session
    await createSession({
      _id: user._id,
      companyId: company._id,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    }, req, { reason: "Account creation" });

    console.log(`[Signup] Success: User ${user._id}, Company ${company._id}`);

    // Get callback URL
    const callbackUrl = req.headers.get("x-callback-url") || "/";

    return NextResponse.json(
      {
        success: true,
        company: {
          id: String(company._id),
          name: company.profile.legalName
        },
        user: {
          id: String(user._id),
          companyId: String(company._id),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
        callbackUrl,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('[Signup] Unexpected error:', error);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}