"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Fuel,
  Calendar,
  DollarSign,
  Loader2,
  MoreVertical,
  MapPin,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mobile components
import { PageHeader } from "@/components/mobile/page-header";
import { SearchBar } from "@/components/mobile/search-bar";
import { EmptyState } from "@/components/mobile/empty-state";
import { MobileList } from "@/components/mobile/mobile-list";
import { MobileListItem } from "@/components/mobile/mobile-list-item";
import { Fab } from "@/components/mobile/fab";

// Vehicle type based on model
interface Vehicle {
  _id: string;
  name: string;
  registration: string;
}

// FuelLog type based on model
interface FuelLog {
  _id: string;
  vehicleId: string;
  vehicleRegistration?: string;
  date: string;
  fuelType: string;
  liters: number;
  costPerLiter: number;
  totalCost: number;
  odometer: number;
  station: string;
  receiptNumber?: string;
  notes?: string;
  isActive?: boolean;
  createdAt?: string;
}

interface FuelLogFormData {
  vehicleId: string;
  date: string;
  fuelType: string;
  liters: string;
  costPerLiter: string;
  odometer: string;
  station: string;
  receiptNumber: string;
  notes: string;
  isActive: boolean;
}

const initialFormData: FuelLogFormData = {
  vehicleId: "",
  date: new Date().toISOString().split("T")[0],
  fuelType: "Diesel",
  liters: "0",
  costPerLiter: "0",
  odometer: "0",
  station: "",
  receiptNumber: "",
  notes: "",
  isActive: true,
};

const fuelTypes = ["Diesel", "Petrol", "Electric", "Hybrid"];

export default function FuelLogsPage() {
  const { toast } = useToast();
  const { data: fuelLogs, loading, error, refetch } = useApi<FuelLog[]>("/api/fuel-logs");
  const { data: vehicles } = useApi<Vehicle[]>("/api/vehicles");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedLog, setSelectedLog] = React.useState<FuelLog | null>(null);
  const [formData, setFormData] = React.useState<FuelLogFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const filteredLogs = React.useMemo(() => {
    if (!fuelLogs) return [];
    return fuelLogs.filter(
      (log) =>
        log.vehicleRegistration?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.fuelType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.station.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [fuelLogs, searchTerm]);

  const totalLiters = React.useMemo(() => {
    return fuelLogs?.reduce((sum, log) => sum + log.liters, 0) || 0;
  }, [fuelLogs]);

  const totalCost = React.useMemo(() => {
    return fuelLogs?.reduce((sum, log) => sum + log.totalCost, 0) || 0;
  }, [fuelLogs]);

  const avgCostPerLiter = React.useMemo(() => {
    if (!fuelLogs || fuelLogs.length === 0) return 0;
    return totalCost / totalLiters;
  }, [fuelLogs, totalCost, totalLiters]);

  const handleOpenDialog = (log?: FuelLog) => {
    if (log) {
      setSelectedLog(log);
      setFormData({
        vehicleId: log.vehicleId || "",
        date: log.date ? new Date(log.date).toISOString().split("T")[0] : "",
        fuelType: log.fuelType || "Diesel",
        liters: String(log.liters || 0),
        costPerLiter: String(log.costPerLiter || 0),
        odometer: String(log.odometer || 0),
        station: log.station || "",
        receiptNumber: log.receiptNumber || "",
        notes: log.notes || "",
        isActive: log.isActive ?? true,
      });
    } else {
      setSelectedLog(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedLog(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.vehicleId) {
      toast({ title: "Error", description: "Please select a vehicle", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const logData = {
        vehicleId: formData.vehicleId,
        date: formData.date,
        fuelType: formData.fuelType,
        liters: Number(formData.liters),
        costPerLiter: Number(formData.costPerLiter),
        totalCost: Number(formData.liters) * Number(formData.costPerLiter),
        odometer: Number(formData.odometer),
        station: formData.station,
        receiptNumber: formData.receiptNumber || undefined,
        notes: formData.notes || undefined,
        isActive: formData.isActive,
      };

      if (selectedLog) {
        await apiUpdate<FuelLog>("/api/fuel-logs", selectedLog._id, logData);
        toast({ title: "Success", description: "Fuel log updated successfully" });
      } else {
        await apiCreate<FuelLog>("/api/fuel-logs", logData);
        toast({ title: "Success", description: "Fuel log created successfully" });
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
    if (!selectedLog) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/fuel-logs", selectedLog._id);
      toast({ title: "Success", description: "Fuel log deleted successfully" });
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
    setSelectedLog(null);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(cents / 100);
  };

  // Mobile FAB handler
  const handleFabClick = () => {
    handleOpenDialog();
  };

  return (
    <MainLayout showTabBar={true} showFab={false}>
      {/* Page Header - Mobile */}
      <div className="md:hidden">
        <PageHeader
          title="Fuel Logs"
          subtitle="Track vehicle fuel consumption"
          primaryAction={{
            label: "Add",
            onClick: () => handleOpenDialog(),
          }}
        />
        <div className="px-4 pb-4">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search fuel logs..."
          />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block space-y-4 md:space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Fuel Logs
            </h1>
            <p className="text-muted-foreground">
              Track vehicle fuel consumption
            </p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="w-full gap-2 md:w-auto"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            Add Fuel Log
          </Button>
        </div>

        {/* Summary Cards */}
        {fuelLogs && fuelLogs.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Logs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {fuelLogs.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Liters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {totalLiters.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Cost
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {formatCurrency(totalCost * 100)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Avg Cost/L
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {formatCurrency(avgCostPerLiter * 100)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search fuel logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 text-lg md:h-10 md:text-sm"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="hidden md:flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Mobile List View */}
      <div className="md:hidden px-4">
        <MobileList
          loading={loading}
          skeletonCount={5}
          emptyState={{
            icon: <Fuel className="h-10 w-10" />,
            title: searchTerm ? "No fuel logs found" : "No fuel logs yet",
            description: searchTerm
              ? "Try adjusting your search"
              : "Get started by adding your first fuel log",
            action: searchTerm
              ? undefined
              : {
                  label: "Add Fuel Log",
                  onClick: () => handleOpenDialog(),
                },
          }}
        >
          {filteredLogs.map((log) => (
            <MobileListItem
              key={log._id}
              title={log.vehicleRegistration || "Unknown Vehicle"}
              subtitle={new Date(log.date).toLocaleDateString()}
              description={`${log.liters}L ${log.fuelType} • ${formatCurrency(log.totalCost * 100)}`}
              avatar={{
                icon: <Fuel className="h-6 w-6 text-primary" />,
              }}
              status={{
                label: log.station || "-",
                variant: "secondary",
              }}
              onClick={() => handleOpenDialog(log)}
            />
          ))}
        </MobileList>
      </div>

      {/* Desktop Error State */}
      {error && (
        <div className="hidden md:block">
          <Card className="border-destructive">
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-destructive">Error loading fuel logs</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error.message}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Desktop Empty State */}
      {!loading && !error && filteredLogs.length === 0 && (
        <div className="hidden md:block">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Fuel className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No fuel logs found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm
                    ? "Try adjusting your search"
                    : "Get started by adding your first fuel log"}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => handleOpenDialog()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Fuel Log
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Desktop Fuel Logs Table */}
      {!loading && !error && filteredLogs.length > 0 && (
        <div className="hidden md:block rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Fuel Type</TableHead>
                  <TableHead className="text-right">Liters</TableHead>
                  <TableHead className="text-right">Cost/L</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Odometer</TableHead>
                  <TableHead>Station</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log._id}>
                    <TableCell>
                      {new Date(log.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.vehicleRegistration || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.fuelType}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{log.liters}L</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(log.costPerLiter * 100)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(log.totalCost * 100)}
                    </TableCell>
                    <TableCell>{log.odometer?.toLocaleString()} km</TableCell>
                    <TableCell>{log.station}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(log)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            setSelectedLog(log);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <Fab
        visible={true}
        onClick={handleFabClick}
        label="Add Fuel Log"
      />

      {/* Add/Edit Fuel Log Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedLog ? "Edit Fuel Log" : "Add New Fuel Log"}
            </DialogTitle>
            <DialogDescription>
              {selectedLog
                ? "Update fuel log information below"
                : "Enter fuel log information to track consumption"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicle">Vehicle *</Label>
                  <Select
                    value={formData.vehicleId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, vehicleId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles?.map((vehicle) => (
                        <SelectItem key={vehicle._id} value={vehicle._id}>
                          {vehicle.registration || vehicle.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fuelType">Fuel Type</Label>
                <Select
                  value={formData.fuelType}
                  onValueChange={(value) =>
                    setFormData({ ...formData, fuelType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fuel type" />
                  </SelectTrigger>
                  <SelectContent>
                    {fuelTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="liters">Liters</Label>
                  <Input
                    id="liters"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={formData.liters}
                    onChange={(e) =>
                      setFormData({ ...formData, liters: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costPerLiter">Cost Per Liter (ZAR)</Label>
                  <Input
                    id="costPerLiter"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*\.?[0-9]*"
                    value={formData.costPerLiter}
                    onChange={(e) =>
                      setFormData({ ...formData, costPerLiter: e.target.value })
                    }
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="odometer">Odometer (km)</Label>
                  <Input
                    id="odometer"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formData.odometer}
                    onChange={(e) =>
                      setFormData({ ...formData, odometer: e.target.value })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="station">Station</Label>
                  <Input
                    id="station"
                    value={formData.station}
                    onChange={(e) =>
                      setFormData({ ...formData, station: e.target.value })
                    }
                    placeholder="Shell, BP, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiptNumber">Receipt Number</Label>
                <Input
                  id="receiptNumber"
                  value={formData.receiptNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, receiptNumber: e.target.value })
                  }
                  placeholder="Receipt number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="h-5 w-5 rounded border-gray-300"
                />
                <Label htmlFor="isActive">Active log</Label>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedLog ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              fuel log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCloseDialog}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
