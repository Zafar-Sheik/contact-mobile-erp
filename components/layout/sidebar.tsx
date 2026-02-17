"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
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
  ChevronLeft,
  ChevronRight,
  Settings,
  Menu,
  Activity,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Stock Items", href: "/stock-items", icon: Package },
  { name: "Sites", href: "/sites", icon: MapPin },
  { name: "GRVs", href: "/grvs", icon: FileText },
  { name: "Inventory Movements", href: "/inventory-movements", icon: Activity },
  { name: "Vehicles", href: "/vehicles", icon: Truck },
  { name: "Fuel Logs", href: "/fuel-logs", icon: Fuel },
]

const salesNavigation = [
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Quotes", href: "/quotes", icon: FileText },
  { name: "Invoices", href: "/invoices", icon: Receipt },
]

const purchaseNavigation = [
  { name: "Suppliers", href: "/suppliers", icon: Building2 },
  { name: "Supplier Bills", href: "/supplier-bills", icon: Receipt },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Supplier Payments", href: "/supplier-payments", icon: DollarSign },
]

const workflowNavigation = [
  { name: "Workflow Tasks", href: "/workflow-tasks", icon: ClipboardList },
]

interface SidebarProps {
  className?: string
  isOpen?: boolean
  onToggle?: () => void
}

export function Sidebar({ className, isOpen = true, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-card transition-all duration-300 ease-in-out",
        isOpen ? "w-64" : "w-16",
        className
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          {isOpen && (
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Package className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold">MR Power</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8"
          >
            {isOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-accent-foreground")} />
                  {isOpen && <span>{item.name}</span>}
                </Link>
              )
            })}
          </nav>

          <Separator className="my-4" />

          {/* Sales Navigation */}
          {isOpen && (
            <div className="px-4 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sales
              </span>
            </div>
          )}
          <nav className="space-y-1 px-2">
            {salesNavigation.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-accent-foreground")} />
                  {isOpen && <span>{item.name}</span>}
                </Link>
              )
            })}
          </nav>

          <Separator className="my-4" />

          {/* Purchase Navigation */}
          {isOpen && (
            <div className="px-4 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Purchases
              </span>
            </div>
          )}
          <nav className="space-y-1 px-2">
            {purchaseNavigation.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-accent-foreground")} />
                  {isOpen && <span>{item.name}</span>}
                </Link>
              )
            })}
          </nav>

          <Separator className="my-4" />

          {/* Workflow Navigation */}
          {isOpen && (
            <div className="px-4 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Workflow
              </span>
            </div>
          )}
          <nav className="space-y-1 px-2">
            {workflowNavigation.map((item) => {
              const isActive = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-accent-foreground")} />
                  {isOpen && <span>{item.name}</span>}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          <Link
            href="/settings"
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Settings className="h-5 w-5" />
            {isOpen && <span>Settings</span>}
          </Link>
        </div>
      </div>
    </aside>
  )
}
