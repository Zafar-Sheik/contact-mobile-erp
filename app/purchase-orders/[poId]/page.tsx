"use client";

import * as React from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Truck,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  ShoppingCart,
  Receipt,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { useApi, apiUpdate } from "@/lib/hooks/use-api";
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

// Types
interface Supplier {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface POLine {
  lineNo: number;
  stockItemId: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  billedQty: number;
  remainingQty: number;
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
  lines: POLine[];
  grvCount: number;
  billCount: number;
  isActive: boolean;
}

interface GRVLineData {
  lineNo: number;
  stockItemId: string;
  description: string;
  orderedQty: number;
  receivedQty: number;
  unitCostCents: number;
}

interface GRVFormData {
  supplierId: string;
  poId: string;
  referenceType: string;
  referenceNumber: string;
  receivedAt: string;
  locationId: string;
  locationName: string;
  lines: GRVLineData[];
  notes: string;
}

interface BillLineData {
  lineNo: number;
  stockItemId: string;
  description: string;
  quantity: number;
  unitCostCents: number;
  grvId: string;
}

interface BillFormData {
  supplierId: string;
  poId: string;
  billDate: string;
  dueDate: string;
  reference: string;
  grvIds: string[];
  lines: BillLineData[];
  notes: string;
}

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
};

// Status badge helper
const getStatusBadge = (status: string) => {
  const statusConfig: Record<string, { color: string; label: string }> = {
    Draft: { color: "bg-gray-100 text-gray-800", label: "Draft" },
    Issued: { color: "bg-blue-100 text-blue-800", label: "Issued" },
    PartiallyReceived: { color: "bg-yellow-100 text-yellow-800", label: "Partially Received" },
    FullyReceived: { color: "bg-green-100 text-green-800", label: "Fully Received" },
    Closed: { color: "bg-gray-100 text-gray-600", label: "Closed" },
    Cancelled: { color: "bg-red-100 text-red-800", label: "Cancelled" },
  };
  
  const config = statusConfig[status] || { color: "bg-gray-100 text-gray-800", label: status };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

// Progress bar component
const ProgressBar = ({ received, ordered }: { received: number; ordered: number }) => {
  const percentage = ordered > 0 ? Math.min(100, (received / ordered) * 100) : 0;
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-green-500 transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

export default function PODetailPage({ params }: { params: Promise<{ poId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { toast } = useToast();
  
  const { data: po, loading, error, refetch } = useApi<PurchaseOrder>(
    `/api/purchase-orders/${resolvedParams.poId}`
  );

  // Dialog states
  const [isGRVDialogOpen, setIsGRVDialogOpen] = React.useState(false);
  const [isBillDialogOpen, setIsBillDialogOpen] = React.useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // GRV Form
  const [grvData, setGRVData] = React.useState<GRVFormData>({
    supplierId: "",
    poId: "",
    referenceType: "po",
    referenceNumber: "",
    receivedAt: new Date().toISOString().split("T")[0],
    locationId: "main",
    locationName: "Main Warehouse",
    lines: [],
    notes: "",
  });

  // Bill Form
  const [billData, setBillData] = React.useState<BillFormData>({
    supplierId: "",
    poId: "",
    billDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    reference: "",
    grvIds: [],
    lines: [],
    notes: "",
  });

  // Open GRV dialog - navigate to GRV creation with PO reference
  const handleOpenGRVDialog = () => {
    if (!po) return;
    
    // Navigate to GRV page - the user can create a new GRV from there
    // with PO reference passed as query param
    router.push(`/grvs?poId=${po._id}&poNumber=${po.poNumber}&supplierId=${typeof po.supplierId === 'object' ? po.supplierId._id : po.supplierId}`);
  };

  // Open Bill dialog with prefilled data
  const handleOpenBillDialog = () => {
    if (!po) return;
    
    // Navigate to the new bill creation page with PO params
    router.push(`/supplier-bills/new?poId=${po._id}&supplierId=${typeof po.supplierId === 'object' ? po.supplierId._id : po.supplierId}`);
  };

  // Submit PO (change status to Issued)
  const handleSubmitPO = async () => {
    if (!po) return;
    
    setIsSubmitting(true);
    try {
      await apiUpdate<PurchaseOrder, { status: string }>("/api/purchase-orders", po._id, {
        status: "Issued",
      });
      toast({ title: "Success", description: "Purchase order submitted successfully" });
      refetch();
      setIsStatusDialogOpen(false);
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Failed to submit PO",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create GRV
  const handleCreateGRV = async () => {
    setIsSubmitting(true);
    try {
      // Transform GRV data to match API format
      const apiData = {
        ...grvData,
        lines: grvData.lines.map(line => ({
          ...line,
          unitCostCents: line.unitCostCents || 0,
          subtotalCents: line.receivedQty * (line.unitCostCents || 0),
        })),
      };
      
      const response = await fetch("/api/grvs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiData),
      });
      
      if (!response.ok) throw new Error("Failed to create GRV");
      
      toast({ title: "Success", description: "GRV created successfully" });
      setIsGRVDialogOpen(false);
      refetch();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Failed to create GRV",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Supplier Bill
  const handleCreateBill = async () => {
    setIsSubmitting(true);
    try {
      const apiData = {
        ...billData,
        lines: billData.lines.map(line => ({
          ...line,
          quantity: line.quantity || 0,
          unitCostCents: line.unitCostCents || 0,
          vatRate: 15,
        })),
      };
      
      const response = await fetch("/api/supplier-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiData),
      });
      
      if (!response.ok) throw new Error("Failed to create bill");
      
      toast({ title: "Success", description: "Supplier bill created successfully" });
      setIsBillDialogOpen(false);
      refetch();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Failed to create bill",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-gray-600">Failed to load purchase order</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const supplierName = typeof po.supplierId === 'object' ? po.supplierId.name : po.supplierName || "Unknown Supplier";
  const canSubmit = po.status === "Draft";
  const canCreateGRV = po.status === "Issued" || po.status === "PartiallyReceived";
  const canCreateBill = po.status !== "Draft" && po.status !== "Cancelled";

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{po.poNumber}</h1>
            <p className="text-sm text-gray-500">{supplierName}</p>
          </div>
          {getStatusBadge(po.status)}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary Card */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Order Date</p>
                <p className="font-medium">{new Date(po.date).toLocaleDateString("en-ZA")}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Expected Delivery</p>
                <p className="font-medium">
                  {po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString("en-ZA") : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total</p>
                <p className="font-semibold text-lg">{formatCurrency(po.total)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Documents</p>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    {po.grvCount} GRV{po.grvCount !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {po.billCount} Bill{po.billCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>
            </div>
            
            {po.notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-gray-500">Notes</p>
                <p className="text-sm">{po.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Order Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const totalOrdered = po.lines.reduce((sum, l) => sum + l.orderedQty, 0);
              const totalReceived = po.lines.reduce((sum, l) => sum + l.receivedQty, 0);
              const totalBilled = po.lines.reduce((sum, l) => sum + l.billedQty, 0);
              
              return (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Received: {totalReceived} / {totalOrdered}</span>
                    <span className="text-gray-600">Billed: {totalBilled}</span>
                  </div>
                  <ProgressBar received={totalReceived} ordered={totalOrdered} />
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline" className="bg-green-50">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {totalReceived} received
                    </Badge>
                    <Badge variant="outline" className="bg-yellow-50">
                      <Clock className="h-3 w-3 mr-1" />
                      {totalOrdered - totalReceived} remaining
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50">
                      <Receipt className="h-3 w-3 mr-1" />
                      {totalBilled} billed
                    </Badge>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Lines - Mobile Cards */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700 px-1">Line Items</h2>
          {po.lines.map((line) => (
            <Card key={line.lineNo} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-medium text-sm">Line {line.lineNo}</p>
                    <p className="text-gray-600 text-sm line-clamp-2">{line.description}</p>
                  </div>
                  <ProgressBar received={line.receivedQty} ordered={line.orderedQty} />
                </div>
                
                {/* Qty Chips */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                    Ordered: {line.orderedQty}
                  </span>
                  <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-medium">
                    Received: {line.receivedQty}
                  </span>
                  <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded text-xs font-medium">
                    Billed: {line.billedQty}
                  </span>
                  <span className="px-2 py-1 bg-gray-50 text-gray-700 rounded text-xs font-medium">
                    Remaining: {line.remainingQty}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="flex gap-2 max-w-md mx-auto">
          {canSubmit && (
            <Button 
              variant="outline" 
              className="flex-1 h-12 border-blue-200"
              onClick={() => setIsStatusDialogOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              Submit
            </Button>
          )}
          
          {canCreateGRV && (
            <Button 
              className="flex-1 h-12"
              onClick={handleOpenGRVDialog}
            >
              <Truck className="h-4 w-4 mr-2" />
              Create GRV
            </Button>
          )}
          
          {canCreateBill && (
            <Button 
              variant="secondary"
              className="flex-1 h-12"
              onClick={handleOpenBillDialog}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Create Bill
            </Button>
          )}
        </div>
      </div>

      {/* Submit PO Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Purchase Order</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to submit this purchase order? Once submitted, you can start receiving goods against it.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitPO} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit PO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create GRV Dialog */}
      <Dialog open={isGRVDialogOpen} onOpenChange={setIsGRVDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create GRV from PO</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reference Number</label>
              <Input 
                value={grvData.referenceNumber}
                onChange={(e) => setGRVData({ ...grvData, referenceNumber: e.target.value })}
                placeholder="PO Number"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Received Date</label>
              <Input 
                type="date"
                value={grvData.receivedAt}
                onChange={(e) => setGRVData({ ...grvData, receivedAt: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Location</label>
              <Select 
                value={grvData.locationId}
                onValueChange={(value) => setGRVData({ ...grvData, locationId: value, locationName: value === "main" ? "Main Warehouse" : value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main Warehouse</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Lines to Receive</label>
              <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                {grvData.lines.map((line, idx) => (
                  <div key={idx} className="p-2 border rounded bg-gray-50 text-sm">
                    <p className="font-medium">{line.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500">Qty:</span>
                      <Input
                        type="number"
                        className="h-8"
                        value={line.receivedQty}
                        onChange={(e) => {
                          const newLines = [...grvData.lines];
                          newLines[idx] = { ...newLines[idx], receivedQty: parseInt(e.target.value) || 0 };
                          setGRVData({ ...grvData, lines: newLines });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGRVDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGRV} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create GRV"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Bill Dialog */}
      <Dialog open={isBillDialogOpen} onOpenChange={setIsBillDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Supplier Bill</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Supplier Invoice #</label>
              <Input 
                value={billData.reference}
                onChange={(e) => setBillData({ ...billData, reference: e.target.value })}
                placeholder="Invoice number"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Bill Date</label>
              <Input 
                type="date"
                value={billData.billDate}
                onChange={(e) => setBillData({ ...billData, billDate: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Due Date</label>
              <Input 
                type="date"
                value={billData.dueDate}
                onChange={(e) => setBillData({ ...billData, dueDate: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Lines to Bill</label>
              <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                {billData.lines.map((line, idx) => (
                  <div key={idx} className="p-2 border rounded bg-gray-50 text-sm">
                    <p className="font-medium">{line.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500">Qty:</span>
                      <Input
                        type="number"
                        className="h-8"
                        value={line.quantity}
                        onChange={(e) => {
                          const newLines = [...billData.lines];
                          newLines[idx] = { ...newLines[idx], quantity: parseInt(e.target.value) || 0 };
                          setBillData({ ...billData, lines: newLines });
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBillDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBill} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
