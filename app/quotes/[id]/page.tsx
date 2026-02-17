"use client";

import * as React from "react";
import { use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Send,
  CheckCircle,
  XCircle,
  FileText,
  Trash2,
  ExternalLink,
  Calendar,
  User,
  Building,
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

interface QuoteLine {
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

interface Quote {
  _id: string;
  quoteNumber: string;
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
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  lines: QuoteLine[];
  totals: {
    subTotalCents: number;
    vatTotalCents: number;
    totalCents: number;
  };
  vatMode: "exclusive" | "inclusive" | "none";
  vatRateBps: number;
  validUntil: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  relatedInvoice?: {
    _id: string;
    invoiceNumber: string;
    status: string;
  };
}

interface QuoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  // Fetch quote
  React.useEffect(() => {
    const fetchQuote = async () => {
      try {
        const response = await fetch(`/api/quotes/${id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch quote");
        }
        const data = await response.json();
        setQuote(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchQuote();
    }
  }, [id]);

  // Send quote
  const handleSend = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/quotes/${id}/send`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send quote");
      }

      toast({
        title: "Success",
        description: "Quote sent successfully",
      });

      // Refresh data
      const refreshResponse = await fetch(`/api/quotes/${id}`);
      const refreshData = await refreshResponse.json();
      setQuote(refreshData.data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send quote",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Accept quote
  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/quotes/${id}/accept`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to accept quote");
      }

      toast({
        title: "Success",
        description: "Quote accepted successfully",
      });

      // Refresh data
      const refreshResponse = await fetch(`/api/quotes/${id}`);
      const refreshData = await refreshResponse.json();
      setQuote(refreshData.data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to accept quote",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reject quote
  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/quotes/${id}/reject`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to reject quote");
      }

      toast({
        title: "Success",
        description: "Quote rejected successfully",
      });

      // Refresh data
      const refreshResponse = await fetch(`/api/quotes/${id}`);
      const refreshData = await refreshResponse.json();
      setQuote(refreshData.data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reject quote",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert to invoice
  const handleConvertToInvoice = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/quotes/${id}/convert-to-invoice`, {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to convert quote to invoice");
      }

      toast({
        title: "Success",
        description: "Invoice created successfully",
      });

      // Redirect to the invoice
      router.push(`/invoices/${result.data._id}`);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to convert to invoice",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete quote
  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/quotes/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to delete quote");
      }

      toast({
        title: "Success",
        description: "Quote deleted successfully",
      });

      router.push("/quotes");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete quote",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowDeleteDialog(false);
    }
  };

  // Status badge
  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline" | "warning" | "success"> = {
      draft: "secondary",
      sent: "default",
      accepted: "success",
      rejected: "destructive",
      expired: "warning",
    };

    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
      sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      expired: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    };

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || colors.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
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

  if (error || !quote) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Quote Not Found</h2>
          <p className="text-muted-foreground mb-4">{error || "The requested quote could not be found"}</p>
          <Button asChild>
            <Link href="/quotes">Back to Quotes</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const clientName = typeof quote.clientId === "object" ? quote.clientId.name : quote.clientSnapshot.name;
  const clientEmail = typeof quote.clientId === "object" ? quote.clientId.email : quote.clientSnapshot.email;
  const clientPhone = typeof quote.clientId === "object" ? quote.clientId.phone : quote.clientSnapshot.phone;
  const clientAddress = typeof quote.clientId === "object" ? quote.clientId.billing?.address : quote.clientSnapshot.address;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/quotes">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{quote.quoteNumber}</h1>
                {getStatusBadge(quote.status)}
              </div>
              <p className="text-muted-foreground">
                Created {formatDate(quote.createdAt)}
              </p>
            </div>
          </div>

          {/* Action Buttons based on status */}
          <div className="flex items-center gap-2">
            {quote.status === "draft" && (
              <>
                <Button
                  onClick={handleSend}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Quote
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

            {quote.status === "sent" && (
              <>
                <Button
                  onClick={handleAccept}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Accept
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Reject
                </Button>
                <Button
                  variant="outline"
                  onClick={handleConvertToInvoice}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  )}
                  Convert to Invoice
                </Button>
              </>
            )}

            {(quote.status === "accepted" || quote.status === "rejected") && (
              quote.relatedInvoice ? (
                <Button asChild>
                  <Link href={`/invoices/${quote.relatedInvoice._id}`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Invoice ({quote.relatedInvoice.invoiceNumber})
                  </Link>
                </Button>
              ) : quote.status === "accepted" ? (
                <Button
                  variant="outline"
                  onClick={handleConvertToInvoice}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  )}
                  Convert to Invoice
                </Button>
              ) : null
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
                    <p className="text-sm font-medium text-muted-foreground">Client Name</p>
                    <p className="text-lg font-semibold">{clientName}</p>
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
                        {[clientAddress.line1, clientAddress.line2, clientAddress.city, clientAddress.provinceState, clientAddress.postalCode]
                          .filter(Boolean)
                          .join(", ") || "-"}
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
                      {quote.lines.map((line, index) => (
                        <TableRow key={line.lineNo || index}>
                          <TableCell>{line.lineNo}</TableCell>
                          <TableCell>
                            <p className="font-medium">{line.nameSnapshot}</p>
                            <p className="text-sm text-muted-foreground">{line.skuSnapshot}</p>
                          </TableCell>
                          <TableCell className="text-right">{line.qty}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(line.unitPriceCents)}
                          </TableCell>
                          <TableCell className="text-right">
                            {line.discountCents > 0 ? formatCurrency(line.discountCents) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(line.lineTotalCents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            {quote.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{quote.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Totals */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(quote.totals?.subTotalCents || 0)}
                  </span>
                </div>
                {quote.vatMode !== "none" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      VAT ({quote.vatRateBps / 100}%)
                    </span>
                    <span className="font-medium">
                      {formatCurrency(quote.totals?.vatTotalCents || 0)}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(quote.totals?.totalCents || 0)}</span>
                </div>
              </CardContent>
            </Card>

            {/* VAT Details */}
            <Card>
              <CardHeader>
                <CardTitle>Tax Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT Mode</span>
                  <span className="font-medium capitalize">{quote.vatMode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT Rate</span>
                  <span className="font-medium">{quote.vatRateBps / 100}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Validity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Validity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quote.validUntil ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valid Until</span>
                    <span className="font-medium">{formatDate(quote.validUntil)}</span>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No expiration date set</p>
                )}
              </CardContent>
            </Card>

            {/* Related Invoice */}
            {quote.relatedInvoice && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Related Invoice
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/invoices/${quote.relatedInvoice?._id}`}>
                      {quote.relatedInvoice?.invoiceNumber}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Quote</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this quote? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
