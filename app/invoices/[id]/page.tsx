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
import { MainLayout } from "@/components/layout/main-layout";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/utils";
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

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [invoice, setInvoice] = React.useState<Invoice | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
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
        const response = await fetch(`/api/invoices/${id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch invoice");
        }
        const data = await response.json();
        setInvoice(data.data);

        // Set default payment amount to balance due
        if (data.data?.balanceDueCents) {
          setPaymentForm((prev) => ({
            ...prev,
            amountCents: data.data.balanceDueCents,
          }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchInvoice();
    }
  }, [id]);

  // Issue invoice
  const handleIssue = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/invoices/${id}/issue`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to issue invoice");
      }

      toast({
        title: "Success",
        description: "Invoice issued successfully",
      });

      // Refresh data
      const refreshResponse = await fetch(`/api/invoices/${id}`);
      const refreshData = await refreshResponse.json();
      setInvoice(refreshData.data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to issue invoice",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel invoice
  const handleCancel = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/invoices/${id}/cancel`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to cancel invoice");
      }

      toast({
        title: "Success",
        description: "Invoice cancelled successfully",
      });

      // Refresh data
      const refreshResponse = await fetch(`/api/invoices/${id}`);
      const refreshData = await refreshResponse.json();
      setInvoice(refreshData.data);

      setShowCancelDialog(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to cancel invoice",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete invoice
  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to delete invoice");
      }

      toast({
        title: "Success",
        description: "Invoice deleted successfully",
      });

      router.push("/invoices");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete invoice",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowDeleteDialog(false);
    }
  };

  // Record payment
  const handleRecordPayment = async () => {
    if (!paymentForm.amountCents || paymentForm.amountCents <= 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/invoices/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: paymentForm.amountCents,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod,
          reference: paymentForm.reference,
          notes: paymentForm.notes,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to record payment");
      }

      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });

      // Refresh invoice data
      const refreshResponse = await fetch(`/api/invoices/${id}`);
      const refreshData = await refreshResponse.json();
      setInvoice(refreshData.data);

      // Reset and close dialog
      setPaymentForm({
        amountCents: refreshData.data?.balanceDueCents || 0,
        paymentDate: new Date().toISOString().split("T")[0],
        paymentMethod: "bank_transfer",
        reference: "",
        notes: "",
      });
      setShowPaymentDialog(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to record payment",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      issued: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      partially_paid: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    };

    const labels: Record<string, string> = {
      draft: "Draft",
      issued: "Issued",
      partially_paid: "Partially Paid",
      paid: "Paid",
      overdue: "Overdue",
      cancelled: "Cancelled",
    };

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || colors.draft}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Payment method label
  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: "Cash",
      bank_transfer: "Bank Transfer",
      card: "Card",
      other: "Other",
    };
    return labels[method] || method;
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (error || !invoice) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Invoice Not Found</h2>
          <p className="text-muted-foreground mb-4">{error || "The requested invoice could not be found"}</p>
          <Button asChild>
            <Link href="/invoices">Back to Invoices</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const clientName = typeof invoice.clientId === "object" ? (invoice.clientId as Client).name : invoice.clientSnapshot?.name;
  const clientEmail = typeof invoice.clientId === "object" ? (invoice.clientId as Client).email : invoice.clientSnapshot?.email;
  const clientPhone = typeof invoice.clientId === "object" ? (invoice.clientId as Client).phone : invoice.clientSnapshot?.phone;
  const clientAddress = typeof invoice.clientId === "object" ? (invoice.clientId as Client).billing?.address : invoice.clientSnapshot?.address;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/invoices">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
                {getStatusBadge(invoice.status)}
              </div>
              <p className="text-muted-foreground">
                Created {formatDate(invoice.createdAt)}
              </p>
            </div>
          </div>

          {/* Action Buttons based on status */}
          <div className="flex items-center gap-2 flex-wrap">
            {invoice.status === "draft" && (
              <>
                <Button
                  onClick={handleIssue}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Issue Invoice
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isSubmitting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </>
            )}

            {(invoice.status === "issued" || invoice.status === "partially_paid") && (
              <>
                <Button
                  onClick={() => setShowPaymentDialog(true)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <DollarSign className="mr-2 h-4 w-4" />
                  )}
                  Record Payment
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isSubmitting}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </>
            )}

            {invoice.sourceQuoteId && (
              <Button variant="outline" asChild>
                <Link href={`/quotes/${invoice.sourceQuoteId._id}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Source Quote ({invoice.sourceQuoteId.quoteNumber})
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Client Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Client Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                    <p className="font-medium">{clientName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Email</p>
                    <p>{clientEmail || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p>{clientPhone || "-"}</p>
                  </div>
                  {clientAddress && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Address</p>
                      <p>
                        {clientAddress.line1 && <>{clientAddress.line1}<br /></>}
                        {clientAddress.line2 && <>{clientAddress.line2}<br /></>}
                        {clientAddress.city && <>{clientAddress.city}, </>}
                        {clientAddress.provinceState && <>{clientAddress.provinceState}<br /></>}
                        {clientAddress.postalCode && <>{clientAddress.postalCode}<br /></>}
                        {clientAddress.country && <>{clientAddress.country}</>}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>Line Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.lines?.map((line, index) => (
                        <TableRow key={line.lineNo || index}>
                          <TableCell>{line.lineNo}</TableCell>
                          <TableCell>
                            <div className="font-medium">{line.nameSnapshot || "Unknown Item"}</div>
                            <div className="text-xs text-muted-foreground">{line.skuSnapshot}</div>
                          </TableCell>
                          <TableCell className="text-right">{line.qty}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.unitPriceCents)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(line.discountCents)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(line.lineTotalCents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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

            {/* Payments Tab */}
            <Tabs defaultValue="payments" className="w-full">
              <TabsList>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              <TabsContent value="payments">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Payment History</CardTitle>
                    {(invoice.status === "issued" || invoice.status === "partially_paid") && (
                      <Button size="sm" onClick={() => setShowPaymentDialog(true)}>
                        <DollarSign className="mr-2 h-4 w-4" />
                        Record Payment
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {invoice.paymentHistory && invoice.paymentHistory.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {invoice.paymentHistory.map((payment) => (
                            <TableRow key={payment._id}>
                              <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                              <TableCell>{payment.reference || payment.paymentNumber}</TableCell>
                              <TableCell>{getPaymentMethodLabel(payment.paymentMethod)}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(payment.amountCents)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <CreditCard className="h-8 w-8 mb-2" />
                        <p>No payments recorded yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="details">
                <Card>
                  <CardHeader>
                    <CardTitle>Invoice Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Invoice Number</p>
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                        <p>{getStatusBadge(invoice.status)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Issue Date</p>
                        <p>{formatDate(invoice.issueDate)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                        <p className={invoice.isOverdue ? "text-red-600 font-medium" : ""}>
                          {formatDate(invoice.dueDate)}
                          {invoice.isOverdue && " (Overdue)"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">VAT Mode</p>
                        <p className="capitalize">{invoice.vatMode}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">VAT Rate</p>
                        <p>{invoice.vatRateBps / 100}%</p>
                      </div>
                      {invoice.sourceQuoteId && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Source Quote</p>
                          <Button variant="link" className="h-auto p-0" asChild>
                            <Link href={`/quotes/${invoice.sourceQuoteId._id}`}>
                              {invoice.sourceQuoteId.quoteNumber}
                            </Link>
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Totals */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(invoice.totals?.subTotalCents || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT</span>
                  <span>{formatCurrency(invoice.totals?.vatTotalCents || 0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.totals?.totalCents || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="text-green-600">{formatCurrency(invoice.amountPaidCents || 0)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Balance Due</span>
                  <span className={invoice.balanceDueCents > 0 ? "text-red-600" : "text-green-600"}>
                    {formatCurrency(invoice.balanceDueCents || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Due Date Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Due Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${invoice.isOverdue ? "text-red-600" : ""}`}>
                    {formatDate(invoice.dueDate)}
                  </p>
                  {invoice.isOverdue && (
                    <p className="text-sm text-red-600 mt-1">This invoice is overdue</p>
                  )}
                  {!invoice.isOverdue && invoice.status !== "paid" && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {Math.ceil((new Date(invoice.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Cancel Invoice
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
              Record a payment for invoice {invoice.invoiceNumber}
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
                  <SelectItem value="card">Card</SelectItem>
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
                placeholder="Bank reference, receipt number, etc."
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
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DollarSign className="mr-2 h-4 w-4" />
              )}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
