"use client"

import * as React from "react"
import Link from "next/link"
import { Plus, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FabMenuItem {
  /**
   * Label for the menu item
   */
  label: string
  /**
   * Icon for the menu item
   */
  icon: LucideIcon
  /**
   * Href for navigation or onClick handler
   */
  href?: string
  /**
   * Click handler (alternative to href)
   */
  onClick?: () => void
}

export interface FabProps {
  /**
   * Menu items to show when FAB is expanded
   */
  items?: FabMenuItem[]
  /**
   * Default href when FAB is clicked (if no menu)
   */
  href?: string
  /**
   * Click handler (alternative to href)
   */
  onClick?: () => void
  /**
   * Show/hide the FAB
   */
  visible?: boolean
  /**
   * Position offset from bottom
   */
  bottomOffset?: string
  /**
   * Position offset from right
   */
  rightOffset?: string
  /**
   * Additional className
   */
  className?: string
  /**
   * Label for accessibility
   */
  label?: string
}

/**
 * Floating Action Button with expandable menu option.
 * Fixed position, 56px diameter, primary color with shadow.
 */
export function Fab({
  items = [],
  href = "/invoices/new",
  onClick,
  visible = true,
  bottomOffset = "80px",
  rightOffset = "16px",
  className,
  label = "Create new",
}: FabProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("touchstart", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [isOpen])

  const handleFabClick = () => {
    if (items.length > 0) {
      setIsOpen(!isOpen)
    } else if (onClick) {
      onClick()
    }
  }

  const handleItemClick = (item: FabMenuItem) => {
    if (item.onClick) {
      item.onClick()
    }
    setIsOpen(false)
  }

  if (!visible) {
    return null
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50",
        // Position
        `bottom-[${bottomOffset}] right-[${rightOffset}]`,
        // Use inline style for dynamic values
        { bottom: bottomOffset, right: rightOffset },
        className
      )}
    >
      {/* Menu items */}
      {isOpen && items.length > 0 && (
        <div className="absolute bottom-16 right-0 flex flex-col-reverse gap-2">
          {items.map((item, index) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="flex items-center gap-2 animate-scaleIn"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Label */}
                <span className="bg-popover text-popover-foreground text-sm px-3 py-1.5 rounded-md shadow-md whitespace-nowrap">
                  {item.label}
                </span>
                {/* Menu item button */}
                <button
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    // Size
                    "h-12 w-12 rounded-full",
                    // Background
                    "bg-popover border border-border shadow-lg",
                    // Flex center
                    "flex items-center justify-center",
                    // Text
                    "text-popover-foreground",
                    // Hover
                    "hover:bg-accent transition-colors",
                    // Active
                    "active:scale-95"
                  )}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Main FAB button */}
      {href && !onClick && !items.length ? (
        <Link
          href={href}
          className={cn(
            // Base styles
            "flex items-center justify-center",
            // Size - 56px diameter
            "h-14 w-14 rounded-full",
            // Primary color background
            "bg-primary",
            // Shadow
            "shadow-lg shadow-primary/40",
            // Hover animation
            "hover:shadow-xl hover:shadow-primary/50 hover:scale-105",
            // Active press animation
            "active:scale-95",
            // Transition
            "transition-all duration-200",
            // Icon
            "text-primary-foreground"
          )}
          aria-label={label}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </Link>
      ) : (
        <button
          onClick={handleFabClick}
          className={cn(
            // Base styles
            "flex items-center justify-center",
            // Size - 56px diameter
            "h-14 w-14 rounded-full",
            // Primary color background
            "bg-primary",
            // Shadow
            "shadow-lg shadow-primary/40",
            // Hover animation
            "hover:shadow-xl hover:shadow-primary/50 hover:scale-105",
            // Active press animation
            "active:scale-95",
            // Transition
            "transition-all duration-200",
            // Icon
            "text-primary-foreground",
            // Rotate icon when open
            isOpen && "rotate-45"
          )}
          aria-label={label}
          aria-expanded={isOpen}
        >
          <Plus className="h-6 w-6 transition-transform duration-200" strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
