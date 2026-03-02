"use client";

import * as React from "react";
import { Search, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface StockItemSelectorItem {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  unit: string;
  pricing?: {
    costPriceCents: number;
    salePriceCents: number;
  };
}

interface StockItemSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: StockItemSelectorItem) => void;
  activeLineIndex?: number;
}

export function StockItemSelector({
  open,
  onOpenChange,
  onSelect,
}: StockItemSelectorProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [items, setItems] = React.useState<StockItemSelectorItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // In-memory cache for search results (session-scoped)
  const cacheRef = React.useRef<Map<string, StockItemSelectorItem[]>>(new Map());

  // Check if we're searching or showing recent
  const isSearching = searchQuery.trim().length > 0;
  const showMinCharsHint = isSearching && searchQuery.trim().length < 2;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch items when modal opens or query changes
  React.useEffect(() => {
    if (!open) return;

    // Check cache first
    const cacheKey = debouncedQuery || "__recent__";
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setItems(cached);
      setIsLoading(false);
      return;
    }

    const fetchItems = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (debouncedQuery) {
          params.set("q", debouncedQuery);
        }
        params.set("limit", "20");

        const response = await fetch(`/api/stock-items/search?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch items");
        }

        const data = await response.json();
        const fetchedItems = data.items || [];
        
        // Cache the results
        cacheRef.current.set(cacheKey, fetchedItems);
        setItems(fetchedItems);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [open, debouncedQuery]);

  // Focus search input when modal opens
  React.useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setItems([]);
      setError(null);
    }
  }, [open]);

  const handleSelect = (item: StockItemSelectorItem) => {
    // Close modal instantly without waiting for any network
    onOpenChange(false);
    onSelect(item);
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(cents);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Stock Item</DialogTitle>
          <DialogDescription>
            Search for an item to add to this line
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-11"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 min-h-0">
          {showMinCharsHint ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Search className="h-12 w-12 text-gray-300 mb-2" />
              <div className="text-sm text-gray-500">
                Type at least 2 characters to search
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-gray-500">Loading...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-sm text-red-500">{error}</div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-gray-300 mb-2" />
              <div className="text-sm text-gray-500">
                {debouncedQuery
                  ? "No items found"
                  : "No stock items available"}
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {isSearching ? "Search results" : "Recently used"}
                </div>
                {items.map((item) => (
                  <button
                    key={item._id}
                    onClick={() => handleSelect(item)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {item.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          SKU: {item.sku} • Unit: {item.unit}
                        </div>
                      </div>
                      {item.pricing?.salePriceCents ? (
                        <div className="text-sm font-medium text-green-600 ml-2">
                          {formatPrice(item.pricing.salePriceCents)}
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simplified trigger button component for use in forms
interface StockItemSelectorTriggerProps {
  onClick: () => void;
  hasSelection: boolean;
  itemName?: string;
  itemSku?: string;
  itemUnit?: string;
  className?: string;
}

export function StockItemSelectorTrigger({
  onClick,
  hasSelection,
  itemName,
  itemSku,
  itemUnit,
  className,
}: StockItemSelectorTriggerProps) {
  if (hasSelection) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center justify-between w-full h-11 px-3 py-2 rounded-md border bg-gray-50 text-left",
          className
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {itemName}
          </div>
          <div className="text-xs text-gray-500">
            {itemSku} • {itemUnit}
          </div>
        </div>
        <span className="text-sm text-blue-600 font-medium ml-2">Change</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center w-full h-11 rounded-md border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:bg-gray-50",
        className
      )}
    >
      <Package className="h-4 w-4 mr-2" />
      Select item
    </button>
  );
}
