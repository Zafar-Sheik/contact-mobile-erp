"use client"

import * as React from "react"
import { ChevronRight, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SectionProps {
  /**
   * Section title
   */
  title?: string
  /**
   * Optional description under title
   */
  description?: string
  /**
   * Section content
   */
  children: React.ReactNode
  /**
   * Optional action link
   */
  action?: {
    label: string
    href: string
  }
  /**
   * Optional header actions (like buttons)
   */
  headerActions?: React.ReactNode
  /**
   * Whether to show a divider at the bottom
   */
  showDivider?: boolean
  /**
   * Additional className
   */
  className?: string
}

/**
 * Section - A content grouping component for mobile.
 * Provides consistent spacing, optional title/description,
 * and optional action link.
 */
export function Section({
  title,
  description,
  children,
  action,
  headerActions,
  showDivider = false,
  className,
}: SectionProps) {
  return (
    <section className={cn("py-4", className)}>
      {/* Header */}
      {(title || action || headerActions) && (
        <div className="flex items-center justify-between px-1 pb-3">
          <div className="flex-1">
            {title && (
              <h2 className="text-base font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            {action && (
              <a
                href={action.href}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {action.label}
                <ChevronRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className={cn(showDivider && "border-b border-border pb-4")}>
        {children}
      </div>
    </section>
  )
}

// Section Header - for use within sections
export interface SectionHeaderProps {
  title: string
  description?: string
  action?: {
    label: string
    href: string
  }
  icon?: LucideIcon
  className?: string
}

export function SectionHeader({
  title,
  description,
  action,
  icon: Icon,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between px-1 pb-2", className)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action && (
        <a
          href={action.href}
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          {action.label}
        </a>
      )}
    </div>
  )
}

// Section Card - A card within a section
export interface SectionCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function SectionCard({
  children,
  className,
  onClick,
}: SectionCardProps) {
  const isInteractive = !!onClick

  if (isInteractive) {
    return (
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        className={cn(
          "rounded-xl border border-border/50 bg-card p-4",
          "cursor-pointer transition-all duration-200",
          "hover:bg-accent/50 hover:border-border",
          "active:scale-[0.99]",
          className
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card p-4",
        className
      )}
    >
      {children}
    </div>
  )
}

export default Section
