"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  FileText,
  Loader2,
  MoreVertical,
  Calendar,
  Package,
  Check,
  X,
  Save,
  Send,
  Printer,
  AlertTriangle,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi, apiCreate, apiUpdate, apiDelete } from "@/lib/hooks/use-api";

// Mobile components
import { PageHeader } from "@/components/mobile/page-header";
import { SearchBar } from "@/components/mobile/search-bar";
import { MobileList, MobileListItemWrapper } from "@/components/mobile/mobile-list";
import { MobileListItem } from "@/components/mobile/mobile-list-item";
import { EmptyState } from "@/components/mobile/empty-state";
import { Fab } from "@/components/mobile/fab";

// Types
interface Supplier {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface StockItem {
  _id: string;
  sku: string;
  name: string;
  unit: string;
  barcode?: string;
  vatRate: number;
  isVatExempt: boolean;
  inventory?: {
    onHand: number;
    reorderLevel: number;
    location: string;
  };
  pricing?: {
    costPriceCents: number;
    averageCostCents: number;
    salePriceCents: number;
  };
}

interface GRVLine {
  _id?: string;
  lineNo: number;
  stockItemId: string;
  itemSnapshot: {
    sku: string;
    name: string;
    unit: string;
    vatRate: number;
    isVatExempt: boolean;
  };
  orderedQty: number;
  receivedQty: number;
  unitCostRands: number;
  discountType: "none" | "percent" | "amount";
  discountValue: number;
  subtotalCents: number;
  vatAmountCents: number;
  totalCents: number;
  batchNumber: string;
  expiryDate: string;
  serialNumbers: string[];
  varianceReason: "none" | "damaged" | "short_delivery" | "wrong_item" | "free_stock" | "other";
  remarks: string;
}

interface GRV {
  _id: string;
  grvNumber: string;
  supplierId?: { _id: string; name: string } | string;
  supplierName?: string;
  receivedAt: string;
  status: "Draft" | "Posted" | "Cancelled";
  lines: GRVLine[];
  subtotalCents: number;
  vatTotalCents: number;
  discountTotalCents: number;
  grandTotalCents: number;
  notes: string;
  referenceType: string;
  referenceNumber: string;
  locationId: string;
  locationName: string;
  createdAt?: string;
}

const referenceTypeOptions = [
  { value: "none", label: "None" },
  { value: "po", label: "Purchase Order" },
  { value: "supplier_invoice", label: "Supplier Invoice" },
  { value: "delivery_note", label: "Delivery Note" },
];

const varianceReasonOptions = [
  { value: "none", label: "No Variance" },
  { value: "damaged", label: "Damaged" },
  { value: "short_delivery", label: "Short Delivery" },
  { value: "wrong_item", label: "Wrong Item" },
  { value: "free_stock", label: "Free Stock" },
  { value: "other", label: "Other" },
];

const locationOptions = [
  { value: "main", label: "Main Warehouse" },
  { value: "store", label: "Store Front" },
  { value: "backroom", label: "Backroom" },
];

export default function GRVsPage() {
  const { toast } = useToast();
  const { data: grvs, loading, error, refetch } = useApi<GRV[]>("/api/grvs");
  const { data: suppliers } = useApi<Supplier[]>("/api/suppliers");
  const { data: stockItems } = useApi<StockItem[]>("/api/stock-items");
   
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isPostDialogOpen, setIsPostDialogOpen] = React.useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = React.useState(false);
  const [isItemSearchOpen, setIsItemSearchOpen] = React.useState(false);
  const [selectedGRV, setSelectedGRV] = React.useState<GRV | null>(null);
  const [formData, setFormData] = React.useState({
    supplierId: "",
    receivedAt: new Date().toISOString().split("T")[0],
    referenceType: "none",
    referenceNumber: "",
    locationId: "main",
    locationName: "Main Warehouse",
    notes: "",
    lines: [] as GRVLine[],
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [itemSearchTerm, setItemSearchTerm] = React.useState("");
  const [activeTab, setActiveTab] = React.useState("header");

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(cents / 100);
  };

  const filteredGRVs = React.useMemo(() => {
    if (!grvs) return [];
    return grvs.filter(
      (grv) =>
        grv.grvNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (typeof grv.supplierId === "object" 
          ? grv.supplierId?.name?.toLowerCase() 
          : "").includes(searchTerm.toLowerCase())
    );
  }, [grvs, searchTerm]);

  const filteredStockItems = React.useMemo(() => {
    if (!stockItems || !itemSearchTerm) return [];
    const term = itemSearchTerm.toLowerCase();
    return stockItems.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        (item.barcode && item.barcode.toLowerCase().includes(term))
    );
  }, [stockItems, itemSearchTerm]);

  const calculateLineTotals = (line: Partial<GRVLine>) => {
    const receivedQty = line.receivedQty || 0;
    const unitCost = line.unitCostRands || 0;
    const discountType = line.discountType || "none";
    const discountValue = line.discountValue || 0;
    const vatRate = line.itemSnapshot?.vatRate || 15;

    let discountCents = 0;
    const unitCostCents = Math.round(unitCost * 100);
    if (discountType === "percent") {
      discountCents = Math.round((unitCostCents * receivedQty * discountValue) / 100);
    } else if (discountType === "amount") {
      discountCents = Math.round(discountValue * receivedQty * 100);
    }

    const subtotal = (unitCostCents * receivedQty) - discountCents;
    const vatAmount = Math.round(subtotal * (vatRate / 100));
    const total = subtotal + vatAmount;

    return { subtotalCents: subtotal, vatAmountCents: vatAmount, totalCents: total };
  };

  const addLine = (item: StockItem) => {
    const existingIndex = formData.lines.findIndex(l => l.stockItemId === item._id);
    if (existingIndex >= 0) {
      const updatedLines = [...formData.lines];
      updatedLines[existingIndex].receivedQty += 1;
      const totals = calculateLineTotals(updatedLines[existingIndex]);
      updatedLines[existingIndex] = { ...updatedLines[existingIndex], ...totals };
      setFormData({ ...formData, lines: updatedLines });
    } else {
      const unitCostRands = (item.pricing?.costPriceCents || item.pricing?.averageCostCents || 0) / 100;
      const vatRate = item.vatRate || 15;
      const unitCostCents = Math.round(unitCostRands * 100);
      const newLine: GRVLine = {
        lineNo: formData.lines.length + 1,
        stockItemId: item._id,
        itemSnapshot: {
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          vatRate: item.vatRate,
          isVatExempt: item.isVatExempt,
        },
        orderedQty: 0,
        receivedQty: 1,
        unitCostRands: unitCostRands,
        discountType: "none",
        discountValue: 0,
        subtotalCents: unitCostCents,
        vatAmountCents: Math.round(unitCostCents * (vatRate / 100)),
        totalCents: unitCostCents + Math.round(unitCostCents * (vatRate / 100)),
        batchNumber: "",
        expiryDate: "",
        serialNumbers: [],
        varianceReason: "none",
        remarks: "",
      };
      setFormData({ ...formData, lines: [...formData.lines, newLine] });
    }
    setIsItemSearchOpen(false);
    setItemSearchTerm("");
  };

  const updateLine = (index: number, updates: Partial<GRVLine>) => {
    const updatedLines = [...formData.lines];
    if (updates.discountValue !== undefined && updates.discountType === "amount") {
      updates.discountValue = Math.round(updates.discountValue * 100);
    }
    const line = { ...updatedLines[index], ...updates };
    const totals = calculateLineTotals(line);
    updatedLines[index] = { ...line, ...totals };
    setFormData({ ...formData, lines: updatedLines });
  };

  const removeLine = (index: number) => {
    const updatedLines = formData.lines.filter((_, i) => i !== index);
    updatedLines.forEach((line, i) => line.lineNo = i + 1);
    setFormData({ ...formData, lines: updatedLines });
  };

  const handleOpenDialog = (grv?: GRV) => {
    if (grv) {
      setSelectedGRV(grv);
      const linesWithRands = (grv.lines || []).map((line: any) => ({
        ...line,
        unitCostRands: line.unitCostCents ? line.unitCostCents / 100 : 0,
      }));
      setFormData({
        supplierId: typeof grv.supplierId === "object" ? grv.supplierId?._id || "" : "",
        receivedAt: grv.receivedAt ? new Date(grv.receivedAt).toISOString().split("T")[0] : "",
        referenceType: grv.referenceType || "none",
        referenceNumber: grv.referenceNumber || "",
        locationId: grv.locationId || "main",
        locationName: grv.locationName || "Main Warehouse",
        notes: grv.notes || "",
        lines: linesWithRands,
      });
    } else {
      setSelectedGRV(null);
      setFormData({
        supplierId: "",
        receivedAt: new Date().toISOString().split("T")[0],
        referenceType: "none",
        referenceNumber: "",
        locationId: "main",
        locationName: "Main Warehouse",
        notes: "",
        lines: [],
      });
    }
    setActiveTab("header");
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedGRV(null);
    setFormData({
      supplierId: "",
      receivedAt: new Date().toISOString().split("T")[0],
      referenceType: "none",
      referenceNumber: "",
      locationId: "main",
      locationName: "Main Warehouse",
      notes: "",
      lines: [],
    });
  };

  const handleSubmit = async () => {
    if (!formData.supplierId) {
      toast({ title: "Error", description: "Please select a supplier", variant: "destructive" });
      return;
    }
    if (formData.lines.length === 0) {
      toast({ title: "Error", description: "Please add at least one line item", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const linesWithCents = formData.lines.map(line => ({
        ...line,
        unitCostCents: Math.round((line.unitCostRands || 0) * 100),
      }));
       
      const grvData = {
        supplierId: formData.supplierId,
        receivedAt: formData.receivedAt,
        referenceType: formData.referenceType,
        referenceNumber: formData.referenceNumber,
        locationId: formData.locationId,
        locationName: locationOptions.find(l => l.value === formData.locationId)?.label || "Main Warehouse",
        notes: formData.notes || undefined,
        lines: linesWithCents,
      };

      if (selectedGRV) {
        await apiUpdate<GRV>("/api/grvs", selectedGRV._id, grvData);
        toast({ title: "Success", description: "GRV updated successfully" });
      } else {
        await apiCreate<GRV>("/api/grvs", grvData);
        toast({ title: "Success", description: "GRV created successfully" });
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

  const handlePost = async () => {
    if (!selectedGRV) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/grvs/${selectedGRV._id}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to post GRV");
      }
      toast({ title: "Success", description: "GRV posted successfully" });
      setIsPostDialogOpen(false);
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

  const handleCancel = async () => {
    if (!selectedGRV) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/grvs/${selectedGRV._id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel GRV");
      }
      toast({ title: "Success", description: "GRV cancelled successfully" });
      setIsCancelDialogOpen(false);
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
      Posted: "success",
      Draft: "warning",
      Cancelled: "secondary",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getStatusVariant = (status: string): "success" | "warning" | "secondary" | "destructive" => {
    const variants: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
      Posted: "success",
      Draft: "warning",
      Cancelled: "secondary",
    };
    return variants[status] || "secondary";
  };

  const subtotal = formData.lines.reduce((sum, line) => sum + line.subtotalCents, 0);
  const vatTotal = formData.lines.reduce((sum, line) => sum + line.vatAmountCents, 0);
  const discountTotal = formData.lines.reduce((sum, line) => {
    const { discountType, discountValue, receivedQty } = line;
    if (discountType === "percent") {
      return sum + Math.round((line.subtotalCents * discountValue) / 100);
    } else if (discountType === "amount") {
      return sum + (discountValue * receivedQty);
    }
    return sum;
  }, 0);
  const grandTotal = subtotal + vatTotal - discountTotal;

  const getSupplierName = (grv: GRV): string => {
    if (typeof grv.supplierId === "object") {
      return grv.supplierId?.name || "-";
    }
    return "-";
  };

  return (
    <MainLayout showTabBar={true} showFab={true}>
      <div className="space-y-4 md:space-y-6">
        {/* Page Header - Mobile */}
        <div className="md:hidden">
          <PageHeader
            title="GRVs"
            subtitle="Manage Goods Received Vouchers"
            primaryAction={{
              label: "New GRV",
              onClick: () => handleOpenDialog(),
              icon: <Plus className="h-4 w-4" />,
            }}
          />
          <div className="px-4">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search GRVs..."
            />
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              GRVs
            </h1>
            <p className="text-muted-foreground">
              Manage Goods Received Vouchers
            </p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="w-full gap-2 md:w-auto"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            New GRV
          </Button>
        </div>

        {/* Desktop Search */}
        <div className="hidden md:block">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search GRVs..."
          />
        </div>

        {/* Summary Cards */}
        {grvs && grvs.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">{grvs.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Draft
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-yellow-600 md:text-2xl">
                  {grvs.filter(g => g.status === "Draft").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Posted
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600 md:text-2xl">
                  {grvs.filter(g => g.status === "Posted").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {formatCurrency(grvs.reduce((sum, g) => sum + g.grandTotalCents, 0))}
                </div>
              </CardContent>
            </Card>
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
                <p className="text-destructive">Error loading GRVs</p>
                <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State - Mobile */}
        {!loading && !error && filteredGRVs.length === 0 && searchTerm && (
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
        {!loading && !error && filteredGRVs.length === 0 && !searchTerm && (
          <div className="hidden md:block">
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No GRVs found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get started by creating your first GRV
                  </p>
                  <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    New GRV
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mobile List */}
        {!loading && !error && filteredGRVs.length > 0 && (
          <div className="md:hidden px-4">
            <MobileList
              loading={loading}
              emptyState={{
                icon: <FileText className="h-10 w-10" />,
                title: "No GRVs found",
                description: searchTerm 
                  ? "Try adjusting your search" 
                  : "Get started by creating your first GRV",
                action: searchTerm 
                  ? { label: "Clear search", onClick: () => setSearchTerm("") }
                  : { label: "New GRV", onClick: () => handleOpenDialog() },
              }}
            >
              {filteredGRVs.map((grv) => (
                <MobileListItemWrapper
                  key={grv._id}
                  onClick={() => window.location.href = `/grvs/${grv._id}`}
                >
                  <MobileListItem
                    title={grv.grvNumber}
                    subtitle={getSupplierName(grv)}
                    description={`${grv.lines?.length || 0} items`}
                    avatar={{
                      icon: <FileText className="h-5 w-5 text-primary" />,
                      fallback: grv.grvNumber.substring(0, 2).toUpperCase(),
                    }}
                    status={{
                      label: grv.status,
                      variant: getStatusVariant(grv.status),
                    }}
                    showChevron={false}
                    rightContent={
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {formatCurrency(grv.grandTotalCents)}
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.location.href = `/grvs/${grv._id}`; }}>
                              <FileText className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenDialog(grv); }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            {grv.status === "Draft" && (
                              <DropdownMenuItem
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  setSelectedGRV(grv);
                                  setIsPostDialogOpen(true);
                                }}
                                className="text-green-600"
                              >
                                <Send className="mr-2 h-4 w-4" />
                                Post
                              </DropdownMenuItem>
                            )}
                            {grv.status === "Posted" && (
                              <DropdownMenuItem
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  setSelectedGRV(grv);
                                  setIsCancelDialogOpen(true);
                                }}
                                className="text-orange-600"
                              >
                                <X className="mr-2 h-4 w-4" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                            {grv.status === "Draft" && (
                              <DropdownMenuItem
                                onClick={(e) => { 
                                  e.stopPropagation();
                                  setSelectedGRV(grv);
                                  setIsDeleteDialogOpen(true);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
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
        {!loading && !error && filteredGRVs.length > 0 && (
          <div className="hidden md:block rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GRV Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Received Date</TableHead>
                    <TableHead>PO Reference</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGRVs.map((grv) => (
                    <TableRow key={grv._id}>
                      <TableCell className="font-medium">{grv.grvNumber}</TableCell>
                      <TableCell>{getSupplierName(grv)}</TableCell>
                      <TableCell>
                        {grv.receivedAt
                          ? new Date(grv.receivedAt).toLocaleDateString()
                          : "-"}
                      </TableCell>
                      <TableCell>{grv.referenceNumber || "-"}</TableCell>
                      <TableCell className="text-right">{grv.lines?.length || 0}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(grv.grandTotalCents)}
                      </TableCell>
                      <TableCell>{getStatusBadge(grv.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => window.location.href = `/grvs/${grv._id}`}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(grv)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {grv.status === "Draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600"
                              onClick={() => {
                                setSelectedGRV(grv);
                                setIsPostDialogOpen(true);
                              }}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          {grv.status === "Posted" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-orange-600"
                              onClick={() => {
                                setSelectedGRV(grv);
                                setIsCancelDialogOpen(true);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          {grv.status === "Draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => {
                                setSelectedGRV(grv);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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
        label="New GRV"
      />

      {/* Add/Edit GRV Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedGRV ? `Edit ${selectedGRV.grvNumber}` : "New GRV"}
            </DialogTitle>
            <DialogDescription>
              {selectedGRV
                ? "Update GRV information below"
                : "Enter information to create a new GRV"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="header">Header</TabsTrigger>
              <TabsTrigger value="items">Items ({formData.lines.length})</TabsTrigger>
              <TabsTrigger value="review">Review</TabsTrigger>
            </TabsList>

            <ScrollArea className="max-h-[60vh] pr-4">
              {/* Header Tab */}
              <TabsContent value="header" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier *</Label>
                  <Select
                    value={formData.supplierId}
                    onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                  >
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <Label htmlFor="receivedAt">Received Date *</Label>
                  <Input
                    id="receivedAt"
                    type="date"
                    value={formData.receivedAt}
                    onChange={(e) => setFormData({ ...formData, receivedAt: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="referenceType">Reference Type</Label>
                    <Select
                      value={formData.referenceType}
                      onValueChange={(value) => setFormData({ ...formData, referenceType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {referenceTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="referenceNumber">Reference Number</Label>
                    <Input
                      id="referenceNumber"
                      value={formData.referenceNumber}
                      onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                      placeholder="PO/Invoice/DN number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locationId">Receiving Location</Label>
                  <Select
                    value={formData.locationId}
                    onValueChange={(value) => setFormData({ ...formData, locationId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {locationOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </TabsContent>

              {/* Items Tab */}
              <TabsContent value="items" className="space-y-4 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsItemSearchOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>

                {formData.lines.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No items added yet. Click "Add Item" to add line items.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.lines.map((line, index) => (
                      <Card key={index} className="p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">{line.itemSnapshot.name}</p>
                            <p className="text-sm text-muted-foreground">SKU: {line.itemSnapshot.sku}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeLine(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Qty</Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={line.receivedQty}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 0;
                                updateLine(index, { receivedQty: value });
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Cost (R)</Label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={String(line.unitCostRands || "0")}
                              onChange={(e) => {
                                updateLine(index, { unitCostRands: parseFloat(e.target.value) || 0 });
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Total</Label>
                            <p className="text-sm font-medium">{formatCurrency(line.totalCents)}</p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <Select
                            value={line.varianceReason}
                            onValueChange={(value: any) => updateLine(index, { varianceReason: value })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Variance Reason" />
                            </SelectTrigger>
                            <SelectContent>
                              {varianceReasonOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Review Tab */}
              <TabsContent value="review" className="space-y-4 py-4">
                <div className="bg-muted p-4 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT</span>
                    <span>{formatCurrency(vatTotal)}</span>
                  </div>
                  {discountTotal > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(discountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>Supplier: {suppliers?.find(s => s._id === formData.supplierId)?.name || "Not selected"}</p>
                  <p>Location: {locationOptions.find(l => l.value === formData.locationId)?.label}</p>
                  <p>Items: {formData.lines.length}</p>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            {activeTab !== "review" ? (
              <Button onClick={() => setActiveTab("review")}>
                Review
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedGRV ? "Update" : "Create"} GRV
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Search Dialog */}
      <Dialog open={isItemSearchOpen} onOpenChange={setIsItemSearchOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
            <DialogDescription>
              Search for a stock item by name, SKU, or barcode
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                value={itemSearchTerm}
                onChange={(e) => setItemSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <ScrollArea className="max-h-[300px]">
              {filteredStockItems.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between p-3 hover:bg-muted rounded-lg cursor-pointer"
                  onClick={() => addLine(item)}
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      SKU: {item.sku} | Stock: {item.inventory?.onHand || 0}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {itemSearchTerm && filteredStockItems.length === 0 && (
                <p className="text-center py-4 text-muted-foreground">No items found</p>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Confirmation Dialog */}
      <AlertDialog open={isPostDialogOpen} onOpenChange={setIsPostDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Post GRV</AlertDialogTitle>
            <div className="text-sm text-muted-foreground">
              <div className="mb-2">Are you sure you want to post this GRV? This will:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Create inventory movements for all items</li>
                <li>Update stock on-hand quantities</li>
                <li>Update average cost prices</li>
                <li>Lock the GRV from further edits</li>
              </ul>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePost} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post GRV
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete GRV</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{" "}
              <strong>{selectedGRV?.grvNumber}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel GRV</AlertDialogTitle>
            <div className="text-sm text-muted-foreground">
              <div className="mb-2">Are you sure you want to cancel this GRV? This will:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Create reverse inventory movements for all items</li>
                <li>Decrease stock on-hand quantities</li>
                <li>Recalculate average cost prices</li>
                <li>Mark the GRV as cancelled</li>
              </ul>
              <div className="mt-3 font-semibold text-orange-600">Warning: This action affects inventory and cannot be easily reversed.</div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep GRV</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel GRV
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
