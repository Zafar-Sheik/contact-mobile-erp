"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
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
  X,
  Home,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

const mainNavigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Stock Items", href: "/stock-items", icon: Package },
  { name: "Categories", href: "/categories", icon: Package },
  { name: "GRVs", href: "/grvs", icon: FileText },
];

const salesNavigation = [
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Sales Quotes", href: "/sales-quotes", icon: ClipboardList },
  { name: "Invoices", href: "/sales-invoices", icon: Receipt },
  { name: "Payments", href: "/customer-payments", icon: DollarSign },
];

const purchaseNavigation = [
  { name: "Suppliers", href: "/suppliers", icon: Building2 },
  { name: "Purchase Orders", href: "/purchase-orders", icon: ShoppingCart },
  { name: "Supplier Invoices", href: "/supplier-invoices", icon: Receipt },
  { name: "Supplier Payments", href: "/supplier-payments", icon: DollarSign },
];

const fleetNavigation = [
  { name: "Vehicles", href: "/vehicles", icon: Truck },
  { name: "Fuel Logs", href: "/fuel-logs", icon: Fuel },
];

const workflowNavigation = [
  { name: "Tasks", href: "/workflow-tasks", icon: ClipboardList },
];

function NavSection({
  title,
  items,
  pathname,
  onItemClick,
}: {
  title: string;
  items: { name: string; href: string; icon: React.ElementType }[];
  pathname: string;
  onItemClick: () => void;
}) {
  return (
    <div className="px-3 py-2">
      <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onItemClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigation = (href: string) => {
    onClose();
    router.push(href);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-full max-w-sm bg-card shadow-lg">
        <div className="flex h-16 items-center justify-between border-b px-4">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">MR Power</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-8rem)]">
          <NavSection
            title="Main"
            items={mainNavigation}
            pathname={pathname}
            onItemClick={onClose}
          />

          <Separator className="my-4" />

          <NavSection
            title="Sales"
            items={salesNavigation}
            pathname={pathname}
            onItemClick={onClose}
          />

          <Separator className="my-4" />

          <NavSection
            title="Purchases"
            items={purchaseNavigation}
            pathname={pathname}
            onItemClick={onClose}
          />

          <Separator className="my-4" />

          <NavSection
            title="Fleet"
            items={fleetNavigation}
            pathname={pathname}
            onItemClick={onClose}
          />

          <Separator className="my-4" />

          <NavSection
            title="Workflow"
            items={workflowNavigation}
            pathname={pathname}
            onItemClick={onClose}
          />
        </ScrollArea>

        <div className="border-t p-4">
          <Button variant="outline" className="w-full" onClick={() => {}}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
