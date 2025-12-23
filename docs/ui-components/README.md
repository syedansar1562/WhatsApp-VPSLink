# UI Components - Dark Theme

Professional dark theme components for WhatsApp Scheduler web interface.

## Overview

This directory contains reference implementations of all UI components with:
- **Dark theme** - Professional dark greys (#0a0a0a, #1a1a1a, #2d2d2d)
- **Apple-style design** - Clean, modern aesthetic
- **Sidebar navigation** - Fixed left sidebar (240px)
- **Floating + button** - Schedule new message (top-right)

## File Structure

```
ui-components/
├── README.md              # This file
├── globals.css            # Global styles & CSS variables
├── tailwind.config.ts     # Tailwind configuration
├── Sidebar.tsx            # Left navigation sidebar
├── ScheduleButton.tsx     # Floating + button
├── Layout.tsx             # Main layout wrapper
└── ScheduleModal.tsx      # Schedule new message modal
```

## Installation

When building the web UI on Saadi VPS (192.209.62.48):

### 1. Copy Files

```bash
# Copy all component files to Next.js project
cd /var/www/whatsapp-scheduler

# Create components directory
mkdir -p components

# Copy component files
cp /path/to/ui-components/*.tsx components/
cp /path/to/ui-components/globals.css app/
cp /path/to/ui-components/tailwind.config.ts ./
```

### 2. Install Dependencies

```bash
npm install lucide-react
```

### 3. Update app/layout.tsx

```tsx
import './globals.css'
import Layout from '@/components/Layout'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  )
}
```

### 4. Page Structure

All pages will automatically have:
- Sidebar navigation (left)
- Floating + button (top-right)
- Dark theme styling

## Components

### Sidebar

**File:** `components/Sidebar.tsx`

**Features:**
- Fixed left position (240px wide)
- Logo at top
- Navigation items (Dashboard, Scheduled, Contacts)
- Active state highlighting
- User profile at bottom
- Logout button

**Usage:**
```tsx
import Sidebar from '@/components/Sidebar'

// Already included in Layout component
```

### Schedule Button

**File:** `components/ScheduleButton.tsx`

**Features:**
- Fixed top-right position
- Blue circular button (56px)
- "+" icon with rotation on hover
- Opens schedule modal on click

**Usage:**
```tsx
import ScheduleButton from '@/components/ScheduleButton'

<ScheduleButton onClick={() => setShowModal(true)} />
```

### Layout

**File:** `components/Layout.tsx`

**Features:**
- Combines Sidebar + Main Content + Schedule Button
- Handles modal state
- Responsive layout

**Usage:**
```tsx
// In app/layout.tsx
import Layout from '@/components/Layout'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  )
}
```

### Schedule Modal

**File:** `components/ScheduleModal.tsx`

**Features:**
- Dark overlay with blur
- Centered modal card
- Contact picker (searchable dropdown)
- Message textarea
- Date & time pickers
- Cancel + Schedule buttons

**Usage:**
```tsx
import ScheduleModal from '@/components/ScheduleModal'

{showModal && <ScheduleModal onClose={() => setShowModal(false)} />}
```

## Color Palette

```css
/* Backgrounds */
--background: #0a0a0a;          /* Page background */
--surface: #1a1a1a;             /* Cards, sidebar */
--surface-elevated: #2d2d2d;    /* Inputs, hover states */
--surface-hover: #3a3a3a;       /* Active hover */

/* Borders */
--border: #404040;              /* Default borders */
--border-focus: #525252;        /* Focused state */

/* Text */
--text-primary: #ffffff;        /* Main text */
--text-secondary: #a3a3a3;      /* Secondary text */
--text-tertiary: #737373;       /* Disabled/placeholder */

/* Accent Colors */
--accent: #3b82f6;              /* Blue (primary) */
--success: #10b981;             /* Green (sent) */
--warning: #f59e0b;             /* Orange (pending) */
--error: #ef4444;               /* Red (failed) */
```

## Utility Classes

### Cards
```tsx
className="card"              // Basic card
className="card card-hover"   // Card with hover effect
```

### Buttons
```tsx
className="btn-primary"       // Blue button
className="btn-secondary"     // Grey button
```

### Inputs
```tsx
className="input"             // Text input/textarea
```

### Badges
```tsx
className="badge-pending"     // Orange badge
className="badge-sent"        // Green badge
className="badge-failed"      // Red badge
```

## Page Examples

### Dashboard

```tsx
// app/dashboard/page.tsx
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-text-secondary">Overview of your scheduled messages</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <p className="text-text-secondary text-sm">Pending</p>
          <p className="text-4xl font-bold text-white">12</p>
        </div>
        {/* More stats... */}
      </div>
    </div>
  )
}
```

### Contacts

```tsx
// app/contacts/page.tsx
export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Contacts</h1>

      <input
        type="text"
        placeholder="Search contacts..."
        className="input w-full"
      />

      <div className="card">
        <table className="w-full">
          {/* Table content... */}
        </table>
      </div>
    </div>
  )
}
```

## Responsive Design

### Mobile (<768px)
- Sidebar collapses to hamburger menu
- + button moves to bottom-right
- Stats cards stack vertically

**Implementation:**
```tsx
// Add hamburger menu
const [menuOpen, setMenuOpen] = useState(false);

// Sidebar becomes modal on mobile
<div className="md:fixed md:left-0 md:w-60">
  {/* Sidebar content */}
</div>
```

### Tablet (768px - 1024px)
- Sidebar remains visible
- Content adjusts width
- 2-column layouts where appropriate

## Accessibility

All components include:
- Proper ARIA labels
- Keyboard navigation
- Focus states
- Screen reader support

## Animation

Smooth transitions on:
- Hover states (150ms)
- Page transitions (200ms)
- Modal open/close (300ms)
- Button clicks (100ms)

## Next Steps

1. Copy files to Saadi VPS Next.js project
2. Install lucide-react dependency
3. Test all pages with dark theme
4. Adjust colors/spacing as needed
5. Add mobile responsiveness

## See Also

- [UI-DESIGN.md](../UI-DESIGN.md) - Complete design specification
- [HANDOVER.md](../../HANDOVER.md) - Full project handover
- [Phase 3](../../HANDOVER.md#phase-3-build-web-ui-4-5-hours) - Web UI implementation guide
