"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface MobileCardProps {
  /**
   * Card content
   */
  children: React.ReactNode
  /**
   * Click handler for interactive cards
   */
  onClick?: () => void
  /**
   * Disabled state
   */
  disabled?: boolean
  /**
   * Additional className
   */
  className?: string
}

export interface MobileCardHeaderProps {
  /**
   * Card header content
   */
  children: React.ReactNode
  /**
   * Additional className
   */
  className?: string
}

export interface MobileCardContentProps {
  /**
   * Card content
   */
  children: React.ReactNode
  /**
   * Additional className
   */
  className?: string
}

export interface MobileCardFooterProps {
  /**
   * Card footer content
   */
  children: React.ReactNode
  /**
   * Additional className
   */
  className?: string
}

/**
 * Mobile-optimized card component with 12px rounded corners,
 * subtle shadow, and proper padding. Supports header, content, and footer sections.
 */
export function MobileCard({
  children,
  onClick,
  disabled = false,
  className,
}: MobileCardProps) {
  const isInteractive = !!onClick && !disabled

  if (isInteractive) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onClick()
          }
        }}
        className={cn(
          // Base card styles
          "rounded-xl border border-border/50 bg-card shadow-sm",
          // Interactive states
          "cursor-pointer transition-all duration-200",
          "hover:shadow-md hover:border-border",
          "active:scale-[0.99] active:bg-accent/50",
          // Focus states for accessibility
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          disabled && "opacity-50 cursor-not-allowed",
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
        "rounded-xl border border-border/50 bg-card shadow-sm",
        disabled && "opacity-50",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Card header section with consistent mobile padding
 */
export function MobileCardHeader({ children, className }: MobileCardHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 px-4 pt-4 pb-2",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Card content section with consistent mobile padding
 */
export function MobileCardContent({ children, className }: MobileCardContentProps) {
  return (
    <div
      className={cn(
        "px-4 pb-4",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Card footer section with consistent mobile padding and top border
 */
export function MobileCardFooter({ children, className }: MobileCardFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center px-4 pt-3 pb-4 border-t border-border/50 mt-2",
        className
      )}
    >
      {children}
    </div>
  )
}

// Compact card variant - less padding for dense information
export interface MobileCardCompactProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export function MobileCardCompact({
  children,
  onClick,
  disabled = false,
  className,
}: MobileCardCompactProps) {
  const isInteractive = !!onClick && !disabled

  if (isInteractive) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onClick()
          }
        }}
        className={cn(
          "rounded-lg border border-border/50 bg-card shadow-sm",
          "cursor-pointer transition-all duration-200",
          "hover:bg-accent/50 hover:border-border",
          "active:scale-[0.99]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          disabled && "opacity-50 cursor-not-allowed",
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
        "rounded-lg border border-border/50 bg-card shadow-sm",
        disabled && "opacity-50",
        className
      )}
    >
      {children}
    </div>
  )
}

export default MobileCard
