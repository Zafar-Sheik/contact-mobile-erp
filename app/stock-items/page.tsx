"use client";

import * as React from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  AlertTriangle,
  CheckCircle,
  MoreVertical,
  Filter,
  SortDesc,
  XCircle,
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
import { LoadingSkeleton } from "@/components/ui/loading";
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
import { MobileList } from "@/components/mobile/mobile-list";
import { MobileListItem, MobileListItemSkeleton } from "@/components/mobile/mobile-list-item";
import { EmptyState, NoResultsState, EmptyListState } from "@/components/mobile/empty-state";

// Helper type for category reference
type CategoryRef = { _id: string; name: string } | string;

function getCategoryName(categoryId?: CategoryRef): string {
  if (!categoryId) return "";
  return typeof categoryId === "string" ? categoryId : categoryId.name;
}

function getCategoryId(categoryId?: CategoryRef): string {
  if (!categoryId) return "";
  return typeof categoryId === "string" ? categoryId : categoryId._id;
}

// Site ref type
type SiteRef = { _id: string; name: string } | string;

// Helper to get site name from siteId
function getSiteName(siteId?: SiteRef, sites?: Site[]): string {
  if (!siteId) return "";
  if (typeof siteId === "string") {
    const site = sites?.find((s) => s._id === siteId);
    return site?.name || "";
  }
  return siteId?.name || "";
}

// StockItem type matching the model (response from API)
interface StockItem {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: CategoryRef;
  categoryName?: string;
  siteId?: { _id: string; name: string } | string;
  inventory: {
    onHand: number;
    reorderLevel: number;
    reorderQuantity?: number;
    location?: string;
    binNumber?: string;
  };
  pricing: {
    salePriceCents: number;
    costPriceCents: number;
    markupPercent?: number;
  };
  supplierId?: { _id: string; name: string } | string;
  unit: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// API payload type (separate from response type)
interface StockItemPayload {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  siteId?: string;
  inventory: {
    onHand: number;
    reorderLevel: number;
    reorderQuantity?: number;
    location?: string;
    binNumber?: string;
  };
  pricing: {
    salePriceCents: number;
    costPriceCents: number;
    markupPercent?: number;
  };
  unit: string;
  supplierId?: string;
  isActive: boolean;
}

// Category type
interface Category {
  _id: string;
  name: string;
  description?: string;
}

// Site type
interface Site {
  _id: string;
  name: string;
  code: string;
}

interface CategoryFormData {
  name: string;
  description: string;
  isActive: boolean;
}

const initialCategoryFormData: CategoryFormData = {
  name: "",
  description: "",
  isActive: true,
};

interface StockItemFormData {
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  siteId: string;
  onHand: string;
  reorderLevel: string;
  location: string;
  binNumber: string;
  salePriceCents: string;
  costPriceCents: string;
  markupPercent: string;
  unit: string;
  supplierId: string;
  isActive: boolean;
}

const initialFormData: StockItemFormData = {
  sku: "",
  name: "",
  description: "",
  categoryId: "",
  siteId: "",
  onHand: "0",
  reorderLevel: "10",
  location: "",
  binNumber: "",
  salePriceCents: "0.00",
  costPriceCents: "0.00",
  markupPercent: "0",
  unit: "each",
  supplierId: "",
  isActive: true,
};

const units = ["each", "liters", "kg", "meters", "pairs", "sets", "boxes", "cases"];

// Filter and sort types
type FilterStatus = "all" | "in-stock" | "low-stock" | "out-of-stock";
type SortOption = "name-asc" | "name-desc" | "sku-asc" | "sku-desc" | "quantity-asc" | "quantity-desc" | "price-asc" | "price-desc";

export default function StockItemsPage() {
  const { toast } = useToast();
  const { data: stockItems, loading, error, refetch } = useApi<StockItem[]>("/api/stock-items");
  const { data: categoriesData, refetch: refetchCategories } = useApi<Category[]>("/api/categories");
  const { data: sitesData } = useApi<Site[]>("/api/sites");
  
  // Mobile state
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all");
  const [sortBy, setSortBy] = React.useState<SortOption>("name-asc");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false);
  const [isSortSheetOpen, setIsSortSheetOpen] = React.useState(false);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = React.useState(false);
  const [categoryFormData, setCategoryFormData] = React.useState<CategoryFormData>(initialCategoryFormData);
  const [isCategorySubmitting, setIsCategorySubmitting] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<StockItem | null>(null);
  const [formData, setFormData] = React.useState<StockItemFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const categories = React.useMemo(() => categoriesData || [], [categoriesData]);

  // Get unique categories for filter
  const uniqueCategories = React.useMemo(() => {
    if (!stockItems) return [];
    const cats = new Map<string, string>();
    stockItems.forEach(item => {
      const catId = getCategoryId(item.categoryId);
      const catName = getCategoryName(item.categoryId);
      if (catId && catName) {
        cats.set(catId, catName);
      }
    });
    return Array.from(cats.entries()).map(([id, name]) => ({ id, name }));
  }, [stockItems]);

  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");

  // Filter and sort items
  const filteredItems = React.useMemo(() => {
    if (!stockItems) return [];
    
    let items = [...stockItems];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.sku.toLowerCase().includes(term) ||
          getCategoryName(item.categoryId)?.toLowerCase().includes(term)
      );
    }
    
    // Apply status filter
    if (filterStatus !== "all") {
      items = items.filter((item) => {
        const qty = item.inventory?.onHand ?? 0;
        const reorderLevel = item.inventory?.reorderLevel ?? 0;
        
        if (filterStatus === "out-of-stock") {
          return qty === 0;
        } else if (filterStatus === "low-stock") {
          return qty > 0 && qty <= reorderLevel;
        } else if (filterStatus === "in-stock") {
          return qty > reorderLevel;
        }
        return true;
      });
    }
    
    // Apply category filter
    if (selectedCategory !== "all") {
      items = items.filter((item) => getCategoryId(item.categoryId) === selectedCategory);
    }
    
    // Apply sorting
    items.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "sku-asc":
          return a.sku.localeCompare(b.sku);
        case "sku-desc":
          return b.sku.localeCompare(a.sku);
        case "quantity-asc":
          return (a.inventory?.onHand ?? 0) - (b.inventory?.onHand ?? 0);
        case "quantity-desc":
          return (b.inventory?.onHand ?? 0) - (a.inventory?.onHand ?? 0);
        case "price-asc":
          return (a.pricing?.salePriceCents ?? 0) - (b.pricing?.salePriceCents ?? 0);
        case "price-desc":
          return (b.pricing?.salePriceCents ?? 0) - (a.pricing?.salePriceCents ?? 0);
        default:
          return 0;
      }
    });
    
    return items;
  }, [stockItems, searchTerm, filterStatus, selectedCategory, sortBy]);

  const lowStockCount = React.useMemo(() => {
    return stockItems?.filter((item) => item.inventory?.onHand && item.inventory?.reorderLevel && (item.inventory?.onHand ?? 0) <= (item.inventory?.reorderLevel ?? 0)).length || 0;
  }, [stockItems]);

  const totalValue = React.useMemo(() => {
    return stockItems?.reduce((sum, item) => sum + ((item.inventory?.onHand || 0) * (item.pricing?.salePriceCents || 0)), 0) || 0;
  }, [stockItems]);

  const handleOpenDialog = (item?: StockItem) => {
    if (item) {
      setSelectedItem(item);
      setFormData({
        sku: item.sku || "",
        name: item.name || "",
        description: item.description || "",
        categoryId: getCategoryId(item.categoryId) || "",
        siteId: typeof item.siteId === "object" ? item.siteId?._id || "" : item.siteId || "",
        onHand: String(item.inventory?.onHand || 0),
        reorderLevel: String(item.inventory?.reorderLevel || 10),
        location: item.inventory?.location || "",
        binNumber: item.inventory?.binNumber || "",
        salePriceCents: String(item.pricing?.salePriceCents ? (item.pricing.salePriceCents / 100).toFixed(2) : "0.00"),
        costPriceCents: String(item.pricing?.costPriceCents ? (item.pricing.costPriceCents / 100).toFixed(2) : "0.00"),
        markupPercent: String(item.pricing?.markupPercent || 0),
        unit: item.unit || "each",
        supplierId: typeof item.supplierId === "object" ? item.supplierId?._id || "" : item.supplierId || "",
        isActive: item.isActive ?? true,
      });
    } else {
      setSelectedItem(null);
      setFormData(initialFormData);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedItem(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const itemData = {
        sku: formData.sku,
        name: formData.name,
        description: formData.description || undefined,
        categoryId: formData.categoryId || undefined,
        siteId: formData.siteId || undefined,
        inventory: {
          onHand: Number(formData.onHand),
          reorderLevel: Number(formData.reorderLevel),
          location: formData.location || undefined,
          binNumber: formData.binNumber || undefined,
        },
        pricing: {
          salePriceCents: Math.round(Number(formData.salePriceCents) * 100),
          costPriceCents: Math.round(Number(formData.costPriceCents) * 100),
          markupPercent: Number(formData.markupPercent),
        },
        unit: formData.unit,
        supplierId: formData.supplierId || undefined,
        isActive: formData.isActive,
      };

      if (selectedItem) {
        await apiUpdate<StockItem, StockItemPayload>("/api/stock-items", selectedItem._id, itemData);
        toast({ title: "Success", description: "Stock item updated successfully" });
      } else {
        await apiCreate<StockItem, StockItemPayload>("/api/stock-items", itemData);
        toast({ title: "Success", description: "Stock item created successfully" });
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
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/stock-items", selectedItem._id);
      toast({ title: "Success", description: "Stock item deleted successfully" });
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
    setSelectedItem(null);
  };

  const handleCreateCategory = async () => {
    setIsCategorySubmitting(true);
    try {
      const categoryData = {
        name: categoryFormData.name,
        description: categoryFormData.description || undefined,
        isActive: categoryFormData.isActive,
      };

      const newCategory = await apiCreate<Category>("/api/categories", categoryData);
      toast({ title: "Success", description: "Category created successfully" });
      
      // Close the category dialog
      setIsCategoryDialogOpen(false);
      setCategoryFormData(initialCategoryFormData);
      
      // Refetch categories to update the list
      refetchCategories?.();
      
      // Select the newly created category
      if (newCategory?._id) {
        setFormData({ ...formData, categoryId: newCategory._id });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create category",
        variant: "destructive",
      });
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const getStatusInfo = (item: StockItem): { label: string; variant: "success" | "warning" | "destructive" } => {
    const qty = item.inventory?.onHand ?? 0;
    const reorderLevel = item.inventory?.reorderLevel ?? 0;
    
    if (qty === 0) {
      return { label: "Out of Stock", variant: "destructive" };
    }
    if (qty <= reorderLevel) {
      return { label: "Low Stock", variant: "warning" };
    }
    return { label: "In Stock", variant: "success" };
  };

  const getStatusBadge = (item: StockItem) => {
    const status = getStatusInfo(item);
    if (status.variant === "warning") {
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Low Stock
        </Badge>
      );
    }
    if (status.variant === "destructive") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Out of Stock
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        In Stock
      </Badge>
    );
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(cents / 100);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setSelectedCategory("all");
    setSortBy("name-asc");
  };

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (filterStatus !== "all") count++;
    if (selectedCategory !== "all") count++;
    return count;
  }, [filterStatus, selectedCategory]);

  if (loading) {
    return (
      <MainLayout title="Stock Items" showTabBar={true} showFab={false}>
        <div className="p-4 space-y-4">
          <div className="h-16 bg-muted rounded-lg animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <MobileListItemSkeleton key={i} />
            ))}
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout 
      title="Stock Items" 
      showTabBar={true} 
      showFab={false}
      mobileShellProps={{
        fabProps: {
          onClick: () => handleOpenDialog(),
          label: "Add Stock Item",
        }
      }}
    >
      {/* Page Header with title */}
      <PageHeader
        title="Stock Items"
        subtitle={`${filteredItems.length} items`}
        onFilter={() => setIsFilterSheetOpen(true)}
        onSort={() => setIsSortSheetOpen(true)}
        primaryAction={{
          label: "Add",
          onClick: () => handleOpenDialog(),
        }}
      />

      {/* Search Bar */}
      <div className="px-4 pb-4">
        <SearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search stock items..."
          showFilter={true}
          onFilter={() => setIsFilterSheetOpen(true)}
          filterCount={activeFilterCount}
        />
      </div>

      {/* Mobile: MobileList with MobileListItem */}
      <div className="px-4 pb-24">
        {/* Error State */}
        {error && (
          <Card className="border-destructive mb-4">
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-destructive">Error loading stock items</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error.message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty States */}
        {!loading && !error && filteredItems.length === 0 && !searchTerm && filterStatus === "all" && selectedCategory === "all" && (
          <EmptyListState
            title="No stock items yet"
            description="Get started by adding your first stock item"
            onAdd={() => handleOpenDialog()}
            addLabel="Add Stock Item"
          />
        )}

        {!loading && !error && filteredItems.length === 0 && (searchTerm || filterStatus !== "all" || selectedCategory !== "all") && (
          <NoResultsState onClearFilters={clearFilters} />
        )}

        {/* Mobile List */}
        {!loading && !error && filteredItems.length > 0 && (
          <MobileList
            showDividers={false}
            emptyState={undefined}
          >
            {filteredItems.map((item) => {
              const status = getStatusInfo(item);
              return (
                <MobileListItem
                  key={item._id}
                  title={item.name}
                  subtitle={`${item.sku} • ${getCategoryName(item.categoryId) || "Uncategorized"}`}
                  description={`Qty: ${item.inventory?.onHand ?? 0} ${item.unit} • ${formatCurrency(item.pricing?.salePriceCents || 0)}`}
                  status={{
                    label: status.label,
                    variant: status.variant,
                  }}
                  onClick={() => handleOpenDialog(item)}
                  rightContent={
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDialog(item);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  }
                />
              );
            })}
          </MobileList>
        )}
      </div>

      {/* Desktop: Summary Cards and Table (hidden on mobile) */}
      <div className="hidden md:block space-y-4 md:space-y-6 px-6 pb-6">
        {/* Page Header - Desktop */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Stock Items
            </h1>
            <p className="text-muted-foreground">
              Manage your inventory items
            </p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="w-full gap-2 md:w-auto"
            size="lg"
          >
            <Plus className="h-5 w-5" />
            Add Item
          </Button>
        </div>

        {/* Summary Cards */}
        {stockItems && stockItems.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {stockItems.length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Low Stock
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-yellow-600 md:text-2xl">
                  {lowStockCount}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {new Set(stockItems.map((i) => getCategoryId(i.categoryId)).filter(Boolean)).size}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold md:text-2xl">
                  {formatCurrency(totalValue)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search Bar - Desktop */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stock items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-12 text-lg md:h-10 md:text-sm"
          />
        </div>

        {/* Error State - Desktop */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-8">
              <div className="text-center">
                <p className="text-destructive">Error loading stock items</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error.message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State - Desktop */}
        {!loading && !error && filteredItems.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No stock items found</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {searchTerm
                    ? "Try adjusting your search"
                    : "Get started by adding your first stock item"}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => handleOpenDialog()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stock Items Table - Desktop */}
        {!loading && !error && filteredItems.length > 0 && (
          <div className="rounded-lg border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">{item.sku}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCategoryName(item.categoryId) || "Uncategorized"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.inventory?.onHand ?? 0} {item.unit}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.pricing?.salePriceCents || 0)}
                      </TableCell>
                      <TableCell>{getStatusBadge(item)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(item)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              setSelectedItem(item);
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

      {/* Add/Edit Stock Item Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-full max-w-lg mx-auto h-[90vh] md:h-auto md:max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">
              {selectedItem ? "Edit Stock Item" : "Add New Stock Item"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {selectedItem
                ? "Update stock item information below"
                : "Enter item information to add a new stock item"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4 -mr-4">
            <div className="space-y-4 py-4 pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({ ...formData, sku: e.target.value.toUpperCase() })
                    }
                    placeholder="SKU-001"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.categoryId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, categoryId: value })
                      }
                    >
                      <SelectTrigger className="flex-1 h-12">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat._id} value={cat._id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsCategoryDialogOpen(true)}
                      title="Add new category"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Item name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Item description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="onHand">Quantity on Hand</Label>
                  <Input
                    id="onHand"
                    type="number"
                    min="0"
                    className="h-12"
                    value={formData.onHand}
                    onChange={(e) => setFormData({ ...formData, onHand: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reorderLevel">Reorder Level</Label>
                  <Input
                    id="reorderLevel"
                    type="number"
                    min="0"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salePriceCents">Sale Price (ZAR)</Label>
                  <Input
                    id="salePriceCents"
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-12"
                    value={formData.salePriceCents}
                    onChange={(e) => setFormData({ ...formData, salePriceCents: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costPriceCents">Cost Price (ZAR)</Label>
                  <Input
                    id="costPriceCents"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.costPriceCents}
                    onChange={(e) => setFormData({ ...formData, costPriceCents: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="markupPercent">Markup %</Label>
                  <Input
                    id="markupPercent"
                    type="number"
                    min="0"
                    value={formData.markupPercent}
                    onChange={(e) => setFormData({ ...formData, markupPercent: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    className="h-12"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Warehouse location"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="binNumber">Bin Number</Label>
                  <Input
                    id="binNumber"
                    value={formData.binNumber}
                    onChange={(e) => setFormData({ ...formData, binNumber: e.target.value })}
                    placeholder="Bin number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site">Site</Label>
                <Select
                  value={formData.siteId}
                  onValueChange={(value) => setFormData({ ...formData, siteId: value })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select site (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {sitesData?.map((site) => (
                      <SelectItem key={site._id} value={site._id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="flex-col-reverse md:flex-row gap-2">
            <Button variant="outline" onClick={handleCloseDialog} className="h-12 md:h-10 w-full md:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !formData.name || !formData.sku} className="h-12 md:h-10 w-full md:w-auto">
              {isSubmitting ? "Saving..." : selectedItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stock Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedItem?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCloseDialog}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
            <DialogDescription>
              Create a new category for your stock items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Category Name *</Label>
              <Input
                id="categoryName"
                value={categoryFormData.name}
                onChange={(e) =>
                  setCategoryFormData({ ...categoryFormData, name: e.target.value })
                }
                placeholder="Category name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryDescription">Description</Label>
              <Input
                id="categoryDescription"
                value={categoryFormData.description}
                onChange={(e) =>
                  setCategoryFormData({ ...categoryFormData, description: e.target.value })
                }
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCategory}
              disabled={isCategorySubmitting || !categoryFormData.name}
            >
              {isCategorySubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile Filter Sheet */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden">
          <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl p-6 pb-8 max-h-[80vh] overflow-y-auto animate-slideUp">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Filters</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsFilterSheetOpen(false)}>
                Done
              </Button>
            </div>
            
            {/* Status Filter */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3">Status</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "in-stock", label: "In Stock" },
                  { value: "low-stock", label: "Low Stock" },
                  { value: "out-of-stock", label: "Out of Stock" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={filterStatus === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterStatus(option.value as FilterStatus)}
                    className="min-h-[44px]"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Category Filter */}
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-3">Category</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("all")}
                  className="min-h-[44px]"
                >
                  All
                </Button>
                {uniqueCategories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                    className="min-h-[44px]"
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={clearFilters}
              >
                Clear All Filters
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mobile Sort Sheet */}
      {isSortSheetOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden">
          <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl p-6 pb-8 animate-slideUp">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Sort By</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsSortSheetOpen(false)}>
                Done
              </Button>
            </div>
            
            <div className="space-y-2">
              {[
                { value: "name-asc", label: "Name (A-Z)" },
                { value: "name-desc", label: "Name (Z-A)" },
                { value: "sku-asc", label: "SKU (A-Z)" },
                { value: "sku-desc", label: "SKU (Z-A)" },
                { value: "quantity-desc", label: "Quantity (High to Low)" },
                { value: "quantity-asc", label: "Quantity (Low to High)" },
                { value: "price-desc", label: "Price (High to Low)" },
                { value: "price-asc", label: "Price (Low to High)" },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant={sortBy === option.value ? "default" : "outline"}
                  className="w-full justify-start min-h-[44px]"
                  onClick={() => {
                    setSortBy(option.value as SortOption);
                    setIsSortSheetOpen(false);
                  }}
                >
                  {option.label}
                  {sortBy === option.value && (
                    <CheckCircle className="ml-auto h-4 w-4" />
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
