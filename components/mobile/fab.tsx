import * as React from "react"
import { cn } from "@/lib/utils"

export interface FabProps {
  /**
   * Icon to display in the FAB
   */
  icon?: React.ReactNode
  /**
   * Label for the FAB (for accessibility)
   */
  label?: string
  /**
   * Callback when FAB is clicked
   */
  onClick?: () => void
  /**
   * Href for navigation (optional)
   */
  href?: string
  /**
   * Custom className
   */
  className?: string
  /**
   * Position of the FAB
   */
  position?: "bottom-right" | "bottom-center" | "bottom-left"
  /**
   * Size of the FAB
   */
  size?: "small" | "medium" | "large"
}

export function Fab({
  icon,
  label = "Add",
  onClick,
  href,
  className,
  position = "bottom-right",
  size = "medium",
}: FabProps) {
  const sizeClasses = {
    small: "w-10 h-10",
    medium: "w-14 h-14",
    large: "w-16 h-16",
  }

  const positionClasses = {
    "bottom-right": "right-4 bottom-20",
    "bottom-center": "left-1/2 -translate-x-1/2 bottom-20",
    "bottom-left": "left-4 bottom-20",
  }

  const content = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed z-50 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95",
        sizeClasses[size],
        positionClasses[position],
        className
      )}
      aria-label={label}
    >
      {icon || (
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
          <path d="M12 5v14M5 12h14" />
        </svg>
      )}
    </button>
  )

  if (href) {
    return (
      <a href={href} className="fixed z-50">
        {content}
      </a>
    )
  }

  return content
}
