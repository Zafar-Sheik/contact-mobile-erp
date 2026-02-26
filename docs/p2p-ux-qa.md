# P2P UX QA Checklist

## Mobile Layout (360px Width)

- [ ] No horizontal scrolling on any page
- [ ] Touch targets minimum 44px
- [ ] Text readable without zooming
- [ ] Images/cards scale appropriately
- [ ] No content cutoff at edges

## Navigation & Accessibility

- [ ] Bottom action bars use sticky positioning
- [ ] Buttons reachable with thumb (bottom 20% of screen)
- [ ] Back navigation present on all detail pages
- [ ] Breadcrumb or context visible on detail pages
- [ ] Proper focus states for keyboard navigation

## Status Badges

| Status | Color | Component |
|--------|-------|-----------|
| Draft | Gray | `bg-gray-100 text-gray-800` |
| Pending | Yellow | `bg-yellow-100 text-yellow-800` |
| Submitted/Issued | Blue | `bg-blue-100 text-blue-800` |
| Approved/Posted | Green | `bg-green-100 text-green-800` |
| Paid | Green | `bg-green-100 text-green-800` |
| Cancelled/Voided | Red | `bg-red-100 text-red-800` |
| Overdue | Red | `bg-red-100 text-red-800` |

## Deep Links Flow

### Supplier → PO → GRV → Bill → Payment

```
Supplier Detail
  ↓ (View PO)
PO Detail (with Create GRV action)
  ↓ (Create GRV)
GRV Page (new GRV with PO prefilled)
  ↓ (Create Bill)
Supplier Bill Create (PO/GRV prefilled)
  ↓ (Create Bill)
Bill Detail
  ↓ (Pay Supplier)
Payment Create (Bill prefilled)
  ↓ (Create Payment)
Payment Detail
```

- [ ] Supplier → PO links work
- [ ] PO → GRV flow works
- [ ] PO → Bill flow works  
- [ ] Bill → Payment flow works
- [ ] All prefilled data passes correctly via URL params

## Loading States

- [ ] Skeleton loaders on initial page load
- [ ] Loading indicators on form submissions
- [ ] Disabled buttons during submission
- [ ] Success/error feedback via toast

## Empty States

- [ ] No data message when lists empty
- [ ] Appropriate icons for each entity
- [ ] Action buttons to create first record

## Error States

- [ ] Form validation messages visible
- [ ] API error handling with user-friendly messages
- [ ] Retry options where applicable
- [ ] 404 pages for invalid IDs

## P2P Screens

### Purchase Orders
- [ ] PO List loads with skeletons
- [ ] PO List shows empty state when no POs
- [ ] Click PO card navigates to detail
- [ ] PO Detail shows progress per line
- [ ] PO Detail action bar (Submit/Create GRV/Create Bill)
- [ ] Create Bill navigates with prefilled data

### GRVs
- [ ] GRV List loads
- [ ] GRV Detail shows line items
- [ ] GRV Status badges correct

### Supplier Bills
- [ ] Bill List loads
- [ ] Bill Create (new page) accessible
- [ ] Source selection (PO/GRV/Mixed)
- [ ] Matching panel shows PASS/WARN/FAIL
- [ ] Bill Detail shows timeline

### Supplier Payments
- [ ] Payment List loads
- [ ] Payment Create (new page) accessible
- [ ] Bill selection with checkboxes
- [ ] Allocation input inline
- [ ] Auto-allocate button works
- [ ] Live summary footer updates

## Common Components (components/erp)

- [ ] DocNumberChip renders correctly
- [ ] StatusBadge displays all statuses
- [ ] MoneyAmount formats currency
- [ ] Timeline shows workflow
- [ ] DocRow used in lists
- [ ] FilterDrawer mobile-friendly
- [ ] SearchInput with debounce
- [ ] Skeleton loaders match content layout

## Visual Consistency

- [ ] Consistent padding (16px/1rem standard)
- [ ] Consistent border radius (8px for cards, full for badges)
- [ ] Consistent shadow styles
- [ ] Consistent font sizes
- [ ] Color tokens used consistently

## Testing Checklist

Run through this flow:

1. Open app at 360px width
2. Navigate to Suppliers → Select Supplier
3. Click PO → Verify detail page
4. Click "Create Bill" → Verify prefilled
5. Fill form → Submit
6. Click "Pay Supplier" from bill
7. Verify allocations work
8. Test empty states
9. Test loading states

## Known Issues

_Document any issues found and their resolution._
