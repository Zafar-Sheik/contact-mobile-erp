"use client"

import * as React from "react"
import { Inbox, Search, FolderOpen, FileX, Users, Package, Truck, FileText, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface EmptyStateProps {
  /**
   * Icon to display (can be a Lucide icon or custom node)
   */
  icon?: React.ReactNode
  /**
   * Pre-defined icon type for common empty states
   */
  iconType?: "default" | "search" | "folder" | "no-results" | "users" | "items" | "vehicles" | "invoices"
  /**
   * Title text
   */
  title: string
  /**
   * Description text
   */
  description?: string
  /**
   * Action button configuration
   */
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  /**
   * Secondary action button
   */
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  /**
   * Additional className
   */
  className?: string
}

/**
 * Mobile-optimized empty state component with icon, title,
 * description, and optional action buttons.
 */
export function EmptyState({
  icon,
  iconType = "default",
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  // Get default icon based on type
  const getDefaultIcon = () => {
    switch (iconType) {
      case "search":
        return <Search className="h-10 w-10" />
      case "folder":
        return <FolderOpen className="h-10 w-10" />
      case "no-results":
        return <FileX className="h-10 w-10" />
      case "users":
        return <Users className="h-10 w-10" />
      case "items":
        return <Package className="h-10 w-10" />
      case "vehicles":
        return <Truck className="h-10 w-10" />
      case "invoices":
        return <FileText className="h-10 w-10" />
      default:
        return <Inbox className="h-10 w-10" />
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      {/* Icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-5">
        {icon || getDefaultIcon()}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-2 max-w-[260px]">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground max-w-[280px] mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 w-full max-w-[240px]">
        {action && (
          <Button onClick={action.onClick} className="w-full">
            {action.icon || <Plus className="h-4 w-4 mr-2" />}
            {action.label}
          </Button>
        )}
        
        {secondaryAction && (
          <Button
            onClick={secondaryAction.onClick}
            variant="outline"
            className="w-full"
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  )
}

// Pre-configured empty states for common scenarios
export function NoResultsState({ 
  onClearFilters, 
  className 
}: { 
  onClearFilters?: () => void
  className?: string 
}) {
  return (
    <EmptyState
      iconType="no-results"
      title="No results found"
      description="Try adjusting your search or filters to find what you're looking for."
      action={onClearFilters ? { label: "Clear filters", onClick: onClearFilters } : undefined}
      className={className}
    />
  )
}

export function EmptyListState({ 
  title, 
  description, 
  onAdd,
  addLabel = "Add new"
}: { 
  title?: string
  description?: string
  onAdd?: () => void
  addLabel?: string
}) {
  return (
    <EmptyState
      iconType="default"
      title={title || "No items yet"}
      description={description || "Get started by adding your first item."}
      action={onAdd ? { label: addLabel, onClick: onAdd } : undefined}
    />
  )
}

export function EmptySearchState({ 
  searchQuery,
  onClear 
}: { 
  searchQuery: string
  onClear?: () => void
}) {
  return (
    <EmptyState
      iconType="search"
      title={`No results for "${searchQuery}"`}
      description="Try searching with different keywords or check your spelling."
      action={onClear ? { label: "Clear search", onClick: onClear } : undefined}
    />
  )
}

export default EmptyState
