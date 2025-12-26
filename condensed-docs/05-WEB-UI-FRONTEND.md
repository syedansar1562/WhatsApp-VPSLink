# Web UI Frontend: Next.js Application

## Overview

The Web UI is a modern, dark-themed Next.js 15 application that provides a user-friendly interface for scheduling WhatsApp messages and managing contacts. It runs on the Saadi VPS (192.209.62.48) and communicates with Backblaze B2 S3 for data storage.

**Technology:** Next.js 15.5.9 + React 18 + TypeScript
**Styling:** Tailwind CSS (Dark Theme)
**Port:** 3000
**Location:** `/var/www/whatsapp-scheduler` (Saadi VPS)
**Process:** whatsapp-web (PM2)

---

## Architecture

### Application Structure

```
/var/www/whatsapp-scheduler/
├── app/                          # Next.js 15 App Router
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Home page
│   ├── schedule/
│   │   └── page.tsx              # Schedule messages page
│   ├── contacts/
│   │   └── page.tsx              # Contact management page
│   └── history/
│       └── page.tsx              # Message history page
│
├── components/                   # React components
│   ├── Layout.tsx                # Main layout wrapper
│   ├── Sidebar.tsx               # Navigation sidebar
│   ├── ScheduleButton.tsx        # Floating + button
│   ├── ScheduleModal.tsx         # Schedule message modal
│   ├── ContactPicker.tsx         # Contact selection component
│   ├── DateTimePicker.tsx        # Date/time input
│   ├── ContactCard.tsx           # Contact display card
│   └── MessageList.tsx           # Scheduled messages list
│
├── lib/                          # Utilities
│   ├── s3.ts                     # S3 client & operations
│   ├── contacts.ts               # Contact utilities
│   └── types.ts                  # TypeScript types
│
├── styles/
│   └── globals.css               # Global styles + Tailwind
│
├── public/                       # Static assets
│   ├── favicon.ico
│   └── logo.svg
│
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── tailwind.config.ts            # Tailwind config
└── next.config.js                # Next.js config
```

---

## Technology Stack

### Core Framework

**Next.js 15.5.9**
- App Router (not Pages Router)
- React Server Components
- Server Actions for S3 operations
- TypeScript support
- Hot Module Replacement (HMR)

**React 18**
- Hooks (useState, useEffect, useCallback)
- Context API for state management
- Suspense for loading states

**TypeScript**
- Strict type checking
- Type-safe S3 operations
- Interface definitions for all data structures

### Styling

**Tailwind CSS**
- Utility-first CSS framework
- Dark theme configuration
- Custom color palette
- Responsive design

**Color Palette:**
```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0a0a',        // Main background
          surface: '#1a1a1a',   // Card/panel background
          border: '#2a2a2a',    // Border color
          hover: '#2f2f2f',     // Hover state
          text: '#e5e5e5',      // Primary text
          'text-dim': '#a0a0a0' // Secondary text
        },
        primary: {
          DEFAULT: '#3b82f6',   // Blue
          hover: '#2563eb',
          light: '#60a5fa'
        },
        success: '#10b981',     // Green
        warning: '#f59e0b',     // Orange
        danger: '#ef4444'       // Red
      }
    }
  }
}
```

### Icons

**lucide-react**
- Modern, consistent icon set
- Tree-shakeable
- TypeScript support

**Common Icons:**
```typescript
import {
  Calendar,
  Clock,
  Send,
  User,
  Search,
  Star,
  Plus,
  X,
  Check,
  AlertCircle
} from 'lucide-react';
```

---

## Key Components

### 1. Layout Component

**File:** `components/Layout.tsx`

```typescript
import React from 'react';
import Sidebar from './Sidebar';
import ScheduleButton from './ScheduleButton';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function Layout({ children, title }: LayoutProps) {
  return (
    <div className="min-h-screen bg-dark-bg flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 p-8">
        {title && (
          <h1 className="text-3xl font-bold text-dark-text mb-8">
            {title}
          </h1>
        )}
        {children}
      </main>

      {/* Floating Schedule Button */}
      <ScheduleButton />
    </div>
  );
}
```

**Features:**
- Responsive sidebar
- Page title display
- Floating action button
- Full-height layout

### 2. Sidebar Component

**File:** `components/Sidebar.tsx`

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  Users,
  Clock,
  Settings
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: Calendar, label: 'Schedule' },
    { href: '/contacts', icon: Users, label: 'Contacts' },
    { href: '/history', icon: Clock, label: 'History' },
    { href: '/settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <aside className="w-64 bg-dark-surface border-r border-dark-border p-6">
      {/* Logo */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-dark-text">
          WhatsApp Scheduler
        </h2>
      </div>

      {/* Navigation */}
      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg
                transition-colors duration-200
                ${isActive
                  ? 'bg-primary text-white'
                  : 'text-dark-text-dim hover:bg-dark-hover hover:text-dark-text'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

**Features:**
- Active route highlighting
- Smooth hover transitions
- Icon + label navigation
- Responsive width

### 3. ScheduleModal Component

**File:** `components/ScheduleModal.tsx`

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Star } from 'lucide-react';
import { scheduleMessage } from '@/lib/s3';
import type { Contact } from '@/lib/types';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Record<string, Contact>;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  contacts
}: ScheduleModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [message, setMessage] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedContact(null);
      setMessage('');
      setScheduledTime('');
      setShowFavoritesOnly(false);
    }
  }, [isOpen]);

  // Filter contacts
  const filteredContacts = Object.entries(contacts)
    .filter(([phone, contact]) => {
      // Favorites filter
      if (showFavoritesOnly && !contact.favorite) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          contact.name.toLowerCase().includes(query) ||
          phone.includes(query) ||
          contact.aliases?.some(alias =>
            alias.toLowerCase().includes(query)
          )
        );
      }

      return true;
    })
    .map(([phone, contact]) => ({ phone, ...contact }));

  // Handle schedule
  const handleSchedule = async () => {
    if (!selectedContact || !message || !scheduledTime) return;

    setIsSubmitting(true);

    try {
      await scheduleMessage({
        to: selectedContact.phone,
        contactName: selectedContact.name,
        message,
        scheduledTime: new Date(scheduledTime).toISOString()
      });

      alert('Message scheduled successfully!');
      onClose();
    } catch (error) {
      console.error('Failed to schedule message:', error);
      alert('Failed to schedule message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-surface rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-dark-text">
            Schedule Message
          </h2>
          <button
            onClick={onClose}
            className="text-dark-text-dim hover:text-dark-text transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contact Selection */}
        <div className="mb-6">
          <label className="block text-dark-text mb-2 font-medium">
            Select Contact
          </label>

          {/* Search & Favorites Toggle */}
          <div className="flex gap-3 mb-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-text-dim" />
              <input
                type="text"
                placeholder="Search by name, phone, or alias..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-text-dim focus:outline-none focus:border-primary"
              />
            </div>

            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`
                px-4 py-2 rounded-lg border transition-colors
                ${showFavoritesOnly
                  ? 'bg-primary border-primary text-white'
                  : 'bg-dark-bg border-dark-border text-dark-text-dim hover:border-primary'
                }
              `}
            >
              <Star className="w-5 h-5" />
            </button>
          </div>

          {/* Contact Dropdown */}
          {selectedContact ? (
            <div className="flex items-center justify-between p-3 bg-dark-bg border border-primary rounded-lg">
              <div>
                <div className="text-dark-text font-medium">
                  {selectedContact.name}
                </div>
                <div className="text-dark-text-dim text-sm">
                  {selectedContact.phone}
                </div>
              </div>
              <button
                onClick={() => setSelectedContact(null)}
                className="text-danger hover:text-danger/80"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto bg-dark-bg border border-dark-border rounded-lg">
              {filteredContacts.length === 0 ? (
                <div className="p-4 text-center text-dark-text-dim">
                  No contacts found
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <button
                    key={contact.phone}
                    onClick={() => setSelectedContact(contact)}
                    className="w-full flex items-center justify-between p-3 hover:bg-dark-hover transition-colors text-left"
                  >
                    <div>
                      <div className="text-dark-text font-medium">
                        {contact.name}
                      </div>
                      <div className="text-dark-text-dim text-sm">
                        {contact.phone}
                      </div>
                    </div>
                    {contact.favorite && (
                      <Star className="w-4 h-4 text-warning fill-warning" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="mb-6">
          <label className="block text-dark-text mb-2 font-medium">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your message..."
            rows={4}
            className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text placeholder-dark-text-dim focus:outline-none focus:border-primary resize-none"
          />
          <div className="text-right text-dark-text-dim text-sm mt-1">
            {message.length} / 65536 characters
          </div>
        </div>

        {/* Date/Time Picker */}
        <div className="mb-6">
          <label className="block text-dark-text mb-2 font-medium">
            Schedule Time
          </label>
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text focus:outline-none focus:border-primary"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-dark-bg border border-dark-border rounded-lg text-dark-text hover:bg-dark-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={!selectedContact || !message || !scheduledTime || isSubmitting}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Message'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Features:**
- Type-to-search contacts
- Search by name, phone, or alias
- Favorites filter toggle
- Visual contact selection
- Character count display
- Date/time picker
- Form validation
- Loading states

### 4. ScheduleButton Component

**File:** `components/ScheduleButton.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import ScheduleModal from './ScheduleModal';

export default function ScheduleButton({ contacts }: { contacts: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary hover:bg-primary-hover text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
        aria-label="Schedule message"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Modal */}
      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        contacts={contacts}
      />
    </>
  );
}
```

---

## S3 Integration

### S3 Client Setup

**File:** `lib/s3.ts`

```typescript
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client
const s3Client = new S3Client({
  endpoint: process.env.B2_S3_ENDPOINT,
  region: 'eu-central-003',
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!
  }
});

// Helper: Stream to string
async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

// Load contacts from S3
export async function loadContacts() {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET!,
      Key: `${process.env.B2_PREFIX}contacts.json`
    });

    const response = await s3Client.send(command);
    const bodyString = await streamToString(response.Body);
    return JSON.parse(bodyString);
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return {};
    }
    throw error;
  }
}

// Load scheduled messages from S3
export async function loadScheduled() {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET!,
      Key: `${process.env.B2_PREFIX}scheduled.json`
    });

    const response = await s3Client.send(command);
    const bodyString = await streamToString(response.Body);
    return JSON.parse(bodyString);
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return { messages: [] };
    }
    throw error;
  }
}

// Schedule a message
export async function scheduleMessage(data: {
  to: string;
  contactName: string;
  message: string;
  scheduledTime: string;
}) {
  // Load existing messages
  const scheduled = await loadScheduled();

  // Generate unique ID
  const id = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // Create message object
  const newMessage = {
    id,
    to: data.to,
    contactName: data.contactName,
    message: data.message,
    scheduledTime: data.scheduledTime,
    status: 'pending',
    createdAt: new Date().toISOString(),
    createdFrom: 'web',
    sentAt: null,
    error: null
  };

  // Append to messages array
  scheduled.messages.push(newMessage);

  // Save to S3
  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET!,
    Key: `${process.env.B2_PREFIX}scheduled.json`,
    Body: JSON.stringify(scheduled, null, 2),
    ContentType: 'application/json'
  });

  await s3Client.send(command);

  return newMessage;
}

// Update contact
export async function updateContact(phone: string, updates: Partial<Contact>) {
  const contacts = await loadContacts();

  if (!contacts[phone]) {
    throw new Error('Contact not found');
  }

  contacts[phone] = {
    ...contacts[phone],
    ...updates
  };

  const command = new PutObjectCommand({
    Bucket: process.env.B2_BUCKET!,
    Key: `${process.env.B2_PREFIX}contacts.json`,
    Body: JSON.stringify(contacts, null, 2),
    ContentType: 'application/json'
  });

  await s3Client.send(command);

  return contacts[phone];
}
```

---

## TypeScript Types

**File:** `lib/types.ts`

```typescript
export interface Contact {
  name: string;
  aliases: string[];
  phones: {
    primary: string;
    secondary: string | null;
  };
  favorite: boolean;
  tags: string[];
}

export interface ScheduledMessage {
  id: string;
  to: string;
  contactName: string;
  message: string;
  scheduledTime: string;  // ISO8601
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;      // ISO8601
  createdFrom: 'web' | 'api' | 'cli';
  sentAt: string | null;  // ISO8601
  error: string | null;
}

export interface ChatMessage {
  message: string;
  timestamp: number;
  isFromMe: boolean;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'other';
  date: string;          // ISO8601
  rawMessage: any | null;
}

export interface Chat {
  id: string;
  messages: ChatMessage[];
  lastMessageTime: number;
  unreadCount: number;
  name: string;
  isGroup: boolean;
}
```

---

## Routing

### Next.js 15 App Router

**Route Structure:**
```
app/
├── page.tsx                    # / (Schedule page)
├── contacts/
│   └── page.tsx                # /contacts
├── history/
│   └── page.tsx                # /history
└── settings/
    └── page.tsx                # /settings
```

**Example Route:**
```typescript
// app/page.tsx
import Layout from '@/components/Layout';
import ScheduleButton from '@/components/ScheduleButton';
import { loadContacts, loadScheduled } from '@/lib/s3';

export default async function HomePage() {
  // Server-side data loading
  const contacts = await loadContacts();
  const scheduled = await loadScheduled();

  return (
    <Layout title="Scheduled Messages">
      {/* Message list */}
      <div className="grid gap-4">
        {scheduled.messages.map((msg) => (
          <div key={msg.id} className="bg-dark-surface p-4 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-dark-text">
                  {msg.contactName}
                </div>
                <div className="text-dark-text-dim text-sm">
                  {msg.message}
                </div>
              </div>
              <div className="text-right">
                <div className="text-dark-text-dim text-sm">
                  {new Date(msg.scheduledTime).toLocaleString()}
                </div>
                <div className={`
                  inline-block px-2 py-1 rounded text-xs mt-1
                  ${msg.status === 'sent' ? 'bg-success/20 text-success' :
                    msg.status === 'failed' ? 'bg-danger/20 text-danger' :
                    'bg-warning/20 text-warning'}
                `}>
                  {msg.status}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ScheduleButton contacts={contacts} />
    </Layout>
  );
}
```

---

## Deployment

### PM2 Configuration

```bash
# On Saadi VPS
cd /var/www/whatsapp-scheduler

# Install dependencies
npm install

# Build Next.js app
npm run build

# Start with PM2
pm2 start npm --name whatsapp-web -- start

# Save PM2 state
pm2 save

# Enable auto-start
pm2 startup
```

### Environment Variables

```env
# .env.local
B2_BUCKET=WhatsAppVPS
B2_S3_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
B2_ACCESS_KEY_ID=003abc123def456789
B2_SECRET_ACCESS_KEY=K003AbCdEf...
B2_PREFIX=whatsapp/
```

---

## File References

**Documentation:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/features/UI-DESIGN.md`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/features/SCHEDULE_MODAL_IMPROVEMENTS.md`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/ui-components/README.md`

**Code Examples:**
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/ui-components/ScheduleModal.tsx`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/ui-components/Layout.tsx`
- `/Users/saadi/Documents/GitHub/WhatsApp-VPSLink/docs/ui-components/Sidebar.tsx`

---

## Summary

The Web UI is a modern Next.js 15 application with a dark theme and intuitive interface. It uses React Server Components for data fetching, Tailwind CSS for styling, and communicates directly with S3 for data persistence. The enhanced contact picker with type-to-search and favorites filtering makes scheduling messages fast and efficient.
