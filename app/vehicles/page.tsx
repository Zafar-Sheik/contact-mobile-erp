"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Truck,
  Calendar,
  Fuel,
  Loader2,
  MoreVertical,
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
  registration: string;
  make: string;
  model: string;
  year: number;
  fuelType: string;
  status: string;
  lastService?: string;
  vin?: string;
  engineNumber?: string;
  color?: string;
  notes?: string;
  isActive?: boolean;
  createdAt?: string;
}

interface VehicleFormData {
  registration: string;
  make: string;
  model: string;
  year: string;
  fuelType: string;
  vin: string;
  engineNumber: string;
  color: string;
  status: string;
  notes: string;
  isActive: boolean;
}

const initialFormData: VehicleFormData = {
  registration: "",
  make: "",
  model: "",
  year: new Date().getFullYear().toString(),
  fuelType: "Diesel",
  vin: "",
  engineNumber: "",
  color: "",
  status: "active",
  notes: "",
  isActive: true,
};

const fuelTypes = ["Diesel", "Petrol", "Electric", "Hybrid"];
const statusOptions = ["active", "maintenance", "inactive"];

export default function VehiclesPage() {
  const { toast } = useToast();
  const { data: vehicles, loading, error, refetch } = useApi<Vehicle[]>("/api/vehicles");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedVehicle, setSelectedVehicle] = React.useState<Vehicle | null>(null);
  const [formData, setFormData] = React.useState<VehicleFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const filteredVehicles = React.useMemo(() => {
    if (!vehicles) return [];
    return vehicles.filter(
      (vehicle) =>
        vehicle.registration.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vehicles, searchTerm]);

  const handleOpenDialog = (vehicle?: Vehicle) => {
    if (vehicle) {
      setSelectedVehicle(vehicle);
      setFormData({
        registration: vehicle.registration || "",
        make: vehicle.make || "",
        model: vehicle.model || "",
        year: String(vehicle.year || new Date().getFullYear()),
        fuelType: vehicle.fuelType || "Diesel",
        vin: vehicle.vin || "",
        engineNumber: vehicle.engineNumber || "",
        color: vehicle.color || "",
        status: vehicle.status || "active",
        notes: vehicle.notes || "",
        isActive: vehicle.isActive ?? true,
      });
    } else {
      setSelectedVehicle(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedVehicle(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const vehicleData = {
        registration: formData.registration,
        make: formData.make,
        model: formData.model,
        year: Number(formData.year),
        fuelType: formData.fuelType,
        vin: formData.vin || undefined,
        engineNumber: formData.engineNumber || undefined,
        color: formData.color || undefined,
        status: formData.status,
        notes: formData.notes || undefined,
        isActive: formData.isActive,
      };

      if (selectedVehicle) {
        await apiUpdate<Vehicle>("/api/vehicles", selectedVehicle._id, vehicleData);
        toast({ title: "Success", description: "Vehicle updated successfully" });
      } else {
        await apiCreate<Vehicle>("/api/vehicles", vehicleData);
        toast({ title: "Success", description: "Vehicle created successfully" });
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
    if (!selectedVehicle) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/vehicles", selectedVehicle._id);
      toast({ title: "Success", description: "Vehicle deleted successfully" });
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
    setSelectedVehicle(null);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
      active: "success",
      maintenance: "warning",
      inactive: "destructive",
    };
    const labels: Record<string, string> = {
      active: "Active",
      maintenance: "Maintenance",
      inactive: "Inactive",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const getStatusVariant = (status: string): "success" | "warning" | "destructive" | "secondary" => {
    const variants: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
      active: "success",
      maintenance: "warning",
      inactive: "destructive",
    };
    return variants[status] || "secondary";
  };

  // Mobile FAB handler
  const handleFabClick = () => {
    handleOpenDialog();
  };

  return (
    <MainLayout showTabBar={true} showFab={true}>
      {/* Page Header - Mobile */}
      <div className="md:hidden">
        <PageHeader
          title="Vehicles"
          subtitle="Manage your fleet vehicles"
          primaryAction={{
            label: "Add",
            onClick: () => handleOpenDialog(),
          }}
        />
        <div className="px-4 pb-4">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search vehicles..."
          />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block space-y-4 md:space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Vehicles
            </h1>
            <p className="text-muted-foreground">
              Manage your fleet vehicles
            </p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="w-full gap-2 md:w-auto"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            Add Vehicle
          </Button>
        </div>

        {/* Summary Cards */}
        {vehicles && vehicles.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {vehicles.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Active
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-green-600 md:text-2xl">
                  {vehicles.filter((v) => v.status === "active").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-yellow-600 md:text-2xl">
                  {vehicles.filter((v) => v.status === "maintenance").length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Diesel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {vehicles.filter((v) => v.fuelType === "Diesel").length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vehicles..."
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
            icon: <Truck className="h-10 w-10" />,
            title: searchTerm ? "No vehicles found" : "No vehicles yet",
            description: searchTerm
              ? "Try adjusting your search"
              : "Get started by adding your first vehicle",
            action: searchTerm
              ? undefined
              : {
                  label: "Add Vehicle",
                  onClick: () => handleOpenDialog(),
                },
          }}
        >
          {filteredVehicles.map((vehicle) => (
            <MobileListItem
              key={vehicle._id}
              title={vehicle.registration}
              subtitle={`${vehicle.make} ${vehicle.model}`}
              description={`${vehicle.year || "-"} • ${vehicle.fuelType || "-"}`}
              avatar={{
                icon: <Truck className="h-6 w-6 text-primary" />,
              }}
              status={{
                label: vehicle.status === "active" ? "Active" : vehicle.status === "maintenance" ? "Maintenance" : "Inactive",
                variant: getStatusVariant(vehicle.status),
              }}
              onClick={() => handleOpenDialog(vehicle)}
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
                <p className="text-destructive">Error loading vehicles</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error.message}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Desktop Empty State */}
      {!loading && !error && filteredVehicles.length === 0 && (
        <div className="hidden md:block">
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Truck className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No vehicles found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm
                    ? "Try adjusting your search"
                    : "Get started by adding your first vehicle"}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => handleOpenDialog()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Vehicle
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Desktop Vehicles Table */}
      {!loading && !error && filteredVehicles.length > 0 && (
        <div className="hidden md:block rounded-lg border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Registration</TableHead>
                  <TableHead className="w-[100px]">Make</TableHead>
                  <TableHead className="w-[100px]">Model</TableHead>
                  <TableHead className="w-[80px] whitespace-nowrap">Year</TableHead>
                  <TableHead className="w-[100px]">Fuel Type</TableHead>
                  <TableHead className="w-[100px] whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-right w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => (
                  <TableRow key={vehicle._id}>
                    <TableCell className="font-medium">
                      {vehicle.registration}
                    </TableCell>
                    <TableCell>{vehicle.make}</TableCell>
                    <TableCell>{vehicle.model}</TableCell>
                    <TableCell className="whitespace-nowrap">{vehicle.year || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Fuel className="h-3 w-3" />
                        {vehicle.fuelType}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(vehicle)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => {
                            setSelectedVehicle(vehicle);
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
        label="Add Vehicle"
      />

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedVehicle ? "Edit Vehicle" : "Add New Vehicle"}</DialogTitle>
            <DialogDescription>
              {selectedVehicle
                ? "Update the vehicle details below."
                : "Enter the details for the new vehicle."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registration">Registration *</Label>
                <Input
                  id="registration"
                  value={formData.registration}
                  onChange={(e) => setFormData({ ...formData, registration: e.target.value })}
                  placeholder="ABC 123 GP"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="make">Make *</Label>
                <Input
                  id="make"
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  placeholder="Toyota"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="Hilux"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="2024"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuelType">Fuel Type</Label>
                <Select
                  value={formData.fuelType}
                  onValueChange={(value) => setFormData({ ...formData, fuelType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vin">VIN</Label>
                <Input
                  id="vin"
                  value={formData.vin}
                  onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
                  placeholder="VIN number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="engineNumber">Engine Number</Label>
                <Input
                  id="engineNumber"
                  value={formData.engineNumber}
                  onChange={(e) => setFormData({ ...formData, engineNumber: e.target.value })}
                  placeholder="Engine number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                placeholder="White"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="font-normal">
                Active vehicle
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : selectedVehicle ? (
                "Update Vehicle"
              ) : (
                "Add Vehicle"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vehicle</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this vehicle? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCloseDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
