"use client";

import * as React from "react";
import {
  Plus,
  ShoppingCart,
  Loader2,
  MoreVertical,
  Calendar,
  FileText,
  Edit,
  Trash2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApi, apiCreate, apiUpdate, apiDelete } from "@/lib/hooks/use-api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mobile components
import { PageHeader } from "@/components/mobile/page-header";
import { SearchBar } from "@/components/mobile/search-bar";
import { MobileList, MobileListItemWrapper } from "@/components/mobile/mobile-list";
import { MobileListItem } from "@/components/mobile/mobile-list-item";
import { EmptyState } from "@/components/mobile/empty-state";
import { Fab } from "@/components/mobile/fab";

interface Supplier {
  _id: string;
  name: string;
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierId?: string;
  supplierName?: string;
  date: string;
  expectedDelivery: string;
  total: number;
  status: string;
  notes?: string;
  isActive?: boolean;
}

interface OrderFormData {
  supplierId: string;
  date: string;
  expectedDelivery: string;
  notes: string;
  status: string;
  isActive: boolean;
}

const initialFormData: OrderFormData = {
  supplierId: "",
  date: new Date().toISOString().split("T")[0],
  expectedDelivery: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  notes: "",
  status: "Draft",
  isActive: true,
};

const statusOptions = ["Draft", "Issued", "PartiallyReceived", "FullyReceived", "Closed", "Cancelled"];

export default function PurchaseOrdersPage() {
  const { toast } = useToast();
  const { data: orders, loading, error, refetch } = useApi<PurchaseOrder[]>("/api/purchase-orders");
  const { data: suppliers } = useApi<Supplier[]>("/api/suppliers");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<PurchaseOrder | null>(null);
  const [formData, setFormData] = React.useState<OrderFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const filteredOrders = React.useMemo(() => {
    if (!orders) return [];
    return orders.filter(
      (order) =>
        order.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.supplierName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [orders, searchTerm]);

  const handleOpenDialog = (order?: PurchaseOrder) => {
    if (order) {
      setSelectedOrder(order);
      setFormData({
        supplierId: order.supplierId || "",
        date: order.date ? new Date(order.date).toISOString().split("T")[0] : "",
        expectedDelivery: order.expectedDelivery ? new Date(order.expectedDelivery).toISOString().split("T")[0] : "",
        notes: order.notes || "",
        status: order.status || "Draft",
        isActive: order.isActive ?? true,
      });
    } else {
      setSelectedOrder(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedOrder(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const orderData = {
        supplierId: formData.supplierId || undefined,
        date: formData.date,
        expectedDelivery: formData.expectedDelivery,
        notes: formData.notes || undefined,
        status: formData.status,
        isActive: formData.isActive,
      };

      if (selectedOrder) {
        await apiUpdate<PurchaseOrder>("/api/purchase-orders", selectedOrder._id, orderData);
        toast({ title: "Success", description: "Order updated successfully" });
      } else {
        await apiCreate<PurchaseOrder>("/api/purchase-orders", orderData);
        toast({ title: "Success", description: "Order created successfully" });
      }

      handleCloseDialog();
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedOrder) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/purchase-orders", selectedOrder._id);
      toast({ title: "Success", description: "Order deleted successfully" });
      handleDeleteCloseDialog();
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCloseDialog = () => {
    setIsDeleteDialogOpen(false);
    setSelectedOrder(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "secondary" | "destructive" | "default"> = {
      Draft: "default",
      Issued: "warning",
      PartiallyReceived: "warning",
      FullyReceived: "success",
      Closed: "secondary",
      Cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getStatusVariant = (status: string): "success" | "warning" | "secondary" | "destructive" | "default" => {
    const variants: Record<string, "success" | "warning" | "secondary" | "destructive" | "default"> = {
      Draft: "default",
      Issued: "warning",
      PartiallyReceived: "warning",
      FullyReceived: "success",
      Closed: "secondary",
      Cancelled: "destructive",
    };
    return variants[status] || "secondary";
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(cents / 100);
  };

  return (
    <MainLayout showTabBar={true} showFab={true}>
      <div className="space-y-4 md:space-y-6">
        {/* Page Header - Mobile */}
        <div className="md:hidden">
          <PageHeader
            title="Purchase Orders"
            subtitle="Manage purchase orders to suppliers"
            primaryAction={{
              label: "New Order",
              onClick: () => handleOpenDialog(),
              icon: <Plus className="h-4 w-4" />,
            }}
          />
          <div className="px-4">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search orders..."
            />
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Purchase Orders</h1>
            <p className="text-muted-foreground">Manage purchase orders to suppliers</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="w-full gap-2 md:w-auto" size="lg">
            <Plus className="h-5 w-5" />New Order
          </Button>
        </div>

        {/* Desktop Search */}
        <div className="hidden md:block">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search orders..."
          />
        </div>

        {orders && orders.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-xl font-bold md:text-2xl">{orders.length}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Draft</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-yellow-600 md:text-2xl">{orders.filter(o => o.status === "Draft").length}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Issued</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-blue-600 md:text-2xl">{orders.filter(o => o.status === "Issued").length}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Value</CardTitle></CardHeader><CardContent><div className="text-xl font-bold md:text-2xl">{formatCurrency(orders.reduce((sum, o) => sum + (o.total || 0), 0))}</div></CardContent></Card>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-destructive">Error loading orders</p>
                <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State - Mobile */}
        {!loading && !error && filteredOrders.length === 0 && searchTerm && (
          <div className="md:hidden px-4">
            <EmptyState
              iconType="search"
              title={`No results for "${searchTerm}"`}
              description="Try searching with different keywords or check your spelling."
              action={{
                label: "Clear search",
                onClick: () => setSearchTerm(""),
              }}
            />
          </div>
        )}

        {/* Empty State - Desktop */}
        {!loading && !error && filteredOrders.length === 0 && !searchTerm && (
          <div className="hidden md:block">
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No orders found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Get started by creating your first order</p>
                  <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />New Order</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mobile List */}
        {!loading && !error && filteredOrders.length > 0 && (
          <div className="md:hidden px-4">
            <MobileList
              loading={loading}
              emptyState={{
                icon: <ShoppingCart className="h-10 w-10" />,
                title: "No orders found",
                description: searchTerm 
                  ? "Try adjusting your search" 
                  : "Get started by creating your first order",
                action: searchTerm 
                  ? { label: "Clear search", onClick: () => setSearchTerm("") }
                  : { label: "New Order", onClick: () => handleOpenDialog() },
              }}
            >
              {filteredOrders.map((order) => (
                <MobileListItemWrapper
                  key={order._id}
                  onClick={() => handleOpenDialog(order)}
                >
                  <MobileListItem
                    title={order.poNumber}
                    subtitle={order.supplierName || "No supplier"}
                    description={`Expected: ${order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : "-"}`}
                    avatar={{
                      icon: <FileText className="h-5 w-5 text-primary" />,
                      fallback: order.poNumber.substring(0, 2).toUpperCase(),
                    }}
                    status={{
                      label: order.status,
                      variant: getStatusVariant(order.status),
                    }}
                    showChevron={false}
                    rightContent={
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {formatCurrency(order.total || 0)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 touch-target"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenDialog(order); }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedOrder(order); 
                                setIsDeleteDialogOpen(true); 
                              }} 
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    }
                  />
                </MobileListItemWrapper>
              ))}
            </MobileList>
          </div>
        )}

        {/* Desktop Table */}
        {!loading && !error && filteredOrders.length > 0 && (
          <div className="hidden md:block rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Expected Delivery</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order._id}>
                      <TableCell className="font-medium">{order.poNumber}</TableCell>
                      <TableCell>{order.supplierName || "-"}</TableCell>
                      <TableCell>{order.date ? new Date(order.date).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>{order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(order.total || 0)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(order)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setSelectedOrder(order); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <Fab
        visible={true}
        onClick={() => handleOpenDialog()}
        label="New Order"
      />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedOrder ? "Edit Order" : "New Order"}</DialogTitle>
            <DialogDescription>{selectedOrder ? "Update order information below" : "Enter information to create a new order"}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Select value={formData.supplierId} onValueChange={(value) => setFormData({ ...formData, supplierId: value })}>
                  <SelectTrigger id="supplier">
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers?.map((supplier) => (
                      <SelectItem key={supplier._id} value={supplier._id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedDelivery">Expected Delivery</Label>
                  <Input id="expectedDelivery" type="date" value={formData.expectedDelivery} onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select id="status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full h-10 px-3 border rounded-md">
                  {statusOptions.map((status) => (<option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes..." />
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="h-5 w-5 rounded border-gray-300" />
                <Label htmlFor="isActive">Active order</Label>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selectedOrder ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete this order.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCloseDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
