import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Company } from "@/lib/models/Company";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  try {
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const company = await Company.findOne({ _id: session.companyId, isDeleted: false })
      .select("-isDeleted -deletedAt")
      .lean();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ data: company });
  } catch (error: any) {
    console.error("Error fetching company:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch company" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const company = await Company.findOneAndUpdate(
      { _id: session.companyId, isDeleted: false },
      {
        $set: {
          profile: body.profile,
          bankRef: body.bankRef,
          updatedBy: session.userId,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    ).lean();

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ data: company });
  } catch (error: any) {
    console.error("Error updating company:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update company" },
      { status: 500 }
    );
  }
}
