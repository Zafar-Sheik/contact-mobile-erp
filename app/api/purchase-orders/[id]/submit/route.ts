import { NextResponse } from "next/server";
import { getSessionClaims } from "@/lib/auth/session";
import { submitPO } from "@/lib/services/po-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const result = await submitPO(id, session.userId, session.role || "staff");

    if (result.error) {
      const status = result.error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ data: result.data });
  } catch (error: any) {
    console.error("Error submitting PO:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
