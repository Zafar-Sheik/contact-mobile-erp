"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Package,
  Receipt,
  CreditCard,
  ArrowRight,
  FileText,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MobileCard, MobileCardContent } from "@/components/mobile/mobile-card";
import { MobileListItem } from "@/components/mobile/mobile-list-item";
import { useApi } from "@/lib/hooks/use-api";

// Types
interface PurchaseOrder {
  _id: string;
  poNumber: string;
  status: string;
  total: number;
  supplierName?: string;
  date: string;
}

interface GRV {
  _id: string;
  grvNumber: string;
  status: string;
  total: number;
  supplierName?: string;
  date: string;
}

interface SupplierBill {
  _id: string;
  billNumber: string;
  status: string;
  total: number;
  supplierName?: string;
  date: string;
}

interface SupplierPayment {
  _id: string;
  paymentNumber: string;
  status: string;
  amount: number;
  supplierName?: string;
  date: string;
}

interface P2pSummary {
  openPOs: number;
  pendingReceipts: number;
  billsNeedingApproval: number;
  unpaidBills: number;
}

// Quick actions configuration
const quickActions = [
  {
    label: "Create PO",
    href: "/purchase-orders/new",
    icon: ShoppingCart,
    color: "bg-blue-600",
    description: "New purchase order",
  },
  {
    label: "Receive Goods",
    href: "/grvs/new",
    icon: Package,
    color: "bg-emerald-600",
    description: "Capture GRV",
  },
  {
    label: "Capture Bill",
    href: "/supplier-bills/new",
    icon: Receipt,
    color: "bg-amber-600",
    description: "Create supplier bill",
  },
  {
    label: "Pay Supplier",
    href: "/supplier-payments/new",
    icon: CreditCard,
    color: "bg-purple-600",
    description: "Record payment",
  },
];

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

// Summary Card Component
interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: "default" | "warning" | "success" | "danger";
  onClick?: () => void;
  href?: string;
}

function SummaryCard({ title, value, subtitle, variant = "default", onClick, href }: SummaryCardProps) {
  const variantStyles = {
    default: "border-l-4 border-l-primary",
    warning: "border-l-4 border-l-amber-500",
    success: "border-l-4 border-l-emerald-500",
    danger: "border-l-4 border-l-red-500",
  };

  const content = (
    <MobileCard className={`${variantStyles[variant]} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
      <MobileCardContent className="py-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </MobileCardContent>
    </MobileCard>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return <div onClick={onClick}>{content}</div>;
}

// Quick Action Button Component
interface QuickActionProps {
  label: string;
  description: string;
  href: string;
  icon: React.ElementType;
  color: string;
}

function QuickAction({ label, description, href, icon: Icon, color }: QuickActionProps) {
  return (
    <Link href={href} className="block">
      <MobileCard className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99]">
        <MobileCardContent className="py-4 px-4">
          <div className="flex items-center gap-4">
            <div className={`${color} p-3 rounded-xl shrink-0`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 ml-auto" />
          </div>
        </MobileCardContent>
      </MobileCard>
    </Link>
  );
}

// Recent Activity Item
interface RecentActivityItemProps {
  type: "PO" | "GRV" | "BILL" | "PAY";
  number: string;
  title: string;
  amount?: number;
  status: string;
  date: string;
  href: string;
}

function RecentActivityItem({ type, number, title, amount, status, date, href }: RecentActivityItemProps) {
  const typeColors: Record<string, string> = {
    PO: "bg-blue-100 text-blue-700",
    GRV: "bg-emerald-100 text-emerald-700",
    BILL: "bg-amber-100 text-amber-700",
    PAY: "bg-purple-100 text-purple-700",
  };

  const badge = getStatusBadge(status);

  return (
    <Link href={href} className="block">
      <MobileListItem
        title={title}
        subtitle={amount ? formatCurrency(amount) : undefined}
        showChevron={true}
        rightContent={
          <div className="flex flex-col items-end gap-1">
            <Badge variant={badge.variant} className="text-[10px] px-1.5 py-0.5">{badge.label}</Badge>
            <span className="text-[10px] text-muted-foreground">{date}</span>
          </div>
        }
      />
    </Link>
  );
}

export default function P2PHubPage() {
  const router = useRouter();

  // Fetch P2P summary data
  const { data: summaryData } = useApi<P2pSummary>("/api/p2p/summary", { immediate: true });

  // Fetch recent documents
  const { data: recentPOs } = useApi<PurchaseOrder[]>("/api/purchase-orders?limit=3&status=Issued", { immediate: true });
  const { data: recentGRVs } = useApi<GRV[]>("/api/grvs?limit=3&status=Pending", { immediate: true });
  const { data: recentBills } = useApi<SupplierBill[]>("/api/supplier-bills?limit=3&status=Draft", { immediate: true });
  const { data: recentPayments } = useApi<SupplierPayment[]>("/api/supplier-payments?limit=3", { immediate: true });

  const summary = summaryData || {
    openPOs: 0,
    pendingReceipts: 0,
    billsNeedingApproval: 0,
    unpaidBills: 0,
  };

  // Build recent activity list
  const recentActivity: RecentActivityItemProps[] = [
    ...(recentPOs || []).map((po) => ({
      type: "PO" as const,
      number: po.poNumber,
      title: po.supplierName || "Purchase Order",
      amount: po.total,
      status: po.status,
      date: formatDate(po.date),
      href: `/purchase-orders/${po._id}`,
    })),
    ...(recentGRVs || []).map((grv) => ({
      type: "GRV" as const,
      number: grv.grvNumber,
      title: grv.supplierName || "Goods Received",
      amount: grv.total,
      status: grv.status,
      date: formatDate(grv.date),
      href: `/grvs/${grv._id}`,
    })),
    ...(recentBills || []).map((bill) => ({
      type: "BILL" as const,
      number: bill.billNumber,
      title: bill.supplierName || "Supplier Bill",
      amount: bill.total,
      status: bill.status,
      date: formatDate(bill.date),
      href: `/supplier-bills/${bill._id}`,
    })),
    ...(recentPayments || []).map((pay) => ({
      type: "PAY" as const,
      number: pay.paymentNumber,
      title: pay.supplierName || "Payment",
      amount: pay.amount,
      status: pay.status,
      date: formatDate(pay.date),
      href: `/supplier-payments/${pay._id}`,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">P2P Hub</h1>
            <p className="text-xs text-muted-foreground">Procure-to-Pay Overview</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.refresh()}>
              <Clock className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 pb-24 space-y-6">
        {/* Summary Cards */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Overview</h2>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              title="Open POs"
              value={summary.openPOs}
              subtitle="Awaiting receipt"
              variant="default"
              href="/purchase-orders?status=Issued"
            />
            <SummaryCard
              title="Pending Receipts"
              value={summary.pendingReceipts}
              subtitle="GRVs to post"
              variant="warning"
              href="/grvs?status=Pending"
            />
            <SummaryCard
              title="Need Approval"
              value={summary.billsNeedingApproval}
              subtitle="Bills pending"
              variant="danger"
              href="/supplier-bills?status=Draft"
            />
            <SummaryCard
              title="Unpaid Bills"
              value={summary.unpaidBills}
              subtitle="Awaiting payment"
              variant="success"
              href="/supplier-bills?status=Approved"
            />
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Quick Actions</h2>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <QuickAction key={action.label} {...action} />
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-muted-foreground">Recent Activity</h2>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => router.push("/p2p/activity")}>
              View all
            </Button>
          </div>
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((item, index) => (
                <RecentActivityItem key={`${item.type}-${item.number}-${index}`} {...item} />
              ))}
            </div>
          ) : (
            <MobileCard>
              <MobileCardContent className="py-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground/70">Start by creating a purchase order</p>
              </MobileCardContent>
            </MobileCard>
          )}
        </section>
      </main>
    </div>
  );
}
