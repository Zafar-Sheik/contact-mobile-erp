import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { GRV } from "@/lib/models/GRV";
import { SupplierBill } from "@/lib/models/SupplierBill";
import { getSessionClaims } from "@/lib/auth/session";

// GET /api/supplier-bills/unbilled-grvs - Get unbilled GRVs for a supplier
// Query params: supplierId (required)
export async function GET(req: Request) {
  try {
    await dbConnect();
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");

    if (!supplierId) {
      return NextResponse.json({ error: "Supplier ID is required" }, { status: 400 });
    }

    // Find all Posted GRVs for this supplier
    const grvs = await GRV.find({
      companyId: session.companyId,
      supplierId: supplierId,
      status: "Posted",
      isDeleted: false,
    })
      .select("grvNumber receivedAt referenceNumber lines grandTotalCents poId")
      .populate("poId", "poNumber")
      .sort({ receivedAt: -1 })
      .lean();

    // Filter out GRVs that are already linked to a non-voided bill
    const unbilledGrvs = [];

    for (const grv of grvs) {
      // Check if this GRV is already linked to a bill
      const existingBill = await SupplierBill.findOne({
        grvIds: grv._id,
        status: { $nin: ["Voided"] },
        isDeleted: false,
      });

      if (!existingBill) {
        unbilledGrvs.push({
          _id: grv._id,
          grvNumber: grv.grvNumber,
          receivedAt: grv.receivedAt,
          referenceNumber: grv.referenceNumber,
          grandTotalCents: grv.grandTotalCents,
          poId: grv.poId?._id || grv.poId,
          poNumber: grv.poId?.poNumber || null,
          lineCount: grv.lines?.length || 0,
        });
      }
    }

    return NextResponse.json({ data: unbilledGrvs });
  } catch (error: any) {
    console.error("Error fetching unbilled GRVs:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch unbilled GRVs" }, { status: 500 });
  }
}
