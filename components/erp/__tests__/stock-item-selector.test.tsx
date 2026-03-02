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
});
