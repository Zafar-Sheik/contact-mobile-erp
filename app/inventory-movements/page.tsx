"use client";

import * as React from "react";
import {
  Search,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  FileText,
  RotateCcw,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { useApi } from "@/lib/hooks/use-api";

// Types
interface StockItem {
  _id: string;
  name: string;
  sku: string;
  unit: string;
}

interface InventoryMovement {
  _id: string;
  stockItemId: StockItem | string;
  locationId: string;
  locationName: string;
  sourceType: string;
  sourceId: string;
  movementType: "IN" | "OUT";
  quantity: number;
  unitCostCents: number;
  quantityBefore: number;
  quantityAfter: number;
  costBeforeCents: number;
  costAfterCents: number;
  createdAt: string;
}

const sourceTypeLabels: Record<string, string> = {
  GRV: "Goods Received",
  SALE: "Sale",
  ADJUSTMENT: "Adjustment",
  TRANSFER: "Transfer",
  RETURN: "Customer Return",
  CANCEL_GRV: "GRV Cancellation",
  CANCEL_SALE: "Sale Cancellation",
};

export default function InventoryMovementsPage() {
  const { toast } = useToast();
  const { data: movements, loading, error, refetch } = useApi<InventoryMovement[]>("/api/inventory-movements");
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState<string>("all");

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(cents / 100);
  };

  const filteredMovements = React.useMemo(() => {
    if (!movements) return [];
    return movements.filter((movement) => {
      // Filter by type
      if (filterType !== "all" && movement.movementType !== filterType) {
        return false;
      }
      // Filter by search term
      if (searchTerm) {
        const itemName = typeof movement.stockItemId === "object" 
          ? movement.stockItemId?.name?.toLowerCase() 
          : "";
        const itemSku = typeof movement.stockItemId === "object"
          ? movement.stockItemId?.sku?.toLowerCase()
          : "";
        return (
          itemName.includes(searchTerm.toLowerCase()) ||
          itemSku.includes(searchTerm.toLowerCase()) ||
          movement.sourceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
          movement.locationName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      return true;
    });
  }, [movements, searchTerm, filterType]);

  const totals = React.useMemo(() => {
    if (!movements) return { totalIn: 0, totalOut: 0, net: 0 };
    const totalIn = movements
      .filter(m => m.movementType === "IN")
      .reduce((sum, m) => sum + m.quantity, 0);
    const totalOut = movements
      .filter(m => m.movementType === "OUT")
      .reduce((sum, m) => sum + m.quantity, 0);
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [movements]);

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "IN":
        return <ArrowUpRight className="h-4 w-4 text-green-600" />;
      case "OUT":
        return <ArrowDownRight className="h-4 w-4 text-red-600" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "GRV":
        return <FileText className="h-3 w-3" />;
      case "CANCEL_GRV":
        return <RotateCcw className="h-3 w-3" />;
      default:
        return <Package className="h-3 w-3" />;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Inventory Movements
            </h1>
            <p className="text-muted-foreground">
              View all stock movements and transactions
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="w-full gap-2 md:w-auto"
          >
            <Package className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        {movements && movements.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Movements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">{movements.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Stock In
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600 md:text-2xl">
                  +{totals.totalIn}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Stock Out
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-red-600 md:text-2xl">
                  -{totals.totalOut}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Net Change
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold md:text-2xl ${totals.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totals.net >= 0 ? '+' : ''}{totals.net}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by item, source, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("all")}
            >
              All
            </Button>
            <Button
              variant={filterType === "IN" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("IN")}
              className="text-green-600"
            >
              In
            </Button>
            <Button
              variant={filterType === "OUT" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType("OUT")}
              className="text-red-600"
            >
              Out
            </Button>
          </div>
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
                <p className="text-destructive">Error loading movements</p>
                <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && filteredMovements.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No movements found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm || filterType !== "all"
                    ? "Try adjusting your filters"
                    : "Inventory movements will appear here when GRVs are posted"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Movements List - Mobile Card Layout */}
        {!loading && !error && filteredMovements.length > 0 && (
          <div className="space-y-3 md:hidden">
            {filteredMovements.map((movement) => (
              <Card key={movement._id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        movement.movementType === "IN" ? "bg-green-100" : "bg-red-100"
                      }`}>
                        {getMovementIcon(movement.movementType)}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {typeof movement.stockItemId === "object" 
                            ? movement.stockItemId?.name 
                            : "Unknown Item"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          SKU: {typeof movement.stockItemId === "object" 
                            ? movement.stockItemId?.sku 
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={movement.movementType === "IN" ? "success" : "destructive"}>
                      {movement.movementType}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Quantity</p>
                      <p className="font-medium">
                        {movement.quantityBefore} → {movement.quantityAfter}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Change</p>
                      <p className={`font-medium ${movement.movementType === "IN" ? "text-green-600" : "text-red-600"}`}>
                        {movement.movementType === "IN" ? "+" : "-"}{movement.quantity}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Source</p>
                      <div className="flex items-center gap-1">
                        {getSourceIcon(movement.sourceType)}
                        <span>{sourceTypeLabels[movement.sourceType] || movement.sourceType}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Location</p>
                      <p className="font-medium">{movement.locationName}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    {new Date(movement.createdAt).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Movements Table - Desktop */}
        {!loading && !error && filteredMovements.length > 0 && (
          <div className="hidden md:block rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty Before</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">Qty After</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((movement) => (
                    <TableRow key={movement._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getMovementIcon(movement.movementType)}
                          <Badge variant={movement.movementType === "IN" ? "success" : "destructive"}>
                            {movement.movementType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {typeof movement.stockItemId === "object" 
                              ? movement.stockItemId?.name 
                              : "Unknown Item"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {typeof movement.stockItemId === "object" 
                              ? movement.stockItemId?.sku 
                              : "N/A"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{movement.quantityBefore}</TableCell>
                      <TableCell className={`text-right font-medium ${
                        movement.movementType === "IN" ? "text-green-600" : "text-red-600"
                      }`}>
                        {movement.movementType === "IN" ? "+" : "-"}{movement.quantity}
                      </TableCell>
                      <TableCell className="text-right">{movement.quantityAfter}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getSourceIcon(movement.sourceType)}
                          <span>{sourceTypeLabels[movement.sourceType] || movement.sourceType}</span>
                        </div>
                      </TableCell>
                      <TableCell>{movement.locationName}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(movement.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
