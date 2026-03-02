/**
 * UI Tests for Stock Item Selector Component
 */

import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StockItemSelector, StockItemSelectorTrigger } from "../stock-item-selector";

// Mock the fetch API
global.fetch = jest.fn();

const mockItems = [
  {
    _id: "item1",
    sku: "SKU001",
    name: "Test Widget",
    unit: "each",
    pricing: { salePriceCents: 1999 },
  },
  {
    _id: "item2",
    sku: "SKU002",
    name: "Another Item",
    unit: "box",
    pricing: { salePriceCents: 4999 },
  },
];

describe("StockItemSelector", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe("Modal Behavior", () => {
    it("does not fetch all items on page load - modal closed initially", async () => {
      const onSelect = jest.fn();
      render(
        <StockItemSelector
          open={false}
          onOpenChange={jest.fn()}
          onSelect={onSelect}
        />
      );

      // Wait for any potential fetch
      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    it("fetches items when modal opens", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      const onOpenChange = jest.fn();
      render(
        <StockItemSelector
          open={true}
          onOpenChange={onOpenChange}
          onSelect={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/stock-items/search"),
          expect.any(Object)
        );
      });
    });

    it("shows loading state while fetching", async () => {
      // Create a promise that we can control
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      (global.fetch as jest.Mock).mockReturnValueOnce(fetchPromise);

      const { getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
        />
      );

      expect(getByText("Loading...")).toBeInTheDocument();
    });

    it("closes instantly without waiting for network on selection", async () => {
      const onOpenChange = jest.fn();
      const onSelect = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      const { getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={onOpenChange}
          onSelect={onSelect}
        />
      );

      // Wait for items to load
      await waitFor(() => {
        expect(getByText("Test Widget")).toBeInTheDocument();
      });

      // Click on item
      await act(async () => {
        fireEvent.click(getByText("Test Widget"));
      });

      // Modal should close instantly (synchronously)
      expect(onOpenChange).toHaveBeenCalledWith(false);
      // Then the select callback
      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe("Search Behavior", () => {
    it("shows 'Type at least 2 characters' hint for 1-char search", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [] }),
      });

      const { getByPlaceholderText, getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
        />
      );

      const searchInput = getByPlaceholderText("Search by name or SKU...");
      
      // Type 1 character
      await act(async () => {
        await userEvent.type(searchInput, "a");
      });

      // Should show hint
      expect(getByText("Type at least 2 characters to search")).toBeInTheDocument();
    });

    it("shows 'Search results' label when searching", async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      const { getByPlaceholderText, getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
        />
      );

      const searchInput = getByPlaceholderText("Search by name or SKU...");
      fireEvent.change(searchInput, { target: { value: "test" } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(getByText("Search results")).toBeInTheDocument();
      });

      jest.useRealTimers();
    });

    it("shows 'Recently used' label when not searching", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      const { getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(getByText("Recently used")).toBeInTheDocument();
      });
    });

    it("shows 'Recently purchased' label for purchase mode", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      const { getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
          mode="purchase"
        />
      );

      await waitFor(() => {
        expect(getByText("Recently purchased")).toBeInTheDocument();
      });
    });

    it("passes mode parameter to API", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
          mode="purchase"
        />
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("mode=purchase"),
          expect.any(Object)
        );
      });
    });

    it("returns cost price for purchase mode", async () => {
      const purchaseItems = [
        {
          _id: "item1",
          sku: "SKU001",
          name: "Test Widget",
          unit: "each",
          pricing: { salePriceCents: 1999, costPriceCents: 999 },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: purchaseItems }),
      });

      const onSelect = jest.fn();
      const { getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={onSelect}
          mode="purchase"
        />
      );

      await waitFor(() => {
        expect(getByText("Test Widget")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(getByText("Test Widget"));
      });

      // For purchase mode, should use cost price
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Test Widget" }),
        999 // costPriceCents
      );
    });

    it("returns sale price for invoice mode", async () => {
      const invoiceItems = [
        {
          _id: "item1",
          sku: "SKU001",
          name: "Test Widget",
          unit: "each",
          pricing: { salePriceCents: 1999, costPriceCents: 999 },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: invoiceItems }),
      });

      const onSelect = jest.fn();
      const { getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={onSelect}
          mode="invoice"
        />
      );

      await waitFor(() => {
        expect(getByText("Test Widget")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(getByText("Test Widget"));
      });

      // For invoice mode, should use sale price
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Test Widget" }),
        1999 // salePriceCents
      );
    });

    it("shows 'Select Stock Item for Purchase' title in purchase mode", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      const { getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
          mode="purchase"
        />
      );

      await waitFor(() => {
        expect(getByText("Select Stock Item for Purchase")).toBeInTheDocument();
      });
    });

    it("shows 'Cost' label in purchase mode", async () => {
      const purchaseItems = [
        {
          _id: "item1",
          sku: "SKU001",
          name: "Test Widget",
          unit: "each",
          pricing: { salePriceCents: 1999, costPriceCents: 999 },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: purchaseItems }),
      });

      const { getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
          mode="purchase"
        />
      );

      await waitFor(() => {
        expect(getByText("Cost")).toBeInTheDocument();
      });
    });

    it("shows 'Price' label in invoice mode", async () => {
      const invoiceItems = [
        {
          _id: "item1",
          sku: "SKU001",
          name: "Test Widget",
          unit: "each",
          pricing: { salePriceCents: 1999 },
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: invoiceItems }),
      });

      const { getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
          mode="invoice"
        />
      );

      await waitFor(() => {
        expect(getByText("Price")).toBeInTheDocument();
      });
    });
  });

  describe("Keyboard Navigation", () => {
    it("navigates with arrow keys", async () => {
      const items = [
        { _id: "item1", sku: "SKU1", name: "Item One", unit: "each", pricing: { salePriceCents: 1000 } },
        { _id: "item2", sku: "SKU2", name: "Item Two", unit: "each", pricing: { salePriceCents: 2000 } },
        { _id: "item3", sku: "SKU3", name: "Item Three", unit: "each", pricing: { salePriceCents: 3000 } },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items }),
      });

      const onSelect = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={onSelect}
        />
      );

      await waitFor(() => {
        expect(getByText("Item One")).toBeInTheDocument();
      });

      const searchInput = getByPlaceholderText("Search by name or SKU...");

      // Press arrow down to focus first item
      fireEvent.keyDown(searchInput, { key: "ArrowDown", preventDefault: jest.fn() });
      
      // Press enter to select
      fireEvent.keyDown(searchInput, { key: "Enter", preventDefault: jest.fn() });

      expect(onSelect).toHaveBeenCalled();
    });

    it("closes with escape key", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      const onOpenChange = jest.fn();
      const { getByPlaceholderText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={onOpenChange}
          onSelect={jest.fn()}
        />
      );

      const searchInput = getByPlaceholderText("Search by name or SKU...");
      fireEvent.keyDown(searchInput, { key: "Escape", preventDefault: jest.fn() });

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Highlight Matched Text", () => {
    it("highlights matching text in search results", async () => {
      const searchItems = [
        { _id: "item1", sku: "ABC123", name: "Widget Alpha", unit: "each", pricing: { salePriceCents: 1000 } },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: searchItems }),
      });

      const { getByText, getByPlaceholderText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
        />
      );

      // Wait for initial load
      await waitFor(() => {
        expect(getByText("Widget Alpha")).toBeInTheDocument();
      });

      // Type search query
      const searchInput = getByPlaceholderText("Search by name or SKU...");
      fireEvent.change(searchInput, { target: { value: "Widget" } });

      // Wait for debounce
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        // The highlighted text should be in a mark element
        expect(document.querySelector("mark")).toBeInTheDocument();
      });
    });
  });

  describe("Create New Shortcut", () => {
    it("shows create new button when onCreateNew is provided", async () => {
      const onCreateNew = jest.fn();

      render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
          onCreateNew={onCreateNew}
        />
      );

      // Wait for the button to appear
      await waitFor(() => {
        expect(screen.getByText("Create New Stock Item")).toBeInTheDocument();
      });
    });

    it("calls onCreateNew when create button is clicked", async () => {
      const onCreateNew = jest.fn();

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      const { getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
          onCreateNew={onCreateNew}
        />
      );

      await waitFor(() => {
        expect(getByText("Create New Stock Item")).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(getByText("Create New Stock Item"));
      });

      expect(onCreateNew).toHaveBeenCalled();
    });
  });

  describe("Barcode Scanner", () => {
    it("shows barcode scan button", async () => {
      render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByTitle("Scan barcode")).toBeInTheDocument();
      });
    });
  });

  describe("Responsive Design", () => {
    it("renders within mobile viewport constraints", async () => {
      // Set mobile viewport
      Object.defineProperty(window, "innerWidth", { value: 375, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 667, writable: true });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: mockItems }),
      });

      const { getByText } = render(
        <StockItemSelector
          open={true}
          onOpenChange={jest.fn()}
          onSelect={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(getByText("Select Stock Item")).toBeInTheDocument();
      });

      // Reset viewport
      Object.defineProperty(window, "innerWidth", { value: 1920, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 1080, writable: true });
    });
  });
});

  describe("StockItemSelectorTrigger", () => {
    it("shows 'Select item' button when no selection", () => {
      const { getByText } = render(
        <StockItemSelectorTrigger
          onClick={jest.fn()}
          hasSelection={false}
        />
      );

      expect(getByText("Select item")).toBeInTheDocument();
    });

    it("shows item details when selected", () => {
      const { getByText } = render(
        <StockItemSelectorTrigger
          onClick={jest.fn()}
          hasSelection={true}
          itemName="Test Widget"
          itemSku="SKU001"
          itemUnit="each"
        />
      );

      expect(getByText("Test Widget")).toBeInTheDocument();
      expect(getByText("SKU001 • each")).toBeInTheDocument();
      expect(getByText("Change")).toBeInTheDocument();
    });

    it("calls onClick when clicked", () => {
      const onClick = jest.fn();
      const { getByText } = render(
        <StockItemSelectorTrigger
          onClick={onClick}
          hasSelection={false}
        />
      );

      fireEvent.click(getByText("Select item"));
      expect(onClick).toHaveBeenCalled();
    });
  });
