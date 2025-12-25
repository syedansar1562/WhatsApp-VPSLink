'use client';

import { X, Clock, User, MessageSquare, Edit } from 'lucide-react';
import type { ScheduledMessage } from '@/lib/s3';

interface MessageDetailModalProps {
  message: ScheduledMessage;
  onClose: () => void;
  onEdit?: (message: ScheduledMessage) => void;
}

export default function MessageDetailModal({ message, onClose, onEdit }: MessageDetailModalProps) {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      dateStyle: 'full',
      timeStyle: 'long'
    });
  };

  const formatLocalTime = (dateString: string, timezone?: string) => {
    if (!timezone || timezone === 'Europe/London') return null;

    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      timeZone: timezone,
      dateStyle: 'full',
      timeStyle: 'long'
    });
  };

  const isMultiPart = message.message?.includes('message parts to');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-[#404040]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#404040]">
          <h2 className="text-2xl font-bold text-white">Message Details</h2>
          <button
            onClick={onClose}
            className="text-[#737373] hover:text-white transition-colors p-2 hover:bg-[#2d2d2d] rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Recipient */}
          <div>
            <div className="flex items-center gap-2 text-[#a3a3a3] text-sm mb-2">
              <User size={16} />
              <span className="font-medium">Recipient</span>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#404040]">
              <p className="text-white font-medium text-lg">{message.contactName || 'Unknown'}</p>
              <p className="text-[#a3a3a3] text-sm font-mono mt-1">{message.to}</p>
            </div>
          </div>

          {/* Scheduled Time */}
          <div>
            <div className="flex items-center gap-2 text-[#a3a3a3] text-sm mb-2">
              <Clock size={16} />
              <span className="font-medium">Scheduled Time</span>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#404040] space-y-3">
              <div>
                <p className="text-xs text-[#737373] mb-1">🇬🇧 UK Time</p>
                <p className="text-white">{formatDateTime(message.scheduledTime)}</p>
              </div>
              {message.recipientTimezone && message.recipientTimezone !== 'Europe/London' && (
                <div className="pt-3 border-t border-[#404040]">
                  <p className="text-xs text-[#737373] mb-1">🌍 Recipient Local Time</p>
                  <p className="text-white">{formatLocalTime(message.scheduledTime, message.recipientTimezone)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Message Content */}
          <div>
            <div className="flex items-center gap-2 text-[#a3a3a3] text-sm mb-2">
              <MessageSquare size={16} />
              <span className="font-medium">{isMultiPart ? 'Multi-Part Message' : 'Message'}</span>
            </div>
            {isMultiPart ? (
              <div className="space-y-3">
                {message.message.split('\n\n').filter(part => part.trim()).map((part, index) => (
                  <div key={index} className="bg-[#0a0a0a] rounded-lg p-4 border border-[#404040]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-[#737373] font-medium">Part {index + 1}</span>
                    </div>
                    <p className="text-white whitespace-pre-wrap">{part}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#404040]">
                <p className="text-white whitespace-pre-wrap">{message.message}</p>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <div className="flex items-center gap-2 text-[#a3a3a3] text-sm mb-2">
              <span className="font-medium">Status</span>
            </div>
            <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#404040]">
              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                message.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                message.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {message.status === 'sent' ? '✓ Sent' :
                 message.status === 'failed' ? '✗ Failed' :
                 '⏳ Pending'}
              </span>
              {message.sentAt && (
                <p className="text-[#737373] text-sm mt-2">
                  Sent at: {formatDateTime(message.sentAt)}
                </p>
              )}
              {message.error && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{message.error}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#404040] flex gap-3">
          {message.status === 'pending' && onEdit && (
            <button
              onClick={() => onEdit(message)}
              className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <Edit size={18} />
              Edit Message
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-[#2d2d2d] text-white rounded-lg hover:bg-[#404040] transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
