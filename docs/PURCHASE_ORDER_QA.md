# Purchase Order Item Selection - QA Checklist

## Manual QA Checklist

### Performance & Scalability

- [ ] **180k items scenario remains responsive**
  - Open the Stock Item Selector modal on a company with 180,000+ stock items
  - Verify the modal opens within 2 seconds
  - Verify typing in the search box doesn't freeze the UI
  - Verify scrolling through results is smooth

- [ ] **No memory spikes**
  - Open and close the Stock Item Selector multiple times
  - Monitor browser memory usage
  - Verify memory doesn't continuously grow

- [ ] **Slow network handling**
  - Throttle network to "Slow 3G" in browser dev tools
  - Open the Stock Item Selector
  - Verify loading indicator is shown
  - Verify the UI remains responsive while loading

### Mobile Usability

- [ ] **Modal fits mobile screen**
  - Open the Stock Item Selector on a mobile device or narrow viewport
  - Verify the modal is scrollable and doesn't overflow the screen
  - Verify touch targets are large enough (44px minimum)

- [ ] **Search works on mobile**
  - Open the Stock Item Selector on mobile
  - Type in the search box
  - Verify the keyboard doesn't cover the search results

### Functional Tests

- [ ] **Selecting item updates correct line only**
  - Create a PO with multiple line items
  - Open the Stock Item Selector for line 2
  - Select an item
  - Verify only line 2 is updated, not lines 1 or 3

- [ ] **Changing item updates snapshots**
  - Select an item for a line
  - Note the item name, SKU, and unit
  - Open the selector again and select a different item
  - Verify the line now shows the new item details

- [ ] **Clearing item works**
  - Select an item for a line
  - Use the clear/remove button to remove the item
  - Verify the line is cleared and ready for new selection

- [ ] **Cannot submit without stockItemId**
  - Create a PO with a line that has quantity but no stock item
  - Attempt to submit the PO
  - Verify validation error阻止s submission

- [ ] **Recently purchased items appear first (purchase mode)**
  - Create several POs with different stock items
  - Open a new PO
  - Open the Stock Item Selector without typing
  - Verify recently purchased items appear at the top

- [ ] **Cost price used in purchase mode**
  - Create a new PO
  - Select a stock item
  - Verify the unit price shows the cost price (not sale price)

- [ ] **Sale price used in invoice/quote mode**
  - Create a new Invoice or Quote
  - Select a stock item
  - Verify the unit price shows the sale price (not cost price)

### Edge Cases

- [ ] **Empty search results**
  - Search for a non-existent item
  - Verify "No items found" message is shown

- [ ] **No recent items**
  - Create a new company with no PO history
  - Create a new PO
  - Open the Stock Item Selector
  - Verify appropriate empty state is shown

- [ ] **Network error handling**
  - Disconnect network or cause API error
  - Open the Stock Item Selector
  - Verify error message is displayed
  - Verify retry option works

- [ ] **Rate limiting**
  - Make many rapid searches
  - Verify rate limit error is shown after threshold

## API Test Commands

Run the test suite:
```bash
npm test -- --testPathPattern="stock-items/search"
npm test -- --testPathPattern="stock-item-selector"
```

## Known Limitations

- Text search requires minimum 2 characters
- Search results are limited to 50 items per request
- Recent items list is limited to 20 items
