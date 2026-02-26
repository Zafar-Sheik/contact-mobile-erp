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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    DRAFT: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Draft" },
    MATCHING_REQUIRED: { bg: "bg-orange-100", text: "text-orange-700", label: "Matching Required" },
    APPROVED: { bg: "bg-blue-100", text: "text-blue-700", label: "Approved" },
    PARTIALLY_PAID: { bg: "bg-purple-100", text: "text-purple-700", label: "Partially Paid" },
    PAID: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
    VOIDED: { bg: "bg-red-100", text: "text-red-700", label: "Voided" },
  };
  return colors[status] || colors.DRAFT;
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
    <div className="container mx-auto py-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/supplier-bills")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{bill.billNumber}</h1>
            <p className="text-muted-foreground">
              {supplier?.name || "Unknown Supplier"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`${statusColors.bg} ${statusColors.text}`}>
            {statusColors.label}
          </Badge>
          {bill.status === "DRAFT" && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/supplier-bills/new?edit=${bill._id}`}>
                  <FileText className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bill Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Bill Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Bill Date</label>
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(bill.billDate)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {bill.dueDate ? formatDate(bill.dueDate) : "Not set"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Supplier Reference</label>
                  <p>{bill.reference || "Not set"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Purchase Order</label>
                  <p>
                    {bill.poId ? (
                      <Link
                        href={`/purchase-orders/${bill.poId._id}`}
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {bill.poId.poNumber}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      "Not linked"
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>GRV</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bill.billLines?.map((line) => (
                    <TableRow key={line._id}>
                      <TableCell>{line.lineNo}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{line.itemSnapshot?.name || line.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {line.itemSnapshot?.sku || "N/A"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
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
                      </TableCell>
                      <TableCell className="text-right">
                        {line.quantity} {line.itemSnapshot?.unit || "each"}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(line.unitCostCents)}
                      </TableCell>
                      <TableCell className="text-right">
                        {line.vatCents > 0 ? (
                          <span className="text-green-600">+{formatCurrency(line.vatCents)}</span>
                        ) : (
                          "Exempt"
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.subtotalCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Notes */}
          {bill.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{bill.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          {/* Supplier Card */}
          <Card>
            <CardHeader>
              <CardTitle>Supplier</CardTitle>
            </CardHeader>
            <CardContent>
              {supplier ? (
                <div className="space-y-2">
                  <p className="font-medium flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {supplier.name}
                  </p>
                  {supplier.email && (
                    <p className="text-sm text-muted-foreground">{supplier.email}</p>
                  )}
                  {supplier.phone && (
                    <p className="text-sm text-muted-foreground">{supplier.phone}</p>
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
                  <Button variant="outline" size="sm" className="mt-2 w-full" asChild>
                    <Link href={`/suppliers/${supplier._id}`}>View Supplier</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Unknown supplier</p>
              )}
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(bill.subtotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT</span>
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
              {bill.paidCents > 0 && (
                <>
                  <div className="flex justify-between text-green-600">
                    <span>Paid</span>
                    <span>-{formatCurrency(bill.paidCents)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Balance Due</span>
                    <span className={balanceCents > 0 ? "text-red-600" : "text-green-600"}>
                      {formatCurrency(balanceCents)}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* GRVs */}
          {bill.grvIds && bill.grvIds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Linked GRVs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bill.grvIds.map((grv) => (
                    <Link
                      key={grv._id}
                      href={`/grvs/${grv._id}`}
                      className="flex items-center justify-between p-2 rounded hover:bg-gray-100"
                    >
                      <span className="font-medium">{grv.grvNumber}</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions for Approved Bills */}
          {bill.status === "APPROVED" && balanceCents > 0 && (
            <Button className="w-full" asChild>
              <Link href={`/supplier-payments/new?billId=${bill._id}`}>
                <CreditCard className="h-4 w-4 mr-2" />
                Record Payment
              </Link>
            </Button>
          )}
        </div>
      </div>

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
