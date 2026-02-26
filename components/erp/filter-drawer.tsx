import * as React from "react";
import { X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface FilterOption {
  id: string;
  label: string;
  value: string;
}

export interface FilterSection {
  id: string;
  title: string;
  options: FilterOption[];
}

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sections: FilterSection[];
  selectedValues: Record<string, string[]>;
  onChange: (sectionId: string, values: string[]) => void;
  onClearAll?: () => void;
}

export function FilterDrawer({
  isOpen,
  onClose,
  sections,
  selectedValues,
  onChange,
  onClearAll,
}: FilterDrawerProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  const activeFilterCount = Object.values(selectedValues).flat().length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
          "transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden",
          "rounded-t-2xl bg-background",
          "border-t border-border shadow-xl",
          "transition-transform duration-300 ease-out",
          "pb-safe pt-4",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Filters</h2>
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && onClearAll && (
              <Button variant="ghost" size="sm" onClick={onClearAll}>
                Clear all
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: "calc(85vh - 120px)" }}>
          <div className="space-y-6">
            {sections.map((section) => {
              const selected = selectedValues[section.id] || [];
              
              return (
                <div key={section.id}>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    {section.title}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {section.options.map((option) => {
                      const isSelected = selected.includes(option.value);
                      
                      return (
                        <button
                          key={option.value}
                          onClick={() => {
                            if (isSelected) {
                              onChange(
                                section.id,
                                selected.filter((v) => v !== option.value)
                              );
                            } else {
                              onChange(section.id, [...selected, option.value]);
                            }
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-background">
          <Button className="w-full" onClick={onClose}>
            Show results
          </Button>
        </div>
      </div>
    </>
  );
}

// Simple filter button with count badge
export function FilterButton({
  onClick,
  activeCount = 0,
  className,
}: {
  onClick: () => void;
  activeCount?: number;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn("gap-2", className)}
    >
      <Filter className="h-4 w-4" />
      Filter
      {activeCount > 0 && (
        <Badge variant="secondary" className="ml-1 px-1.5 py-0">
          {activeCount}
        </Badge>
      )}
    </Button>
  );
}
