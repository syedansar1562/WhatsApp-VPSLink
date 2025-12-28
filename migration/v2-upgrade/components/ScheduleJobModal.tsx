// ScheduleJobModal.tsx
// Location on Saadi VPS: /var/www/whatsapp-scheduler/components/ScheduleJobModal.tsx
//
// Purpose: Multi-message, multi-recipient scheduling modal for Phase 1
// Created: December 24, 2025

'use client';

import { useState } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';

export interface MessagePart {
  orderIndex: number;
  text: string;
  delayAfterSeconds: number | null;
}

export interface JobConfig {
  intervalMode: 'manual' | 'auto';
  recipientGapSeconds: number;
  maxRetries: number;
}

export interface ScheduleJobData {
  recipients: string[];
  messageParts: MessagePart[];
  scheduledStartAt: string;
  config: JobConfig;
}

interface Contact {
  jid: string;
  displayName?: string;
  phone: string;
  isFavorite?: boolean;
}

interface ScheduleJobModalProps {
  contacts: Contact[];
  onClose: () => void;
  onSubmit: (jobData: ScheduleJobData) => Promise<void>;
}

export default function ScheduleJobModal({ contacts, onClose, onSubmit }: ScheduleJobModalProps) {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [messageParts, setMessageParts] = useState<MessagePart[]>([
    { orderIndex: 0, text: '', delayAfterSeconds: 3 }
  ]);
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [recipientGapSeconds, setRecipientGapSeconds] = useState(30);
  const [maxRetries, setMaxRetries] = useState(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter contacts based on search
  const filteredContacts = contacts.filter(contact => {
    const query = searchQuery.toLowerCase();
    return (
      contact.displayName?.toLowerCase().includes(query) ||
      contact.phone.includes(query)
    );
  });

  // Message part handlers
  const addMessagePart = () => {
    setMessageParts([
      ...messageParts,
      {
        orderIndex: messageParts.length,
        text: '',
        delayAfterSeconds: 3
      }
    ]);
  };

  const removeMessagePart = (index: number) => {
    if (messageParts.length === 1) return; // Keep at least one part

    const updated = messageParts.filter((_, i) => i !== index);
    // Re-index
    const reindexed = updated.map((part, i) => ({
      ...part,
      orderIndex: i
    }));
    setMessageParts(reindexed);
  };

  const updateMessagePart = (index: number, field: keyof MessagePart, value: any) => {
    const updated = [...messageParts];
    updated[index] = { ...updated[index], [field]: value };
    setMessageParts(updated);
  };

  // Recipient handlers
  const toggleRecipient = (jid: string) => {
    if (recipients.includes(jid)) {
      setRecipients(recipients.filter(r => r !== jid));
    } else {
      setRecipients([...recipients, jid]);
    }
  };

  const toggleAllRecipients = () => {
    if (recipients.length === filteredContacts.length) {
      setRecipients([]);
    } else {
      setRecipients(filteredContacts.map(c => c.jid));
    }
  };

  // Validation
  const isValid = () => {
    return (
      recipients.length > 0 &&
      messageParts.length > 0 &&
      messageParts.every(p => p.text.trim().length > 0) &&
      scheduledStartAt.length > 0
    );
  };

  // Submit
  const handleSubmit = async () => {
    if (!isValid()) return;

    setIsSubmitting(true);
    try {
      const jobData: ScheduleJobData = {
        recipients,
        messageParts,
        scheduledStartAt,
        config: {
          intervalMode: 'manual',
          recipientGapSeconds,
          maxRetries
        }
      };

      await onSubmit(jobData);
      onClose();
    } catch (error) {
      console.error('Error submitting job:', error);
      alert('Failed to schedule job. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate estimated completion time
  const calculateEstimatedDuration = () => {
    const messagesPerRecipient = messageParts.reduce((sum, part) => {
      return sum + (part.delayAfterSeconds || 0);
    }, 0);

    const totalRecipients = recipients.length;
    const recipientGaps = Math.max(0, (totalRecipients - 1) * recipientGapSeconds);
    const totalSeconds = (messagesPerRecipient * totalRecipients) + recipientGaps;

    return totalSeconds;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-surface rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-dark-border">
        {/* Header */}
        <div className="sticky top-0 bg-dark-surface border-b border-dark-border p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-dark-text">Schedule Multi-Message Job</h2>
          <button
            onClick={onClose}
            className="text-dark-text-dim hover:text-dark-text transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Recipients Section */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-dark-text">
                Recipients ({recipients.length} selected)
              </h3>
              <button
                onClick={toggleAllRecipients}
                className="text-sm text-primary hover:text-primary-hover transition-colors"
              >
                {recipients.length === filteredContacts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-dark-text mb-3 focus:outline-none focus:border-primary"
            />

            <div className="border border-dark-border rounded-lg max-h-64 overflow-y-auto">
              {filteredContacts.length === 0 ? (
                <div className="p-8 text-center text-dark-text-dim">
                  No contacts found
                </div>
              ) : (
                filteredContacts.map(contact => (
                  <label
                    key={contact.jid}
                    className="flex items-center gap-3 p-3 hover:bg-dark-hover cursor-pointer border-b border-dark-border last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={recipients.includes(contact.jid)}
                      onChange={() => toggleRecipient(contact.jid)}
                      className="w-4 h-4 accent-primary"
                    />
                    <div className="flex-grow">
                      <p className="text-dark-text font-medium">
                        {contact.displayName || contact.phone}
                      </p>
                      {contact.displayName && (
                        <p className="text-sm text-dark-text-dim">{contact.phone}</p>
                      )}
                    </div>
                    {contact.isFavorite && (
                      <span className="text-warning">⭐</span>
                    )}
                  </label>
                ))
              )}
            </div>
          </section>

          {/* Message Parts Section */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-dark-text">
                Message Sequence ({messageParts.length} parts)
              </h3>
              <button
                onClick={addMessagePart}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
              >
                <Plus size={16} />
                Add Part
              </button>
            </div>

            <div className="space-y-4">
              {messageParts.map((part, index) => (
                <div
                  key={index}
                  className="bg-dark-bg border border-dark-border rounded-lg p-4"
                >
                  <div className="flex items-start gap-4">
                    {/* Part Number Badge */}
                    <div className="flex-shrink-0 w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>

                    {/* Message Content */}
                    <div className="flex-grow space-y-3">
                      <textarea
                        value={part.text}
                        onChange={(e) => updateMessagePart(index, 'text', e.target.value)}
                        placeholder={`Message part ${index + 1}...`}
                        className="w-full bg-dark-surface border border-dark-border rounded-lg px-4 py-3 text-dark-text min-h-[100px] focus:outline-none focus:border-primary resize-none"
                        rows={3}
                      />

                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-dark-text">
                          <span className="text-sm">Delay after (seconds):</span>
                          <input
                            type="number"
                            value={part.delayAfterSeconds ?? ''}
                            onChange={(e) => updateMessagePart(index, 'delayAfterSeconds', e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="3"
                            min="0"
                            max="60"
                            className="bg-dark-surface border border-dark-border rounded px-3 py-1 w-20 text-dark-text focus:outline-none focus:border-primary"
                          />
                        </label>

                        {index === messageParts.length - 1 && (
                          <span className="text-xs text-dark-text-dim italic">
                            (Last message - delay optional)
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-dark-text-dim">
                        {part.text.length} characters
                      </div>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeMessagePart(index)}
                      disabled={messageParts.length === 1}
                      className="flex-shrink-0 text-danger hover:text-red-400 disabled:text-dark-border disabled:cursor-not-allowed transition-colors"
                      title="Remove message part"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Scheduling Section */}
          <section>
            <h3 className="text-xl font-semibold text-dark-text mb-4">Schedule & Configuration</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Start Time (UK Time)
                </label>
                <input
                  type="datetime-local"
                  value={scheduledStartAt}
                  onChange={(e) => setScheduledStartAt(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-dark-text focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Gap between recipients (seconds)
                  </label>
                  <input
                    type="number"
                    value={recipientGapSeconds}
                    onChange={(e) => setRecipientGapSeconds(parseInt(e.target.value))}
                    min="0"
                    max="300"
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-dark-text focus:outline-none focus:border-primary"
                  />
                  <p className="text-xs text-dark-text-dim mt-1">
                    Delay after completing all messages for one recipient
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-text mb-2">
                    Max retries on failure
                  </label>
                  <input
                    type="number"
                    value={maxRetries}
                    onChange={(e) => setMaxRetries(parseInt(e.target.value))}
                    min="0"
                    max="10"
                    className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-2 text-dark-text focus:outline-none focus:border-primary"
                  />
                  <p className="text-xs text-dark-text-dim mt-1">
                    How many times to retry sending if it fails
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Preview Section */}
          {recipients.length > 0 && messageParts.length > 0 && (
            <section className="bg-primary bg-opacity-10 border border-primary rounded-lg p-6">
              <h3 className="text-lg font-semibold text-dark-text mb-4">Preview & Estimate</h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-dark-bg rounded-lg p-3">
                  <p className="text-sm text-dark-text-dim mb-1">Recipients</p>
                  <p className="text-2xl font-bold text-dark-text">{recipients.length}</p>
                </div>
                <div className="bg-dark-bg rounded-lg p-3">
                  <p className="text-sm text-dark-text-dim mb-1">Message Parts</p>
                  <p className="text-2xl font-bold text-dark-text">{messageParts.length}</p>
                </div>
                <div className="bg-dark-bg rounded-lg p-3">
                  <p className="text-sm text-dark-text-dim mb-1">Total Messages</p>
                  <p className="text-2xl font-bold text-dark-text">
                    {recipients.length * messageParts.length}
                  </p>
                </div>
                <div className="bg-dark-bg rounded-lg p-3">
                  <p className="text-sm text-dark-text-dim mb-1">Est. Duration</p>
                  <p className="text-2xl font-bold text-dark-text">
                    {formatDuration(calculateEstimatedDuration())}
                  </p>
                </div>
              </div>

              <div className="text-sm text-dark-text-dim">
                <p className="mb-2">This job will:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Send {messageParts.length} message parts to each recipient</li>
                  <li>Wait {recipientGapSeconds}s between recipients</li>
                  <li>Retry failed messages up to {maxRetries} times</li>
                  <li>Complete in approximately {formatDuration(calculateEstimatedDuration())}</li>
                </ul>
              </div>
            </section>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-dark-surface border-t border-dark-border p-6 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2 border border-dark-border rounded-lg text-dark-text hover:bg-dark-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid() || isSubmitting}
            className="px-6 py-2 bg-success hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:bg-dark-border disabled:cursor-not-allowed disabled:text-dark-text-dim"
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Job'}
          </button>
        </div>
      </div>
    </div>
  );
}
