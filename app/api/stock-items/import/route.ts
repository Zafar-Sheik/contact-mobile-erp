import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";
import { Types } from "mongoose";
import * as XLSX from "xlsx";
import {
  mapColumn,
  normalizeRow,
  validateImportRow,
  parseQuantity,
  parseMoneyToCents,
  generateSkuFromDescription,
} from "@/lib/utils/import";

interface RawRow {
  [key: string]: unknown;
}

interface Failure {
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
  failures: Failure[];
  createdSample: CreatedSample[];
}

// Type for merge mode
type MergeMode = "skip" | "updateBySku";

/**
 * Parses CSV content to array of rows
 */
function parseCSV(content: string): RawRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const normalizedHeaders = headers.map((h) => h.trim());

  const rows: RawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: RawRow = {};
    normalizedHeaders.forEach((header, index) => {
      if (header) {
        row[header] = values[index]?.trim() ?? "";
      }
    });
    if (Object.keys(row).length > 0) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Parses a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

/**
 * Parses XLSX buffer to array of rows
 */
function parseXLSX(buffer: Buffer): RawRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<RawRow>(worksheet);
  return data;
}

/**
 * Transforms a normalized row to StockItem document
 */
function transformToStockItem(
  row: Record<string, unknown>,
  companyId: Types.ObjectId,
  userId: Types.ObjectId
): Record<string, unknown> {
  const description = String(row["Description"] || "").trim();
  const quantity = parseQuantity(row["Quantity"]) ?? 0;
  const unitPriceCents = parseMoneyToCents(row["Unit Price"]) ?? 0;

  const sku = generateSkuFromDescription(description);

  return {
    companyId,
    sku,
    name: description,
    description: description,
    unit: "each",
    pricing: {
      salePriceCents: unitPriceCents,
      costPriceCents: unitPriceCents,
      averageCostCents: unitPriceCents,
      markupPercent: 0,
    },
    tax: {
      vatRate: 15,
      isVatExempt: false,
    },
    inventory: {
      onHand: quantity,
      available: quantity,
      reserved: 0,
      reorderLevel: 0,
      reorderQuantity: 0,
      location: "main",
      binNumber: "",
    },
    trackInventory: true,
    trackBatch: false,
    trackSerial: false,
    trackExpiry: false,
    supplierId: null,
    siteId: null,
    manufacturer: "",
    brand: "",
    partNumber: "",
    barcode: "",
    dimensions: {
      length: 0,
      width: 0,
      height: 0,
      weight: 0,
      unit: "cm",
    },
    isActive: true,
    createdBy: userId,
    updatedBy: userId,
  };
}

/**
 * Updates an existing stock item with new values (for merge mode)
 */
async function updateStockItem(
  itemId: Types.ObjectId,
  row: Record<string, unknown>,
  userId: Types.ObjectId
): Promise<void> {
  const quantity = parseQuantity(row["Quantity"]) ?? 0;
  const unitPriceCents = parseMoneyToCents(row["Unit Price"]) ?? 0;
  const description = String(row["Description"] || "").trim();

  await StockItem.findByIdAndUpdate(
    itemId,
    {
      $set: {
        "inventory.onHand": quantity,
        "inventory.available": quantity,
        "pricing.costPriceCents": unitPriceCents,
        "pricing.averageCostCents": unitPriceCents,
        name: description,
        description: description,
        updatedBy: userId,
      },
    },
    { strict: false }
  );
}

export async function POST(req: Request) {
  try {
    await dbConnect();

    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query params
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dryRun") === "true";
    const mergeModeParam = url.searchParams.get("mergeMode");
    const mergeMode: MergeMode = mergeModeParam === "updateBySku" ? "updateBySku" : "skip";

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded. Please provide a file with field name 'file'." },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith(".csv");
    const isXLSX = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCSV && !isXLSX) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a CSV or XLSX file." },
        { status: 400 }
      );
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse file based on type
    let rawRows: RawRow[];
    if (isCSV) {
      const content = buffer.toString("utf-8");
      rawRows = parseCSV(content);
    } else {
      rawRows = parseXLSX(buffer);
    }

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: "The file contains no data rows." },
        { status: 400 }
      );
    }

    // Normalize column headers
    const normalizedRows = rawRows.map((row) => normalizeRow(row));

    // Process each row
    const failures: Failure[] = [];
    const validItems: Array<{
      data: Record<string, unknown>;
      rawRow: Record<string, unknown>;
      rowNumber: number;
      sku: string;
    }> = [];

    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      const rowNumber = i + 2;

      const validation = validateImportRow(row);
      if (!validation.isValid) {
        failures.push({
          rowNumber,
          reason: validation.errors.map((e) => e.message).join("; "),
          rawRow: row,
        });
        continue;
      }

      // Generate SKU for this item
      const sku = generateSkuFromDescription(
        String(row["Description"] || "")
      );

      validItems.push({
        data: row,
        rawRow: row,
        rowNumber,
        sku,
      });
    }

    // Get companyId and userId as ObjectIds
    const companyId = new Types.ObjectId(session.companyId);
    const userId = new Types.ObjectId(session.userId);

    // Track results
    const created: Array<{ sku: string; name: string; _id?: Types.ObjectId }> = [];
    const updated: Array<{ sku: string; name: string }> = [];
    const skippedDuplicates: Array<{ rowNumber: number; sku: string }> = [];

    // Process items
    if (validItems.length > 0 && !dryRun) {
      // Not a dry run - actually create/update items
      if (mergeMode === "updateBySku") {
        // Merge mode: Update existing items or create new ones
        for (const item of validItems) {
          try {
            // Check if item exists
            const existing = await StockItem.findOne({
              companyId,
              sku: item.sku,
              isDeleted: false,
            });

            if (existing) {
              // Update existing item
              await updateStockItem(existing._id, item.data, userId);
              updated.push({ sku: item.sku, name: String(item.data["Description"]) });
            } else {
              // Create new item
              const stockItemData = transformToStockItem(item.data, companyId, userId);
              const createdItem = await StockItem.create(stockItemData);
              created.push({ sku: createdItem.sku, name: createdItem.name, _id: createdItem._id });
            }
          } catch (error) {
            failures.push({
              rowNumber: item.rowNumber,
              reason: error instanceof Error ? error.message : "Failed to process item",
              rawRow: item.rawRow,
            });
          }
        }
      } else {
        // Skip mode: Only create new items, skip duplicates
        // First, get all existing SKUs for this company
        const existingItems = await StockItem.find({
          companyId,
          sku: { $in: validItems.map((i) => i.sku) },
          isDeleted: false,
        }).select("sku").lean();

        const existingSkus = new Set(existingItems.map((e) => e.sku));

        // Separate items to create vs skip
        const itemsToCreate = validItems.filter((item) => !existingSkus.has(item.sku));
        const itemsToSkip = validItems.filter((item) => existingSkus.has(item.sku));

        // Track skipped items
        for (const item of itemsToSkip) {
          skippedDuplicates.push({
            rowNumber: item.rowNumber,
            sku: item.sku,
          });
          failures.push({
            rowNumber: item.rowNumber,
            reason: `SKU "${item.sku}" already exists for this company`,
            rawRow: item.rawRow,
          });
        }

        // Create new items
        if (itemsToCreate.length > 0) {
          const stockItemsToCreate = itemsToCreate.map((item) =>
            transformToStockItem(item.data, companyId, userId)
          );

          let inserted: Array<{ sku: string; name: string; _id: Types.ObjectId }> = [];

          try {
            const result = await StockItem.insertMany(stockItemsToCreate, {
              ordered: false,
            });
            inserted = Array.isArray(result) ? result : [result];
          } catch (error: unknown) {
            const err = error as { mongoose?: { results?: Array<{ sku: string; name: string }> } };
            if (err.mongoose?.results) {
              inserted = err.mongoose.results as typeof inserted;
            }
          }

          for (const item of inserted) {
            created.push({ sku: item.sku, name: item.name, _id: item._id });
          }
        }
      }
    } else if (dryRun) {
      // Dry run mode - just validate what would be created/updated
      if (mergeMode === "updateBySku") {
        // In dry run with update mode, check what would be created vs updated
        const existingItems = await StockItem.find({
          companyId,
          sku: { $in: validItems.map((i) => i.sku) },
          isDeleted: false,
        }).select("sku").lean();

        const existingSkus = new Set(existingItems.map((e) => e.sku));

        const wouldUpdate = validItems.filter((item) => existingSkus.has(item.sku));
        const wouldCreate = validItems.filter((item) => !existingSkus.has(item.sku));

        // Add counts to result (wouldCreateCount, wouldUpdateCount)
        for (const item of wouldUpdate) {
          updated.push({ sku: item.sku, name: String(item.data["Description"]) });
        }
        for (const item of wouldCreate) {
          created.push({ sku: item.sku, name: String(item.data["Description"]) });
        }
      } else {
        // In dry run with skip mode
        const existingItems = await StockItem.find({
          companyId,
          sku: { $in: validItems.map((i) => i.sku) },
          isDeleted: false,
        }).select("sku").lean();

        const existingSkus = new Set(existingItems.map((e) => e.sku));

        const itemsToSkip = validItems.filter((item) => existingSkus.has(item.sku));
        const itemsToCreate = validItems.filter((item) => !existingSkus.has(item.sku));

        for (const item of itemsToSkip) {
          skippedDuplicates.push({
            rowNumber: item.rowNumber,
            sku: item.sku,
          });
          failures.push({
            rowNumber: item.rowNumber,
            reason: `SKU "${item.sku}" already exists (would be skipped)`,
            rawRow: item.rawRow,
          });
        }

        for (const item of itemsToCreate) {
          created.push({ sku: item.sku, name: String(item.data["Description"]) });
        }
      }
    }

    // Prepare response
    const response: ImportResult = {
      skippedCount: skippedDuplicates.length,
      failedCount: failures.length,
      failures: failures.map((f) => ({
        rowNumber: f.rowNumber,
        reason: f.reason,
        rawRow: f.rawRow,
      })),
      createdSample: [],
    };

    // Add counts based on mode
    if (dryRun) {
      response.wouldCreateCount = created.length;
      response.wouldUpdateCount = updated.length;
    } else {
      response.createdCount = created.length;
      response.updatedCount = updated.length;
    }

    // Get sample of created items
    const sampleItems = created.slice(0, 10);
    if (sampleItems.length > 0) {
      const createdItems = await StockItem.find({
        companyId,
        sku: { $in: sampleItems.map((c) => c.sku) },
      })
        .select("_id sku name")
        .lean();

      response.createdSample = sampleItems.map((item) => {
        const found = createdItems.find((c) => c.sku === item.sku);
        return {
          id: found ? String(found._id) : "",
          sku: item.sku,
          name: item.name,
        };
      });
    }

    // Add updated items to sample as well
    if (updated.length > 0) {
      const updatedItems = await StockItem.find({
        companyId,
        sku: { $in: updated.slice(0, 5).map((u) => u.sku) },
      })
        .select("_id sku name")
        .lean();

      for (const item of updated.slice(0, 5)) {
        const found = updatedItems.find((u) => u.sku === item.sku);
        if (found) {
          response.createdSample.push({
            id: String(found._id),
            sku: item.sku,
            name: found.name,
          });
        }
      }
    }

    // Cap sample at 10
    response.createdSample = response.createdSample.slice(0, 10);

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Stock items import error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
