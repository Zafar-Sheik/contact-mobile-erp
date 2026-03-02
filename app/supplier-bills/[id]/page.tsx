"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Send,
  Trash2,
  FileText,
  ExternalLink,
  User,
  Calendar,
  CreditCard,
  MoreHorizontal,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { MobileCard, MobileCardContent, MobileCardHeader } from "@/components/mobile/mobile-card";
import Link from "next/link";

// Types
interface Supplier {
  _id: string;
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
}

interface BillLine {
  _id: string;
  lineNo: number;
  stockItemId: string;
  itemSnapshot: {
    sku: string;
    name: string;
    unit: string;
    vatRate: number;
    isVatExempt: boolean;
  };
  description: string;
  quantity: number;
  unitCostCents: number;
  vatRate: number;
  vatCents: number;
  subtotalCents: number;
  grvId: {
    _id: string;
    grvNumber: string;
  };
}

interface SupplierBill {
  _id: string;
  billNumber: string;
  supplierId: string | Supplier;
  poId?: {
    _id: string;
    poNumber: string;
  };
  grvIds: Array<{
    _id: string;
    grvNumber: string;
  }>;
  billDate: string;
  dueDate?: string;
  status: string;
  reference: string;
  subtotalCents: number;
  vatCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  notes: string;
  billLines: BillLine[];
  createdAt: string;
  postedAt?: string;
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
  const colors: Record<string, { bg: string; text: string; label: string; variant: "success" | "warning" | "info" | "destructive" | "secondary" | "default" }> = {
    DRAFT: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Draft", variant: "warning" },
    MATCHING_REQUIRED: { bg: "bg-orange-100", text: "text-orange-700", label: "Matching Required", variant: "warning" },
    APPROVED: { bg: "bg-blue-100", text: "text-blue-700", label: "Approved", variant: "info" },
    PARTIALLY_PAID: { bg: "bg-purple-100", text: "text-purple-700", label: "Partially Paid", variant: "info" },
    PAID: { bg: "bg-green-100", text: "text-green-700", label: "Paid", variant: "success" },
    VOIDED: { bg: "bg-red-100", text: "text-red-700", label: "Voided", variant: "destructive" },
  };
  return colors[status] || { bg: "bg-gray-100", text: "text-gray-700", label: status, variant: "default" };
};

export default function SupplierBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const [bill, setBill] = React.useState<SupplierBill | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  // Fetch bill data
  React.useEffect(() => {
    const fetchBill = async () => {
      try {
        const res = await fetch(`/api/supplier-bills/${id}`);
        const data = await res.json();
        if (data.error) {
          toast({ title: "Error", description: data.error, variant: "destructive" });
          router.push("/supplier-bills");
        } else {
          setBill(data.data);
        }
      } catch (error) {
        toast({ title: "Error", description: "Failed to fetch bill", variant: "destructive" });
        router.push("/supplier-bills");
      } finally {
        setLoading(false);
      }
    };
    fetchBill();
  }, [id, router, toast]);

  // Handle delete
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/supplier-bills/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Supplier bill deleted successfully" });
        router.push("/supplier-bills");
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete bill", variant: "destructive" });
    } finally {
      setDeleting(false);
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

  if (!bill) {
    return null;
  }

  const supplier = typeof bill.supplierId === "object" ? bill.supplierId : null;
  const statusColors = getStatusColors(bill.status);
  const balanceCents = bill.totalCents - bill.paidCents;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="bg-white border-b border-border px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push("/supplier-bills")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">{bill.billNumber}</h1>
              <p className="text-sm text-muted-foreground truncate">
                {supplier?.name || "Unknown Supplier"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant={statusColors.variant} className="mr-2">
              {statusColors.label}
            </Badge>
            {bill.status === "DRAFT" && (
              <>
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/supplier-bills/new?edit=${bill._id}`}>
                    <FileText className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 pb-24">
        {/* Quick Info Cards */}
        <section className="mb-6 space-y-3">
          {/* Summary Card */}
          <MobileCard className="border-l-4 border-l-primary">
            <MobileCardContent className="py-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-muted-foreground">Total Amount</span>
                <span className="text-2xl font-bold">{formatCurrency(bill.totalCents)}</span>
              </div>
              {bill.paidCents > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="text-green-600 font-medium">-{formatCurrency(bill.paidCents)}</span>
                </div>
              )}
              {balanceCents > 0 && (
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-muted-foreground">Balance Due</span>
                  <span className="text-red-600 font-bold">{formatCurrency(balanceCents)}</span>
                </div>
              )}
              {balanceCents === 0 && bill.status === "PAID" && (
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="success">Fully Paid</Badge>
                </div>
              )}
            </MobileCardContent>
          </MobileCard>

          {/* Action Button */}
          {bill.status === "APPROVED" && balanceCents > 0 && (
            <Button className="w-full" asChild>
              <Link href={`/supplier-payments/new?billId=${bill._id}`}>
                <CreditCard className="h-4 w-4 mr-2" />
                Record Payment
              </Link>
            </Button>
          )}
        </section>

        {/* Tabs */}
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-auto p-1">
            <TabsTrigger value="details" className="text-xs py-2">Details</TabsTrigger>
            <TabsTrigger value="lines" className="text-xs py-2">Lines</TabsTrigger>
            <TabsTrigger value="supplier" className="text-xs py-2">Supplier</TabsTrigger>
            <TabsTrigger value="related" className="text-xs py-2">Related</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="mt-4 space-y-4">
            <MobileCard>
              <MobileCardHeader>
                <h3 className="font-semibold">Bill Information</h3>
              </MobileCardHeader>
              <MobileCardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Bill Date</label>
                    <p className="font-medium flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatDate(bill.billDate)}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Due Date</label>
                    <p className="font-medium flex items-center gap-2 mt-1">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {bill.dueDate ? formatDate(bill.dueDate) : "Not set"}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Reference</label>
                    <p className="font-medium mt-1">{bill.reference || "Not set"}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Purchase Order</label>
                    <p className="mt-1">
                      {bill.poId ? (
                        <Link
                          href={`/purchase-orders/${bill.poId._id}`}
                          className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                        >
                          {bill.poId.poNumber}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not linked</span>
                      )}
                    </p>
                  </div>
                </div>
              </MobileCardContent>
            </MobileCard>

            {/* Financial Summary */}
            <MobileCard>
              <MobileCardHeader>
                <h3 className="font-semibold">Financial Summary</h3>
              </MobileCardHeader>
              <MobileCardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(bill.subtotalCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">VAT</span>
                  <span>{formatCurrency(bill.vatCents)}</span>
                </div>
                {bill.discountCents > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(bill.discountCents)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(bill.totalCents)}</span>
                </div>
              </MobileCardContent>
            </MobileCard>

            {/* Notes */}
            {bill.notes && (
              <MobileCard>
                <MobileCardHeader>
                  <h3 className="font-semibold">Notes</h3>
                </MobileCardHeader>
                <MobileCardContent>
                  <p className="text-sm whitespace-pre-wrap">{bill.notes}</p>
                </MobileCardContent>
              </MobileCard>
            )}
          </TabsContent>

          {/* Lines Tab */}
          <TabsContent value="lines" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">#</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">Item</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground">GRV</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Qty</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Unit Cost</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">VAT</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.billLines?.map((line) => (
                    <tr key={line._id} className="border-b">
                      <td className="py-2 px-2 text-sm">{line.lineNo}</td>
                      <td className="py-2 px-2">
                        <div>
                          <p className="font-medium text-sm">{line.itemSnapshot?.name || line.description}</p>
                          <p className="text-xs text-muted-foreground">{line.itemSnapshot?.sku || "N/A"}</p>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-sm">
                        {line.grvId ? (
                          <Link
                            href={`/grvs/${line.grvId._id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {line.grvId.grvNumber}
                          </Link>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="py-2 px-2 text-sm text-right">
                        {line.quantity} {line.itemSnapshot?.unit || "each"}
                      </td>
                      <td className="py-2 px-2 text-sm text-right">
                        {formatCurrency(line.unitCostCents)}
                      </td>
                      <td className="py-2 px-2 text-sm text-right">
                        {line.vatCents > 0 ? (
                          <span className="text-green-600">+{formatCurrency(line.vatCents)}</span>
                        ) : (
                          "Exempt"
                        )}
                      </td>
                      <td className="py-2 px-2 text-sm text-right font-medium">
                        {formatCurrency(line.subtotalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* Supplier Tab */}
          <TabsContent value="supplier" className="mt-4">
            {supplier ? (
              <div className="space-y-4">
                <MobileCard>
                  <MobileCardHeader>
                    <h3 className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {supplier.name}
                    </h3>
                  </MobileCardHeader>
                  <MobileCardContent className="space-y-3">
                    {supplier.email && (
                      <a
                        href={`mailto:${supplier.email}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                      >
                        <Mail className="h-3 w-3" />
                        {supplier.email}
                      </a>
                    )}
                    {supplier.phone && (
                      <a
                        href={`tel:${supplier.phone}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                      >
                        <Phone className="h-3 w-3" />
                        {supplier.phone}
                      </a>
                    )}
                    {supplier.address && (
                      <div className="text-sm text-muted-foreground mt-2">
                        <p>{supplier.address.line1}</p>
                        {supplier.address.line2 && <p>{supplier.address.line2}</p>}
                        <p>
                          {supplier.address.city}, {supplier.address.provinceState}{" "}
                          {supplier.address.postalCode}
                        </p>
                      </div>
                    )}
                  </MobileCardContent>
                </MobileCard>
                <Button variant="outline" className="w-full" asChild>
                  <Link href={`/suppliers/${supplier._id}`}>View Supplier Details</Link>
                </Button>
              </div>
            ) : (
              <MobileCard>
                <MobileCardContent>
                  <p className="text-muted-foreground text-center">Unknown supplier</p>
                </MobileCardContent>
              </MobileCard>
            )}
          </TabsContent>

          {/* Related Tab */}
          <TabsContent value="related" className="mt-4 space-y-4">
            {/* Linked GRVs */}
            {bill.grvIds && bill.grvIds.length > 0 && (
              <MobileCard>
                <MobileCardHeader>
                  <h3 className="font-semibold">Linked GRVs</h3>
                </MobileCardHeader>
                <MobileCardContent className="space-y-2">
                  {bill.grvIds.map((grv) => (
                    <Link
                      key={grv._id}
                      href={`/grvs/${grv._id}`}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-accent"
                    >
                      <span className="font-medium">{grv.grvNumber}</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </MobileCardContent>
              </MobileCard>
            )}

            {/* Purchase Order */}
            {bill.poId && (
              <MobileCard>
                <MobileCardHeader>
                  <h3 className="font-semibold">Purchase Order</h3>
                </MobileCardHeader>
                <MobileCardContent>
                  <Link
                    href={`/purchase-orders/${bill.poId._id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-accent"
                  >
                    <span className="font-medium">{bill.poId.poNumber}</span>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </MobileCardContent>
              </MobileCard>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier Bill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this supplier bill? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
