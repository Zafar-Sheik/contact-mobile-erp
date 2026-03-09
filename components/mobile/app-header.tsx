import * as React from "react"
import { cn } from "@/lib/utils"

export interface User {
  id: string
  name: string
  email?: string
  role?: string
  avatar?: string
}

export interface AppHeaderProps {
  /**
   * Page title
   */
  title?: string
  /**
   * User data for display
   */
  user?: User
  /**
   * Show menu button (hamburger)
   */
  showMenuButton?: boolean
  /**
   * Show back button
   */
  showBackButton?: boolean
  /**
   * Back button href
   */
  backHref?: string
  /**
   * Custom header actions
   */
  actions?: React.ReactNode
  /**
   * Callback when menu button is clicked
   */
  onMenuClick?: () => void
  /**
   * Callback when back button is clicked
   */
  onBackClick?: () => void
  /**
   * Custom className
   */
  className?: string
}

export function AppHeader({
  title,
  user,
  showMenuButton = false,
  showBackButton = false,
  backHref,
  actions,
  onMenuClick,
  onBackClick,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b bg-background px-4",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {showMenuButton && (
          <button
            type="button"
            onClick={onMenuClick}
            className="flex items-center justify-center rounded-md p-2 hover:bg-muted"
            aria-label="Open menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </button>
        )}
        {showBackButton && (
          <a
            href={backHref}
            onClick={(e) => {
              if (onBackClick) {
                e.preventDefault()
                onBackClick()
              }
            }}
            className="flex items-center justify-center rounded-md p-2 hover:bg-muted"
            aria-label="Go back"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
          </a>
        )}
        {title && (
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {user && (
          <div className="flex items-center gap-2">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
