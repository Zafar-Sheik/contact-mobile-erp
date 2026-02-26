"use client"

import * as React from "react"
import { X, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export interface BottomSheetProps {
  /**
   * Whether the sheet is open
   */
  open: boolean
  /**
   * Callback when sheet should close
   */
  onClose: () => void
  /**
   * Sheet title
   */
  title?: string
  /**
   * Optional description
   */
  description?: string
  /**
   * Sheet content
   */
  children: React.ReactNode
  /**
   * Footer actions (e.g., Apply, Cancel buttons)
   */
  footer?: React.ReactNode
  /**
   * Sheet size: 'sm', 'md', 'lg', 'xl', 'full'
   */
  size?: "sm" | "md" | "lg" | "xl" | "full"
  /**
   * Show close button
   */
  showCloseButton?: boolean
  /**
   * Enable drag to close
   */
  draggable?: boolean
  /**
   * Additional className
   */
  className?: string
}

/**
 * BottomSheet - A slide-up modal panel for mobile.
 * Perfect for filters, forms, and detailed actions.
 * 
 * Features:
 * - Smooth slide-up animation
 * - Drag to close (optional)
 * - Multiple size variants
 * - Backdrop click to close
 * - Keyboard escape to close
 * - Safe area padding
 */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  showCloseButton = true,
  draggable = true,
  className,
}: BottomSheetProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartY = React.useRef(0)
  const currentTranslate = React.useRef(0)
  const sheetRef = React.useRef<HTMLDivElement>(null)

  // Handle open/close animations
  React.useEffect(() => {
    if (open) {
      setIsVisible(true)
      document.body.style.overflow = "hidden"
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      document.body.style.overflow = ""
      return () => clearTimeout(timer)
    }
  }, [open])

  // Close on escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose()
      }
    }
    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [open, onClose])

  // Drag handlers
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (!draggable) return
    setIsDragging(true)
    dragStartY.current = "touches" in e ? e.touches[0].clientY : e.clientY
    document.body.style.cursor = "grabbing"
  }

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || !draggable) return
    const currentY = "touches" in e ? e.touches[0].clientY : e.clientY
    const deltaY = currentY - dragStartY.current
    
    if (deltaY > 0) {
      currentTranslate.current = deltaY
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${deltaY}px)`
      }
    }
  }

  const handleDragEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    document.body.style.cursor = ""
    
    // If dragged more than 30% of height, close the sheet
    const sheetHeight = sheetRef.current?.offsetHeight || 0
    if (currentTranslate.current > sheetHeight * 0.3) {
      onClose()
    }
    
    // Reset transform
    if (sheetRef.current) {
      sheetRef.current.style.transform = ""
    }
    currentTranslate.current = 0
  }

  // Size classes
  const sizeClasses = {
    sm: "max-h-[40vh]",
    md: "max-h-[50vh]",
    lg: "max-h-[65vh]",
    xl: "max-h-[80vh]",
    full: "max-h-[95vh]",
  }

  if (!isVisible) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
          "transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "bottom-sheet-title" : undefined}
        aria-describedby={description ? "bottom-sheet-description" : undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50",
          "rounded-t-2xl bg-background",
          "border-t border-border shadow-xl",
          "transition-transform duration-300 ease-out",
          "pb-safe pt-2",
          sizeClasses[size],
          open ? "translate-y-0" : "translate-y-full",
          draggable && "cursor-grab active:cursor-grabbing",
          className
        )}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        {/* Drag Handle */}
        {draggable && (
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        )}
        
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-4 pb-2">
            <div className="flex-1">
              {title && (
                <h2 
                  id="bottom-sheet-title" 
                  className="text-lg font-semibold text-foreground"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p 
                  id="bottom-sheet-description" 
                  className="mt-0.5 text-sm text-muted-foreground"
                >
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className={cn(
                  "flex h-10 w-10 items-center justify-center",
                  "rounded-full bg-muted hover:bg-muted/80",
                  "transition-colors duration-200",
                  "shrink-0 ml-2"
                )}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
        
        {/* Content */}
        <div className="overflow-y-auto px-4 pb-4" style={{ maxHeight: footer ? "calc(100% - 80px)" : "100%" }}>
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="sticky bottom-0 border-t bg-background px-4 py-3 pb-safe">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}

// Convenience component for filter sheets
export interface FilterSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  onApply?: () => void
  onReset?: () => void
  applyLabel?: string
  resetLabel?: string
  loading?: boolean
}

export function FilterSheet({
  open,
  onClose,
  title = "Filters",
  children,
  onApply,
  onReset,
  applyLabel = "Apply Filters",
  resetLabel = "Reset",
  loading = false,
}: FilterSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <div className="flex gap-3">
          {onReset && (
            <Button 
              variant="outline" 
              onClick={onReset}
              className="flex-1"
              disabled={loading}
            >
              {resetLabel}
            </Button>
          )}
          {onApply && (
            <Button 
              onClick={onApply}
              className="flex-1"
              disabled={loading}
            >
              {loading ? "Applying..." : applyLabel}
            </Button>
          )}
        </div>
      }
    >
      {children}
    </BottomSheet>
  )
}

// Convenience component for action sheets (simple list of actions)
export interface ActionSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  actions: {
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: "default" | "destructive"
    disabled?: boolean
  }[]
}

export function ActionSheet({
  open,
  onClose,
  title,
  description,
  actions,
}: ActionSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      showCloseButton={false}
    >
      <div className="space-y-1 -mx-2">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => {
              action.onClick()
              onClose()
            }}
            disabled={action.disabled}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-4 py-3",
              "text-left transition-colors",
              "hover:bg-accent active:bg-accent/80",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              action.variant === "destructive" 
                ? "text-destructive hover:bg-destructive/10" 
                : "text-foreground"
            )}
          >
            {action.icon && <span className="shrink-0">{action.icon}</span>}
            <span className="flex-1 font-medium">{action.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  )
}

export default BottomSheet
