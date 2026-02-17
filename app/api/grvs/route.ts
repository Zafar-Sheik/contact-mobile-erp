import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { GRV } from "@/lib/models/GRV";
import { Counter } from "@/lib/models/Counter";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const grvs = await GRV.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .populate("supplierId", "name email phone")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json({ data: grvs });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Generate GRV number
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const counter = await Counter.findOneAndUpdate(
    { companyId: session.companyId, key: "GRV" },
    { $inc: { nextNumber: 1 } },
    { upsert: true, new: true }
  );
  const sequence = String(counter.nextNumber).padStart(6, "0");
  const grvNumber = `GRV-${year}${month}-${sequence}`;

  // Process lines and calculate totals
  let subtotalCents = 0;
  let vatTotalCents = 0;
  let discountTotalCents = 0;

  const processedLines = body.lines?.map((line: any, index: number) => {
    const receivedQty = line.receivedQty || 0;
    const unitCostCents = line.unitCostCents || 0;
    
    // Calculate discount
    let discountCents = 0;
    if (line.discountType === "percent" && line.discountValue) {
      discountCents = Math.round((unitCostCents * receivedQty * line.discountValue) / 100);
    } else if (line.discountType === "amount") {
      discountCents = line.discountValue * receivedQty;
    }

    const lineSubtotal = (unitCostCents * receivedQty) - discountCents;
    const vatRate = line.itemSnapshot?.vatRate || 15;
    const vatAmount = Math.round(lineSubtotal * (vatRate / 100));
    const lineTotal = lineSubtotal + vatAmount;

    subtotalCents += lineSubtotal;
    vatTotalCents += vatAmount;
    discountTotalCents += discountCents;

    return {
      lineNo: index + 1,
      ...line,
      subtotalCents: lineSubtotal,
      vatAmountCents: vatAmount,
      totalCents: lineTotal,
    };
  }) || [];

  const grandTotalCents = subtotalCents + vatTotalCents - discountTotalCents;

  const grvData = {
    ...body,
    lines: processedLines,
    grvNumber,
    subtotalCents,
    vatTotalCents,
    discountTotalCents,
    grandTotalCents,
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
  };

  const grv = await GRV.create(grvData);

  return NextResponse.json({ data: grv }, { status: 201 });
}
