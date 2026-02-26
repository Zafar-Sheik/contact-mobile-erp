import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { SupplierPayment } from "@/lib/models/SupplierPayment";
import { getSessionClaims } from "@/lib/auth/session";
import { generateDocumentNumber } from "@/lib/utils/numbering";
import { validatePaymentToBills, getSupplierForDocument } from "@/lib/utils/p2p-validation";
import { SupplierBill } from "@/lib/models/SupplierBill";

export async function GET() {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payments = await SupplierPayment.find({ companyId: session.companyId, isDeleted: false })
    .select("-isDeleted -deletedAt")
    .populate("supplierId", "name email phone")
    .populate("allocations.supplierBillId", "billNumber totalCents paidCents")
    .sort({ paymentDate: -1 })
    .lean();

  // Transform to include bill numbers
  const transformedPayments = payments.map((payment: any) => ({
    ...payment,
    allocations: payment.allocations?.map((alloc: any) => ({
      ...alloc,
      billNumber: alloc.supplierBillId?.billNumber || null,
    })) || [],
  }));

  return NextResponse.json({ data: transformedPayments });
}

export async function POST(req: Request) {
  await dbConnect();
  const session = await getSessionClaims();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  // Validate required fields
  if (!body.supplierId) {
    return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
  }

  if (!body.paymentDate) {
    return NextResponse.json({ error: "Payment date is required" }, { status: 400 });
  }

  if (!body.method) {
    return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
  }

  if (!body.amountCents || body.amountCents <= 0) {
    return NextResponse.json({ error: "Valid payment amount is required" }, { status: 400 });
  }

  // Validate supplier exists
  const supplier = await getSupplierForDocument(body.supplierId);
  if (!supplier) {
    return NextResponse.json({ error: "Supplier not found" }, { status: 400 });
  }

  // CRITICAL: Validate bill allocations - prevent cross-supplier linking
  if (body.allocations && body.allocations.length > 0) {
    const paymentAmountCents = body.amountCents;
    
    const allocationValidation = await validatePaymentToBills(
      body.supplierId,
      paymentAmountCents,
      body.allocations
    );
    
    if (!allocationValidation.valid) {
      return NextResponse.json({ 
        error: allocationValidation.errors.join("; ") 
      }, { status: 400 });
    }
    
    if (allocationValidation.warnings.length > 0) {
      console.warn("Payment allocation warnings:", allocationValidation.warnings);
    }
  }

  // Generate payment number using new system
  const paymentNumber = await generateDocumentNumber(session.companyId, "supplier_payment", session.userId);

  // Process allocations
  let unallocatedCents = body.amountCents;
  const processedAllocations = body.allocations?.map((alloc: any) => {
    unallocatedCents -= alloc.amountCents;
    return {
      supplierBillId: alloc.billId,
      amountCents: alloc.amountCents,
    };
  }) || [];

  // Update bill paid amounts if there are allocations
  if (processedAllocations.length > 0) {
    for (const alloc of processedAllocations) {
      const bill = await SupplierBill.findById(alloc.supplierBillId);
      if (bill) {
        const newPaidCents = (bill.paidCents || 0) + alloc.amountCents;
        const newStatus = newPaidCents >= bill.totalCents ? "Paid" : "PartiallyPaid";
        
        await SupplierBill.updateOne(
          { _id: alloc.supplierBillId },
          { 
            $set: { 
              paidCents: newPaidCents,
              status: newStatus,
            } 
          }
        );
      }
    }
  }

  const payment = await SupplierPayment.create({
    ...body,
    paymentNumber,
    companyId: session.companyId,
    createdBy: session.userId,
    updatedBy: session.userId,
    allocations: processedAllocations,
    unallocatedCents: Math.max(0, unallocatedCents),
    status: "Posted",
  });

  return NextResponse.json({ data: payment }, { status: 201 });
}
