/**
 * Main Layout Component
 * Combines sidebar + main content area + schedule button
 */

'use client';

import Sidebar from './Sidebar';
import ScheduleButton from './ScheduleButton';
import { useState } from 'react';
import ScheduleModal from './ScheduleModal';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="ml-60 min-h-screen">
        <div className="max-w-7xl mx-auto p-8">
          {children}
        </div>
      </main>

      {/* Floating Schedule Button */}
      <ScheduleButton onClick={() => setShowScheduleModal(true)} />

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal onClose={() => setShowScheduleModal(false)} />
      )}
    </div>
  );
}
