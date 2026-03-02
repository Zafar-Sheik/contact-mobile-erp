import { dbConnect } from "@/lib/db";
import { StockItem } from "@/lib/models/StockItem";
import { Types } from "mongoose";

export interface LineItemInput {
  lineNo: number;
  stockItemId?: string | null;
  skuSnapshot?: string;
  nameSnapshot?: string;
  descriptionSnapshot?: string;
  unitSnapshot?: string;
  qty: number;
  unitPriceCents: number;
  discountCents?: number;
  taxable?: boolean;
  lineTotalCents: number;
}

export interface ValidatedLineItem extends Omit<LineItemInput, 'stockItemId' | 'discountCents' | 'taxable' | 'lineTotalCents'> {
  stockItemId: Types.ObjectId | null;
  objectId: Types.ObjectId;
  discountCents: number;
  taxable: boolean;
  lineTotalCents: number;
}

/**
 * Validates and sanitizes a line item.
 * If stockItemId is provided, validates it exists and belongs to the company.
 * Returns the validated line item with proper ObjectId conversion.
 */
export async function validateLineItem(
  lineItem: LineItemInput,
  companyId: string,
  options: { requireStockItem?: boolean } = {}
): Promise<ValidatedLineItem> {
  const { requireStockItem = false } = options;
  
  // Validate required fields
  if (!lineItem.lineNo || lineItem.lineNo < 1) {
    throw new Error("Line number is required and must be at least 1");
  }
  
  if (typeof lineItem.qty !== "number" || lineItem.qty < 0) {
    throw new Error("Quantity is required and must be a positive number");
  }
  
  if (typeof lineItem.unitPriceCents !== "number" || lineItem.unitPriceCents < 0) {
    throw new Error("Unit price is required and must be a positive number");
  }
  
  // Convert stockItemId to ObjectId if provided
  let stockItemObjectId: Types.ObjectId | null = null;
  
  if (lineItem.stockItemId) {
    if (!Types.ObjectId.isValid(lineItem.stockItemId)) {
      throw new Error("Invalid stockItemId format");
    }
    
    stockItemObjectId = new Types.ObjectId(lineItem.stockItemId);
    
    // Validate stock item exists and belongs to company
    await dbConnect();
    const stockItem = await StockItem.findOne({
      _id: stockItemObjectId,
      companyId: new Types.ObjectId(companyId),
      isDeleted: false,
    });
    
    if (!stockItem) {
      throw new Error("Stock item not found or does not belong to your company");
    }
    
    // Auto-fill snapshots from stock item if not provided
    // This ensures historical accuracy - snapshots capture the state at time of selection
    const skuSnapshot = lineItem.skuSnapshot || stockItem.sku;
    const nameSnapshot = lineItem.nameSnapshot || stockItem.name;
    const descriptionSnapshot = lineItem.descriptionSnapshot || stockItem.description || "";
    const unitSnapshot = lineItem.unitSnapshot || stockItem.unit;
    
    // If unitPriceCents was not explicitly set (0 or not provided), use the stock item's sale price
    const unitPriceCents = lineItem.unitPriceCents === 0 && stockItem.pricing?.salePriceCents
      ? stockItem.pricing.salePriceCents
      : lineItem.unitPriceCents;
    
    // Compute line total from validated values (server-side safety)
    const computedLineTotal = (lineItem.qty * unitPriceCents) - (lineItem.discountCents || 0);

    return {
      lineNo: lineItem.lineNo,
      skuSnapshot,
      nameSnapshot,
      descriptionSnapshot,
      unitSnapshot,
      qty: lineItem.qty,
      unitPriceCents,
      discountCents: lineItem.discountCents || 0,
      taxable: lineItem.taxable !== false,
      lineTotalCents: computedLineTotal,
      stockItemId: stockItemObjectId,
      objectId: new Types.ObjectId(),
    };
  }
  
  // No stock item - validate that at least name or description is provided for custom items
  if (requireStockItem) {
    throw new Error("stockItemId is required");
  }
  
  // For custom line items (no stock item), ensure we have a name
  if (!lineItem.nameSnapshot && !lineItem.descriptionSnapshot) {
    throw new Error("Either nameSnapshot or descriptionSnapshot is required for custom line items");
  }
  
  // Compute line total from validated values (server-side safety)
  const computedLineTotal = (lineItem.qty * lineItem.unitPriceCents) - (lineItem.discountCents || 0);

  return {
    lineNo: lineItem.lineNo,
    skuSnapshot: lineItem.skuSnapshot || "",
    nameSnapshot: lineItem.nameSnapshot || "",
    descriptionSnapshot: lineItem.descriptionSnapshot || "",
    unitSnapshot: lineItem.unitSnapshot || "each",
    qty: lineItem.qty,
    unitPriceCents: lineItem.unitPriceCents,
    discountCents: lineItem.discountCents || 0,
    taxable: lineItem.taxable !== false,
    lineTotalCents: computedLineTotal,
    stockItemId: null,
    objectId: new Types.ObjectId(),
  };
}

/**
 * Validates an array of line items.
 * If stockItemId is provided in any line item, validates it exists and belongs to the company.
 */
export async function validateLineItems(
  lineItems: LineItemInput[],
  companyId: string,
  options: { requireStockItem?: boolean } = {}
): Promise<ValidatedLineItem[]> {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    throw new Error("At least one line item is required");
  }
  
  const validatedItems: ValidatedLineItem[] = [];
  
  for (let i = 0; i < lineItems.length; i++) {
    const item = lineItems[i];
    try {
      const validated = await validateLineItem(item, companyId, options);
      validatedItems.push(validated);
    } catch (error) {
      throw new Error(`Line ${i + 1}: ${error instanceof Error ? error.message : "Invalid line item"}`);
    }
  }
  
  return validatedItems;
}

/**
 * Calculates line totals based on quantity, unit price, and discount.
 * This ensures consistency between what's stored and what's calculated.
 */
export function calculateLineTotal(
  qty: number,
  unitPriceCents: number,
  discountCents: number = 0,
  taxable: boolean = true
): { subtotal: number; discount: number; total: number } {
  const subtotal = qty * unitPriceCents;
  const discount = discountCents;
  const total = Math.max(0, subtotal - discount);
  
  return { subtotal, discount, total };
}
