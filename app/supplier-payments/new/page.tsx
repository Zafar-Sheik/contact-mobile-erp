"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  DollarSign,
  FileText,
  CheckCircle,
  AlertCircle,
  Calculator,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// Types
interface Supplier {
  _id: string;
  name: string;
}

interface Bill {
  _id: string;
  billNumber: string;
  billDate: string;
  dueDate?: string;
  totalCents: number;
  paidCents: number;
  status: string;
}

interface Allocation {
  billId: string;
  billNumber: string;
  outstandingCents: number;
  allocatedCents: number;
}

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
};

export default function NewSupplierPaymentPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <NewSupplierPaymentPageContent />
    </Suspense>
  );
}

function NewSupplierPaymentPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  // URL params
  const supplierIdParam = searchParams.get("supplierId") || "";

  // State
  const [supplierId, setSupplierId] = React.useState(supplierIdParam);
  const [paymentDate, setPaymentDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = React.useState("EFT");
  const [reference, setReference] = React.useState("");
  const [amountCents, setAmountCents] = React.useState(0);
  const [notes, setNotes] = React.useState("");
  const [allocations, setAllocations] = React.useState<Allocation[]>([]);
  const [selectedBillIds, setSelectedBillIds] = React.useState<Set<string>>(new Set());

  // Data
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  // Load suppliers
  React.useEffect(() => {
    const fetchSuppliers = async () => {
      const res = await fetch("/api/suppliers");
      const data = await res.json();
      setSuppliers(data.data || []);
    };
    fetchSuppliers();
  }, []);

  // Fetch unpaid bills when supplier changes
  React.useEffect(() => {
    if (!supplierId) {
      setBills([]);
      setAllocations([]);
      return;
    }

    const fetchBills = async () => {
      // Get bills with status Posted or PartiallyPaid (not fully paid)
      const res = await fetch(`/api/supplier-bills?supplierId=${supplierId}`);
      const data = await res.json();
      
      // Filter to only unpaid bills
      const unpaidBills = (data.data || []).filter((bill: Bill) => {
        const outstanding = bill.totalCents - bill.paidCents;
        return outstanding > 0 && (bill.status === "Posted" || bill.status === "PartiallyPaid");
      });
      
      setBills(unpaidBills);
      
      // Initialize allocations
      setAllocations(
        unpaidBills.map((bill: Bill) => ({
          billId: bill._id,
          billNumber: bill.billNumber,
          outstandingCents: bill.totalCents - bill.paidCents,
          allocatedCents: 0,
        }))
      );
    };
    fetchBills();
  }, [supplierId]);

  // Calculate totals
  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedCents, 0);
  const remainingUnallocated = (amountCents * 100) - totalAllocated;

  // Handle bill selection
  const toggleBillSelection = (billId: string) => {
    const newSelected = new Set(selectedBillIds);
    if (newSelected.has(billId)) {
      newSelected.delete(billId);
    } else {
      newSelected.add(billId);
    }
    setSelectedBillIds(newSelected);
  };

  // Handle allocation change
  const handleAllocationChange = (billId: string, value: string) => {
    const allocCents = Math.round((parseFloat(value) || 0) * 100);
    setAllocations(
      allocations.map((a) =>
        a.billId === billId
          ? { ...a, allocatedCents: Math.min(allocCents, a.outstandingCents) }
          : a
      )
    );
  };

  // Auto-allocate using FIFO (oldest first)
  const handleAutoAllocate = () => {
    const amountRemaining = amountCents * 100;
    let remaining = amountRemaining;

    // Sort bills by due date (oldest first), then by bill date
    const sortedBills = [...bills].sort((a, b) => {
      const aDate = a.dueDate || a.billDate;
      const bDate = b.dueDate || b.billDate;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    const newAllocations = allocations.map((alloc) => {
      const bill = sortedBills.find((b) => b._id === alloc.billId);
      if (!bill || remaining <= 0) {
        return { ...alloc, allocatedCents: 0 };
      }

      const billOutstanding = alloc.outstandingCents;
      const allocateAmount = Math.min(remaining, billOutstanding);
      remaining -= allocateAmount;

      return { ...alloc, allocatedCents: allocateAmount };
    });

    setAllocations(newAllocations);
  };

  // Validate allocations
  const validateAllocations = (): string | null => {
    if (totalAllocated > amountCents * 100) {
      return `Allocated amount (${formatCurrency(totalAllocated)}) exceeds payment amount (${formatCurrency(amountCents * 100)})`;
    }

    const overAllocated = allocations.filter((a) => a.allocatedCents > a.outstandingCents);
    if (overAllocated.length > 0) {
      const billsList = overAllocated.map((a) => a.billNumber).join(", ");
      return `Cannot allocate more than outstanding to: ${billsList}`;
    }

    return null;
  };

  // Submit payment
  const handleSubmit = async () => {
    const validationMsg = validateAllocations();
    if (validationMsg) {
      setValidationError(validationMsg);
      toast({
        title: "Validation Failed",
        description: validationMsg,
        variant: "destructive",
      });
      return;
    }

    if (!supplierId) {
      toast({
        title: "Error",
        description: "Please select a supplier",
        variant: "destructive",
      });
      return;
    }

    if (amountCents <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Build allocations array (only non-zero allocations)
      const paymentAllocations = allocations
        .filter((a) => a.allocatedCents > 0)
        .map((a) => ({
          supplierBillId: a.billId,
          amountCents: a.allocatedCents,
        }));

      const response = await fetch("/api/supplier-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          paymentDate,
          method,
          reference,
          amountCents: amountCents * 100,
          notes,
          allocations: paymentAllocations,
          unallocatedCents: Math.max(0, (amountCents * 100) - totalAllocated),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create payment");
      }

      toast({
        title: "Success",
        description: "Payment created successfully",
      });
      router.push("/supplier-payments");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create payment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSupplier = suppliers.find((s) => s._id === supplierId);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Pay Supplier</h1>
            {selectedSupplier && (
              <p className="text-sm text-gray-500">{selectedSupplier.name}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Payment Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Payment Date *</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Method *</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EFT">EFT</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Reference</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Payment reference"
              />
            </div>

            <div>
              <Label>Amount (R) *</Label>
              <Input
                type="number"
                step="0.01"
                value={amountCents || ""}
                onChange={(e) => setAmountCents(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bill Allocations */}
        {supplierId && bills.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Unpaid Bills</CardTitle>
              <Button variant="outline" size="sm" onClick={handleAutoAllocate}>
                <Calculator className="h-4 w-4 mr-2" />
                Auto Allocate
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {bills.map((bill) => {
                const alloc = allocations.find((a) => a.billId === bill._id);
                const outstanding = bill.totalCents - bill.paidCents;
                const isSelected = selectedBillIds.has(bill._id);

                return (
                  <div
                    key={bill._id}
                    className={`p-3 border rounded-lg ${
                      isSelected ? "border-blue-500 bg-blue-50" : "bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleBillSelection(bill._id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{bill.billNumber}</p>
                            <p className="text-xs text-gray-500">
                              Due: {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString("en-ZA") : "N/A"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">{formatCurrency(outstanding)}</p>
                            <p className="text-xs text-gray-500">outstanding</p>
                          </div>
                        </div>
                        
                        {/* Allocation Input */}
                        <div className="mt-2">
                          <Label className="text-xs">Allocate</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8"
                            value={(alloc?.allocatedCents || 0) / 100 || ""}
                            onChange={(e) => handleAllocationChange(bill._id, e.target.value)}
                            placeholder="R0.00"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {bills.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No unpaid bills for this supplier
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Validation Error */}
        {validationError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">{validationError}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardContent className="pt-4">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </CardContent>
        </Card>
      </div>

      {/* Sticky Bottom Summary & Action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="max-w-md mx-auto space-y-3">
          {/* Summary */}
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-gray-500">Payment Amount</p>
              <p className="font-semibold">{formatCurrency(amountCents * 100)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500">Allocated</p>
              <p className="font-semibold">{formatCurrency(totalAllocated)}</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500">Remaining</p>
              <p className={`font-semibold ${remainingUnallocated < 0 ? "text-red-600" : "text-green-600"}`}>
                {formatCurrency(Math.max(0, remainingUnallocated))}
              </p>
            </div>
          </div>

          {/* Action Button */}
          <Button
            className="w-full h-12"
            onClick={handleSubmit}
            disabled={isSubmitting || !supplierId || amountCents <= 0}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            {isSubmitting ? "Processing..." : "Post Payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
