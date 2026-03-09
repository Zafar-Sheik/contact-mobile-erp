"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { MobileShell, MobileShellProps } from "../mobile/mobile-shell"
import { AppHeaderProps } from "../mobile/app-header"
import { TabItem } from "../mobile/bottom-tab-bar"
import { FabProps } from "../mobile/fab"

// Inline media query hook to avoid module resolution issues
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia(query)
    if (media.matches !== matches) {
      setMatches(media.matches)
    }

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [matches, query])

  return matches
}

interface MainLayoutProps {
  children: React.ReactNode
  className?: string
  /**
   * User data for the header (used in mobile view)
   */
  user?: AppHeaderProps["user"]
  /**
   * Page title (used in mobile view)
   */
  title?: string
  /**
   * Show back button in mobile header
   */
  showBackButton?: boolean
  /**
   * Back button href
   */
  backHref?: string
  /**
   * Custom header actions
   */
  headerActions?: React.ReactNode
  /**
   * Show tab bar (default true)
   */
  showTabBar?: boolean
  /**
   * Show FAB (default false)
   */
  showFab?: boolean
  /**
   * FAB props for the floating action button
   */
  fabProps?: FabProps
  /**
   * Custom tabs for bottom tab bar
   */
  tabs?: TabItem[]
  /**
   * Custom header props
   */
  headerProps?: Partial<AppHeaderProps>
  /**
   * Mobile shell props
   */
  mobileShellProps?: Partial<MobileShellProps>
}

export function MainLayout({
  children,
  className,
  user,
  title = "MR Power",
  showBackButton = false,
  backHref,
  headerActions,
  showTabBar = true,
  showFab = false,
  fabProps,
  tabs,
  headerProps,
  mobileShellProps,
}: MainLayoutProps) {
  // Always use mobile layout - no desktop sidebar
  return (
    <MobileShell
      showHeader={true}
      showTabBar={showTabBar}
      showFab={showFab}
      fabProps={fabProps}
      className={className}
      headerProps={{
        title,
        user,
        showMenuButton: showBackButton,
        ...headerProps,
      }}
      tabBarProps={{
        tabs,
      }}
      {...mobileShellProps}
    >
      {children}
    </MobileShell>
  )
}

export default MainLayout
