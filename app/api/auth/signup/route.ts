import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Company } from "@/lib/models/Company";
import { User } from "@/lib/models/User";
import { createSession } from "@/lib/auth/session";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  await dbConnect();

  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const {
    companyName,
    isVatRegistered,
    vatNumber,
    firstName,
    lastName,
    email,
    password,
    phone,
  } = body as {
    companyName?: string;
    isVatRegistered?: boolean;
    vatNumber?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    phone?: string;
  };

  if (!companyName?.trim()) return badRequest("Company name is required");
  if (!firstName?.trim()) return badRequest("First name is required");
  if (!lastName?.trim()) return badRequest("Last name is required");
  if (!email?.trim()) return badRequest("Email is required");
  if (!password) return badRequest("Password is required");

  const pwErr = validatePasswordStrength(password);
  if (pwErr) return badRequest(pwErr);

  const normalizedEmail = email.trim().toLowerCase();

  // Create company first (createdBy/updatedBy filled after user created)
  // Skip validation for first company since createdBy/updatedBy don't exist yet
  const company = new Company({
    companyId: null,
    createdBy: null,
    updatedBy: null,

    profile: {
      legalName: companyName.trim(),
      isVatRegistered: Boolean(isVatRegistered),
      vatNumber: vatNumber?.trim() ?? "",
    },
    status: "Active",
  });

  // For first company, companyId = own _id
  company.companyId = company._id as any;
  await company.save({ validateBeforeSave: false });

  // Enforce unique email per company
  const existing = await User.findOne({ companyId: company._id, email: normalizedEmail });
  if (existing) return badRequest("Email already exists for this company");

  const passHash = await hashPassword(password);

  // Create user (createdBy/updatedBy filled after user created)
  // Skip validation for first user since createdBy/updatedBy don't exist yet
  const user = new User({
    companyId: company._id,
    createdBy: null,
    updatedBy: null,

    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    phone: phone?.trim() ?? "",

    role: "Owner",
    passHash,
    isActive: true,
    permissions: [],
  });
  await user.save({ validateBeforeSave: false });

  // Patch audit fields now that we have a user
  await Company.updateOne(
    { _id: company._id },
    { $set: { createdBy: user._id, updatedBy: user._id } },
  );
  await User.updateOne(
    { _id: user._id },
    { $set: { createdBy: user._id, updatedBy: user._id } },
  );

  await createSession({ userId: user._id, companyId: company._id });

  // Get callback URL or default to dashboard
  const callbackUrl = req.headers.get("x-callback-url") || "/";

  return NextResponse.json(
    {
      ok: true,
      company: { id: String(company._id), name: company.profile.legalName },
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
    { status: 201 },
  );
}