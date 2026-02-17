/**
 * Shared utilities for calculating document totals
 * Used by Quotes, Invoices, and other sales documents
 */

export type VatMode = "exclusive" | "inclusive" | "none";

export interface LineItem {
  qty: number;
  unitPriceCents: number;
  discountCents: number;
  taxable: boolean;
  lineTotalCents?: number;
}

export interface DocumentTotals {
  subTotalCents: number;
  vatTotalCents: number;
  totalCents: number;
}

/**
 * Calculate the total for a single line item
 * Formula: (qty * unitPriceCents) - discountCents
 */
export function calculateLineTotal(
  qty: number,
  unitPriceCents: number,
  discountCents: number
): number {
  const baseTotal = qty * unitPriceCents;
  const total = baseTotal - discountCents;
  return Math.max(0, total); // Ensure non-negative
}

/**
 * Calculate line totals for an array of lines
 * Also calculates subtotal, VAT, and grand total
 */
export function calculateLineTotals<T extends LineItem>(
  lines: T[]
): (T & { lineTotalCents: number })[] {
  return lines.map((line) => ({
    ...line,
    lineTotalCents: calculateLineTotal(line.qty, line.unitPriceCents, line.discountCents),
  }));
}

/**
 * Calculate document totals (subtotal, VAT, total) based on lines and VAT settings
 * 
 * @param lines - Array of line items
 * @param vatRateBps - VAT rate in basis points (1500 = 15%)
 * @param vatMode - VAT mode: 'exclusive' (add VAT on top), 'inclusive' (VAT included), 'none' (no VAT)
 */
export function calculateDocumentTotals(
  lines: LineItem[],
  vatRateBps: number = 1500,
  vatMode: VatMode = "exclusive"
): DocumentTotals {
  // Calculate subtotal from line totals
  let subTotalCents = 0;
  let vatTotalCents = 0;
  
  for (const line of lines) {
    const lineTotal = calculateLineTotal(line.qty, line.unitPriceCents, line.discountCents);
    subTotalCents += lineTotal;
    
    // Calculate VAT for taxable lines
    if (line.taxable && vatMode !== "none") {
      if (vatMode === "exclusive") {
        // VAT is calculated on top of the line total
        const vatAmount = Math.round((lineTotal * vatRateBps) / 10000);
        vatTotalCents += vatAmount;
      } else if (vatMode === "inclusive") {
        // VAT is included in the line total, extract it
        // Formula: VAT = total - (total / (1 + rate))
        const vatAmount = Math.round(lineTotal - (lineTotal * 10000) / (10000 + vatRateBps));
        vatTotalCents += vatAmount;
      }
    }
  }
  
  // Calculate grand total based on VAT mode
  let totalCents: number;
  if (vatMode === "inclusive") {
    // Total includes VAT (already in subtotal)
    totalCents = subTotalCents;
  } else {
    // Total is subtotal plus VAT
    totalCents = subTotalCents + vatTotalCents;
  }
  
  return {
    subTotalCents,
    vatTotalCents,
    totalCents,
  };
}

/**
 * Format cents to currency string (e.g., "R1,234.56")
 */
export function formatCurrency(cents: number): string {
  // Handle negative amounts
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  
  // Convert cents to rands
  const rands = absCents / 100;
  
  // Format with thousand separators and 2 decimal places
  const formatted = rands.toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return isNegative ? `-R${formatted}` : `R${formatted}`;
}

/**
 * Parse a currency string to cents
 * Handles formats like "R1,234.56", "1234.56", "R1234"
 */
export function parseCurrency(input: string): number | null {
  if (!input || typeof input !== "string") {
    return null;
  }
  
  // Remove currency symbol, whitespace, and thousand separators
  let cleaned = input.trim();
  
  // Remove R, ZAR, currency symbol, and whitespace
  cleaned = cleaned.replace(/[R$ZAR\s]/gi, "");
  
  // Remove thousand separators (commas in en-ZA format)
  cleaned = cleaned.replace(/,/g, "");
  
  // Handle negative amounts
  const isNegative = cleaned.startsWith("-");
  if (isNegative) {
    cleaned = cleaned.substring(1);
  }
  
  // Parse as float
  const number = parseFloat(cleaned);
  
  if (isNaN(number)) {
    return null;
  }
  
  // Convert to cents (multiply by 100 and round)
  const cents = Math.round(number * 100);
  
  return isNegative ? -cents : cents;
}

/**
 * Calculate the balance due for an invoice
 */
export function calculateBalanceDue(
  totalCents: number,
  amountPaidCents: number
): number {
  return Math.max(0, totalCents - amountPaidCents);
}

/**
 * Check if an invoice is overdue
 */
export function isOverdue(dueDate: Date, status: string): boolean {
  if (status === "paid" || status === "cancelled" || status === "draft") {
    return false;
  }
  return new Date() > dueDate;
}

/**
 * Calculate days until due or days overdue
 */
export function getDaysUntilDue(dueDate: Date): number {
  const now = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Format VAT rate from basis points to percentage string
 */
export function formatVatRateBps(vatRateBps: number): string {
  const percentage = vatRateBps / 100;
  return `${percentage.toFixed(2)}%`;
}

/**
 * Parse VAT rate percentage to basis points
 */
export function parseVatRateToBps(percentage: number): number {
  return Math.round(percentage * 100);
}
