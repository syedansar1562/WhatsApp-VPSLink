# UI Design Specification - WhatsApp Scheduler

## Design Philosophy

**Apple-inspired dark theme:** Professional, clean, modern aesthetic with dark greys (not extreme black).

## Color Palette

### Primary Colors
```css
--background: #0a0a0a;          /* Deep background */
--surface: #1a1a1a;             /* Card/container background */
--surface-elevated: #2d2d2d;    /* Hover states, elevated elements */
--surface-hover: #3a3a3a;       /* Interactive hover */
--border: #404040;              /* Subtle borders */
--border-focus: #525252;        /* Focused borders */

--text-primary: #ffffff;        /* Main text */
--text-secondary: #a3a3a3;      /* Secondary text */
--text-tertiary: #737373;       /* Disabled/placeholder text */

--accent: #3b82f6;              /* Blue accent (buttons, links) */
--accent-hover: #2563eb;        /* Accent hover */
--success: #10b981;             /* Green (sent status) */
--warning: #f59e0b;             /* Orange (pending status) */
--error: #ef4444;               /* Red (failed status) */
```

### Usage
- **Background**: Page background (#0a0a0a)
- **Cards**: #1a1a1a with subtle #404040 border
- **Sidebar**: #1a1a1a with #2d2d2d hover states
- **Inputs**: #2d2d2d background, #525252 border on focus
- **Buttons**: #3b82f6 primary, #2d2d2d secondary

## Layout Structure

### Overall Layout
```
┌────────────────────────────────────────────────────────┐
│  Sidebar (240px)    │  Main Content Area              │
│                     │                                  │
│  [Logo]             │  ┌──────────────────┐  [+ New]  │
│                     │  │                  │           │
│  ☰ Dashboard        │  │   Page Content   │           │
│  📅 Scheduled       │  │                  │           │
│  👤 Contacts        │  │                  │           │
│                     │  │                  │           │
│  [User Profile]     │  └──────────────────┘           │
└────────────────────────────────────────────────────────┘
```

### Dimensions
- **Sidebar width**: 240px (fixed)
- **Main content**: calc(100vw - 240px)
- **Content max-width**: 1400px (centered)
- **Padding**: 32px
- **Card padding**: 24px
- **Border radius**: 12px (cards), 8px (inputs/buttons)

## Components

### 1. Sidebar Navigation

**Position**: Fixed left, full height

**Appearance**:
- Background: #1a1a1a
- Border right: 1px solid #404040
- Width: 240px

**Items**:
```
┌─────────────────────────────┐
│  [WhatsApp Icon + Logo]     │  ← Top (32px padding)
│                             │
│  ☰  Dashboard               │  ← Active: #2d2d2d bg, white text
│  📅 Scheduled               │
│  👤 Contacts                │
│                             │
│  [User Avatar]              │  ← Bottom
│  Saadi                      │
│  [Logout]                   │
└─────────────────────────────┘
```

**States**:
- **Default**: #a3a3a3 text, transparent bg
- **Hover**: #ffffff text, #2d2d2d bg
- **Active**: #ffffff text, #2d2d2d bg, #3b82f6 left border (4px)

### 2. Floating "+ New Message" Button

**Position**: Fixed top-right

**Appearance**:
- Background: #3b82f6
- Size: 56px × 56px (circle)
- Icon: "+" (24px, white)
- Shadow: 0 4px 12px rgba(59, 130, 246, 0.4)
- Position: top-right 32px, fixed

**States**:
- **Default**: #3b82f6
- **Hover**: #2563eb, shadow increases
- **Click**: Opens schedule modal/page

### 3. Cards

**Standard card**:
```tsx
background: #1a1a1a
border: 1px solid #404040
border-radius: 12px
padding: 24px
```

**Hover state** (for interactive cards):
```tsx
background: #2d2d2d
border: 1px solid #525252
```

### 4. Inputs & Forms

**Text Input**:
```tsx
background: #2d2d2d
border: 1px solid #404040
border-radius: 8px
padding: 12px 16px
color: #ffffff
font-size: 14px

// Focus
border: 1px solid #3b82f6
outline: 2px solid rgba(59, 130, 246, 0.2)
```

**Select Dropdown**:
```tsx
// Same as text input
// Dropdown menu: #2d2d2d background
// Option hover: #3a3a3a
```

**Textarea**:
```tsx
// Same as text input
min-height: 120px
resize: vertical
```

### 5. Buttons

**Primary Button**:
```tsx
background: #3b82f6
color: #ffffff
border: none
border-radius: 8px
padding: 12px 24px
font-weight: 600

// Hover
background: #2563eb
```

**Secondary Button**:
```tsx
background: #2d2d2d
color: #ffffff
border: 1px solid #404040
border-radius: 8px
padding: 12px 24px

// Hover
background: #3a3a3a
border: 1px solid #525252
```

**Icon Button** (small actions):
```tsx
background: transparent
color: #a3a3a3
padding: 8px
border-radius: 6px

// Hover
background: #2d2d2d
color: #ffffff
```

### 6. Status Badges

**Pending**:
```tsx
background: rgba(245, 158, 11, 0.1)
color: #f59e0b
border: 1px solid rgba(245, 158, 11, 0.2)
padding: 4px 12px
border-radius: 6px
font-size: 12px
font-weight: 600
```

**Sent**:
```tsx
background: rgba(16, 185, 129, 0.1)
color: #10b981
border: 1px solid rgba(16, 185, 129, 0.2)
```

**Failed**:
```tsx
background: rgba(239, 68, 68, 0.1)
color: #ef4444
border: 1px solid rgba(239, 68, 68, 0.2)
```

### 7. Tables

**Table container**:
```tsx
background: #1a1a1a
border: 1px solid #404040
border-radius: 12px
overflow: hidden
```

**Header row**:
```tsx
background: #2d2d2d
color: #a3a3a3
font-size: 12px
font-weight: 600
text-transform: uppercase
padding: 12px 16px
```

**Body rows**:
```tsx
border-bottom: 1px solid #404040
padding: 16px
color: #ffffff

// Hover
background: #2d2d2d
```

**Last row**: No border-bottom

## Page-Specific Designs

### Dashboard Page

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Dashboard                                    [+ New]    │
│  Overview of your scheduled messages                     │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │   Pending    │ │     Sent     │ │    Total     │   │
│  │      12      │ │      45      │ │      57      │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Upcoming Messages                              │   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │ Nick Smith                      2:30 PM  │  │   │
│  │  │ Happy Birthday! 🎂           [pending]   │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  │  ┌──────────────────────────────────────────┐  │   │
│  │  │ John Doe                        4:00 PM  │  │   │
│  │  │ Meeting reminder             [pending]   │  │   │
│  │  └──────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Stats Cards** (3 across):
- Size: Equal width, ~300px each
- Number: 48px font, bold, white
- Label: 14px, #a3a3a3

**Upcoming Messages**:
- Card with list of next 5 messages
- Each message: flex row
  - Left: Contact name (bold) + message preview (truncated)
  - Right: Time + status badge
- Hover: Slight background change (#2d2d2d)

### Contacts Page

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Contacts                                     [+ New]    │
│  Manage your contact list                                │
│                                                          │
│  [Search contacts...]                       ☆ Favorites │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Name          Phone           Aliases   Actions │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  ★ Nick Smith  +44 795...      Nick     [Edit]  │   │
│  │  John Doe      +44 123...      John     [Edit]  │   │
│  │  Jane Smith    +44 987...      Jane     [Edit]  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Search bar**:
- Full width input at top
- Icon: 🔍 left side
- Placeholder: "Search contacts..."

**Favorites filter**:
- Toggle button on right
- When active: Show only starred contacts

**Table**:
- Sortable columns
- Favorite star (★) clickable to toggle
- Edit button opens modal/page

### Schedule Page (Modal)

When clicking "+ New Message":

**Modal overlay**:
```tsx
background: rgba(0, 0, 0, 0.7)
backdrop-filter: blur(8px)
```

**Modal card**:
```
┌─────────────────────────────────────────┐
│  Schedule New Message              [×]  │
│                                         │
│  Contact *                              │
│  [Select contact ▼]                     │
│                                         │
│  Message *                              │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Date & Time *                          │
│  [📅 24/12/2025]  [🕐 10:00 AM]        │
│                                         │
│  [ Cancel ]          [ Schedule ] →    │
└─────────────────────────────────────────┘
```

**Size**: 600px wide, centered
**Animations**: Fade in + slide up

**Contact select**:
- Searchable dropdown
- Shows: Avatar + Name + Phone
- Favorites at top

**Date/Time pickers**:
- Side by side
- Native HTML5 or custom dark-themed picker
- Timezone: Europe/London (shown)

### Scheduled Messages Page

**Layout**:
```
┌─────────────────────────────────────────────────────────┐
│  Scheduled Messages                           [+ New]    │
│  View and manage your scheduled messages                 │
│                                                          │
│  [All] [Pending] [Sent] [Failed]          [Search...]   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Contact     Message         Scheduled    Status │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ Nick Smith  Happy Birth...  24/12 10:00 pending │   │
│  │ John Doe    Meeting rem...  23/12 14:00 sent    │   │
│  │ Jane Smith  Don't forget..  22/12 09:00 sent    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Filter tabs**:
- All, Pending, Sent, Failed
- Active tab: #3b82f6 underline
- Inactive: #a3a3a3 text

**Table actions** (on hover):
- Edit icon button
- Delete icon button
- Aligned right

## Animations & Transitions

### Page Transitions
```css
transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Hover Effects
```css
transition: background-color 150ms ease;
```

### Modal
```css
/* Overlay */
animation: fadeIn 200ms ease;

/* Card */
animation: slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1);

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Button Clicks
```css
/* Scale down slightly on click */
active:scale-95
transition: transform 100ms
```

## Typography

**Font Family**:
- Primary: SF Pro Display, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
- Monospace: SF Mono, Menlo, Monaco, "Courier New", monospace

**Sizes**:
- Hero/Numbers: 48px, bold
- H1: 32px, bold
- H2: 24px, semibold
- H3: 20px, semibold
- Body: 14px, regular
- Small: 12px, regular
- Tiny: 11px, regular

**Line Heights**:
- Headings: 1.2
- Body: 1.5
- Compact: 1.3

## Responsive Design

### Breakpoints
```css
sm: 640px   /* Mobile */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### Mobile (<768px)
- Sidebar collapses to hamburger menu
- "+" button moves to bottom-right
- Stats cards stack vertically
- Table becomes card list

### Tablet (768px - 1024px)
- Sidebar stays visible
- Content adjusts width
- 2-column stats on dashboard

## Accessibility

**Focus States**:
```css
focus-visible:outline-2
focus-visible:outline-offset-2
focus-visible:outline-blue-500
```

**Keyboard Navigation**:
- Tab order follows visual order
- Escape closes modals
- Enter submits forms

**Screen Readers**:
- Proper ARIA labels on all interactive elements
- Status announcements for actions
- Semantic HTML (nav, main, section, etc.)

## Implementation Notes

### Tailwind Config
```js
theme: {
  extend: {
    colors: {
      dark: {
        bg: '#0a0a0a',
        surface: '#1a1a1a',
        elevated: '#2d2d2d',
        hover: '#3a3a3a',
        border: '#404040',
      }
    }
  }
}
```

### Component Library
- Use shadcn/ui as base
- Customize with dark theme
- Override default colors in component files

---

**Status**: Design specification complete
**Next**: Implement components on Saadi VPS
