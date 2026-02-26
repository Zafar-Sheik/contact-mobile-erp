"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  MoreHorizontal,
  ShoppingCart,
  Package,
  Receipt,
  CreditCard,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MobileCard, MobileCardContent } from "@/components/mobile/mobile-card";
import { MobileListItem } from "@/components/mobile/mobile-list-item";
import { useApi } from "@/lib/hooks/use-api";

// Types
interface Supplier {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  isActive?: boolean;
  createdAt?: string;
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  date: string;
  expectedDelivery: string;
  total: number;
  status: string;
  supplierName?: string;
}

interface GRV {
  _id: string;
  grvNumber: string;
  date: string;
  total: number;
  status: string;
  poNumber?: string;
}

interface SupplierBill {
  _id: string;
  billNumber: string;
  date: string;
  dueDate: string;
  total: number;
  status: string;
  paidAmount?: number;
}

interface SupplierPayment {
  _id: string;
  paymentNumber: string;
  date: string;
  amount: number;
  status: string;
  reference?: string;
}

interface SupplierAPSummary {
  outstanding: number;
  overdue: number;
  credits: number;
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

// Status badge helper
const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: "success" | "warning" | "info" | "destructive" | "secondary" | "default" }> = {
    Draft: { label: "Draft", variant: "secondary" },
    Issued: { label: "Issued", variant: "info" },
    Approved: { label: "Approved", variant: "success" },
    PartiallyReceived: { label: "Partial", variant: "warning" },
    FullyReceived: { label: "Received", variant: "success" },
    Pending: { label: "Pending", variant: "warning" },
    Posted: { label: "Posted", variant: "success" },
    Voided: { label: "Voided", variant: "destructive" },
    Cancelled: { label: "Cancelled", variant: "destructive" },
  };
  return map[status] || { label: status, variant: "default" };
};

// Shared DocRow component for consistent list items
interface DocRowProps {
  docNumber: string;
  date: string;
  amount: number;
  status: string;
  href: string;
  description?: string;
}

function DocRow({ docNumber, date, amount, status, href, description }: DocRowProps) {
  const badge = getStatusBadge(status);

  return (
    <Link href={href} className="block">
      <MobileListItem
        title={docNumber}
        subtitle={formatDate(date)}
        description={description}
        showChevron={true}
        rightContent={
          <div className="flex flex-col items-end gap-1">
            <span className="font-semibold text-sm">{formatCurrency(amount)}</span>
            <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0.5">{badge.label}</Badge>
          </div>
        }
      />
    </Link>
  );
}

// AP Summary Card Component
function APSummaryCard({ summary }: { summary: SupplierAPSummary }) {
  return (
    <MobileCard className="border-l-4 border-l-amber-500">
      <MobileCardContent className="py-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accounts Payable</p>
        <div className="grid grid-cols-3 gap-4 mt-3">
          <div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(summary.outstanding)}</p>
            <p className="text-xs text-muted-foreground">Outstanding</p>
          </div>
          <div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(summary.overdue)}</p>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
          <div>
            <p className="text-xl font-bold text-emerald-600">{formatCurrency(summary.credits)}</p>
            <p className="text-xs text-muted-foreground">Credits</p>
          </div>
        </div>
      </MobileCardContent>
    </MobileCard>
  );
}

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.supplierId as string;

  // Fetch supplier data
  const { data: supplier } = useApi<Supplier>(`/api/suppliers/${supplierId}`);
  
  // Fetch AP summary
  const { data: apSummary } = useApi<SupplierAPSummary>(`/api/suppliers/${supplierId}/ap-summary`, { immediate: true });

  // Fetch related documents
  const { data: openPOs } = useApi<PurchaseOrder[]>(`/api/purchase-orders?supplierId=${supplierId}&status=Issued&limit=10`, { immediate: true });
  const { data: grvs } = useApi<GRV[]>(`/api/grvs?supplierId=${supplierId}&limit=10`, { immediate: true });
  const { data: bills } = useApi<SupplierBill[]>(`/api/supplier-bills?supplierId=${supplierId}&limit=10`, { immediate: true });
  const { data: payments } = useApi<SupplierPayment[]>(`/api/supplier-payments?supplierId=${supplierId}&limit=10`, { immediate: true });

  const defaultSummary: SupplierAPSummary = { outstanding: 0, overdue: 0, credits: 0 };
  const summary = apSummary || defaultSummary;

  // Calculate totals for overview tab
  const totalPOs = (openPOs || []).reduce((sum, po) => sum + po.total, 0);
  const totalBills = (bills || []).reduce((sum, b) => sum + b.total, 0);
  const totalPaid = (payments || []).reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">{supplier?.name || "Loading..."}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {supplier?.isActive !== false ? (
                  <Badge variant="success" className="text-[10px]">Active</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                )}
                {supplier?.contactPerson && (
                  <span className="text-xs text-muted-foreground">{supplier.contactPerson}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {supplier?.phone && (
              <Button variant="ghost" size="icon" asChild>
                <a href={`tel:${supplier.phone}`}>
                  <Phone className="h-4 w-4" />
                </a>
              </Button>
            )}
            {supplier?.email && (
              <Button variant="ghost" size="icon" asChild>
                <a href={`mailto:${supplier.email}`}>
                  <Mail className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Contact Info */}
        {(supplier?.email || supplier?.phone) && (
          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            {supplier.email && (
              <a href={`mailto:${supplier.email}`} className="text-muted-foreground hover:text-primary">
                {supplier.email}
              </a>
            )}
            {supplier.phone && (
              <a href={`tel:${supplier.phone}`} className="text-muted-foreground hover:text-primary">
                {supplier.phone}
              </a>
            )}
          </div>
        )}
      </header>

      <main className="p-4 pb-24">
        {/* AP Summary Card */}
        <section className="mb-6">
          <APSummaryCard summary={summary} />
        </section>

        {/* Quick Actions */}
        <section className="mb-6">
          <div className="flex gap-3">
            <Button asChild className="flex-1">
              <Link href={`/purchase-orders/new?supplierId=${supplierId}`}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Create PO
              </Link>
            </Button>
            <Button asChild variant="secondary" className="flex-1">
              <Link href={`/supplier-payments/new?supplierId=${supplierId}`}>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay Supplier
              </Link>
            </Button>
          </div>
        </section>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-6 h-auto p-1">
            <TabsTrigger value="overview" className="text-xs py-2">Overview</TabsTrigger>
            <TabsTrigger value="pos" className="text-xs py-2">POs</TabsTrigger>
            <TabsTrigger value="grvs" className="text-xs py-2">GRVs</TabsTrigger>
            <TabsTrigger value="bills" className="text-xs py-2">Bills</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs py-2">Payments</TabsTrigger>
            <TabsTrigger value="statement" className="text-xs py-2">Statement</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <MobileCard>
              <MobileCardContent className="py-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Open POs</span>
                    <span className="font-semibold">{formatCurrency(totalPOs)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bills Total</span>
                    <span className="font-semibold">{formatCurrency(totalBills)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Payments Made</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="text-sm font-medium">Balance Due</span>
                    <span className="font-bold text-lg">{formatCurrency(summary.outstanding)}</span>
                  </div>
                </div>
              </MobileCardContent>
            </MobileCard>
          </TabsContent>

          {/* Open POs Tab */}
          <TabsContent value="pos" className="mt-4 space-y-2">
            {(openPOs && openPOs.length > 0) ? (
              openPOs.map((po) => (
                <DocRow
                  key={po._id}
                  docNumber={po.poNumber}
                  date={po.date}
                  amount={po.total}
                  status={po.status}
                  href={`/purchase-orders/${po._id}`}
                />
              ))
            ) : (
              <MobileCard>
                <MobileCardContent className="py-8 text-center">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No open purchase orders</p>
                </MobileCardContent>
              </MobileCard>
            )}
          </TabsContent>

          {/* GRVs Tab */}
          <TabsContent value="grvs" className="mt-4 space-y-2">
            {(grvs && grvs.length > 0) ? (
              grvs.map((grv) => (
                <DocRow
                  key={grv._id}
                  docNumber={grv.grvNumber}
                  date={grv.date}
                  amount={grv.total}
                  status={grv.status}
                  href={`/grvs/${grv._id}`}
                  description={grv.poNumber ? `Linked to PO-${grv.poNumber}` : undefined}
                />
              ))
            ) : (
              <MobileCard>
                <MobileCardContent className="py-8 text-center">
                  <Package className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No goods received</p>
                </MobileCardContent>
              </MobileCard>
            )}
          </TabsContent>

          {/* Bills Tab */}
          <TabsContent value="bills" className="mt-4 space-y-2">
            {(bills && bills.length > 0) ? (
              bills.map((bill) => (
                <DocRow
                  key={bill._id}
                  docNumber={bill.billNumber}
                  date={bill.date}
                  amount={bill.total}
                  status={bill.status}
                  href={`/supplier-bills/${bill._id}`}
                />
              ))
            ) : (
              <MobileCard>
                <MobileCardContent className="py-8 text-center">
                  <Receipt className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No supplier bills</p>
                </MobileCardContent>
              </MobileCard>
            )}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="mt-4 space-y-2">
            {(payments && payments.length > 0) ? (
              payments.map((payment) => (
                <DocRow
                  key={payment._id}
                  docNumber={payment.paymentNumber}
                  date={payment.date}
                  amount={payment.amount}
                  status={payment.status}
                  href={`/supplier-payments/${payment._id}`}
                />
              ))
            ) : (
              <MobileCard>
                <MobileCardContent className="py-8 text-center">
                  <CreditCard className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No payments recorded</p>
                </MobileCardContent>
              </MobileCard>
            )}
          </TabsContent>

          {/* Statement Tab */}
          <TabsContent value="statement" className="mt-4">
            <MobileCard>
              <MobileCardContent className="py-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Statement feature coming soon</p>
              </MobileCardContent>
            </MobileCard>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
