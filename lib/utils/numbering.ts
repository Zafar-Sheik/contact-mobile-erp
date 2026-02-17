import { dbConnect } from "@/lib/db";
import { Counter } from "@/lib/models/Counter";

export type DocumentType = "quote" | "invoice" | "payment";

/**
 * Generate a document number using the counter system
 * Quote: Q-YYYY-######
 * Invoice: INV-YYYY-######
 * Payment: SP-YYYY-######
 */
export async function generateDocumentNumber(
  companyId: string,
  type: DocumentType,
  userId?: string
): Promise<string> {
  await dbConnect();
  
  const year = new Date().getFullYear();
  const config = getDocumentConfig(type);
  
  // Find or create counter for this company + type + year
  const counterKey = `${config.key}_${year}`;
  
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
      prefix: config.prefix.replace("YYYY", String(year)),
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
  return `${config.prefix.replace("YYYY", String(year))}${numStr}`;
}

function getDocumentConfig(type: DocumentType) {
  switch (type) {
    case "quote":
      return {
        key: "QTE",
        prefix: "Q-YYYY-",
        padding: 6,
      };
    case "invoice":
      return {
        key: "INV",
        prefix: "INV-YYYY-",
        padding: 6,
      };
    case "payment":
      return {
        key: "SPY",
        prefix: "SP-YYYY-",
        padding: 6,
      };
    default:
      throw new Error(`Unknown document type: ${type}`);
  }
}

/**
 * Parse a document number to extract year and sequence
 */
export function parseDocumentNumber(docNumber: string): {
  prefix: string;
  year: number;
  sequence: number;
} | null {
  const match = docNumber.match(/^([A-Z]+)-(\d{4})-(\d+)$/);
  if (!match) return null;
  
  return {
    prefix: match[1],
    year: parseInt(match[2], 10),
    sequence: parseInt(match[3], 10),
  };
}
