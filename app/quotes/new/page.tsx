"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  X,
  ChevronDown,
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

// Types
interface Client {
  _id: string;
  name: string;
}

interface StockItem {
  _id: string;
  sku: string;
  name: string;
  unit: string;
}

interface QuoteLine {
  id: string;
  stockItemId: string;
  itemName: string;
  itemSku: string;
  qty: number;
  unitPrice: number;
  discount: number;
  taxable: boolean;
  total: number;
}

interface QuoteFormData {
  clientId: string;
  lines: QuoteLine[];
  vatMode: string;
  vatRate: number;
  validUntil: string;
  notes: string;
}

const createEmptyLine = (): QuoteLine => ({
  id: `temp-${Date.now()}-${Math.random()}`,
  stockItemId: "",
  itemName: "",
  itemSku: "",
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

export default function NewQuotePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API data
  const { data: clients } = useApi<Client[]>("/api/clients");
  const { data: stockItems } = useApi<StockItem[]>("/api/stock-items");

  // Form state
  const [formData, setFormData] = React.useState<QuoteFormData>({
    clientId: "",
    lines: [createEmptyLine()],
    vatMode: "exclusive",
    vatRate: 15,
    validUntil: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
  const updateLine = (lineId: string, updates: Partial<QuoteLine>) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((l) =>
        l.id === lineId ? { ...l, ...updates } : l
      ),
    }));
  };

  // Handle stock item selection
  const handleStockItemChange = (lineId: string, itemId: string) => {
    const item = stockItems?.find((i) => i._id === itemId);
    if (item) {
      updateLine(lineId, {
        stockItemId: itemId,
        itemName: item.name,
        itemSku: item.sku,
      });
    }
  };

  // Handle cancel
  const handleCancel = () => {
    router.push("/quotes");
  };

  // Handle submit
  const handleSubmit = async (saveAsDraft: boolean) => {
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
      const quoteData = {
        clientId: formData.clientId,
        lines: validLines.map((line, index) => ({
          lineNo: index + 1,
          stockItemId: line.stockItemId,
          itemSnapshot: {
            sku: line.itemSku,
            name: line.itemName,
            unit: "each",
            vatRate: formData.vatRate * 100,
            isVatExempt: !line.taxable,
          },
          qty: line.qty,
          unitPriceCents: Math.round(line.unitPrice * 100),
          discountCents: Math.round(line.discount * 100),
          taxable: line.taxable,
          lineTotalCents: Math.round((line.qty * (line.unitPrice - line.discount)) * 100),
        })),
        vatMode: formData.vatMode,
        vatRateBps: formData.vatRate * 100,
        validUntil: formData.validUntil || null,
        notes: formData.notes || undefined,
        status: saveAsDraft ? "draft" : "sent",
      };

      await apiCreate("/api/quotes", quoteData);
      toast({ title: "Success", description: saveAsDraft ? "Quote saved as draft" : "Quote created and sent" });
      router.push("/quotes");
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
              <Link href="/quotes">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold">New Quote</h1>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={openMore} className="h-10 w-10">
            <ChevronDown className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Client Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={formData.clientId}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, clientId: value }))}
            >
              <SelectTrigger className="h-12">
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

                <Select
                  value={line.stockItemId}
                  onValueChange={(value) => handleStockItemChange(line.id, value)}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockItems?.map((item) => (
                      <SelectItem key={item._id} value={item._id}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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

        {/* Additional Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Additional Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Valid Until</Label>
              <Input
                type="date"
                value={formData.validUntil}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, validUntil: e.target.value }))
                }
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Additional notes..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Totals Summary */}
        <Card className="bg-blue-50 border-blue-200">
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
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-blue-200">
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
          onClick={() => handleSubmit(false)}
          disabled={isSubmitting}
          className="w-full h-12 bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting ? "Saving..." : "Save & Send"}
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
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className="flex-1 h-11"
          >
            Save Draft
          </Button>
        </div>
      </div>

      {/* Mobile More Menu */}
      <MobileMoreMenu open={isMoreOpen} onClose={closeMore} />
    </div>
  );
}
