"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Edit,
  Trash2,
  ShoppingCart,
  MoreHorizontal,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApi, apiCreate, apiUpdate, apiDelete } from "@/lib/hooks/use-api";
import { MobileMoreMenu, useMobileMoreMenu } from "@/components/mobile/mobile-more-menu";
import { StockItemSelector, StockItemSelectorTrigger, StockItemSelectorItem } from "@/components/erp/stock-item-selector";

// Types
interface Supplier {
  _id: string;
  name: string;
}

interface StockItem {
  _id: string;
  sku: string;
  name: string;
  description: string;
  unit: string;
  pricing: {
    costPriceCents: number;
  };
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierId: string | Supplier;
  supplierName?: string;
  date: string;
  expectedDelivery: string;
  total: number;
  status: string;
  notes?: string;
}

interface POLine {
  stockItemId: string;
  stockItemName: string;
  skuSnapshot: string;
  nameSnapshot: string;
  descriptionSnapshot: string;
  unitSnapshot: string;
  description: string;
  orderedQty: number;
  unitCostCents: number;
  subtotalCents: number;
}

interface OrderFormData {
  supplierId: string;
  date: string;
  expectedDelivery: string;
  notes: string;
  status: string;
  lines: POLine[];
}

const initialFormData: OrderFormData = {
  supplierId: "",
  date: new Date().toISOString().split("T")[0],
  expectedDelivery: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  notes: "",
  status: "Draft",
  lines: [],
};

const statusOptions = ["Draft", "Issued", "PartiallyReceived", "FullyReceived", "Closed", "Cancelled"];

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
};

// Format date
const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Status colors
const getStatusColors = (status: string) => {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    Draft: { bg: "bg-gray-100", text: "text-gray-700", label: "Draft" },
    Issued: { bg: "bg-blue-100", text: "text-blue-700", label: "Issued" },
    PartiallyReceived: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Partial" },
    FullyReceived: { bg: "bg-green-100", text: "text-green-700", label: "Received" },
    Closed: { bg: "bg-purple-100", text: "text-purple-700", label: "Closed" },
    Cancelled: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
  };
  return colors[status] || colors.Draft;
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API hooks
  const { data: orders, loading, error, refetch } = useApi<PurchaseOrder[]>("/api/purchase-orders");
  const { data: suppliers } = useApi<Supplier[]>("/api/suppliers");

  // Modal state for stock item selector
  const [isSelectorOpen, setIsSelectorOpen] = React.useState(false);
  const [activeLineIndex, setActiveLineIndex] = React.useState<number | null>(null);

  // State
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedOrder, setSelectedOrder] = React.useState<PurchaseOrder | null>(null);
  const [formData, setFormData] = React.useState<OrderFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filter orders
  const filteredOrders = React.useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => {
      const matchesSearch =
        !searchTerm ||
        order.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.supplierName && order.supplierName.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [orders, searchTerm]);

  const handleOpenDialog = (order?: PurchaseOrder) => {
    if (order) {
      setSelectedOrder(order);
      const supplierId = typeof order.supplierId === "object" ? order.supplierId._id : order.supplierId;
      // Handle lines if they exist on the order - map snapshot fields
      const orderLines: POLine[] = (order as any).lines?.map((line: any) => ({
        stockItemId: line.stockItemId?._id || line.stockItemId || "",
        stockItemName: line.nameSnapshot || line.stockItemId?.name || line.description || "",
        skuSnapshot: line.skuSnapshot || "",
        nameSnapshot: line.nameSnapshot || "",
        descriptionSnapshot: line.descriptionSnapshot || "",
        unitSnapshot: line.unitSnapshot || "",
        description: line.description || "",
        orderedQty: line.quantity || line.orderedQty || 0,
        unitCostCents: line.unitCostCents || 0,
        subtotalCents: line.subtotalCents || 0,
      })) || [];
      setFormData({
        supplierId: supplierId || "",
        date: order.date ? new Date(order.date).toISOString().split("T")[0] : "",
        expectedDelivery: order.expectedDelivery ? new Date(order.expectedDelivery).toISOString().split("T")[0] : "",
        notes: order.notes || "",
        status: order.status || "Draft",
        lines: orderLines,
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
    if (!formData.supplierId) {
      toast({ title: "Error", description: "Please select a supplier", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const orderData = {
        supplierId: formData.supplierId,
        date: formData.date,
        expectedDelivery: formData.expectedDelivery,
        notes: formData.notes || undefined,
        status: formData.status,
        lines: formData.lines.map(line => {
          // Validate line has required fields
          const description = line.description || line.stockItemName || "No description";
          if (!description) {
            return null;
          }
          return {
            stockItemId: line.stockItemId || undefined,
            quantity: line.orderedQty || 1,
            // Snapshots
            skuSnapshot: line.skuSnapshot || "",
            nameSnapshot: line.nameSnapshot || line.stockItemName || "",
            descriptionSnapshot: line.descriptionSnapshot || "",
            unitSnapshot: line.unitSnapshot || "",
            // Legacy
            description: description,
            orderedQty: line.orderedQty || 1,
            unitCostCents: line.unitCostCents || 0,
          };
        }).filter(Boolean),
      };

      if (selectedOrder) {
        await apiUpdate<PurchaseOrder, typeof orderData>("/api/purchase-orders", selectedOrder._id, orderData);
        toast({ title: "Success", description: "Purchase order updated successfully" });
      } else {
        await apiCreate<PurchaseOrder, typeof orderData>("/api/purchase-orders", orderData);
        toast({ title: "Success", description: "Purchase order created successfully" });
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
      toast({ title: "Success", description: "Purchase order deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSelectedOrder(null);
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

  // Line item handlers
  const addLineItem = () => {
    const newLine: POLine = {
      stockItemId: "",
      stockItemName: "",
      skuSnapshot: "",
      nameSnapshot: "",
      descriptionSnapshot: "",
      unitSnapshot: "",
      description: "",
      orderedQty: 1,
      unitCostCents: 0,
      subtotalCents: 0,
    };
    setFormData((prev) => ({ ...prev, lines: [...prev.lines, newLine] }));
  };

  const removeLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  // Open stock item selector for specific line
  const openSelectorForLine = (lineIndex: number) => {
    setActiveLineIndex(lineIndex);
    setIsSelectorOpen(true);
  };

  // Handle stock item selection from modal
  const handleStockItemSelect = (item: StockItemSelectorItem, priceCents: number) => {
    if (activeLineIndex === null) return;
    
    setFormData((prev) => {
      const newLines = [...prev.lines];
      const line = { ...newLines[activeLineIndex] };
      
      line.stockItemId = item._id;
      line.stockItemName = item.name;
      // Store snapshots
      line.skuSnapshot = item.sku;
      line.nameSnapshot = item.name;
      line.descriptionSnapshot = item.description || "";
      line.unitSnapshot = item.unit;
      line.description = item.description || item.name;
      line.unitCostCents = priceCents; // Use the default cost price from selector
      if (line.orderedQty === 0) {
        line.orderedQty = 1; // Default quantity to 1
      }
      
      // Recalculate subtotal
      line.subtotalCents = (line.orderedQty || 0) * (line.unitCostCents || 0);
      newLines[activeLineIndex] = line;
      return { ...prev, lines: newLines };
    });
    
    setActiveLineIndex(null);
  };

  const updateLineItem = (index: number, field: keyof POLine, value: any) => {
    setFormData((prev) => {
      const newLines = [...prev.lines];
      const line = { ...newLines[index] };
      
      (line as any)[field] = value;
      
      // Recalculate subtotal
      line.subtotalCents = (line.orderedQty || 0) * (line.unitCostCents || 0);
      newLines[index] = line;
      return { ...prev, lines: newLines };
    });
  };

  // Calculate total
  const totalCents = React.useMemo(() => {
    return formData.lines.reduce((sum, line) => sum + (line.subtotalCents || 0), 0);
  }, [formData.lines]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Purchase Orders</h1>
          <Button size="icon" variant="ghost" onClick={openMore} className="h-10 w-10">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search orders..."
            className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Main Content */}
      <main className="p-4 pb-24">
        {/* Loading State */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-red-600 font-medium">Error loading orders</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <ShoppingCart className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No orders found" : "No purchase orders yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? "Try a different search term" : "Create your first purchase order"}
            </p>
          </div>
        )}

        {/* Orders List */}
        {!loading && !error && filteredOrders.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredOrders.map((order) => {
              const statusColors = getStatusColors(order.status);
              const supplierName = typeof order.supplierId === "object" ? order.supplierId.name : order.supplierName || "Unknown";
              
              return (
                <div
                  key={order._id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform cursor-pointer"
                  onClick={() => router.push(`/purchase-orders/${order._id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 p-2 rounded-full">
                        <ShoppingCart className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{order.poNumber}</h3>
                        <p className="text-sm text-gray-500">{supplierName}</p>
                      </div>
                    </div>
                    <Badge className={`${statusColors.bg} ${statusColors.text} ml-2 shrink-0`}>
                      {statusColors.label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pl-12">
                    <span className="text-sm text-gray-500">
                      {order.expectedDelivery ? `Due ${formatDate(order.expectedDelivery)}` : formatDate(order.date)}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(order.total)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDialog(order);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrder(order);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Add Button */}
      <div className="fixed bottom-20 right-4 z-20">
        <Button
          onClick={() => handleOpenDialog()}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
        >
          <span className="text-2xl text-white font-bold">+</span>
        </Button>
      </div>

      {/* Bottom More Menu Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 pb-safe z-20">
        <button
          onClick={openMore}
          className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-xl transition-colors"
        >
          <MoreHorizontal className="w-6 h-6 text-gray-700" />
          <span className="text-base font-medium text-gray-700">More</span>
        </button>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedOrder ? "Edit Order" : "New Order"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select
                value={formData.supplierId}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, supplierId: value }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select supplier" />
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery</Label>
                <Input
                  type="date"
                  value={formData.expectedDelivery}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expectedDelivery: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
              />
            </div>

            {/* Line Items Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Line Items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                  className="h-8 text-blue-600 border-blue-600"
                >
                  + Add Item
                </Button>
              </div>

              {formData.lines.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-gray-500 text-sm">No items added yet</p>
                  <p className="text-gray-400 text-xs">Click "Add Item" to add stock items</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {formData.lines.map((line, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500">Item {index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLineItem(index)}
                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>

                      <StockItemSelectorTrigger
                        onClick={() => openSelectorForLine(index)}
                        hasSelection={!!line.stockItemId}
                        itemName={line.stockItemName || line.description}
                        itemSku={(line as any).skuSnapshot}
                        itemUnit={(line as any).unitSnapshot}
                      />

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            value={line.orderedQty}
                            onChange={(e) => updateLineItem(index, "orderedQty", parseInt(e.target.value) || 0)}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Unit Cost (R)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitCostCents / 100}
                            onChange={(e) => updateLineItem(index, "unitCostCents", Math.round(parseFloat(e.target.value || "0") * 100))}
                            className="h-9"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <span className="text-sm font-semibold text-gray-700">
                          Subtotal: {formatCurrency(line.subtotalCents)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              {formData.lines.length > 0 && (
                <div className="flex justify-between items-center py-2 px-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="text-lg font-bold text-blue-700">{formatCurrency(totalCents)}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseDialog} className="flex-1 h-12">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.supplierId}
              className="flex-1 h-12"
            >
              {isSubmitting ? "Saving..." : selectedOrder ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Item Selector Modal */}
      <StockItemSelector
        open={isSelectorOpen}
        onOpenChange={setIsSelectorOpen}
        onSelect={handleStockItemSelect}
        onCreateNew={() => router.push("/stock-items?new=true")}
        activeLineIndex={activeLineIndex ?? undefined}
        mode="purchase"
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this purchase order? This action cannot be undone.
          </p>
          <AlertDialogFooter className="flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="flex-1 h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="flex-1 h-12 bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile More Menu */}
      <MobileMoreMenu open={isMoreOpen} onClose={closeMore} />
    </div>
  );
}
