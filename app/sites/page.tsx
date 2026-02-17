"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  MapPin,
  Mail,
  Phone,
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

// Mobile components
import { PageHeader } from "@/components/mobile/page-header";
import { SearchBar } from "@/components/mobile/search-bar";
import { EmptyState } from "@/components/mobile/empty-state";
import { MobileList } from "@/components/mobile/mobile-list";
import { MobileListItem } from "@/components/mobile/mobile-list-item";
import { Fab } from "@/components/mobile/fab";

// Site type based on model
interface Site {
  _id: string;
  name: string;
  code: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    provinceState?: string;
    country?: string;
    postalCode?: string;
  };
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  isActive?: boolean;
  notes?: string;
  createdAt?: string;
}

interface SiteFormData {
  name: string;
  code: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  provinceState: string;
  country: string;
  postalCode: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  isActive: boolean;
}

const initialFormData: SiteFormData = {
  name: "",
  code: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  provinceState: "",
  country: "South Africa",
  postalCode: "",
  contactPerson: "",
  contactPhone: "",
  contactEmail: "",
  notes: "",
  isActive: true,
};

export default function SitesPage() {
  const { toast } = useToast();
  const { data: sites, loading, error, refetch } = useApi<Site[]>("/api/sites");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingSite, setEditingSite] = React.useState<Site | null>(null);
  const [formData, setFormData] = React.useState<SiteFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deleteSiteId, setDeleteSiteId] = React.useState<string | null>(null);

  const filteredSites = React.useMemo(() => {
    if (!sites) return [];
    const query = searchQuery.toLowerCase();
    return sites.filter(
      (site) =>
        site.name.toLowerCase().includes(query) ||
        site.code.toLowerCase().includes(query) ||
        site.address?.city?.toLowerCase().includes(query)
    );
  }, [sites, searchQuery]);

  const handleOpenDialog = (site?: Site) => {
    if (site) {
      setEditingSite(site);
      setFormData({
        name: site.name,
        code: site.code,
        addressLine1: site.address?.line1 || "",
        addressLine2: site.address?.line2 || "",
        city: site.address?.city || "",
        provinceState: site.address?.provinceState || "",
        country: site.address?.country || "South Africa",
        postalCode: site.address?.postalCode || "",
        contactPerson: site.contactPerson || "",
        contactPhone: site.contactPhone || "",
        contactEmail: site.contactEmail || "",
        notes: site.notes || "",
        isActive: site.isActive ?? true,
      });
    } else {
      setEditingSite(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSite(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        code: formData.code,
        address: {
          line1: formData.addressLine1,
          line2: formData.addressLine2,
          city: formData.city,
          provinceState: formData.provinceState,
          country: formData.country,
          postalCode: formData.postalCode,
        },
        contactPerson: formData.contactPerson,
        contactPhone: formData.contactPhone,
        contactEmail: formData.contactEmail,
        notes: formData.notes,
        isActive: formData.isActive,
      };

      if (editingSite) {
        await apiUpdate("/api/sites", editingSite._id, payload);
        toast({ title: "Site updated successfully" });
      } else {
        await apiCreate("/api/sites", payload);
        toast({ title: "Site created successfully" });
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
    if (!deleteSiteId) return;
    setIsSubmitting(true);

    try {
      await apiDelete("/api/sites", deleteSiteId);
      toast({ title: "Site deleted successfully" });
      setDeleteSiteId(null);
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

  const formatAddress = (site: Site) => {
    const parts = [];
    if (site.address?.line1) parts.push(site.address.line1);
    if (site.address?.city) parts.push(site.address.city);
    if (site.address?.provinceState) parts.push(site.address.provinceState);
    return parts.join(", ") || "-";
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
          title="Sites"
          subtitle="Manage your sites and locations"
          primaryAction={{
            label: "Add",
            onClick: () => handleOpenDialog(),
          }}
        />
        <div className="px-4 pb-4">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search sites..."
          />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sites</h1>
            <p className="text-muted-foreground">Manage your sites and locations</p>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Site
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Sites</CardTitle>
            <div className="flex items-center gap-2 pt-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search sites..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-10 text-muted-foreground">
                Error loading sites: {error?.message || String(error)}
              </div>
            ) : filteredSites.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                {searchQuery ? "No sites match your search" : "No sites found. Add your first site!"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSites.map((site) => (
                    <TableRow key={site._id}>
                      <TableCell className="font-medium">{site.code}</TableCell>
                      <TableCell>{site.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {formatAddress(site)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {site.contactPerson && (
                            <div className="text-sm">{site.contactPerson}</div>
                          )}
                          {site.contactPhone && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {site.contactPhone}
                            </div>
                          )}
                          {site.contactEmail && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {site.contactEmail}
                            </div>
                          )}
                          {!site.contactPerson && !site.contactPhone && !site.contactEmail && (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={site.isActive ? "default" : "secondary"}>
                          {site.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenDialog(site)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setDeleteSiteId(site._id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loading State - Mobile */}
      {loading && (
        <div className="md:hidden px-4">
          <MobileList loading={true} skeletonCount={5} />
        </div>
      )}

      {/* Mobile List View */}
      <div className="md:hidden px-4">
        <MobileList
          loading={loading}
          skeletonCount={5}
          emptyState={{
            icon: <MapPin className="h-10 w-10" />,
            title: searchQuery ? "No sites found" : "No sites yet",
            description: searchQuery
              ? "Try adjusting your search"
              : "Get started by adding your first site",
            action: searchQuery
              ? undefined
              : {
                  label: "Add Site",
                  onClick: () => handleOpenDialog(),
                },
          }}
        >
          {filteredSites.map((site) => (
            <MobileListItem
              key={site._id}
              title={site.name}
              subtitle={site.code}
              description={formatAddress(site)}
              avatar={{
                icon: <MapPin className="h-6 w-6 text-primary" />,
              }}
              status={{
                label: site.isActive ? "Active" : "Inactive",
                variant: site.isActive ? "success" : "secondary",
              }}
              onClick={() => handleOpenDialog(site)}
            />
          ))}
        </MobileList>
      </div>

      {/* Mobile FAB */}
      <Fab
        visible={true}
        onClick={handleFabClick}
        label="Add Site"
      />

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSite ? "Edit Site" : "Add New Site"}</DialogTitle>
            <DialogDescription>
              {editingSite
                ? "Update the site details below."
                : "Enter the details for the new site."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Main Warehouse"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="WH-001"
                    required
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input
                  id="addressLine1"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  placeholder="123 Main Street"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  placeholder="Suite, Building, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Johannesburg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provinceState">Province/State</Label>
                  <Input
                    id="provinceState"
                    value={formData.provinceState}
                    onChange={(e) => setFormData({ ...formData, provinceState: e.target.value })}
                    placeholder="Gauteng"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="South Africa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    placeholder="2000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPerson">Contact Person</Label>
                  <Input
                    id="contactPerson"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    placeholder="+27 12 345 6789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
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
                  Active site
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingSite ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSiteId} onOpenChange={() => setDeleteSiteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Site</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this site? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
