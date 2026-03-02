/**
 * API Tests for Stock Item Search
 */

import { NextRequest } from "next/server";

// Mock the dependencies
jest.mock("@/lib/db", () => ({
  dbConnect: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/auth/session", () => ({
  getSessionClaims: jest.fn(),
}));

jest.mock("@/lib/models/StockItem", () => ({
  find: jest.fn(),
}));

jest.mock("@/lib/models/StockItemUsage", () => ({
  find: jest.fn(),
}));

import { GET } from "../route";
import { StockItem } from "@/lib/models/StockItem";
import { StockItemUsage } from "@/lib/models/StockItemUsage";
import { getSessionClaims } from "@/lib/auth/session";

const mockFind = StockItem.find as jest.Mock;
const mockUsageFind = StockItemUsage.find as jest.Mock;
const mockGetSessionClaims = getSessionClaims as jest.Mock;

describe("GET /api/stock-items/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockRequest = (url: string) => {
    return new NextRequest(new URL(url, "http://localhost"));
  };

  it("returns 401 when not authenticated", async () => {
    mockGetSessionClaims.mockResolvedValue(null);

    const request = createMockRequest("http://localhost/api/stock-items/search");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("enforces company scoping", async () => {
    mockGetSessionClaims.mockResolvedValue({
      userId: "user123",
      companyId: "company123",
    });

    mockFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const request = createMockRequest("http://localhost/api/stock-items/search");
    await GET(request);

    // Verify the query includes companyId
    expect(mockFind).toHaveBeenCalled();
    const callArg = mockFind.mock.calls[0][0];
    expect(callArg.companyId).toBe("company123");
    expect(callArg.isDeleted).toBe(false);
  });

  it("returns limited results when search query provided", async () => {
    mockGetSessionClaims.mockResolvedValue({
      userId: "user123",
      companyId: "company123",
    });

    const mockItems = [
      { _id: "item1", sku: "SKU1", name: "Item 1", unit: "each", pricing: { salePriceCents: 1000 } },
      { _id: "item2", sku: "SKU2", name: "Item 2", unit: "box", pricing: { salePriceCents: 2000 } },
    ];

    mockFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockItems),
          }),
        }),
      }),
    });

    const request = createMockRequest("http://localhost/api/stock-items/search?q=widget");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(2);
  });

  it("returns defaults when query is empty", async () => {
    mockGetSessionClaims.mockResolvedValue({
      userId: "user123",
      companyId: "company123",
    });

    // No usage history
    mockUsageFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    mockFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const request = createMockRequest("http://localhost/api/stock-items/search");
    const response = await GET(request);

    expect(response.status).toBe(200);
    // Should have called usage find to check for recently used
    expect(mockUsageFind).toHaveBeenCalled();
  });

  it("rejects 1-character search queries with 400", async () => {
    mockGetSessionClaims.mockResolvedValue({
      userId: "user123",
      companyId: "company123",
    });

    const request = createMockRequest("http://localhost/api/stock-items/search?q=a");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("returns results with cursor for pagination", async () => {
    mockGetSessionClaims.mockResolvedValue({
      userId: "user123",
      companyId: "company123",
    });

    // Create 20 items to test pagination
    const mockItems = Array.from({ length: 20 }, (_, i) => ({
      _id: `item${i}`,
      sku: `SKU${i}`,
      name: `Item ${i}`,
      unit: "each",
      pricing: { salePriceCents: 1000 },
    }));

    mockFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockItems),
          }),
        }),
      }),
    });

    const request = createMockRequest("http://localhost/api/stock-items/search");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(20);
  });
});
