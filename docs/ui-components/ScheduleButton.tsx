/**
 * Floating + Button for Schedule New Message
 * Fixed position top-right with blue accent
 */

'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

interface ScheduleButtonProps {
  onClick?: () => void;
}

export default function ScheduleButton({ onClick }: ScheduleButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="
        fixed top-8 right-8 z-50
        w-14 h-14 rounded-full
        bg-blue-500 hover:bg-blue-600
        text-white
        flex items-center justify-center
        transition-all duration-200
        active:scale-95
        shadow-lg shadow-blue-500/40
        hover:shadow-xl hover:shadow-blue-500/50
      "
      aria-label="Schedule new message"
    >
      <Plus
        size={24}
        className={`transition-transform duration-200 ${
          isHovered ? 'rotate-90' : 'rotate-0'
        }`}
      />
    </button>
  );
}
