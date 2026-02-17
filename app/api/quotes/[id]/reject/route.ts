import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SalesQuote } from "@/lib/models/SalesQuote";
import { getSessionClaims } from "@/lib/auth/session";

// POST /api/quotes/[id]/reject - Change quote status from 'sent' to 'rejected'
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quote = await SalesQuote.findOne({
      _id: id,
      companyId: session.companyId,
      isDeleted: false,
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (quote.status !== "sent") {
      return NextResponse.json(
        { error: "Only sent quotes can be rejected" },
        { status: 400 }
      );
    }

    // Update status to rejected and set rejectedAt timestamp
    quote.status = "rejected";
    quote.rejectedAt = new Date();
    quote.updatedBy = session.userId;
    await quote.save();

    return NextResponse.json({
      message: "Quote rejected successfully",
      data: {
        quoteNumber: quote.quoteNumber,
        status: quote.status,
        rejectedAt: quote.rejectedAt,
      },
    });
  } catch (error: any) {
    console.error("Error rejecting quote:", error);
    return NextResponse.json({ error: error.message || "Failed to reject quote" }, { status: 500 });
  }
}
