import * as React from "react"
import { cn } from "@/lib/utils"

export interface MobileListItemProps {
  /**
   * List item title
   */
  title?: React.ReactNode
  /**
   * List item subtitle
   */
  subtitle?: React.ReactNode
  /**
   * List item description
   */
  description?: React.ReactNode
  /**
   * Whether to show chevron
   */
  showChevron?: boolean
  /**
   * Right content element
   */
  rightContent?: React.ReactNode
  /**
   * List item content (alternative to title/subtitle)
   */
  children?: React.ReactNode
  /**
   * Custom className
   */
  className?: string
  /**
   * List item click handler
   */
  onClick?: () => void
  /**
   * List item href for navigation
   */
  href?: string
  /**
   * Whether the item is selected
   */
  selected?: boolean
  /**
   * Whether the item is disabled
   */
  disabled?: boolean
  /**
   * Leading element (icon, avatar, etc.)
   */
  leading?: React.ReactNode
  /**
   * Trailing element (badge, action button, etc.)
   */
  trailing?: React.ReactNode
}

export function MobileListItem({
  title,
  subtitle,
  description,
  showChevron = false,
  rightContent,
  children,
  className,
  onClick,
  href,
  selected = false,
  disabled = false,
  leading,
  trailing,
}: MobileListItemProps) {
  const Component = href ? "a" : onClick ? "button" : "div"

  return (
    <Component
      href={href}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 border-b px-4 py-3 text-left",
        disabled && "opacity-50",
        selected && "bg-primary/5",
        !disabled && !selected && "hover:bg-muted/50",
        href && "cursor-pointer",
        className
      )}
    >
      {leading && <div className="flex-shrink-0">{leading}</div>}
      <div className="flex-1 min-w-0">
        {children || (
          <>
            {title && (
              <p className="truncate font-medium">
                {title}
              </p>
            )}
            {subtitle && (
              <p className="truncate text-sm text-muted-foreground">
                {subtitle}
              </p>
            )}
            {description && (
              <p className="truncate text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </>
        )}
      </div>
      {rightContent && <div className="flex-shrink-0">{rightContent}</div>}
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
      {showChevron && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 text-muted-foreground"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </Component>
  )
}

export interface MobileListItemTitleProps {
  /**
   * Title content
   */
  children: React.ReactNode
  /**
   * Custom className
   */
  className?: string
}

export function MobileListItemTitle({ children, className }: MobileListItemTitleProps) {
  return (
    <p className={cn("truncate font-medium", className)}>
      {children}
    </p>
  )
}

export interface MobileListItemDescriptionProps {
  /**
   * Description content
   */
  children: React.ReactNode
  /**
   * Custom className
   */
  className?: string
}

export function MobileListItemDescription({ children, className }: MobileListItemDescriptionProps) {
  return (
    <p className={cn("truncate text-sm text-muted-foreground", className)}>
      {children}
    </p>
  )
}

export interface MobileListProps {
  /**
   * List content
   */
  children: React.ReactNode
  /**
   * Custom className
   */
  className?: string
  /**
   * Whether to show dividers between items
   */
  dividers?: boolean
}

export function MobileList({ children, className, dividers = true }: MobileListProps) {
  return (
    <div
      className={cn(
        "-mx-4 bg-background",
        dividers && "[&>*:not(:last-child)]:border-b",
        className
      )}
    >
      {children}
    </div>
  )
}
