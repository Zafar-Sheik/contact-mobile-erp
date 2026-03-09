"use client";

import * as React from "react";
import {
  Search,
  Edit,
  Trash2,
  Clock,
  DollarSign,
  MoreHorizontal,
  UserPlus,
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

// LabourCost type
interface LabourCost {
  _id: string;
  code: string;
  name: string;
  description?: string;
  unit: string;
  pricing: {
    rateCents: number;
    costCents: number;
  };
  isActive: boolean;
}

interface LabourCostFormData {
  code: string;
  name: string;
  description: string;
  unit: string;
  rateCents: number;
  costCents: number;
  isActive: boolean;
}

const initialFormData: LabourCostFormData = {
  code: "",
  name: "",
  description: "",
  unit: "hour",
  rateCents: 0,
  costCents: 0,
  isActive: true,
};

// Format cents to currency
const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100);
};

// Parse currency input to cents
const parseCurrencyToCents = (value: string): number => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
};

export default function LabourCostsPage() {
  const { toast } = useToast();
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  // API hooks
  const { data: labourCosts, loading, error, refetch } = useApi<LabourCost[]>("/api/labour-costs");

  // State
  const [searchTerm, setSearchTerm] = React.useState("");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [selectedLabourCost, setSelectedLabourCost] = React.useState<LabourCost | null>(null);
  const [formData, setFormData] = React.useState<LabourCostFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Currency display states
  const [rateDisplay, setRateDisplay] = React.useState("0.00");
  const [costDisplay, setCostDisplay] = React.useState("0.00");

  // Filter labour costs
  const filteredLabourCosts = React.useMemo(() => {
    if (!labourCosts) return [];
    return labourCosts.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [labourCosts, searchTerm]);

  const handleOpenDialog = (labourCost?: LabourCost) => {
    if (labourCost) {
      setSelectedLabourCost(labourCost);
      setFormData({
        code: labourCost.code || "",
        name: labourCost.name || "",
        description: labourCost.description || "",
        unit: labourCost.unit || "hour",
        rateCents: labourCost.pricing?.rateCents || 0,
        costCents: labourCost.pricing?.costCents || 0,
        isActive: labourCost.isActive ?? true,
      });
      setRateDisplay(((labourCost.pricing?.rateCents || 0) / 100).toFixed(2));
      setCostDisplay(((labourCost.pricing?.costCents || 0) / 100).toFixed(2));
    } else {
      setSelectedLabourCost(null);
      setFormData(initialFormData);
      setRateDisplay("0.00");
      setCostDisplay("0.00");
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedLabourCost(null);
    setFormData(initialFormData);
    setRateDisplay("0.00");
    setCostDisplay("0.00");
  };

  const handleRateChange = (value: string) => {
    setRateDisplay(value);
    setFormData({ ...formData, rateCents: parseCurrencyToCents(value) });
  };

  const handleCostChange = (value: string) => {
    setCostDisplay(value);
    setFormData({ ...formData, costCents: parseCurrencyToCents(value) });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const labourCostData = {
        code: formData.code,
        name: formData.name,
        description: formData.description || undefined,
        unit: formData.unit,
        pricing: {
          rateCents: formData.rateCents,
          costCents: formData.costCents,
        },
        isActive: formData.isActive,
      };

      if (selectedLabourCost) {
        await apiUpdate<LabourCost, typeof labourCostData>("/api/labour-costs", selectedLabourCost._id, labourCostData);
        toast({ title: "Success", description: "Labour cost updated successfully" });
      } else {
        await apiCreate<LabourCost, typeof labourCostData>("/api/labour-costs", labourCostData);
        toast({ title: "Success", description: "Labour cost created successfully" });
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
    if (!selectedLabourCost) return;

    setIsSubmitting(true);
    try {
      await apiDelete("/api/labour-costs", selectedLabourCost._id);
      toast({ title: "Success", description: "Labour cost deleted successfully" });
      setIsDeleteDialogOpen(false);
      setSelectedLabourCost(null);
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
          <h1 className="text-xl font-bold text-gray-900">Labour Costs</h1>
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
            placeholder="Search labour costs..."
            className="pl-10 h-12 bg-gray-50 border-gray-200 rounded-xl"
          />
        </div>
      </div>

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
            <p className="text-red-600 font-medium">Error loading labour costs</p>
            <p className="text-red-500 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredLabourCosts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="bg-gray-100 p-4 rounded-full mb-4">
              <Clock className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {searchTerm ? "No labour costs found" : "No labour costs yet"}
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchTerm ? "Try a different search term" : "Add your first labour cost to get started"}
            </p>
          </div>
        )}

        {/* Labour Costs List */}
        {!loading && !error && filteredLabourCosts.length > 0 && (
          <div className="space-y-3 max-w-md mx-auto">
            {filteredLabourCosts.map((labourCost) => (
              <div
                key={labourCost._id}
                onClick={() => handleOpenDialog(labourCost)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.99] transition-transform cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-full">
                      <Clock className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{labourCost.name}</h3>
                      <p className="text-sm text-gray-500">{labourCost.code}</p>
                    </div>
                  </div>
                  <Badge
                    variant={labourCost.isActive !== false ? "success" : "secondary"}
                    className="ml-2 shrink-0"
                  >
                    {labourCost.isActive !== false ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Description */}
                {labourCost.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2 pl-12">
                    {labourCost.description}
                  </p>
                )}

                {/* Pricing Info */}
                <div className="pl-12 flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(labourCost.pricing?.rateCents || 0)}
                    </span>
                    <span className="text-xs text-gray-500">/{labourCost.unit || "hr"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Cost:</span>
                    <span className="text-sm text-gray-600">
                      {formatCurrency(labourCost.pricing?.costCents || 0)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenDialog(labourCost);
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
                      setSelectedLabourCost(labourCost);
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
          className="h-14 w-14 rounded-full shadow-lg bg-purple-600 hover:bg-purple-700"
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
              {selectedLabourCost ? "Edit Labour Cost" : "Add Labour Cost"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., LAB-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Installation"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description of the labour service"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                placeholder="e.g., hour, day, job"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate">Selling Rate *</Label>
                <Input
                  id="rate"
                  type="text"
                  value={rateDisplay}
                  onChange={(e) => handleRateChange(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost</Label>
                <Input
                  id="cost"
                  type="text"
                  value={costDisplay}
                  onChange={(e) => handleCostChange(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="text-sm font-normal">
                Active
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.code || !formData.name}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting ? "Saving..." : selectedLabourCost ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Labour Cost</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete "{selectedLabourCost?.name}"? This action cannot be undone.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
