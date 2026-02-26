"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  FileText,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Truck,
  Link2,
  Save,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Helper to format PO status
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

// Helper to format GRV status
const getGRVStatusLabel = (status: string) => {
  const statusMap: Record<string, string> = {
    "DRAFT": "Draft",
    "POSTED": "Posted",
    "CANCELLED": "Cancelled"
  };
  return statusMap[status] || status;
};

// Types
interface Supplier {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
}

interface StockItem {
  _id: string;
  name: string;
  sku: string;
  unit: string;
}

interface GRVLine {
  _id: string;
  lineNo: number;
  stockItemId: string;
  itemSnapshot: {
    name: string;
    sku: string;
    unit: string;
    vatRate?: number;
  };
  receivedQty: number;
  unitCostCents: number;
}

interface GRV {
  _id: string;
  grvNumber: string;
  supplierId: string | Supplier;
  receivedAt: string;
  status: string;
  lines: GRVLine[];
  grandTotalCents: number;
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
  supplierId: string;
  status: string;
  lines: POLine[];
  total: number;
}

interface BillLine {
  lineNo: number;
  stockItemId: string;
  description: string;
  quantity: number;
  unitCostCents: number;
  vatRate: number;
  grvId?: string;
  grvLineId?: string;
  poLineId?: string;
}

interface MatchingResult {
  status: "PASS" | "WARN" | "FAIL";
  messages: { type: "error" | "warning" | "info"; message: string }[];
}

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
};

// Matching Panel Component
const MatchingPanel = ({ result }: { result: MatchingResult }) => {
  const statusConfig = {
    PASS: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", border: "border-green-200", label: "Match Passed" },
    WARN: { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", label: "Warnings" },
    FAIL: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "Match Failed" },
  };

  const config = statusConfig[result.status];
  const Icon = config.icon;

  return (
    <Card className={`${config.bg} ${config.border} border`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-base flex items-center gap-2 ${config.color}`}>
          <Icon className="h-5 w-5" />
          {config.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {result.messages.length === 0 ? (
          <p className="text-sm text-gray-600">All checks passed successfully.</p>
        ) : (
          <ul className="space-y-2">
            {result.messages.map((msg, idx) => (
              <li key={idx} className="text-sm flex items-start gap-2">
                {msg.type === "error" ? (
                  <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                ) : msg.type === "warning" ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                )}
                <span className={msg.type === "error" ? "text-red-700" : msg.type === "warning" ? "text-yellow-700" : "text-blue-700"}>
                  {msg.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default function NewSupplierBillPage() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <NewSupplierBillPageContent />
    </Suspense>
  );
}

function NewSupplierBillPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  // URL params
  const supplierIdParam = searchParams.get("supplierId") || "";
  const poIdParam = searchParams.get("poId") || "";
  const grvIdsParam = searchParams.get("grvIds") || "";

  // State
  const [supplierId, setSupplierId] = React.useState(supplierIdParam);
  const [selectedPOId, setSelectedPOId] = React.useState(poIdParam);
  const [selectedGRVIds, setSelectedGRVIds] = React.useState<string[]>(
    grvIdsParam ? grvIdsParam.split(",") : []
  );
  const [billDate, setBillDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = React.useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [reference, setReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<BillLine[]>([]);
  const [sourceType, setSourceType] = React.useState<"po" | "grv" | "mixed">(
    poIdParam ? "po" : grvIdsParam ? "grv" : "po"
  );

  // Data
  const [suppliers, setSuppliers] = React.useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrder[]>([]);
  const [grvs, setGRVs] = React.useState<GRV[]>([]);
  const [matchingResult, setMatchingResult] = React.useState<MatchingResult | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showGRVDialog, setShowGRVDialog] = React.useState(false);
  const [postingGRVId, setPostingGRVId] = React.useState<string | null>(null);

  // Load initial data
  React.useEffect(() => {
    const fetchData = async () => {
      // Fetch suppliers
      const suppliersRes = await fetch("/api/suppliers");
      const suppliersData = await suppliersRes.json();
      setSuppliers(suppliersData.data || []);
    };
    fetchData();
  }, []);

  // Fetch GRVs when supplier changes
  React.useEffect(() => {
    if (!supplierId) return;
    
    const fetchGRVs = async () => {
      const res = await fetch(`/api/grvs?supplierId=${supplierId}`);
      const data = await res.json();
      setGRVs(data.data || []);
    };
    fetchGRVs();
  }, [supplierId]);

  // Post a GRV (to make it ready for billing)
  const postGRV = async (grvId: string) => {
    setPostingGRVId(grvId);
    try {
      const res = await fetch(`/api/grvs/${grvId}/post`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        toast({ title: "Error", description: data.error.message || "Failed to post GRV", variant: "destructive" });
      } else {
        toast({ title: "Success", description: "GRV posted successfully" });
        // Refresh GRVs list
        const grvRes = await fetch(`/api/grvs?supplierId=${supplierId}`);
        const grvData = await grvRes.json();
        setGRVs(grvData.data || []);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to post GRV", variant: "destructive" });
    } finally {
      setPostingGRVId(null);
    }
  };

  // Fetch POs when supplier changes
  React.useEffect(() => {
    if (!supplierId) return;
    
    const fetchPOs = async () => {
      const res = await fetch(`/api/purchase-orders?supplierId=${supplierId}`);
      const data = await res.json();
      setPurchaseOrders(data.data || []);
    };
    fetchPOs();
  }, [supplierId]);

  // Load PO data when PO is selected
  React.useEffect(() => {
    if (!selectedPOId) return;
    
    const fetchPO = async () => {
      const res = await fetch(`/api/purchase-orders/${selectedPOId}`);
      const data = await res.json();
      if (data.data) {
        const po = data.data;
        const poLines: BillLine[] = po.lines
          .filter((l: POLine) => l.remainingQty > 0)
          .map((l: POLine, idx: number) => ({
            lineNo: idx + 1,
            stockItemId: l.stockItemId,
            description: l.description,
            quantity: l.remainingQty,
            unitCostCents: 0, // Would need to fetch from original PO
            vatRate: 15,
            poLineId: l.stockItemId,
          }));
        setLines(poLines);
      }
    };
    fetchPO();
  }, [selectedPOId]);

  // Load GRV data when GRVs are selected
  React.useEffect(() => {
    if (selectedGRVIds.length === 0) return;
    
    const fetchGRVs = async () => {
      const grvPromises = selectedGRVIds.map(id => fetch(`/api/grvs/${id}`).then(r => r.json()));
      const grvData = await Promise.all(grvPromises);
      const allLines: BillLine[] = [];
      
      grvData.forEach((data, idx) => {
        if (data.data) {
          const grv = data.data;
          grv.lines?.forEach((line: GRVLine, lineIdx: number) => {
            allLines.push({
              lineNo: allLines.length + 1,
              stockItemId: line.stockItemId,
              description: line.itemSnapshot?.name || line.itemSnapshot?.sku || "Unknown Item",
              quantity: line.receivedQty,
              unitCostCents: line.unitCostCents || 0,
              vatRate: line.itemSnapshot?.vatRate || 15,
              grvId: grv._id,
              grvLineId: line._id,
            });
          });
        }
      });
      
      setLines(allLines);
    };
    fetchGRVs();
  }, [selectedGRVIds]);

  // Validate matching
  const validateMatching = async () => {
    const messages: { type: "error" | "warning" | "info"; message: string }[] = [];
    let status: "PASS" | "WARN" | "FAIL" = "PASS";

    // Check supplier
    if (!supplierId) {
      messages.push({ type: "error", message: "Supplier is required" });
      status = "FAIL";
    }

    // Check invoice details
    if (!reference.trim()) {
      messages.push({ type: "warning", message: "Invoice reference number is recommended" });
      status = status === "FAIL" ? "FAIL" : "WARN";
    }

    // Check lines
    if (lines.length === 0) {
      messages.push({ type: "error", message: "At least one line item is required" });
      status = "FAIL";
    }

    // Check for zero quantities
    const zeroQtyLines = lines.filter(l => l.quantity <= 0);
    if (zeroQtyLines.length > 0) {
      messages.push({ type: "warning", message: `${zeroQtyLines.length} line(s) have zero quantity` });
      status = status === "FAIL" ? "FAIL" : "WARN";
    }

    // Check GRVs are all Posted
    if (selectedGRVIds.length > 0) {
      const grvStatuses = grvs.filter(g => selectedGRVIds.includes(g._id)).map(g => g.status);
      const nonPosted = grvStatuses.filter(s => s !== "POSTED");
      if (nonPosted.length > 0) {
        messages.push({ type: "error", message: `${nonPosted.length} GRV(s) must be Posted before billing` });
        status = "FAIL";
      }
    }

    // Check PO status if PO is selected
    if (selectedPOId) {
      const po = purchaseOrders.find(p => p._id === selectedPOId);
      if (po && po.lines) {
        const totalRemaining = po.lines.reduce((sum, l) => sum + l.remainingQty, 0);
        const billedNow = lines.reduce((sum, l) => sum + l.quantity, 0);
        if (billedNow > totalRemaining) {
          messages.push({ type: "warning", message: "Billing more than PO remaining quantity" });
          status = status === "FAIL" ? "FAIL" : "WARN";
        }
      }
    }

    setMatchingResult({ status, messages });
    return status !== "FAIL";
  };

  // Submit bill
  const handleSubmit = async (approve: boolean = false) => {
    const isValid = await validateMatching();
    if (!isValid) {
      toast({
        title: "Validation Failed",
        description: "Please fix the matching issues before submitting",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/supplier-bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          poId: selectedPOId || null,
          grvIds: selectedGRVIds,
          billDate,
          dueDate,
          reference,
          notes,
          billLines: lines.map(l => ({
            stockItemId: l.stockItemId,
            description: l.description,
            quantity: l.quantity,
            unitCostCents: l.unitCostCents,
            vatRate: l.vatRate,
            grvId: l.grvId,
            grvLineId: l.grvLineId,
            poLineId: l.poLineId,
          })),
          status: approve ? "APPROVED" : "DRAFT",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create bill");
      }

      toast({
        title: "Success",
        description: `Supplier bill ${approve ? "created and approved" : "saved as draft"} successfully`,
      });
      router.push("/supplier-bills");
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

  const selectedSupplier = suppliers.find(s => s._id === supplierId);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">New Supplier Bill</h1>
            {selectedSupplier && (
              <p className="text-sm text-gray-500">{selectedSupplier.name}</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Supplier & Invoice Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Invoice Number *</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Supplier invoice #"
                />
              </div>
              <div>
                <Label>Invoice Date *</Label>
                <Input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Source Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bill Source</CardTitle>
            <CardDescription>Choose what you're billing against</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={sourceType === "po" ? "default" : "outline"}
                size="sm"
                onClick={() => setSourceType("po")}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                Against PO
              </Button>
              <Button
                variant={sourceType === "grv" ? "default" : "outline"}
                size="sm"
                onClick={() => setSourceType("grv")}
                className="flex-1"
              >
                <Truck className="h-4 w-4 mr-2" />
                Against GRVs
              </Button>
              <Button
                variant={sourceType === "mixed" ? "default" : "outline"}
                size="sm"
                onClick={() => setSourceType("mixed")}
                className="flex-1"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Mixed
              </Button>
            </div>

            {/* PO Selection */}
            {(sourceType === "po" || sourceType === "mixed") && (
              <div>
                <Label>Purchase Order</Label>
                <Select value={selectedPOId} onValueChange={setSelectedPOId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select PO" />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseOrders.map((po) => (
                      <SelectItem key={po._id} value={po._id}>
                        {po.poNumber} - {formatCurrency(po.total)} ({getPOStatusLabel(po.status)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* GRV Selection */}
            {(sourceType === "grv" || sourceType === "mixed") && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Goods Received Notes</Label>
                  <Button variant="outline" size="sm" onClick={() => setShowGRVDialog(true)}>
                    Select GRVs
                  </Button>
                </div>
                {selectedGRVIds.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {grvs
                      .filter((g) => selectedGRVIds.includes(g._id))
                      .map((grv) => (
                        <Badge key={grv._id} variant="secondary">
                          {grv.grvNumber}
                        </Badge>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No GRVs selected</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Line Items</CardTitle>
            <Badge variant="outline">{lines.length} items</Badge>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <p className="text-center text-gray-500 py-4">
                Select a PO or GRVs to add line items
              </p>
            ) : (
              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div key={idx} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-medium text-sm">{line.description}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newLines = [...lines];
                          newLines.splice(idx, 1);
                          setLines(newLines);
                        }}
                      >
                        ×
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          className="h-8"
                          value={line.quantity}
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[idx] = { ...newLines[idx], quantity: parseInt(e.target.value) || 0 };
                            setLines(newLines);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit Cost</Label>
                        <Input
                          type="number"
                          className="h-8"
                          value={line.unitCostCents / 100}
                          onChange={(e) => {
                            const newLines = [...lines];
                            newLines[idx] = { ...newLines[idx], unitCostCents: (parseFloat(e.target.value) || 0) * 100 };
                            setLines(newLines);
                          }}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Total</Label>
                        <p className="text-sm font-medium h-8 flex items-center">
                          {formatCurrency(line.quantity * line.unitCostCents)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardContent className="pt-4">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </CardContent>
        </Card>

        {/* Matching Panel */}
        {matchingResult && <MatchingPanel result={matchingResult} />}
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg">
        <div className="flex gap-2 max-w-md mx-auto">
          <Button
            variant="outline"
            className="flex-1 h-12"
            onClick={validateMatching}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Validate
          </Button>
          <Button
            variant="secondary"
            className="flex-1 h-12"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            className="flex-1 h-12"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? "Submitting..." : "Approve"}
          </Button>
        </div>
      </div>

      {/* GRV Selection Dialog */}
      <Dialog open={showGRVDialog} onOpenChange={setShowGRVDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select GRVs</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {grvs.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No GRVs available</p>
            ) : (
              grvs
                .map((grv) => (
                  <div
                    key={grv._id}
                    className={`p-3 border rounded-lg ${selectedGRVIds.includes(grv._id) ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"}`}
                  >
                    <div 
                      className="flex justify-between items-start cursor-pointer"
                      onClick={() => {
                        if (grv.status === "POSTED") {
                          if (selectedGRVIds.includes(grv._id)) {
                            setSelectedGRVIds(selectedGRVIds.filter((id) => id !== grv._id));
                          } else {
                            setSelectedGRVIds([...selectedGRVIds, grv._id]);
                          }
                        }
                      }}
                    >
                      <div>
                        <span className="font-medium">{grv.grvNumber}</span>
                        <span className="text-sm text-gray-500 ml-2">
                          ({getGRVStatusLabel(grv.status)})
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(grv.receivedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-sm text-gray-500">
                        {formatCurrency(grv.grandTotalCents)} - {grv.lines?.length || 0} items
                      </p>
                      {grv.status === "DRAFT" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={postingGRVId === grv._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            postGRV(grv._id);
                          }}
                        >
                          {postingGRVId === grv._id ? "Posting..." : "Post"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowGRVDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
