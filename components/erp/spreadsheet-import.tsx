"use client";

import * as React from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";

// Stock item field definitions for mapping
export interface StockItemField {
  key: string;
  label: string;
  required: boolean;
  type: "text" | "number" | "select";
  options?: { value: string; label: string }[];
}

// Available stock item fields that can be mapped
export const STOCK_ITEM_FIELDS: StockItemField[] = [
  { key: "name", label: "Description / Name", required: true, type: "text" },
  { key: "quantity", label: "Quantity", required: true, type: "number" },
  { key: "unitPrice", label: "Unit Price", required: true, type: "number" },
  { key: "description", label: "Description (Full)", required: false, type: "text" },
  { key: "categoryId", label: "Category", required: false, type: "text" },
  { key: "unit", label: "Unit", required: false, type: "text" },
  { key: "barcode", label: "Barcode", required: false, type: "text" },
  { key: "manufacturer", label: "Manufacturer", required: false, type: "text" },
  { key: "brand", label: "Brand", required: false, type: "text" },
  { key: "partNumber", label: "Part Number", required: false, type: "text" },
  { key: "reorderLevel", label: "Reorder Level", required: false, type: "number" },
  { key: "reorderQuantity", label: "Reorder Quantity", required: false, type: "number" },
];

// Required fields that must be mapped
const REQUIRED_FIELDS = ["name", "quantity", "unitPrice"];

interface SpreadsheetImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: (count: number) => void;
}

// Parsed row data from spreadsheet
interface ParsedRow {
  rowIndex: number;
  data: Record<string, any>;
  errors: string[];
  isValid: boolean;
}

// Column mapping
interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
}

export function SpreadsheetImport({ open, onOpenChange, onImportComplete }: SpreadsheetImportProps) {
  const { toast } = useToast();
  
  // State
  const [step, setStep] = React.useState<"upload" | "mapping" | "preview" | "importing">("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [spreadsheetHeaders, setSpreadsheetHeaders] = React.useState<string[]>([]);
  const [spreadsheetData, setSpreadsheetData] = React.useState<Record<string, any>[]>([]);
  const [columnMappings, setColumnMappings] = React.useState<ColumnMapping[]>([]);
  const [parsedRows, setParsedRows] = React.useState<ParsedRow[]>([]);
  const [importProgress, setImportProgress] = React.useState(0);
  const [importStatus, setImportStatus] = React.useState<"idle" | "importing" | "success" | "error">("idle");
  const [importErrors, setImportErrors] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      // Reset everything when closed
      setTimeout(() => {
        setStep("upload");
        setFile(null);
        setSpreadsheetHeaders([]);
        setSpreadsheetData([]);
        setColumnMappings([]);
        setParsedRows([]);
        setImportProgress(0);
        setImportStatus("idle");
        setImportErrors([]);
      }, 300);
    }
  }, [open]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv", // .csv
    ];
    
    if (!validTypes.includes(uploadedFile.type) && !uploadedFile.name.endsWith(".xlsx") && !uploadedFile.name.endsWith(".xls") && !uploadedFile.name.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an Excel file (.xlsx, .xls) or CSV file.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const data = await parseSpreadsheet(uploadedFile);
      if (data.headers.length === 0) {
        toast({
          title: "Empty spreadsheet",
          description: "The uploaded file contains no data.",
          variant: "destructive",
        });
        return;
      }

      setFile(uploadedFile);
      setSpreadsheetHeaders(data.headers);
      setSpreadsheetData(data.rows);
      
      // Auto-map columns based on common names
      const autoMappings = autoMapColumns(data.headers);
      setColumnMappings(autoMappings);
      
      setStep("mapping");
    } catch (error: any) {
      toast({
        title: "Error parsing file",
        description: error.message || "Failed to parse the spreadsheet.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Parse spreadsheet file
  const parseSpreadsheet = (file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          
          if (jsonData.length === 0) {
            resolve({ headers: [], rows: [] });
            return;
          }
          
          const headers = jsonData[0].map((h, i) => String(h || `Column ${i + 1}`));
          const rows = jsonData.slice(1).map((row) => {
            const obj: Record<string, any> = {};
            headers.forEach((header, i) => {
              obj[header] = row[i];
            });
            return obj;
          });
          
          resolve({ headers, rows });
        } catch (error: any) {
          reject(new Error("Failed to read spreadsheet: " + error.message));
        }
      };
      
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsBinaryString(file);
    });
  };

  // Auto-map columns based on common names
  const autoMapColumns = (headers: string[]): ColumnMapping[] => {
    const mappings: ColumnMapping[] = [];
    const headerLower = headers.map(h => h.toLowerCase().trim());
    
    // Map Description/Name
    const nameMatches = ["description", "name", "item name", "item description", "product", "product name", "product description"];
    const nameIdx = headerLower.findIndex(h => nameMatches.some(m => h.includes(m)));
    if (nameIdx >= 0) {
      mappings.push({ sourceColumn: headers[nameIdx], targetField: "name" });
    }
    
    // Map Quantity
    const qtyMatches = ["quantity", "qty", "stock", "on hand", "onhand", "count"];
    const qtyIdx = headerLower.findIndex(h => qtyMatches.some(m => h === m || h.includes(m)));
    if (qtyIdx >= 0) {
      mappings.push({ sourceColumn: headers[qtyIdx], targetField: "quantity" });
    }
    
    // Map Unit Price
    const priceMatches = ["price", "unit price", "unit cost", "cost", "selling price", "price cents"];
    const priceIdx = headerLower.findIndex(h => priceMatches.some(m => h.includes(m)));
    if (priceIdx >= 0) {
      mappings.push({ sourceColumn: headers[priceIdx], targetField: "unitPrice" });
    }
    
    return mappings;
  };

  // Handle mapping change
  const handleMappingChange = (sourceColumn: string, targetField: string) => {
    setColumnMappings(prev => {
      // Remove any existing mapping to this target field
      const filtered = prev.filter(m => m.targetField !== targetField);
      // Add new mapping
      if (sourceColumn && sourceColumn !== "_none") {
        return [...filtered, { sourceColumn, targetField }];
      }
      return filtered;
    });
  };

  // Validate mappings
  const validateMappings = (): string[] => {
    const errors: string[] = [];
    const mappedFields = columnMappings.map(m => m.targetField);
    
    REQUIRED_FIELDS.forEach(field => {
      if (!mappedFields.includes(field)) {
        const fieldInfo = STOCK_ITEM_FIELDS.find(f => f.key === field);
        errors.push(`Required field "${fieldInfo?.label || field}" is not mapped`);
      }
    });
    
    return errors;
  };

  // Proceed to preview
  const handleProceedToPreview = () => {
    const errors = validateMappings();
    if (errors.length > 0) {
      toast({
        title: "Incomplete mapping",
        description: errors.join(". "),
        variant: "destructive",
      });
      return;
    }
    
    // Parse and validate rows
    const parsed = parseAndValidateRows();
    setParsedRows(parsed);
    setStep("preview");
  };

  // Parse and validate rows
  const parseAndValidateRows = (): ParsedRow[] => {
    const mappingObj = columnMappings.reduce((acc, m) => {
      acc[m.targetField] = m.sourceColumn;
      return acc;
    }, {} as Record<string, string>);
    
    return spreadsheetData.map((row, idx) => {
      const errors: string[] = [];
      const data: Record<string, any> = {};
      
      // Map each field
      STOCK_ITEM_FIELDS.forEach(field => {
        const sourceCol = mappingObj[field.key];
        if (sourceCol) {
          let value = row[sourceCol];
          
          // Parse based on field type
          if (field.type === "number") {
            if (value !== undefined && value !== null && value !== "") {
              const num = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
              if (isNaN(num)) {
                errors.push(`Invalid number for "${field.label}"`);
                data[field.key] = null;
              } else {
                data[field.key] = num;
              }
            } else if (field.required) {
              errors.push(`Missing required field "${field.label}"`);
              data[field.key] = null;
            }
          } else {
            if (value !== undefined && value !== null) {
              data[field.key] = String(value).trim();
            } else if (field.required) {
              errors.push(`Missing required field "${field.label}"`);
              data[field.key] = "";
            }
          }
        }
      });
      
      // Convert quantity to cents for unit price (if price is in cents)
      if (data.unitPrice !== undefined && data.unitPrice !== null) {
        // Assume unit price is in cents already, or convert if it's in Rands
        // For now, we'll pass it as-is and let the server handle it
        data.unitPriceCents = Math.round(data.unitPrice);
      }
      
      // Set quantity in inventory
      if (data.quantity !== undefined && data.quantity !== null) {
        data.inventory = {
          onHand: data.quantity,
          available: data.quantity,
          reserved: 0,
          reorderLevel: data.reorderLevel || 0,
          reorderQuantity: data.reorderQuantity || 0,
        };
      }
      
      // Remove individual qty/price fields, use inventory and pricing instead
      delete data.quantity;
      delete data.unitPrice;
      delete data.reorderLevel;
      delete data.reorderQuantity;
      
      return {
        rowIndex: idx + 2, // +2 because Excel is 1-indexed and we have header
        data,
        errors,
        isValid: errors.length === 0,
      };
    });
  };

  // Import data
  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    
    if (validRows.length === 0) {
      toast({
        title: "No valid rows",
        description: "There are no valid rows to import.",
        variant: "destructive",
      });
      return;
    }

    setStep("importing");
    setImportStatus("importing");
    setImportProgress(0);
    setImportErrors([]);

    try {
      const response = await fetch("/api/stock-items/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: validRows.map(r => r.data),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Import failed");
      }

      setImportProgress(100);
      setImportStatus("success");
      
      toast({
        title: "Import successful",
        description: `Successfully imported ${result.data?.createdCount || validRows.length} stock items.`,
      });
      
      onImportComplete(result.data?.createdCount || validRows.length);
      
      // Close dialog after a delay
      setTimeout(() => {
        onOpenChange(false);
      }, 2000);
    } catch (error: any) {
      setImportStatus("error");
      setImportErrors([error.message]);
      toast({
        title: "Import failed",
        description: error.message || "Failed to import stock items.",
        variant: "destructive",
      });
    }
  };

  // Get unmapped columns
  const unmappedColumns = spreadsheetHeaders.filter(
    col => !columnMappings.some(m => m.sourceColumn === col)
  );

  // Calculate preview stats
  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Stock Items from Spreadsheet
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                id="spreadsheet-upload"
                disabled={isLoading}
              />
              <label
                htmlFor="spreadsheet-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
                ) : (
                  <Upload className="h-12 w-12 text-gray-400" />
                )}
                <span className="text-lg font-medium">
                  {file ? file.name : "Click to upload spreadsheet"}
                </span>
                <span className="text-sm text-gray-500">
                  Supports .xlsx, .xls, and .csv files
                </span>
              </label>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Required Columns</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Description / Name</strong> - The item name (required)</li>
                <li>• <strong>Quantity</strong> - Initial stock quantity (required)</li>
                <li>• <strong>Unit Price</strong> - Price per unit in cents (required)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-900 mb-2">Map Spreadsheet Columns</h4>
              <p className="text-sm text-yellow-800">
                Map your spreadsheet columns to the stock item fields. Required fields must be mapped.
              </p>
            </div>

            <div className="space-y-3">
              {STOCK_ITEM_FIELDS.filter(f => f.required || columnMappings.some(m => m.targetField === f.key)).map(field => (
                <div key={field.key} className="flex items-center gap-4">
                  <div className="w-48 flex-shrink-0">
                    <Label className={field.required ? "font-semibold" : ""}>
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <Select
                    value={columnMappings.find(m => m.targetField === field.key)?.sourceColumn || ""}
                    onValueChange={(value) => handleMappingChange(value, field.key)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">-- Not mapped --</SelectItem>
                      {spreadsheetHeaders.map(header => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {unmappedColumns.length > 0 && (
              <div className="text-sm text-gray-500 mt-4">
                <p>Unmapped columns: {unmappedColumns.join(", ")}</p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={handleProceedToPreview}>
                Preview Data
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-green-50 p-3 rounded-lg">
                <div className="text-2xl font-bold text-green-700">{validCount}</div>
                <div className="text-sm text-green-600">Valid rows</div>
              </div>
              {invalidCount > 0 && (
                <div className="flex-1 bg-red-50 p-3 rounded-lg">
                  <div className="text-2xl font-bold text-red-700">{invalidCount}</div>
                  <div className="text-sm text-red-600">Rows with errors</div>
                </div>
              )}
            </div>

            {invalidCount > 0 && (
              <div className="bg-red-50 p-3 rounded-lg text-sm">
                <div className="font-medium text-red-900 mb-2">Sample Errors:</div>
                {parsedRows.filter(r => !r.isValid).slice(0, 5).map((row, idx) => (
                  <div key={idx} className="text-red-700">
                    Row {row.rowIndex}: {row.errors.join(", ")}
                  </div>
                ))}
                {invalidCount > 5 && (
                  <div className="text-red-700 mt-1">...and {invalidCount - 5} more errors</div>
                )}
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Row</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price (Cents)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 10).map((row) => (
                    <TableRow key={row.rowIndex} className={!row.isValid ? "bg-red-50" : ""}>
                      <TableCell className="font-mono text-xs">{row.rowIndex}</TableCell>
                      <TableCell>{row.data.name || "-"}</TableCell>
                      <TableCell>{row.data.inventory?.onHand ?? "-"}</TableCell>
                      <TableCell>{row.data.unitPriceCents ?? "-"}</TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-xs text-red-600">{row.errors[0]}</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedRows.length > 10 && (
                <div className="p-2 text-center text-sm text-gray-500 bg-gray-50">
                  Showing first 10 of {parsedRows.length} rows
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("mapping")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Mapping
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Import {validCount} Items
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="space-y-6 py-8">
            {importStatus === "importing" && (
              <>
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-16 w-16 animate-spin text-blue-500" />
                  <div className="text-lg font-medium">Importing Stock Items...</div>
                  <div className="text-sm text-gray-500">
                    Please wait while your items are being created.
                  </div>
                </div>
                <Progress value={importProgress} className="w-full" />
              </>
            )}

            {importStatus === "success" && (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <div className="text-lg font-medium text-green-700">Import Complete!</div>
                <div className="text-sm text-gray-500">
                  Your stock items have been created successfully.
                </div>
              </div>
            )}

            {importStatus === "error" && (
              <div className="flex flex-col items-center gap-4">
                <AlertCircle className="h-16 w-16 text-red-500" />
                <div className="text-lg font-medium text-red-700">Import Failed</div>
                <div className="text-sm text-red-600">
                  {importErrors.join(", ")}
                </div>
                <Button variant="outline" onClick={() => setStep("preview")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Preview
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
