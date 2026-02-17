"use client"

import * as React from "react"
import { RefreshCw, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import { MobileListItem, MobileListItemSkeleton } from "./mobile-list-item"
import { Button } from "@/components/ui/button"

export interface ListSection {
  /**
   * Section header title
   */
  title?: string
  /**
   * Section header description (optional)
   */
  description?: string
  /**
   * Array of items in this section
   */
  items: React.ReactNode
}

export interface MobileListProps {
  /**
   * List sections
   */
  children?: React.ReactNode
  /**
   * Custom sections (alternative to children)
   */
  sections?: ListSection[]
  /**
   * Show pull-to-refresh indicator
   */
  showRefresh?: boolean
  /**
   * Loading state (shows skeletons)
   */
  loading?: boolean
  /**
   * Number of skeleton items to show when loading
   */
  skeletonCount?: number
  /**
   * Empty state configuration
   */
  emptyState?: {
    icon?: React.ReactNode
    title: string
    description?: string
    action?: {
      label: string
      onClick: () => void
    }
  }
  /**
   * Show dividers between items
   */
  showDividers?: boolean
  /**
   * Additional className
   */
  className?: string
}

/**
 * Mobile-optimized list container with section headers, loading skeletons,
 * empty states, and pull-to-refresh visual indicator.
 */
export function MobileList({
  children,
  sections,
  showRefresh = false,
  loading = false,
  skeletonCount = 5,
  emptyState,
  showDividers = false,
  className,
}: MobileListProps) {
  // Determine if we have content
  const hasChildren = React.Children.count(children) > 0
  const hasSections = sections && sections.length > 0

  // Render loading skeletons
  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <MobileListItemSkeleton key={`skeleton-${index}`} />
        ))}
      </div>
    )
  }

  // Render empty state
  if (!hasChildren && !hasSections && emptyState) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 px-4", className)}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          {emptyState.icon || <Inbox className="h-8 w-8 text-muted-foreground" />}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">{emptyState.title}</h3>
        {emptyState.description && (
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            {emptyState.description}
          </p>
        )}
        {emptyState.action && (
          <Button onClick={emptyState.action.onClick} size="sm">
            {emptyState.action.label}
          </Button>
        )}
      </div>
    )
  }

  // No content and no empty state
  if (!hasChildren && !hasSections) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 px-4", className)}>
        <p className="text-sm text-muted-foreground">No items to display</p>
      </div>
    )
  }

  // Render sections or children
  const content = hasSections
    ? sections?.map((section, sectionIndex) => (
        <div key={`section-${sectionIndex}`} className="mb-6 last:mb-0">
          {/* Section Header */}
          {(section.title || section.description) && (
            <div className="mb-3 px-1">
              {section.title && (
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  {section.title}
                </h3>
              )}
              {section.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
              )}
            </div>
          )}
          {/* Section Items */}
          <div className={cn("space-y-3", showDividers && "divide-y-0")}>
            {section.items}
          </div>
        </div>
      ))
    : children

  return (
    <div className={cn("relative", className)}>
      {/* Pull-to-refresh indicator */}
      {showRefresh && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4" />
          <span>Pull to refresh</span>
        </div>
      )}

      {/* List Content */}
      <div className="space-y-3">{content}</div>
    </div>
  )
}

// Pre-built list item wrapper for convenience
interface MobileListItemWrapperProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export function MobileListItemWrapper({
  children,
  onClick,
  disabled = false,
  className,
}: MobileListItemWrapperProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        onClick && !disabled && "cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {children}
    </div>
  )
}

export default MobileList
