"use client";

import * as React from "react";
import {
  Search,
  FileText,
  MoreHorizontal,
  Receipt,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/hooks/use-api";
import { MobileMoreMenu, useMobileMoreMenu } from "@/components/mobile/mobile-more-menu";

// Types
interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
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
    issued: { bg: "bg-blue-100", text: "text-blue-700", label: "Issued" },
    partially_paid: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Partially Paid" },
    paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
    overdue: { bg: "bg-red-100", text: "text-red-700", label: "Overdue" },
    cancelled: { bg: "bg-gray-100", text: "text-gray-700", label: "Cancelled" },
  };
  return colors[status] || colors.draft;
};

export default function InvoicesPage() {
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API hooks
  const { data: invoices, loading, error } = useApi<Invoice[]>("/api/invoices");

  // State
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filter invoices
  const filteredInvoices = React.useMemo(() => {
    if (!invoices) return [];
    return invoices.filter((invoice) => {
      const clientName = typeof invoice.clientId === "object" ? invoice.clientId.name : invoice.clientSnapshot?.name || "";
      const matchesSearch =
        !searchTerm ||
        invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [invoices, searchTerm]);

  // Stats
  const stats = React.useMemo(() => {
    if (!invoices) return { total: 0, draft: 0, issued: 0, paid: 0, overdue: 0, totalOutstanding: 0 };
    return {
      total: invoices.length,
      draft: invoices.filter((i) => i.status === "draft").length,
      issued: invoices.filter((i) => i.status === "issued").length,
      paid: invoices.filter((i) => i.status === "paid").length,
      overdue: invoices.filter((i) => i.status === "overdue").length,
      totalOutstanding: invoices.reduce((sum, i) => sum + (i.balanceDueCents || 0), 0),
    };
  }, [invoices]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
          <Button size="icon" variant="ghost" onClick={openMore} className="h-10 w-10">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoices..."
            className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && !error && invoices && invoices.length > 0 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-xs text-gray-500">Draft</p>
              <p className="text-lg font-bold text-gray-700">{stats.draft}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-2 text-center">
              <p className="text-xs text-red-600">Overdue</p>
              <p className="text-lg font-bold text-red-700">{stats.overdue}</p>
            </div>
          </div>
          <div className="mt-2 bg-blue-50 rounded-xl p-2 text-center">
            <p className="text-xs text-blue-600">Outstanding</p>
            <p className="text-lg font-bold text-blue-700">{formatCurrency(stats.totalOutstanding)}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="p-4 pb-24">
        {/* Loading State */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-red-600 font-medium">Error loading invoices</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredInvoices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <Receipt className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No invoices found" : "No invoices yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? "Try a different search term" : "Create your first invoice to get started"}
            </p>
          </div>
        )}

        {/* Invoices List */}
        {!loading && !error && filteredInvoices.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredInvoices.map((invoice) => {
              const statusColors = getStatusColors(invoice.status);
              return (
                <Link
                  key={invoice._id}
                  href={`/invoices/${invoice._id}`}
                  className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-full">
                        <FileText className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{invoice.invoiceNumber}</h3>
                        <p className="text-sm text-gray-500">
                          {invoice.clientSnapshot?.name || "Unknown Client"}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${statusColors.bg} ${statusColors.text} ml-2 shrink-0`}>
                      {statusColors.label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pl-12">
                    <span className="text-sm text-gray-500">
                      Due {formatDate(invoice.dueDate)}
                    </span>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(invoice.totals?.totalCents || 0)}
                      </p>
                      {invoice.balanceDueCents > 0 && invoice.balanceDueCents < (invoice.totals?.totalCents || 0) && (
                        <p className="text-xs text-gray-500">
                          Balance: {formatCurrency(invoice.balanceDueCents)}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Add Button */}
      <div className="fixed bottom-20 right-4 z-20">
        <Link
          href="/invoices/new"
          className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
        >
          <span className="text-2xl text-white font-bold">+</span>
        </Link>
      </div>

      {/* Bottom More Menu Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 pb-safe z-20">
        <button
          onClick={openMore}
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-xl transition-colors"
        >
          <MoreHorizontal className="w-6 h-6 text-gray-700" />
          <span className="text-base font-medium text-gray-700">More</span>
        </button>
      </div>

      {/* Mobile More Menu */}
      <MobileMoreMenu open={isMoreOpen} onClose={closeMore} />
    </div>
  );
}
