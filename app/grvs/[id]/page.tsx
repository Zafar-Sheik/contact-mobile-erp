"use client";

import * as React from "react";
import { use } from "react";
import {
  ArrowLeft,
  Printer,
  Share2,
  Loader2,
  FileText,
  Package,
  Calendar,
  MapPin,
  User,
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
import Link from "next/link";

// Types
interface Supplier {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface StockItem {
  _id: string;
  name: string;
  sku: string;
  unit: string;
}

interface GRVLine {
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
  orderedQty: number;
  receivedQty: number;
  unitCostCents: number;
  discountType: string;
  discountValue: number;
  subtotalCents: number;
  vatAmountCents: number;
  totalCents: number;
  batchNumber: string;
  expiryDate: string;
  varianceReason: string;
}

interface GRV {
  _id: string;
  grvNumber: string;
  supplierId: Supplier | string;
  receivedAt: string;
  postedAt: string;
  status: "Draft" | "Posted" | "Cancelled";
  lines: GRVLine[];
  subtotalCents: number;
  vatTotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
  notes: string;
  referenceType: string;
  referenceNumber: string;
  locationId: string;
  locationName: string;
  createdAt: string;
  postedBy?: string;
}

interface GRVDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function GRVDetailPage({ params }: GRVDetailPageProps) {
  const { id } = use(params);
  const { toast } = useToast();
  const [grv, setGrv] = React.useState<GRV | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchGRV = async () => {
      try {
        const response = await fetch(`/api/grvs/${id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch GRV");
        }
        const data = await response.json();
        setGrv(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchGRV();
    }
  }, [id]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(cents / 100);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (!grv) return;
    
    const shareData = {
      title: `GRV ${grv.grvNumber}`,
      text: `Goods Received Voucher - ${grv.grvNumber}\nSupplier: ${typeof grv.supplierId === "object" ? grv.supplierId.name : "N/A"}\nTotal: ${formatCurrency(grv.grandTotalCents)}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareData.text);
      toast({ title: "Copied to clipboard", description: "GRV details copied" });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
      Posted: "success",
      Draft: "warning",
      Cancelled: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
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

  if (error || !grv) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <FileText className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">GRV Not Found</h2>
          <p className="text-muted-foreground mb-4">{error || "The requested GRV could not be found"}</p>
          <Button asChild>
            <Link href="/grvs">Back to GRVs</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const supplierName = typeof grv.supplierId === "object" ? grv.supplierId.name : "Unknown Supplier";
  const supplierEmail = typeof grv.supplierId === "object" ? grv.supplierId.email : "";
  const supplierPhone = typeof grv.supplierId === "object" ? grv.supplierId.phone : "";

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/grvs">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{grv.grvNumber}</h1>
              <p className="text-muted-foreground">
                {grv.receivedAt ? new Date(grv.receivedAt).toLocaleDateString() : "No date"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-3 print:hidden">
          {getStatusBadge(grv.status)}
        </div>

        {/* Print Header - Hidden on screen, visible on print */}
        <div className="hidden print:block mb-6">
          <h1 className="text-3xl font-bold">GOODS RECEIVED VOUCHER</h1>
          <p className="text-xl">{grv.grvNumber}</p>
        </div>

        {/* Document Details */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Supplier Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-semibold">{supplierName}</p>
                  {supplierEmail && <p className="text-sm text-muted-foreground">{supplierEmail}</p>}
                  {supplierPhone && <p className="text-sm text-muted-foreground">{supplierPhone}</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Document Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Received: {grv.receivedAt ? new Date(grv.receivedAt).toLocaleDateString() : "-"}</span>
                </div>
                {grv.referenceNumber && (
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {grv.referenceType === "po" ? "PO" : 
                       grv.referenceType === "supplier_invoice" ? "Supplier Invoice" : 
                       grv.referenceType === "delivery_note" ? "Delivery Note" : "Reference"}: {grv.referenceNumber}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Location: {grv.locationName}</span>
                </div>
                {grv.postedAt && (
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Posted: {new Date(grv.postedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Received Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">SKU</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grv.lines.map((line) => (
                    <TableRow key={line._id}>
                      <TableCell>{line.lineNo}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{line.itemSnapshot.name}</p>
                          {line.varianceReason && line.varianceReason !== "none" && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {line.varianceReason.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {line.itemSnapshot.sku}
                      </TableCell>
                      <TableCell className="text-right">{line.orderedQty || "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {line.receivedQty}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(line.unitCostCents)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(line.totalCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <div className="flex justify-end">
          <Card className="w-full md:w-80">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(grv.subtotalCents)}</span>
                </div>
                {grv.discountTotalCents > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(grv.discountTotalCents)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAT</span>
                  <span>{formatCurrency(grv.vatTotalCents)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(grv.grandTotalCents)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        {grv.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{grv.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Signature Section - Print Only */}
        <div className="hidden print:block mt-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="border-b border-black h-8"></div>
              <p className="text-sm mt-1">Received By</p>
            </div>
            <div>
              <div className="border-b border-black h-8"></div>
              <p className="text-sm mt-1">Approved By</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            font-size: 12px;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </MainLayout>
  );
}
