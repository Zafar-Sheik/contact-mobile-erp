"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Send,
  ChevronDown,
  Package,
  X,
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

interface Quote {
  _id: string;
  quoteNumber: string;
  clientId: string | Client;
  status: string;
}

interface InvoiceLine {
  id: string;
  stockItemId: string | null;
  itemName: string;
  itemSku: string;
  itemUnit: string;
  qty: number;
  unitPrice: number;
  discount: number;
  taxable: boolean;
  total: number;
}

interface InvoiceFormData {
  clientId: string;
  sourceQuoteId: string;
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
  itemName: "",
  itemSku: "",
  itemUnit: "each",
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

export default function NewInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API data
  const { data: clients } = useApi<Client[]>("/api/clients");
  const { data: quotes } = useApi<Quote[]>("/api/quotes");
  
  // Modal state
  const [isSelectorOpen, setIsSelectorOpen] = React.useState(false);
  const [activeLineIndex, setActiveLineIndex] = React.useState<number | null>(null);

  // Form state
  const [formData, setFormData] = React.useState<InvoiceFormData>({
    clientId: "",
    sourceQuoteId: "",
    lines: [createEmptyLine()],
    vatMode: "exclusive",
    vatRate: 15,
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filter accepted quotes
  const acceptedQuotes = React.useMemo(() => {
    return quotes?.filter((q) => q.status === "accepted") || [];
  }, [quotes]);

  // Set due date based on issue date when issue date changes
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

  // Handle stock item selection from modal
  const handleStockItemSelect = async (item: StockItemSelectorItem) => {
    if (activeLineIndex === null) return;
    const line = formData.lines[activeLineIndex];
    if (!line) return;
    
    updateLine(line.id, {
      stockItemId: item._id,
      itemName: item.name,
      itemSku: item.sku,
      itemUnit: item.unit,
      unitPrice: item.pricing?.salePriceCents ? item.pricing.salePriceCents / 100 : 0,
      qty: line.qty || 1,
    });

    // Track usage in background (fire and forget)
    fetch(`/api/stock-items/track-usage?stockItemId=${item._id}`, { method: "POST" }).catch(() => {});
    
    setActiveLineIndex(null);
  };

  // Open selector for specific line
  const openSelectorForLine = (lineIndex: number) => {
    setActiveLineIndex(lineIndex);
    setIsSelectorOpen(true);
  };

  // Clear stock item from line
  const clearStockItem = (lineId: string) => {
    updateLine(lineId, {
      stockItemId: null,
      itemName: "",
      itemSku: "",
      itemUnit: "each",
      unitPrice: 0,
    });
  };

  // Handle quote selection
  const handleQuoteChange = (quoteId: string) => {
    const quote = quotes?.find((q) => q._id === quoteId);
    if (quote) {
      // For now, just set the client ID from the quote
      const clientId = typeof quote.clientId === "object" ? quote.clientId._id : quote.clientId;
      setFormData((prev) => ({
        ...prev,
        sourceQuoteId: quoteId,
        clientId: clientId || prev.clientId,
      }));
    }
  };

  // Handle cancel
  const handleCancel = () => {
    router.push("/invoices");
  };

  // Handle submit
  const handleSubmit = async (issueImmediately: boolean) => {
    if (!formData.clientId) {
      toast({ title: "Error", description: "Please select a client", variant: "destructive" });
      return;
    }

    const validLines = formData.lines.filter((l) => l.stockItemId);
    if (validLines.length === 0) {
      toast({ title: "Error", description: "Please add at least one line item", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const invoiceData = {
        clientId: formData.clientId,
        sourceType: formData.sourceQuoteId ? "quote" : "manual",
        sourceId: formData.sourceQuoteId || undefined,
        lines: validLines.map((line, index) => ({
          lineNo: index + 1,
          stockItemId: line.stockItemId,
          skuSnapshot: line.itemSku,
          nameSnapshot: line.itemName,
          unit: "each",
          qty: line.qty,
          unitPriceCents: Math.round(line.unitPrice * 100),
          discountCents: Math.round(line.discount * 100),
          taxable: line.taxable,
          lineTotalCents: Math.round((line.qty * (line.unitPrice - line.discount)) * 100),
        })),
        vatMode: formData.vatMode,
        vatRateBps: formData.vatRate * 100,
        issueDate: formData.issueDate,
        dueDate: formData.dueDate,
        notes: formData.notes || undefined,
        status: issueImmediately ? "issued" : "draft",
      };

      await apiCreate("/api/invoices", invoiceData);
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

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-10 w-10">
              <Link href="/invoices">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold">New Invoice</h1>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={openMore} className="h-10 w-10">
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Client & Source Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client & Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quote Selection */}
            {acceptedQuotes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">Create from Quote (optional)</Label>
                <Select
                  value={formData.sourceQuoteId}
                  onValueChange={handleQuoteChange}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select a quote" />
                  </SelectTrigger>
                  <SelectContent>
                    {acceptedQuotes.map((quote) => (
                      <SelectItem key={quote._id} value={quote._id}>
                        Quote #{quote.quoteNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Client Selection */}
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Client *</Label>
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
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Line Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addLine} className="h-9">
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.lines.map((line, index) => (
              <div key={line.id} className="bg-gray-50 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Item {index + 1}</span>
                  {formData.lines.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={() => removeLine(line.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Stock Item</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <StockItemSelectorTrigger
                        onClick={() => openSelectorForLine(index)}
                        hasSelection={!!line.stockItemId}
                        itemName={line.itemName}
                        itemSku={line.itemSku}
                        itemUnit={line.itemUnit}
                      />
                    </div>
                    {line.stockItemId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => clearStockItem(line.id)}
                        className="h-11 w-11 text-gray-400 hover:text-red-500"
                        title="Clear item"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {!line.stockItemId && (
                    <p className="text-xs text-red-500 mt-1">Please select a stock item</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      value={line.qty}
                      onChange={(e) =>
                        updateLine(line.id, { qty: Number(e.target.value) || 1 })
                      }
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Unit Price</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      onChange={(e) =>
                        updateLine(line.id, { unitPrice: Number(e.target.value) || 0 })
                      }
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`taxable-${line.id}`}
                    checked={line.taxable}
                    onCheckedChange={(checked) =>
                      updateLine(line.id, { taxable: checked as boolean })
                    }
                  />
                  <label
                    htmlFor={`taxable-${line.id}`}
                    className="text-sm text-gray-600"
                  >
                    Taxable
                  </label>
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
              <Label className="text-sm">VAT Mode</Label>
              <Select
                value={formData.vatMode}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, vatMode: value }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exclusive">VAT Exclusive</SelectItem>
                  <SelectItem value="inclusive">VAT Inclusive</SelectItem>
                  <SelectItem value="none">No VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">VAT Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.vatRate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, vatRate: Number(e.target.value) || 0 }))
                }
                className="h-11"
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Issue Date</Label>
                <Input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, issueDate: e.target.value }))
                  }
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Due Date</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                  className="h-11"
                />
              </div>
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
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Additional notes..."
              className="h-11"
            />
          </CardContent>
        </Card>

        {/* Totals Summary */}
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">{formatCurrency(totals.subtotal * 100)}</span>
              </div>
              {formData.vatMode === "exclusive" && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT ({formData.vatRate}%)</span>
                  <span className="font-medium">{formatCurrency(totals.vatAmount * 100)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-green-200">
                <span>Total</span>
                <span>{formatCurrency(totals.total * 100)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Bottom Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe z-20 space-y-2">
        <Button
          onClick={() => handleSubmit(true)}
          disabled={isSubmitting}
          className="w-full h-12 bg-green-600 hover:bg-green-700"
        >
          {isSubmitting ? "Saving..." : "Save & Issue"}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="flex-1 h-11"
          >
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="flex-1 h-11"
          >
            Save Draft
          </Button>
        </div>
      </div>

      {/* Mobile More Menu */}
      <MobileMoreMenu open={isMoreOpen} onClose={closeMore} />

      {/* Stock Item Selector Modal */}
      <StockItemSelector
        open={isSelectorOpen}
        onOpenChange={setIsSelectorOpen}
        onSelect={handleStockItemSelect}
        activeLineIndex={activeLineIndex ?? undefined}
      />
    </div>
  );
}
