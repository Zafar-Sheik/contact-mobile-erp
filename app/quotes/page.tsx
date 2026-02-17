"use client";

import * as React from "react";
import {
  Plus,
  FileText,
  Loader2,
  Calendar,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
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
}

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    expired: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  };

  const labels: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    accepted: "Accepted",
    rejected: "Rejected",
    expired: "Expired",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || colors.draft}`}>
      {labels[status] || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

export default function QuotesPage() {
  const router = useRouter();

  // API data
  const { data: quotes, loading, error, refetch } = useApi<Quote[]>("/api/quotes");

  // Local state
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  // Filtered quotes
  const filteredQuotes = React.useMemo(() => {
    if (!quotes) return [];

    return quotes.filter((quote) => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        quote.quoteNumber.toLowerCase().includes(searchLower) ||
        (typeof quote.clientId === "object"
          ? quote.clientId.name?.toLowerCase().includes(searchLower)
          : quote.clientSnapshot.name.toLowerCase().includes(searchLower)
        );

      // Status filter
      const matchesStatus = statusFilter === "all" || quote.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [quotes, searchTerm, statusFilter]);

  // Get client name helper
  const getClientName = (quote: Quote): string => {
    if (typeof quote.clientId === "object") {
      return (quote.clientId as Client).name;
    }
    return quote.clientSnapshot?.name || "Unknown Client";
  };

  // Summary stats
  const stats = React.useMemo(() => {
    if (!quotes) return { total: 0, draft: 0, sent: 0, accepted: 0, totalValue: 0 };

    return {
      total: quotes.length,
      draft: quotes.filter((q) => q.status === "draft").length,
      sent: quotes.filter((q) => q.status === "sent").length,
      accepted: quotes.filter((q) => q.status === "accepted").length,
      totalValue: quotes.reduce((sum, q) => sum + (q.totals?.totalCents || 0), 0),
    };
  }, [quotes]);

  // Handle status filter change
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
  };

  if (loading) {
    return (
      <MainLayout showTabBar={true} showFab={true} fabProps={{ href: "/quotes/new" }}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showTabBar={true} showFab={true} fabProps={{ href: "/quotes/new", label: "New Quote" }}>
      <div className="space-y-4 md:space-y-6">
        {/* Page Header - Mobile */}
        <div className="md:hidden">
          <PageHeader
            title="Quotes"
            subtitle="Manage sales quotations"
          />
        </div>

        {/* Search Bar - Mobile */}
        <div className="md:hidden px-4">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search quotes..."
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
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Cards - Desktop Only */}
        {quotes && quotes.length > 0 && (
          <div className="hidden md:block grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Quotes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold lg:text-2xl">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Draft</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-gray-600 lg:text-2xl">{stats.draft}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-blue-600 lg:text-2xl">{stats.sent}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Accepted</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600 lg:text-2xl">{stats.accepted}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold lg:text-2xl">{formatCurrency(stats.totalValue)}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Desktop Header and Filters */}
        <div className="hidden md:block">
          {/* Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Quotes</h1>
              <p className="text-muted-foreground">Manage sales quotations</p>
            </div>
            <Button asChild className="w-full gap-2 lg:w-auto" size="lg">
              <Link href="/quotes/new">
                <Plus className="h-5 w-5" />New Quote
              </Link>
            </Button>
          </div>

          {/* Filters - Desktop */}
          <div className="flex flex-col gap-3 mt-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <input
                type="search"
                placeholder="Search by quote # or client..."
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
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden px-4">
          {filteredQuotes.length === 0 ? (
            <EmptyState
              iconType="invoices"
              title={searchTerm || statusFilter !== "all" ? "No quotes found" : "No quotes yet"}
              description={searchTerm || statusFilter !== "all" 
                ? "Try adjusting your search or filters" 
                : "Create your first quote to get started"}
              action={!searchTerm && statusFilter === "all" ? {
                label: "Create Quote",
                onClick: () => router.push("/quotes/new")
              } : undefined}
            />
          ) : (
            <MobileList>
              {filteredQuotes.map((quote) => (
                <MobileListItem
                  key={quote._id}
                  title={quote.quoteNumber}
                  subtitle={getClientName(quote)}
                  description={`${formatDate(quote.createdAt)} • ${formatCurrency(quote.totals?.totalCents || 0)}`}
                  status={{
                    label: quote.status.charAt(0).toUpperCase() + quote.status.slice(1),
                    variant: quote.status === "accepted" ? "success" : 
                           quote.status === "rejected" ? "destructive" : 
                           quote.status === "sent" ? "info" : "default"
                  }}
                  onClick={() => router.push(`/quotes/${quote._id}`)}
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
                <TableHead>Quote #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <FileText className="h-8 w-8 mb-2" />
                      <p>No quotes found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuotes.map((quote) => (
                  <TableRow
                    key={quote._id}
                    className="cursor-pointer hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">
                      <Link href={`/quotes/${quote._id}`} className="hover:underline">
                        {quote.quoteNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {typeof quote.clientId === "object"
                        ? quote.clientId.name
                        : quote.clientSnapshot.name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={quote.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(quote.totals?.totalCents || 0)}
                    </TableCell>
                    <TableCell>
                      {quote.validUntil ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(quote.validUntil)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(quote.createdAt)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/quotes/${quote._id}`}>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </Button>
                    </TableCell>
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
