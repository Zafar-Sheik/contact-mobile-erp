"use client";

import * as React from "react";
import {
  Search,
  Edit,
  Trash2,
  FileText,
  MoreHorizontal,
  ClipboardList,
  Package,
  Check,
  X,
  Link2,
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

// Types
interface Supplier {
  _id: string;
  name: string;
}

interface StockItem {
  _id: string;
  name: string;
  sku: string;
}

interface GRV {
  _id: string;
  grvNumber: string;
  poId?: { _id: string; poNumber: string } | string;
  poNumber?: string;
  supplierId?: { _id: string; name: string } | string;
  supplierName?: string;
  receivedAt: string;
  status: "Draft" | "Posted" | "Cancelled";
  grandTotalCents: number;
  notes: string;
  lines?: any[];
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  supplierId: { _id: string; name: string } | string;
  status: string;
  lines: any[];
}

interface GRVFormData {
  grvNumber: string;
  poId: string;
  supplierId: string;
  receivedAt: string;
  notes: string;
  isActive: boolean;
  lines: any[];
}

const initialFormData: GRVFormData = {
  grvNumber: "",
  poId: "",
  supplierId: "",
  receivedAt: new Date().toISOString().split("T")[0],
  notes: "",
  isActive: true,
  lines: [],
};

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

export default function GRVsPage() {
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();
  const [searchParams, setSearchParams] = React.useState<{poId?: string; supplierId?: string}>({});

  // API hooks
  const { data: grvs, loading, error, refetch } = useApi<GRV[]>("/api/grvs");
  const { data: suppliers } = useApi<Supplier[]>("/api/suppliers");
  const { data: purchaseOrders } = useApi<PurchaseOrder[]>("/api/purchase-orders");

  // State
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedGRV, setSelectedGRV] = React.useState<GRV | null>(null);
  const [formData, setFormData] = React.useState<GRVFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [createdGRV, setCreatedGRV] = React.useState<{_id: string; poId?: string} | null>(null);

  // Handle query params on mount
  React.useEffect(() => {
    // Parse URL query params
    const params = new URLSearchParams(window.location.search);
    const poId = params.get('poId');
    const poNumber = params.get('poNumber');
    const supplierId = params.get('supplierId');
    
    if (poId || supplierId) {
      setSearchParams({ poId: poId || undefined, supplierId: supplierId || undefined });
      
      // Pre-fill supplier and PO if provided
      if (supplierId) {
        setFormData(prev => ({ ...prev, supplierId }));
      }
      if (poId) {
        setFormData(prev => ({ ...prev, poId }));
        loadPOItems(poId);
      }
      
      // Show toast with PO context
      if (poNumber) {
        toast({
          title: "Creating GRV",
          description: `Creating GRV for PO ${poNumber}`
        });
      }
      
      // Auto-open the create dialog
      setIsDialogOpen(true);
      
      // Clear the URL params after using them
      window.history.replaceState({}, '', '/grvs');
    }
  }, []);

  // Load PO items when PO is selected
  const loadPOItems = async (poId: string) => {
    try {
      const response = await fetch(`/api/purchase-orders/${poId}`);
      const result = await response.json();
      
      if (result.data) {
        const po = result.data;
        
        // Pre-fill supplier from PO
        const supplierId = typeof po.supplierId === 'object' ? po.supplierId?._id : po.supplierId;
        if (supplierId) {
          setFormData(prev => ({ ...prev, supplierId }));
        }
        
        // Convert PO lines to GRV lines
        const grvLines = po.lines?.map((line: any, index: number) => {
          // Get stockItem data from API response
          const stockItemId = line.stockItemId?.toString() || "";
          const remainingQty = line.orderedQty - (line.receivedQty || 0);
          
          return {
            lineNo: index + 1,
            stockItemId: stockItemId,
            itemSnapshot: {
              sku: line.stockItemSku || "",
              name: line.stockItemName || line.description || "",
              unit: line.stockItemUnit || "each",
              vatRate: 15,
              isVatExempt: false,
            },
            orderedQty: line.orderedQty,
            receivedQty: remainingQty,
            unitCostCents: line.unitCostCents || 0,
            discountType: "none",
            discountValue: 0,
            subtotalCents: (line.unitCostCents || 0) * remainingQty,
            vatAmountCents: Math.round((line.unitCostCents || 0) * remainingQty * 0.15),
            totalCents: Math.round((line.unitCostCents || 0) * remainingQty * 1.15),
          };
        }) || [];
        
        setFormData(prev => ({ ...prev, lines: grvLines, poId }));
      }
    } catch (err) {
      console.error("Error loading PO:", err);
    }
  };

  // Generate GRV number
  const generateGRVNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `GRV-${year}${month}-${random}`;
  };

  // Filter GRVs
  const filteredGRVs = React.useMemo(() => {
    if (!grvs) return [];
    return grvs.filter((grv) => {
      const matchesSearch =
        !searchTerm ||
        grv.grvNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (grv.supplierName && grv.supplierName.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [grvs, searchTerm]);

  const handleOpenDialog = (grv?: GRV) => {
    if (grv) {
      setSelectedGRV(grv);
      setFormData({
        grvNumber: grv.grvNumber || "",
        poId: typeof grv.poId === 'object' ? grv.poId?._id || "" : grv.poId || "",
        supplierId: typeof grv.supplierId === "object" ? grv.supplierId?._id || "" : grv.supplierId || "",
        receivedAt: grv.receivedAt ? new Date(grv.receivedAt).toISOString().split("T")[0] : "",
        notes: grv.notes || "",
        isActive: true,
        lines: grv.lines || [],
      });
    } else {
      setSelectedGRV(null);
      setFormData({
        ...initialFormData,
        grvNumber: generateGRVNumber(),
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedGRV(null);
    setFormData(initialFormData);
    setCreatedGRV(null);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const grvData = {
        grvNumber: formData.grvNumber,
        poId: formData.poId || undefined,
        supplierId: formData.supplierId || undefined,
        receivedAt: formData.receivedAt,
        notes: formData.notes || undefined,
        isActive: formData.isActive,
        lines: formData.lines.map(line => ({
          lineNo: line.lineNo,
          stockItemId: typeof line.stockItemId === 'object' ? line.stockItemId._id : line.stockItemId,
          itemSnapshot: line.itemSnapshot,
          orderedQty: line.orderedQty,
          receivedQty: line.receivedQty,
          unitCostCents: line.unitCostCents,
          discountType: line.discountType,
          discountValue: line.discountValue,
          subtotalCents: line.subtotalCents,
          vatAmountCents: line.vatAmountCents,
          totalCents: line.totalCents,
        })),
      };

      if (selectedGRV) {
        await apiUpdate<GRV, typeof grvData>("/api/grvs", selectedGRV._id, grvData);
        toast({ title: "Success", description: "GRV updated successfully" });
        handleCloseDialog();
        refetch();
      } else {
        const result = await apiCreate<GRV, typeof grvData>("/api/grvs", grvData);
        toast({ title: "Success", description: "GRV created successfully" });
        
        // If linked to PO, store GRV info for navigation
        if (formData.poId && result?._id) {
          setCreatedGRV({ _id: result._id, poId: formData.poId });
        } else {
          handleCloseDialog();
          refetch();
        }
      }
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
    if (!selectedGRV) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/grvs", selectedGRV._id);
      toast({ title: "Success", description: "GRV deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSelectedGRV(null);
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

  // Stats
  const stats = React.useMemo(() => {
    if (!grvs) return { total: 0, draft: 0, posted: 0, totalValue: 0 };
    return {
      total: grvs.length,
      draft: grvs.filter((g) => g.status === "Draft").length,
      posted: grvs.filter((g) => g.status === "Posted").length,
      totalValue: grvs.reduce((sum, g) => sum + g.grandTotalCents, 0),
    };
  }, [grvs]);

  // Map database status to display status
  const getPOStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      "DRAFT": "Draft",
      "SUBMITTED": "Submitted",
      "APPROVED": "Approved",
      "SENT": "Issued",
      "PARTIALLY_RECEIVED": "PartiallyReceived",
      "FULLY_RECEIVED": "FullyReceived",
      "CLOSED": "Closed",
      "CANCELLED": "Cancelled"
    };
    return statusMap[status] || status;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">GRVs</h1>
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
            placeholder="Search GRVs..."
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
            <p className="text-red-600 font-medium">Error loading GRVs</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredGRVs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <ClipboardList className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No GRVs found" : "No GRVs yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? "Try a different search term" : "Create your first GRV to get started"}
            </p>
          </div>
        )}

        {/* GRVs List */}
        {!loading && !error && filteredGRVs.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredGRVs.map((grv) => (
              <div
                key={grv._id}
                onClick={() => handleOpenDialog(grv)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                    <h3 className="font-semibold text-gray-900">{grv.grvNumber}</h3>
                  </div>
                  <Badge
                    variant={
                      grv.status === "Posted"
                        ? "success"
                        : grv.status === "Cancelled"
                        ? "destructive"
                        : "warning"
                    }
                    className="ml-2 shrink-0"
                  >
                    {grv.status}
                  </Badge>
                </div>

                <p className="text-sm text-gray-600 mb-2">
                  {grv.supplierName || "No supplier"}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {formatDate(grv.receivedAt)}
                  </span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(grv.grandTotalCents)}
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
                      handleOpenDialog(grv);
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
                      setSelectedGRV(grv);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
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
              {selectedGRV ? "Edit GRV" : "New GRV"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* PO Selection - only for new GRVs */}
            {!selectedGRV && (
              <div className="space-y-2">
                <Label htmlFor="po">Purchase Order (Optional)</Label>
                <Select
                  value={formData.poId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, poId: value });
                    if (value) {
                      loadPOItems(value);
                    }
                  }}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select a PO to auto-load items" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseOrders?.map((po) => (
                      <SelectItem key={po._id} value={po._id}>
                        {po.poNumber} - {getPOStatusLabel(po.status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Selecting a PO will auto-load all line items
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="grvNumber">GRV Number *</Label>
              <Input
                id="grvNumber"
                value={formData.grvNumber}
                onChange={(e) => setFormData({ ...formData, grvNumber: e.target.value })}
                placeholder="GRV-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Select
                value={formData.supplierId}
                onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
              >
                <SelectTrigger className="h-12">
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

            <div className="space-y-2">
              <Label htmlFor="receivedAt">Date Received</Label>
              <Input
                id="receivedAt"
                type="date"
                value={formData.receivedAt}
                onChange={(e) => setFormData({ ...formData, receivedAt: e.target.value })}
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>

            {/* GRV Line Items */}
            <div className="space-y-2">
              <Label>Items ({formData.lines.length})</Label>
              
              {formData.lines.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm bg-gray-50 rounded-lg">
                  {formData.poId 
                    ? "No items loaded from PO" 
                    : "Select a PO to load items, or add items manually"}
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {formData.lines.map((line) => (
                    <div 
                      key={line.lineNo} 
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {line.itemSnapshot?.name || line.itemSnapshot?.sku || `Item ${line.lineNo}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          Ordered: {line.orderedQty} | Unit: {formatCurrency(line.unitCostCents)}
                        </p>
                      </div>
                      
                      {/* Received Quantity Input */}
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={line.orderedQty}
                          value={line.receivedQty}
                          onChange={(e) => {
                            const qty = parseInt(e.target.value) || 0;
                            const updatedLines = formData.lines.map(l => {
                              if (l.lineNo === line.lineNo) {
                                const subtotal = l.unitCostCents * qty;
                                const vat = Math.round(subtotal * 0.15);
                                return { ...l, receivedQty: qty, subtotalCents: subtotal, vatAmountCents: vat, totalCents: subtotal + vat };
                              }
                              return l;
                            });
                            setFormData({ ...formData, lines: updatedLines });
                          }}
                          className="w-16 h-8 text-center"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => {
                            const updatedLines = formData.lines
                              .filter(l => l.lineNo !== line.lineNo)
                              .map((l, i) => ({ ...l, lineNo: i + 1 }));
                            setFormData({ ...formData, lines: updatedLines });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Line Total */}
              {formData.lines.length > 0 && (
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-medium">Total:</span>
                  <span className="font-bold text-lg">
                    {formatCurrency(formData.lines.reduce((sum, line) => sum + (line.totalCents || 0), 0))}
                  </span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:gap-0">
            {createdGRV && formData.poId ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    handleCloseDialog();
                    refetch();
                  }} 
                  className="flex-1 h-12"
                >
                  Close
                </Button>
                <Button
                  asChild
                  className="flex-1 h-12"
                >
                  <a href={`/purchase-orders/${formData.poId}`}>
                    <Link2 className="h-4 w-4 mr-2" />
                    View PO
                  </a>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleCloseDialog} className="flex-1 h-12">
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !formData.grvNumber}
                  className="flex-1 h-12"
                >
                  {isSubmitting ? "Saving..." : selectedGRV ? "Update" : "Create"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete GRV</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete GRV "{selectedGRV?.grvNumber}"? This action cannot be undone.
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
