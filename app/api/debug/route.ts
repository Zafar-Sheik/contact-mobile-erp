import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { getSessionClaims } from "@/lib/auth/session";
import { User } from "@/lib/models/User";
import { verifyPassword } from "@/lib/auth/password";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const session = await getSessionClaims();

    const url = new URL(req.url);
    const listUsers = url.searchParams.get('listUsers') === 'true';
    const userId = url.searchParams.get('userId');

    if (userId) {
      // Show specific user details (for debugging)
      const user = await User.findOne({ _id: userId, isDeleted: false })
        .select('email firstName lastName role isActive companyId createdAt');

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      return NextResponse.json({
        user: {
          id: user._id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          isActive: user.isActive,
          companyId: user.companyId,
          createdAt: user.createdAt,
        },
      });
    }

    if (listUsers) {
      if (!session) {
        return NextResponse.json({ error: "Authentication required to list users" }, { status: 401 });
      }

      const users = await User.find({ isDeleted: false })
        .select('email firstName lastName role isActive companyId createdAt')
        .sort({ createdAt: -1 })
        .limit(50);

      return NextResponse.json({
        connected: true,
        hasSession: !!session,
        session: session ? {
          companyId: session.companyId,
          userId: session.userId,
        } : null,
        users: users.map(u => ({
          id: u._id,
          email: u.email,
          name: `${u.firstName} ${u.lastName}`,
          role: u.role,
          isActive: u.isActive,
          companyId: u.companyId,
          createdAt: u.createdAt,
        })),
      });
    }

    return NextResponse.json({
      connected: true,
      hasSession: !!session,
      session: session ? {
        companyId: session.companyId,
        userId: session.userId,
      } : null,
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const { action } = body as { action?: string };

    if (action === 'testSignup') {
      return NextResponse.json({
        message: "Signup validation test",
        requiredFields: [
          "companyName (string, non-empty)",
          "firstName (string, non-empty)",
          "lastName (string, non-empty)",
          "email (string, valid email format)",
          "password (string, meets strength requirements)"
        ],
        optionalFields: [
          "isVatRegistered (boolean, default false)",
          "vatNumber (string)",
          "phone (string)"
        ],
        passwordRequirements: [
          "At least 8 characters",
          "At least one uppercase letter",
          "At least one lowercase letter",
          "At least one number"
        ],
        exampleRequest: {
          companyName: "My Company",
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@company.com",
          password: "SecurePass123"
        }
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
