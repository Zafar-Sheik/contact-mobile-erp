"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  Save,
  X,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency, calculateLineTotal, calculateDocumentTotals, VatMode } from "@/lib/utils/totals";
import { useApi } from "@/lib/hooks/use-api";
import Link from "next/link";

// Types
interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  billing?: {
    address?: {
      line1?: string;
      line2?: string;
      city?: string;
      provinceState?: string;
      country?: string;
      postalCode?: string;
    };
  };
}

interface StockItem {
  _id: string;
  sku: string;
  name: string;
  unit: string;
  sellingPriceCents?: number;
  isVatExempt?: boolean;
  vatRate?: number;
}

interface QuoteLine {
  id: string;
  lineNo: number;
  stockItemId: string;
  itemSnapshot: {
    sku: string;
    name: string;
    unit: string;
  };
  qty: number;
  unitPriceCents: number;
  discountCents: number;
  taxable: boolean;
  lineTotalCents: number;
}

interface QuoteFormData {
  clientId: string;
  lines: QuoteLine[];
  vatMode: VatMode;
  vatRateBps: number;
  validUntil: string;
  notes: string;
}

const createEmptyLine = (lineNo: number): QuoteLine => ({
  id: `temp-${Date.now()}-${lineNo}`,
  lineNo,
  stockItemId: "",
  itemSnapshot: {
    sku: "",
    name: "",
    unit: "",
  },
  qty: 1,
  unitPriceCents: 0,
  discountCents: 0,
  taxable: true,
  lineTotalCents: 0,
});

export default function NewQuotePage() {
  const router = useRouter();
  const { toast } = useToast();

  // API data
  const { data: clients } = useApi<Client[]>("/api/clients");
  const { data: stockItems } = useApi<StockItem[]>("/api/stock-items");

  // Form state
  const [formData, setFormData] = React.useState<QuoteFormData>({
    clientId: "",
    lines: [createEmptyLine(1)],
    vatMode: "exclusive",
    vatRateBps: 1500, // 15%
    validUntil: "",
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Calculate totals
  const totals = React.useMemo(() => {
    const lines = formData.lines.map((line) => ({
      qty: line.qty,
      unitPriceCents: line.unitPriceCents,
      discountCents: line.discountCents,
      taxable: line.taxable,
    }));
    return calculateDocumentTotals(lines, formData.vatRateBps, formData.vatMode);
  }, [formData.lines, formData.vatRateBps, formData.vatMode]);

  // Update line total when line data changes
  const updateLine = (lineId: string, updates: Partial<QuoteLine>) => {
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.id === lineId) {
          const updatedLine = { ...line, ...updates };
          // Recalculate line total
          updatedLine.lineTotalCents = calculateLineTotal(
            updatedLine.qty,
            updatedLine.unitPriceCents,
            updatedLine.discountCents
          );
          return updatedLine;
        }
        return line;
      }),
    }));
  };

  // Handle stock item selection
  const handleStockItemChange = (lineId: string, itemId: string) => {
    const item = stockItems?.find((i) => i._id === itemId);
    if (item) {
      updateLine(lineId, {
        stockItemId: itemId,
        itemSnapshot: {
          sku: item.sku,
          name: item.name,
          unit: item.unit,
        },
        unitPriceCents: item.sellingPriceCents || 0,
        taxable: !item.isVatExempt,
      });
    }
  };

  // Add new line
  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, createEmptyLine(prev.lines.length + 1)],
    }));
  };

  // Remove line
  const removeLine = (lineId: string) => {
    if (formData.lines.length === 1) {
      toast({
        title: "Cannot remove",
        description: "A quote must have at least one line item",
        variant: "destructive",
      });
      return;
    }
    setFormData((prev) => ({
      ...prev,
      lines: prev.lines
        .filter((line) => line.id !== lineId)
        .map((line, index) => ({ ...line, lineNo: index + 1 })),
    }));
  };

  // Handle form submission
  const handleSubmit = async (asDraft: boolean = true) => {
    // Validate
    if (!formData.clientId) {
      toast({
        title: "Validation Error",
        description: "Please select a client",
        variant: "destructive",
      });
      return;
    }

    if (formData.lines.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please add at least one line item",
        variant: "destructive",
      });
      return;
    }

    const validLines = formData.lines.filter(
      (line) => line.stockItemId && line.qty > 0
    );

    if (validLines.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in line items with valid stock and quantity",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        clientId: formData.clientId,
        lines: validLines.map((line) => ({
          lineNo: line.lineNo,
          stockItemId: line.stockItemId,
          skuSnapshot: line.itemSnapshot.sku,
          nameSnapshot: line.itemSnapshot.name,
          qty: line.qty,
          unitPriceCents: line.unitPriceCents,
          discountCents: line.discountCents,
          taxable: line.taxable,
          lineTotalCents: line.lineTotalCents,
        })),
        totals: {
          subTotalCents: totals.subTotalCents,
          vatTotalCents: totals.vatTotalCents,
          totalCents: totals.totalCents,
        },
        vatMode: formData.vatMode,
        vatRateBps: formData.vatRateBps,
        validUntil: formData.validUntil || null,
        notes: formData.notes,
        status: asDraft ? "draft" : "draft",
      };

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create quote");
      }

      toast({
        title: "Success",
        description: "Quote created successfully",
      });

      router.push("/quotes");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create quote",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    router.push("/quotes");
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/quotes">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">New Quote</h1>
              <p className="text-muted-foreground">Create a new sales quotation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save as Draft
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="space-y-6 lg:col-span-2">
            {/* Client Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Client</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={formData.clientId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, clientId: value }))
                  }
                >
                  <SelectTrigger>
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Line Items</CardTitle>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Line
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Item</TableHead>
                        <TableHead className="w-[80px]">Qty</TableHead>
                        <TableHead className="w-[120px]">Unit Price</TableHead>
                        <TableHead className="w-[120px]">Discount</TableHead>
                        <TableHead className="w-[80px]">Taxable</TableHead>
                        <TableHead className="w-[120px] text-right">Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <Select
                              value={line.stockItemId}
                              onValueChange={(value) =>
                                handleStockItemChange(line.id, value)
                              }
                            >
                              <SelectTrigger>
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
                            {line.itemSnapshot.name && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {line.itemSnapshot.sku} - {line.itemSnapshot.unit}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={line.qty}
                              onChange={(e) =>
                                updateLine(line.id, {
                                  qty: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={line.unitPriceCents / 100}
                              onChange={(e) =>
                                updateLine(line.id, {
                                  unitPriceCents:
                                    (parseFloat(e.target.value) || 0) * 100,
                                })
                              }
                              className="w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              value={line.discountCents / 100}
                              onChange={(e) =>
                                updateLine(line.id, {
                                  discountCents:
                                    (parseFloat(e.target.value) || 0) * 100,
                                })
                              }
                              className="w-28"
                            />
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              checked={line.taxable}
                              onCheckedChange={(checked) =>
                                updateLine(line.id, {
                                  taxable: checked as boolean,
                                })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(line.lineTotalCents)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLine(line.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Add any notes or terms for this quote..."
                  value={formData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* VAT Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Tax Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>VAT Mode</Label>
                  <Select
                    value={formData.vatMode}
                    onValueChange={(value: VatMode) =>
                      setFormData((prev) => ({ ...prev, vatMode: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exclusive">Exclusive</SelectItem>
                      <SelectItem value="inclusive">Inclusive</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>VAT Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.vatRateBps / 100}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        vatRateBps: (parseFloat(e.target.value) || 0) * 100,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Validity */}
            <Card>
              <CardHeader>
                <CardTitle>Validity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Valid Until</Label>
                  <Input
                    type="date"
                    value={formData.validUntil}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        validUntil: e.target.value,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* Totals */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(totals.subTotalCents)}
                  </span>
                </div>
                {formData.vatMode !== "none" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      VAT ({formData.vatRateBps / 100}%)
                    </span>
                    <span className="font-medium">
                      {formatCurrency(totals.vatTotalCents)}
                    </span>
                  </div>
                )}
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(totals.totalCents)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
