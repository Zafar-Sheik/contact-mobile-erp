import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { User } from "@/lib/models/User";
import { getSession } from "@/lib/auth/session";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";

export const runtime = "nodejs";

/**
 * Allows authenticated users to change their password
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await dbConnect();

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    // Validate new password strength
    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    // Get user with password hash
    const user = await User.findById(session.userId).select("+passHash");
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passHash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Hash new password
    const newPassHash = await hashPassword(newPassword);

    // Update password
    await User.updateOne(
      { _id: user._id },
      { $set: { passHash: newPassHash, updatedAt: new Date() } }
    );

    console.log(`[Password] Changed for user: ${user._id}`);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Password Change] Error:', error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}