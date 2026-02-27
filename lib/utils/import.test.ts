/**
 * Unit tests for import utilities
 * 
 * Run with: npx vitest run lib/utils/import.test.ts
 * Or: npm test -- lib/utils/import.test.ts (if jest is configured)
 */

import {
  normalizeHeader,
  mapColumn,
  parseNumber,
  parseMoneyToCents,
  parseQuantity,
  validateImportRow,
  normalizeRow,
  generateSkuFromDescription,
} from "./import";

describe("normalizeHeader", () => {
  it("should trim whitespace", () => {
    expect(normalizeHeader("  Description  ")).toBe("description");
  });

  it("should convert to lowercase", () => {
    expect(normalizeHeader("DESCRIPTION")).toBe("description");
  });

  it("should remove special characters", () => {
    expect(normalizeHeader("Unit Price ($)")).toBe("unitprice");
  });

  it("should handle empty string", () => {
    expect(normalizeHeader("")).toBe("");
  });

  it("should handle null/undefined", () => {
    expect(normalizeHeader(null as unknown as string)).toBe("");
    expect(normalizeHeader(undefined as unknown as string)).toBe("");
  });
});

describe("mapColumn", () => {
  it("should map Description variations", () => {
    expect(mapColumn("Description")).toBe("Description");
    expect(mapColumn("description")).toBe("Description");
    expect(mapColumn("desc")).toBe("Description");
    expect(mapColumn("Item Description")).toBe("Description");
    expect(mapColumn("ITEMNAME")).toBe("Description");
  });

  it("should map Quantity variations", () => {
    expect(mapColumn("Quantity")).toBe("Quantity");
    expect(mapColumn("quantity")).toBe("Quantity");
    expect(mapColumn("qty")).toBe("Quantity");
    expect(mapColumn("Qty On Hand")).toBe("Quantity");
    expect(mapColumn("stock")).toBe("Quantity");
  });

  it("should map Unit Price variations", () => {
    expect(mapColumn("Unit Price")).toBe("Unit Price");
    expect(mapColumn("unitprice")).toBe("Unit Price");
    expect(mapColumn("price")).toBe("Unit Price");
    expect(mapColumn("cost")).toBe("Unit Price");
    expect(mapColumn("Unit Cost")).toBe("Unit Price");
  });

  it("should ignore TXDate and TCode", () => {
    expect(mapColumn("TXDate")).toBe("TXDate");
    expect(mapColumn("TCode")).toBe("TCode");
  });

  it("should return null for unrecognized columns", () => {
    expect(mapColumn("unknown")).toBeNull();
    expect(mapColumn("random")).toBeNull();
  });
});

describe("parseNumber", () => {
  it("should parse plain numbers", () => {
    expect(parseNumber("123")).toBe(123);
    expect(parseNumber("0")).toBe(0);
    expect(parseNumber("-5")).toBe(-5);
  });

  it("should parse decimal numbers", () => {
    expect(parseNumber("12.34")).toBe(12.34);
    expect(parseNumber("0.5")).toBe(0.5);
  });

  it("should handle European format (comma as decimal)", () => {
    expect(parseNumber("12,34")).toBe(12.34);
    expect(parseNumber("0,5")).toBe(0.5);
  });

  it("should handle thousand separators", () => {
    expect(parseNumber("1,234")).toBe(1234);
    expect(parseNumber("1,234.56")).toBe(1234.56);
  });

  it("should handle currency symbols", () => {
    expect(parseNumber("R 12.34")).toBe(12.34);
    expect(parseNumber("$12.34")).toBe(12.34);
    expect(parseNumber("R12.34")).toBe(12.34);
  });

  it("should return null for invalid values", () => {
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber(null)).toBeNull();
    expect(parseNumber(undefined)).toBeNull();
  });

  it("should handle numeric input", () => {
    expect(parseNumber(123)).toBe(123);
    expect(parseNumber(12.34)).toBe(12.34);
    expect(parseNumber(NaN)).toBeNull();
  });
});

describe("parseMoneyToCents", () => {
  it("should convert plain numbers to cents", () => {
    expect(parseMoneyToCents("123")).toBe(12300);
    expect(parseMoneyToCents("0")).toBe(0);
  });

  it("should convert decimal numbers to cents", () => {
    expect(parseMoneyToCents("12.34")).toBe(1234);
    expect(parseMoneyToCents("0.5")).toBe(50);
    expect(parseMoneyToCents("0.01")).toBe(1);
  });

  it("should handle European format", () => {
    expect(parseMoneyToCents("12,34")).toBe(1234);
    expect(parseMoneyToCents("0,5")).toBe(50);
  });

  it("should handle currency symbols", () => {
    expect(parseMoneyToCents("R 12.34")).toBe(1234);
    expect(parseMoneyToCents("$12.34")).toBe(1234);
    expect(parseMoneyToCents("R12,34")).toBe(1234);
  });

  it("should round to nearest cent", () => {
    expect(parseMoneyToCents("12.345")).toBe(1235);
    expect(parseMoneyToCents("12.344")).toBe(1234);
  });

  it("should return null for invalid values", () => {
    expect(parseMoneyToCents("")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
    expect(parseMoneyToCents(null)).toBeNull();
  });
});

describe("parseQuantity", () => {
  it("should parse valid quantities", () => {
    expect(parseQuantity("100")).toBe(100);
    expect(parseQuantity("0")).toBe(0);
    expect(parseQuantity("12.5")).toBe(12.5);
  });

  it("should clamp negative values to 0", () => {
    expect(parseQuantity("-5")).toBe(0);
    expect(parseQuantity("-100")).toBe(0);
  });

  it("should return null for invalid values", () => {
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
    expect(parseQuantity(null)).toBeNull();
  });
});

describe("validateImportRow", () => {
  it("should pass valid row", () => {
    const row = {
      Description: "Test Item",
      Quantity: "10",
      "Unit Price": "100.00",
    };
    const result = validateImportRow(row);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail when Description is missing", () => {
    const row = {
      Quantity: "10",
      "Unit Price": "100.00",
    };
    const result = validateImportRow(row);
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe("Description");
  });

  it("should fail when Description is empty", () => {
    const row = {
      Description: "",
      Quantity: "10",
      "Unit Price": "100.00",
    };
    const result = validateImportRow(row);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].message).toContain("required");
  });

  it("should fail when Quantity is invalid", () => {
    const row = {
      Description: "Test Item",
      Quantity: "abc",
      "Unit Price": "100.00",
    };
    const result = validateImportRow(row);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === "Quantity")).toBe(true);
  });

  it("should fail when Unit Price is invalid", () => {
    const row = {
      Description: "Test Item",
      Quantity: "10",
      "Unit Price": "xyz",
    };
    const result = validateImportRow(row);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.field === "Unit Price")).toBe(true);
  });

  it("should allow missing optional fields", () => {
    const row = {
      Description: "Test Item",
    };
    const result = validateImportRow(row);
    expect(result.isValid).toBe(true);
  });
});

describe("normalizeRow", () => {
  it("should normalize column headers", () => {
    const row = {
      "Item Description": "Test Item",
      "Qty": "10",
      "Unit Cost": "100.00",
    };
    const result = normalizeRow(row);
    expect(result["Description"]).toBe("Test Item");
    expect(result["Quantity"]).toBe("10");
    expect(result["Unit Price"]).toBe("100.00");
  });

  it("should handle mixed case headers", () => {
    const row = {
      "DESCRIPTION": "Test",
      "QUANTITY": "5",
    };
    const result = normalizeRow(row);
    expect(result["Description"]).toBe("Test");
    expect(result["Quantity"]).toBe("5");
  });

  it("should ignore unrecognized columns", () => {
    const row = {
      "Description": "Test",
      "Unknown Field": "Value",
    };
    const result = normalizeRow(row);
    expect(result["Description"]).toBe("Test");
    expect(result["Unknown Field"]).toBeUndefined();
  });
});

describe("generateSkuFromDescription", () => {
  it("should generate SKU from description", () => {
    const sku = generateSkuFromDescription("Test Item");
    expect(sku).toMatch(/^TEST-ITEM-[A-Z0-9]{4}[A-Z0-9]{4}$/i);
  });

  it("should handle special characters", () => {
    const sku = generateSkuFromDescription("Test Item @#$%");
    expect(sku).toMatch(/^TEST-ITEM-[A-Z0-9]{4}[A-Z0-9]{4}$/i);
  });

  it("should handle long descriptions", () => {
    const longDesc = "A".repeat(50);
    const sku = generateSkuFromDescription(longDesc);
    expect(sku.length).toBeLessThanOrEqual(42); // 30 + 4 + 4 + hyphens
  });

  it("should produce different SKUs for same description", () => {
    const sku1 = generateSkuFromDescription("Test");
    const sku2 = generateSkuFromDescription("Test");
    // They will have different timestamps
    expect(sku1).not.toBe(sku2);
  });
});
