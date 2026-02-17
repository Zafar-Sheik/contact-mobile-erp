"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileText,
  Loader2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, SearchBar, MobileList, MobileListItem, EmptyState } from "@/components/mobile";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useApi } from "@/lib/hooks/use-api";
import Link from "next/link";

// Types
interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
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

interface Invoice {
  _id: string;
  invoiceNumber: string;
  clientId: string | Client;
  clientSnapshot: {
    name: string;
  };
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
  totals: {
    subTotalCents: number;
    vatTotalCents: number;
    totalCents: number;
  };
  amountPaidCents: number;
  balanceDueCents: number;
  issueDate: string;
  dueDate: string;
  createdAt: string;
  isOverdue?: boolean;
}

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
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

export default function InvoicesPage() {
  const router = useRouter();

  // API data
  const { data: invoices, loading, error, refetch } = useApi<Invoice[]>("/api/invoices");

  // Local state
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Filter invoices
  const filteredInvoices = React.useMemo(() => {
    if (!invoices) return [];

    return invoices.filter((invoice) => {
      // Search filter
      const clientName = typeof invoice.clientId === "object"
        ? (invoice.clientId as Client)?.name || ""
        : invoice.clientSnapshot?.name || "";
      const matchesSearch =
        invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  // Get client name helper
  const getClientName = (invoice: Invoice): string => {
    if (typeof invoice.clientId === "object") {
      return (invoice.clientId as Client).name;
    }
    return invoice.clientSnapshot?.name || "Unknown Client";
  };

  // Summary stats
  const stats = React.useMemo(() => {
    if (!invoices) return { totalReceivables: 0, overdueAmount: 0, paidThisMonth: 0 };

    const now = new Date();

    let totalReceivables = 0;
    let overdueAmount = 0;

    invoices.forEach((invoice) => {
      if (invoice.status === "cancelled" || invoice.status === "draft") return;

      // Total receivables = sum of all balance due
      totalReceivables += invoice.balanceDueCents || 0;

      // Overdue = invoices past due date that aren't paid
      if (invoice.isOverdue || (invoice.status !== "paid" && new Date(invoice.dueDate) < now)) {
        overdueAmount += invoice.balanceDueCents || 0;
      }
    });

    return {
      totalReceivables,
      overdueAmount,
      paidThisMonth: 0,
    };
  }, [invoices]);

  // Handle status filter change
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
  };

  if (loading) {
    return (
      <MainLayout showTabBar={true} showFab={true} fabProps={{ href: "/invoices/new" }}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showTabBar={true} showFab={true} fabProps={{ href: "/invoices/new", label: "New Invoice" }}>
      <div className="space-y-4 md:space-y-6">
        {/* Page Header - Mobile */}
        <div className="md:hidden">
          <PageHeader
            title="Invoices"
            subtitle="Manage customer invoices"
          />
        </div>

        {/* Search Bar - Mobile */}
        <div className="md:hidden px-4">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search invoices..."
            showFilter={true}
            onFilter={() => {}}
            filterCount={statusFilter !== "all" ? 1 : 0}
          />
        </div>

        {/* Status Filter - Mobile */}
        <div className="md:hidden px-4">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="partially_paid">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards - Desktop Only */}
        {invoices && invoices.length > 0 && (
          <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Receivables</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold lg:text-2xl">{formatCurrency(stats.totalReceivables)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Overdue Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-red-600 lg:text-2xl">{formatCurrency(stats.overdueAmount)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Paid This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600 lg:text-2xl">{formatCurrency(stats.paidThisMonth)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Desktop Header and Filters */}
        <div className="hidden md:block">
          {/* Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Invoices</h1>
              <p className="text-muted-foreground">Manage customer invoices</p>
            </div>
            <Button asChild className="w-full gap-2 lg:w-auto" size="lg">
              <Link href="/invoices/new">
                <Plus className="h-5 w-5" />
                New Invoice
              </Link>
            </Button>
          </div>

          {/* Filters - Desktop */}
          <div className="flex flex-col gap-3 mt-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <input
                type="search"
                placeholder="Search by invoice # or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 px-4 pl-10 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <Select value={statusFilter} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="partially_paid">Partially Paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden px-4">
          {filteredInvoices.length === 0 ? (
            <EmptyState
              iconType="invoices"
              title={searchTerm || statusFilter !== "all" ? "No invoices found" : "No invoices yet"}
              description={searchTerm || statusFilter !== "all" 
                ? "Try adjusting your search or filters" 
                : "Create your first invoice to get started"}
              action={!searchTerm && statusFilter === "all" ? {
                label: "Create Invoice",
                onClick: () => router.push("/invoices/new")
              } : undefined}
            />
          ) : (
            <MobileList>
              {filteredInvoices.map((invoice) => (
                <MobileListItem
                  key={invoice._id}
                  title={invoice.invoiceNumber}
                  subtitle={getClientName(invoice)}
                  description={`Due: ${formatDate(invoice.dueDate)} • ${formatCurrency(invoice.balanceDueCents || 0)}`}
                  status={{
                    label: invoice.status === "partially_paid" ? "Partial" : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1).replace("_", " "),
                    variant: invoice.status === "paid" ? "success" : 
                           invoice.status === "overdue" ? "destructive" : 
                           invoice.status === "issued" ? "info" : 
                           invoice.status === "partially_paid" ? "warning" : "default"
                  }}
                  onClick={() => router.push(`/invoices/${invoice._id}`)}
                />
              ))}
            </MobileList>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="h-8 w-8 mb-2" />
                      <p>No invoices found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow
                    key={invoice._id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/invoices/${invoice._id}`)}
                  >
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{getClientName(invoice)}</TableCell>
                    <TableCell>
                      <StatusBadge status={invoice.status} />
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.totals?.totalCents || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.amountPaidCents || 0)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(invoice.balanceDueCents || 0)}</TableCell>
                    <TableCell>
                      <span className={invoice.isOverdue ? "text-red-600 font-medium" : ""}>
                        {formatDate(invoice.dueDate)}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}
