"use client"

import * as React from "react"
import { AppHeader, AppHeaderProps } from "./app-header"
import { BottomTabBar, BottomTabBarProps } from "./bottom-tab-bar"
import { Fab, FabProps } from "./fab"
import { cn } from "@/lib/utils"

export interface MobileShellProps {
  /**
   * Children to render in the main content area
   */
  children: React.ReactNode
  /**
   * Props for the AppHeader component
   */
  headerProps?: AppHeaderProps
  /**
   * Props for the BottomTabBar component
   */
  tabBarProps?: BottomTabBarProps
  /**
   * Props for the Fab component
   */
  fabProps?: FabProps
  /**
   * Show/hide the header
   */
  showHeader?: boolean
  /**
   * Show/hide the bottom tab bar
   */
  showTabBar?: boolean
  /**
   * Show/hide the FAB
   */
  showFab?: boolean
  /**
   * Additional className for the main content wrapper
   */
  className?: string
  /**
   * Whether to use custom background color
   */
  backgroundColor?: string
}

/**
 * Mobile Shell - Main AppShell that combines:
 * - AppHeader at top
 * - Scrollable main content area
 * - BottomTabBar at bottom
 * - Optional FAB
 *
 * Includes proper safe area insets for notched devices.
 */
export function MobileShell({
  children,
  headerProps,
  tabBarProps,
  fabProps,
  showHeader = true,
  showTabBar = true,
  showFab = false,
  className,
  backgroundColor,
}: MobileShellProps) {
  // Determine padding for bottom content to avoid overlap with tab bar
  const bottomPadding = showTabBar ? "80px" : "16px"

  return (
    <div
      className={cn(
        // Full viewport height
        "min-h-screen min-h-[100dvh]",
        // Background color
        backgroundColor || "bg-background",
        // Prevent horizontal scroll
        "overflow-x-hidden",
        className
      )}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      {/* App Header */}
      {showHeader && (
        <AppHeader
          {...headerProps}
          // Force showMenuButton from props if provided, otherwise default to false
          showMenuButton={headerProps?.showMenuButton ?? false}
        />
      )}

      {/* Main Content Area */}
      <main
        className={cn(
          // Full width
          "w-full",
          // Min height to fill available space
          "min-h-[calc(100vh-theme(spacing.h-14))]",
          // Padding at bottom to avoid overlap with tab bar
          showTabBar && "pb-mobile-nav",
          // Safe area padding
          "pb-safe",
          // Mobile-optimized scrolling
          "overflow-y-auto",
          // Smooth scrolling
          "scroll-smooth",
          // Hardware acceleration for smoother scrolling
          "translate-z-0"
        )}
      >
        <div className={cn("px-4 pt-4", showTabBar && "pb-4")}>
          {children}
        </div>
      </main>

      {/* Bottom Tab Bar */}
      {showTabBar && <BottomTabBar {...tabBarProps} />}

      {/* Floating Action Button */}
      {showFab && <Fab {...fabProps} />}
    </div>
  )
}

/**
 * Mobile page wrapper with header and tab bar
 * Use this for pages that need the full mobile shell
 */
export interface MobilePageProps {
  /**
   * Page title (shown in header)
   */
  title?: string
  /**
   * Page children
   */
  children: React.ReactNode
  /**
   * User data for header
   */
  user?: AppHeaderProps["user"]
  /**
   * Show back button
   */
  showBackButton?: boolean
  /**
   * Back button href
   */
  backHref?: string
  /**
   * Header actions
   */
  headerActions?: React.ReactNode
  /**
   * Show tab bar
   */
  showTabBar?: boolean
  /**
   * Show FAB
   */
  showFab?: boolean
  /**
   * FAB props
   */
  fabProps?: FabProps
  /**
   * Additional className
   */
  className?: string
}

/**
 * Convenience component for mobile pages with common patterns
 */
export function MobilePage({
  title = "MR Power",
  children,
  user,
  showBackButton = false,
  backHref,
  headerActions,
  showTabBar = true,
  showFab = false,
  fabProps,
  className,
}: MobilePageProps) {
  return (
    <MobileShell
      showTabBar={showTabBar}
      showFab={showFab}
      fabProps={fabProps}
      className={className}
      headerProps={{
        title,
        user,
      }}
    >
      {children}
    </MobileShell>
  )
}
