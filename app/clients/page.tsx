"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  Mail,
  Phone,
  MapPin,
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
import { PageHeader, SearchBar, MobileList, MobileListItem, EmptyState } from "@/components/mobile";

// Client type definition based on the model
interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
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
  credit?: {
    creditLimitCents?: number;
    paymentTermsDays?: number;
  };
  notes?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ClientFormData {
  name: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  vatNumber: string;
  creditLimit: string;
  paymentTerms: string;
  notes: string;
  isActive: boolean;
}

const initialFormData: ClientFormData = {
  name: "",
  email: "",
  phone: "",
  addressLine1: "",
  city: "",
  vatNumber: "",
  creditLimit: "0",
  paymentTerms: "0",
  notes: "",
  isActive: true,
};

export default function ClientsPage() {
  const { toast } = useToast();
  const { data: clients, loading, error, refetch } = useApi<Client[]>("/api/clients");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [formData, setFormData] = React.useState<ClientFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const filteredClients = React.useMemo(() => {
    if (!clients) return [];
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setSelectedClient(client);
      setFormData({
        name: client.name || "",
        email: client.email || "",
        phone: client.phone || "",
        addressLine1: client.billing?.address?.line1 || "",
        city: client.billing?.address?.city || "",
        vatNumber: client.billing?.vatNumber || "",
        creditLimit: String(client.credit?.creditLimitCents || 0),
        paymentTerms: String(client.credit?.paymentTermsDays || 0),
        notes: client.notes || "",
        isActive: client.isActive ?? true,
      });
    } else {
      setSelectedClient(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedClient(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const clientData = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        billing: {
          address: {
            line1: formData.addressLine1 || undefined,
            city: formData.city || undefined,
            country: "South Africa",
          },
          vatNumber: formData.vatNumber || undefined,
          isVatRegistered: !!formData.vatNumber,
        },
        credit: {
          creditLimitCents: Number(formData.creditLimit) || 0,
          paymentTermsDays: Number(formData.paymentTerms) || 0,
        },
        notes: formData.notes || "",
        isActive: formData.isActive,
      };

      if (selectedClient) {
        await apiUpdate<Client>("/api/clients", selectedClient._id, clientData);
        toast({ title: "Success", description: "Client updated successfully" });
      } else {
        await apiCreate<Client>("/api/clients", clientData);
        toast({ title: "Success", description: "Client created successfully" });
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
    if (!selectedClient) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/clients", selectedClient._id);
      toast({ title: "Success", description: "Client deleted successfully" });
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
    setSelectedClient(null);
  };

  // Loading state
  if (loading) {
    return (
      <MainLayout showTabBar={true} showFab={true} fabProps={{ onClick: () => handleOpenDialog(), label: "Add Client" }}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showTabBar={true} showFab={true} fabProps={{ onClick: () => handleOpenDialog(), label: "Add Client" }}>
      <div className="space-y-4 md:space-y-6">
        {/* Page Header - Mobile */}
        <div className="md:hidden">
          <PageHeader
            title="Clients"
            subtitle="Manage your customer relationships"
          />
        </div>

        {/* Search Bar - Mobile */}
        <div className="md:hidden px-4">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search clients..."
          />
        </div>

        {/* Summary Card - Mobile */}
        {!loading && !error && clients && clients.length > 0 && (
          <div className="md:hidden px-4">
            <Card>
              <CardContent className="py-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{clients.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {clients.filter((c) => c.isActive).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">
                      {clients.filter((c) => !c.isActive).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Inactive</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Desktop Header */}
        <div className="hidden md:block">
          {/* Page Header */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                Clients
              </h1>
              <p className="text-muted-foreground">
                Manage your customer relationships
              </p>
            </div>
            <Button
              onClick={() => handleOpenDialog()}
              className="w-full gap-2 lg:w-auto"
              size="lg"
            >
              <Plus className="h-5 w-5" />
              Add Client
            </Button>
          </div>

          {/* Search Bar - Desktop */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-destructive mx-4 md:mx-0">
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-destructive">Error loading clients</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error.message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State - Mobile */}
        {!loading && !error && filteredClients.length === 0 && (
          <div className="md:hidden px-4">
            <EmptyState
              iconType="users"
              title={searchTerm ? "No clients found" : "No clients yet"}
              description={searchTerm
                ? "Try adjusting your search"
                : "Get started by adding your first client"}
              action={!searchTerm ? {
                label: "Add Client",
                onClick: () => handleOpenDialog()
              } : undefined}
            />
          </div>
        )}

        {/* Empty State - Desktop */}
        {!loading && !error && filteredClients.length === 0 && (
          <div className="hidden md:block">
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 text-lg font-semibold">No clients found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {searchTerm
                      ? "Try adjusting your search"
                      : "Get started by adding your first client"}
                  </p>
                  {!searchTerm && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => handleOpenDialog()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Client
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Mobile List View */}
        {!loading && !error && filteredClients.length > 0 && (
          <div className="md:hidden px-4">
            <MobileList>
              {filteredClients.map((client) => (
                <MobileListItem
                  key={client._id}
                  title={client.name}
                  subtitle={client.email || client.phone || "No contact info"}
                  description={client.billing?.address?.city ? `${client.billing.address.city}` : ""}
                  status={{
                    label: client.isActive ? "Active" : "Inactive",
                    variant: client.isActive ? "success" : "secondary"
                  }}
                  onClick={() => handleOpenDialog(client)}
                />
              ))}
            </MobileList>
          </div>
        )}

        {/* Clients Table - Desktop */}
        {!loading && !error && filteredClients.length > 0 && (
          <div className="hidden md:block rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client._id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {client.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3" />
                              {client.email}
                            </div>
                          )}
                          {client.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {client.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.billing?.address ? (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-3 w-3" />
                            {[
                              client.billing.address.line1,
                              client.billing.address.city,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={client.isActive ? "default" : "secondary"}
                        >
                          {client.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(client)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              setSelectedClient(client);
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

        {/* Summary Card - Desktop */}
        {!loading && !error && clients && clients.length > 0 && (
          <div className="hidden md:block">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div>
                    <p className="text-2xl font-bold">{clients.length}</p>
                    <p className="text-xs text-muted-foreground">Total Clients</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {clients.filter((c) => c.isActive).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {clients.filter((c) => !c.isActive).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Inactive</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {clients.filter((c) => c.email).length}
                    </p>
                    <p className="text-xs text-muted-foreground">With Email</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add/Edit Client Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {selectedClient ? "Edit Client" : "Add New Client"}
              </DialogTitle>
              <DialogDescription>
                {selectedClient
                  ? "Update the client details below."
                  : "Fill in the details for the new client."}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 px-1">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Client name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address</Label>
                  <Input
                    id="addressLine1"
                    value={formData.addressLine1}
                    onChange={(e) =>
                      setFormData({ ...formData, addressLine1: e.target.value })
                    }
                    placeholder="Street address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">VAT Number</Label>
                    <Input
                      id="vatNumber"
                      value={formData.vatNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, vatNumber: e.target.value })
                      }
                      placeholder="VAT number"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="creditLimit">Credit Limit (cents)</Label>
                    <Input
                      id="creditLimit"
                      type="number"
                      value={formData.creditLimit}
                      onChange={(e) =>
                        setFormData({ ...formData, creditLimit: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
                    <Input
                      id="paymentTerms"
                      type="number"
                      value={formData.paymentTerms}
                      onChange={(e) =>
                        setFormData({ ...formData, paymentTerms: e.target.value })
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Additional notes"
                  />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.name}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {selectedClient ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Client</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedClient?.name}? This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDeleteCloseDialog}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isSubmitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
