// Shared ERP Components
// Unified components for consistent design across all modules

// Display Components
export { DocNumberChip } from "./doc-number-chip";
export type { DocType } from "./doc-number-chip";

export { StatusBadge } from "./status-badge";
export type { StatusType } from "./status-badge";

export { MoneyAmount, MoneyInput } from "./money-amount";

export { Timeline, getP2PTimeline } from "./timeline";
export type { TimelineStep, TimelineStatus } from "./timeline";

export { DocLinkPreview, InlineDocLink } from "./doc-link-preview";
export type { LinkedDocument } from "./doc-link-preview";

// List Components
export { DocRow, CompactDocRow } from "./doc-row";
export type { DocRowData } from "./doc-row";

// Filter Components
export { FilterDrawer, FilterButton } from "./filter-drawer";
export type { FilterSection, FilterOption } from "./filter-drawer";

// Search Components
export { SearchInput, useDebouncedSearch } from "./search-input";

// Loading Components
export { 
  EmptyState, 
  Skeleton, 
  ListSkeleton, 
  CardSkeleton, 
  DetailSkeleton,
  PageSkeleton 
} from "./loading-state";

// Import Components
export { SpreadsheetImport } from "./spreadsheet-import";
export type { StockItemField } from "./spreadsheet-import";
