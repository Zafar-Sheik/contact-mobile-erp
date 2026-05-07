"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Save,
  Calculator,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useApi, apiCreate } from "@/lib/hooks/use-api";

// Types
interface Client {
  _id: string;
  name: string;
}

interface OpenInvoice {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  totalCents: number;
  paidCents: number;
  outstandingCents: number;
  daysOverdue: number;
  isOverdue: boolean;
  selected: boolean;
  allocationCents: number;
}

interface PayInvoicesUIData {
  clientId: string;
  clientName: string;
  openInvoices: OpenInvoice[];
  summary: {
    totalOutstanding: number;
    selectedInvoices: number;
    selectedAmount: number;
    paymentAmount: number;
  };
}

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
};

// Format date
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-ZA");
};

export default function NewCustomerPaymentPage() {
  const router = useRouter();
  const { toast } = useToast();

  // API data
  const { data: clients } = useApi<Client[]>("/api/clients");

  // Form state
  const [selectedClientId, setSelectedClientId] = React.useState("");
  const [uiData, setUiData] = React.useState<PayInvoicesUIData | null>(null);
  const [paymentForm, setPaymentForm] = React.useState({
    amountCents: 0,
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "bank_transfer" as "cash" | "bank_transfer" | "card" | "other",
    reference: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Load UI data when client changes
  React.useEffect(() => {
    if (selectedClientId) {
      fetch(`/api/customer-payments/ui-data?clientId=${selectedClientId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.data) {
            setUiData(data.data);
          }
        })
        .catch((error) => {
          console.error("Error loading UI data:", error);
        });
    } else {
      setUiData(null);
    }
  }, [selectedClientId]);

  // Update allocations when payment amount changes
  React.useEffect(() => {
    if (uiData && paymentForm.amountCents > 0) {
      const remainingAmount = paymentForm.amountCents;
      let remaining = remainingAmount;

      const updatedInvoices = uiData.openInvoices.map((invoice) => {
        if (remaining <= 0) {
          return { ...invoice, selected: false, allocationCents: 0 };
        }

        const allocate = Math.min(remaining, invoice.outstandingCents);
        remaining -= allocate;

        return {
          ...invoice,
          selected: allocate > 0,
          allocationCents: allocate,
        };
      });

      setUiData({
        ...uiData,
        openInvoices: updatedInvoices,
      });
    }
  }, [paymentForm.amountCents, uiData?.openInvoices]);

  // Calculate summary
  const summary = React.useMemo(() => {
    if (!uiData) return { selectedInvoices: 0, selectedAmount: 0 };

    const selectedInvoices = uiData.openInvoices.filter((inv) => inv.selected).length;
    const selectedAmount = uiData.openInvoices.reduce(
      (sum, inv) => sum + inv.allocationCents,
      0
    );

    return { selectedInvoices, selectedAmount };
  }, [uiData]);

  const handleInvoiceSelection = (invoiceId: string, selected: boolean) => {
    if (!uiData) return;

    const updatedInvoices = uiData.openInvoices.map((invoice) => {
      if (invoice.invoiceId === invoiceId) {
        return {
          ...invoice,
          selected,
          allocationCents: selected ? invoice.outstandingCents : 0,
        };
      }
      return invoice;
    });

    setUiData({
      ...uiData,
      openInvoices: updatedInvoices,
    });
  };

  const handleSubmit = async () => {
    if (!selectedClientId) {
      toast({ title: "Error", description: "Please select a client", variant: "destructive" });
      return;
    }

    if (paymentForm.amountCents <= 0) {
      toast({ title: "Error", description: "Please enter a valid payment amount", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const allocations = uiData?.openInvoices
        .filter((inv) => inv.selected && inv.allocationCents > 0)
        .map((inv) => ({
          invoiceId: inv.invoiceId,
          amountCents: inv.allocationCents,
        })) || [];

      const paymentData = {
        clientId: selectedClientId,
        amountCents: paymentForm.amountCents,
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
        allocations,
      };

      const response = await apiCreate("/api/customer-payments", paymentData);

      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });

      router.push("/customer-payments");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-10 w-10">
              <Link href="/customer-payments">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold">New Payment</h1>
              {uiData && (
                <p className="text-sm text-gray-600">
                  {uiData.clientName} • {formatCurrency(uiData.summary.totalOutstanding)} owing
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Client Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Select Client *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client._id} value={client._id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Payment Details */}
        {selectedClientId && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Payment Date</Label>
                  <Input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) =>
                      setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))
                    }
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Payment Method</Label>
                  <Select
                    value={paymentForm.paymentMethod}
                    onValueChange={(value: any) =>
                      setPaymentForm((prev) => ({ ...prev, paymentMethod: value }))
                    }
                  >
                    <SelectTrigger className="h-11">
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
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Amount (ZAR)</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentForm.amountCents / 100 || ""}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({
                      ...prev,
                      amountCents: Math.round(Number(e.target.value) * 100),
                    }))
                  }
                  placeholder="0.00"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Reference</Label>
                <Input
                  value={paymentForm.reference}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))
                  }
                  placeholder="Bank reference, receipt number, etc."
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Notes</Label>
                <Input
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Additional notes..."
                  className="h-11"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invoice Allocation */}
        {uiData && uiData.openInvoices.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Invoice Allocation</CardTitle>
              <p className="text-sm text-gray-600">
                Select invoices to allocate this payment to
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Summary */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Payment Amount:</span>
                    <div className="font-semibold">{formatCurrency(paymentForm.amountCents)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Allocated:</span>
                    <div className="font-semibold text-green-600">{formatCurrency(summary.selectedAmount)}</div>
                  </div>
                </div>
                {paymentForm.amountCents > summary.selectedAmount && (
                  <div className="mt-2 text-sm text-orange-600">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    Unallocated: {formatCurrency(paymentForm.amountCents - summary.selectedAmount)}
                  </div>
                )}
              </div>

              {/* Invoices List */}
              <div className="space-y-3">
                {uiData.openInvoices.map((invoice) => (
                  <div
                    key={invoice.invoiceId}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={invoice.selected}
                          onCheckedChange={(checked) =>
                            handleInvoiceSelection(invoice.invoiceId, checked as boolean)
                          }
                        />
                        <div>
                          <div className="font-medium">{invoice.invoiceNumber}</div>
                          <div className="text-sm text-gray-600">
                            {formatDate(invoice.issueDate)}
                            {invoice.dueDate && ` • Due: ${formatDate(invoice.dueDate)}`}
                          </div>
                        </div>
                      </div>
                      {invoice.isOverdue && (
                        <Badge variant="destructive" className="text-xs">
                          {invoice.daysOverdue} days overdue
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Total:</span>
                        <div className="font-medium">{formatCurrency(invoice.totalCents)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Paid:</span>
                        <div className="font-medium">{formatCurrency(invoice.paidCents)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Outstanding:</span>
                        <div className="font-medium text-red-600">{formatCurrency(invoice.outstandingCents)}</div>
                      </div>
                    </div>

                    {invoice.selected && (
                      <div className="bg-green-50 rounded p-2 text-sm">
                        <CheckCircle className="h-4 w-4 inline mr-1 text-green-600" />
                        Allocating: {formatCurrency(invoice.allocationCents)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Open Invoices Message */}
        {uiData && uiData.openInvoices.length === 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="text-center py-8 text-gray-500">
                <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No outstanding invoices for this client</p>
                <p className="text-sm">The payment will be recorded as unallocated</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Bottom Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe z-20">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedClientId || paymentForm.amountCents <= 0}
          className="w-full h-12 bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? "Recording Payment..." : "Record Payment"}
        </Button>
      </div>
    </div>
  );
}