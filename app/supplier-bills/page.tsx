"use client";

import * as React from "react";
import {
  Plus,
  Search,
  FileText,
  Loader2,
  MoreVertical,
  Calendar,
  ExternalLink,
  Eye,
  Pencil,
  Send,
  XCircle,
  CheckCircle,
  Truck,
  Package,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useApi, apiCreate, apiUpdate, apiDelete } from "@/lib/hooks/use-api";

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
}

interface GRVLine {
  _id: string;
  lineNo: number;
  stockItemId: string | StockItem;
  itemSnapshot: {
    sku: string;
    name: string;
    unit: string;
    vatRate: number;
    isVatExempt: boolean;
  };
  description: string;
  quantity: number;
  unitCostCents: number;
  vatRate: number;
  vatCents: number;
  subtotalCents: number;
  grvId: string | { _id: string; grvNumber: string };
  poLineId?: string;
}

interface SupplierBill {
  _id: string;
  billNumber: string;
  supplierId: string | Supplier;
  poId?: string | { _id: string; poNumber: string };
  grvIds: string[] | { _id: string; grvNumber: string }[];
  billDate: string;
  dueDate?: string;
  status: "Draft" | "Posted" | "PartiallyPaid" | "Paid" | "Voided";
  reference: string;
  subtotalCents: number;
  vatCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  notes?: string;
  billLines: GRVLine[];
  createdAt: string;
}

interface UnbilledGRV {
  _id: string;
  grvNumber: string;
  receivedAt: string;
  referenceNumber: string;
  grandTotalCents: number;
  poId?: string;
  poNumber?: string;
  lineCount: number;
  lines?: any[];
}

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline" | "warning" | "success"> = {
    Draft: "secondary",
    Posted: "default",
    PartiallyPaid: "warning",
    Paid: "success",
    Voided: "destructive",
  };
  
  const colors: Record<string, string> = {
    Draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
    Posted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    PartiallyPaid: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
    Paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    Voided: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  };
  
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] || colors.Draft}`}>
      {status}
    </span>
  );
};

export default function SupplierBillsPage() {
  const { toast } = useToast();
  
  // API data
  const { data: bills, loading, error, refetch } = useApi<SupplierBill[]>("/api/supplier-bills");
  const { data: suppliers } = useApi<Supplier[]>("/api/suppliers");
  
  // Local state
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [supplierFilter, setSupplierFilter] = React.useState<string>("all");
  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");
  
  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = React.useState(false);
  const [isVoidDialogOpen, setIsVoidDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  
  // Create Bill from GRV workflow
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>("");
  const [selectedGRVs, setSelectedGRVs] = React.useState<Set<string>>(new Set());
  const [unbilledGRVs, setUnbilledGRVs] = React.useState<UnbilledGRV[]>([]);
  const [loadingGRVs, setLoadingGRVs] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [createBillData, setCreateBillData] = React.useState({
    reference: "",
    dueDate: "",
    notes: "",
  });
  
  // Selected bill for view/edit/void
  const [selectedBill, setSelectedBill] = React.useState<SupplierBill | null>(null);
  const [selectedBillDetails, setSelectedBillDetails] = React.useState<SupplierBill | null>(null);
  const [voidReason, setVoidReason] = React.useState("");
  
  // Load unbilled GRVs when supplier is selected
  React.useEffect(() => {
    if (selectedSupplierId) {
      loadUnbilledGRVs(selectedSupplierId);
    } else {
      setUnbilledGRVs([]);
      setSelectedGRVs(new Set());
    }
  }, [selectedSupplierId]);
  
  const loadUnbilledGRVs = async (supplierId: string) => {
    setLoadingGRVs(true);
    try {
      const response = await fetch(`/api/supplier-bills/unbilled-grvs?supplierId=${supplierId}`);
      const result = await response.json();
      if (result.data) {
        setUnbilledGRVs(result.data);
      }
    } catch (err) {
      console.error("Error loading unbilled GRVs:", err);
      toast({ title: "Error", description: "Failed to load unbilled GRVs", variant: "destructive" });
    } finally {
      setLoadingGRVs(false);
    }
  };
  
  // Load full bill details
  const loadBillDetails = async (billId: string) => {
    try {
      const response = await fetch(`/api/supplier-bills/${billId}`);
      const result = await response.json();
      if (result.data) {
        setSelectedBillDetails(result.data);
        setIsDetailDialogOpen(true);
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to load bill details", variant: "destructive" });
    }
  };
  
  // Filter bills
  const filteredBills = React.useMemo(() => {
    if (!bills) return [];
    
    return bills.filter((bill) => {
      // Search filter
      const supplierName = typeof bill.supplierId === "object" 
        ? (bill.supplierId as Supplier)?.name || ""
        : "";
      const matchesSearch = 
        bill.billNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === "all" || bill.status === statusFilter;
      
      // Supplier filter
      const matchesSupplier = supplierFilter === "all" || 
        (typeof bill.supplierId === "object" 
          ? (bill.supplierId as Supplier)?._id === supplierFilter
          : bill.supplierId === supplierFilter);
      
      // Date range filter
      let matchesDate = true;
      if (dateFrom && bill.billDate) {
        matchesDate = new Date(bill.billDate) >= new Date(dateFrom);
      }
      if (dateTo && bill.billDate) {
        matchesDate = matchesDate && new Date(bill.billDate) <= new Date(dateTo);
      }
      
      return matchesSearch && matchesStatus && matchesSupplier && matchesDate;
    });
  }, [bills, searchTerm, statusFilter, supplierFilter, dateFrom, dateTo]);
  
  // Handle GRV selection
  const toggleGRVSelection = (grvId: string) => {
    const newSelected = new Set(selectedGRVs);
    if (newSelected.has(grvId)) {
      newSelected.delete(grvId);
    } else {
      newSelected.add(grvId);
    }
    setSelectedGRVs(newSelected);
  };
  
  // Calculate selected GRVs total
  const selectedGRVsTotal = React.useMemo(() => {
    return unbilledGRVs
      .filter(grv => selectedGRVs.has(grv._id))
      .reduce((sum, grv) => sum + (grv.grandTotalCents || 0), 0);
  }, [unbilledGRVs, selectedGRVs]);
  
  // Create bill from GRVs
  const handleCreateBillFromGRV = async () => {
    if (selectedGRVs.size === 0) {
      toast({ title: "Error", description: "Please select at least one GRV", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const payload = {
        grvIds: Array.from(selectedGRVs),
        reference: createBillData.reference || undefined,
        dueDate: createBillData.dueDate || undefined,
        notes: createBillData.notes || undefined,
      };
      
      await apiCreate<SupplierBill>("/api/supplier-bills/create-from-grv", payload);
      toast({ title: "Success", description: "Bill created successfully from GRV(s)" });
      
      // Reset and close
      handleCloseCreateDialog();
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create bill",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Post bill
  const handlePostBill = async () => {
    if (!selectedBill) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/supplier-bills/${selectedBill._id}/post`, {
        method: "POST",
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to post bill");
      }
      
      toast({ title: "Success", description: "Bill posted successfully" });
      setIsDetailDialogOpen(false);
      setSelectedBill(null);
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to post bill",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Void bill
  const handleVoidBill = async () => {
    if (!selectedBill) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/supplier-bills/${selectedBill._id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: voidReason }),
      });
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || "Failed to void bill");
      }
      
      toast({ title: "Success", description: "Bill voided successfully" });
      setIsVoidDialogOpen(false);
      setSelectedBill(null);
      setVoidReason("");
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to void bill",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Delete bill
  const handleDeleteBill = async () => {
    if (!selectedBill) return;
    
    setIsSubmitting(true);
    try {
      await apiDelete("/api/supplier-bills", selectedBill._id);
      toast({ title: "Success", description: "Bill deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSelectedBill(null);
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete bill",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Close create dialog
  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setSelectedSupplierId("");
    setSelectedGRVs(new Set());
    setUnbilledGRVs([]);
    setCreateBillData({ reference: "", dueDate: "", notes: "" });
  };
  
  // Summary stats
  const stats = React.useMemo(() => {
    if (!bills) return { total: 0, draft: 0, posted: 0, paid: 0, totalAmount: 0 };
    
    return {
      total: bills.length,
      draft: bills.filter(b => b.status === "Draft").length,
      posted: bills.filter(b => b.status === "Posted").length,
      paid: bills.filter(b => b.status === "Paid" || b.status === "PartiallyPaid").length,
      totalAmount: bills.filter(b => b.status !== "Voided").reduce((sum, b) => sum + (b.totalCents || 0), 0),
    };
  }, [bills]);
  
  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Supplier Bills</h1>
            <p className="text-muted-foreground">Manage supplier bills and invoices</p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full gap-2 md:w-auto" size="lg">
            <Plus className="h-5 w-5" />Create Bill from GRV
          </Button>
        </div>
        
        {/* Stats Cards */}
        {bills && bills.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Bills</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Draft</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-yellow-600 md:text-2xl">{stats.draft}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Posted</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-blue-600 md:text-2xl">{stats.posted}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600 md:text-2xl">{stats.paid}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">{formatCurrency(stats.totalAmount)}</div>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by bill # or supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 md:h-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Posted">Posted</SelectItem>
              <SelectItem value="PartiallyPaid">Partially Paid</SelectItem>
              <SelectItem value="Paid">Paid</SelectItem>
              <SelectItem value="Voided">Voided</SelectItem>
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers?.map((supplier) => (
                <SelectItem key={supplier._id} value={supplier._id}>
                  {supplier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full md:w-[150px]"
            placeholder="From"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full md:w-[150px]"
            placeholder="To"
          />
        </div>
        
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
                <p className="text-destructive">Error loading bills</p>
                <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Empty State */}
        {!loading && !error && filteredBills.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No bills found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm || statusFilter !== "all" || supplierFilter !== "all" || dateFrom || dateTo
                    ? "Try adjusting your filters"
                    : "Get started by creating your first bill from a GRV"}
                </p>
                {!searchTerm && statusFilter === "all" && supplierFilter === "all" && !dateFrom && !dateTo && (
                  <Button variant="outline" className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />Create Bill from GRV
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Mobile Card View */}
        {!loading && !error && filteredBills.length > 0 && (
          <div className="space-y-3 md:hidden">
            {filteredBills.map((bill) => (
              <Card key={bill._id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-start justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                        <FileText className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{bill.billNumber}</h3>
                        <p className="text-sm text-muted-foreground">
                          {typeof bill.supplierId === "object" 
                            ? (bill.supplierId as Supplier)?.name 
                            : "No supplier"}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-10 w-10">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => { setSelectedBill(bill); loadBillDetails(bill._id); }}>
                          <Eye className="mr-2 h-4 w-4" />View Details
                        </DropdownMenuItem>
                        {bill.status === "Draft" && (
                          <>
                            <DropdownMenuItem onClick={() => { setSelectedBill(bill); /* Edit functionality */ }}>
                              <Pencil className="mr-2 h-4 w-4" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedBill(bill); setIsDeleteDialogOpen(true); }} className="text-destructive">
                              <XCircle className="mr-2 h-4 w-4" />Delete
                            </DropdownMenuItem>
                          </>
                        )}
                        {bill.status === "Draft" && (
                          <DropdownMenuItem onClick={() => { setSelectedBill(bill); loadBillDetails(bill._id); }}>
                            <Send className="mr-2 h-4 w-4" />Post
                          </DropdownMenuItem>
                        )}
                        {(bill.status === "Posted" || bill.status === "PartiallyPaid") && (
                          <DropdownMenuItem onClick={() => { setSelectedBill(bill); setIsVoidDialogOpen(true); }} className="text-destructive">
                            <XCircle className="mr-2 h-4 w-4" />Void
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="border-t px-4 py-3 bg-muted/30">
                    <div className="flex items-center justify-between text-sm">
                      <StatusBadge status={bill.status} />
                      <span className="font-medium">{formatCurrency(bill.totalCents || 0)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t px-4 py-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{bill.billDate ? formatDate(bill.billDate) : "-"}</span>
                    </div>
                    {bill.poId && typeof bill.poId === "object" && (
                      <span className="text-xs text-muted-foreground">{(bill.poId as any)?.poNumber}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        
        {/* Desktop Table View */}
        {!loading && !error && filteredBills.length > 0 && (
          <div className="hidden md:block rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>PO #</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBills.map((bill) => (
                    <TableRow key={bill._id}>
                      <TableCell className="font-medium">{bill.billNumber || "-"}</TableCell>
                      <TableCell>{bill.billDate ? formatDate(bill.billDate) : "-"}</TableCell>
                      <TableCell>
                        {typeof bill.supplierId === "object" 
                          ? (bill.supplierId as Supplier)?.name || "-"
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {bill.poId && typeof bill.poId === "object" 
                          ? (bill.poId as any)?.poNumber || "-"
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(bill.totalCents || 0)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={bill.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { setSelectedBill(bill); loadBillDetails(bill._id); }}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {bill.status === "Draft" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => { setSelectedBill(bill); setIsDeleteDialogOpen(true); }}
                                title="Delete"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {bill.status === "Draft" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setSelectedBill(bill); loadBillDetails(bill._id); }}
                              title="Post"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                          {(bill.status === "Posted" || bill.status === "PartiallyPaid") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => { setSelectedBill(bill); setIsVoidDialogOpen(true); }}
                              title="Void"
                            >
                              <XCircle className="h-4 w-4" />
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
      
      {/* Create Bill from GRV Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Create Bill from GRV</DialogTitle>
            <DialogDescription>
              Select a supplier and choose GRVs to create a bill
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              {/* Step 1: Select Supplier */}
              <div className="space-y-2">
                <Label>Select Supplier *</Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
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
              
              {/* Step 2: Select GRVs */}
              {selectedSupplierId && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Select GRVs to Bill ({selectedGRVs.size} selected)</Label>
                    {loadingGRVs ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : unbilledGRVs.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Truck className="mx-auto h-8 w-8 mb-2" />
                        <p>No unbilled GRVs for this supplier</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-2">
                        {unbilledGRVs.map((grv) => (
                          <div
                            key={grv._id}
                            className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                              selectedGRVs.has(grv._id) 
                                ? "bg-primary/10 border-primary" 
                                : "hover:bg-muted"
                            }`}
                            onClick={() => toggleGRVSelection(grv._id)}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedGRVs.has(grv._id)}
                                onCheckedChange={() => toggleGRVSelection(grv._id)}
                              />
                              <div>
                                <p className="font-medium">{grv.grvNumber}</p>
                                <p className="text-sm text-muted-foreground">
                                  {grv.receivedAt ? formatDate(grv.receivedAt) : ""} 
                                  {grv.referenceNumber && ` - ${grv.referenceNumber}`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(grv.grandTotalCents)}</p>
                              <p className="text-xs text-muted-foreground">{grv.lineCount} lines</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Selected Total */}
                  {selectedGRVs.size > 0 && (
                    <div className="bg-muted p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Selected Total:</span>
                        <span className="text-xl font-bold">{formatCurrency(selectedGRVsTotal)}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Additional Info */}
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="reference">Reference</Label>
                      <Input
                        id="reference"
                        value={createBillData.reference}
                        onChange={(e) => setCreateBillData({ ...createBillData, reference: e.target.value })}
                        placeholder="Supplier invoice #"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        value={createBillData.dueDate}
                        onChange={(e) => setCreateBillData({ ...createBillData, dueDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={createBillData.notes}
                      onChange={(e) => setCreateBillData({ ...createBillData, notes: e.target.value })}
                      placeholder="Additional notes"
                    />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseCreateDialog}>Cancel</Button>
            <Button
              onClick={handleCreateBillFromGRV}
              disabled={selectedGRVs.size === 0 || isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Bill ({selectedGRVs.size} GRVs)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bill Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Bill Details - {selectedBillDetails?.billNumber}</DialogTitle>
            <DialogDescription>
              View bill information and line items
            </DialogDescription>
          </DialogHeader>
          {selectedBillDetails && (
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Supplier</p>
                    <p className="font-medium">
                      {typeof selectedBillDetails.supplierId === "object"
                        ? (selectedBillDetails.supplierId as Supplier)?.name
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <StatusBadge status={selectedBillDetails.status} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bill Date</p>
                    <p className="font-medium">
                      {selectedBillDetails.billDate ? formatDate(selectedBillDetails.billDate) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {selectedBillDetails.dueDate ? formatDate(selectedBillDetails.dueDate) : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Reference</p>
                    <p className="font-medium">{selectedBillDetails.reference || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">PO #</p>
                    <p className="font-medium">
                      {selectedBillDetails.poId && typeof selectedBillDetails.poId === "object"
                        ? (selectedBillDetails.poId as any)?.poNumber
                        : "-"}
                    </p>
                  </div>
                </div>
                
                {/* Line Items */}
                <div>
                  <h4 className="font-semibold mb-3">Line Items</h4>
                  <div className="border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Cost</TableHead>
                          <TableHead className="text-right">VAT</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>GRV</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedBillDetails.billLines?.map((line, index) => (
                          <TableRow key={index}>
                            <TableCell>{line.lineNo}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{line.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {typeof line.stockItemId === "object"
                                    ? (line.stockItemId as StockItem)?.sku
                                    : ""}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{line.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(line.unitCostCents)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(line.vatCents)}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(line.subtotalCents)}
                            </TableCell>
                            <TableCell>
                              {typeof line.grvId === "object"
                                ? (line.grvId as any)?.grvNumber
                                : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                
                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>{formatCurrency(selectedBillDetails.subtotalCents)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">VAT:</span>
                      <span>{formatCurrency(selectedBillDetails.vatCents)}</span>
                    </div>
                    {selectedBillDetails.discountCents > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Discount:</span>
                        <span>-{formatCurrency(selectedBillDetails.discountCents)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>{formatCurrency(selectedBillDetails.totalCents)}</span>
                    </div>
                    {selectedBillDetails.paidCents > 0 && (
                      <>
                        <div className="flex justify-between text-green-600">
                          <span>Paid:</span>
                          <span>{formatCurrency(selectedBillDetails.paidCents)}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span>Balance:</span>
                          <span>{formatCurrency(selectedBillDetails.totalCents - selectedBillDetails.paidCents)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Notes */}
                {selectedBillDetails.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="mt-1">{selectedBillDetails.notes}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
            {selectedBillDetails?.status === "Draft" && (
              <Button onClick={handlePostBill} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />Post Bill
              </Button>
            )}
            {(selectedBillDetails?.status === "Posted" || selectedBillDetails?.status === "PartiallyPaid") && (
              <Button
                variant="destructive"
                onClick={() => { setIsDetailDialogOpen(false); setIsVoidDialogOpen(true); }}
                disabled={isSubmitting}
              >
                <XCircle className="mr-2 h-4 w-4" />Void Bill
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Void Confirmation Dialog */}
      <AlertDialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void this bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This will void the bill "{selectedBill?.billNumber}". This action cannot be undone.
              {selectedBill && selectedBill.paidCents > 0 && (
                <p className="mt-2 text-yellow-600">
                  Warning: This bill has partial payments of {formatCurrency(selectedBill.paidCents)}.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="voidReason">Reason for voiding (optional)</Label>
            <Input
              id="voidReason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Enter reason..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVoidReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoidBill} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Void Bill
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bill?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete bill "{selectedBill?.billNumber}". Only Draft bills can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBill} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
