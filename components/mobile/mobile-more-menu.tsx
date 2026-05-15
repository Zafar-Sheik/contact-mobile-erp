import * as React from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Users,
  Truck,
  Package,
  Settings,
  Fuel,
  Receipt,
  Folder,
  Building2,
  ShoppingCart,
  Car,
  LogOut,
  Upload,
} from "lucide-react"

export interface MoreMenuItem {
  /**
   * Item label
   */
  label: string
  /**
   * Item icon
   */
  icon?: React.ReactNode
  /**
   * Item action
   */
  action?: () => void
  /**
   * Item href for navigation
   */
  href?: string
  /**
   * Whether the item is destructive
   */
  destructive?: boolean
  /**
   * Disabled state
   */
  disabled?: boolean
}

export interface MobileMoreMenuProps {
  /**
   * Whether the menu is open
   */
  open?: boolean
  /**
   * Callback when menu should close
   */
  onClose?: () => void
  /**
   * Menu items
   */
  items?: MoreMenuItem[]
  /**
   * Custom trigger element
   */
  trigger?: React.ReactNode
  /**
   * Custom className
   */
  className?: string
  /**
   * Menu button label
   */
  label?: string
}

export function useMobileMoreMenu() {
  const [isOpen, setIsOpen] = React.useState(false)

  const open = React.useCallback(() => setIsOpen(true), [])
  const close = React.useCallback(() => setIsOpen(false), [])

  return { isOpen, open, close }
}

// Default navigation items for the mobile menu
const defaultNavItems: MoreMenuItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="w-6 h-6" /> },
  { label: "Invoices", href: "/invoices", icon: <FileText className="w-6 h-6" /> },
  { label: "Demo", href: "/no-vat-invoices", icon: <FileText className="w-6 h-6" /> },
  { label: "Quotes", href: "/quotes", icon: <ClipboardList className="w-6 h-6" /> },
  { label: "Clients", href: "/clients", icon: <Users className="w-6 h-6" /> },
  { label: "Suppliers", href: "/suppliers", icon: <Truck className="w-6 h-6" /> },
  { label: "Stock", href: "/stock-items", icon: <Package className="w-6 h-6" /> },
  { label: "Import Stock", href: "/stock-items/import", icon: <Upload className="w-6 h-6" /> },
  { label: "GRVs", href: "/grvs", icon: <Receipt className="w-6 h-6" /> },
  { label: "Orders", href: "/purchase-orders", icon: <ShoppingCart className="w-6 h-6" /> },
  { label: "Debtor Payments", href: "/bills", icon: <Folder className="w-6 h-6" /> },
  { label: "Vehicles", href: "/vehicles", icon: <Car className="w-6 h-6" /> },
  { label: "Fuel", href: "/fuel-logs", icon: <Fuel className="w-6 h-6" /> },
  { label: "Sites", href: "/sites", icon: <Building2 className="w-6 h-6" /> },
  { label: "Company", href: "/company", icon: <Settings className="w-6 h-6" /> },
  { label: "Logout", href: "", icon: <LogOut className="w-6 h-6" />, destructive: true },
]

export function MobileMoreMenu({
  open,
  onClose,
  items,
  trigger,
  className,
  label = "More options",
}: MobileMoreMenuProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Use controlled component pattern - if open prop is provided, use it; otherwise use internal state
  const isOpen = open !== undefined ? open : internalOpen
  const setIsOpen = open !== undefined 
    ? (value: boolean) => { if (!value) onClose?.() } 
    : setInternalOpen

  // Use provided items or fall back to default navigation items
  const menuItems = items && items.length > 0 ? items : defaultNavItems

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (open !== undefined) {
          onClose?.()
        } else {
          setInternalOpen(false)
        }
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, open, onClose])

  return (
    <div className={cn("relative", className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          if (open !== undefined) {
            onClose?.()
          } else {
            setInternalOpen(!internalOpen)
          }
        }}
        className="flex items-center justify-center rounded-full p-2 hover:bg-gray-100 active:bg-gray-200 transition-colors"
        aria-label={label}
        aria-expanded={isOpen}
      >
        {trigger || (
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
            className="text-gray-600"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-background shadow-xl max-h-[70vh] overflow-y-auto">
          <div className="sticky top-0 bg-gray-50 border-b px-4 py-3">
            <p className="font-bold text-lg text-gray-900">Menu</p>
          </div>
          <div className="px-3 pb-6 grid grid-cols-3 gap-2">
            {menuItems.map((item, index) => {
              if (item.href) {
                return (
                  <Link
                    key={item.label + index}
                    href={item.href}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-white border border-gray-100 text-gray-700 hover:border-blue-200 hover:shadow-sm transition-all active:scale-95"
                    onClick={() => setIsOpen(false)}
                  >
                    <div className="bg-blue-50 p-2 rounded-lg">
                      {item.icon}
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center leading-tight">{item.label}</span>
                  </Link>
                )
              }

              return (
                <button
                  key={item.label + index}
                  type="button"
                  onClick={() => {
                    item.action?.()
                    setIsOpen(false)
                  }}
                  disabled={item.disabled}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 p-2 rounded-xl bg-white border border-gray-100 text-gray-700 hover:border-blue-200 hover:shadow-sm transition-all active:scale-95",
                    item.disabled && "opacity-50 cursor-not-allowed",
                    item.destructive && "hover:border-red-200"
                  )}
                >
                  <div className={cn("bg-blue-50 p-2 rounded-lg", item.destructive ? "text-red-600" : "text-blue-600")}>
                    {item.icon}
                  </div>
                  <span className={cn("text-xs font-medium text-center leading-tight", item.destructive ? "text-red-600" : "text-gray-700")}>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
