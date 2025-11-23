# SIPREMSS Design System Guidelines

This document serves as the comprehensive reference for maintaining consistent design patterns across all pages and components in the SIPREMSS (Sistem Prediksi Manajemen Stok dan Sales) application.

---

## General Guidelines

* Use responsive layouts with Flexbox and Grid by default
* Avoid absolute positioning unless absolutely necessary for specific use cases (tooltips, dropdowns)
* Keep components modular and maintain separation of concerns
* Follow existing color palette and spacing system strictly
* Maintain accessibility standards (proper contrast ratios, ARIA labels, keyboard navigation)
* Use TypeScript for type safety
* Keep file sizes manageable - extract helper functions and reusable components into separate files

---

## Global Color Palette

### Primary Colors
* **Primary (Indigo)**: `indigo-600` (#4f46e5) - Main brand color
  * Usage: Primary buttons, active states, links, primary actions
  * Hover: `indigo-700`
  * Background: `indigo-50`, `indigo-100`
  * Example: Main CTA buttons, active navigation items

### Semantic Colors
* **Success (Green)**: `green-500`, `green-600`
  * Usage: Success messages, positive trends, completion states
  * Background: `green-50`
  * Border: `green-200`
  * Text: `green-600`, `green-700`
  
* **Warning (Yellow/Amber)**: `yellow-500`, `yellow-600`
  * Usage: Warning messages, medium urgency alerts
  * Background: `yellow-50`
  * Border: `yellow-200`
  * Text: `yellow-600`
  
* **Danger/Destructive (Red)**: `red-500`, `red-600`
  * Usage: Error messages, destructive actions, high urgency alerts, critical stock warnings
  * Background: `red-50`, `red-100`
  * Border: `red-200`, `red-500`
  * Text: `red-600`, `red-700`, `red-900`

* **Info (Blue)**: `blue-500`, `blue-600`
  * Usage: Informational messages, data visualization
  * Background: `blue-50`, `blue-100`
  * Border: `blue-200`
  * Text: `blue-600`, `blue-700`

### Neutral Colors (Slate)
* **Background**: `white`, `slate-50`, `slate-100`
* **Borders**: `slate-200`, `slate-300`
* **Text Primary**: `slate-900`
* **Text Secondary**: `slate-600`, `slate-700`
* **Text Muted**: `slate-400`, `slate-500`
* **Disabled**: `slate-300`

### Gradient Colors
Use gradients for icon backgrounds and special visual elements:
* Blue to Indigo: `from-blue-500 via-blue-600 to-indigo-600`
* Green to Emerald: `from-green-500 to-emerald-600`
* Orange to Red: `from-orange-500 to-red-600`
* Yellow to Orange: `from-yellow-500 to-orange-600`
* Purple gradient: `from-purple-500 to-purple-600`
* Slate gradient: `from-slate-100 to-slate-200`

### Chart/Data Visualization Colors
* Chart 1 (Orange): `oklch(0.646 0.222 41.116)` - `--chart-1`
* Chart 2 (Teal): `oklch(0.6 0.118 184.704)` - `--chart-2`
* Chart 3 (Blue): `oklch(0.398 0.07 227.392)` - `--chart-3`
* Chart 4 (Yellow): `oklch(0.828 0.189 84.429)` - `--chart-4`
* Chart 5 (Red): `oklch(0.769 0.188 70.08)` - `--chart-5`

---

## Global Buttons

### Button Variants

#### 1. Default (Primary)
* **Style**: `bg-primary text-primary-foreground hover:bg-primary/90`
* **Visual**: Filled with indigo-600, white text
* **Usage**: Main actions, form submissions, primary CTAs
* **Example**: "Start Prediction", "Add Product", "Save Changes"

#### 2. Destructive
* **Style**: `bg-destructive text-white hover:bg-destructive/90`
* **Visual**: Filled with red, white text
* **Usage**: Delete actions, dangerous operations, critical confirmations
* **Example**: "Delete Product", "Cancel Order", "Remove Item"

#### 3. Outline
* **Style**: `border bg-background text-foreground hover:bg-accent hover:text-accent-foreground`
* **Visual**: Border only, transparent background
* **Usage**: Secondary actions, alternative choices
* **Example**: "Cancel", "Back", filter toggle buttons

#### 4. Secondary
* **Style**: `bg-secondary text-secondary-foreground hover:bg-secondary/80`
* **Visual**: Light gray background, dark text
* **Usage**: Supporting actions, less important operations
* **Example**: "View Details", "More Options"

#### 5. Ghost
* **Style**: `hover:bg-accent hover:text-accent-foreground`
* **Visual**: No background, shows on hover
* **Usage**: Icon buttons, minimal actions, tertiary options
* **Example**: Icon-only buttons in toolbars

#### 6. Link
* **Style**: `text-primary underline-offset-4 hover:underline`
* **Visual**: Text-only with underline on hover
* **Usage**: Navigation links within content, inline actions
* **Example**: "Learn more", "View all"

### Button Sizes
* **Small (sm)**: `h-8 px-3` - For compact spaces, inline actions
* **Default**: `h-9 px-4` - Standard size for most use cases
* **Large (lg)**: `h-10 px-6` - For prominent actions, landing pages
* **Icon**: `size-9` - Square buttons for icons only

### Button States
* **Default**: Base styling as per variant
* **Hover**: Slight darkening or background change (`:hover` styles)
* **Focus**: Ring outline for keyboard navigation
  * Ring color: `focus-visible:ring-ring/50`
  * Ring width: `focus-visible:ring-[3px]`
* **Disabled**: 
  * `disabled:opacity-50`
  * `disabled:pointer-events-none`
  * Use when action is unavailable
* **Loading**: 
  * Show Loader2 icon with `animate-spin`
  * Disable interaction during loading state

### Button Spacing & Layout
* Between buttons: `gap-2` or `gap-3`
* Button groups: Use `flex gap-2` or `flex gap-3`
* Single button: Maintain consistent padding within parent container

---

## Visual Style Guidelines

### Spacing Scale
Follow Tailwind's spacing scale (1 unit = 0.25rem = 4px):
* **Micro spacing**: `gap-1`, `p-1`, `m-1` (4px)
* **Small spacing**: `gap-2`, `p-2`, `m-2` (8px)
* **Medium spacing**: `gap-3`, `p-3`, `m-3` (12px), `gap-4`, `p-4` (16px)
* **Large spacing**: `gap-6`, `p-6`, `m-6` (24px)
* **Extra large**: `gap-8`, `p-8` (32px)

### Common Spacing Patterns
* **Card padding**: `p-6` (24px)
* **Between sections**: `space-y-6` or `gap-6`
* **Between elements in a group**: `space-y-3` or `gap-3`
* **Icon to text**: `gap-2`
* **Page margins**: `px-6 py-8` or `p-8`

### Border Radius
* **Small**: `rounded` (0.25rem / 4px) - For badges, small elements
* **Medium**: `rounded-lg` (var(--radius) = 0.625rem / 10px) - Default for most components
* **Large**: `rounded-xl` (calc(var(--radius) + 4px) ≈ 14px) - For cards, containers
* **Extra Large**: `rounded-2xl` (1rem / 16px), `rounded-3xl` (1.5rem / 24px) - For large hero elements
* **Full**: `rounded-full` - For circular elements (avatars, icon backgrounds)

### Shadows
* **Small**: `shadow-sm` - Subtle elevation for inputs, small cards
* **Medium**: `shadow-md` (on hover) - Interactive elements hover state
* **Large**: `shadow-lg` - Modals, dropdowns, prominent cards
* **Extra Large**: `shadow-xl` (on hover), `shadow-2xl` - Hero elements, special emphasis

### Borders
* **Width**: `border` (1px) is standard, `border-2` for emphasis
* **Colors**: Use semantic colors - `border-slate-200` (default), `border-slate-300` (darker), or match content color
* **Style**: `border-dashed` for placeholders or empty states
* **Patterns**:
  * Cards: `border border-slate-200`
  * Inputs: `border border-slate-300`
  * Error states: `border-red-500`

---

## Typography Scale & Hierarchy

### Font Size Scale
Base font size: **16px** (`--font-size: 16px`)

* **Extra Small**: `text-xs` (0.75rem / 12px)
  * Usage: Helper text, badges, timestamps, metadata
  * Line height: calc(1 / 0.75)
  
* **Small**: `text-sm` (0.875rem / 14px)
  * Usage: Secondary text, labels, descriptions
  * Line height: calc(1.25 / 0.875)
  
* **Base**: `text-base` (1rem / 16px)
  * Usage: Body text, default size, form inputs
  * Line height: 1.5
  
* **Large**: `text-lg` (1.125rem / 18px)
  * Usage: Subheadings, emphasized text
  * Line height: 1.5
  
* **Extra Large**: `text-xl` (1.25rem / 20px)
  * Usage: H2 headings, section titles
  * Line height: 1.5
  
* **2X Large**: `text-2xl` (1.5rem / 24px)
  * Usage: H1 headings, page titles
  * Line height: calc(2 / 1.5)

### Font Weights
* **Normal**: `font-normal` (400) - Body text, paragraphs
* **Medium**: `font-medium` (500) - Headings, labels, buttons, emphasis

### Typography Hierarchy

#### Headings
* **H1** (Page Title):
  * Size: `text-2xl` or larger
  * Weight: `font-medium` or implicit medium
  * Color: `text-slate-900`
  * Usage: Page title, main heading
  * Example: "Dashboard", "Smart Prediction"

* **H2** (Section Title):
  * Size: `text-xl`
  * Weight: `font-medium`
  * Color: `text-slate-900`
  * Usage: Card titles, major section headers
  * Spacing: `mb-1` to accompanying description

* **H3** (Subsection):
  * Size: `text-lg`
  * Weight: `font-medium`
  * Color: `text-slate-900` or `text-slate-700`
  * Usage: Component headings, subsections

* **H4** (Minor Heading):
  * Size: `text-base`
  * Weight: `font-medium`
  * Usage: Small section labels

#### Body Text
* **Primary Text**:
  * Size: `text-base`
  * Weight: `font-normal`
  * Color: `text-slate-900`
  * Line height: 1.5

* **Secondary Text**:
  * Size: `text-sm` or `text-base`
  * Weight: `font-normal`
  * Color: `text-slate-600` or `text-slate-500`
  * Usage: Descriptions, helper text

* **Muted Text**:
  * Size: `text-xs` or `text-sm`
  * Weight: `font-normal`
  * Color: `text-slate-400` or `text-slate-500`
  * Usage: Timestamps, metadata, "vs last period"

#### Labels
* Size: `text-base` or `text-sm`
* Weight: `font-medium`
* Color: `text-slate-700` or `text-slate-900`
* Usage: Form labels, data labels

---

## Component Consistency Rules

### Cards
* **Structure**: Use Card components from `components/ui/card.tsx`
* **Base Style**: `bg-white rounded-xl border border-slate-200 p-6`
* **Spacing**: Internal padding `p-6`, gap between elements `space-y-3` or `gap-3`
* **Content**:
  * Title: H2 or H3 with `mb-1`
  * Description: `text-slate-500 text-sm`
  * Content area: Use CardContent wrapper
* **Hover Effect** (if interactive): `hover:shadow-xl transition-all cursor-pointer`

### Metric Cards (Dashboard)
* **Layout**: Grid layout `grid-cols-1 md:grid-cols-3 gap-6`
* **Icon Background**: Gradient background with rounded-lg
  * Example: `bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-lg`
* **Percentage Badge**: 
  * Green for positive: `text-green-600 bg-green-50 px-3 py-1 rounded-full`
  * Red for negative: `text-red-600 bg-red-50 px-3 py-1 rounded-full`
* **Value**: Large text `text-2xl text-slate-900 font-medium`
* **Label**: Muted text `text-slate-500 text-sm`

### Forms
* **Input Fields**:
  * Base: `border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent`
  * Background: `bg-input-background` or `bg-white`
  * Error state: `border-red-500 focus:ring-red-500`
  
* **Labels**: 
  * Above inputs with `mb-2`
  * Style: `text-sm font-medium text-slate-700`
  
* **Helper Text**: 
  * Below inputs
  * Style: `text-xs text-slate-500 mt-1`
  
* **Error Messages**: 
  * Below inputs
  * Style: `text-xs text-red-600 mt-1`

* **Form Layout**:
  * Vertical spacing: `space-y-4` or `space-y-6`
  * Button group at bottom: `flex justify-end gap-2 mt-6`

### Tables
* **Header**: `bg-slate-50 text-slate-700 font-medium`
* **Rows**: 
  * Border: `border-b border-slate-200`
  * Hover: `hover:bg-slate-50`
* **Cells**: Padding `px-4 py-3` or `p-4`
* **Text Alignment**: Right-align numbers, left-align text

### Badges/Pills
* **Structure**: `px-3 py-1 rounded-full text-xs font-medium`
* **Variants**:
  * Success: `bg-green-50 text-green-700 border border-green-200`
  * Warning: `bg-yellow-50 text-yellow-700 border border-yellow-200`
  * Danger: `bg-red-50 text-red-700 border border-red-200`
  * Info: `bg-blue-50 text-blue-700 border border-blue-200`
  * Neutral: `bg-slate-100 text-slate-700 border border-slate-200`

### Loading States
* **Spinner**: Use `Loader2` icon with `animate-spin`
  * Color: `text-indigo-600`
  * Size: `w-8 h-8` for page loading, `w-5 h-5` for inline
* **Skeleton**: Use skeleton component with `animate-pulse`
* **Container**: Center with `flex items-center justify-center h-96`

### Empty States
* **Icon**: Large icon (w-12 h-12) in muted color
* **Text**: 
  * Main: `text-slate-700 font-medium`
  * Description: `text-slate-500 text-sm`
* **Action**: Primary button or link
* **Layout**: Centered with `flex flex-col items-center justify-center py-12`

### Alerts/Notifications
* **Toast Notifications**: Use sonner library
* **Inline Alerts**: 
  * Structure: Icon + message
  * Padding: `p-4`
  * Border radius: `rounded-lg`
  * Border: 1px border matching alert type

### Icons
* **Size**: 
  * Small: `w-4 h-4` or `w-5 h-5`
  * Medium: `w-6 h-6` (default)
  * Large: `w-8 h-8`
* **Spacing**: `gap-2` between icon and text
* **Color**: Match text color or use semantic colors
* **Library**: Use lucide-react icons

### Charts & Data Visualization
* **Library**: Recharts
* **Container**: `ResponsiveContainer width="100%" height={300}`
* **Colors**: Use chart colors from palette (`--chart-1` through `--chart-5`)
* **Grid**: `CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"`
* **Axes**: `stroke="#64748b"` (slate-600)
* **Tooltips**: 
  * Background: white
  * Border: `1px solid #e2e8f0`
  * Border radius: `8px`

---

## Layout Patterns

### Page Layout
* **Container**: Full width with padding `px-6 py-8` or `p-8`
* **Max Width**: Use container constraints when needed (`max-w-7xl mx-auto`)
* **Spacing**: Between page sections use `space-y-6`

### Grid Layouts
* **Responsive**: 
  * Mobile: `grid-cols-1`
  * Tablet: `md:grid-cols-2` or `md:grid-cols-3`
  * Desktop: `lg:grid-cols-3` or `lg:grid-cols-4`
* **Gap**: `gap-6` for cards, `gap-4` for smaller elements
* **Asymmetric**: Use `lg:col-span-2` and `lg:col-span-1` for featured content

### Flex Layouts
* **Direction**: `flex-row` (default), `flex-col` for vertical stacking
* **Alignment**: 
  * Center items: `items-center justify-center`
  * Space between: `justify-between items-center`
* **Wrapping**: `flex-wrap` for responsive behavior
* **Gap**: `gap-2`, `gap-3`, or `gap-4`

### Sidebar Layout
* **Width**: `w-64` (256px) for sidebar
* **Content**: `ml-64` margin to offset sidebar
* **Mobile**: Hide sidebar, show hamburger menu

---

## Interaction Patterns

### Hover Effects
* **Cards**: `hover:shadow-xl transition-all`
* **Buttons**: Built into button variants
* **Links**: `hover:text-indigo-600`
* **Rows**: `hover:bg-slate-50`

### Transitions
* **Duration**: Use `transition-all` or `transition-colors`
* **Timing**: Default cubic-bezier timing function
* **Properties**: Specify what transitions (colors, shadows, transforms)

### Focus States
* **Keyboard Navigation**: Always include focus styles
* **Ring**: `focus:ring-2 focus:ring-indigo-500`
* **Border**: `focus:border-transparent` when using rings
* **Outline**: `focus:outline-none` with visible alternative (ring)

---

## Responsive Design

### Breakpoints
* **Mobile**: Default (< 768px)
* **Tablet**: `md:` (≥ 768px)
* **Desktop**: `lg:` (≥ 1024px)
* **Large Desktop**: `xl:` (≥ 1280px)

### Mobile-First Approach
* Default styles for mobile
* Use `md:` and `lg:` prefixes for larger screens
* Test on multiple screen sizes
* Hide/show elements based on screen size when necessary

### Common Responsive Patterns
* **Grid**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
* **Text Size**: Generally keep consistent, adjust only for headings if needed
* **Spacing**: Consistent across breakpoints, adjust containers only
* **Navigation**: Responsive sidebar/hamburger menu

---

## Accessibility Requirements

* **Color Contrast**: Maintain WCAG AA standards (4.5:1 for normal text)
* **Focus Indicators**: Always visible for keyboard navigation
* **ARIA Labels**: Add to icon-only buttons and interactive elements
* **Alt Text**: Provide for all images
* **Semantic HTML**: Use proper heading hierarchy (H1 → H2 → H3)
* **Keyboard Navigation**: All interactive elements accessible via keyboard
* **Form Labels**: Associate labels with inputs using htmlFor/id

---

## Best Practices

### Component Usage
* Import from `components/ui/*` for consistent base components
* Extend with additional classes, don't override core styles
* Use composition over modification
* Keep components reusable and generic

### Consistency Checklist
Before creating a new page or component:
- [ ] Uses colors from the defined palette
- [ ] Follows typography scale and hierarchy
- [ ] Uses appropriate button variants
- [ ] Maintains consistent spacing (gap-6 between sections, p-6 in cards)
- [ ] Includes proper focus and hover states
- [ ] Responsive on mobile, tablet, and desktop
- [ ] Accessible (proper contrast, focus indicators, ARIA labels)
- [ ] Matches existing patterns in similar pages

### Code Style
* Use Tailwind utility classes in a logical order: layout → spacing → colors → typography → effects
* Extract repeated patterns into components
* Use CSS variables for theme values
* Prefer composition over duplication

---

## Examples & References

### Example: Standard Page Header
```tsx
<div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl text-slate-900 mb-1">Page Title</h1>
    <p className="text-slate-500">Brief description of the page</p>
  </div>
  <Button variant="default" size="default">
    <Plus className="w-5 h-5" />
    Add New
  </Button>
</div>
```

### Example: Metric Card
```tsx
<div className="bg-white rounded-xl p-6 border border-slate-200">
  <div className="flex items-center justify-between mb-4">
    <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
      <TrendingUp className="w-6 h-6 text-white" />
    </div>
    <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm">
      +12.5%
    </span>
  </div>
  <h3 className="text-slate-500 text-sm mb-1">Total Revenue</h3>
  <p className="text-2xl text-slate-900 font-medium">$24,500</p>
  <p className="text-xs text-slate-400 mt-2">vs last period</p>
</div>
```

### Example: Alert Badge
```tsx
<span className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
  High Priority
</span>
```

---

**Remember**: This document is the single source of truth for design decisions. All pages must follow these guidelines to ensure a consistent, professional user experience across SIPREMSS.
