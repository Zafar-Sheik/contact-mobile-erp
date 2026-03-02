"use client";

import * as React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Package, 
  Loader2, 
  X,
  ChevronDown,
  ArrowUp
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types matching the API response
interface StockItemSearchResult {
  _id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  pricing: {
    costPriceCents: number;
    salePriceCents: number;
  };
}

interface StockItemSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: StockItemSearchResult) => void;
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function StockItemSearchModal({
  open,
  onOpenChange,
  onSelect,
}: StockItemSearchModalProps) {
  // State
  const [query, setQuery] = React.useState("");
  const [items, setItems] = React.useState<StockItemSearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  
  // Refs
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  
  // Debounced query
  const debouncedQuery = useDebounce(query, 300);
  
  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (open) {
      // Reset state
      setQuery("");
      setItems([]);
      setCursor(null);
      setHasMore(false);
      setHighlightedIndex(-1);
      
      // Focus input after a short delay
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);
  
  // Fetch items
  const fetchItems = React.useCallback(async (searchQuery: string, cursorParam?: string, isNewSearch = false) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    
    try {
      // Build URL with params
      const params = new URLSearchParams();
      if (searchQuery.length >= 2) {
        params.set("q", searchQuery);
      }
      if (cursorParam) {
        params.set("cursor", cursorParam);
      }
      params.set("limit", "20");
      
      const response = await fetch(`/api/stock-items/search?${params}`, {
        signal: abortControllerRef.current.signal,
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch items");
      }
      
      const data = await response.json();
      
      if (isNewSearch) {
        setItems(data.items || []);
      } else {
        setItems(prev => [...prev, ...(data.items || [])]);
      }
      
      setCursor(data.nextCursor || null);
      setHasMore(!!data.nextCursor);
      setHighlightedIndex(-1);
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Error fetching stock items:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Fetch when debounced query changes or modal opens
  React.useEffect(() => {
    if (open) {
      // Fetch when: query is empty (show defaults) OR query has 2+ characters
      if (debouncedQuery.length === 0 || debouncedQuery.length >= 2) {
        fetchItems(debouncedQuery, undefined, true);
      }
    }
  }, [debouncedQuery, open, fetchItems]);
  
  // Handle load more
  const handleLoadMore = () => {
    if (cursor && !isLoading) {
      fetchItems(debouncedQuery, cursor, false);
    }
  };
  
  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => {
          const newIndex = Math.min(prev + 1, items.length - 1);
          scrollHighlightedIntoView(newIndex);
          return newIndex;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => {
          const newIndex = Math.max(prev - 1, -1);
          scrollHighlightedIntoView(newIndex);
          return newIndex;
        });
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          handleSelect(items[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        onOpenChange(false);
        break;
    }
  };
  
  // Scroll highlighted item into view
  const scrollHighlightedIntoView = (index: number) => {
    if (listRef.current) {
      const listItems = listRef.current.querySelectorAll("[data-list-item]");
      if (listItems[index]) {
        listItems[index].scrollIntoView({ block: "nearest" });
      }
    }
  };
  
  // Handle item selection
  const handleSelect = (item: StockItemSearchResult) => {
    onSelect(item);
    onOpenChange(false);
  };
  
  // Format price
  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(cents / 100);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[calc(100vw-2rem)] p-0 gap-0">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="text-lg">Search Stock Items</DialogTitle>
        </DialogHeader>
        
        {/* Search Input */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by name, SKU, or description..."
              className="pl-9 pr-9 h-11"
              disabled={isLoading}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Results List */}
        <div 
          ref={listRef}
          className="max-h-[400px] overflow-y-auto px-4 pb-4"
        >
          {/* Loading state for initial load */}
          {isLoading && items.length === 0 && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="h-10 w-10 bg-muted rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* No results */}
          {!isLoading && items.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {query.length > 0 && query.length < 2 ? (
                <p>Type at least 2 characters to search</p>
              ) : (
                <>
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No stock items found</p>
                  {query.length === 0 && (
                    <p className="text-sm mt-1">No items available</p>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* Results list */}
          {items.length > 0 && (
            <div className="space-y-1">
              {items.map((item, index) => (
                <button
                  key={item._id}
                  data-list-item
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                    "hover:bg-accent hover:border-accent",
                    highlightedIndex === index && "bg-accent border-accent"
                  )}
                >
                  {/* Icon */}
                  <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{item.name}</span>
                      <span className="text-xs text-muted-foreground">({item.sku})</span>
                    </div>
                    {item.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {item.description.length > 50 
                          ? item.description.substring(0, 50) + "..." 
                          : item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{item.unit}</span>
                      {item.pricing?.salePriceCents > 0 && (
                        <span className="text-emerald-600 font-medium">
                          {formatPrice(item.pricing.salePriceCents)}
                        </span>
                      )}
                      {item.pricing?.costPriceCents > 0 && (
                        <span className="text-muted-foreground">
                          Cost: {formatPrice(item.pricing.costPriceCents)}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Arrow indicator for highlighted */}
                  {highlightedIndex === index && (
                    <ArrowUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
          
          {/* Load more */}
          {hasMore && (
            <div className="pt-2">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
          
          {/* Loading more indicator */}
          {isLoading && items.length > 0 && (
            <div className="flex items-center justify-center py-2 text-muted-foreground text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading more...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
