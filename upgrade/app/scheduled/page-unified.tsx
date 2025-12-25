'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Search, Trash2, Eye, Edit2, RotateCw, Globe } from 'lucide-react';
import { utcToLocal } from '@/lib/timezones';
import MessageDetailModal from '@/components/MessageDetailModal';
import type { ScheduledMessage } from '@/lib/s3';

interface Message {
  id: string;
  type: 'single' | 'multi';
  recipients: string[];
  messageParts: Array<{ text: string }>;
  scheduledStartAt: string;
  status: string;
  progress?: {
    recipientsSent: number;
    recipientsFailed: number;
  };
  to?: string;
  contactName?: string;
  message?: string;
  scheduledTime?: string;
  sentAt?: string;
  error?: string;
  // Timezone metadata
  recipientTimezone?: string;
  recipientLocalTime?: string;
  scheduledInTimezone?: string;
  timezoneMetadata?: {
    recipientTimezone?: string;
    recipientLocalTime?: string;
    scheduledInTimezone?: string;
  };
}

export default function ScheduledPage() {
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState({});
  const [viewingMessage, setViewingMessage] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllMessages();
    loadContacts();
  }, []);

  const loadAllMessages = async () => {
    try {
      setError(null);
      // Load both single messages and multi-message jobs
      const [singleRes, multiRes] = await Promise.all([
        fetch('/api/scheduled'),
        fetch('/api/scheduler/jobs')
      ]);

      const singleData = await singleRes.json();
      const multiData = await multiRes.json();

      // Check for S3/database errors
      if (singleData.error || multiData.error) {
        const errorMsg = singleData.error || multiData.error;
        setError(`Database connection error: ${errorMsg}`);
        setLoading(false);
        return;
      }

      // Normalize single messages
      const singleMessages = (singleData.messages || []).map((msg: any) => ({
        ...msg,
        type: 'single',
        recipients: [msg.to],
        messageParts: [{ text: msg.message }],
        scheduledStartAt: msg.scheduledTime,
        progress: {
          recipientsSent: msg.status === 'sent' ? 1 : 0,
          recipientsFailed: msg.status === 'failed' ? 1 : 0
        }
      }));

      // Normalize multi-message jobs
      const multiMessages = (multiData || []).map((job: any) => {
        // Determine actual status based on progress
        let actualStatus = job.status;
        if (job.status === 'completed') {
          // Check if any recipients failed
          if (job.progress?.recipientsFailed > 0) {
            actualStatus = 'failed';
          } else if (job.progress?.recipientsSent > 0) {
            actualStatus = 'sent';
          } else {
            // Completed but nothing sent or failed - treat as failed
            actualStatus = 'failed';
          }
        }

        return {
          ...job,
          type: 'multi',
          status: actualStatus
        };
      });

      // Combine and sort by scheduled time
      const combined = [...singleMessages, ...multiMessages].sort((a, b) =>
        new Date(b.scheduledStartAt).getTime() - new Date(a.scheduledStartAt).getTime()
      );

      setAllMessages(combined);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const response = await fetch('/api/contacts');
      const data = await response.json();
      setContacts(data || {});
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };


  const handleDelete = async (msg: Message) => {
    if (!confirm('Delete this scheduled message?')) return;

    try {
      if (msg.type === 'single') {
        // Delete from scheduled.json
        const response = await fetch('/api/scheduled');
        const data = await response.json();
        const updated = { messages: data.messages.filter((m: any) => m.id !== msg.id) };
        await fetch('/api/scheduled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
      } else {
        // Delete job
        await fetch(`/api/scheduler/jobs?jobId=${msg.id}`, { method: 'DELETE' });
      }

      await loadAllMessages();
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete message');
    }
  };

  const handleEdit = (msg: Message, openScheduleModal: any) => {
    const messageContent = msg.message || msg.messageParts.map(p => p.text).join('\n\n');
    const scheduledTime = msg.scheduledTime || msg.scheduledStartAt;

    openScheduleModal({
      contactPhone: msg.to || msg.recipients[0]?.replace('@s.whatsapp.net', ''),
      contactName: msg.contactName,
      message: messageContent,
      scheduledTime: scheduledTime,
      messageId: msg.id,
      recipientTimezone: msg.recipientTimezone || msg.timezoneMetadata?.recipientTimezone,
      scheduledInTimezone: msg.scheduledInTimezone || msg.timezoneMetadata?.scheduledInTimezone
    });
  };

  const handleResend = (msg: Message, openScheduleModal: any) => {
    const messageContent = msg.message || msg.messageParts.map(p => p.text).join('\n\n');

    openScheduleModal({
      contactPhone: msg.to || msg.recipients[0]?.replace('@s.whatsapp.net', ''),
      contactName: msg.contactName,
      message: messageContent,
      scheduledTime: '', // Empty time so user can set new schedule
      messageId: '' // Don't pass messageId so it creates new message instead of editing
    });
  };

  const filteredMessages = allMessages.filter(msg => {
    const matchesSearch = search === '' ||
      msg.messageParts.some(p => p.text.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || msg.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: allMessages.length,
    pending: allMessages.filter(m => m.status === 'pending').length,
    sent: allMessages.filter(m => m.status === 'sent' || m.status === 'completed').length,
    failed: allMessages.filter(m => m.status === 'failed').length,
  };

  const getStatusBadge = (status: string) => {
    const normalized = status === 'completed' ? 'sent' : status;
    return <span className={`badge-${normalized}`}>{normalized}</span>;
  };

  const formatMessage = (parts: Array<{ text: string }>) => {
    if (parts.length === 1) {
      const text = parts[0].text;
      return text.length > 80 ? text.substring(0, 80) + '...' : text;
    }
    return `${parts.length} message parts`;
  };

  const formatRecipients = (recipients: string[]) => {
    if (recipients.length === 1) {
      const jid = recipients[0];
      // Look up contact name from contacts object
      const contactEntry = Object.entries(contacts).find(([_, contact]: [string, any]) => {
        const contactJid = contact.phones.primary.includes('@')
          ? contact.phones.primary
          : `${contact.phones.primary}@s.whatsapp.net`;
        return contactJid === jid;
      });
      return contactEntry ? (contactEntry[1] as any).name : jid.replace('@s.whatsapp.net', '');
    }
    return `${recipients.length} recipients`;
  };

  // Format time with dual timezone display
  const formatDualTime = (msg: Message) => {
    const utcDate = new Date(msg.scheduledStartAt);
    const ukTime = new Date(utcDate).toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    // Check both direct properties and nested timezoneMetadata
    const recipientTz = msg.recipientTimezone || msg.timezoneMetadata?.recipientTimezone;

    // If message has recipient timezone metadata, show both times
    if (recipientTz && recipientTz !== 'Europe/London') {
      const recipientTime = new Date(utcDate).toLocaleString('en-GB', {
        timeZone: recipientTz,
        dateStyle: 'short',
        timeStyle: 'short'
      });
      return { ukTime, recipientTime, timezone: recipientTz };
    }

    return { ukTime, recipientTime: null, timezone: null };
  };

  return (
    <Layout>
      {({ openScheduleModal }: any) => (
      <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Scheduled Messages</h1>
            <p className="text-[#a3a3a3] mt-1">View and manage all scheduled messages</p>
          </div>

          <div className="flex gap-4 items-center flex-wrap">
            <div className="flex gap-2">
              {(['all', 'pending', 'sent', 'failed'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' + (statusFilter === status ? 'bg-blue-500 text-white' : 'bg-[#2d2d2d] text-[#a3a3a3] hover:bg-[#3a3a3a]')}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status]})
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737373]" size={18} />
              <input
                type="text"
                placeholder="Search messages..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input w-full pl-11"
              />
            </div>
          </div>

          {error && (
            <div className="card bg-red-500/10 border-red-500/20 mb-4">
              <div className="flex items-start gap-3">
                <div className="text-red-500 text-xl">⚠️</div>
                <div className="flex-1">
                  <h3 className="text-red-500 font-semibold mb-1">Connection Error</h3>
                  <p className="text-red-400 text-sm">{error}</p>
                  <p className="text-[#a3a3a3] text-xs mt-2">
                    The database connection failed. Your messages are safe but cannot be displayed right now.
                    Please refresh the page or contact support if this persists.
                  </p>
                  <button
                    onClick={() => {
                      setLoading(true);
                      loadAllMessages();
                    }}
                    className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            {loading ? (
              <p className="text-[#737373]">Loading...</p>
            ) : error ? null : filteredMessages.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[#737373]">No messages found</p>
                <p className="text-sm text-[#737373] mt-1">Click the + button to schedule one</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#404040]">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Recipients</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Message</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Scheduled</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Progress</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMessages.map(msg => (
                      <tr
                        key={msg.id}
                        className="border-b border-[#404040] last:border-0 hover:bg-[#2d2d2d] transition-colors cursor-pointer"
                        onClick={() => setViewingMessage(msg)}
                      >
                        <td className="py-4 px-4">
                          <p className="text-white text-sm">{formatRecipients(msg.recipients)}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-[#a3a3a3] text-sm">{formatMessage(msg.messageParts)}</p>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm">
                            <p className="text-white whitespace-nowrap">
                              🇬🇧 {formatDualTime(msg).ukTime}
                            </p>
                            {formatDualTime(msg).recipientTime && (
                              <p className="text-[#737373] text-xs mt-1 whitespace-nowrap flex items-center gap-1">
                                <Globe size={10} />
                                {formatDualTime(msg).recipientTime}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {getStatusBadge(msg.status)}
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-white text-sm">
                            {msg.type === 'multi' && msg.progress
                              ? `${msg.progress.recipientsSent}/${msg.recipients.length} recipients`
                              : msg.status === 'sent' || msg.status === 'completed'
                              ? `1/1 sent`
                              : `0/1 sent`
                            }
                          </p>
                          {msg.type === 'multi' && msg.messageParts.length > 1 && (
                            <p className="text-xs text-[#737373]">
                              {msg.messageParts.length} parts per recipient
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {msg.status === 'pending' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(msg, openScheduleModal);
                                  }}
                                  className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                                  title="Edit"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(msg);
                                  }}
                                  className="text-red-400 hover:text-red-300 transition-colors p-1"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                            {(msg.status === 'sent' || msg.status === 'completed' || msg.status === 'failed') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResend(msg, openScheduleModal);
                                }}
                                className="text-green-400 hover:text-green-300 transition-colors p-1"
                                title="Resend"
                              >
                                <RotateCw size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Message Detail Modal */}
          {viewingMessage && (
            <MessageDetailModal
              message={{
                id: viewingMessage.id,
                to: viewingMessage.to || viewingMessage.recipients[0]?.replace('@s.whatsapp.net', '') || 'Unknown',
                contactName: viewingMessage.contactName || viewingMessage.recipients[0]?.replace('@s.whatsapp.net', '') || 'Unknown',
                message: viewingMessage.message || viewingMessage.messageParts.map(p => p.text).join('\n\n'),
                scheduledTime: viewingMessage.scheduledTime || viewingMessage.scheduledStartAt,
                status: (viewingMessage.status === 'completed' ? 'sent' : viewingMessage.status) as 'pending' | 'sent' | 'failed',
                createdAt: viewingMessage.scheduledStartAt,
                createdFrom: 'web',
                sentAt: viewingMessage.sentAt || null,
                error: viewingMessage.error,
                recipientTimezone: viewingMessage.recipientTimezone || viewingMessage.timezoneMetadata?.recipientTimezone,
                recipientLocalTime: viewingMessage.recipientLocalTime || viewingMessage.timezoneMetadata?.recipientLocalTime,
                scheduledInTimezone: viewingMessage.scheduledInTimezone || viewingMessage.timezoneMetadata?.scheduledInTimezone
              }}
              onClose={() => setViewingMessage(null)}
              onEdit={(msg) => {
                setViewingMessage(null);
                handleEdit(viewingMessage, openScheduleModal);
              }}
            />
          )}
      </div>
      )}
    </Layout>
  );
}
