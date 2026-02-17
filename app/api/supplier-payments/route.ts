import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SupplierPayment } from "@/lib/models/SupplierPayment";
import { getSessionClaims } from "@/lib/auth/session";
import { generateDocumentNumber } from "@/lib/utils/numbering";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payments = await SupplierPayment.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .populate("supplierId", "name email phone")
    .sort({ paymentDate: -1 })
    .lean();

  return NextResponse.json({ data: payments });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Generate payment number
  const paymentNumber = await generateDocumentNumber(session.companyId, "payment", session.userId);

  const payment = await SupplierPayment.create({
    ...body,
    paymentNumber,
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
    unallocatedCents: body.amountCents || 0,
    status: "Posted",
  });

  return NextResponse.json({ data: payment }, { status: 201 });
}
