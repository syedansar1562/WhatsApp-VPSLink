'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Settings } from 'lucide-react';

interface Contact {
  name: string;
  phones: {
    primary: string;
    secondary?: string | null;
  };
}

interface Props {
  contacts: Record<string, Contact>;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export default function ScheduleMessageModal({ contacts, onClose, onSubmit }: Props) {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [messages, setMessages] = useState<string[]>(['']);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Load settings
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error(err));
  }, []);

  const contactList = Object.entries(contacts).map(([phone, contact]) => ({
    phone: contact.phones.primary,
    name: contact.name,
    jid: contact.phones.primary.includes('@')
      ? contact.phones.primary
      : `${contact.phones.primary}@s.whatsapp.net`
  }));

  const filteredContacts = contactList.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !recipients.includes(c.jid)
  );

  const addRecipient = (jid: string) => {
    setRecipients([...recipients, jid]);
    setSearchTerm('');
    setShowDropdown(false);
  };

  const removeRecipient = (jid: string) => {
    setRecipients(recipients.filter(r => r !== jid));
  };

  const addMessage = () => {
    setMessages([...messages, '']);
  };

  const removeMessage = (index: number) => {
    if (messages.length === 1) return;
    setMessages(messages.filter((_, i) => i !== index));
  };

  const updateMessage = (index: number, text: string) => {
    const updated = [...messages];
    updated[index] = text;
    setMessages(updated);
  };

  const handleSubmit = async () => {
    // Validation
    if (recipients.length === 0) {
      alert('Please select at least one recipient');
      return;
    }

    const validMessages = messages.filter(m => m.trim());
    if (validMessages.length === 0) {
      alert('Please enter at least one message');
      return;
    }

    if (!scheduleDate || !scheduleTime) {
      alert('Please select date and time');
      return;
    }

    setLoading(true);

    try {
      const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

      const data = {
        recipients,
        messageParts: validMessages.map((text, index) => ({
          orderIndex: index,
          text,
          delayAfterSeconds: index < validMessages.length - 1
            ? (settings?.jobs?.automaticMode ? null : settings?.jobs?.defaultMessageDelay || 3)
            : null
        })),
        scheduledStartAt: scheduledDateTime,
        config: {
          intervalMode: settings?.jobs?.automaticMode ? 'automatic' : 'manual',
          recipientGapSeconds: settings?.jobs?.defaultRecipientGap || 30,
          maxRetries: settings?.jobs?.maxRetries || 3
        }
      };

      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error('Failed to schedule:', error);
      alert('Failed to schedule message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-[#1e1e1e] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-[#1e1e1e] border-b border-[#404040] p-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Schedule New Message</h2>
            <button onClick={onClose} className="p-2 hover:bg-[#2d2d2d] rounded-lg transition-colors">
              <X className="text-[#a3a3a3]" size={24} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Recipients */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Recipients</label>

              {recipients.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {recipients.map(jid => {
                    const contact = contactList.find(c => c.jid === jid);
                    return (
                      <div key={jid} className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-sm">
                        <span>{contact?.name || jid}</span>
                        <button onClick={() => removeRecipient(jid)} className="hover:text-blue-300">
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  placeholder="Type to search contacts..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="input w-full"
                />

                {showDropdown && searchTerm && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#2d2d2d] rounded-lg border border-[#404040] max-h-64 overflow-y-auto z-10 shadow-xl">
                    {filteredContacts.length === 0 ? (
                      <div className="p-4 text-center text-[#737373] text-sm">No contacts found</div>
                    ) : (
                      <div className="p-2">
                        {filteredContacts.map(contact => (
                          <button
                            key={contact.jid}
                            onClick={() => addRecipient(contact.jid)}
                            className="w-full text-left px-3 py-2 rounded hover:bg-[#3a3a3a] transition-colors text-white"
                          >
                            {contact.name}
                            <span className="text-xs text-[#737373] ml-2">{contact.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Message</label>
              <div className="space-y-3">
                {messages.map((msg, index) => (
                  <div key={index} className="space-y-2">
                    <textarea
                      value={msg}
                      onChange={(e) => updateMessage(index, e.target.value)}
                      placeholder={messages.length > 1 ? `Message part ${index + 1}...` : 'Type your message...'}
                      className="input w-full resize-none"
                      rows={2}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                      }}
                    />
                    {messages.length > 1 && (
                      <button
                        onClick={() => removeMessage(index)}
                        className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addMessage}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2 transition-colors"
                >
                  <Plus size={16} />
                  Add message part
                </button>
              </div>
            </div>

            {/* Schedule Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="input w-full"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#1e1e1e] border-t border-[#404040] p-6 flex justify-between gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 bg-[#2d2d2d] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setShowOptions(true)}
                className="px-6 py-2 bg-[#2d2d2d] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors flex items-center gap-2"
              >
                <Settings size={18} />
                Options
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
      </div>

      {/* Options Modal */}
      {showOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-[#1e1e1e] rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-[#404040] flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Message Options</h3>
              <button onClick={() => setShowOptions(false)} className="p-2 hover:bg-[#2d2d2d] rounded-lg">
                <X size={20} className="text-[#a3a3a3]" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-[#a3a3a3] text-sm">
                Message timing and delivery options are configured in{' '}
                <a href="/settings" className="text-blue-400 hover:text-blue-300" onClick={() => setShowOptions(false)}>
                  Settings
                </a>.
              </p>
              {settings && (
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Mode:</span>
                    <span className="text-white">{settings.jobs?.automaticMode ? 'Automatic' : 'Manual'}</span>
                  </div>
                  {!settings.jobs?.automaticMode && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-[#737373]">Message Delay:</span>
                        <span className="text-white">{settings.jobs?.defaultMessageDelay || 3}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#737373]">Recipient Gap:</span>
                        <span className="text-white">{settings.jobs?.defaultRecipientGap || 30}s</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-[#404040] flex justify-end">
              <button
                onClick={() => setShowOptions(false)}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
