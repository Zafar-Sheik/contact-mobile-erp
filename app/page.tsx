"use client";

import * as React from "react";
import {
  Package,
  Users,
  Truck,
  DollarSign,
  ShoppingCart,
  FileText,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Clock,
  Loader2,
  Receipt,
  ClipboardList,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/lib/hooks/use-api";
import Link from "next/link";
import {
  MobileCard,
  MobileCardCompact,
  MobileCardHeader,
  MobileCardContent,
} from "@/components/mobile/mobile-card";
import { MobileList, MobileListItem } from "@/components/mobile";
import { PageHeader } from "@/components/mobile/page-header";
import { Fab, type FabMenuItem } from "@/components/mobile/fab";
import { BottomTabBar, type TabItem } from "@/components/mobile/bottom-tab-bar";

interface StockItem {
  _id: string;
  name: string;
  quantity: number;
  reorderLevel: number;
}

interface Client {
  _id: string;
  name: string;
  isActive: boolean;
}

interface Vehicle {
  _id: string;
  registration: string;
  isActive: boolean;
}

interface SalesInvoice {
  _id: string;
  total: number;
  status: string;
}

interface PurchaseOrder {
  _id: string;
  status: string;
}

interface InventoryMovement {
  _id: string;
  type: string;
  description: string;
  createdAt: string;
  status: string;
}

interface WorkflowTask {
  _id: string;
  status: string;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  status: string;
}

// FAB menu items for quick actions
const fabMenuItems: FabMenuItem[] = [
  { label: "New Invoice", icon: FileText, href: "/invoices/new" },
  { label: "New Quote", icon: ClipboardList, href: "/quotes/new" },
  { label: "Add Stock", icon: Package, href: "/stock-items" },
  { label: "Add Vehicle", icon: Truck, href: "/vehicles" },
];

// Bottom tab bar configuration
const dashboardTabs: TabItem[] = [
  { label: "Dashboard", icon: TrendingUp, href: "/" },
  { label: "Inventory", icon: Package, href: "/stock-items" },
  { label: "Create", icon: FileText, href: "/invoices/new", isFab: true },
  { label: "Invoices", icon: Receipt, href: "/invoices" },
  { label: "More", icon: ShoppingCart, href: "/purchase-orders" },
];

export default function DashboardPage() {
  const { data: stockItems, loading: loadingStock } = useApi<StockItem[]>("/api/stock-items");
  const { data: clients, loading: loadingClients } = useApi<Client[]>("/api/clients");
  const { data: vehicles, loading: loadingVehicles } = useApi<Vehicle[]>("/api/vehicles");
  const { data: invoices, loading: loadingInvoices } = useApi<SalesInvoice[]>("/api/invoices");
  const { data: orders, loading: loadingOrders } = useApi<PurchaseOrder[]>("/api/purchase-orders");
  const { data: movements, loading: loadingMovements } = useApi<InventoryMovement[]>("/api/inventory-movements");
  const { data: tasks, loading: loadingTasks } = useApi<WorkflowTask[]>("/api/workflow-tasks");

  const loading = loadingStock || loadingClients || loadingVehicles || loadingInvoices || loadingOrders || loadingMovements || loadingTasks;

  const metrics = React.useMemo(() => {
    const stock = stockItems || [];
    const clientList = clients || [];
    const vehicleList = vehicles || [];
    const invoiceList = invoices || [];
    const orderList = orders || [];
    const taskList = tasks || [];

    const totalRevenue = invoiceList.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const pendingOrders = orderList.filter(o => o.status === "pending" || o.status === "approved").length;
    const activeTasks = taskList.filter(t => t.status === "pending" || t.status === "in_progress").length;
    const lowStock = stock.filter(s => s.quantity <= (s.reorderLevel || 0)).length;

    return [
      {
        title: "Stock",
        value: stock.length.toLocaleString(),
        subtitle: "items",
        icon: Package,
        href: "/stock-items",
        color: "bg-blue-100 text-blue-600",
      },
      {
        title: "Clients",
        value: clientList.filter(c => c.isActive !== false).length.toLocaleString(),
        subtitle: "active",
        icon: Users,
        href: "/clients",
        color: "bg-green-100 text-green-600",
      },
      {
        title: "Vehicles",
        value: vehicleList.filter(v => v.isActive !== false).length.toLocaleString(),
        subtitle: "in fleet",
        icon: Truck,
        href: "/vehicles",
        color: "bg-purple-100 text-purple-600",
      },
      {
        title: "Revenue",
        value: `R ${(totalRevenue / 100).toLocaleString()}`,
        subtitle: "total",
        icon: DollarSign,
        href: "/invoices",
        color: "bg-emerald-100 text-emerald-600",
      },
      {
        title: "Orders",
        value: pendingOrders.toString(),
        subtitle: "pending",
        icon: ShoppingCart,
        href: "/purchase-orders",
        color: "bg-orange-100 text-orange-600",
      },
      {
        title: "Tasks",
        value: activeTasks.toString(),
        subtitle: "active",
        icon: Clock,
        href: "/workflow-tasks",
        color: "bg-cyan-100 text-cyan-600",
      },
    ];
  }, [stockItems, clients, vehicles, invoices, orders, tasks]);

  const recentActivities = React.useMemo(() => {
    const acts: Activity[] = [];
    const movs = movements || [];

    movs.slice(0, 8).forEach((m, i) => {
      acts.push({
        id: m._id || i.toString(),
        type: m.type || "Movement",
        description: m.description || "",
        createdAt: m.createdAt || "",
        status: m.status || "pending",
      });
    });

    return acts;
  }, [movements]);

  const lowStockItems = React.useMemo(() => {
    const stock = stockItems || [];
    return stock.filter(s => s.quantity <= (s.reorderLevel || 0)).slice(0, 5);
  }, [stockItems]);

  const quickActions = [
    { title: "Add Stock", href: "/stock-items", icon: Package },
    { title: "New Invoice", href: "/invoices/new", icon: FileText },
    { title: "Add Vehicle", href: "/vehicles", icon: Truck },
    { title: "Record Payment", href: "/customer-payments", icon: DollarSign },
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "secondary" | "destructive" | "default"> = {
      completed: "success",
      pending: "warning",
      approved: "default",
      rejected: "destructive",
      cancelled: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Get activity icon based on type
  const getActivityIcon = (type: string) => {
    const typeLower = type.toLowerCase();
    if (typeLower.includes("stock") || typeLower.includes("inventory")) return Package;
    if (typeLower.includes("invoice") || typeLower.includes("sale")) return FileText;
    if (typeLower.includes("vehicle")) return Truck;
    if (typeLower.includes("client") || typeLower.includes("customer")) return Users;
    return Clock;
  };

  // Get status variant for list item
  const getStatusVariant = (status: string): "success" | "warning" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, "success" | "warning" | "secondary" | "destructive" | "outline"> = {
      completed: "success",
      pending: "warning",
      approved: "outline",
      rejected: "destructive",
      cancelled: "secondary",
    };
    return variants[status] || "outline";
  };

  return (
    <MainLayout
      title="Dashboard"
      showTabBar={true}
      showFab={true}
      tabs={dashboardTabs}
      mobileShellProps={{
        fabProps: {
          items: fabMenuItems,
          visible: true,
          label: "Quick actions",
        },
      }}
    >
      <div className="space-y-4 md:space-y-6 pb-20 md:pb-6">
        {/* Page Header - Mobile */}
        <div className="md:hidden">
          <PageHeader
            title="Dashboard"
            subtitle="Welcome back!"
          />
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back! Here's what's happening with your business.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Reports</span>
            </Button>
            <Button size="sm" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </Button>
          </div>
        </div>

        {/* Quick Actions - Mobile horizontal scroll */}
        <div className="md:hidden">
          <h2 className="text-sm font-semibold mb-2 px-1">Quick Actions</h2>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-3 bg-primary/10 text-primary rounded-xl text-sm font-medium min-h-[48px]"
              >
                <action.icon className="h-5 w-5" />
                {action.title}
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions - Desktop grid */}
        <div className="hidden md:grid grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-muted transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <action.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="font-medium">{action.title}</span>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && (
          <>
            {/* Mobile Metrics - Horizontal scroll cards */}
            <div className="md:hidden">
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <Link key={metric.title} href={metric.href} className="flex-shrink-0 w-28">
                      <MobileCardCompact className="h-24">
                        <div className="flex flex-col h-full justify-between">
                          <div className={`w-10 h-10 rounded-lg ${metric.color} flex items-center justify-center`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xl font-bold">{metric.value}</p>
                            <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
                          </div>
                        </div>
                      </MobileCardCompact>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Desktop Metrics Grid */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-6 gap-3">
              {metrics.map((metric) => (
                <Link key={metric.title} href={metric.href}>
                  <Card className="hover:bg-muted/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${metric.color} flex items-center justify-center`}>
                          <metric.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xl font-bold">{metric.value}</p>
                          <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Mobile Recent Activity - Using MobileList */}
            {recentActivities.length > 0 && (
              <>
                {/* Mobile View */}
                <div className="md:hidden">
                  <div className="px-1 mb-3">
                    <h2 className="text-lg font-semibold">Recent Activity</h2>
                    <p className="text-sm text-muted-foreground">Latest inventory movements</p>
                  </div>
                  <MobileList>
                    {recentActivities.map((activity) => {
                      const ActivityIcon = getActivityIcon(activity.type);
                      return (
                        <MobileListItem
                          key={activity.id}
                          title={activity.type}
                          subtitle={activity.description || "No description"}
                          avatar={{
                            icon: <ActivityIcon className="h-5 w-5" />,
                            className: activity.status === "completed" 
                              ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400"
                              : activity.status === "pending"
                              ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400"
                              : "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400",
                          }}
                          status={{
                            label: activity.status,
                            variant: getStatusVariant(activity.status),
                          }}
                          rightContent={
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatTime(activity.createdAt)}
                            </span>
                          }
                          showChevron={false}
                        />
                      );
                    })}
                  </MobileList>
                </div>

                {/* Desktop View - Table */}
                <Card className="hidden md:block">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentActivities.map((activity) => (
                            <TableRow key={activity.id}>
                              <TableCell>
                                <Badge variant="outline">
                                  {activity.type}
                                </Badge>
                              </TableCell>
                              <TableCell>{activity.description || "No description"}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatTime(activity.createdAt)}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(activity.status)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Low Stock Alerts */}
            {lowStockItems.length > 0 && (
              <>
                {/* Mobile Low Stock - Horizontal scroll cards */}
                <div className="md:hidden">
                  <div className="px-1 mb-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      Low Stock Alerts
                    </h2>
                    <p className="text-sm text-muted-foreground">Items below reorder level</p>
                  </div>
                  <MobileList>
                    {lowStockItems.map((item) => (
                      <MobileListItem
                        key={item._id}
                        title={item.name}
                        subtitle={`${item.quantity} / ${item.reorderLevel || 0} units`}
                        avatar={{
                          icon: <Package className="h-5 w-5" />,
                          className: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900 dark:text-yellow-400",
                        }}
                        status={{
                          label: "Low Stock",
                          variant: "warning",
                        }}
                        showChevron={false}
                      />
                    ))}
                  </MobileList>
                  <div className="mt-4 px-1">
                    <Link href="/stock-items" className="block">
                      <Button variant="outline" size="sm" className="w-full justify-center">
                        View All Stock
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Desktop Low Stock Table */}
                <Card className="hidden md:block border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      Low Stock Alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Current Qty</TableHead>
                          <TableHead className="text-right">Reorder Level</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lowStockItems.map((item, i) => (
                          <TableRow key={item._id || i}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{item.reorderLevel || 0}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="warning">Low Stock</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="mt-4 flex justify-end">
                      <Link href="/stock-items">
                        <Button variant="outline" size="sm">
                          View All Stock
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
