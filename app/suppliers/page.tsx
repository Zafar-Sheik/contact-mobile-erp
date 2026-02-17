"use client";

import * as React from "react";
import {
  Plus,
  Edit,
  Trash2,
  Building2,
  Mail,
  Phone,
  Loader2,
} from "lucide-react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
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

// Mobile components
import { PageHeader } from "@/components/mobile/page-header";
import { SearchBar } from "@/components/mobile/search-bar";
import { MobileList, MobileListItemWrapper } from "@/components/mobile/mobile-list";
import { MobileListItem } from "@/components/mobile/mobile-list-item";
import { EmptyState } from "@/components/mobile/empty-state";
import { Fab } from "@/components/mobile/fab";

// Supplier type based on model
interface Supplier {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  contactPerson?: string;
  billing?: {
    address?: {
      line1?: string;
      city?: string;
      provinceState?: string;
      country?: string;
      postalCode?: string;
    };
    vatNumber?: string;
    isVatRegistered?: boolean;
  };
  notes?: string;
  isActive?: boolean;
  createdAt?: string;
}

interface SupplierFormData {
  name: string;
  email: string;
  phone: string;
  contactPerson: string;
  addressLine1: string;
  city: string;
  vatNumber: string;
  notes: string;
  isActive: boolean;
}

const initialFormData: SupplierFormData = {
  name: "",
  email: "",
  phone: "",
  contactPerson: "",
  addressLine1: "",
  city: "",
  vatNumber: "",
  notes: "",
  isActive: true,
};

export default function SuppliersPage() {
  const { toast } = useToast();
  const { data: suppliers, loading, error, refetch } = useApi<Supplier[]>("/api/suppliers");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedSupplier, setSelectedSupplier] = React.useState<Supplier | null>(null);
  const [formData, setFormData] = React.useState<SupplierFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const filteredSuppliers = React.useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        supplier.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [suppliers, searchTerm]);

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setSelectedSupplier(supplier);
      setFormData({
        name: supplier.name || "",
        email: supplier.email || "",
        phone: supplier.phone || "",
        contactPerson: supplier.contactPerson || "",
        addressLine1: supplier.billing?.address?.line1 || "",
        city: supplier.billing?.address?.city || "",
        vatNumber: supplier.billing?.vatNumber || "",
        notes: supplier.notes || "",
        isActive: supplier.isActive ?? true,
      });
    } else {
      setSelectedSupplier(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedSupplier(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const supplierData = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        contactPerson: formData.contactPerson || undefined,
        billing: {
          address: {
            line1: formData.addressLine1 || undefined,
            city: formData.city || undefined,
            country: "South Africa",
          },
          vatNumber: formData.vatNumber || undefined,
          isVatRegistered: !!formData.vatNumber,
        },
        notes: formData.notes || "",
        isActive: formData.isActive,
      };

      if (selectedSupplier) {
        await apiUpdate<Supplier>("/api/suppliers", selectedSupplier._id, supplierData);
        toast({ title: "Success", description: "Supplier updated successfully" });
      } else {
        await apiCreate<Supplier>("/api/suppliers", supplierData);
        toast({ title: "Success", description: "Supplier created successfully" });
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
    if (!selectedSupplier) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/suppliers", selectedSupplier._id);
      toast({ title: "Success", description: "Supplier deleted successfully" });
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
    setSelectedSupplier(null);
  };

  // Get status badge variant
  const getStatusVariant = (isActive: boolean): "success" | "secondary" => {
    return isActive ? "success" : "secondary";
  };

  return (
    <MainLayout showTabBar={true} showFab={false}>
      <div className="space-y-4 md:space-y-6">
        {/* Page Header - Mobile */}
        <div className="md:hidden">
          <PageHeader
            title="Suppliers"
            subtitle="Manage your supplier relationships"
            primaryAction={{
              label: "Add Supplier",
              onClick: () => handleOpenDialog(),
              icon: <Plus className="h-4 w-4" />,
            }}
          />
          <div className="px-4">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search suppliers..."
            />
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Suppliers
            </h1>
            <p className="text-muted-foreground">
              Manage your supplier relationships
            </p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="w-full gap-2 md:w-auto"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            Add Supplier
          </Button>
        </div>

        {/* Desktop Search */}
        <div className="hidden md:block relative">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search suppliers..."
          />
        </div>

        {/* Summary Cards - Mobile responsive grid */}
        {suppliers && suppliers.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {suppliers.length}
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
                  {suppliers.filter((s) => s.isActive).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Inactive
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-muted-foreground md:text-2xl">
                  {suppliers.filter((s) => !s.isActive).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  With Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {suppliers.filter((s) => s.email).length}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
                <p className="text-destructive">Error loading suppliers</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error.message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State - Mobile */}
        {!loading && !error && filteredSuppliers.length === 0 && searchTerm && (
          <div className="md:hidden px-4">
            <EmptyState
              iconType="search"
              title={`No results for "${searchTerm}"`}
              description="Try searching with different keywords or check your spelling."
              action={{
                label: "Clear search",
                onClick: () => setSearchTerm(""),
              }}
            />
          </div>
        )}

        {/* Empty State - Desktop */}
        {!loading && !error && filteredSuppliers.length === 0 && !searchTerm && (
          <div className="hidden md:block">
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No suppliers found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Get started by adding your first supplier
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => handleOpenDialog()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Supplier
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mobile List - Uses MobileList and MobileListItem */}
        {!loading && !error && filteredSuppliers.length > 0 && (
          <div className="md:hidden px-4">
            <MobileList
              loading={loading}
              emptyState={{
                icon: <Building2 className="h-10 w-10" />,
                title: "No suppliers found",
                description: searchTerm 
                  ? "Try adjusting your search" 
                  : "Get started by adding your first supplier",
                action: searchTerm 
                  ? { label: "Clear search", onClick: () => setSearchTerm("") }
                  : { label: "Add Supplier", onClick: () => handleOpenDialog() },
              }}
            >
              {filteredSuppliers.map((supplier) => (
                <MobileListItemWrapper
                  key={supplier._id}
                  onClick={() => handleOpenDialog(supplier)}
                >
                  <MobileListItem
                    title={supplier.name}
                    subtitle={supplier.contactPerson}
                    description={supplier.email}
                    avatar={{
                      icon: <Building2 className="h-5 w-5 text-primary" />,
                      fallback: supplier.name.substring(0, 2).toUpperCase(),
                    }}
                    status={{
                      label: supplier.isActive ? "Active" : "Inactive",
                      variant: supplier.isActive ? "success" : "secondary",
                    }}
                    showChevron={false}
                    rightContent={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 touch-target"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="sr-only">Open menu</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="5" r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleOpenDialog(supplier)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSupplier(supplier);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  />
                </MobileListItemWrapper>
              ))}
            </MobileList>
          </div>
        )}

        {/* Suppliers Table - Desktop */}
        {!loading && !error && filteredSuppliers.length > 0 && (
          <div className="hidden md:block rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier._id}>
                      <TableCell className="font-medium">{supplier.name}</TableCell>
                      <TableCell>{supplier.contactPerson || "-"}</TableCell>
                      <TableCell>
                        {supplier.email ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3 w-3" />
                            {supplier.email}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {supplier.phone ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3" />
                            {supplier.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{supplier.billing?.address?.city || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={supplier.isActive ? "default" : "secondary"}
                        >
                          {supplier.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(supplier)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              setSelectedSupplier(supplier);
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
      </div>

      {/* FAB - Mobile only */}
      <Fab
        visible={true}
        onClick={() => handleOpenDialog()}
        label="Add Supplier"
      />

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedSupplier ? "Edit Supplier" : "Add Supplier"}
            </DialogTitle>
            <DialogDescription>
              {selectedSupplier
                ? "Update supplier information below"
                : "Enter information to create a new supplier"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-10 px-3 border rounded-md"
                  placeholder="Supplier name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <input
                  id="contactPerson"
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  className="w-full h-10 px-3 border rounded-md"
                  placeholder="Contact person name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full h-10 px-3 border rounded-md"
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full h-10 px-3 border rounded-md"
                    placeholder="Phone number"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address</Label>
                <input
                  id="addressLine1"
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="w-full h-10 px-3 border rounded-md"
                  placeholder="Street address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full h-10 px-3 border rounded-md"
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vatNumber">VAT Number</Label>
                  <input
                    id="vatNumber"
                    type="text"
                    value={formData.vatNumber}
                    onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                    className="w-full h-10 px-3 border rounded-md"
                    placeholder="VAT number"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full h-20 px-3 py-2 border rounded-md resize-none"
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-5 w-5 rounded border-gray-300"
                />
                <Label htmlFor="isActive">Active supplier</Label>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedSupplier ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this supplier.
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
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
