"use client";

import * as React from "react";
import { Building2, Save, Loader2, MoreHorizontal, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useApi } from "@/lib/hooks/use-api";
import { MobileMoreMenu, useMobileMoreMenu } from "@/components/mobile/mobile-more-menu";

interface CompanyProfile {
  legalName: string;
  tradingName?: string;
  registrationNumber?: string;
  vatNumber?: string;
  isVatRegistered: boolean;
  email?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    provinceState?: string;
    country?: string;
    postalCode?: string;
  };
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
  };
  banking?: {
    bankName?: string;
    accountHolderName?: string;
    accountNumber?: string;
    branchNumber?: string;
  };
}

interface Company {
  _id: string;
  profile: CompanyProfile;
  status: string;
  bankRef?: string;
}

export default function CompanySettingsPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [company, setCompany] = React.useState<Company | null>(null);
  const { isOpen: isMoreOpen, open: openMore, close: closeMore } = useMobileMoreMenu();

  const [formData, setFormData] = React.useState({
    legalName: "",
    tradingName: "",
    registrationNumber: "",
    vatNumber: "",
    isVatRegistered: false,
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    provinceState: "",
    country: "South Africa",
    postalCode: "",
    logoUrl: "",
    bankName: "",
    accountHolderName: "",
    accountNumber: "",
    branchNumber: "",
  });

  // Fetch company data on mount
  React.useEffect(() => {
    async function fetchCompany() {
      try {
        const response = await fetch("/api/company", {
          credentials: "include",
        });
        
        if (!response.ok) {
          throw new Error("Failed to fetch company");
        }
        
        const result = await response.json();
        if (result.data) {
          setCompany(result.data);
          const profile = result.data.profile;
          setFormData({
            legalName: profile.legalName || "",
            tradingName: profile.tradingName || "",
            registrationNumber: profile.registrationNumber || "",
            vatNumber: profile.vatNumber || "",
            isVatRegistered: profile.isVatRegistered || false,
            email: profile.email || "",
            phone: profile.phone || "",
            addressLine1: profile.address?.line1 || "",
            addressLine2: profile.address?.line2 || "",
            city: profile.address?.city || "",
            provinceState: profile.address?.provinceState || "",
            country: profile.address?.country || "South Africa",
            postalCode: profile.address?.postalCode || "",
            logoUrl: profile.branding?.logoUrl || "",
            bankName: profile.banking?.bankName || "",
            accountHolderName: profile.banking?.accountHolderName || "",
            accountNumber: profile.banking?.accountNumber || "",
            branchNumber: profile.banking?.branchNumber || "",
          });
        }
      } catch (error) {
        console.error("Error fetching company:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load company details",
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchCompany();
  }, [toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an image file",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Image must be less than 2MB",
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev: any) => ({
        ...prev,
        logoUrl: reader.result as string,
      }));
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to read image file",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload = {
        profile: {
          legalName: formData.legalName,
          tradingName: formData.tradingName || undefined,
          registrationNumber: formData.registrationNumber || undefined,
          vatNumber: formData.vatNumber || undefined,
          isVatRegistered: formData.isVatRegistered,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          address: {
            line1: formData.addressLine1 || undefined,
            line2: formData.addressLine2 || undefined,
            city: formData.city || undefined,
            provinceState: formData.provinceState || undefined,
            country: formData.country || undefined,
            postalCode: formData.postalCode || undefined,
          },
          branding: {
            logoUrl: formData.logoUrl || undefined,
          },
          banking: {
            bankName: formData.bankName || undefined,
            accountHolderName: formData.accountHolderName || undefined,
            accountNumber: formData.accountNumber || undefined,
            branchNumber: formData.branchNumber || undefined,
          },
        },
      };

      const response = await fetch("/api/company", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update company");
      }

      const result = await response.json();
      setCompany(result.data);

      toast({
        title: "Success",
        description: "Company details updated successfully",
      });
    } catch (error) {
      console.error("Error updating company:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update company details",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6" />
            <h1 className="text-xl font-bold text-gray-900">Company Settings</h1>
          </div>
          <Button size="icon" variant="ghost" onClick={openMore} className="h-10 w-10">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="container mx-auto py-6 max-w-4xl px-4">

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Basic company details used on invoices and quotes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="legalName">Legal Name *</Label>
                  <Input
                    id="legalName"
                    name="legalName"
                    value={formData.legalName}
                    onChange={handleInputChange}
                    required
                    placeholder="Your Company Legal Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tradingName">Trading Name</Label>
                  <Input
                    id="tradingName"
                    name="tradingName"
                    value={formData.tradingName}
                    onChange={handleInputChange}
                    placeholder="Your Trading Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="registrationNumber">Registration Number</Label>
                  <Input
                    id="registrationNumber"
                    name="registrationNumber"
                    value={formData.registrationNumber}
                    onChange={handleInputChange}
                    placeholder="2024/123456/07"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vatNumber">VAT Number</Label>
                  <Input
                    id="vatNumber"
                    name="vatNumber"
                    value={formData.vatNumber}
                    onChange={handleInputChange}
                    placeholder="VAT Number"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="isVatRegistered"
                  name="isVatRegistered"
                  type="checkbox"
                  checked={formData.isVatRegistered}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isVatRegistered" className="font-normal">
                  Company is VAT registered
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                Contact details for invoices and quotes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="info@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="012 345 6789"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle>Address</CardTitle>
              <CardDescription>
                Company address for invoices and quotes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input
                  id="addressLine1"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleInputChange}
                  placeholder="Street Address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleInputChange}
                  placeholder="Building, Suite, Unit, etc."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Johannesburg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provinceState">Province/State</Label>
                  <Input
                    id="provinceState"
                    name="provinceState"
                    value={formData.provinceState}
                    onChange={handleInputChange}
                    placeholder="Gauteng"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    placeholder="2000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    placeholder="South Africa"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Branding */}
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>
                Logo and branding for documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label htmlFor="logoUpload">Upload Logo</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="logoUpload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Label
                    htmlFor="logoUpload"
                    className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Choose Image
                  </Label>
                  <span className="text-sm text-gray-500">
                    {formData.logoUrl ? "Image selected" : "No image selected"}
                  </span>
                </div>
                {formData.logoUrl && (
                  <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                    <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                    <img
                      src={formData.logoUrl}
                      alt="Company Logo Preview"
                      className="h-24 w-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev: any) => ({ ...prev, logoUrl: "" }))}
                      className="mt-2 text-sm text-red-600 hover:text-red-700"
                    >
                      Remove logo
                    </button>
                  </div>
                )}
              </div>

              {/* Logo URL (alternative) */}
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Or enter Logo URL</Label>
                <Input
                  id="logoUrl"
                  name="logoUrl"
                  value={formData.logoUrl}
                  onChange={handleInputChange}
                  placeholder="https://example.com/logo.png"
                />
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
              <CardDescription>
                Bank details for invoices (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleInputChange}
                  placeholder="e.g., FNB, Standard Bank"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountHolderName">Account Holder Name</Label>
                <Input
                  id="accountHolderName"
                  name="accountHolderName"
                  value={formData.accountHolderName}
                  onChange={handleInputChange}
                  placeholder="Company name on account"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={handleInputChange}
                    placeholder="123456789"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branchNumber">Branch Number</Label>
                  <Input
                    id="branchNumber"
                    name="branchNumber"
                    value={formData.branchNumber}
                    onChange={handleInputChange}
                    placeholder="250125"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
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

      {/* Mobile More Menu */}
      <MobileMoreMenu open={isMoreOpen} onClose={closeMore} />
    </div>
  );
}
