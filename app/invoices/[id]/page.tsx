"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Send,
  Trash2,
  DollarSign,
  XCircle,
  FileText,
  ExternalLink,
  User,
  Calendar,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

// Types
interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  billing?: {
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      provinceState?: string;
      country?: string;
      postalCode?: string;
    };
  };
}

interface InvoiceLine {
  _id: string;
  lineNo: number;
  stockItemId: string;
  skuSnapshot: string;
  nameSnapshot: string;
  qty: number;
  unitPriceCents: number;
  discountCents: number;
  taxable: boolean;
  lineTotalCents: number;
}

interface CustomerPayment {
  _id: string;
  paymentNumber: string;
  clientId: string | Client;
  amountCents: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
  notes?: string;
  status: string;
}

interface Invoice {
  _id: string;
  invoiceNumber: string;
  clientId: string | Client;
  clientSnapshot: {
    name: string;
    email?: string;
    phone?: string;
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      provinceState?: string;
      country?: string;
      postalCode?: string;
    };
  };
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
  lines: InvoiceLine[];
  totals: {
    subTotalCents: number;
    vatTotalCents: number;
    totalCents: number;
  };
  amountPaidCents: number;
  balanceDueCents: number;
  vatMode: "exclusive" | "inclusive" | "none";
  vatRateBps: number;
  issueDate: string;
  dueDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  sourceQuoteId?: {
    _id: string;
    quoteNumber: string;
  };
  isOverdue?: boolean;
  paymentHistory?: CustomerPayment[];
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

// Status colors
const getStatusColors = (status: string) => {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: "bg-gray-100", text: "text-gray-700", label: "Draft" },
    issued: { bg: "bg-blue-100", text: "text-blue-700", label: "Issued" },
    partially_paid: { bg: "bg-purple-100", text: "text-purple-700", label: "Partially Paid" },
    paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
    overdue: { bg: "bg-red-100", text: "text-red-700", label: "Overdue" },
    cancelled: { bg: "bg-gray-100", text: "text-gray-700", label: "Cancelled" },
  };
  return colors[status] || colors.draft;
};

// Payment method label
const getPaymentMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    cash: "Cash",
    bank_transfer: "Bank Transfer",
    credit_card: "Credit Card",
    debit_card: "Debit Card",
    cheque: "Cheque",
    other: "Other",
  };
  return labels[method] || method;
};

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = React.useState(false);
  const [showCancelDialog, setShowCancelDialog] = React.useState(false);

  // Payment form state
  const [paymentForm, setPaymentForm] = React.useState({
    amountCents: 0,
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMethod: "bank_transfer",
    reference: "",
    notes: "",
  });

  // Fetch invoice
  React.useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        const data = await res.json();
        if (data.error) {
          toast({ title: "Error", description: data.error, variant: "destructive" });
          router.push("/invoices");
        } else {
          setInvoice(data.data);
          if (data.data?.balanceDueCents) {
            setPaymentForm((prev) => ({
              ...prev,
              amountCents: data.data.balanceDueCents,
            }));
          }
        }
      } catch (error) {
        toast({ title: "Error", description: "Failed to fetch invoice", variant: "destructive" });
        router.push("/invoices");
      } finally {
        setLoading(false);
      }
    };
    fetchInvoice();
  }, [id, router, toast]);

  // Issue invoice
  const handleIssue = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${id}/issue`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Invoice issued successfully" });
        const refresh = await fetch(`/api/invoices/${id}`);
        const refreshData = await refresh.json();
        setInvoice(refreshData.data);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to issue invoice", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel invoice
  const handleCancel = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Invoice cancelled" });
        const refresh = await fetch(`/api/invoices/${id}`);
        const refreshData = await refresh.json();
        setInvoice(refreshData.data);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to cancel invoice", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowCancelDialog(false);
    }
  };

  // Delete invoice
  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Invoice deleted" });
        router.push("/invoices");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete invoice", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteDialog(false);
    }
  };

  // Record payment
  const handleRecordPayment = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentForm),
      });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Payment recorded successfully" });
        setShowPaymentDialog(false);
        // Refresh invoice
        const refresh = await fetch(`/api/invoices/${id}`);
        const refreshData = await refresh.json();
        setInvoice(refreshData.data);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  const client = typeof invoice.clientId === "object" ? invoice.clientId : null;
  const clientName = client?.name || invoice.clientSnapshot.name;
  const clientEmail = client?.email || invoice.clientSnapshot.email;
  const clientPhone = client?.phone || invoice.clientSnapshot.phone;
  const clientAddress = client?.billing?.address || invoice.clientSnapshot.address;
  const statusColors = getStatusColors(invoice.status);

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/invoices")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
            <p className="text-muted-foreground">
              Created {formatDate(invoice.createdAt)}
            </p>
          </div>
        </div>
        <Badge className={`${statusColors.bg} ${statusColors.text}`}>
          {statusColors.label}
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {invoice.status === "draft" && (
          <>
            <Button onClick={handleIssue} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Issue
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={isSubmitting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
        {(invoice.status === "issued" || invoice.status === "partially_paid" || invoice.status === "overdue") && (
          <>
            <Button onClick={() => setShowPaymentDialog(true)} className="flex-1">
              <DollarSign className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
            <Button variant="destructive" onClick={() => setShowCancelDialog(true)} disabled={isSubmitting}>
              <XCircle className="h-4 w-4" />
              Cancel
            </Button>
          </>
        )}
        {invoice.sourceQuoteId && (
          <Button variant="outline" asChild className="w-full">
            <Link href={`/quotes/${invoice.sourceQuoteId._id}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Quote ({invoice.sourceQuoteId.quoteNumber})
            </Link>
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Client Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="font-medium">{clientName}</p>
              {clientEmail && <p className="text-sm text-muted-foreground">{clientEmail}</p>}
              {clientPhone && <p className="text-sm text-muted-foreground">{clientPhone}</p>}
              {clientAddress && (
                <p className="text-sm text-muted-foreground">
                  {[clientAddress.line1, clientAddress.line2, clientAddress.city, clientAddress.provinceState, clientAddress.postalCode].filter(Boolean).join(", ")}
                </p>
              )}
              <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                <Link href={`/clients/${typeof invoice.clientId === "object" ? invoice.clientId._id : invoice.clientId}`}>
                  View Client
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Items ({invoice.lines.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.lines.map((line) => (
                  <TableRow key={line._id || line.lineNo}>
                    <TableCell>{line.lineNo}</TableCell>
                    <TableCell>
                      <p className="font-medium">{line.nameSnapshot || "Unknown Item"}</p>
                      <p className="text-xs text-muted-foreground">{line.skuSnapshot}</p>
                    </TableCell>
                    <TableCell className="text-right">{line.qty}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(line.lineTotalCents)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(invoice.totals?.subTotalCents || 0)}</span>
            </div>
            {invoice.vatMode !== "none" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT ({invoice.vatRateBps / 100}%)</span>
                <span>{formatCurrency(invoice.totals?.vatTotalCents || 0)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatCurrency(invoice.totals?.totalCents || 0)}</span>
            </div>
            {invoice.amountPaidCents > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Paid</span>
                <span>-{formatCurrency(invoice.amountPaidCents)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Balance Due</span>
              <span className={invoice.balanceDueCents > 0 ? "text-red-600" : "text-green-600"}>
                {formatCurrency(invoice.balanceDueCents)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Dates Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Issue Date</span>
              <span>{formatDate(invoice.issueDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Due Date</span>
              <span className={invoice.isOverdue ? "text-red-600 font-medium" : ""}>
                {formatDate(invoice.dueDate)}
                {invoice.isOverdue && " (Overdue)"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payments ({invoice.paymentHistory?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoice.paymentHistory && invoice.paymentHistory.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.paymentHistory.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell>
                        <p>{formatDate(payment.paymentDate)}</p>
                        <p className="text-xs text-muted-foreground">{getPaymentMethodLabel(payment.paymentMethod)}</p>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payment.amountCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-4">No payments recorded</p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {invoice.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{invoice.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={isSubmitting}>
              {isSubmitting ? "Cancelling..." : "Yes, Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {invoice.invoiceNumber}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="debit_card">Debit Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={paymentForm.reference}
                onChange={(e) =>
                  setPaymentForm((prev) => ({ ...prev, reference: e.target.value }))
                }
                placeholder="Payment reference"
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
    </div>
  );
}
