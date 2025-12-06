# Design Guidelines: Pulse - Comprehensive Dairy Farm Management PWA

## Design Approach
**Material Design System** adapted for agricultural tablet environments. Prioritizes high-contrast readability in bright sunlight, generous touch targets for gloved operation, sidebar navigation for efficient module switching, and data-rich layouts optimized for 768px-1024px viewports.

## Core Design Principles
1. **Tablet-First Design:** Primary viewport 768px-1024px, landscape-optimized layouts
2. **Outdoor Visibility:** High-contrast text (4.5:1 minimum), anti-glare considerations, dark mode for dawn/dusk shifts
3. **Glove-Friendly Touch:** All interactive elements ≥48px, icons 28px standard, generous spacing
4. **Module Navigation:** Collapsible sidebar for quick access to all farm management areas
5. **Status-Driven Hierarchy:** Visual alerts for withholding periods, expiry, breeding windows, NAIT compliance

## Typography

**Font Families:**
- Primary: Inter (Google Fonts) via CDN
- Monospace: JetBrains Mono for IDs, batch numbers, NAIT tags

**Hierarchy:**
- Module Headers: text-3xl font-bold (30px)
- Section Headers: text-xl font-semibold (20px)
- Card Titles: text-lg font-medium (18px)
- Body Text: text-base (16px)
- Labels: text-sm font-medium uppercase tracking-wide (14px)
- Data Values: text-lg font-mono (18px)
- Captions: text-sm (14px)

## Layout System

**Spacing Primitives:** Tailwind units of 4, 6, 8, 12, 16, 20
- Sidebar width: w-64 (expanded), w-16 (collapsed)
- Main content: max-w-full with px-8 py-6
- Card padding: p-6 to p-8
- Section gaps: gap-6 to gap-8
- Grid spacing: gap-4 to gap-6
- Form fields: space-y-4

**Grid Layouts:**
- Dashboard cards: grid-cols-2 lg:grid-cols-4
- Data tables: Full-width with horizontal scroll
- Animal/Product cards: grid-cols-2 lg:grid-cols-3
- Forms: 2-column layouts where appropriate (label + input)

## Component Library

### Navigation

**Sidebar (Primary Navigation):**
- Fixed left, full height, backdrop-blur with translucent background
- Logo + farm name at top (h-20)
- Collapsible toggle button (top-right corner, 48px touch target)
- Navigation items: Dashboard, Treatments, Medicine Inventory, Animals, Pastures, Reproduction, Settings
- Active state: Left border accent (4px), background highlight, icon + text bold
- Collapsed state: Icons only (28px), tooltips on hover
- Bottom section: User profile, offline status, notifications bell

**Top Bar:**
- Fixed header across main content area (h-16)
- Current module breadcrumb
- Global search bar (max-w-md)
- Quick actions: Add button dropdown, notification bell, settings gear
- Dark mode toggle switch

### Dashboard

**Summary Cards:**
- Grid of metric cards showing: Active Treatments, Expiring Medicines (7 days), Animals Due for Check, Pastures In Use, Upcoming Breedings
- Card structure: Large number (text-4xl font-bold), label, trend indicator (up/down arrow), supporting icon (32px)
- Height: min-h-32, rounded-xl shadow-md

**Alert Banner:**
- Top of dashboard: Critical alerts (expired withdrawals, NAIT non-compliance, low medicine stock)
- Dismissible, AlertTriangle icon, amber/red background
- Multi-line support for multiple alerts

**Recent Activity Feed:**
- Chronological list: Last 10 actions across all modules
- Timestamp, module icon, action description, actor
- Clickable to jump to relevant record

### Treatment Module

**5-Phase Workflow Stepper:**
- Horizontal progress indicator: Identify Animal → Select Medicine → Administer → Record Details → Confirm
- Active step highlighted, completed steps with checkmark, future steps grayed
- Each step full-screen form with Next/Back navigation

**Treatment Records Table:**
- Columns: Animal ID, Product, Batch, Date Administered, Milk Withholding, Meat Withholding, Status, Actions
- Status badges: Active (blue), Expired (green), Overdue (red)
- Row height: min-h-16
- Quick actions: View details, Edit, Archive (icon buttons 48px)
- Filters: By animal, product, date range, status

**Withholding Calendar View:**
- Visual timeline showing milk/meat withdrawal periods
- Color-coded bars per animal/treatment
- Current date indicator line
- Clickable bars to view treatment details

### Medicine Inventory

**Stock Cards Grid:**
- Card shows: Product name, current quantity, expiry date, reorder threshold, barcode
- Visual indicators: Low stock (amber badge), Expired (red badge), Adequate (green checkmark)
- Actions: Add stock, Edit product, View history

**Stock Movement History:**
- Table tracking: Date, Product, Quantity change (+/-), Batch number, Reason (used/wasted/restocked), User
- Export to CSV button
- Date range filter

**Barcode Scanner Integration:**
- Floating action button (bottom-right, 64px diameter, Camera icon)
- Full-screen modal: Camera feed (aspect-video rounded-lg), close button (top-right), helper text
- Scan result: Auto-fill product fields or search inventory

### Animal Management

**Animal Cards:**
- Individual cards with photo placeholder, NAIT tag, breed, age, status
- Health status indicator (dot: green/amber/red)
- Quick stats: Last treatment, current pasture, reproduction status
- Actions: View profile, Record event, Move pasture

**Animal Profile (Modal/Page):**
- Header: Photo, NAIT tag (large, monospace), vital stats
- Tabs: Health History, Treatments, Reproduction, Notes
- Timeline view for events

**NAIT Compliance Section:**
- List of animals requiring registration/updates
- Batch export for NAIT submission
- Compliance status badges

### Pasture Management

**Pasture Overview Map:**
- Visual grid/map showing pasture layout (simplified representation)
- Each pasture: Name, size, current stock count, rest status
- Color coding: In use (blue), Resting (green), Requires maintenance (amber)

**Rotation Planner:**
- Drag-drop interface for planning moves
- Date-based rotation schedule
- Auto-suggestions based on rest periods

### Reproduction Module

**Breeding Calendar:**
- Month view with heat detection dates, AI dates, pregnancy checks, due dates
- Color-coded events
- Clickable to add/edit records

**Individual Cow Reproduction Cards:**
- Current status: Open, Bred (days since), Pregnant (due date), Fresh (days in milk)
- Last heat date, AI history, pregnancy scan results
- Actions: Record heat, Record AI, Record pregnancy check

### Forms

**Universal Form Patterns:**
- Grouped sections with clear headings
- Input height: h-12
- Large select dropdowns with search (react-select style)
- Date pickers: Calendar icon, large day targets
- Number steppers: Large +/- buttons flanking input
- Textarea: min-h-32 for notes fields
- Submit buttons: Full-width on mobile, max-w-xs on tablet, h-12, icon + text

### Modals & Overlays

**Standard Modal:**
- Max-width: max-w-2xl
- Header: Title (text-xl), close button (top-right, 48px)
- Body: p-6, max-h-96 overflow-y-auto
- Footer: Action buttons right-aligned, Cancel + Primary CTA
- Backdrop: Semi-transparent dark overlay

**Sheet (Bottom Drawer):**
- Used for quick actions, filters
- Slides up from bottom, rounded-t-2xl
- Drag handle at top center
- Max-height: 75vh

### Status Indicators & Badges

**Treatment Status:**
- Active Withdrawal: Blue badge, Clock icon
- Safe to Use: Green badge, CheckCircle icon
- Overdue Review: Red badge, AlertTriangle icon

**Inventory Status:**
- In Stock: Green badge
- Low Stock: Amber badge, threshold indicator
- Expired: Red badge, XCircle icon
- Out of Stock: Gray badge

**Badge Specifications:**
- Size: px-4 py-2 rounded-full text-sm font-semibold
- Icons: 16px, positioned left of text

### Action Buttons

**Primary Actions:**
- Floating Action Button (FAB): 64px diameter, bottom-right, primary color, relevant icon (Plus, Camera, Calendar)
- Standard buttons: h-12, px-6, rounded-lg, icon + text pattern
- Icon size in buttons: 20px

**Button Groups:**
- Horizontal: gap-3, responsive stack on narrow views
- Segmented controls: For view toggles (Table/Grid, Day/Week/Month)

## Visual Treatments

**Elevation:**
- Sidebar: shadow-xl with backdrop-blur-lg
- Cards: shadow-md, hover:shadow-lg transition
- Modals: shadow-2xl
- FABs: shadow-xl

**Borders:**
- Input fields: border-2, rounded-lg, focus:ring-2
- Cards: border, rounded-xl
- Badges: rounded-full
- Dividers: border-t between sections (subtle gray)

**Iconography:**
- Library: Lucide React via CDN
- Standard size: 28px (w-7 h-7)
- Small: 20px (w-5 h-5) for inline elements
- Large: 32px (w-8 h-8) for dashboard metrics
- Always pair with text labels except in collapsed sidebar

## Dark Mode Strategy

**Implementation:**
- System preference detection + manual override toggle
- Two complete color schemes defined (light/dark)
- Dark mode optimizations: Reduced brightness for whites, deeper blacks for outdoor night visibility
- Status colors maintain contrast ratios in both modes
- Images: Subtle overlay darkening in dark mode

## PWA Elements

**Install Prompt:**
- Persistent banner or modal on first visit
- MonitorDown icon, "Install Pulse" text, Install/Dismiss buttons
- Re-appears after 7 days if dismissed

**Offline Indicator:**
- Fixed badge in sidebar bottom or top bar
- CloudOff icon, "Offline Mode" text
- Sync status: Queued changes counter

**Notifications:**
- Permission request in Settings module, BellRing icon
- Notification types: Treatment reminders, withholding expiry, low stock alerts, breeding windows
- Toast notifications: Bottom-right, auto-dismiss, with undo for reversible actions

**Sync Status:**
- Visual indicator when syncing background data
- Progress bar for bulk operations
- Last sync timestamp displayed

## Images

**Animal Profile Photos:**
- Placeholder: Cow silhouette icon in circular frame
- Upload functionality: Camera or gallery selection
- Dimensions: Square aspect ratio, min 400x400px
- Display: Circular crop in cards (96px), full square in profiles

**Dashboard Hero (Optional Enhancement):**
- Top of dashboard: Panoramic farm landscape photo (subtle, not distracting)
- Height: h-48, rounded-lg, with gradient overlay for text readability
- Overlaid farm name and today's date

No full-screen hero images required - focus on data-rich layouts. All images serve functional purposes (identification, visual recognition) rather than marketing aesthetics.