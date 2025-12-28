'use client';

import { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import ScheduleButton from './ScheduleButton';
import ScheduleModal from './ScheduleModal';

export interface ScheduleModalData {
  contactPhone?: string;
  contactName?: string;
  message?: string;
  scheduledTime?: string;
  messageId?: string;
  recipientTimezone?: string;
  scheduledInTimezone?: string;
}

interface LayoutChildProps {
  openScheduleModal: (data?: ScheduleModalData) => void;
}

interface LayoutProps {
  children: ReactNode | ((props: LayoutChildProps) => ReactNode);
  hideScheduleButton?: boolean;
}

export default function Layout({ children, hideScheduleButton = false }: LayoutProps) {
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [modalInitialData, setModalInitialData] = useState<ScheduleModalData>({});

  const openScheduleModal = (data: ScheduleModalData = {}) => {
    setModalInitialData(data);
    setShowScheduleModal(true);
  };

  const closeScheduleModal = () => {
    setShowScheduleModal(false);
    setModalInitialData({});
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="ml-60 min-h-screen p-8">
        {typeof children === 'function' ? children({ openScheduleModal }) : children}
      </main>
      {!hideScheduleButton && <ScheduleButton onClick={() => openScheduleModal()} />}
      {showScheduleModal && (
        <ScheduleModal
          onClose={closeScheduleModal}
          initialData={modalInitialData}
        />
      )}
    </div>
  );
}
