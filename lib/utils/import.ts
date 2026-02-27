/**
 * Stock Item Import Utilities
 * 
 * Provides functions for parsing and validating CSV/XLSX import data
 */

/**
 * Normalizes a header string to a canonical form for mapping
 * - Trims whitespace
 * - Converts to lowercase
 * - Removes special characters (keeping underscores for snake_case)
 * - Removes underscores for cleaner matching
 * 
 * @param header - The raw header string from CSV/XLSX
 * @returns Normalized header string
 */
export function normalizeHeader(header: string): string {
  if (!header || typeof header !== 'string') return '';
  
  return header
    .trim()
    .toLowerCase()
    .replace(/[^\w]/g, '') // Remove all non-word characters (keeps underscores)
    .replace(/_/g, '') // Remove underscores
    .trim();
}

/**
 * Column mapping configuration for stock item import
 * Maps normalized headers to field names
 */
export const COLUMN_MAPPING: Record<string, string> = {
  // Description variations
  'description': 'Description',
  'desc': 'Description',
  'itemdescription': 'Description',
  'itemdesc': 'Description',
  'name': 'Description',
  'itemname': 'Description',
  'productname': 'Description',
  'productdescription': 'Description',
  'item': 'Description',
  'product': 'Description',
  'stockitem': 'Description',
  'stockitemname': 'Description',
  'goodsdescription': 'Description',
  'goods': 'Description',
  
  // Quantity variations
  'quantity': 'Quantity',
  'qty': 'Quantity',
  'quantities': 'Quantity',
  'qtyonhand': 'Quantity',
  'stock': 'Quantity',
  'stockquantity': 'Quantity',
  'onhand': 'Quantity',
  'onhandqty': 'Quantity',
  'available': 'Quantity',
  'availableqty': 'Quantity',
  'count': 'Quantity',
  'units': 'Quantity',
  
  // Unit Price variations
  'unitprice': 'Unit Price',
  'price': 'Unit Price',
  'unitcost': 'Unit Price',
  'cost': 'Unit Price',
  'costprice': 'Unit Price',
  'priceperunit': 'Unit Price',
  'rate': 'Unit Price',
  'unitrate': 'Unit Price',
  'sellingprice': 'Unit Price',
  'purchaseprice': 'Unit Price',
  'supplyprice': 'Unit Price',
  
  // TXDate - to be ignored
  'txdate': 'TXDate',
  'date': 'TXDate',
  'transactiondate': 'TXDate',
  'txdatetime': 'TXDate',
  'docdate': 'TXDate',
  'postingdate': 'TXDate',
  
  // TCode - to be ignored
  'tcode': 'TCode',
  'code': 'TCode',
  'transactioncode': 'TCode',
  'txcode': 'TCode',
  'documentcode': 'TCode',
  'docno': 'TCode',
  'docnum': 'TCode',
};

/**
 * Maps a normalized header to the expected field name
 * 
 * @param header - The raw header string
 * @returns The mapped field name or null if not recognized
 */
export function mapColumn(header: string): string | null {
  const normalized = normalizeHeader(header);
  return COLUMN_MAPPING[normalized] || null;
}

/**
 * Parses a string to a number, handling various formats
 * 
 * @param value - The value to parse
 * @returns Parsed number or null if invalid
 */
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }
  
  if (typeof value !== 'string') {
    return null;
  }
  
  // Remove whitespace
  let trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  
  // Remove currency symbols and other non-numeric characters (except . , - +)
  // Keep digits, decimal point, comma, minus, plus
  const numericPart = trimmed.replace(/[^0-9.,\-+]/g, '');
  
  // If nothing left after removing non-numeric, it's invalid
  if (numericPart === '') {
    return null;
  }
  
  // Handle European format (comma as decimal separator)
  // If string contains comma and no dot, check if it's thousand separator (3 digits after) or decimal
  let normalized = numericPart;
  if (numericPart.includes(',') && !numericPart.includes('.')) {
    // Check if comma is thousand separator: 1,234 or 12,345 etc.
    // Thousand separators have exactly 3 digits after the comma
    const commaIndex = numericPart.indexOf(',');
    const afterComma = numericPart.substring(commaIndex + 1);
    
    if (/^\d{3}$/.test(afterComma)) {
      // Thousand separator: 1,234 -> 1234
      normalized = numericPart.replace(/,/g, '');
    } else {
      // Treat as decimal: 12,34 -> 12.34
      normalized = numericPart.replace(',', '.');
    }
  } else if (numericPart.includes(',') && numericPart.includes('.')) {
    // Both present - figure out which is decimal
    const lastComma = numericPart.lastIndexOf(',');
    const lastDot = numericPart.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Comma is decimal separator: 1.234,56 -> 1234.56
      normalized = numericPart.replace(/\./g, '').replace(',', '.');
    } else {
      // Dot is decimal separator: 1,234.56 -> 1234.56
      normalized = numericPart.replace(/,/g, '');
    }
  }
  
  const parsed = Number(normalized);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Parses a currency string to cents
 * Supports formats:
 * - Plain numbers: "1234" -> 123400
 * - Decimal: "12.34" -> 1234
 * - With currency symbol: "R 12.34", "$12.34" -> 1234
 * - European decimal: "12,34" -> 1234
 * - With thousand separators: "1,234.56" -> 123456
 * 
 * @param value - The currency value to parse
 * @returns Value in cents, or null if invalid
 */
export function parseMoneyToCents(value: unknown): number | null {
  const num = parseNumber(value);
  if (num === null) {
    return null;
  }
  
  // Round to 2 decimal places and convert to cents
  return Math.round(num * 100);
}

/**
 * Parses and validates quantity, clamping to >= 0
 * 
 * @param value - The quantity value to parse
 * @returns Parsed quantity (>= 0) or null if invalid
 */
export function parseQuantity(value: unknown): number | null {
  const num = parseNumber(value);
  if (num === null) {
    return null;
  }
  
  // Clamp to >= 0
  return Math.max(0, num);
}

/**
 * Generates a SKU from description
 * Creates a slug-like string + short hash for uniqueness
 * 
 * @param description - The item description
 * @returns Generated SKU string
 */
export function generateSkuFromDescription(description: string): string {
  // Create slug from description
  const slug = description
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, 30); // Limit length
  
  // Add short hash for uniqueness
  const hash = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
  
  return `${slug || 'ITEM'}-${timestamp}${hash}`.toUpperCase();
}

/**
 * Validates a row of import data
 * 
 * @param row - The row data as key-value pairs
 * @returns Object with isValid flag and errors array
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
}

export function validateImportRow(row: Record<string, unknown>): ValidationResult {
  const errors: Array<{ field: string; message: string }> = [];
  
  // Check Description is required
  const description = row['Description'];
  if (!description || typeof description !== 'string' || description.trim() === '') {
    errors.push({ field: 'Description', message: 'Description is required' });
  }
  
  // Validate Quantity if provided
  const quantity = row['Quantity'];
  if (quantity !== undefined && quantity !== '' && parseQuantity(quantity) === null) {
    errors.push({ field: 'Quantity', message: 'Invalid quantity value' });
  }
  
  // Validate Unit Price if provided
  const unitPrice = row['Unit Price'];
  if (unitPrice !== undefined && unitPrice !== '' && parseMoneyToCents(unitPrice) === null) {
    errors.push({ field: 'Unit Price', message: 'Invalid unit price value' });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Parses a raw row from CSV/XLSX to normalized format
 * 
 * @param rawRow - Raw row data
 * @returns Normalized row with canonical column names
 */
export function normalizeRow(rawRow: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(rawRow)) {
    const mappedColumn = mapColumn(key);
    if (mappedColumn) {
      normalized[mappedColumn] = value;
    }
  }
  
  return normalized;
}
