"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
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
    sent: { bg: "bg-blue-100", text: "text-blue-700", label: "Sent" },
    accepted: { bg: "bg-green-100", text: "text-green-700", label: "Accepted" },
    rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
    expired: { bg: "bg-orange-100", text: "text-orange-700", label: "Expired" },
  };
  return colors[status] || colors.draft;
};

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [quote, setQuote] = React.useState<Quote | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  // Fetch quote
  React.useEffect(() => {
    const fetchQuote = async () => {
      try {
        const response = await fetch(`/api/quotes/${id}`);
        const data = await response.json();
        if (data.error) {
          toast({ title: "Error", description: data.error, variant: "destructive" });
          router.push("/quotes");
        } else {
          setQuote(data.data);
        }
      } catch (error) {
        toast({ title: "Error", description: "Failed to fetch quote", variant: "destructive" });
        router.push("/quotes");
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
  }, [id, router, toast]);

  // Send quote
  const handleSend = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Quote sent successfully" });
        const refresh = await fetch(`/api/quotes/${id}`);
        const refreshData = await refresh.json();
        setQuote(refreshData.data);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send quote", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Accept quote
  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/${id}/accept`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Quote accepted successfully" });
        const refresh = await fetch(`/api/quotes/${id}`);
        const refreshData = await refresh.json();
        setQuote(refreshData.data);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to accept quote", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reject quote
  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/${id}/reject`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Quote rejected successfully" });
        const refresh = await fetch(`/api/quotes/${id}`);
        const refreshData = await refresh.json();
        setQuote(refreshData.data);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to reject quote", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert to invoice
  const handleConvertToInvoice = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/${id}/convert-to-invoice`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Quote converted to invoice" });
        router.push(`/invoices/${data.data._id}`);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to convert quote", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete quote
  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Quote deleted successfully" });
        router.push("/quotes");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete quote", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  const client = typeof quote.clientId === "object" ? quote.clientId : null;
  const clientName = client?.name || quote.clientSnapshot.name;
  const clientEmail = client?.email || quote.clientSnapshot.email;
  const clientPhone = client?.phone || quote.clientSnapshot.phone;
  const clientAddress = client?.billing?.address || quote.clientSnapshot.address;
  const statusColors = getStatusColors(quote.status);

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/quotes")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{quote.quoteNumber}</h1>
            <p className="text-muted-foreground">
              Created {formatDate(quote.createdAt)}
            </p>
          </div>
        </div>
        <Badge className={`${statusColors.bg} ${statusColors.text}`}>
          {statusColors.label}
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {quote.status === "draft" && (
          <>
            <Button onClick={handleSend} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Send
            </Button>
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={isSubmitting}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
        {quote.status === "sent" && (
          <>
            <Button onClick={handleAccept} disabled={isSubmitting} className="flex-1 bg-green-600 hover:bg-green-700">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Accept
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Reject
            </Button>
            <Button variant="outline" onClick={handleConvertToInvoice} disabled={isSubmitting} className="w-full">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              Convert to Invoice
            </Button>
          </>
        )}
        {(quote.status === "accepted" || quote.status === "rejected") && quote.relatedInvoice && (
          <Button asChild className="w-full">
            <Link href={`/invoices/${quote.relatedInvoice._id}`}>
              <ExternalLink className="h-4 w-4 mr-2" />
              View Invoice ({quote.relatedInvoice.invoiceNumber})
            </Link>
          </Button>
        )}
        {quote.status === "accepted" && !quote.relatedInvoice && (
          <Button onClick={handleConvertToInvoice} disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
            Convert to Invoice
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
                <Link href={`/clients/${typeof quote.clientId === "object" ? quote.clientId._id : quote.clientId}`}>
                  View Client
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Items ({quote.lines.length})</CardTitle>
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
                {quote.lines.map((line) => (
                  <TableRow key={line._id || line.lineNo}>
                    <TableCell>{line.lineNo}</TableCell>
                    <TableCell>
                      <p className="font-medium">{line.nameSnapshot}</p>
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
              <span>{formatCurrency(quote.totals?.subTotalCents || 0)}</span>
            </div>
            {quote.vatMode !== "none" && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT ({quote.vatRateBps / 100}%)</span>
                <span>{formatCurrency(quote.totals?.vatTotalCents || 0)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatCurrency(quote.totals?.totalCents || 0)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDate(quote.createdAt)}</span>
            </div>
            {quote.validUntil && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valid Until</span>
                <span>{formatDate(quote.validUntil)}</span>
              </div>
            )}
            {quote.sentAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sent</span>
                <span>{formatDate(quote.sentAt)}</span>
              </div>
            )}
            {quote.acceptedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Accepted</span>
                <span>{formatDate(quote.acceptedAt)}</span>
              </div>
            )}
            {quote.rejectedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rejected</span>
                <span>{formatDate(quote.rejectedAt)}</span>
              </div>
            )}
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
            <AlertDialogAction onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
