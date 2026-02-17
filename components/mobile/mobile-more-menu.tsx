"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  LayoutDashboard,
  Package,
  Users,
  Truck,
  Fuel,
  ClipboardList,
  FileText,
  Receipt,
  DollarSign,
  ShoppingCart,
  Building2,
  Activity,
  MapPin,
  X,
  LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MoreMenuItem {
  name: string
  href: string
  icon: LucideIcon
}

interface MoreMenuCategory {
  name: string
  items: MoreMenuItem[]
}

const moreMenuCategories: MoreMenuCategory[] = [
  {
    name: "Inventory",
    items: [
      { name: "Stock Items", href: "/stock-items", icon: Package },
      { name: "Sites", href: "/sites", icon: MapPin },
      { name: "GRVs", href: "/grvs", icon: FileText },
      { name: "Movements", href: "/inventory-movements", icon: Activity },
    ],
  },
  {
    name: "Vehicles",
    items: [
      { name: "Vehicles", href: "/vehicles", icon: Truck },
      { name: "Fuel Logs", href: "/fuel-logs", icon: Fuel },
    ],
  },
  {
    name: "Sales",
    items: [
      { name: "Clients", href: "/clients", icon: Users },
      { name: "Quotes", href: "/quotes", icon: FileText },
      { name: "Invoices", href: "/invoices", icon: Receipt },
    ],
  },
  {
    name: "Purchases",
    items: [
      { name: "Suppliers", href: "/suppliers", icon: Building2 },
      { name: "Supplier Bills", href: "/supplier-bills", icon: Receipt },
      { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
      { name: "Supplier Payments", href: "/supplier-payments", icon: DollarSign },
    ],
  },
  {
    name: "Workflow",
    items: [
      { name: "Workflow Tasks", href: "/workflow-tasks", icon: ClipboardList },
    ],
  },
]

export interface MobileMoreMenuProps {
  open: boolean
  onClose: () => void
}

export function MobileMoreMenu({ open, onClose }: MobileMoreMenuProps) {
  const router = useRouter()
  const [isVisible, setIsVisible] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

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

  // Close on route change
  React.useEffect(() => {
    const handleRouteChange = () => {
      if (open) {
        onClose()
      }
    }
    
    // Listen for navigation
    const originalPush = router.push
    router.push = (href: string) => {
      handleRouteChange()
      return originalPush(href)
    }
    
    return () => {
      router.push = originalPush
    }
  }, [open, onClose, router])

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
      
      {/* Bottom sheet */}
      <div
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="More menu"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden",
          "rounded-t-2xl bg-background",
          "border-t border-border shadow-xl",
          "transition-transform duration-300 ease-out",
          "pb-safe pt-4",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Handle bar */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-4">
          <h2 className="text-lg font-semibold">More</h2>
          <button
            onClick={onClose}
            className={cn(
              "flex h-10 w-10 items-center justify-center",
              "rounded-full bg-muted hover:bg-muted/80",
              "transition-colors duration-200"
            )}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="overflow-y-auto px-4 pb-6" style={{ maxHeight: "calc(85vh - 80px)" }}>
          <div className="grid grid-cols-3 gap-3">
            {moreMenuCategories.flatMap((category) =>
              category.items.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex flex-col items-center justify-center",
                      "gap-2 rounded-xl border border-border",
                      "bg-card p-4 min-h-[90px]",
                      "hover:bg-accent hover:border-accent",
                      "active:scale-95 transition-all duration-150"
                    )}
                  >
                    <Icon className="h-6 w-6 text-primary" strokeWidth={1.5} />
                    <span className="text-center text-xs font-medium text-foreground">
                      {item.name}
                    </span>
                  </Link>
                )
              })
            )}
          </div>
          
          {/* Dashboard shortcut */}
          <Link
            href="/"
            onClick={onClose}
            className={cn(
              "mt-4 flex items-center justify-center gap-2",
              "rounded-xl border border-border",
              "bg-card p-4",
              "hover:bg-accent hover:border-accent",
              "active:scale-95 transition-all duration-150"
            )}
          >
            <LayoutDashboard className="h-5 w-5 text-primary" strokeWidth={1.5} />
            <span className="font-medium">Back to Dashboard</span>
          </Link>
        </div>
      </div>
    </>
  )
}

// Hook to manage the more menu state
export function useMobileMoreMenu() {
  const [isOpen, setIsOpen] = React.useState(false)

  const open = React.useCallback(() => setIsOpen(true), [])
  const close = React.useCallback(() => setIsOpen(false), [])
  const toggle = React.useCallback(() => setIsOpen((prev) => !prev), [])

  return { isOpen, open, close, toggle }
}
