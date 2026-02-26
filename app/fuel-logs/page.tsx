"use client";

import * as React from "react";
import {
  Search,
  Edit,
  Trash2,
  Fuel,
  MoreHorizontal,
  Gauge,
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
interface Vehicle {
  _id: string;
  registration: string;
}

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
  receiptNumber: string;
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
}

const initialFormData: FuelLogFormData = {
  vehicleId: "",
  date: new Date().toISOString().split("T")[0],
  fuelType: "Diesel",
  liters: "",
  costPerLiter: "",
  odometer: "",
  station: "",
  receiptNumber: "",
};

const fuelTypes = ["Diesel", "Petrol", "Electric", "Hybrid"];

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

export default function FuelLogsPage() {
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API hooks
  const { data: fuelLogs, loading, error, refetch } = useApi<FuelLog[]>("/api/fuel-logs");
  const { data: vehicles } = useApi<Vehicle[]>("/api/vehicles");

  // State
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedLog, setSelectedLog] = React.useState<FuelLog | null>(null);
  const [formData, setFormData] = React.useState<FuelLogFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filter logs
  const filteredLogs = React.useMemo(() => {
    if (!fuelLogs) return [];
    return fuelLogs.filter(
      (log) =>
        !searchTerm ||
        (log.vehicleRegistration && log.vehicleRegistration.toLowerCase().includes(searchTerm.toLowerCase())) ||
        log.fuelType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.station.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [fuelLogs, searchTerm]);

  // Stats
  const totals = React.useMemo(() => {
    if (!fuelLogs) return { liters: 0, cost: 0 };
    return {
      liters: fuelLogs.reduce((sum, log) => sum + log.liters, 0),
      cost: fuelLogs.reduce((sum, log) => sum + log.totalCost, 0),
    };
  }, [fuelLogs]);

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
    if (!formData.vehicleId) {
      toast({ title: "Error", description: "Please select a vehicle", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const liters = Number(formData.liters);
      const costPerLiter = Number(formData.costPerLiter);

      const logData = {
        vehicleId: formData.vehicleId,
        date: formData.date,
        fuelType: formData.fuelType,
        liters: liters,
        costPerLiter: costPerLiter,
        totalCost: Math.round(liters * costPerLiter * 100),
        odometer: formData.odometer ? Number(formData.odometer) : undefined,
        station: formData.station || undefined,
        receiptNumber: formData.receiptNumber || undefined,
      };

      if (selectedLog) {
        await apiUpdate<FuelLog, typeof logData>("/api/fuel-logs", selectedLog._id, logData);
        toast({ title: "Success", description: "Fuel log updated successfully" });
      } else {
        await apiCreate<FuelLog, typeof logData>("/api/fuel-logs", logData);
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
      setIsDeleteDialogOpen(false);
      setSelectedLog(null);
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
          <h1 className="text-xl font-bold text-gray-900">Fuel Logs</h1>
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
            placeholder="Search fuel logs..."
            className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && !error && fuelLogs && fuelLogs.length > 0 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-600 font-medium">Total Liters</p>
              <p className="text-lg font-bold text-amber-700">{totals.liters.toFixed(1)}L</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Total Cost</p>
              <p className="text-lg font-bold text-blue-700">{formatCurrency(totals.cost)}</p>
            </div>
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
            <p className="text-red-600 font-medium">Error loading fuel logs</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <Gauge className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No fuel logs found" : "No fuel logs yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? "Try a different search term" : "Track your fuel expenses by adding a fuel log"}
            </p>
          </div>
        )}

        {/* Fuel Logs List */}
        {!loading && !error && filteredLogs.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredLogs.map((log) => (
              <div
                key={log._id}
                onClick={() => handleOpenDialog(log)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-100 p-2 rounded-full">
                      <Fuel className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {log.vehicleRegistration || "Unknown Vehicle"}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {log.fuelType} • {formatDate(log.date)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-2 shrink-0">
                    {log.liters}L
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{log.station || "No station"}</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(log.totalCost)}
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
                      handleOpenDialog(log);
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
                      setSelectedLog(log);
                      setIsDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
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
              {selectedLog ? "Edit Fuel Log" : "Add Fuel Log"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle *</Label>
              <Select
                value={formData.vehicleId}
                onValueChange={(value) => setFormData({ ...formData, vehicleId: value })}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles?.map((vehicle) => (
                    <SelectItem key={vehicle._id} value={vehicle._id}>
                      {vehicle.registration}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuelType">Fuel Type</Label>
                <Select
                  value={formData.fuelType}
                  onValueChange={(value) => setFormData({ ...formData, fuelType: value })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select fuel type" />
                  </SelectTrigger>
                  <SelectContent>
                    {fuelTypes.map((fuel) => (
                      <SelectItem key={fuel} value={fuel}>
                        {fuel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="liters">Liters</Label>
                <Input
                  id="liters"
                  type="number"
                  step="0.01"
                  value={formData.liters}
                  onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                  placeholder="0.00"
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPerLiter">Cost/Liter (ZAR)</Label>
                <Input
                  id="costPerLiter"
                  type="number"
                  step="0.01"
                  value={formData.costPerLiter}
                  onChange={(e) => setFormData({ ...formData, costPerLiter: e.target.value })}
                  placeholder="0.00"
                  className="h-12"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="odometer">Odometer</Label>
                <Input
                  id="odometer"
                  type="number"
                  value={formData.odometer}
                  onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
                  placeholder="0"
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="station">Station</Label>
                <Input
                  id="station"
                  value={formData.station}
                  onChange={(e) => setFormData({ ...formData, station: e.target.value })}
                  placeholder="Shell"
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="receiptNumber">Receipt Number</Label>
              <Input
                id="receiptNumber"
                value={formData.receiptNumber}
                onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                placeholder="Receipt #"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCloseDialog} className="flex-1 h-12">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.vehicleId}
              className="flex-1 h-12"
            >
              {isSubmitting ? "Saving..." : selectedLog ? "Update" : "Add Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fuel Log</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this fuel log? This action cannot be undone.
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
