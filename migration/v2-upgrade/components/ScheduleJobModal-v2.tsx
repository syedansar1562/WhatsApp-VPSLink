'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ChevronDown } from 'lucide-react';

interface Contact {
  name: string;
  phones: {
    primary: string;
    secondary?: string | null;
  };
}

interface MessagePart {
  id: string;
  text: string;
}

interface Props {
  contacts: Record<string, Contact>;
  onClose: () => void;
  onSubmit: (jobData: any) => void;
}

export default function ScheduleJobModal({ contacts, onClose, onSubmit }: Props) {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [messageParts, setMessageParts] = useState<MessagePart[]>([
    { id: '1', text: '' }
  ]);
  const [scheduledTime, setScheduledTime] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [useAutomatic, setUseAutomatic] = useState(true);
  const [manualDelay, setManualDelay] = useState(3);
  const [recipientGap, setRecipientGap] = useState(30);
  const [loading, setLoading] = useState(false);

  // Load settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.jobs) {
          setUseAutomatic(data.jobs.automaticMode);
          setManualDelay(data.jobs.defaultMessageDelay);
          setRecipientGap(data.jobs.defaultRecipientGap);
        }
      })
      .catch(err => console.error('Failed to load settings:', err));
  }, []);

  const contactList = Object.entries(contacts).map(([phone, contact]) => ({
    phone: contact.phones.primary,
    name: contact.name,
    jid: contact.phones.primary.includes('@')
      ? contact.phones.primary
      : `${contact.phones.primary}@s.whatsapp.net`
  }));

  const filteredContacts = contactList.filter(c =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) &&
    !selectedContacts.includes(c.jid)
  );

  const handleAddContact = (jid: string) => {
    setSelectedContacts([...selectedContacts, jid]);
    setContactSearch('');
    setShowContactDropdown(false);
  };

  const handleRemoveContact = (jid: string) => {
    setSelectedContacts(selectedContacts.filter(c => c !== jid));
  };

  const handleAddMessagePart = () => {
    setMessageParts([...messageParts, {
      id: Date.now().toString(),
      text: ''
    }]);
  };

  const handleRemoveMessagePart = (id: string) => {
    if (messageParts.length === 1) return; // Keep at least one
    setMessageParts(messageParts.filter(m => m.id !== id));
  };

  const handleMessageChange = (id: string, text: string) => {
    setMessageParts(messageParts.map(m =>
      m.id === id ? { ...m, text } : m
    ));
  };

  const handleSubmit = async () => {
    // Validation
    if (selectedContacts.length === 0) {
      alert('Please select at least one recipient');
      return;
    }

    if (messageParts.every(m => !m.text.trim())) {
      alert('Please enter at least one message');
      return;
    }

    if (!scheduledTime) {
      alert('Please select a scheduled time');
      return;
    }

    setLoading(true);

    // Check for conflicts with existing jobs
    const scheduledStart = new Date(scheduledTime);
    const messageDelay = useAutomatic ? 5 : manualDelay;
    const totalMessages = selectedContacts.length * messageParts.filter(m => m.text.trim()).length;
    const estimatedDuration = (totalMessages * messageDelay) + ((selectedContacts.length - 1) * recipientGap);
    const estimatedEnd = new Date(scheduledStart.getTime() + estimatedDuration * 1000);

    try {
      const response = await fetch('/api/scheduler/jobs');
      const existingJobs = await response.json();

      const conflicts = existingJobs.filter((job: any) => {
        if (job.status !== 'pending') return false;

        const jobStart = new Date(job.scheduledStartAt);
        const jobDelay = job.config.intervalMode === 'automatic' ? 5 : job.config.recipientGapSeconds || 30;
        const jobTotalMessages = job.recipients.length * job.messageParts.length;
        const jobDuration = (jobTotalMessages * jobDelay) + ((job.recipients.length - 1) * job.config.recipientGapSeconds);
        const jobEnd = new Date(jobStart.getTime() + jobDuration * 1000);

        return (scheduledStart < jobEnd && estimatedEnd > jobStart);
      });

      if (conflicts.length > 0) {
        const conflict = conflicts[0];
        const conflictTime = new Date(conflict.scheduledStartAt).toLocaleString('en-GB', {
          timeZone: 'Europe/London',
          dateStyle: 'short',
          timeStyle: 'short'
        });
        const shouldContinue = confirm(
          '⚠️ Warning: This job may overlap with another job scheduled at ' + conflictTime + '.\n\n' +
          'Your job will finish approximately at ' + estimatedEnd.toLocaleTimeString('en-GB') + '.\n\n' +
          'Do you want to schedule it anyway?'
        );
        if (!shouldContinue) {
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error('Failed to check for conflicts:', error);
    }

    try {
      const jobData = {
        recipients: selectedContacts,
        messageParts: messageParts
          .filter(m => m.text.trim())
          .map((m, index) => ({
            orderIndex: index,
            text: m.text.trim(),
            delayAfterSeconds: index < messageParts.length - 1 ? (useAutomatic ? null : manualDelay) : null
          })),
        scheduledStartAt: new Date(scheduledTime).toISOString(),
        config: {
          intervalMode: useAutomatic ? 'automatic' : 'manual',
          recipientGapSeconds: recipientGap,
          maxRetries: 3 // Will be pulled from settings
        }
      };

      await onSubmit(jobData);
      onClose();
    } catch (error) {
      console.error('Failed to create job:', error);
      alert('Failed to create job. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e1e1e] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#1e1e1e] border-b border-[#404040] p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Schedule New Message</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#2d2d2d] rounded-lg transition-colors"
          >
            <X className="text-[#a3a3a3]" size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium text-[#a3a3a3] mb-2">
              Recipients
            </label>

            {/* Selected Recipients (chips) */}
            {selectedContacts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedContacts.map(jid => {
                  const contact = contactList.find(c => c.jid === jid);
                  return (
                    <div
                      key={jid}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm"
                    >
                      <span>{contact?.name || jid}</span>
                      <button
                        onClick={() => handleRemoveContact(jid)}
                        className="hover:text-blue-300"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Contact Selector */}
            <div className="relative">
              <div
                className="input cursor-pointer flex items-center justify-between"
                onClick={() => setShowContactDropdown(!showContactDropdown)}
              >
                <span className="text-[#737373]">
                  {selectedContacts.length === 0
                    ? 'Click to select recipients...'
                    : `${selectedContacts.length} recipient(s) selected`}
                </span>
                <ChevronDown size={18} className="text-[#737373]" />
              </div>

              {/* Dropdown */}
              {showContactDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#2d2d2d] rounded-lg border border-[#404040] max-h-64 overflow-y-auto z-10 shadow-xl">
                  {/* Search */}
                  <div className="sticky top-0 p-3 bg-[#2d2d2d] border-b border-[#404040]">
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="input w-full"
                      autoFocus
                    />
                  </div>

                  {/* Contact List */}
                  <div className="p-2">
                    {filteredContacts.length === 0 ? (
                      <div className="p-4 text-center text-[#737373] text-sm">
                        No contacts found
                      </div>
                    ) : (
                      filteredContacts.map(contact => (
                        <button
                          key={contact.jid}
                          onClick={() => handleAddContact(contact.jid)}
                          className="w-full text-left px-3 py-2 rounded hover:bg-[#3a3a3a] transition-colors text-white"
                        >
                          {contact.name}
                          <span className="text-xs text-[#737373] ml-2">{contact.phone}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#a3a3a3]">
                Messages
              </label>
              <button
                onClick={handleAddMessagePart}
                className="p-1.5 hover:bg-[#2d2d2d] rounded transition-colors"
                title="Add message part"
              >
                <Plus size={18} className="text-blue-400" />
              </button>
            </div>

            <div className="space-y-3">
              {messageParts.map((part, index) => (
                <div key={part.id} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <textarea
                      value={part.text}
                      onChange={(e) => handleMessageChange(part.id, e.target.value)}
                      placeholder={`Message ${index + 1}...`}
                      className="input w-full resize-none"
                      rows={1}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                      }}
                    />
                  </div>
                  {messageParts.length > 1 && (
                    <button
                      onClick={() => handleRemoveMessagePart(part.id)}
                      className="p-2 hover:bg-red-500/10 rounded transition-colors mt-1"
                      title="Remove message"
                    >
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Scheduled Time */}
          <div>
            <label className="block text-sm font-medium text-[#a3a3a3] mb-2">
              Schedule For
            </label>
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="input w-full"
            />
          </div>

          {/* Options (Collapsible) */}
          <div>
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="flex items-center gap-2 text-sm font-medium text-[#a3a3a3] hover:text-white transition-colors"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${showOptions ? 'rotate-180' : ''}`}
              />
              Message Options
            </button>

            {showOptions && (
              <div className="mt-4 space-y-4 pl-6 border-l-2 border-[#404040]">
                {/* Automatic Mode Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAutomatic}
                    onChange={(e) => setUseAutomatic(e.target.checked)}
                    className="w-4 h-4 rounded border-[#404040] bg-[#2d2d2d] checked:bg-blue-500"
                  />
                  <span className="text-white text-sm">Automatic (Recommended)</span>
                </label>

                {/* Manual Settings (only when automatic is off) */}
                {!useAutomatic && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-[#737373] mb-1">
                        Delay Between Messages (seconds)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={manualDelay}
                        onChange={(e) => setManualDelay(parseFloat(e.target.value))}
                        className="input w-32"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-[#737373] mb-1">
                        Gap Between Recipients (seconds)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={recipientGap}
                        onChange={(e) => setRecipientGap(parseInt(e.target.value))}
                        className="input w-32"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#1e1e1e] border-t border-[#404040] p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 bg-[#2d2d2d] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Scheduling...' : 'Schedule Message'}
          </button>
        </div>
      </div>
    </div>
  );
}
