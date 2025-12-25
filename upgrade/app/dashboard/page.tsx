'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Clock, CheckCircle, XCircle, AlertCircle, Globe } from 'lucide-react';
import type { ScheduledMessage, Contact } from '@/lib/s3';
import { utcToLocal } from '@/lib/timezones';
import MessageDetailModal from '@/components/MessageDetailModal';

export default function DashboardPage() {
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [loading, setLoading] = useState(true);
  const [errorModal, setErrorModal] = useState<ScheduledMessage | null>(null);
  const [detailModal, setDetailModal] = useState<ScheduledMessage | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Format time with dual timezone display
  const formatDualTime = (msg: ScheduledMessage) => {
    const utcDate = new Date(msg.scheduledTime);
    const ukTime = new Date(utcDate).toLocaleString('en-GB', {
      timeZone: 'Europe/London',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    // If message has recipient timezone metadata, show both times
    if (msg.recipientTimezone && msg.recipientTimezone !== 'Europe/London') {
      const recipientTime = new Date(utcDate).toLocaleString('en-GB', {
        timeZone: msg.recipientTimezone,
        dateStyle: 'short',
        timeStyle: 'short'
      });
      return { ukTime, recipientTime, timezone: msg.recipientTimezone };
    }

    return { ukTime, recipientTime: null, timezone: null };
  };

  useEffect(() => {
    // Load contacts, single messages, and multi-message jobs
    setConnectionError(null);
    Promise.all([
      fetch('/api/contacts').then(r => r.json()),
      fetch('/api/scheduled').then(r => r.json()),
      fetch('/api/scheduler/jobs').then(r => r.json())
    ]).then(([contactsData, singleData, jobsData]) => {
      // Check for S3/database errors
      if (contactsData.error || singleData.error || jobsData.error) {
        const errorMsg = contactsData.error || singleData.error || jobsData.error;
        setConnectionError(`Database connection error: ${errorMsg}`);
        setLoading(false);
        return;
      }

      setContacts(contactsData);
      const singleMessages = singleData.messages || [];
      const jobs = jobsData || [];

      // Helper function to get contact name from phone
      const getContactName = (phone: string) => {
        const cleanPhone = phone.replace('@s.whatsapp.net', '');
        const contact = (Object.values(contactsData) as Contact[]).find((c) =>
          c.phones?.primary === cleanPhone || c.phones?.secondary === cleanPhone
        );
        return contact?.name || cleanPhone;
      };

      // Normalize jobs to match ScheduledMessage format
      const normalizedJobs = jobs.map((job: any) => {
        const recipientPhone = job.recipients[0]?.replace('@s.whatsapp.net', '') || 'Unknown';
        const contactName = getContactName(job.recipients[0] || '');

        // Extract actual message content from message parts
        const messageContent = job.messageParts
          .map((part: any) => part.text)
          .join('\n\n');

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
          id: job.id,
          to: recipientPhone,
          contactName: contactName,
          message: messageContent,
          scheduledTime: job.scheduledStartAt,
          status: actualStatus,
          createdAt: job.createdAt,
          createdFrom: 'web',
          sentAt: job.completedAt || null,
          error: job.error,
          recipientTimezone: job.timezoneMetadata?.recipientTimezone,
          recipientLocalTime: job.timezoneMetadata?.recipientLocalTime,
          scheduledInTimezone: job.timezoneMetadata?.scheduledInTimezone,
          isMultiPart: job.messageParts.length > 1
        };
      });

      setScheduled([...singleMessages, ...normalizedJobs]);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load messages:', err);
      setLoading(false);
    });
  }, []);

  const pendingCount = scheduled.filter(m => m.status === 'pending').length;
  const sentCount = scheduled.filter(m => m.status === 'sent').length;
  const failedCount = scheduled.filter(m => m.status === 'failed').length;

  const upcomingMessages = scheduled
    .filter(m => m.status === 'pending')
    .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
    .slice(0, 5);

  const failedMessages = scheduled
    .filter(m => m.status === 'failed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <Layout>
      {({ openScheduleModal }: any) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Dashboard</h1>
            <p className="text-[#a3a3a3] mt-1">Overview of your scheduled messages</p>
          </div>

          {/* Connection Error Alert */}
          {connectionError && (
            <div className="card bg-red-500/10 border-red-500/20">
              <div className="flex items-start gap-3">
                <div className="text-red-500 text-xl">⚠️</div>
                <div className="flex-1">
                  <h3 className="text-red-500 font-semibold mb-1">Connection Error</h3>
                  <p className="text-red-400 text-sm">{connectionError}</p>
                  <p className="text-[#a3a3a3] text-xs mt-2">
                    The database connection failed. Your messages are safe but cannot be displayed right now.
                    Please refresh the page or contact support if this persists.
                  </p>
                  <button
                    onClick={() => {
                      setLoading(true);
                      setConnectionError(null);
                      window.location.reload();
                    }}
                    className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#a3a3a3] text-sm">Pending</p>
                  <p className="text-4xl font-bold text-white mt-1">{pendingCount}</p>
                </div>
                <Clock className="text-yellow-500" size={32} />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#a3a3a3] text-sm">Sent</p>
                  <p className="text-4xl font-bold text-white mt-1">{sentCount}</p>
                </div>
                <CheckCircle className="text-green-500" size={32} />
              </div>
            </div>

            <div className="card cursor-pointer hover:ring-2 hover:ring-red-500/50 transition-all" onClick={() => { if (failedCount > 0) window.location.href = '/scheduled'; }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#a3a3a3] text-sm">Failed</p>
                  <p className="text-4xl font-bold text-red-500 mt-1">{failedCount}</p>
                </div>
                <XCircle className="text-red-500" size={32} />
              </div>
              {failedCount > 0 && (
                <p className="text-xs text-red-400 mt-2">⚠ Click to view failed messages</p>
              )}
            </div>
          </div>

          {/* Failed Messages Alert */}
          {failedMessages.length > 0 && (
            <div className="card bg-red-500/10 border-red-500/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-500 flex-shrink-0 mt-1" size={20} />
                <div className="flex-1">
                  <h3 className="text-red-500 font-semibold mb-2">Failed Messages</h3>
                  <div className="space-y-2">
                    {failedMessages.map(msg => (
                      <div
                        key={msg.id}
                        onClick={() => setDetailModal(msg)}
                        className="p-3 bg-[#1a1a1a] border border-red-500/30 rounded-lg cursor-pointer hover:bg-[#2d2d2d] transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-white font-medium">{msg.contactName}</p>
                          <span className="badge-failed">FAILED</span>
                        </div>
                        <p className="text-sm text-[#a3a3a3] truncate mb-1">{msg.message}</p>
                        <div className="flex items-center justify-between text-xs">
                          <div>
                            <p className="text-[#737373]">
                              🇬🇧 UK: {formatDualTime(msg).ukTime}
                            </p>
                            {formatDualTime(msg).recipientTime && (
                              <p className="text-[#737373] mt-0.5">
                                <Globe size={12} className="inline mr-1" />
                                Their time: {formatDualTime(msg).recipientTime}
                              </p>
                            )}
                          </div>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              openScheduleModal({
                                contactPhone: msg.to,
                                contactName: msg.contactName,
                                message: msg.message
                              });
                            }}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            Reschedule →
                          </button>
                        </div>
                        {msg.error && (
                          <p className="text-xs text-red-400 mt-2 bg-red-500/10 p-2 rounded">
                            💥 {msg.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Messages */}
          {upcomingMessages.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-4">Upcoming Messages</h2>
              <div className="space-y-3">
                {upcomingMessages.map(msg => (
                  <div
                    key={msg.id}
                    onClick={() => setDetailModal(msg)}
                    className="p-4 bg-[#0a0a0a] border border-[#404040] rounded-lg hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-white font-medium">{msg.contactName}</p>
                      <div className="text-sm text-right">
                        <p className="text-[#a3a3a3]">🇬🇧 {formatDualTime(msg).ukTime}</p>
                        {formatDualTime(msg).recipientTime && (
                          <p className="text-[#737373] text-xs mt-0.5">
                            <Globe size={10} className="inline mr-1" />
                            {formatDualTime(msg).recipientTime}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-[#737373] truncate">{msg.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Detail Modal */}
          {detailModal && (
            <MessageDetailModal
              message={detailModal}
              onClose={() => setDetailModal(null)}
              onEdit={(msg) => {
                setDetailModal(null);
                openScheduleModal({
                  contactPhone: msg.to,
                  contactName: msg.contactName,
                  message: msg.message,
                  scheduledTime: msg.scheduledTime,
                  messageId: msg.id,
                  recipientTimezone: msg.recipientTimezone,
                  scheduledInTimezone: msg.scheduledInTimezone
                });
              }}
            />
          )}

          {/* Error Detail Modal */}
          {errorModal && (
            <>
              <div
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
                onClick={() => setErrorModal(null)}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-[#1a1a1a] border border-red-500/50 rounded-xl w-full max-w-2xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <XCircle className="text-red-500" size={32} />
                    <div>
                      <h2 className="text-xl font-semibold text-white">Message Failed</h2>
                      <p className="text-sm text-[#a3a3a3]">Details about why this message failed</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-[#737373] mb-1">Contact</p>
                      <p className="text-white font-medium">{errorModal.contactName}</p>
                      <p className="text-sm text-[#a3a3a3] font-mono">{errorModal.to}</p>
                    </div>

                    <div>
                      <p className="text-sm text-[#737373] mb-1">Message</p>
                      <p className="text-white">{errorModal.message}</p>
                    </div>

                    <div>
                      <p className="text-sm text-[#737373] mb-2">Scheduled Time</p>
                      <div className="space-y-1">
                        <p className="text-white flex items-center gap-2">
                          🇬🇧 UK: {new Date(errorModal.scheduledTime).toLocaleString('en-GB', {
                            timeZone: 'Europe/London',
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </p>
                        {formatDualTime(errorModal).recipientTime && (
                          <p className="text-white flex items-center gap-2">
                            <Globe size={14} />
                            Their time: {new Date(errorModal.scheduledTime).toLocaleString('en-GB', {
                              timeZone: formatDualTime(errorModal).timezone!,
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-[#737373] mb-1">Created</p>
                      <p className="text-white">
                        {new Date(errorModal.createdAt).toLocaleString('en-GB', {
                          timeZone: 'Europe/London',
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </p>
                    </div>

                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-sm text-[#737373] mb-2">Error Details</p>
                      <p className="text-red-400 font-mono text-sm">
                        {errorModal.error || 'Unknown error - message failed to send'}
                      </p>
                    </div>

                    <div className="bg-[#0a0a0a] border border-[#404040] p-4 rounded-lg">
                      <p className="text-sm text-[#737373] mb-2">Common Causes:</p>
                      <ul className="text-sm text-[#a3a3a3] space-y-1 list-disc list-inside">
                        <li>Phone number not on WhatsApp</li>
                        <li>Invalid phone number format</li>
                        <li>Number blocked/doesn't exist</li>
                        <li>WhatsApp connection timeout</li>
                        <li>Recipient privacy settings</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-6">
                    <button
                      onClick={() => setErrorModal(null)}
                      className="btn-secondary"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setErrorModal(null);
                        openScheduleModal({
                          contactPhone: errorModal.to,
                          contactName: errorModal.contactName,
                          message: errorModal.message
                        });
                      }}
                      className="btn-primary"
                    >
                      Reschedule Message
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Layout>
  );
}
