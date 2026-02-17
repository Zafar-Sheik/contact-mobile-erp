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
  Send,
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

interface Quote {
  _id: string;
  quoteNumber: string;
  clientId: string | Client;
  clientSnapshot: {
    name: string;
  };
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  lines: any[];
  totals: {
    subTotalCents: number;
    vatTotalCents: number;
    totalCents: number;
  };
}

interface InvoiceLine {
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

interface InvoiceFormData {
  clientId: string;
  sourceQuoteId: string;
  lines: InvoiceLine[];
  vatMode: VatMode;
  vatRateBps: number;
  issueDate: string;
  dueDate: string;
  notes: string;
  issueImmediately: boolean;
}

const createEmptyLine = (lineNo: number): InvoiceLine => ({
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

export default function NewInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();

  // API data
  const { data: clients } = useApi<Client[]>("/api/clients");
  const { data: stockItems } = useApi<StockItem[]>("/api/stock-items");
  const { data: quotes, refetch: refetchQuotes } = useApi<Quote[]>("/api/quotes?status=accepted");

  // Form state
  const [formData, setFormData] = React.useState<InvoiceFormData>({
    clientId: "",
    sourceQuoteId: "",
    lines: [createEmptyLine(1)],
    vatMode: "exclusive",
    vatRateBps: 1500, // 15%
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: "",
    issueImmediately: false,
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
  const updateLine = (lineId: string, updates: Partial<InvoiceLine>) => {
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

  // Handle quote selection - prefill client and lines
  const handleQuoteChange = (quoteId: string) => {
    const quote = quotes?.find((q) => q._id === quoteId);
    if (quote) {
      // Set client from quote
      const clientId = typeof quote.clientId === "object" 
        ? (quote.clientId as Client)._id 
        : quote.clientId;

      // Convert quote lines to invoice lines
      const invoiceLines = quote.lines.map((line: any, index: number): InvoiceLine => ({
        id: `temp-${Date.now()}-${index}`,
        lineNo: line.lineNo,
        stockItemId: line.stockItemId || "",
        itemSnapshot: {
          sku: line.skuSnapshot || "",
          name: line.nameSnapshot || "",
          unit: "",
        },
        qty: line.qty,
        unitPriceCents: line.unitPriceCents,
        discountCents: line.discountCents,
        taxable: line.taxable,
        lineTotalCents: line.lineTotalCents,
      }));

      setFormData((prev) => ({
        ...prev,
        clientId: clientId,
        sourceQuoteId: quoteId,
        lines: invoiceLines.length > 0 ? invoiceLines : [createEmptyLine(1)],
      }));
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
        description: "An invoice must have at least one line item",
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
        sourceQuoteId: formData.sourceQuoteId || null,
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
        issueDate: formData.issueDate,
        dueDate: formData.dueDate,
        notes: formData.notes,
      };

      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create invoice");
      }

      toast({
        title: "Success",
        description: "Invoice created successfully",
      });

      // If issue immediately is checked, issue the invoice
      if (formData.issueImmediately && result.data?._id) {
        try {
          await fetch(`/api/invoices/${result.data._id}/issue`, {
            method: "POST",
          });
          toast({
            title: "Invoice Issued",
            description: "The invoice has been issued",
          });
        } catch (issueErr) {
          console.error("Failed to issue invoice:", issueErr);
          // Still redirect to list - the invoice was created
        }
      }

      router.push("/invoices");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create invoice",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    router.push("/invoices");
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/invoices">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">New Invoice</h1>
              <p className="text-muted-foreground">Create a new sales invoice</p>
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
              variant="outline"
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
            <Button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Save & Issue
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="space-y-6 lg:col-span-2">
            {/* Client & Quote Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Client & Source</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Client</Label>
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
                  </div>
                  <div className="space-y-2">
                    <Label>Create from Quote (Optional)</Label>
                    <Select
                      value={formData.sourceQuoteId}
                      onValueChange={handleQuoteChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an accepted quote" />
                      </SelectTrigger>
                      <SelectContent>
                        {quotes?.map((quote) => (
                          <SelectItem key={quote._id} value={quote._id}>
                            {quote.quoteNumber} - {quote.clientSnapshot?.name || "Unknown"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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

            {/* Dates */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Issue Date</Label>
                    <Input
                      type="date"
                      value={formData.issueDate}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, issueDate: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                      }
                    />
                  </div>
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
                  placeholder="Add any notes or terms for this invoice..."
                  value={formData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Totals */}
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
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, vatMode: value as VatMode }))
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
                    step="0.5"
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

            {/* Totals */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(totals.subTotalCents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    VAT ({formData.vatRateBps / 100}%)
                  </span>
                  <span>{formatCurrency(totals.vatTotalCents)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(totals.totalCents)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <CardTitle>Options</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="issueImmediately"
                    checked={formData.issueImmediately}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        issueImmediately: checked as boolean,
                      }))
                    }
                  />
                  <label
                    htmlFor="issueImmediately"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Issue immediately
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
