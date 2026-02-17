"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Filter, SortDesc, Search, Plus, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface PageHeaderAction {
  /**
   * Action icon
   */
  icon?: React.ReactNode
  /**
   * Action label (for aria-label)
   */
  label: string
  /**
   * Action click handler
   */
  onClick?: () => void
  /**
   * Disable the action
   */
  disabled?: boolean
}

export interface PageHeaderProps {
  /**
   * Page title
   */
  title: string
  /**
   * Optional subtitle
   */
  subtitle?: string
  /**
   * Show back button
   */
  showBackButton?: boolean
  /**
   * Back button click handler (if not provided, uses router.back())
   */
  onBack?: () => void
  /**
   * Back button href (if using Link)
   */
  backHref?: string
  /**
   * Primary action button (e.g., Add new)
   */
  primaryAction?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  /**
   * Filter action
   */
  onFilter?: () => void
  /**
   * Sort action
   */
  onSort?: () => void
  /**
   * Search action
   */
  onSearch?: () => void
  /**
   * Additional action buttons
   */
  actions?: PageHeaderAction[]
  /**
   * Make header sticky
   */
  sticky?: boolean
  /**
   * Additional className
   */
  className?: string
}

/**
 * Mobile-optimized page header with large title, optional back button,
 * and action buttons (filter, sort, search, etc.). Supports sticky positioning.
 */
export function PageHeader({
  title,
  subtitle,
  showBackButton = false,
  onBack,
  backHref,
  primaryAction,
  onFilter,
  onSort,
  onSearch,
  actions,
  sticky = false,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        // Base styles
        "w-full",
        // Sticky positioning
        sticky && "sticky top-0 z-40 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80",
        // Bottom border
        "border-b border-border",
        // Safe area padding
        "pt-safe pb-4 px-4",
        className
      )}
    >
      {/* Top row with back button and actions */}
      <div className="flex items-center justify-between mb-2">
        {/* Left side - Back button */}
        <div className="flex items-center gap-2">
          {showBackButton && (
            backHref ? (
              <Link href={backHref}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 -ml-2 shrink-0"
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 -ml-2 shrink-0"
                onClick={onBack}
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )
          )}
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-1">
          {/* Search button */}
          {onSearch && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={onSearch}
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </Button>
          )}

          {/* Filter button */}
          {onFilter && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={onFilter}
              aria-label="Filter"
            >
              <Filter className="h-5 w-5" />
            </Button>
          )}

          {/* Sort button */}
          {onSort && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={onSort}
              aria-label="Sort"
            >
              <SortDesc className="h-5 w-5" />
            </Button>
          )}

          {/* Custom actions */}
          {actions?.map((action, index) => (
            <Button
              key={index}
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={action.onClick}
              disabled={action.disabled}
              aria-label={action.label}
            >
              {action.icon || <MoreHorizontal className="h-5 w-5" />}
            </Button>
          ))}

          {/* Primary action */}
          {primaryAction && (
            <Button
              size="sm"
              className="ml-2 shrink-0"
              onClick={primaryAction.onClick}
            >
              {primaryAction.icon || <Plus className="h-4 w-4 mr-1" />}
              {primaryAction.label}
            </Button>
          )}
        </div>
      </div>

      {/* Title and subtitle */}
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  )
}

// Compact variant for sub-headers
export interface PageHeaderCompactProps {
  title: string
  showBackButton?: boolean
  onBack?: () => void
  actions?: PageHeaderAction[]
  className?: string
}

export function PageHeaderCompact({
  title,
  showBackButton = false,
  onBack,
  actions,
  className,
}: PageHeaderCompactProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between w-full px-4 py-3",
        "border-b border-border",
        "pt-safe",
        className
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {showBackButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 -ml-2"
            onClick={onBack}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-lg font-semibold text-foreground truncate">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {actions?.map((action, index) => (
          <Button
            key={index}
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={action.onClick}
            disabled={action.disabled}
            aria-label={action.label}
          >
            {action.icon || <MoreHorizontal className="h-4 w-4" />}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default PageHeader
