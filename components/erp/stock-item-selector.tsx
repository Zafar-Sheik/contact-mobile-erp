"use client";

import * as React from "react";
import { Search, Package, X, Plus, ScanBarcode, ChevronDown, ChevronUp } from "lucide-react";
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

export type StockItemSelectorMode = "invoice" | "quote" | "purchase";

export interface StockItemSelectorItem {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  unit: string;
  category?: string;
  pricing?: {
    costPriceCents: number;
    salePriceCents: number;
  };
}

export interface Category {
  _id: string;
  name: string;
}

interface StockItemSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: StockItemSelectorItem, priceCents: number) => void;
  onCreateNew?: () => void;
  activeLineIndex?: number;
  mode?: StockItemSelectorMode;
}

// Hook for barcode scanner - placeholder for future implementation
export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const [isScanning, setIsScanning] = React.useState(false);

  const startScanning = React.useCallback(() => {
    // Placeholder: In a real implementation, this would use a barcode scanning library
    // like @aspect/barcode-scanner or html5-qrcode
    setIsScanning(true);
    console.log("Barcode scanning started - placeholder");
    // Simulate a scan after 2 seconds
    setTimeout(() => {
      setIsScanning(false);
    }, 2000);
  }, []);

  const stopScanning = React.useCallback(() => {
    setIsScanning(false);
  }, []);

  return { isScanning, startScanning, stopScanning };
}

// Highlight matched text component
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) {
    return <>{text}</>;
  }

  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

// Virtual list component for performance with large datasets
function VirtualList<T>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  overscan = 5,
}: {
  items: T[];
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    if (items[i]) {
      visibleItems.push(
        <div
          key={i}
          style={{
            position: "absolute",
            top: i * itemHeight,
            left: 0,
            right: 0,
            height: itemHeight,
          }}
        >
          {renderItem(items[i], i, { height: itemHeight })}
        </div>
      );
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: containerHeight, overflow: "auto", position: "relative" }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems}
      </div>
    </div>
  );
}

export function StockItemSelector({
  open,
  onOpenChange,
  onSelect,
  onCreateNew,
  mode = "invoice",
}: StockItemSelectorProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [items, setItems] = React.useState<StockItemSelectorItem[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Barcode scanner hook
  const { isScanning: isBarcodeScanning, startScanning: startBarcodeScan } = useBarcodeScanner(
    (barcode) => {
      setSearchQuery(barcode);
      setDebouncedQuery(barcode);
    }
  );

  // Determine default price based on mode
  const getDefaultPrice = (item: StockItemSelectorItem): number => {
    if (mode === "purchase") {
      return item.pricing?.costPriceCents || 0;
    }
    return item.pricing?.salePriceCents || 0;
  };

  // Get price label based on mode
  const getPriceLabel = (): string => {
    return mode === "purchase" ? "Cost" : "Price";
  };

  // Get dialog title based on mode
  const getDialogTitle = (): string => {
    return mode === "purchase" ? "Select Stock Item for Purchase" : "Select Stock Item";
  };

  // In-memory cache for search results
  const cacheRef = React.useRef<Map<string, StockItemSelectorItem[]>>(new Map());

  // Check if we're searching or showing recent
  const isSearching = searchQuery.trim().length > 0;
  const showMinCharsHint = isSearching && searchQuery.trim().length < 2;

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch categories on mount
  React.useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/categories");
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (err) {
        // Categories are optional, fail silently
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCategories();
  }, []);

  // Filter items by category
  const filteredItems = React.useMemo(() => {
    if (!selectedCategory) return items;
    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  // Reset focused index when filtered items change
  React.useEffect(() => {
    setFocusedIndex(-1);
  }, [filteredItems.length]);

  // Fetch items when modal opens or query changes
  React.useEffect(() => {
    if (!open) return;

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check cache first
    const cacheKey = `${mode}:${debouncedQuery || "__recent__"}`;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setItems(cached);
      setIsLoading(false);
      return;
    }

    const fetchItems = async () => {
      abortControllerRef.current = new AbortController();
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (debouncedQuery) {
          params.set("q", debouncedQuery);
        }
        params.set("limit", "50");
        params.set("mode", mode);

        const response = await fetch(`/api/stock-items/search?${params.toString()}`, {
          signal: abortControllerRef.current.signal,
        });

        if (response.status === 0) return;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to fetch items");
        }

        const data = await response.json();
        const fetchedItems = data.items || [];

        cacheRef.current.set(cacheKey, fetchedItems);
        setItems(fetchedItems);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "An error occurred");
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [open, debouncedQuery, mode]);

  // Focus search input when modal opens
  React.useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setItems([]);
      setError(null);
      setSelectedCategory(null);
      setFocusedIndex(-1);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && focusedIndex >= 0 && filteredItems[focusedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[focusedIndex]);
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  const handleSelect = (item: StockItemSelectorItem) => {
    const defaultPrice = getDefaultPrice(item);
    onOpenChange(false);
    onSelect(item, defaultPrice);
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(cents / 100);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategory((prev) => (prev === categoryId ? null : categoryId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-lg">{getDialogTitle()}</DialogTitle>
          <DialogDescription className="text-sm">
            {mode === "purchase"
              ? "Select an item to add to this purchase order. Cost price will be used."
              : "Search for an item to add to this line"}
          </DialogDescription>
        </DialogHeader>

        {/* Search Input */}
        <div className="px-4 pb-2">
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={searchInputRef}
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 h-11 pr-9"
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
            {/* Barcode scan button */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={startBarcodeScan}
              title="Scan barcode"
            >
              <ScanBarcode className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Category Filters */}
        {categories.length > 0 && (
          <div className="px-4 pb-2">
            <ScrollArea className="h-10 whitespace-nowrap">
              <div className="flex gap-2">
                {categories.slice(0, 5).map((category) => (
                  <Button
                    key={category._id}
                    variant={selectedCategory === category._id ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => toggleCategory(category._id)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Create New Button */}
        {onCreateNew && (
          <div className="px-4 pb-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={() => {
                onOpenChange(false);
                onCreateNew();
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Stock Item
            </Button>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 min-h-0 px-4 pb-4">
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
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="text-sm text-red-500 mb-2">{error}</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDebouncedQuery(searchQuery)}
              >
                Retry
              </Button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Package className="h-12 w-12 text-gray-300 mb-2" />
              <div className="text-sm text-gray-500">
                {debouncedQuery ? "No items found" : "No stock items available"}
              </div>
            </div>
          ) : (
            <div className="h-[300px]">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                {isSearching
                  ? `Search results (${filteredItems.length})`
                  : mode === "purchase"
                    ? "Recently purchased"
                    : "Recently used"}
              </div>
              {/* Virtualized list */}
              <ScrollArea className="h-[270px] -mx-4 px-4">
                <VirtualList
                  items={filteredItems}
                  itemHeight={72}
                  containerHeight={270}
                  overscan={3}
                  renderItem={(item, index, style) => (
                    <button
                      ref={(el) => {
                        if (el && index === focusedIndex) {
                          el.scrollIntoView({ block: "nearest" });
                        }
                      }}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-colors",
                        focusedIndex === index
                          ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200"
                          : "hover:bg-gray-50 hover:border-gray-300"
                      )}
                      style={style}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            <HighlightedText text={item.name} query={debouncedQuery} />
                          </div>
                          <div className="text-sm text-gray-500">
                            <HighlightedText text={item.sku} query={debouncedQuery} />
                            {" • "}
                            {item.unit}
                            {item.category && ` • ${item.category}`}
                          </div>
                        </div>
                        {((mode === "purchase" && item.pricing?.costPriceCents) ||
                        (mode !== "purchase" && item.pricing?.salePriceCents)) ? (
                          <div className="text-sm font-medium ml-2">
                            <span className="text-gray-500 text-xs block">{getPriceLabel()}</span>
                            <span className={mode === "purchase" ? "text-orange-600" : "text-green-600"}>
                              {formatPrice(
                                mode === "purchase"
                                  ? item.pricing?.costPriceCents || 0
                                  : item.pricing?.salePriceCents || 0
                              )}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </button>
                  )}
                />
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Keyboard hints */}
        <div className="px-4 pb-3 pt-2 border-t text-xs text-gray-400 flex justify-center gap-4">
          <span>↑↓ Navigate</span>
          <span>Enter Select</span>
          <span>Esc Close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simplified trigger button component
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
  if (hasSelection && itemName) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        className={cn("justify-between h-auto py-2 px-3", className)}
      >
        <div className="flex flex-col items-start">
          <span className="font-medium text-gray-900">{itemName}</span>
          <span className="text-xs text-gray-500">
            {itemSku} • {itemUnit}
          </span>
        </div>
        <span className="text-blue-600 text-sm ml-2">Change</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn("justify-center", className)}
    >
      <Package className="h-4 w-4 mr-2" />
      Select item
    </Button>
  );
}
