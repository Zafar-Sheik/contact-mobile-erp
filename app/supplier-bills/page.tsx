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
interface Supplier {
  _id: string;
  name: string;
}

interface SupplierBill {
  _id: string;
  billNumber: string;
  supplierId: string | Supplier;
  status: "Draft" | "Posted" | "PartiallyPaid" | "Paid" | "Voided";
  totalCents: number;
  paidCents: number;
  billDate: string;
  dueDate?: string;
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
    Draft: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Draft" },
    Posted: { bg: "bg-blue-100", text: "text-blue-700", label: "Posted" },
    PartiallyPaid: { bg: "bg-orange-100", text: "text-orange-700", label: "Partially Paid" },
    Paid: { bg: "bg-green-100", text: "text-green-700", label: "Paid" },
    Voided: { bg: "bg-red-100", text: "text-red-700", label: "Voided" },
  };
  return colors[status] || colors.Draft;
};

export default function SupplierBillsPage() {
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API hooks
  const { data: bills, loading, error } = useApi<SupplierBill[]>("/api/supplier-bills");

  // State
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filter bills
  const filteredBills = React.useMemo(() => {
    if (!bills) return [];
    return bills.filter((bill) => {
      const supplierName = typeof bill.supplierId === "object" ? bill.supplierId.name : "";
      const matchesSearch =
        !searchTerm ||
        bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [bills, searchTerm]);

  // Stats
  const stats = React.useMemo(() => {
    if (!bills) return { total: 0, draft: 0, posted: 0, paid: 0, outstanding: 0 };
    return {
      total: bills.length,
      draft: bills.filter((b) => b.status === "Draft").length,
      posted: bills.filter((b) => b.status === "Posted").length,
      paid: bills.filter((b) => b.status === "Paid").length,
      outstanding: bills.reduce((sum, b) => sum + (b.totalCents - b.paidCents), 0),
    };
  }, [bills]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Supplier Bills</h1>
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
            placeholder="Search bills..."
            className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && !error && bills && bills.length > 0 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-xs text-gray-500">Draft</p>
              <p className="text-lg font-bold text-gray-700">{stats.draft}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2 text-center">
              <p className="text-xs text-green-600">Paid</p>
              <p className="text-lg font-bold text-green-700">{stats.paid}</p>
            </div>
          </div>
          <div className="mt-2 bg-red-50 rounded-xl p-2 text-center">
            <p className="text-xs text-red-600">Outstanding</p>
            <p className="text-lg font-bold text-red-700">{formatCurrency(stats.outstanding)}</p>
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
            <p className="text-red-600 font-medium">Error loading bills</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredBills.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <Receipt className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No bills found" : "No supplier bills yet"}
            </h3>
            <p className="text-gray-500 text-sm">
              {searchTerm ? "Try a different search term" : "Bills will appear here when created from GRVs"}
            </p>
          </div>
        )}

        {/* Bills List */}
        {!loading && !error && filteredBills.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredBills.map((bill) => {
              const statusColors = getStatusColors(bill.status);
              const supplierName = typeof bill.supplierId === "object" ? bill.supplierId.name : "Unknown Supplier";
              const balanceDue = bill.totalCents - bill.paidCents;
              
              return (
                <Link
                  key={bill._id}
                  href={`/supplier-bills/${bill._id}`}
                  className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-amber-100 p-2 rounded-full">
                        <FileText className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{bill.billNumber}</h3>
                        <p className="text-sm text-gray-500">{supplierName}</p>
                      </div>
                    </div>
                    <Badge className={`${statusColors.bg} ${statusColors.text} ml-2 shrink-0`}>
                      {statusColors.label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pl-12">
                    <span className="text-sm text-gray-500">
                      {formatDate(bill.billDate)}
                    </span>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {formatCurrency(bill.totalCents)}
                      </p>
                      {balanceDue > 0 && balanceDue < bill.totalCents && (
                        <p className="text-xs text-gray-500">
                          Due: {formatCurrency(balanceDue)}
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
