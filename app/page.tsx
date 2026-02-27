"use client";

import * as React from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  Package,
  Truck,
  FileText,
  CreditCard,
  ClipboardList,
  MoreHorizontal,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { MobileMoreMenu, useMobileMoreMenu } from "@/components/mobile/mobile-more-menu";
import { Button } from "@/components/ui/button";

// Quick link configuration
const quickLinks = [
  {
    label: "Add Client",
    href: "/clients",
    icon: UserPlus,
    color: "bg-blue-600",
  },
  {
    label: "Add Stock",
    href: "/stock-items",
    icon: Package,
    color: "bg-emerald-600",
  },
  {
    label: "Add Supplier",
    href: "/suppliers",
    icon: Truck,
    color: "bg-amber-600",
  },
  {
    label: "New Invoice",
    href: "/invoices/new",
    icon: FileText,
    color: "bg-purple-600",
  },
  {
    label: "New Payments",
    href: "/supplier-payments",
    icon: CreditCard,
    color: "bg-cyan-600",
  },
  {
    label: "New GRV",
    href: "/grvs",
    icon: ClipboardList,
    color: "bg-rose-600",
  },
];

export default function RootPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);
  const { isOpen, open, close } = useMobileMoreMenu();

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/debug", { method: "GET" });
        const data = await response.json();
        setIsAuthenticated(data.hasSession === true);
      } catch (e) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // Continue even if API fails
    }
    setIsAuthenticated(false);
    router.push("/login");
  };

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">MR Power</h1>
          <p className="text-gray-500">Fleet Management System</p>
        </div>
        <Link href="/login">
          <Button size="lg" className="px-8">
            Sign In
          </Button>
        </Link>
      </div>
    );
  }

  // Show quick links if authenticated
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with logout button */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">
          Quick Links
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </Button>
      </header>

      {/* Main Content - Quick Links Grid */}
      <main className="p-4 pb-28">
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col items-center justify-center p-6 bg-white rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition-transform min-h-[140px]"
              >
                <div className={`${link.color} p-4 rounded-full mb-3`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-800 text-center">
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-gray-400 text-xs mt-8">
          Tap any option to navigate
        </p>
      </main>

      {/* Bottom More Menu Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 pb-safe z-20">
        <button
          onClick={open}
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-xl transition-colors"
        >
          <MoreHorizontal className="w-6 h-6 text-gray-700" />
          <span className="text-base font-medium text-gray-700">More</span>
        </button>
      </div>

      {/* Mobile More Menu */}
      <MobileMoreMenu open={isOpen} onClose={close} />
    </div>
  );
}
