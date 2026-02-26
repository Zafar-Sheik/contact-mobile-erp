"use client";

import * as React from "react";
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  MoreHorizontal,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/hooks/use-api";
import { MobileMoreMenu, useMobileMoreMenu } from "@/components/mobile/mobile-more-menu";

// Types
interface StockItem {
  _id: string;
  name: string;
  sku: string;
  unit: string;
}

interface InventoryMovement {
  _id: string;
  stockItemId: StockItem | string;
  locationId: string;
  locationName: string;
  sourceType: string;
  sourceId: string;
  movementType: "IN" | "OUT";
  quantity: number;
  unitCostCents: number;
  createdAt: string;
}

const sourceTypeLabels: Record<string, string> = {
  GRV: "Goods Received",
  SALE: "Sale",
  ADJUSTMENT: "Adjustment",
  TRANSFER: "Transfer",
  RETURN: "Customer Return",
  CANCEL_GRV: "GRV Cancellation",
};

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
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Get item name helper
const getItemName = (item: StockItem | string): string => {
  if (!item) return "Unknown";
  return typeof item === "string" ? item : item.name;
};

export default function InventoryMovementsPage() {
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API hooks
  const { data: movements, loading, error, refetch } = useApi<InventoryMovement[]>("/api/inventory-movements");

  // State
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filter movements
  const filteredMovements = React.useMemo(() => {
    if (!movements) return [];
    return movements.filter((movement) => {
      const itemName = getItemName(movement.stockItemId).toLowerCase();
      return (
        !searchTerm ||
        itemName.includes(searchTerm.toLowerCase()) ||
        movement.sourceType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [movements, searchTerm]);

  // Stats
  const totals = React.useMemo(() => {
    if (!movements) return { totalIn: 0, totalOut: 0 };
    return {
      totalIn: movements
        .filter((m) => m.movementType === "IN")
        .reduce((sum, m) => sum + m.quantity, 0),
      totalOut: movements
        .filter((m) => m.movementType === "OUT")
        .reduce((sum, m) => sum + m.quantity, 0),
    };
  }, [movements]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Inventory Movements</h1>
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
            placeholder="Search movements..."
            className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && !error && movements && movements.length > 0 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xs text-green-600 font-medium">Stock In</p>
              <p className="text-lg font-bold text-green-700">+{totals.totalIn}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-xs text-red-600 font-medium">Stock Out</p>
              <p className="text-lg font-bold text-red-700">-{totals.totalOut}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Net</p>
              <p className="text-lg font-bold text-blue-700">{totals.totalIn - totals.totalOut}</p>
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
            <p className="text-red-600 font-medium">Error loading movements</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredMovements.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <Activity className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No movements found" : "No inventory movements yet"}
            </h3>
            <p className="text-gray-500 text-sm">
              {searchTerm ? "Try a different search term" : "Movements will appear here when stock is received or sold"}
            </p>
          </div>
        )}

        {/* Movements List */}
        {!loading && !error && filteredMovements.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredMovements.map((movement) => (
              <div
                key={movement._id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {movement.movementType === "IN" ? (
                      <div className="bg-green-100 p-2 rounded-full">
                        <ArrowUpRight className="h-4 w-4 text-green-600" />
                      </div>
                    ) : (
                      <div className="bg-red-100 p-2 rounded-full">
                        <ArrowDownRight className="h-4 w-4 text-red-600" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {getItemName(movement.stockItemId)}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {sourceTypeLabels[movement.sourceType] || movement.sourceType}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={movement.movementType === "IN" ? "success" : "destructive"}
                    className="ml-2 shrink-0"
                  >
                    {movement.movementType === "IN" ? "+" : "-"}{movement.quantity}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{formatDate(movement.createdAt)}</span>
                  <span className="text-gray-600">
                    {formatCurrency(movement.unitCostCents * movement.quantity)}
                  </span>
                </div>
              </div>
            ))}
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
