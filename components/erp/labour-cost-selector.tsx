"use client";

import * as React from "react";
import { Search, Wrench, X, Plus, ChevronDown, ChevronUp } from "lucide-react";
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
import { useApi } from "@/lib/hooks/use-api";

export interface LabourCostSelectorItem {
  _id: string;
  code: string;
  name: string;
  description?: string;
  unit: string;
  pricing: {
    rateCents: number;
    costCents: number;
  };
}

interface LabourCostSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: LabourCostSelectorItem, priceCents: number) => void;
  onCreateNew?: () => void;
  activeLineIndex?: number;
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
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// Format currency
function formatCurrency(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function LabourCostSelector({
  open,
  onOpenChange,
  onSelect,
  onCreateNew,
}: LabourCostSelectorProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [items, setItems] = React.useState<LabourCostSelectorItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Debounce search query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch labour costs when dialog opens or search changes
  React.useEffect(() => {
    if (!open) return;

    const fetchLabourCosts = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (debouncedQuery) {
          params.set("search", debouncedQuery);
        }
        params.set("isActive", "true");

        const response = await fetch(`/api/labour-costs?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to fetch labour costs");
        }

        const data = await response.json();
        setItems(data.data || []);
      } catch (err: any) {
        setError(err.message || "Failed to load labour costs");
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLabourCosts();
  }, [open, debouncedQuery]);

  // Focus search input when dialog opens
  React.useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setDebouncedQuery("");
      setItems([]);
      setError(null);
      setFocusedIndex(-1);
    }
  }, [open]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && focusedIndex >= 0 && items[focusedIndex]) {
      e.preventDefault();
      handleSelect(items[focusedIndex]);
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  };

  // Scroll focused item into view
  React.useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [focusedIndex]);

  const handleSelect = (item: LabourCostSelectorItem) => {
    // Use the rate (sale price) as default
    const priceCents = item.pricing?.rateCents || 0;
    onSelect(item, priceCents);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>Select Labour Item</DialogTitle>
          <DialogDescription>
            Choose a labour/service item to add to your document
          </DialogDescription>
        </DialogHeader>

        {/* Search input */}
        <div className="px-6 py-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search labour items by name or code..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedIndex(-1);
              }}
              onKeyDown={handleKeyDown}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Items list */}
        <ScrollArea className="flex-1 min-h-[200px] max-h-[400px]">
          <div ref={listRef} className="px-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                <span className="ml-2">Loading labour items...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-8 text-destructive">
                <Wrench className="h-8 w-8 mb-2 opacity-50" />
                <p>{error}</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Wrench className="h-8 w-8 mb-2 opacity-50" />
                <p>
                  {debouncedQuery
                    ? "No labour items match your search"
                    : "No labour items available"}
                </p>
                {onCreateNew && (
                  <Button
                    variant="link"
                    onClick={onCreateNew}
                    className="mt-2 text-primary"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create new labour item
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-1 py-2">
                {items.map((item, index) => (
                  <button
                    key={item._id}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-3 rounded-md text-left transition-colors",
                      focusedIndex === index
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">
                          <HighlightedText
                            text={item.name}
                            query={debouncedQuery}
                          />
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          <HighlightedText
                            text={item.code}
                            query={debouncedQuery}
                          />
                        </span>
                        {item.description && (
                          <span className="truncate">
                            <HighlightedText
                              text={item.description}
                              query={debouncedQuery}
                            />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <div className="font-medium">
                        {formatCurrency(item.pricing?.rateCents || 0)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        per {item.unit}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with actions */}
        <div className="px-6 py-3 border-t shrink-0 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {items.length} item{items.length !== 1 ? "s" : ""} available
          </div>
          {onCreateNew && (
            <Button variant="outline" size="sm" onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-1" />
              New Labour Item
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simplified trigger button component
interface LabourCostSelectorTriggerProps {
  onClick: () => void;
  itemName?: string;
  itemCode?: string;
  hasSelection?: boolean;
  className?: string;
}

export function LabourCostSelectorTrigger({
  onClick,
  itemName,
  itemCode,
  hasSelection,
  className,
}: LabourCostSelectorTriggerProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn("w-full justify-between font-normal", className)}
    >
      {hasSelection && itemName ? (
        <span className="flex items-center gap-2 truncate">
          <Wrench className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {itemName}
            {itemCode && (
              <span className="text-muted-foreground text-xs ml-1">
                ({itemCode})
              </span>
            )}
          </span>
        </span>
      ) : (
        <span className="flex items-center gap-2 text-muted-foreground">
          <Wrench className="h-4 w-4" />
          <span>Select labour item</span>
        </span>
      )}
      <ChevronDown className="h-4 w-4 shrink-0 ml-2" />
    </Button>
  );
}
