"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  ChevronDown,
  Package,
  X,
  FileText,
  Search,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { useApi, apiCreate } from "@/lib/hooks/use-api";
import { MobileMoreMenu, useMobileMoreMenu } from "@/components/mobile/mobile-more-menu";
import { StockItemSelector, StockItemSelectorTrigger, StockItemSelectorItem } from "@/components/erp/stock-item-selector";

// Types
interface Client {
  _id: string;
  name: string;
}

interface GRV {
  _id: string;
  grvNumber: string;
  supplierId: any;
  lines: GRVLine[];
}

interface GRVLine {
  _id: string;
  stockItemId: string;
  itemSnapshot: {
    name: string;
    sku: string;
    unit: string;
  };
  receivedQty: number;
  unitCostCents: number;
}

interface InvoiceLine {
  id: string;
  stockItemId: string | null;
  name: string;
  description: string;
  sku: string;
  unit: string;
  qty: number;
  unitPrice: number;
  discount: number;
  taxable: boolean;
  total: number;
}

interface InvoiceFormData {
  clientId: string;
  grvId: string;
  lines: InvoiceLine[];
  vatMode: string;
  vatRate: number;
  issueDate: string;
  dueDate: string;
  notes: string;
}

const createEmptyLine = (): InvoiceLine => ({
  id: `temp-${Date.now()}-${Math.random()}`,
  stockItemId: null,
  name: "",
  description: "",
  sku: "",
  unit: "each",
  qty: 1,
  unitPrice: 0,
  discount: 0,
  taxable: true,
  total: 0,
});

// Format currency
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents);
};

export default function NewInvoiceFromGRVPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-4">Loading...</div>}>
      <NewInvoiceFromGRVPageInner />
    </Suspense>
  );
}

function NewInvoiceFromGRVPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const grvId = searchParams.get("grvId");
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API data
  const { data: clients } = useApi<Client[]>("/api/clients");
  const grvApiUrl = grvId ? `/api/grvs/${grvId}` : null;
  const { data: grvData, loading: grvLoading } = useApi<GRV>(grvApiUrl as string);
  
  // Form state
  const [formData, setFormData] = React.useState<InvoiceFormData>({
    clientId: "",
    grvId: grvId || "",
    lines: [],
    vatMode: "exclusive",
    vatRate: 15,
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Stock item selector modal state
  const [isSelectorOpen, setIsSelectorOpen] = React.useState(false);
  const [activeLineIndex, setActiveLineIndex] = React.useState<number | null>(null);

  // Open stock item selector for a specific line
  const openSelectorForLine = (index: number) => {
    setActiveLineIndex(index);
    setIsSelectorOpen(true);
  };

  // Handle stock item selection from modal
  const handleStockItemSelect = async (item: StockItemSelectorItem, priceCents: number) => {
    if (activeLineIndex === null) return;
    
    const updatedLines = [...formData.lines];
    updatedLines[activeLineIndex] = {
      ...updatedLines[activeLineIndex],
      stockItemId: item._id,
      name: item.name,
      description: item.description || item.name,
      sku: item.sku,
      unit: item.unit,
      qty: updatedLines[activeLineIndex].qty || 1,
      unitPrice: priceCents / 100,
      taxable: !item.tax?.isVatExempt,
      total: (updatedLines[activeLineIndex].qty || 1) * (priceCents / 100),
    };
    
    setFormData((prev) => ({ ...prev, lines: updatedLines }));
    setIsSelectorOpen(false);
    setActiveLineIndex(null);
  };

  // Initialize lines from GRV when GRV data loads
  React.useEffect(() => {
    if (grvData?.lines && formData.lines.length === 0) {
      const lines = grvData.lines.map((line: GRVLine, index: number) => ({
        id: `grv-${index}-${Date.now()}`,
        stockItemId: line.stockItemId || null,
        name: line.itemSnapshot?.name || "",
        description: line.itemSnapshot?.name || "",
        sku: line.itemSnapshot?.sku || "",
        unit: line.itemSnapshot?.unit || "each",
        qty: line.receivedQty || 1,
        unitPrice: (line.unitCostCents || 0) / 100, // Convert cost to selling price (editable)
        discount: 0,
        taxable: true,
        total: (line.receivedQty || 1) * ((line.unitCostCents || 0) / 100),
      }));
      setFormData((prev) => ({ ...prev, lines }));
    }
  }, [grvData]);

  // Set due date based on issue date
  React.useEffect(() => {
    if (formData.issueDate && !formData.dueDate) {
      const issueDate = new Date(formData.issueDate);
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 30);
      setFormData((prev) => ({
        ...prev,
        dueDate: dueDate.toISOString().split("T")[0],
      }));
    }
  }, [formData.issueDate]);

  // Calculate totals
  const totals = React.useMemo(() => {
    let subtotal = 0;
    formData.lines.forEach((line) => {
      const lineTotal = line.qty * (line.unitPrice - line.discount);
      subtotal += lineTotal;
    });
    const vatAmount = formData.vatMode === "exclusive" ? subtotal * (formData.vatRate / 100) : 0;
    const total = formData.vatMode === "exclusive" ? subtotal + vatAmount : subtotal;
    return { subtotal, vatAmount, total };
  }, [formData.lines, formData.vatRate, formData.vatMode]);

  // Add new line
  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, createEmptyLine()],
    }));
  };

  // Remove line
  const removeLine = (lineId: string) => {
    if (formData.lines.length === 1) return;
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.id !== lineId),
    }));
  };

  // Update line
  const updateLine = (lineId: string, updates: Partial<InvoiceLine>) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((l) =>
        l.id === lineId ? { ...l, ...updates } : l
      ),
    }));
  };

  // Handle cancel
  const handleCancel = () => {
    router.push("/grvs");
  };

  // Handle submit
  const handleSubmit = async (issueImmediately: boolean) => {
    if (!formData.clientId) {
      toast({ title: "Error", description: "Please select a client", variant: "destructive" });
      return;
    }

    const validLines = formData.lines.filter((l) => l.name);
    if (validLines.length === 0) {
      toast({ title: "Error", description: "Please add at least one line item", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const invoiceData = {
        grvId: formData.grvId,
        clientId: formData.clientId,
        lines: validLines.map((line, index) => ({
          name: line.name,
          description: line.description,
          sku: line.sku,
          unit: line.unit,
          quantity: line.qty,
          unitPriceCents: Math.round(line.unitPrice * 100),
          discountCents: Math.round(line.discount * 100),
          taxable: line.taxable,
        })),
        vatMode: formData.vatMode,
        vatRateBps: formData.vatRate * 100,
        issueDate: formData.issueDate,
        dueDate: formData.dueDate,
        notes: formData.notes || undefined,
        status: issueImmediately ? "issued" : "draft",
      };

      await apiCreate("/api/invoices/create-from-grv", invoiceData);
      toast({ title: "Success", description: issueImmediately ? "Invoice created and issued" : "Invoice saved as draft" });
      router.push("/invoices");
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

  if (grvLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading GRV...</p>
        </div>
      </div>
    );
  }

  if (!grvData && grvId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">GRV not found</p>
          <Button asChild className="mt-4">
            <Link href="/grvs">Back to GRVs</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-10 w-10">
              <Link href="/grvs">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold">New Invoice from GRV</h1>
              {grvData && (
                <p className="text-sm text-gray-500">GRV #{grvData.grvNumber}</p>
              )}
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={openMore} className="h-10 w-10">
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* GRV Info Card */}
        {grvData && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Creating Invoice from GRV</p>
                <p className="text-sm text-blue-700">GRV #{grvData.grvNumber} - {grvData.lines.length} items</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Client Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client *</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={formData.clientId}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, clientId: value }))}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client._id} value={client._id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Line Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addLine} className="h-8">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {formData.lines.map((line, index) => (
              <div key={line.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">Item {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500"
                    onClick={() => removeLine(line.id)}
                    disabled={formData.lines.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Stock Item */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Stock Item</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <StockItemSelectorTrigger
                        onClick={() => openSelectorForLine(index)}
                        hasSelection={!!line.stockItemId}
                        itemName={line.name}
                        itemSku={line.sku}
                        itemUnit={line.unit}
                      />
                    </div>
                    {line.stockItemId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => updateLine(line.id, { stockItemId: null, name: "", description: "", sku: "", unit: "each", unitPrice: 0, taxable: true })}
                        className="h-11 w-11 text-gray-400 hover:text-red-500"
                        title="Clear item"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Quantity & Unit Price */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Quantity</Label>
                    <Input
                      type="number"
                      min="0"
                      value={line.qty}
                      onChange={(e) => updateLine(line.id, { qty: parseFloat(e.target.value) || 0 })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Unit Price (ZAR)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                      className="h-10"
                    />
                  </div>
                </div>

                {/* Discount & Taxable */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-600">Discount (ZAR)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.discount}
                      onChange={(e) => updateLine(line.id, { discount: parseFloat(e.target.value) || 0 })}
                      className="h-10"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Checkbox
                      id={`taxable-${line.id}`}
                      checked={line.taxable}
                      onCheckedChange={(checked) => updateLine(line.id, { taxable: checked as boolean })}
                    />
                    <Label htmlFor={`taxable-${line.id}`} className="text-sm">
                      VAT ({formData.vatRate}%)
                    </Label>
                  </div>
                </div>

                {/* Line Total */}
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Line Total:</span>
                    <span className="font-semibold">
                      {formatCurrency(line.qty * (line.unitPrice - line.discount))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* VAT Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">VAT Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">VAT Mode</Label>
              <Select
                value={formData.vatMode}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, vatMode: value }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inclusive">VAT Inclusive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
                <Label className="text-sm text-gray-600">VAT Rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.vatRate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, vatRate: parseFloat(e.target.value) || 0 }))}
                  className="h-10"
                />
              </div>
            </CardContent>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Issue Date</Label>
              <Input
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, issueDate: e.target.value }))}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Due Date</Label>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, dueDate: e.target.value }))}
                className="h-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes..."
              className="h-20"
            />
          </CardContent>
        </Card>

        {/* Totals */}
        <Card className="bg-gray-900 text-white">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Subtotal:</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">VAT ({formData.vatRate}%):</span>
              <span>{formatCurrency(totals.vatAmount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-700">
              <span>Total:</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe z-20">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1 h-12"
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="flex-1 h-12"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4 mr-2" />
            {isSubmitting ? "Creating..." : "Issue"}
          </Button>
        </div>
      </div>

      {/* Stock Item Selector Modal */}
      <StockItemSelector
        open={isSelectorOpen}
        onOpenChange={setIsSelectorOpen}
        onSelect={handleStockItemSelect}
        activeLineIndex={activeLineIndex ?? undefined}
        mode="invoice"
      />
    </div>
  );
}
