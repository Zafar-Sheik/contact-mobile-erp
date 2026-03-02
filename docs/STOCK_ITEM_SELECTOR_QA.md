# Stock Item Selector - QA Checklist

## Automated Tests (Run with Jest)

### API Tests
```bash
# Test stock-items search endpoint
npx jest app/api/stock-items/search
```

#### Test Cases:
- [ ] **Authentication**: Returns 401 when not authenticated
- [ ] **Company Scoping**: Query includes companyId filter
- [ ] **Search with Query**: Returns limited results when `q` param provided
- [ ] **Empty Query**: Returns defaults (recently used items or sorted list)
- [ ] **Rate Limiting**: Returns 429 after 30 requests/minute
- [ ] **Min Query Length**: Returns 400 for 1-character search
- [ ] **Max Limit**: Caps results at 50 items
- [ ] **Cursor Pagination**: Returns proper pagination structure

### Unit Tests (Line Item Validation)
```bash
# Test line item validation
npx jest lib/utils/line-item-validation
```

#### Test Cases:
- [ ] **Line Total Recomputation**: Server recomputes `lineTotalCents` from formula
- [ ] **Stock Item Validation**: Validates stockItemId exists and belongs to company
- [ ] **Snapshot Auto-fill**: Auto-fills snapshots from stock item

---

## Manual QA Checklist

### Performance Tests (180k Items Scenario)

#### API Performance
- [ ] **Search Response Time**: < 500ms for search query
- [ ] **Empty Query Response**: < 500ms when returning recent/defaults
- [ ] **Rate Limiting**: 30 req/min enforced, returns 429 after limit

#### Page Load Performance
- [ ] **No Pre-fetch**: Modal does NOT fetch items on page load
- [ ] **Initial Load Time**: Quote/Invoice form loads fast without stock items

### UI/UX Tests

#### Modal Behavior
- [ ] **Open Modal**: Click "Select item" opens modal instantly
- [ ] **Initial Load**: Modal shows "Recently used" section on first open
- [ ] **Loading State**: Shows "Loading..." while fetching
- [ ] **Empty State**: Shows "No stock items available" when none exist
- [ ] **Search Hint**: Shows "Type at least 2 characters" for 1-char input

#### Search Functionality
- [ ] **Debounce**: No API calls while typing (300ms delay)
- [ ] **Search Label**: Shows "Search results" when typing
- [ ] **Results Display**: Shows name, SKU, unit, and price
- [ ] **Selection**: Clicking item closes modal and updates form

#### Line Item Updates
- [ ] **Single Line Update**: Selecting item updates only that line
- [ ] **Auto-fill**: Name, SKU, unit auto-filled from stock item
- [ ] **Price**: Unit price populated from stock item pricing
- [ ] **Quantity**: Keeps existing qty or sets to 1 if empty
- [ ] **Change Action**: "Change" button reopens modal
- [ ] **Clear Action**: X button clears selected item

### Form Validation Tests

#### Quote Form
- [ ] **Submit Without Item**: Shows "Please select a stock item" error
- [ ] **Valid Submit**: Successfully creates quote with line items
- [ ] **Totals**: Subtotal, VAT, Total calculated correctly

#### Invoice Form
- [ ] **Submit Without Item**: Shows "Please select a stock item" error
- [ ] **Valid Submit**: Successfully creates invoice with line items
- [ ] **Totals**: Subtotal, VAT, Total calculated correctly

### Network Simulation Tests

#### Slow Network
- [ ] **Loading State**: Shows loading indicator during fetch
- [ ] **Cancel Request**: Closing modal cancels pending request (instant close)
- [ ] **Error Handling**: Shows error message on failure

#### Offline/Error States
- [ ] **Network Error**: Shows "Failed to fetch items" message
- [ ] **Retry**: Can retry after error

### Mobile Responsiveness

#### Modal Layout
- [ ] **Full Screen**: Modal usable on mobile (max-w-md, scrollable)
- [ ] **Touch Targets**: Search input and items have adequate touch targets
- [ ] **Close Button**: X button accessible on mobile
- [ ] **Scroll**: Long list of items scrollable

### Visual Checkpoints

1. **Empty State**: "Select item" button with dashed border
2. **Selected State**: Shows item name, SKU, unit with "Change" button
3. **Search Active**: Clear X button appears in search input
4. **Results**: Items display with price in green
5. **Validation Error**: Red text "Please select a stock item"

---

## Quick Test Script (Manual)

```bash
# 1. Open browser DevTools -> Network tab
# 2. Navigate to /quotes/new
# 3. Verify NO network requests to /api/stock-items

# 4. Click "Select item" on first line
# 5. Verify request to /api/stock-items/search
# 6. Verify "Recently used" label shown

# 7. Type "wid" in search
# 8. Wait 300ms
# 9. Verify request includes ?q=wid

# 10. Click an item
# 11. Verify modal closes instantly
# 12. Verify form shows item details

# 13. Try to submit without selecting item
# 14. Verify error message appears

# 15. Select item
# 16. Submit form
# 17. Verify quote created with correct totals
```

---

## Test Data Setup

For testing with large datasets (180k items):

```javascript
// Create test company with 180k stock items
// Run in MongoDB shell:
use contact-erp-test;

db.companies.insertOne({ 
  name: "Test Company", 
  _id: ObjectId("000000000000000000000001") 
});

// Generate 180k items
const items = [];
for (let i = 0; i < 180000; i++) {
  items.push({
    companyId: ObjectId("000000000000000000000001"),
    name: `Item ${i}`,
    sku: `SKU${String(i).padStart(6, '0')}`,
    unit: "each",
    pricing: { salePriceCents: Math.floor(Math.random() * 10000) },
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  if (items.length === 1000) {
    db.stockItems.insertMany(items);
    items.length = 0;
  }
}
if (items.length > 0) db.stockItems.insertMany(items);
```
