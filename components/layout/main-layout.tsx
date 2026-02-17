"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileShell, MobileShellProps } from "@/components/mobile/mobile-shell"
import { AppHeaderProps } from "@/components/mobile/app-header"
import { TabItem } from "@/components/mobile/bottom-tab-bar"
import { FabProps } from "@/components/mobile/fab"

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
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const isMobile = useMediaQuery("(max-width: 768px)")

  // Close sidebar on mobile by default
  React.useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false)
    } else {
      setSidebarOpen(true)
    }
  }, [isMobile])

  // Mobile view: Use new MobileShell component
  if (isMobile) {
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

  // Desktop view: Keep existing sidebar layout
  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        className="hidden md:flex"
      />

      {/* Main Content Area */}
      <div
        className={cn(
          "min-h-screen transition-all duration-300 ease-in-out",
          sidebarOpen ? "md:ml-64" : "md:ml-16"
        )}
      >
        {/* Desktop Header */}
        <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
                aria-label="Toggle sidebar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
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
              <h1 className="text-lg font-semibold">{title}</h1>
            </div>
            {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
          </div>
        </div>

        <main
          className={cn(
            "pb-20 md:pb-6",
            // Desktop: full width with padding
            "w-full px-4 md:px-6",
            className
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}

export default MainLayout
