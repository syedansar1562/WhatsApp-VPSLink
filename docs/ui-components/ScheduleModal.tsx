/**
 * Schedule New Message Modal
 * Dark themed modal with contact picker, message input, date/time
 */

'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface ScheduleModalProps {
  onClose: () => void;
}

export default function ScheduleModal({ onClose }: ScheduleModalProps) {
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // API call to schedule message
    // Then close modal
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-fadeIn"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="
            bg-[#1a1a1a] border border-[#404040] rounded-xl
            w-full max-w-2xl p-6
            animate-slideUp
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">
              Schedule New Message
            </h2>
            <button
              onClick={onClose}
              className="text-[#a3a3a3] hover:text-white transition-colors p-1"
            >
              <X size={24} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Select */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Contact <span className="text-red-500">*</span>
              </label>
              <select
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                required
                className="
                  w-full px-4 py-3 rounded-lg
                  bg-[#2d2d2d] border border-[#404040]
                  text-white text-sm
                  focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20
                  transition-colors
                "
              >
                <option value="">Select a contact</option>
                <option value="447950724774">⭐ Nick Smith (+44 795...)</option>
                <option value="447779299086">Syed Ansar (+44 777...)</option>
                <option value="447123456789">John Doe (+44 712...)</option>
              </select>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
                placeholder="Enter your message..."
                className="
                  w-full px-4 py-3 rounded-lg
                  bg-[#2d2d2d] border border-[#404040]
                  text-white text-sm placeholder:text-[#737373]
                  focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20
                  transition-colors resize-y
                "
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="
                    w-full px-4 py-3 rounded-lg
                    bg-[#2d2d2d] border border-[#404040]
                    text-white text-sm
                    focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20
                    transition-colors
                    [color-scheme:dark]
                  "
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="
                    w-full px-4 py-3 rounded-lg
                    bg-[#2d2d2d] border border-[#404040]
                    text-white text-sm
                    focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20
                    transition-colors
                    [color-scheme:dark]
                  "
                />
              </div>
            </div>

            {/* Timezone Info */}
            <p className="text-xs text-[#737373]">
              🌍 Timezone: Europe/London (UK)
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="
                  px-6 py-2.5 rounded-lg
                  bg-[#2d2d2d] border border-[#404040]
                  text-white text-sm font-medium
                  hover:bg-[#3a3a3a] hover:border-[#525252]
                  transition-colors
                "
              >
                Cancel
              </button>

              <button
                type="submit"
                className="
                  px-6 py-2.5 rounded-lg
                  bg-blue-500 text-white text-sm font-semibold
                  hover:bg-blue-600
                  transition-colors
                  active:scale-95
                "
              >
                Schedule Message
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
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

        .animate-fadeIn {
          animation: fadeIn 200ms ease;
        }

        .animate-slideUp {
          animation: slideUp 300ms cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </>
  );
}
