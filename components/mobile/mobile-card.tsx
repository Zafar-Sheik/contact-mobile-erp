import * as React from "react"
import { cn } from "@/lib/utils"

export interface MobileCardProps {
  /**
   * Card content
   */
  children: React.ReactNode
  /**
   * Custom className
   */
  className?: string
  /**
   * Card click handler
   */
  onClick?: () => void
  /**
   * Card href for navigation
   */
  href?: string
  /**
   * Whether the card is clickable
   */
  interactive?: boolean
  /**
   * Card padding
   */
  padding?: "none" | "small" | "medium" | "large"
}

export function MobileCard({
  children,
  className,
  onClick,
  href,
  interactive = false,
  padding = "medium",
}: MobileCardProps) {
  const paddingClasses = {
    none: "",
    small: "p-2",
    medium: "p-4",
    large: "p-6",
  }

  const Component = href ? "a" : onClick ? "button" : "div"

  return (
    <Component
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        paddingClasses[padding],
        interactive && "cursor-pointer transition-shadow hover:shadow-md",
        className
      )}
    >
      {children}
    </Component>
  )
}

export interface MobileCardHeaderProps {
  /**
   * Header content
   */
  children: React.ReactNode
  /**
   * Custom className
   */
  className?: string
}

export function MobileCardHeader({ children, className }: MobileCardHeaderProps) {
  return (
    <div className={cn("flex flex-col space-y-1.5 pb-4", className)}>
      {children}
    </div>
  )
}

export interface MobileCardTitleProps {
  /**
   * Title content
   */
  children: React.ReactNode
  /**
   * Custom className
   */
  className?: string
}

export function MobileCardTitle({ children, className }: MobileCardTitleProps) {
  return (
    <h3 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>
      {children}
    </h3>
  )
}

export interface MobileCardDescriptionProps {
  /**
   * Description content
   */
  children: React.ReactNode
  /**
   * Custom className
   */
  className?: string
}

export function MobileCardDescription({ children, className }: MobileCardDescriptionProps) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {children}
    </p>
  )
}

export interface MobileCardContentProps {
  /**
   * Content
   */
  children: React.ReactNode
  /**
   * Custom className
   */
  className?: string
}

export function MobileCardContent({ children, className }: MobileCardContentProps) {
  return <div className={cn("", className)}>{children}</div>
}

export interface MobileCardFooterProps {
  /**
   * Footer content
   */
  children: React.ReactNode
  /**
   * Custom className
   */
  className?: string
}

export function MobileCardFooter({ children, className }: MobileCardFooterProps) {
  return (
    <div className={cn("flex items-center pt-4", className)}>
      {children}
    </div>
  )
}
