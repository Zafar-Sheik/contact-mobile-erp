import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";

async function getDB() {
  await dbConnect();
  return mongoose.connection.db;
}

// P2P Summary interface
interface P2PSummary {
  openPOs: number;
  pendingReceipts: number;
  billsNeedingApproval: number;
  unpaidBills: number;
}

export async function GET() {
  try {
    const db = await getDB();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get collections
    const poCollection = db.collection("purchaseorders");
    const grvCollection = db.collection("grvs");
    const billCollection = db.collection("supplierbills");

    // Get counts for each category
    const [
      openPOsCount,
      pendingReceiptsCount,
      billsNeedingApprovalCount,
      unpaidBillsCount,
    ] = await Promise.all([
      // Open POs (SENT status - PO has been sent to supplier)
      poCollection.countDocuments({ status: "SENT" }),
      
      // Pending Receipts (GRVs with Draft status - not yet posted)
      grvCollection.countDocuments({ status: "DRAFT" }),
      
      // Bills needing approval (Draft status)
      billCollection.countDocuments({ status: "DRAFT" }),
      
      // Unpaid Bills (Approved status - awaiting payment)
      billCollection.countDocuments({ status: "APPROVED" }),
    ]);

    const summary: P2PSummary = {
      openPOs: openPOsCount,
      pendingReceipts: pendingReceiptsCount,
      billsNeedingApproval: billsNeedingApprovalCount,
      unpaidBills: unpaidBillsCount,
    };

    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error("Error fetching P2P summary:", error);
    
    // Return default values on error
    return NextResponse.json({
      data: {
        openPOs: 0,
        pendingReceipts: 0,
        billsNeedingApproval: 0,
        unpaidBills: 0,
      },
    });
  }
}
