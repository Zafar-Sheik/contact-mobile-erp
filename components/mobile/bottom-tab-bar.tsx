"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Package, Plus, ShoppingCart, Menu, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { MobileMoreMenu, useMobileMoreMenu } from "./mobile-more-menu"

export interface TabItem {
  /**
   * Label for the tab
   */
  label: string
  /**
   * Icon component for the tab
   */
  icon: LucideIcon
  /**
   * Href for the tab link
   */
  href: string
  /**
   * Whether this tab is a FAB (Floating Action Button) style
   */
  isFab?: boolean
  /**
   * Whether this tab opens a more menu (instead of navigation)
   */
  isMore?: boolean
}

const defaultTabs: TabItem[] = [
  {
    label: "Dashboard",
    icon: Home,
    href: "/",
  },
  {
    label: "Inventory",
    icon: Package,
    href: "/stock-items",
  },
  {
    label: "Create",
    icon: Plus,
    href: "/invoices/new",
    isFab: true,
  },
  {
    label: "Sales",
    icon: ShoppingCart,
    href: "/invoices",
  },
  {
    label: "More",
    icon: Menu,
    href: "", // Will be handled specially
    isMore: true,
  },
]

export interface BottomTabBarProps {
  /**
   * Custom tabs to display
   */
  tabs?: TabItem[]
  /**
   * Additional className for the tab bar
   */
  className?: string
  /**
   * Show/hide the tab bar
   */
  visible?: boolean
}

/**
 * Bottom navigation tab bar with fixed positioning,
 * safe area padding, and touch-friendly tap targets.
 */
export function BottomTabBar({
  tabs = defaultTabs,
  className,
  visible = true,
}: BottomTabBarProps) {
  const pathname = usePathname()
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu()

  // Check if a tab is active
  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  if (!visible) {
    return null
  }

  return (
    <>
      <nav
      className={cn(
        // Fixed at bottom
        "fixed bottom-0 left-0 right-0 z-40",
        // Background with blur
        "bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80",
        // Top border
        "border-t border-border",
        // Safe area padding at bottom
        "pb-safe pb-2",
        // Height - standard mobile bottom nav is around 64px + safe area
        "h-mobile-nav min-h-[64px]",
        // Transition
        "transition-all duration-300",
        className
      )}
      aria-label="Bottom navigation"
    >
      <div className="flex h-full items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab.href)

          if (tab.isFab) {
            // FAB-style tab (center, prominent)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  // Flex to center content
                  "flex flex-col items-center justify-center",
                  // Size - larger touch target (56px min)
                  "h-14 w-14 -mt-4",
                  // Circular background for FAB
                  "rounded-full",
                  // Primary colors for FAB
                  "bg-primary shadow-lg shadow-primary/30",
                  // Scale on press
                  "active:scale-95 transition-transform duration-150",
                  // Position above the tab bar
                  "z-10"
                )}
                aria-label={tab.label}
              >
                <Icon
                  className={cn(
                    "h-6 w-6",
                    active ? "text-primary-foreground" : "text-primary-foreground"
                  )}
                  strokeWidth={2.5}
                />
              </Link>
            )
          }

          // More menu tab - opens overlay instead of navigating
          if (tab.isMore) {
            const Icon = tab.icon
            return (
              <button
                key={tab.label}
                onClick={openMore}
                className={cn(
                  // Flex column for icon + label
                  "flex flex-col items-center justify-center",
                  // Touch-friendly size (min 44px height)
                  "h-12 min-w-[64px] px-2",
                  // No background, transparent
                  "bg-transparent",
                  // Rounded corners for press state
                  "rounded-lg",
                  // Transition for color changes
                  "transition-colors duration-200",
                  // Active state - show as active when more menu is open
                  isMoreOpen ? "text-primary" : "text-muted-foreground",
                  // Hover state (for devices with hover)
                  "hover:text-primary",
                  // Press state
                  "active:bg-primary/10"
                )}
                aria-label={tab.label}
                aria-expanded={isMoreOpen}
                aria-haspopup="true"
              >
                <Icon
                  className={cn(
                    "h-5 w-5 mb-0.5",
                    isMoreOpen && "stroke-[2.5]"
                  )}
                  strokeWidth={isMoreOpen ? 2.5 : 2}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium leading-tight",
                    isMoreOpen ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {tab.label}
                </span>
                {/* Active indicator dot */}
                {isMoreOpen && (
                  <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
                )}
              </button>
            )
          }

          // Regular tab
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                // Flex column for icon + label
                "flex flex-col items-center justify-center",
                // Touch-friendly size (min 44px height)
                "h-12 min-w-[64px] px-2",
                // No background, transparent
                "bg-transparent",
                // Rounded corners for press state
                "rounded-lg",
                // Transition for color changes
                "transition-colors duration-200",
                // Active state
                active ? "text-primary" : "text-muted-foreground",
                // Hover state (for devices with hover)
                "hover:text-primary",
                // Press state
                "active:bg-primary/10"
              )}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 mb-0.5",
                  active && "stroke-[2.5]"
                )}
                strokeWidth={active ? 2.5 : 2}
              />
              <span
                className={cn(
                  "text-[10px] font-medium leading-tight",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {tab.label}
              </span>
              {/* Active indicator dot */}
              {active && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
    
    {/* More menu overlay */}
    <MobileMoreMenu open={isMoreOpen} onClose={closeMore} />
    </>
  )
}
