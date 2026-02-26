"use client"

import * as React from "react"
import Link from "next/link"
import { Search, Bell, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface AppHeaderProps {
  /**
   * App title to display on the left
   */
  title?: string
  /**
   * Logo URL or app logo component
   */
  logo?: React.ReactNode
  /**
   * User object for avatar display
   */
  user?: {
    name?: string
    email?: string
    avatar?: string
  }
  /**
   * Callback when search button is clicked
   */
  onSearch?: () => void
  /**
   * Callback when notification button is clicked
   */
  onNotifications?: () => void
  /**
   * Additional className for the header
   */
  className?: string
  /**
   * Show/hide the menu button (for opening sidebar)
   */
  showMenuButton?: boolean
  /**
   * Callback when menu button is clicked
   */
  onMenuClick?: () => void
}

/**
 * Mobile-friendly header component with sticky positioning,
 * safe area padding, and standard 56px height.
 */
export function AppHeader({
  title = "MR Power",
  logo,
  user,
  onSearch,
  onNotifications,
  className,
  showMenuButton = false,
  onMenuClick,
}: AppHeaderProps) {
  // Get initials for avatar fallback
  const getInitials = (name?: string) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <header
      className={cn(
        // Base styles - fixed height 56px, sticky at top
        "sticky top-0 z-50 h-14 w-full",
        // Background with blur for modern mobile feel
        "bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60",
        // Border at bottom
        "border-b border-border",
        // Safe area padding for notched devices
        "pt-safe",
        // Transition for smooth appearance
        "transition-all duration-200",
        className
      )}
    >
      <div className="flex h-full items-center justify-between px-4">
        {/* Left section - Logo/Title and Menu */}
        <div className="flex items-center gap-3">
          {/* Menu button (optional) */}
          {showMenuButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 lg:hidden"
              onClick={onMenuClick}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}

          {/* Logo */}
          {logo ? (
            <div className="shrink-0">{logo}</div>
          ) : (
            // App title
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-sm font-bold text-primary-foreground">MR</span>
              </div>
              <span className="text-lg font-semibold text-foreground hidden sm:inline-block">
                {title}
              </span>
            </Link>
          )}
        </div>

        {/* Right section - Actions */}
        <div className="flex items-center gap-1">
          {/* Search button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={onSearch}
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Notifications button (optional) */}
          {onNotifications && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 relative"
              onClick={onNotifications}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {/* Notification badge */}
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive" />
            </Button>
          )}

          {/* User avatar / dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 w-10 rounded-full p-0 hover:bg-accent"
                aria-label="User menu"
              >
                <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                  <AvatarImage src={user?.avatar} alt={user?.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || "user@example.com"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help">Help & Support</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive">
                <Link href="/logout">Log out</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
