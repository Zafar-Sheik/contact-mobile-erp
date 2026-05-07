"use client";

import * as React from "react";
import {
  Search,
  CreditCard,
  Plus,
  MoreHorizontal,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/lib/hooks/use-api";
import { MobileMoreMenu, useMobileMoreMenu } from "@/components/mobile/mobile-more-menu";
import { useToast } from "@/components/ui/use-toast";

// Types
interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  clientCode: string;
  balanceCents?: number;
  unallocatedCents?: number;
  calculatedOutstandingBalance?: number;
}

interface CustomerPayment {
  _id: string;
  paymentNumber: string;
  clientId: Client;
  clientSnapshot: {
    name: string;
    email?: string;
  };
  amountCents: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
  allocatedInvoices: Array<{
    invoiceId: string;
    amountCents: number;
    allocatedAt: string;
  }>;
  unallocatedCents: number;
  status: "posted" | "reversed";
  notes?: string;
  createdAt: string;
}

interface PaymentReconciliation {
  payment: CustomerPayment;
  allocations: Array<{
    invoiceId: string;
    invoiceNumber: string;
    allocatedAmount: number;
    remainingBalance: number;
  }>;
  totalAllocated: number;
  unallocatedAmount: number;
}

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
};

// Format date
const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Payment method labels
const getPaymentMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    cash: "Cash",
    bank_transfer: "Bank Transfer",
    card: "Card",
    other: "Other",
  };
  return labels[method] || method;
};

export default function CustomerPaymentsPage() {
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API hooks
  const { data: payments, loading, error, refetch } = useApi<CustomerPayment[]>("/api/bills");
  const { data: clients } = useApi<Client[]>("/api/clients");

  // State
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showPaymentDialog, setShowPaymentDialog] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [reconciliationResult, setReconciliationResult] = React.useState<PaymentReconciliation | null>(null);

  // Payment form state
  const [paymentForm, setPaymentForm] = React.useState({
    clientId: "",
    amountCents: 0,
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "bank_transfer",
    reference: "",
    notes: "",
  });

  // Filter payments
  const filteredPayments = React.useMemo(() => {
    if (!payments) return [];
    return payments.filter((payment) => {
      const clientName = payment.clientSnapshot?.name || "";
      const paymentNumber = payment.paymentNumber || "";
      const matchesSearch =
        !searchTerm ||
        paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [payments, searchTerm]);

  // Stats
  const stats = React.useMemo(() => {
    if (!payments) return { total: 0, amount: 0 };
    return {
      total: payments.length,
      amount: payments.reduce((sum, p) => sum + p.amountCents, 0),
    };
  }, [payments]);

  // Handle payment submission
  const handleRecordPayment = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm),
      });
      const data = await res.json();

      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Payment recorded and reconciled successfully" });
        setShowPaymentDialog(false);
        setReconciliationResult(data.reconciliation);
        setPaymentForm({
          clientId: "",
          amountCents: 0,
          paymentDate: new Date().toISOString().split("T")[0],
          paymentMethod: "bank_transfer",
          reference: "",
          notes: "",
        });
        refetch();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Debtor Payments</h1>
          <Button size="icon" variant="ghost" onClick={openMore} className="h-10 w-10">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search payments..."
            className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && !error && payments && payments.length > 0 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600">Total Payments</p>
              <p className="text-lg font-bold text-blue-700">{stats.total}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-green-600">Total Amount</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(stats.amount)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="p-4 pb-24">
        {/* Loading State */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-red-600 font-medium">Error loading payments</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredPayments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <CreditCard className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No payments found" : "No debtor payments yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? "Try a different search term" : "Record your first customer payment to get started"}
            </p>
          </div>
        )}

        {/* Payments List */}
        {!loading && !error && filteredPayments.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredPayments.map((payment) => (
              <Card key={payment._id} className="shadow-sm border border-gray-100">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-full">
                        <CreditCard className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{payment.paymentNumber}</h3>
                        <p className="text-sm text-gray-500">{payment.clientSnapshot?.name}</p>
                      </div>
                    </div>
                    <Badge className={`${
                      payment.status === "posted" 
                        ? "bg-green-100 text-green-700" 
                        : "bg-gray-100 text-gray-700"
                    }`}>
                      {payment.status === "posted" ? "Posted" : "Reversed"}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Amount:</span>
                      <span className="font-medium">{formatCurrency(payment.amountCents)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Date:</span>
                      <span>{formatDate(payment.paymentDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Method:</span>
                      <span>{getPaymentMethodLabel(payment.paymentMethod)}</span>
                    </div>
                    {typeof payment.clientId === "object" && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">
                          {(payment.clientId as any).calculatedOutstandingBalance > 0
                            ? "Client Owes:"
                            : (payment.clientId as any).calculatedOutstandingBalance < 0
                            ? "Client Credit:"
                            : "Balance:"}
                        </span>
                        <span className={`font-medium ${
                          (payment.clientId.calculatedOutstandingBalance || 0) > 0
                            ? "text-red-600"
                            : (payment.clientId.calculatedOutstandingBalance || 0) < 0
                            ? "text-green-600"
                            : "text-gray-600"
                        }`}>
                          {formatCurrency(Math.abs((payment.clientId as any).calculatedOutstandingBalance || 0))}
                        </span>
                      </div>
                    )}
                    {typeof payment.clientId === "object" && (payment.clientId.unallocatedCents || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Unallocated Funds:</span>
                        <span className="font-medium text-blue-600">
                          {formatCurrency(payment.clientId.unallocatedCents || 0)}
                        </span>
                      </div>
                    )}
                    {payment.unallocatedCents > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>Unallocated:</span>
                        <span className="font-medium">{formatCurrency(payment.unallocatedCents)}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Floating Add Button */}
      <div className="fixed bottom-20 right-4 z-20">
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
          onClick={() => setShowPaymentDialog(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Bottom More Menu Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 pb-safe z-20">
        <button
          onClick={openMore}
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-xl transition-colors"
        >
          <MoreHorizontal className="w-6 h-6 text-gray-700" />
          <span className="text-base font-medium text-gray-700">More</span>
        </button>
      </div>

      {/* Mobile More Menu */}
      <MobileMoreMenu open={isMoreOpen} onClose={closeMore} />

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Debtor Payment</DialogTitle>
            <DialogDescription>
              Record a payment from a debtor. The system will automatically reconcile it against outstanding invoices using FIFO (First-In, First-Out) logic.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Client</Label>
              <Select
                value={paymentForm.clientId}
                onValueChange={(value) =>
                  setPaymentForm((prev) => ({ ...prev, clientId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  {clients?.map((client) => (
                    <SelectItem key={client._id} value={client._id}>
                      {client.name} ({client.clientCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount (R)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amountCents / 100}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    amountCents: Math.round((parseFloat(e.target.value) || 0) * 100),
                  }))
                }
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) =>
                  setPaymentForm((prev) => ({
                    ...prev,
                    paymentDate: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={paymentForm.paymentMethod}
                onValueChange={(value) =>
                  setPaymentForm((prev) => ({ ...prev, paymentMethod: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reference (Optional)</Label>
              <Input
                value={paymentForm.reference}
                onChange={(e) =>
                  setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))
                }
                placeholder="Payment reference"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Additional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={isSubmitting}>
              {isSubmitting ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reconciliation Result Dialog */}
      {reconciliationResult && (
        <Dialog open={!!reconciliationResult} onOpenChange={() => setReconciliationResult(null)}>
          <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Debtor Payment Reconciled
            </DialogTitle>
            <DialogDescription>
              Debtor payment {reconciliationResult.payment.paymentNumber} has been successfully recorded and reconciled.
            </DialogDescription>
          </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Payment Details</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Payment Number:</span>
                    <span className="font-medium">{reconciliationResult.payment.paymentNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Amount:</span>
                    <span className="font-medium">{formatCurrency(reconciliationResult.payment.amountCents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Client:</span>
                    <span className="font-medium">{reconciliationResult.payment.clientSnapshot.name}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Reconciliation Summary</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {reconciliationResult.allocations.map((allocation, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>Invoice {allocation.invoiceNumber}:</span>
                      <span className="font-medium">{formatCurrency(allocation.allocatedAmount)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Total Allocated:</span>
                    <span>{formatCurrency(reconciliationResult.totalAllocated)}</span>
                  </div>
                  {reconciliationResult.unallocatedAmount > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Unallocated:</span>
                      <span className="font-medium">{formatCurrency(reconciliationResult.unallocatedAmount)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setReconciliationResult(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}