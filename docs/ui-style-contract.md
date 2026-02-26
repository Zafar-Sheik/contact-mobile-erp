# UI Style Contract

This document defines the visual and interaction design system for the Contact Mobile ERP. All new UI implementations must adhere to these specifications to maintain visual cohesion.

---

## 1. Design Tokens

### Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--background` | `#fafafa` | `#09090b` | Page background |
| `--foreground` | `#0f0f0f` | `#fafafa` | Primary text |
| `--card` | `#ffffff` | `#18181b` | Card backgrounds |
| `--card-foreground` | `#0f0f0f` | `#fafafa` | Card text |
| `--primary` | `#4f46e5` | `#6366f1` | Primary actions, FAB |
| `--primary-hover` | `#4338ca` | `#818cf8` | Primary hover state |
| `--primary-foreground` | `#ffffff` | `#ffffff` | Text on primary |
| `--secondary` | `#f4f4f5` | `#27272a` | Secondary surfaces |
| `--muted` | `#f4f4f5` | `#27272a` | Muted backgrounds |
| `--muted-foreground` | `#71717a` | `#a1a1aa` | Secondary text |
| `--accent` | `#f4f4f5` | `#27272a` | Hover states |
| `--border` | `#e4e4e7` | `#3f3f46` | Borders |
| `--input` | `#e4e4e7` | `#3f3f46` | Input borders |
| `--ring` | `#4f46e5` | `#6366f1` | Focus rings |

#### Status Colors

| Status | Background | Text |
|--------|------------|------|
| Success | `#ecfdf5` / `#064e3b` | `#10b981` / `#34d399` |
| Warning | `#fffbeb` / `#78350f` | `#f59e0b` / `#fbbf24` |
| Info | `#eff6ff` / `#1e3a8a` | `#3b82f6` / `#60a5fa` |
| Destructive | `#fef2f2` / `#7f1d1d` | `#ef4444` / `#f87171` |

---

## 2. Typography

### Font Family
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

### Scale
| Size | Class | Usage |
|------|-------|-------|
| 2xl (24px) | `text-2xl` | Page titles |
| xl (20px) | N/A | Not used |
| lg (18px) | N/A | Not used |
| base (16px) | `text-base` | Body text |
| sm (14px) | `text-sm` | Secondary text, labels |
| xs (12px) | `text-xs` | Badges, captions |

### Font Weights
- Regular: `font-normal` (400)
- Medium: `font-medium` (500)
- Semibold: `font-semibold` (600)
- Bold: `font-bold` (700)

---

## 3. Spacing Scale

Based on 4px grid. Use Tailwind spacing utilities:

| Token | Value | Usage |
|-------|-------|-------|
| `px-1` | 4px | Tight spacing |
| `px-2` | 8px | Icon gaps |
| `px-3` | 12px | Card padding (compact) |
| `px-4` | 16px | Standard padding |
| `px-6` | 24px | Section spacing |
| `py-2` | 8px | Small vertical |
| `py-3` | 12px | List item vertical |
| `py-4` | 16px | Standard vertical |

---

## 4. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | 12px (0.75rem) | Cards, modals |
| `--radius-md` | 10px | Buttons |
| `--radius-sm` | 8px | Inputs, badges |

### Component-Specific
- **Cards**: `rounded-xl` (12px)
- **Buttons**: `rounded-md` (8px)
- **Inputs**: `rounded-md` (8px)
- **Badges**: `rounded-full` (pill)
- **FAB**: `rounded-full` (56px diameter)

---

## 5. Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Subtle elevation |
| `--shadow` | `0 1px 3px 0 rgb(0 0 0 / 0.1)` | Default card |
| `--shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1)` | Hover cards |
| `--shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1)` | Modals, FAB |

### Card Shadow Classes
```tsx
// Default card
"rounded-xl border border-border/50 bg-card shadow-sm"

// Interactive card (hover)
"rounded-xl border border-border/50 bg-card shadow-sm hover:shadow-md hover:border-border"
```

---

## 6. Mobile-First Breakpoints

The app uses mobile-first responsive design:

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Default | < 640px | Mobile view (primary) |
| `md` | ≥ 640px | Tablet |
| `lg` | ≥ 1024px | Desktop sidebar |

### Mobile-Only Utilities
```css
.hide-mobile { /* shown on desktop only */ }
.hide-desktop { /* shown on mobile only */ }
.mobile-only { display: block !important; }
.desktop-only { display: none !important; }
```

### Touch Targets
- **Minimum**: 44px height for all interactive elements
- **FAB**: 56px diameter (h-14 w-14)
- **List items**: min-h-[72px] with 12px vertical padding
- **Buttons**: h-10 (40px) minimum, h-11 (44px) for large

---

## 7. Component Library

### Core Components (`components/ui/`)

| Component | File | Usage |
|-----------|------|-------|
| Button | `button.tsx` | Actions, links |
| Card | `card.tsx` | Content containers |
| Badge | `badge.tsx` | Status indicators |
| Input | `input.tsx` | Text fields |
| Select | `select.tsx` | Dropdowns |
| Dialog | `dialog.tsx` | Modals |
| AlertDialog | `alert-dialog.tsx` | Confirmations |
| Tabs | `tabs.tsx` | Section switching |
| Table | `table.tsx` | Data tables |
| Skeleton | `skeleton.tsx` | Loading states |
| Toast | `toast.tsx` | Notifications |

### Mobile Components (`components/mobile/`)

| Component | File | Usage |
|-----------|------|-------|
| MobileCard | `mobile-card.tsx` | Mobile-optimized cards |
| MobileCardHeader | `mobile-card.tsx` | Card header section |
| MobileCardContent | `mobile-card.tsx` | Card body section |
| MobileCardFooter | `mobile-card.tsx` | Card footer section |
| MobileCardCompact | `mobile-card.tsx` | Dense card variant |
| MobileListItem | `mobile-list-item.tsx` | List rows with avatar |
| MobileList | `mobile-list.tsx` | List container |
| PageHeader | `page-header.tsx` | Page title + actions |
| PageHeaderCompact | `page-header.tsx` | Compact sub-header |
| Fab | `fab.tsx` | Floating action button |
| BottomSheet | `bottom-sheet.tsx` | Bottom drawer |
| BottomTabBar | `bottom-tab-bar.tsx` | Tab navigation |
| MobileMoreMenu | `mobile-more-menu.tsx` | Action menu |
| EmptyState | `empty-state.tsx` | No data view |
| SearchBar | `search-bar.tsx` | Search input |
| Section | `section.tsx` | Content grouping |
| MobileShell | `mobile-shell.tsx` | App shell wrapper |

---

## 8. Component Patterns

### Button Variants

```tsx
import { Button, buttonVariants } from "@/components/ui/button"

// Variants
<Button variant="default">Primary</Button>        // --primary bg
<Button variant="destructive">Danger</Button>     // --destructive bg
<Button variant="outline">Outline</Button>        // border + bg
<Button variant="secondary">Secondary</Button>   // --secondary bg
<Button variant="ghost">Ghost</Button>           // transparent
<Button variant="link">Link</Button>              // underline

// Sizes
<Button size="default">Default</Button>          // h-10 px-4
<Button size="sm">Small</Button>                   // h-9 px-3
<Button size="lg">Large</Button>                   // h-11 px-8
<Button size="icon">Icon</Button>                 // h-10 w-10
```

### Badge Variants

```tsx
import { Badge } from "@/components/ui/badge"

<Badge variant="default">Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Destructive</Badge>
<Badge variant="outline">Outline</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="info">Info</Badge>
```

### Mobile Card Pattern

```tsx
import { MobileCard, MobileCardHeader, MobileCardContent, MobileCardFooter } from "@/components/mobile/mobile-card"

<MobileCard>
  <MobileCardHeader>
    <h3 className="font-semibold">Title</h3>
  </MobileCardHeader>
  <MobileCardContent>
    <p>Content here</p>
  </MobileCardContent>
  <MobileCardFooter>
    <Button>Action</Button>
  </MobileCardFooter>
</MobileCard>
```

### Mobile List Item Pattern

```tsx
import { MobileListItem } from "@/components/mobile/mobile-list-item"

<MobileListItem
  title="Item Title"
  subtitle="Subtitle text"
  description="Optional description"
  avatar={{
    src?: string,
    icon?: <Icon />,
    fallback?: "AB"
  }}
  status={{
    label: "Status",
    variant: "success" // | "warning" | "destructive" | "info" | "default"
  }}
  showChevron={true}
  onClick={() => handleClick()}
/>
```

### Page Header Pattern

```tsx
import { PageHeader } from "@/components/mobile/page-header"

<PageHeader
  title="Page Title"
  subtitle="Optional subtitle"
  showBackButton={true}
  onBack={() => router.back()}
  primaryAction={{
    label: "Add New",
    icon: <Plus className="h-4 w-4" />,
    onClick: () => setOpen(true)
  }}
  onFilter={() => handleFilter()}
  onSearch={() => handleSearch()}
/>
```

### FAB Pattern

```tsx
import { Fab } from "@/components/mobile/fab"

<Fab
  href="/route/new"
  label="Create new item"
  visible={true}
  bottomOffset="80px"  // Above tab bar
/>

// With expandable menu
<Fab
  items={[
    { label: "Option 1", icon: Icon1, href: "/path1" },
    { label: "Option 2", icon: Icon2, onClick: () => {} }
  ]}
  onClick={() => {}}
/>
```

---

## 9. Layout Patterns

### Mobile Shell Layout

```tsx
import MobileShell from "@/components/mobile/mobile-shell"
import { useRouter } from "next/navigation"

export default function Page() {
  const router = useRouter()
  
  return (
    <MobileShell
      headerProps={{
        title: "Page Title",
        showMenuButton: true,
        onMenuClick: () => router.back()
      }}
      showTabBar={true}
      showFab={true}
      fabProps={{ href: "/new" }}
    >
      {/* Page content */}
    </MobileShell>
  )
}
```

### Main Layout (Auto-switching)

```tsx
import MainLayout from "@/components/layout/main-layout"

export default function Page() {
  return (
    <MainLayout
      title="Page Title"
      showBackButton={true}
      showFab={true}
      fabProps={{ href: "/new" }}
    >
      {/* Page content */}
    </MainLayout>
  )
}
```

### Content Spacing

```tsx
// Standard page content padding
<div className="px-4 pb-20">
  {/* pb-20 accounts for FAB + tab bar */}
</div>

// With sticky header
<div className="pt-safe px-4 pb-20">
  <PageHeader sticky title="Title" />
</div>

// Scrollable content area
<ScrollArea className="h-[calc(100vh-200px)]">
  {/* Content */}
</ScrollArea>
```

---

## 10. Animations

### Built-in Animations

```css
.animate-slideIn  /* 0.3s - Sidebar, modals */
.animate-fadeIn   /* 0.3s - Fade in */
.animate-scaleIn  /* 0.2s - FAB menu */
.animate-slideUp  /* 0.3s - Bottom sheets */
.animate-pulse    /* 2s infinite - Loading */
.animate-spin     /* 1s infinite - Spinners */
.animate-bounce   /* 1s infinite - FAB hover */
```

### Transition Classes

```tsx
// Default transitions (200ms)
<Card className="transition-all duration-200">
  <Button className="transition-all duration-200">
  <Input className="transition-all duration-200">
  
// Active states
<Button className="active:scale-[0.98]">
<Card className="active:scale-[0.99]">
```

---

## 11. Accessibility

### Focus States
All interactive elements have visible focus rings:
```css
*:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

### Touch Targets
- Minimum 44x44px for all interactive elements
- 48x48px preferred for primary actions

### ARIA
- Use `aria-label` on icon-only buttons
- Use `role="button"` on interactive divs
- Use proper heading hierarchy (h1 → h2 → h3)

---

## 12. Common Patterns

### Loading State
```tsx
{isLoading ? (
  <div className="space-y-3">
    <MobileListItemSkeleton />
    <MobileListItemSkeleton />
  </div>
) : (
  <div>
    {items.map(item => (
      <MobileListItem key={item.id} title={item.name} onClick={() => {}} />
    ))}
  </div>
)}
```

### Empty State
```tsx
import EmptyState from "@/components/mobile/empty-state"

<EmptyState
  icon={<Package className="h-12 w-12" />}
  title="No items"
  description="Get started by creating your first item."
  action={{
    label: "Add Item",
    onClick: () => {}
  }}
/>
```

### Status Badge Helper
```tsx
const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: BadgeVariant }> = {
    Draft: { label: "Draft", variant: "secondary" },
    Issued: { label: "Issued", variant: "info" },
    PartiallyReceived: { label: "Partial", variant: "warning" },
    FullyReceived: { label: "Complete", variant: "success" },
    Cancelled: { label: "Cancelled", variant: "destructive" },
  }
  return map[status] || { label: status, variant: "default" }
}
```

### Currency Formatting (ZAR)
```tsx
const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(cents / 100)
}
```

### Date Formatting
```tsx
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
```

---

## 13. Tailwind Conventions

### Class Ordering (Prettier/Eslint enforced)
1. Layout (display, flex, grid, position)
2. Sizing (width, height, min/max)
3. Spacing (padding, margin, gap)
4. Visual (borders, backgrounds, shadows)
5. Typography (text, font)
6. States (hover, focus, active, disabled)
7. Effects (animations, transitions)

### Mobile-First Approach
```tsx
// Mobile first (base classes)
// Then add desktop overrides with md: prefix
<div className="w-full md:w-auto">
  <button className="w-full md:w-auto">
```

### Conditional Classes
Use `cn()` utility for conditional classes:
```tsx
import { cn } from "@/lib/utils"

<div className={cn(
  "base classes",
  isActive && "active classes",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>
```

---

## 14. P2P Workflow Screens - Component Mapping

| Screen | Reuse These Components |
|--------|------------------------|
| **Purchase Orders List** | `PageHeader`, `MobileListItem`, `MobileMoreMenu`, `Fab` |
| **PO Detail/Edit** | `MobileCard`, `Input`, `Select`, `Button`, `Badge` |
| **PO Create** | `MobileCard`, `Input`, `Select`, `Button`, `Dialog` |
| **GRVs List** | `PageHeader`, `MobileListItem`, `MobileMoreMenu`, `Fab` |
| **GRV Detail** | `MobileCard`, `MobileCardHeader`, `MobileCardContent`, `Table` |
| **GRV Create** | `MobileCard`, `Input`, `Select`, `Button`, `MobileListItem` |
| **Supplier Bills List** | `PageHeader`, `MobileListItem`, `Badge`, `Fab` |
| **Bill Detail** | `MobileCard`, `Table`, `Badge`, `Button` (Approve/Void) |
| **Bill Create from GRV** | `MobileCard`, `MobileListItem`, `Dialog`, `Button` |
| **Supplier Payments List** | `PageHeader`, `MobileListItem`, `Badge`, `Fab` |
| **Payment Detail** | `MobileCard`, `Table`, `Badge`, `Button` |
| **Payment Create** | `MobileCard`, `Select`, `Input`, `Button` |

---

## 15. Prohibited Patterns

### DO NOT use:
- ❌ Desktop-only layouts (sidebar navigation on mobile)
- ❌ Fixed-width containers on mobile (`w-[400px]`)
- ❌ Horizontal scrolling containers
- ❌ Multi-column layouts on mobile (use stacked)
- ❌ Large typography (`text-3xl`, `text-4xl`)
- ❌ Heavy animations (use built-in animations only)
- ❌ Custom colors outside the design tokens
- ❌ Bootstrap-style grid (`row`, `col-*`)
- ❌ Material UI components
- ❌ Heavy external animation libraries

### ALWAYS use:
- ✅ Mobile-first component library
- ✅ Touch-friendly targets (44px min)
- ✅ Safe area insets (`pt-safe`, `pb-safe`)
- ✅ Built-in animations
- ✅ Consistent spacing (4px grid)
- ✅ Design tokens from CSS variables

---

*Last updated: 2026-02-25*
*Version: 1.0*
