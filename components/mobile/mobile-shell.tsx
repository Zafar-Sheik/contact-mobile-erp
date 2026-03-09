import * as React from "react"
import { cn } from "@/lib/utils"
import { AppHeader, AppHeaderProps } from "./app-header"
import { BottomTabBar, BottomTabBarProps, TabItem } from "./bottom-tab-bar"
import { Fab, FabProps } from "./fab"

export interface MobileShellProps {
  /**
   * Show the header (default true)
   */
  showHeader?: boolean
  /**
   * Show the bottom tab bar (default true)
   */
  showTabBar?: boolean
  /**
   * Show the floating action button (default false)
   */
  showFab?: boolean
  /**
   * Props for the floating action button
   */
  fabProps?: FabProps
  /**
   * Header props
   */
  headerProps?: Partial<AppHeaderProps>
  /**
   * Tab bar props
   */
  tabBarProps?: Partial<BottomTabBarProps>
  /**
   * Custom className
   */
  className?: string
  /**
   * Children content
   */
  children?: React.ReactNode
}

export function MobileShell({
  showHeader = true,
  showTabBar = true,
  showFab = false,
  fabProps,
  headerProps,
  tabBarProps,
  className,
  children,
}: MobileShellProps) {
  return (
    <div className={cn("min-h-screen bg-background", className)}>
      {showHeader && <AppHeader {...headerProps} />}
      
      <main
        className={cn(
          "flex-1 pb-16",
          !showTabBar && "pb-0",
          showFab && "pb-20"
        )}
      >
        {children}
      </main>

      {showTabBar && tabBarProps?.tabs && (
        <BottomTabBar
          tabs={tabBarProps.tabs}
          show={tabBarProps.show}
          className={tabBarProps.className}
        />
      )}

      {showFab && fabProps && <Fab {...fabProps} />}
    </div>
  )
}
