"use client";

import * as React from "react";
import {
  Plus,
  DollarSign,
  Loader2,
  MoreVertical,
  Calendar,
  ExternalLink,
  Edit,
  Trash2,
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
import { useApi, apiCreate, apiUpdate, apiDelete } from "@/lib/hooks/use-api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";

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

interface SupplierPayment {
  _id: string;
  paymentNumber: string;
  supplierId: string | { _id: string; name: string; email?: string; phone?: string };
  paymentDate: string;
  method: string;
  amountCents: number;
  reference?: string;
  notes?: string;
  status: string;
  unallocatedCents: number;
}

interface PaymentFormData {
  supplierId: string;
  amount: string;
  method: string;
  paymentDate: string;
  reference: string;
  notes: string;
}

const initialFormData: PaymentFormData = {
  supplierId: "",
  amount: "0",
  method: "EFT",
  paymentDate: new Date().toISOString().split("T")[0],
  reference: "",
  notes: "",
};

// Payment methods must match the model enum: Cash, EFT, Card, Cheque, Other
const paymentMethods = ["Cash", "EFT", "Card", "Cheque", "Other"];

export default function SupplierPaymentsPage() {
  const { toast } = useToast();
  const { data: payments, loading, error, refetch } = useApi<SupplierPayment[]>("/api/supplier-payments");
  const { data: suppliers, refetch: refetchSuppliers } = useApi<Supplier[]>("/api/suppliers");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedPayment, setSelectedPayment] = React.useState<SupplierPayment | null>(null);
  const [formData, setFormData] = React.useState<PaymentFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const filteredPayments = React.useMemo(() => {
    if (!payments) return [];
    return payments.filter(
      (payment) => {
        const supplierName = typeof payment.supplierId === "object" 
          ? (payment.supplierId as any)?.name 
          : "";
        return (
          supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payment.paymentNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payment.reference?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
    );
  }, [payments, searchTerm]);

  const handleOpenDialog = (payment?: SupplierPayment) => {
    // Refresh suppliers list when opening dialog in case new ones were added
    refetchSuppliers();
    
    if (payment) {
      setSelectedPayment(payment);
      // Handle both cases: supplierId can be a string or an object (from populate)
      const supplierIdValue = typeof payment.supplierId === "object" 
        ? (payment.supplierId as any)?._id || ""
        : payment.supplierId || "";
      setFormData({
        supplierId: supplierIdValue,
        amount: String((payment.amountCents || 0) / 100),
        method: payment.method || "EFT",
        paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toISOString().split("T")[0] : "",
        reference: payment.reference || "",
        notes: payment.notes || "",
      });
    } else {
      setSelectedPayment(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedPayment(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    if (!formData.supplierId) {
      toast({ title: "Error", description: "Please select a supplier", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentData = {
        supplierId: formData.supplierId,
        paymentDate: formData.paymentDate,
        method: formData.method,
        amountCents: Math.round(Number(formData.amount) * 100),
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
      };

      if (selectedPayment) {
        await apiUpdate<SupplierPayment>("/api/supplier-payments", selectedPayment._id, paymentData);
        toast({ title: "Success", description: "Payment updated successfully" });
      } else {
        await apiCreate<SupplierPayment>("/api/supplier-payments", paymentData);
        toast({ title: "Success", description: "Payment created successfully" });
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
    if (!selectedPayment) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/supplier-payments", selectedPayment._id);
      toast({ title: "Success", description: "Payment deleted successfully" });
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
    setSelectedPayment(null);
  };

  const getMethodBadge = (method: string) => {
    const variants: Record<string, "success" | "warning" | "secondary" | "default"> = {
      EFT: "success",
      Cheque: "warning",
      Cash: "secondary",
      Deposit: "default",
      Transfer: "success",
    };
    return <Badge variant={variants[method] || "secondary"}>{method}</Badge>;
  };

  const getMethodVariant = (method: string): "success" | "warning" | "secondary" | "default" => {
    const variants: Record<string, "success" | "warning" | "secondary" | "default"> = {
      EFT: "success",
      Cheque: "warning",
      Cash: "secondary",
      Deposit: "default",
      Transfer: "success",
    };
    return variants[method] || "secondary";
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(cents / 100);
  };

  const getSupplierName = (payment: SupplierPayment): string => {
    if (typeof payment.supplierId === "object") {
      return (payment.supplierId as any)?.name || "No supplier";
    }
    return "No supplier";
  };

  return (
    <MainLayout showTabBar={true} showFab={false}>
      <div className="space-y-4 md:space-y-6">
        {/* Page Header - Mobile */}
        <div className="md:hidden">
          <PageHeader
            title="Supplier Payments"
            subtitle="Track payments to suppliers"
            primaryAction={{
              label: "Add Payment",
              onClick: () => handleOpenDialog(),
              icon: <Plus className="h-4 w-4" />,
            }}
          />
          <div className="px-4">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search payments..."
            />
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Supplier Payments</h1>
            <p className="text-muted-foreground">Track payments to suppliers</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="w-full gap-2 md:w-auto" size="lg">
            <Plus className="h-5 w-5" />Add Payment
          </Button>
        </div>

        {/* Desktop Search */}
        <div className="hidden md:block">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search payments..."
          />
        </div>

        {payments && payments.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle></CardHeader><CardContent><div className="text-xl font-bold md:text-2xl">{payments.length}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Paid</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-red-600 md:text-2xl">{formatCurrency(payments.reduce((sum, p) => sum + (p.amountCents || 0), 0))}</div></CardContent></Card>
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
                <p className="text-destructive">Error loading payments</p>
                <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State - Mobile */}
        {!loading && !error && filteredPayments.length === 0 && searchTerm && (
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
        {!loading && !error && filteredPayments.length === 0 && !searchTerm && (
          <div className="hidden md:block">
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No payments found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Get started by recording your first payment</p>
                  <Button variant="outline" className="mt-4" onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Add Payment</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mobile List */}
        {!loading && !error && filteredPayments.length > 0 && (
          <div className="md:hidden px-4">
            <MobileList
              loading={loading}
              emptyState={{
                icon: <DollarSign className="h-10 w-10" />,
                title: "No payments found",
                description: searchTerm 
                  ? "Try adjusting your search" 
                  : "Get started by recording your first payment",
                action: searchTerm 
                  ? { label: "Clear search", onClick: () => setSearchTerm("") }
                  : { label: "Add Payment", onClick: () => handleOpenDialog() },
              }}
            >
              {filteredPayments.map((payment) => (
                <MobileListItemWrapper
                  key={payment._id}
                  onClick={() => handleOpenDialog(payment)}
                >
                  <MobileListItem
                    title={getSupplierName(payment)}
                    subtitle={payment.paymentNumber || "No number"}
                    description={payment.reference || undefined}
                    avatar={{
                      icon: <DollarSign className="h-5 w-5 text-red-600" />,
                      fallback: payment.paymentNumber?.substring(0, 2).toUpperCase() || "PY",
                    }}
                    status={{
                      label: payment.method,
                      variant: getMethodVariant(payment.method),
                    }}
                    showChevron={false}
                    rightContent={
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {formatCurrency(payment.amountCents || 0)}
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenDialog(payment); }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setSelectedPayment(payment); 
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
        {!loading && !error && filteredPayments.length > 0 && (
          <div className="hidden md:block rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Payment #</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment._id}>
                      <TableCell>{payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : "-"}</TableCell>
                      <TableCell className="font-medium">
                        {getSupplierName(payment)}
                      </TableCell>
                      <TableCell>{payment.paymentNumber || "-"}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(payment.amountCents || 0)}</TableCell>
                      <TableCell>{getMethodBadge(payment.method)}</TableCell>
                      <TableCell>{payment.reference || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(payment)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { setSelectedPayment(payment); setIsDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
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
        label="Add Payment"
      />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedPayment ? "Edit Payment" : "Add Payment"}</DialogTitle>
            <DialogDescription>{selectedPayment ? "Update the payment details below" : "Enter the new payment details below"}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier *</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.supplierId}
                    onValueChange={(value) => {
                      if (value === "new") {
                        window.open("/suppliers", "_blank");
                      } else {
                        setFormData({ ...formData, supplierId: value });
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier._id} value={supplier._id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="new" className="font-medium text-primary">
                        <Plus className="inline h-4 w-4 mr-1" /> Add New Supplier
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open("/suppliers", "_blank")}
                    title="Open Suppliers"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (R)</Label>
                  <Input id="amount" type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentDate">Date</Label>
                  <Input id="paymentDate" type="date" value={formData.paymentDate} onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="method">Payment Method</Label>
                  <Select
                    value={formData.method}
                    onValueChange={(value) => setFormData({ ...formData, method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method) => (
                        <SelectItem key={method} value={method}>{method}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference</Label>
                  <Input id="reference" value={formData.reference} onChange={(e) => setFormData({ ...formData, reference: e.target.value })} placeholder="Enter reference" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes..." />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selectedPayment ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete this payment.</AlertDialogDescription>
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
