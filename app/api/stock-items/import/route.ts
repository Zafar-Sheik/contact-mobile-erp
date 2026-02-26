import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { StockItem } from "@/lib/models/StockItem";
import { getSessionClaims } from "@/lib/auth/session";
import { Types } from "mongoose";

interface ImportItem {
  name?: string;
  quantity?: number;
  unitPrice?: number;
  description?: string;
  unit?: string;
  barcode?: string;
  manufacturer?: string;
  brand?: string;
  partNumber?: string;
  reorderLevel?: number;
  reorderQuantity?: number;
}

interface ImportResult {
  success: boolean;
  createdCount: number;
  errors: Array<{ row: number; error: string }>;
}

// Generate a unique SKU if not provided
async function generateSku(companyId: string | Types.ObjectId): Promise<string> {
  const count = await StockItem.countDocuments({ companyId });
  const prefix = "SI";
  const timestamp = Date.now().toString(36).toUpperCase();
  const sequence = (count + 1).toString().padStart(4, "0");
  return `${prefix}-${timestamp}-${sequence}`;
}

// Transform flat import data to StockItem model format
function transformToStockItem(item: ImportItem, companyId: string, userId: string) {
  const stockItem: any = {
    companyId: new Types.ObjectId(companyId),
    createdBy: new Types.ObjectId(userId),
    updatedBy: new Types.ObjectId(userId),
    sku: "", // Will be generated
    name: item.name || "Untitled Item",
    description: item.description || "",
    unit: item.unit || "each",
    
    pricing: {
      salePriceCents: 0,
      costPriceCents: Math.round((item.unitPrice || 0) * 100), // Convert to cents
      averageCostCents: Math.round((item.unitPrice || 0) * 100),
      markupPercent: 0,
    },
    
    tax: {
      vatRate: 15,
      isVatExempt: false,
    },
    
    inventory: {
      onHand: item.quantity || 0,
      available: item.quantity || 0,
      reserved: 0,
      reorderLevel: item.reorderLevel || 0,
      reorderQuantity: item.reorderQuantity || 0,
      location: "main",
      binNumber: "",
    },
    
    trackInventory: true,
    trackBatch: false,
    trackSerial: false,
    trackExpiry: false,
    
    supplierId: null,
    siteId: null,
    
    manufacturer: item.manufacturer || "",
    brand: item.brand || "",
    partNumber: item.partNumber || "",
    barcode: item.barcode || "",
    
    dimensions: {
      length: 0,
      width: 0,
      height: 0,
      weight: 0,
      unit: "cm",
    },
    
    isActive: true,
  };
  
  return stockItem;
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    
    const session = await getSessionClaims();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.items)) {
      return NextResponse.json({ error: "Invalid request body. Expected { items: [...] }" }, { status: 400 });
    }

    const items = body.items as ImportItem[];
    
    if (items.length === 0) {
      return NextResponse.json({ error: "No items to import" }, { status: 400 });
    }

    const result: ImportResult = {
      success: true,
      createdCount: 0,
      errors: [],
    };

    // Process each item
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      try {
        // Validate required fields
        if (!item.name || item.name.trim() === "") {
          result.errors.push({ row: i + 1, error: "Name is required" });
          continue;
        }

        // Transform to StockItem format
        const stockItemData = transformToStockItem(item, session.companyId, session.userId);
        
        // Generate SKU
        stockItemData.sku = await generateSku(session.companyId);

        // Check for duplicate SKU if barcode is provided as SKU
        if (item.barcode) {
          const existingWithBarcode = await StockItem.findOne({
            companyId: session.companyId,
            barcode: item.barcode,
            isDeleted: false,
          });
          
          if (existingWithBarcode) {
            result.errors.push({ row: i + 1, error: `Barcode "${item.barcode}" already exists` });
            continue;
          }
        }

        // Create the stock item
        await StockItem.create(stockItemData);
        result.createdCount++;
        
      } catch (error: any) {
        // Handle duplicate key error (SKU)
        if (error.code === 11000) {
          // Regenerate SKU and try once more
          try {
            const retryData = transformToStockItem(item, session.companyId, session.userId);
            retryData.sku = await generateSku(session.companyId);
            await StockItem.create(retryData);
            result.createdCount++;
          } catch (retryError: any) {
            result.errors.push({ row: i + 1, error: retryError.message || "Failed to create item" });
          }
        } else {
          result.errors.push({ row: i + 1, error: error.message || "Failed to create item" });
        }
      }
    }

    // Set success to false if there were any errors
    if (result.errors.length > 0) {
      result.success = false;
    }

    return NextResponse.json({ data: result });
    
  } catch (error: any) {
    console.error("Stock items import error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
