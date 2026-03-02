"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  MoreHorizontal,
  PackageX,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiCreate, apiUpdate, apiDelete } from "@/lib/hooks/use-api";
import { MobileMoreMenu, useMobileMoreMenu } from "@/components/mobile/mobile-more-menu";

// StockItem type matching the model (response from API)
interface StockItem {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  siteId?: { _id: string; name: string } | string;
  inventory: {
    onHand: number;
    reorderLevel: number;
    reorderQuantity?: number;
    location?: string;
    binNumber?: string;
  };
  pricing: {
    salePriceCents: number;
    costPriceCents: number;
    markupPercent?: number;
  };
  supplierId?: { _id: string; name: string } | string;
  unit: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface StockItemsResponse {
  items: StockItem[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

interface StockItemFormData {
  sku: string;
  name: string;
  description: string;
  onHand: string;
  reorderLevel: string;
  salePriceCents: string;
  costPriceCents: string;
  unit: string;
  isActive: boolean;
}

const initialFormData: StockItemFormData = {
  sku: "",
  name: "",
  description: "",
  onHand: "0",
  reorderLevel: "0",
  salePriceCents: "0",
  costPriceCents: "0",
  unit: "each",
  isActive: true,
};

const units = ["each", "kg", "liter", "meter", "box", "pack", "roll", "pair", "set"];

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
};

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Highlight matched text component
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim() || query.trim().length < 2) {
    return <>{text}</>;
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5 font-semibold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

// Hook to detect when element is in viewport (for infinite scroll)
function useInView(options?: IntersectionObserverInit) {
  const [isInView, setIsInView] = React.useState(false);
  const elementRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return { elementRef, isInView };
}

export default function StockItemsPage() {
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // Infinite scroll state
  const [items, setItems] = React.useState<StockItem[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [totalCount, setTotalCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [error, setError] = React.useState<Error | null>(null);

  // Refs for abort controller and tracking loading state
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const isFetchingRef = React.useRef(false);

  // Debounce search query
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Form/dialog state
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<StockItem | null>(null);
  const [formData, setFormData] = React.useState<StockItemFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Infinite scroll trigger - detect when near bottom
  const { elementRef: loadMoreRef, isInView } = useInView({
    threshold: 0.1,
    rootMargin: "100px",
  });

  // Fetch items with infinite scroll
  const fetchItems = React.useCallback(
    async (currentPage: number, search?: string, isAppend: boolean = false) => {
      // Prevent duplicate requests
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setIsSearching(!!search?.trim());
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("limit", "100");
        if (search?.trim()) {
          params.set("q", search.trim());
        }
        params.set("sortBy", "name");
        params.set("sortOrder", "asc");

        const response = await fetch(`/api/stock-items?${params.toString()}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch stock items");
        }

        const data: StockItemsResponse = await response.json();

        if (isAppend) {
          // Append new items to existing list
          setItems((prev) => {
            // Prevent duplicate items
            const existingIds = new Set(prev.map((item) => item._id));
            const newItems = data.items.filter((item) => !existingIds.has(item._id));
            return [...prev, ...newItems];
          });
        } else {
          // Reset items (new search or initial load)
          setItems(data.items);
        }

        setPage(data.currentPage);
        setTotalCount(data.totalCount);
        setHasMore(data.currentPage < data.totalPages);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err : new Error("An error occurred"));
      } finally {
        setLoading(false);
        setIsSearching(false);
        isFetchingRef.current = false;
      }
    },
    []
  );

  // Cleanup abort controller on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Initial load
  React.useEffect(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    fetchItems(1, "", false);
  }, [fetchItems]);

  // Handle search changes - reset list and search
  React.useEffect(() => {
    const shouldSearch = debouncedSearch === "" || debouncedSearch.trim().length >= 2;

    if (shouldSearch) {
      setItems([]);
      setPage(1);
      setHasMore(true);
      fetchItems(1, debouncedSearch, false);
    }
  }, [debouncedSearch, fetchItems]);

  // Infinite scroll - load more when near bottom
  React.useEffect(() => {
    if (isInView && hasMore && !loading && !isFetchingRef.current) {
      const nextPage = page + 1;
      fetchItems(nextPage, debouncedSearch, true);
    }
  }, [isInView, hasMore, loading, page, debouncedSearch, fetchItems]);

  // Get status info
  const getStatusInfo = (
    item: StockItem
  ): { label: string; variant: "success" | "warning" | "destructive" } => {
    const qty = item.inventory?.onHand ?? 0;
    const reorderLevel = item.inventory?.reorderLevel ?? 0;

    if (qty === 0) {
      return { label: "Out of Stock", variant: "destructive" };
    }
    if (qty <= reorderLevel) {
      return { label: "Low Stock", variant: "warning" };
    }
    return { label: "In Stock", variant: "success" };
  };

  const handleOpenDialog = (item?: StockItem) => {
    if (item) {
      setSelectedItem(item);
      setFormData({
        sku: item.sku || "",
        name: item.name || "",
        description: item.description || "",
        onHand: String(item.inventory?.onHand ?? 0),
        reorderLevel: String(item.inventory?.reorderLevel ?? 0),
        salePriceCents: String((item.pricing?.salePriceCents ?? 0) / 100),
        costPriceCents: String((item.pricing?.costPriceCents ?? 0) / 100),
        unit: item.unit || "each",
        isActive: item.isActive ?? true,
      });
    } else {
      setSelectedItem(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedItem(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const itemData = {
        sku: formData.sku,
        name: formData.name,
        description: formData.description || undefined,
        inventory: {
          onHand: Number(formData.onHand),
          reorderLevel: Number(formData.reorderLevel),
        },
        pricing: {
          salePriceCents: Math.round(Number(formData.salePriceCents) * 100),
          costPriceCents: Math.round(Number(formData.costPriceCents) * 100),
        },
        unit: formData.unit,
        isActive: formData.isActive,
      };

      if (selectedItem) {
        await apiUpdate<StockItem, typeof itemData>("/api/stock-items", selectedItem._id, itemData);
        toast({ title: "Success", description: "Stock item updated successfully" });
      } else {
        await apiCreate<StockItem, typeof itemData>("/api/stock-items", itemData);
        toast({ title: "Success", description: "Stock item created successfully" });
      }

      handleCloseDialog();
      // Refresh current list
      setItems([]);
      fetchItems(1, debouncedSearch, false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/stock-items", selectedItem._id);
      toast({ title: "Success", description: "Stock item deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSelectedItem(null);
      // Refresh current list
      setItems([]);
      fetchItems(1, debouncedSearch, false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine if we're in a "typing but not searching yet" state (1 char typed)
  const typingButNotSearching = searchQuery.trim().length === 1 && debouncedSearch === searchQuery;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Stock Items</h1>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={openMore} className="h-10 w-10">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items..."
            className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
          {/* Searching indicator */}
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Searching...</span>
            </div>
          )}
        </div>
        {/* Typing hint */}
        {typingButNotSearching && (
          <p className="text-xs text-gray-500 mt-1 ml-1">Type at least 2 characters to search</p>
        )}
      </div>

      {/* Results Count */}
      {!loading && !error && totalCount > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-600">
          Showing {items.length} of {totalCount} items
          {debouncedSearch && <span className="ml-1">for "{debouncedSearch}"</span>}
        </div>
      )}

      {/* Main Content */}
      <main className="p-4 pb-32">
        {/* Initial Loading State */}
        {loading && items.length === 0 && (
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
            <p className="text-red-600 font-medium">Error loading items</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setItems([]);
                fetchItems(1, debouncedSearch, false);
              }}
              className="mt-3"
            >
              Retry
            </Button>
          </div>
        )}

        {/* No Results State - Search returned empty */}
        {!loading && !error && items.length === 0 && debouncedSearch.trim().length >= 2 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <Search className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No results found</h3>
            <p className="text-gray-500 text-sm mb-4">
              No items match "{debouncedSearch}". Try a different search term.
            </p>
            <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          </div>
        )}

        {/* Empty State - No items at all */}
        {!loading && !error && items.length === 0 && !debouncedSearch && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <PackageX className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No stock items yet</h3>
            <p className="text-gray-500 text-sm mb-4">Add your first stock item to get started</p>
          </div>
        )}

        {/* Stock Items List - Infinite Scroll */}
        {!error && items.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {items.map((item) => {
              const status = getStatusInfo(item);
              return (
                <div
                  key={item._id}
                  onClick={() => handleOpenDialog(item)}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        <HighlightedText text={item.name} query={debouncedSearch} />
                      </h3>
                      <p className="text-sm text-gray-500">
                        <HighlightedText text={item.sku} query={debouncedSearch} />
                      </p>
                    </div>
                    <Badge
                      variant={
                        status.variant === "success"
                          ? "success"
                          : status.variant === "warning"
                          ? "warning"
                          : "destructive"
                      }
                      className="ml-2 shrink-0"
                    >
                      {status.label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        <span className="font-medium">{item.inventory?.onHand ?? 0}</span>{" "}
                        {item.unit}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-600">
                        {formatCurrency(item.pricing?.salePriceCents || 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDialog(item);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Infinite Scroll Trigger Element */}
            <div ref={loadMoreRef} data-testid="infinite-scroll-trigger" className="h-4" />

            {/* Loading More Indicator */}
            {loading && items.length > 0 && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading more...</span>
              </div>
            )}

            {/* End of List Message */}
            {!hasMore && items.length > 0 && (
              <div className="text-center py-4 text-sm text-gray-500">
                {items.length === totalCount
                  ? `All ${totalCount} items loaded`
                  : "No more items to load"}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Add Button */}
      <div className="fixed bottom-20 right-4 z-20">
        <Button
          onClick={() => handleOpenDialog()}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
        >
          +
        </Button>
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

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedItem ? "Edit Stock Item" : "Add Stock Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="SKU-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Item name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="onHand">Quantity</Label>
                <Input
                  id="onHand"
                  type="number"
                  min="0"
                  value={formData.onHand}
                  onChange={(e) => setFormData({ ...formData, onHand: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorderLevel">Reorder Level</Label>
                <Input
                  id="reorderLevel"
                  type="number"
                  min="0"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                  className="h-12"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="salePrice">Sale Price (ZAR)</Label>
                <Input
                  id="salePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.salePriceCents}
                  onChange={(e) => setFormData({ ...formData, salePriceCents: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price (ZAR)</Label>
                <Input
                  id="costPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.costPriceCents}
                  onChange={(e) => setFormData({ ...formData, costPriceCents: e.target.value })}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData({ ...formData, unit: value })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseDialog} className="flex-1 h-12">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name || !formData.sku}
              className="flex-1 h-12"
            >
              {isSubmitting ? "Saving..." : selectedItem ? "Update" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Item</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
          </p>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="flex-1 h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="flex-1 h-12 bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile More Menu */}
      <MobileMoreMenu open={isMoreOpen} onClose={closeMore} />
    </div>
  );
}
