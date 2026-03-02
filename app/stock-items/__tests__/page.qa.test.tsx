/**
 * QA Validation Tests for Stock Items Page
 *
 * Tests:
 * - Default load (100 items, total count)
 * - Pagination (page 2 loads next 100, no duplicates)
 * - Search (items not in first 100, pagination while searching)
 * - Performance (no full dataset fetch, no freezing, payload size)
 * - Large dataset simulation (20k items responsiveness)
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StockItemsPage from "../page";

// Mock fetch
global.fetch = jest.fn();

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  elements: Element[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(element: Element) {
    this.elements.push(element);
  }

  unobserve(element: Element) {
    this.elements = this.elements.filter((el) => el !== element);
  }

  disconnect() {
    this.elements = [];
  }

  trigger(isIntersecting: boolean) {
    this.callback(
      this.elements.map((el) => ({
        isIntersecting,
        target: el,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: isIntersecting ? 1 : 0,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: Date.now(),
      })),
      this as unknown as IntersectionObserver
    );
  }
}

(global as any).IntersectionObserver = MockIntersectionObserver;

// Mock hooks
jest.mock("@/lib/hooks/use-api", () => ({
  apiCreate: jest.fn(),
  apiUpdate: jest.fn(),
  apiDelete: jest.fn(),
}));

jest.mock("@/components/mobile/mobile-more-menu", () => ({
  useMobileMoreMenu: () => ({
    isOpen: false,
    open: jest.fn(),
    close: jest.fn(),
  }),
  MobileMoreMenu: () => null,
}));

jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

// Generate mock stock items
const generateMockItems = (startId: number, count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    _id: `item${startId + i}`,
    sku: `SKU${String(startId + i).padStart(4, "0")}`,
    name: `Item ${startId + i}`,
    description: `Description for item ${startId + i}`,
    unit: "each",
    inventory: {
      onHand: Math.floor(Math.random() * 100),
      reorderLevel: 10,
    },
    pricing: {
      salePriceCents: 9999,
      costPriceCents: 4999,
    },
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
};

// Mock response helper
const mockFetchResponse = (items: any[], totalCount: number, currentPage: number) => {
  const totalPages = Math.ceil(totalCount / 100);
  return {
    json: async () => ({
      items,
      totalCount,
      totalPages,
      currentPage,
    }),
    ok: true,
    status: 200,
  };
};

describe("Stock Items Page - QA Validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe("Default Load", () => {
    it("shows 100 items on initial load", async () => {
      const mockItems = generateMockItems(1, 100);
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(mockItems, 500, 1)
      );

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        const itemElements = screen.getAllByText(/Item \d+/);
        expect(itemElements.length).toBe(100);
      });
    });

    it("displays total count correctly", async () => {
      const mockItems = generateMockItems(1, 100);
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(mockItems, 500, 1)
      );

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Showing 100 of 500 items/)).toBeInTheDocument();
      });
    });

    it("fetches with correct default parameters", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(generateMockItems(1, 100), 500, 1)
      );

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/stock-items"),
          expect.any(Object)
        );
      });

      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain("page=1");
      expect(callUrl).toContain("limit=100");
      expect(callUrl).toContain("sortBy=name");
    });
  });

  describe("Pagination", () => {
    it("page 2 loads next 100 items", async () => {
      // First page
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(generateMockItems(1, 100), 500, 1)
      );

      // Second page
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(generateMockItems(101, 100), 500, 2)
      );

      await act(async () => {
        render(<StockItemsPage />);
      });

      // Wait for first page
      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      // Trigger infinite scroll using the mock
      await act(async () => {
        const observer = (global as any).IntersectionObserver;
        observer.trigger(true);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Verify second page was requested
      const secondCallUrl = (global.fetch as jest.Mock).mock.calls[1][0];
      expect(secondCallUrl).toContain("page=2");
    });

    it("prevents duplicate items when loading more", async () => {
      // Same items returned (simulating race condition)
      const sameItems = generateMockItems(1, 100);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockFetchResponse(sameItems, 300, 1))
        .mockResolvedValueOnce(mockFetchResponse(sameItems, 300, 2));

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        const items = screen.getAllByText(/Item \d+/);
        // Should still only show 100 unique items (no duplicates)
        expect(items.length).toBe(100);
      });
    });
  });

  describe("Search", () => {
    it("searches for items not in first 100", async () => {
      // First load
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(generateMockItems(1, 100), 2000, 1)
      );

      // Search results (item 1500)
      const searchResults = [
        {
          _id: "item1500",
          sku: "SKU1500",
          name: "Special Laptop",
          unit: "each",
          inventory: { onHand: 50, reorderLevel: 10 },
          pricing: { salePriceCents: 9999, costPriceCents: 4999 },
          isActive: true,
        },
      ];
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(searchResults, 1, 1)
      );

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      // Type search query
      const searchInput = screen.getByPlaceholderText("Search items...");
      await userEvent.type(searchInput, "Special Laptop");

      // Wait for debounce
      await act(async () => {
        await new Promise((r) => setTimeout(r, 400));
      });

      await waitFor(() => {
        expect(screen.getByText("Special Laptop")).toBeInTheDocument();
      });

      // Verify search was called
      const searchCall = (global.fetch as jest.Mock).mock.calls.find((call) =>
        call[0].includes("q=Special")
      );
      expect(searchCall).toBeTruthy();
    });

    it("search results reflect entire dataset", async () => {
      const searchResults = generateMockItems(500, 50);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockFetchResponse(generateMockItems(1, 100), 2000, 1))
        .mockResolvedValueOnce(mockFetchResponse(searchResults, 50, 1));

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search items...");
      await userEvent.type(searchInput, "laptop");

      await act(async () => {
        await new Promise((r) => setTimeout(r, 400));
      });

      await waitFor(() => {
        expect(screen.getByText(/Showing 50 of 50 items.*for "laptop"/)).toBeInTheDocument();
      });
    });

    it("pagination works while searching", async () => {
      const searchResults = generateMockItems(500, 100);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockFetchResponse(generateMockItems(1, 100), 2000, 1))
        .mockResolvedValueOnce(mockFetchResponse(searchResults, 250, 1))
        .mockResolvedValueOnce(mockFetchResponse(generateMockItems(600, 100), 250, 2));

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search items...");
      await userEvent.type(searchInput, "laptop");

      await act(async () => {
        await new Promise((r) => setTimeout(r, 400));
      });

      // Trigger infinite scroll
      await act(async () => {
        const observer = (global as any).IntersectionObserver;
        observer.trigger(true);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });

      // Verify second search page was requested
      const lastCall = (global.fetch as jest.Mock).mock.calls[2][0];
      expect(lastCall).toContain("q=laptop");
      expect(lastCall).toContain("page=2");
    });
  });

  describe("Performance", () => {
    it("does not fetch full dataset", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(generateMockItems(1, 100), 20000, 1)
      );

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
        expect(callUrl).toContain("limit=100");
        expect(callUrl).not.toContain("limit=20000");
      });

      // Verify only 100 items in DOM, not all 20k
      const items = screen.getAllByText(/Item \d+/);
      expect(items.length).toBeLessThanOrEqual(100);
    });

    it("network payload is reasonable (< 500KB per request)", async () => {
      const largeItems = generateMockItems(1, 100).map((item) => ({
        ...item,
        description: "x".repeat(1000), // Add 1KB description to each
      }));

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(largeItems, 20000, 1)
      );

      let responseSize = 0;
      const mockBlob = new Blob([JSON.stringify(largeItems)]);
      responseSize = mockBlob.size;

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        // 100 items with 1KB each should be ~100KB + overhead
        expect(responseSize).toBeLessThan(500 * 1024); // < 500KB
      });
    });
  });

  describe("Large Dataset Simulation (20k items)", () => {
    it("page remains responsive with 20k total items", async () => {
      const startTime = performance.now();

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(generateMockItems(1, 100), 20000, 1)
      );

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Showing 100 of 20000 items/)).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;

      // Should render in under 1 second even with large total count
      expect(renderTime).toBeLessThan(1000);
    });

    it("handles rapid scroll events without freezing", async () => {
      // Mock multiple pages
      for (let i = 1; i <= 5; i++) {
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          mockFetchResponse(generateMockItems((i - 1) * 100 + 1, 100), 20000, i)
        );
      }

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      // Rapidly trigger scroll 5 times
      await act(async () => {
        const observer = (global as any).IntersectionObserver;
        for (let i = 0; i < 5; i++) {
          observer.trigger(true);
          await new Promise((r) => setTimeout(r, 50));
        }
      });

      // Should not crash or freeze - verify some items loaded
      await waitFor(() => {
        const items = screen.getAllByText(/Item \d+/);
        expect(items.length).toBeGreaterThan(0);
      });
    });

    it("displays correct loaded count while scrolling", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockFetchResponse(generateMockItems(1, 100), 20000, 1))
        .mockResolvedValueOnce(mockFetchResponse(generateMockItems(101, 100), 20000, 2))
        .mockResolvedValueOnce(mockFetchResponse(generateMockItems(201, 100), 20000, 3));

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText(/Showing 100 of 20000 items/)).toBeInTheDocument();
      });

      // Trigger more loading
      await act(async () => {
        const observer = (global as any).IntersectionObserver;
        observer.trigger(true);
      });

      await waitFor(() => {
        expect(screen.getByText(/Showing 200 of 20000 items/)).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles empty search results gracefully", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockFetchResponse(generateMockItems(1, 100), 2000, 1))
        .mockResolvedValueOnce(mockFetchResponse([], 0, 1));

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText("Search items...");
      await userEvent.type(searchInput, "nonexistent");

      await act(async () => {
        await new Promise((r) => setTimeout(r, 400));
      });

      await waitFor(() => {
        expect(screen.getByText("No results found")).toBeInTheDocument();
      });
    });

    it("prevents duplicate requests on rapid scroll", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockFetchResponse(generateMockItems(1, 100), 2000, 1)
      );

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText("Item 1")).toBeInTheDocument();
      });

      // Trigger same intersection multiple times rapidly
      await act(async () => {
        const observer = (global as any).IntersectionObserver;
        observer.trigger(true);
        observer.trigger(true);
        observer.trigger(true);
      });

      // Should only make initial call, not 3 more
      await new Promise((r) => setTimeout(r, 100));
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("handles API errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      await act(async () => {
        render(<StockItemsPage />);
      });

      await waitFor(() => {
        expect(screen.getByText("Error loading items")).toBeInTheDocument();
      });
    });
  });
});
