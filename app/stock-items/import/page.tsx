"use client";

import * as React from "react";
import { useEffect } from "react";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  ArrowLeft,
  Table,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowDownToLine,
  GitMerge
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// File size limit: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

// Import result types (matching API response)
interface ImportFailure {
  rowNumber: number;
  reason: string;
  rawRow: Record<string, unknown>;
}

interface CreatedSample {
  id: string;
  sku: string;
  name: string;
}

interface ImportResult {
  wouldCreateCount?: number;
  wouldUpdateCount?: number;
  createdCount?: number;
  updatedCount?: number;
  skippedCount: number;
  failedCount: number;
  failures: ImportFailure[];
  createdSample: CreatedSample[];
}

// Duplicate handling options
type DuplicateHandling = "skip" | "updateBySku";

export default function StockItemsImportPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  // State
  const [file, setFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [showFailures, setShowFailures] = React.useState(false);
  const [showExample, setShowExample] = React.useState(false);
  
  // Import options
  const [dryRun, setDryRun] = React.useState(false);
  const [duplicateHandling, setDuplicateHandling] = React.useState<DuplicateHandling>("skip");
  
  // File validation
  const validateFile = (file: File): string | null => {
    const extension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return "Invalid file type. Please upload a CSV or XLSX file.";
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is 5MB. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`;
    }
    
    return null;
  };
  
  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;
    
    const error = validateFile(uploadedFile);
    if (error) {
      toast({
        title: "Invalid file",
        description: error,
        variant: "destructive",
      });
      return;
    }
    
    setFile(uploadedFile);
    setResult(null);
    setShowFailures(false);
  };
  
  // Handle import
  const handleImport = async () => {
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // Build URL with query params
      const params = new URLSearchParams();
      if (dryRun) {
        params.set("dryRun", "true");
      }
      if (duplicateHandling === "updateBySku") {
        params.set("mergeMode", "updateBySku");
      }
      
      const url = `/api/stock-items/import${params.toString() ? '?' + params.toString() : ''}`;
      
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }
      
      setResult(data);
      
      // Build success message based on mode
      const isDryRun = data.wouldCreateCount !== undefined;
      const createdCount = data.createdCount ?? data.wouldCreateCount ?? 0;
      const updatedCount = data.updatedCount ?? data.wouldUpdateCount ?? 0;
      const failedCount = data.failedCount ?? 0;
      
      if (isDryRun) {
        if (createdCount > 0 || updatedCount > 0) {
          toast({
            title: "Validation complete",
            description: `Would create ${createdCount} items, update ${updatedCount} items.`,
            variant: "default",
          });
        } else if (failedCount > 0) {
          toast({
            title: "Validation complete with issues",
            description: `${failedCount} rows have validation errors.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Validation complete",
            description: "No issues found. Ready to import.",
            variant: "default",
          });
        }
      } else {
        if (createdCount > 0 || updatedCount > 0) {
          toast({
            title: "Import complete",
            description: `Created ${createdCount} items, updated ${updatedCount} items.`,
            variant: "default",
          });
        } else if (failedCount > 0) {
          toast({
            title: "Import completed with errors",
            description: `${failedCount} rows failed to import.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Import complete",
            description: "No new items were imported.",
            variant: "default",
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      toast({
        title: "Import failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle file removal
  const handleRemoveFile = () => {
    setFile(null);
    setResult(null);
    setShowFailures(false);
  };
  
  // Handle download template
  const handleDownloadTemplate = () => {
    const csvContent = "TXDate,TCode,Description,Quantity,Unit Price\n2024-01-01,001,Widget A,100,12.50\n2024-01-02,002,Widget B,50,8.99\n2024-01-03,003,Gasket Set,25,R 150.00\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock_items_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Get count to display based on dry run mode
  const getDisplayCounts = () => {
    if (!result) return { created: 0, updated: 0, skipped: 0, failed: 0 };
    
    const isDryRun = result.wouldCreateCount !== undefined;
    return {
      created: isDryRun ? (result.wouldCreateCount ?? 0) : (result.createdCount ?? 0),
      updated: isDryRun ? (result.wouldUpdateCount ?? 0) : (result.updatedCount ?? 0),
      skipped: result.skippedCount,
      failed: result.failedCount,
    };
  };
  
  const counts = getDisplayCounts();
  const isDryRunResult = result?.wouldCreateCount !== undefined;
  
  return (
    <div className="container mx-auto py-6 px-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => router.push("/stock-items")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Stock Items</h1>
          <p className="text-muted-foreground">
            Upload a CSV or Excel file to import stock items
          </p>
        </div>
      </div>
      
      {/* Upload Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload File
          </CardTitle>
          <CardDescription>
            Accepted formats: CSV, XLSX (max 5MB)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Input */}
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="flex-1"
              disabled={isUploading}
            />
            {file && (
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleRemoveFile}
                disabled={isUploading}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Selected File Info */}
          {file && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
          )}
          
          {/* Import Options */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-medium">Import Options</h3>
            
            {/* Dry Run Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="dry-run" className="text-sm cursor-pointer">
                  Dry run (validate only)
                </Label>
              </div>
              <Switch
                id="dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
                disabled={isUploading}
              />
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              When enabled, validates the file without creating any items
            </p>
            
            {/* Duplicate Handling */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {duplicateHandling === "updateBySku" ? (
                  <GitMerge className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
                )}
                <Label className="text-sm">Duplicate handling</Label>
              </div>
              <Select 
                value={duplicateHandling} 
                onValueChange={(v) => setDuplicateHandling(v as DuplicateHandling)}
                disabled={isUploading}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">
                    <div className="flex items-center gap-2">
                      <ArrowDownToLine className="h-3 w-3" />
                      Skip duplicates
                    </div>
                  </SelectItem>
                  <SelectItem value="updateBySku">
                    <div className="flex items-center gap-2">
                      <GitMerge className="h-3 w-3" />
                      Update by SKU
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              {duplicateHandling === "skip" 
                ? "Items with existing SKUs will be skipped" 
                : "Items with existing SKUs will be updated with new quantity and price"}
            </p>
          </div>
          
          {/* Template & Example Section */}
          <div className="space-y-3">
            {/* Template Download */}
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  Need a template?
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDownloadTemplate}
                className="text-blue-600 border-blue-600 hover:bg-blue-100"
              >
                Download CSV
              </Button>
            </div>
            
            {/* Example Preview Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Want to see an example?
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowExample(!showExample)}
                className="text-gray-600 border-gray-600 hover:bg-gray-100"
              >
                {showExample ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-1" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    Show
                  </>
                )}
              </Button>
            </div>
            
            {/* Example Table */}
            {showExample && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted p-2 text-xs font-medium text-center">
                  Example CSV Format
                </div>
                <ScrollArea className="h-[180px]">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b">TXDate</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b">TCode</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b">Description</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b">Quantity</th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground border-b">Unit Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="px-3 py-2 text-muted-foreground">2024-01-01</td>
                        <td className="px-3 py-2 text-muted-foreground">001</td>
                        <td className="px-3 py-2 font-medium">Widget A</td>
                        <td className="px-3 py-2">100</td>
                        <td className="px-3 py-2">12.50</td>
                      </tr>
                      <tr className="border-b">
                        <td className="px-3 py-2 text-muted-foreground">2024-01-02</td>
                        <td className="px-3 py-2 text-muted-foreground">002</td>
                        <td className="px-3 py-2 font-medium">Widget B</td>
                        <td className="px-3 py-2">50</td>
                        <td className="px-3 py-2">8.99</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-muted-foreground">2024-01-03</td>
                        <td className="px-3 py-2 text-muted-foreground">003</td>
                        <td className="px-3 py-2 font-medium">Gasket Set</td>
                        <td className="px-3 py-2">25</td>
                        <td className="px-3 py-2">R 150.00</td>
                      </tr>
                    </tbody>
                  </table>
                </ScrollArea>
                <div className="bg-muted/50 p-2 text-xs text-center text-muted-foreground">
                  TXDate and TCode columns will be ignored
                </div>
              </div>
            )}
          </div>
          
          {/* Column Requirements Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Required Columns</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                <li><strong>Description</strong> or <strong>Name</strong> - Item name (required)</li>
                <li><strong>Quantity</strong>, <strong>Qty</strong>, or <strong>Stock</strong> - Number of items</li>
                <li><strong>Unit Price</strong>, <strong>Price</strong>, or <strong>Cost</strong> - Cost price</li>
              </ul>
              <p className="text-sm mt-2 text-muted-foreground">
                Accepts: "R 12.34", "12.34", "12,34" formats. Extra columns are ignored.
              </p>
            </AlertDescription>
          </Alert>
          
          {/* Import Button */}
          <Button 
            onClick={handleImport}
            disabled={!file || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {dryRun ? "Validating..." : "Importing..."}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {dryRun ? "Validate Only (Dry Run)" : "Import Stock Items"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Created */}
            <Card className={counts.created > 0 ? "border-green-500 bg-green-50 dark:bg-green-950" : ""}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {counts.created}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {isDryRunResult ? "Would Create" : "Created"}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Updated (only show if merge mode was used) */}
            {(duplicateHandling === "updateBySku" || counts.updated > 0) && (
              <Card className={counts.updated > 0 ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : ""}>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {counts.updated}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {isDryRunResult ? "Would Update" : "Updated"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Skipped */}
            <Card className={counts.skipped > 0 ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950" : ""}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-yellow-600">
                    {counts.skipped}
                  </div>
                  <div className="text-sm text-muted-foreground">Skipped</div>
                </div>
              </CardContent>
            </Card>
            
            {/* Failed */}
            <Card className={counts.failed > 0 ? "border-red-500 bg-red-50 dark:bg-red-950" : ""}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {counts.failed}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Failures Collapsible */}
          {result.failures.length > 0 && (
            <Collapsible open={showFailures} onOpenChange={setShowFailures}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        Failed Rows ({result.failures.length})
                      </CardTitle>
                      {showFailures ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-3">
                    {result.failures.map((failure, index) => (
                      <div 
                        key={index}
                        className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge variant="destructive" className="mr-2">
                              Row {failure.rowNumber}
                            </Badge>
                            <span className="text-sm text-red-600">
                              {failure.reason}
                            </span>
                          </div>
                        </div>
                        {failure.rawRow && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(failure.rawRow, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
          
          {/* Created Sample */}
          {result.createdSample.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {isDryRunResult ? "Items to be Processed" : "Recently Processed Items"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.createdSample.map((item, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          SKU: {item.sku}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-green-600">
                        {isDryRunResult ? "Will Process" : "Done"}
                      </Badge>
                    </div>
                  ))}
                </div>
                
                {(counts.created + counts.updated) > 10 && (
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    And {(counts.created + counts.updated) - 10} more items...
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* View All Button */}
          {(counts.created > 0 || counts.updated > 0) && !dryRun && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.push("/stock-items")}
            >
              View All Stock Items
            </Button>
          )}
          
          {/* Run Actual Import Button (after dry run) */}
          {dryRun && (counts.created > 0 || counts.updated > 0) && (
            <Button 
              className="w-full"
              onClick={() => {
                setDryRun(false);
                handleImport();
              }}
              disabled={isUploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              Run Actual Import
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
