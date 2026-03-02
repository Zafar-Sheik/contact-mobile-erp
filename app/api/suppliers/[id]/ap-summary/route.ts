import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/db";

async function getDB() {
  await dbConnect();
  return mongoose.connection.db;
}

interface APSummary {
  outstanding: number;
  overdue: number;
  credits: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: supplierId } = await params;
    const db = await getDB();
    
    if (!db) {
      throw new Error("Database not available");
    }

    const billCollection = db.collection("supplierbills");
    const paymentCollection = db.collection("supplierpayments");

    // Get supplier's bills and payments
    const bills = await billCollection
      .find({ supplierId })
      .toArray();

    const payments = await paymentCollection
      .find({ supplierId })
      .toArray();

    // Calculate outstanding (Approved bills - payments made)
    const now = new Date();
    let outstanding = 0;
    let overdue = 0;
    let credits = 0;

    bills.forEach((bill) => {
      if (bill.status === "Approved" || bill.status === "Posted") {
        const total = bill.total || 0;
        const paid = bill.paidAmount || 0;
        const balance = total - paid;
        
        outstanding += balance;

        // Check if overdue
        if (bill.dueDate && new Date(bill.dueDate) < now) {
          overdue += balance;
        }
      }
    });

    // Calculate credits (payments that created credit balances)
    payments.forEach((payment) => {
      if (payment.status === "Posted" && payment.isCredit) {
        credits += payment.amount || 0;
      }
    });

    const summary: APSummary = {
      outstanding,
      overdue,
      credits,
    };

    return NextResponse.json({ data: summary });
  } catch (error) {
    console.error("Error fetching AP summary:", error);
    
    return NextResponse.json({
      data: {
        outstanding: 0,
        overdue: 0,
        credits: 0,
      },
    });
  }
}
