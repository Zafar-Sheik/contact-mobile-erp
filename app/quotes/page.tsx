"use client";

import * as React from "react";
import {
  Search,
  FileText,
  MoreHorizontal,
  ClipboardList,
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
  totals: {
    subTotalCents: number;
    vatTotalCents: number;
    totalCents: number;
  };
  validUntil: string | null;
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
    sent: { bg: "bg-blue-100", text: "text-blue-700", label: "Sent" },
    accepted: { bg: "bg-green-100", text: "text-green-700", label: "Accepted" },
    rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" },
    expired: { bg: "bg-orange-100", text: "text-orange-700", label: "Expired" },
  };
  return colors[status] || colors.draft;
};

export default function QuotesPage() {
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API hooks
  const { data: quotes, loading, error } = useApi<Quote[]>("/api/quotes");

  // State
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filter quotes
  const filteredQuotes = React.useMemo(() => {
    if (!quotes) return [];
    return quotes.filter((quote) => {
      const clientName = typeof quote.clientId === "object" ? quote.clientId.name : quote.clientSnapshot?.name || "";
      const matchesSearch =
        !searchTerm ||
        quote.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        clientName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [quotes, searchTerm]);

  // Stats
  const stats = React.useMemo(() => {
    if (!quotes) return { total: 0, draft: 0, sent: 0, accepted: 0 };
    return {
      total: quotes.length,
      draft: quotes.filter((q) => q.status === "draft").length,
      sent: quotes.filter((q) => q.status === "sent").length,
      accepted: quotes.filter((q) => q.status === "accepted").length,
    };
  }, [quotes]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Quotes</h1>
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
            placeholder="Search quotes..."
            className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && !error && quotes && quotes.length > 0 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
            <div className="bg-gray-50 rounded-xl p-2 text-center">
              <p className="text-xs text-gray-500">Draft</p>
              <p className="text-lg font-bold text-gray-700">{stats.draft}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-2 text-center">
              <p className="text-xs text-blue-600">Sent</p>
              <p className="text-lg font-bold text-blue-700">{stats.sent}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-2 text-center">
              <p className="text-xs text-green-600">Accepted</p>
              <p className="text-lg font-bold text-green-700">{stats.accepted}</p>
            </div>
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
            <p className="text-red-600 font-medium">Error loading quotes</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredQuotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <ClipboardList className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No quotes found" : "No quotes yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? "Try a different search term" : "Create your first quote to get started"}
            </p>
          </div>
        )}

        {/* Quotes List */}
        {!loading && !error && filteredQuotes.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredQuotes.map((quote) => {
              const statusColors = getStatusColors(quote.status);
              return (
                <Link
                  key={quote._id}
                  href={`/quotes/${quote._id}`}
                  className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-2 rounded-full">
                        <FileText className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{quote.quoteNumber}</h3>
                        <p className="text-sm text-gray-500">
                          {quote.clientSnapshot?.name || "Unknown Client"}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${statusColors.bg} ${statusColors.text} ml-2 shrink-0`}>
                      {statusColors.label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pl-12">
                    <span className="text-sm text-gray-500">
                      {quote.validUntil ? `Valid until ${formatDate(quote.validUntil)}` : formatDate(quote.createdAt)}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(quote.totals?.totalCents || 0)}
                    </span>
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
          href="/quotes/new"
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
