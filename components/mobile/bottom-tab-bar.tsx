import * as React from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"

export interface TabItem {
  /**
   * Tab label
   */
  label: string
  /**
   * Tab href for navigation
   */
  href: string
  /**
   * Icon component or element
   */
  icon: React.ReactNode
  /**
   * Whether this tab is active
   */
  isActive?: boolean
  /**
   * Badge count to display
   */
  badge?: number
  /**
   * Callback when tab is clicked
   */
  onClick?: () => void
}

export interface BottomTabBarProps {
  /**
   * Array of tab items
   */
  tabs: TabItem[]
  /**
   * Custom className
   */
  className?: string
  /**
   * Show tab bar (default true)
   */
  show?: boolean
}

export function BottomTabBar({
  tabs,
  className,
  show = true,
}: BottomTabBarProps) {
  if (!show) return null

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t bg-background px-2",
        className
      )}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.isActive ?? false

        const tabContent = (
          <div
            key={tab.href || index}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-md px-3 py-2 transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={tab.onClick}
          >
            <div className="relative">
              {tab.icon}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">{tab.label}</span>
          </div>
        )

        return tab.onClick ? (
          <div key={tab.href || index}>{tabContent}</div>
        ) : (
          <Link
            key={tab.href || index}
            href={tab.href}
            className={cn(
              "flex-1",
              isActive && "pointer-events-none"
            )}
          >
            {tabContent}
          </Link>
        )
      })}
    </nav>
  )
}
