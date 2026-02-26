import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SalesQuote } from "@/lib/models/SalesQuote";
import { getSessionClaims } from "@/lib/auth/session";

// POST /api/quotes/[id]/send - Change quote status from 'draft' to 'sent'
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

    if (quote.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft quotes can be sent" },
        { status: 400 }
      );
    }

    // Update status to sent and set sentAt timestamp
    quote.status = "sent";
    quote.sentAt = new Date();
    quote.updatedBy = session.userId;
    await quote.save();

    await quote.populate("clientId", "name email phone");

    return NextResponse.json({
      message: "Quote sent successfully",
      data: quote,
    });
  } catch (error: any) {
    console.error("Error sending quote:", error);
    return NextResponse.json({ error: error.message || "Failed to send quote" }, { status: 500 });
  }
}
