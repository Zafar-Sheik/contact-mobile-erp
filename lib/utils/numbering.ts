import { dbConnect } from "@/lib/db";
import { Counter } from "@/lib/models/Counter";

/**
 * Document types for the system
 */
export type DocumentType = 
  | "quote" 
  | "invoice" 
  | "payment"
  | "po"        // Purchase Order
  | "grv"       // Goods Received Voucher
  | "bill"      // Supplier Bill
  | "supplier_payment"; // Supplier Payment

/**
 * Document type configuration
 */
interface DocumentConfig {
  key: string;
  prefix: string;
  padding: number;
}

/**
 * Get configuration for a document type
 */
function getDocumentConfig(type: DocumentType): DocumentConfig {
  const configs: Record<DocumentType, DocumentConfig> = {
    quote: {
      key: "QTE",
      prefix: "Q-YYYY-",
      padding: 6,
    },
    invoice: {
      key: "INV",
      prefix: "INV-YYYY-",
      padding: 6,
    },
    payment: {
      key: "SPY",
      prefix: "SP-YYYY-",
      padding: 6,
    },
    // P2P Document Types
    po: {
      key: "PO",
      prefix: "PO-",
      padding: 6,  // PO-000123
    },
    grv: {
      key: "GRV",
      prefix: "GRV-",
      padding: 6,  // GRV-000456
    },
    bill: {
      key: "BILL",
      prefix: "BILL-",
      padding: 6,  // BILL-000789
    },
    supplier_payment: {
      key: "PAY",
      prefix: "PAY-",
      padding: 6,  // PAY-000321
    },
  };
  
  return configs[type];
}

/**
 * Generate a document number using the counter system
 * 
 * Format examples:
 * - Quote: Q-2024-000001
 * - Invoice: INV-2024-000001
 * - Payment: SP-2024-000001
 * - PO: PO-000123
 * - GRV: GRV-000456
 * - Bill: BILL-000789
 * - Payment: PAY-000321
 */
export async function generateDocumentNumber(
  companyId: string,
  type: DocumentType,
  userId?: string
): Promise<string> {
  await dbConnect();
  
  const config = getDocumentConfig(type);
  
  // Check if this type uses year-based numbering
  const usesYearPrefix = type === "quote" || type === "invoice" || type === "payment";
  
  let counterKey: string;
  let prefix: string;
  
  if (usesYearPrefix) {
    const year = new Date().getFullYear();
    counterKey = `${config.key}_${year}`;
    prefix = config.prefix.replace("YYYY", String(year));
  } else {
    // P2P documents use simple sequential numbering without year
    counterKey = config.key;
    prefix = config.prefix;
  }
  
  // Find or create counter for this company + type
  let counter = await Counter.findOne({
    companyId,
    key: counterKey,
    isDeleted: false,
  });
  
  if (!counter) {
    // Create new counter
    counter = await Counter.create({
      companyId,
      key: counterKey,
      nextNumber: 1,
      prefix,
      padding: config.padding,
      createdBy: userId,
      updatedBy: userId,
    });
  }
  
  // Get next number and increment atomically
  const nextNum = counter.nextNumber;
  await Counter.updateOne(
    { _id: counter._id },
    { $inc: { nextNumber: 1 } }
  );
  
  // Format: PREFIX-NNNNNN
  const numStr = String(nextNum).padStart(config.padding, "0");
  return `${prefix}${numStr}`;
}

/**
 * Parse a document number to extract components
 * Supports both year-based and simple formats
 */
export function parseDocumentNumber(docNumber: string): {
  prefix: string;
  year?: number;
  sequence: number;
  type?: DocumentType;
} | null {
  // Try year-based format first: Q-2024-000001, INV-2024-000001
  const yearBasedMatch = docNumber.match(/^([A-Z]+)-(\d{4})-(\d+)$/);
  if (yearBasedMatch) {
    return {
      prefix: yearBasedMatch[1],
      year: parseInt(yearBasedMatch[2], 10),
      sequence: parseInt(yearBasedMatch[3], 10),
    };
  }
  
  // Try P2P format: PO-000123, GRV-000456, BILL-000789, PAY-000321
  const p2pMatch = docNumber.match(/^([A-Z]+)-(\d+)$/);
  if (p2pMatch) {
    const typeMap: Record<string, DocumentType> = {
      "PO": "po",
      "GRV": "grv",
      "BILL": "bill",
      "PAY": "supplier_payment",
    };
    
    return {
      prefix: p2pMatch[1],
      sequence: parseInt(p2pMatch[2], 10),
      type: typeMap[p2pMatch[1]],
    };
  }
  
  return null;
}

/**
 * Validate document number format
 */
export function isValidDocumentNumber(
  docNumber: string,
  expectedType?: DocumentType
): boolean {
  const parsed = parseDocumentNumber(docNumber);
  
  if (!parsed) return false;
  
  if (expectedType) {
    const config = getDocumentConfig(expectedType);
    const expectedPrefix = expectedType === "po" || expectedType === "grv" || 
                          expectedType === "bill" || expectedType === "supplier_payment"
      ? config.prefix.replace("-", "")
      : config.prefix.replace("-YYYY-", "");
    
    if (parsed.prefix !== expectedPrefix) {
      return false;
    }
  }
  
  return parsed.sequence > 0;
}

/**
 * Get next sequence number without incrementing (for preview)
 */
export async function peekNextNumber(
  companyId: string,
  type: DocumentType
): Promise<string> {
  await dbConnect();
  
  const config = getDocumentConfig(type);
  const usesYearPrefix = type === "quote" || type === "invoice" || type === "payment";
  
  let counterKey: string;
  let prefix: string;
  
  if (usesYearPrefix) {
    const year = new Date().getFullYear();
    counterKey = `${config.key}_${year}`;
    prefix = config.prefix.replace("YYYY", String(year));
  } else {
    counterKey = config.key;
    prefix = config.prefix;
  }
  
  let counter = await Counter.findOne({
    companyId,
    key: counterKey,
    isDeleted: false,
  });
  
  const nextNum = counter?.nextNumber || 1;
  const numStr = String(nextNum).padStart(config.padding, "0");
  return `${prefix}${numStr}`;
}

/**
 * Reset counter (use with caution - for testing/administration only)
 */
export async function resetCounter(
  companyId: string,
  type: DocumentType,
  newStartValue: number = 1
): Promise<void> {
  await dbConnect();
  
  const config = getDocumentConfig(type);
  const usesYearPrefix = type === "quote" || type === "invoice" || type === "payment";
  
  let counterKey: string;
  
  if (usesYearPrefix) {
    const year = new Date().getFullYear();
    counterKey = `${config.key}_${year}`;
  } else {
    counterKey = config.key;
  }
  
  await Counter.findOneAndUpdate(
    { companyId, key: counterKey },
    { $set: { nextNumber: newStartValue } },
    { upsert: true }
  );
}
