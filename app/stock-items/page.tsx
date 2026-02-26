"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  ArrowLeft,
  PackageX,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

// StockItem type matching the model (response from API)
interface StockItem {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  siteId?: { _id: string; name: string } | string;
  inventory: {
    onHand: number;
    reorderLevel: number;
    reorderQuantity?: number;
    location?: string;
    binNumber?: string;
  };
  pricing: {
    salePriceCents: number;
    costPriceCents: number;
    markupPercent?: number;
  };
  supplierId?: { _id: string; name: string } | string;
  unit: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface StockItemFormData {
  sku: string;
  name: string;
  description: string;
  onHand: string;
  reorderLevel: string;
  salePriceCents: string;
  costPriceCents: string;
  unit: string;
  isActive: boolean;
}

const initialFormData: StockItemFormData = {
  sku: "",
  name: "",
  description: "",
  onHand: "0",
  reorderLevel: "0",
  salePriceCents: "0",
  costPriceCents: "0",
  unit: "each",
  isActive: true,
};

const units = ["each", "kg", "liter", "meter", "box", "pack", "roll", "pair", "set"];

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
};

export default function StockItemsPage() {
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API hooks
  const { data: stockItems, loading, error, refetch } = useApi<StockItem[]>("/api/stock-items");

  // State
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<StockItem | null>(null);
  const [formData, setFormData] = React.useState<StockItemFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filter items
  const filteredItems = React.useMemo(() => {
    if (!stockItems) return [];
    return stockItems.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [stockItems, searchTerm]);

  // Get status info
  const getStatusInfo = (item: StockItem): { label: string; variant: "success" | "warning" | "destructive" } => {
    const qty = item.inventory?.onHand ?? 0;
    const reorderLevel = item.inventory?.reorderLevel ?? 0;
    
    if (qty === 0) {
      return { label: "Out of Stock", variant: "destructive" };
    }
    if (qty <= reorderLevel) {
      return { label: "Low Stock", variant: "warning" };
    }
    return { label: "In Stock", variant: "success" };
  };

  const handleOpenDialog = (item?: StockItem) => {
    if (item) {
      setSelectedItem(item);
      setFormData({
        sku: item.sku || "",
        name: item.name || "",
        description: item.description || "",
        onHand: String(item.inventory?.onHand ?? 0),
        reorderLevel: String(item.inventory?.reorderLevel ?? 0),
        salePriceCents: String((item.pricing?.salePriceCents ?? 0) / 100),
        costPriceCents: String((item.pricing?.costPriceCents ?? 0) / 100),
        unit: item.unit || "each",
        isActive: item.isActive ?? true,
      });
    } else {
      setSelectedItem(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedItem(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const itemData = {
        sku: formData.sku,
        name: formData.name,
        description: formData.description || undefined,
        inventory: {
          onHand: Number(formData.onHand),
          reorderLevel: Number(formData.reorderLevel),
        },
        pricing: {
          salePriceCents: Math.round(Number(formData.salePriceCents) * 100),
          costPriceCents: Math.round(Number(formData.costPriceCents) * 100),
        },
        unit: formData.unit,
        isActive: formData.isActive,
      };

      if (selectedItem) {
        await apiUpdate<StockItem, typeof itemData>("/api/stock-items", selectedItem._id, itemData);
        toast({ title: "Success", description: "Stock item updated successfully" });
      } else {
        await apiCreate<StockItem, typeof itemData>("/api/stock-items", itemData);
        toast({ title: "Success", description: "Stock item created successfully" });
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
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/stock-items", selectedItem._id);
      toast({ title: "Success", description: "Stock item deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSelectedItem(null);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Stock Items</h1>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={openMore}
              className="h-10 w-10"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search items..."
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
            <p className="text-red-600 font-medium">Error loading items</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <PackageX className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No items found" : "No stock items yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? "Try a different search term" : "Add your first stock item to get started"}
            </p>
          </div>
        )}

        {/* Stock Items List */}
        {!loading && !error && filteredItems.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredItems.map((item) => {
              const status = getStatusInfo(item);
              return (
                <div
                  key={item._id}
                  onClick={() => handleOpenDialog(item)}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{item.name}</h3>
                      <p className="text-sm text-gray-500">{item.sku}</p>
                    </div>
                    <Badge
                      variant={
                        status.variant === "success"
                          ? "success"
                          : status.variant === "warning"
                          ? "warning"
                          : "destructive"
                      }
                      className="ml-2 shrink-0"
                    >
                      {status.label}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        <span className="font-medium">{item.inventory?.onHand ?? 0}</span> {item.unit}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-600">
                        {formatCurrency(item.pricing?.salePriceCents || 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDialog(item);
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
                          setSelectedItem(item);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
          +
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
              {selectedItem ? "Edit Stock Item" : "Add Stock Item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="SKU-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Item name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="onHand">Quantity</Label>
                <Input
                  id="onHand"
                  type="number"
                  min="0"
                  value={formData.onHand}
                  onChange={(e) => setFormData({ ...formData, onHand: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorderLevel">Reorder Level</Label>
                <Input
                  id="reorderLevel"
                  type="number"
                  min="0"
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                  className="h-12"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="salePrice">Sale Price (ZAR)</Label>
                <Input
                  id="salePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.salePriceCents}
                  onChange={(e) => setFormData({ ...formData, salePriceCents: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price (ZAR)</Label>
                <Input
                  id="costPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.costPriceCents}
                  onChange={(e) => setFormData({ ...formData, costPriceCents: e.target.value })}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Select
                value={formData.unit}
                onValueChange={(value) => setFormData({ ...formData, unit: value })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              className="flex-1 h-12"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name || !formData.sku}
              className="flex-1 h-12"
            >
              {isSubmitting ? "Saving..." : selectedItem ? "Update" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Item</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
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
