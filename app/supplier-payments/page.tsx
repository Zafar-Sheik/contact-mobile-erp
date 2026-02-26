"use client";

import * as React from "react";
import {
  Search,
  Edit,
  Trash2,
  DollarSign,
  MoreHorizontal,
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

interface SupplierPayment {
  _id: string;
  paymentNumber: string;
  supplierId: string | { _id: string; name: string };
  paymentDate: string;
  method: string;
  amountCents: number;
  reference?: string;
  notes?: string;
  status: string;
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

const paymentMethods = ["Cash", "EFT", "Card", "Cheque", "Other"];

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
    Pending: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending" },
    Completed: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
    Failed: { bg: "bg-red-100", text: "text-red-700", label: "Failed" },
    Cancelled: { bg: "bg-gray-100", text: "text-gray-700", label: "Cancelled" },
  };
  return colors[status] || colors.Pending;
};

export default function SupplierPaymentsPage() {
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API hooks
  const { data: payments, loading, error, refetch } = useApi<SupplierPayment[]>("/api/supplier-payments");
  const { data: suppliers } = useApi<Supplier[]>("/api/suppliers");

  // State
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedPayment, setSelectedPayment] = React.useState<SupplierPayment | null>(null);
  const [formData, setFormData] = React.useState<PaymentFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filter payments
  const filteredPayments = React.useMemo(() => {
    if (!payments) return [];
    return payments.filter((payment) => {
      const supplierName = typeof payment.supplierId === "object" ? payment.supplierId.name : "";
      const matchesSearch =
        !searchTerm ||
        payment.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [payments, searchTerm]);

  // Stats
  const stats = React.useMemo(() => {
    if (!payments) return { total: 0, count: 0 };
    return {
      total: payments.reduce((sum, p) => sum + p.amountCents, 0),
      count: payments.length,
    };
  }, [payments]);

  const handleOpenDialog = (payment?: SupplierPayment) => {
    if (payment) {
      setSelectedPayment(payment);
      const supplierId = typeof payment.supplierId === "object" ? payment.supplierId._id : payment.supplierId;
      setFormData({
        supplierId: supplierId || "",
        amount: String(payment.amountCents / 100),
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
        amountCents: Math.round(Number(formData.amount) * 100),
        method: formData.method,
        paymentDate: formData.paymentDate,
        reference: formData.reference || undefined,
        notes: formData.notes || undefined,
      };

      if (selectedPayment) {
        await apiUpdate<SupplierPayment, typeof paymentData>("/api/supplier-payments", selectedPayment._id, paymentData);
        toast({ title: "Success", description: "Payment updated successfully" });
      } else {
        await apiCreate<SupplierPayment, typeof paymentData>("/api/supplier-payments", paymentData);
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
      setIsDeleteDialogOpen(false);
      setSelectedPayment(null);
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
          <h1 className="text-xl font-bold text-gray-900">Supplier Payments</h1>
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
            placeholder="Search payments..."
            className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Stats */}
      {!loading && !error && payments && payments.length > 0 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="bg-green-50 rounded-xl p-3 text-center max-w-md mx-auto">
            <p className="text-xs text-green-600 font-medium">Total Payments</p>
            <p className="text-xl font-bold text-green-700">{formatCurrency(stats.total)}</p>
          </div>
        </div>
      )}

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
            <p className="text-red-600 font-medium">Error loading payments</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredPayments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <DollarSign className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No payments found" : "No supplier payments yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? "Try a different search term" : "Record your first supplier payment"}
            </p>
          </div>
        )}

        {/* Payments List */}
        {!loading && !error && filteredPayments.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredPayments.map((payment) => {
              const statusColors = getStatusColors(payment.status);
              const supplierName = typeof payment.supplierId === "object" ? payment.supplierId.name : "Unknown";
              
              return (
                <div
                  key={payment._id}
                  onClick={() => handleOpenDialog(payment)}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-green-100 p-2 rounded-full">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{payment.paymentNumber}</h3>
                        <p className="text-sm text-gray-500">{supplierName}</p>
                      </div>
                    </div>
                    <Badge className={`${statusColors.bg} ${statusColors.text} ml-2 shrink-0`}>
                      {statusColors.label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pl-12">
                    <span className="text-sm text-gray-500">
                      {formatDate(payment.paymentDate)}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(payment.amountCents)}
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
                        handleOpenDialog(payment);
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
                        setSelectedPayment(payment);
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
              {selectedPayment ? "Edit Payment" : "New Payment"}
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

            <div className="space-y-2">
              <Label>Amount (ZAR)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                className="h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={formData.method}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, method: value }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, paymentDate: e.target.value }))}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={formData.reference}
                onChange={(e) => setFormData((prev) => ({ ...prev, reference: e.target.value }))}
                placeholder="Payment reference..."
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseDialog} className="flex-1 h-12">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.supplierId || !formData.amount}
              className="flex-1 h-12"
            >
              {isSubmitting ? "Saving..." : selectedPayment ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this payment? This action cannot be undone.
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
