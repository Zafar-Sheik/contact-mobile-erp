"use client"

import * as React from "react"
import { ChevronRight, MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export interface MobileListItemProps {
  /**
   * Main title text
   */
  title: string
  /**
   * Subtitle text (secondary info)
   */
  subtitle?: string
  /**
   * Description text (tertiary info, truncated)
   */
  description?: string
  /**
   * Left side avatar - can be image URL, icon component, or initials
   */
  avatar?: {
    src?: string
    alt?: string
    icon?: React.ReactNode
    fallback?: string
    className?: string
  }
  /**
   * Right side status badge
   */
  status?: {
    label: string
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
  }
  /**
   * Show chevron indicator on right
   */
  showChevron?: boolean
  /**
   * Custom right content
   */
  rightContent?: React.ReactNode
  /**
   * Click handler
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

/**
 * Mobile-optimized list item with touch-friendly sizing (min 44px touch target).
 * Shows title, subtitle, optional description, avatar, and action indicators.
 */
export function MobileListItem({
  title,
  subtitle,
  description,
  avatar,
  status,
  showChevron = true,
  rightContent,
  onClick,
  disabled = false,
  className,
}: MobileListItemProps) {
  const isInteractive = !!onClick && !disabled

  // Get initials from title if no fallback provided
  const getInitials = (text: string) => {
    return text
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        // Base container styles
        "group flex min-h-[72px] items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-3",
        // Interactive states
        isInteractive && [
          "cursor-pointer transition-all duration-200",
          "hover:bg-accent/50 hover:border-border",
          "active:scale-[0.99] active:bg-accent",
          // Focus ring for accessibility
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ],
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {/* Left Avatar */}
      {avatar && (
        <div className="shrink-0">
          <Avatar className={cn("h-12 w-12 border-2 border-background shadow-sm", avatar.className)}>
            {avatar.src && <AvatarImage src={avatar.src} alt={avatar.alt || title} />}
            {avatar.icon ? (
              <AvatarFallback className="bg-transparent">{avatar.icon}</AvatarFallback>
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {avatar.fallback || getInitials(title)}
              </AvatarFallback>
            )}
          </Avatar>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        {/* Title Row */}
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{title}</span>
          {status && (
            <Badge variant={status.variant || "default"} className="shrink-0 text-xs">
              {status.label}
            </Badge>
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>
        )}

        {/* Description */}
        {description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{description}</p>
        )}
      </div>

      {/* Right Content */}
      <div className="shrink-0 flex items-center gap-2">
        {rightContent}
        {showChevron && isInteractive && (
          <ChevronRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
        )}
      </div>
    </div>
  )
}

// Skeleton variant for loading states
export function MobileListItemSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-[72px] items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-3 animate-pulse",
        className
      )}
    >
      {/* Avatar skeleton */}
      <div className="h-12 w-12 rounded-full bg-muted" />

      {/* Content skeleton */}
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>

      {/* Chevron skeleton */}
      <div className="h-5 w-5 rounded bg-muted" />
    </div>
  )
}

export default MobileListItem
