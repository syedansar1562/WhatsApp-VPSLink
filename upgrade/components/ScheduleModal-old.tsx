'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, Search, Star, Plus, Trash2, Globe } from 'lucide-react';
import type { Contact } from '@/lib/s3';
import { localToUTC, formatTimezoneDisplay } from '@/lib/timezones';

interface ScheduleModalProps {
  onClose: () => void;
  initialData?: {
    contactPhone?: string;
    contactName?: string;
    message?: string;
    scheduledTime?: string; // ISO datetime string
    messageId?: string; // For editing existing messages
    recipientTimezone?: string; // Original timezone the message was scheduled in
    scheduledInTimezone?: string; // IANA timezone identifier used for scheduling
  };
}

export default function ScheduleModal({ onClose, initialData = {} }: ScheduleModalProps) {
  // Parse scheduled time if provided - use original timezone if available
  const parseScheduledTime = () => {
    if (!initialData.scheduledTime) return { date: '', time: '', wasRecipientTimezone: false };

    const utcDate = new Date(initialData.scheduledTime);

    // Determine which timezone the message was originally scheduled in
    const originalTimezone = initialData.scheduledInTimezone || 'Europe/London';
    const wasRecipientTimezone = originalTimezone !== 'Europe/London';

    // Convert UTC to the original timezone
    const localDate = new Date(utcDate.toLocaleString('en-US', { timeZone: originalTimezone }));

    const dateStr = localDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = localDate.toTimeString().slice(0, 5); // HH:MM

    return { date: dateStr, time: timeStr, wasRecipientTimezone };
  };

  const { date: initialDate, time: initialTime, wasRecipientTimezone } = parseScheduledTime();

  // Split message into parts if it's a multi-part message (joined with \n\n)
  const parseInitialMessages = () => {
    if (!initialData.message) return [''];

    // Check if message contains double newlines (multi-part separator)
    if (initialData.message.includes('\n\n')) {
      return initialData.message.split('\n\n').filter(part => part.trim());
    }

    return [initialData.message];
  };

  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [contactSearch, setContactSearch] = useState(initialData.contactName || '');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState(initialData.contactPhone || '');
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [messages, setMessages] = useState<string[]>(parseInitialMessages());
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  // Preserve the original timezone selection when editing
  const [useRecipientTimezone, setUseRecipientTimezone] = useState(wasRecipientTimezone);
  const [recipientTimezone, setRecipientTimezone] = useState<string>(initialData.recipientTimezone || 'Europe/London');

  useEffect(() => {
    fetch('/api/contacts')
      .then(res => res.json())
      .then(data => {
        setContacts(data);

        // If we have initial contact phone, update the search text
        if (initialData.contactPhone && data[initialData.contactPhone]) {
          setContactSearch(data[initialData.contactPhone].name);
        }
      });

    // Load settings
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error(err));
  }, [initialData.contactPhone]);

  const filteredContacts = useMemo(() => {
    const entries = Object.entries(contacts);
    
    return entries.filter(([phone, contact]) => {
      const searchLower = contactSearch.toLowerCase();
      const matchesSearch = contactSearch === '' ||
        contact.name.toLowerCase().includes(searchLower) ||
        phone.includes(searchLower) ||
        contact.aliases.some(a => a.toLowerCase().includes(searchLower));
      
      const matchesFavorite = !showFavoritesOnly || contact.favorite;
      
      return matchesSearch && matchesFavorite;
    }).sort((a, b) => {
      if (a[1].favorite && !b[1].favorite) return -1;
      if (!a[1].favorite && b[1].favorite) return 1;
      return a[1].name.localeCompare(b[1].name);
    });
  }, [contacts, contactSearch, showFavoritesOnly]);

  const selectedContact = selectedPhone ? contacts[selectedPhone] : null;

  // Get the default phone number for a contact
  const getDefaultPhone = (contact: Contact) => {
    if (contact.defaultPhone === 'secondary' && contact.phones.secondary) {
      return contact.phones.secondary;
    }
    return contact.phones.primary;
  };

  // Calculate automatic delay based on message length (typing simulation)
  const calculateAutomaticDelay = (text: string) => {
    // Human typing is NOT linear - people pause, think, edit, re-read

    if (!settings?.jobs?.humanization?.enabled) {
      // BASIC MODE: Conservative realistic timing
      // Average person types 40 words/min = ~3.3 chars/sec (accounting for thinking)
      const words = text.split(/\s+/).length;
      const typingTime = (text.length / 3.3); // Realistic typing speed

      // Reading/thinking time: ~200ms per word (people re-read before sending)
      const thinkingTime = words * 0.2;

      // Base minimum: 5 seconds (no one sends instantly)
      const baseTime = Math.max(5, typingTime + thinkingTime);

      // Large variance: 50-150% of base time (humans are inconsistent)
      const varianceFactor = 0.5 + Math.random(); // Random between 0.5 and 1.5
      const finalTime = baseTime * varianceFactor;

      // Minimum 5 seconds, maximum 45 seconds per message
      return Math.max(5, Math.min(45, finalTime));
    }

    // ADVANCED HUMANIZATION MODE: Even more realistic
    const typingSpeed = settings.jobs.humanization.typingSpeed || 40; // chars per second
    const words = text.split(/\s+/).length;

    // 1. Typing time (slower for longer messages - fatigue)
    let typingTime = text.length / typingSpeed;
    if (text.length > 100) {
      // Slower typing for long messages (people slow down)
      typingTime *= 1.3;
    }

    // 2. Reading/proofreading time (~200-300ms per word)
    const readingTime = words * (0.2 + Math.random() * 0.1);

    // 3. Random "thinking" pauses (bigger variance)
    const minDelay = settings.jobs.humanization.minDelay || 3;
    const maxDelay = settings.jobs.humanization.maxDelay || 15;
    const thinkingPause = minDelay + Math.random() * (maxDelay - minDelay);

    // 4. Occasional longer pauses (10% chance of 2-5 second extra pause)
    const extraPause = Math.random() < 0.1 ? (2 + Math.random() * 3) : 0;

    const totalTime = typingTime + readingTime + thinkingPause + extraPause;

    // Absolute minimum 5 seconds, maximum 60 seconds
    return Math.max(5, Math.min(60, totalTime));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // If editing an existing message/job, delete it first
      if (initialData.messageId) {
        // Try to delete from both single messages and jobs
        try {
          // Check if it's a job (starts with "job_")
          if (initialData.messageId.startsWith('job_')) {
            await fetch(`/api/scheduler/jobs?id=${initialData.messageId}`, {
              method: 'DELETE'
            });
          } else {
            // It's a single message
            const scheduledData = await fetch('/api/scheduled').then(r => r.json());
            scheduledData.messages = scheduledData.messages.filter((m: any) => m.id !== initialData.messageId);
            await fetch('/api/scheduled', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(scheduledData)
            });
          }
        } catch (err) {
          console.error('Error deleting old message:', err);
          // Continue anyway - we'll create the new one
        }
      }

      const contact = contacts[selectedPhone];
      const phoneToUse = contact ? getDefaultPhone(contact) : selectedPhone;
      // Clean phone number: remove + prefix and any whitespace
      const cleanPhone = phoneToUse.replace(/^\+/, '').replace(/\s/g, '');
      const jid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

      // Calculate scheduled time based on timezone selection
      let scheduledDateTime: string;
      const localTimeString = `${date}T${time}`;
      const selectedTimezone = useRecipientTimezone ? recipientTimezone : 'Europe/London';

      if (useRecipientTimezone && recipientTimezone !== 'Europe/London') {
        // Convert recipient's local time to UTC
        scheduledDateTime = localToUTC(localTimeString, recipientTimezone).toISOString();
      } else {
        // Default UK time - treat as UK local time and convert to UTC
        scheduledDateTime = localToUTC(localTimeString, 'Europe/London').toISOString();
      }

      const validMessages = messages.filter(m => m.trim());

      // If only one message, use old single-message API
      if (validMessages.length === 1) {
        const scheduledData = await fetch('/api/scheduled').then(r => r.json());

        const newMessage = {
          id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          to: phoneToUse,
          contactName: contact?.name || selectedPhone,
          message: validMessages[0],
          scheduledTime: scheduledDateTime,
          status: 'pending',
          createdAt: new Date().toISOString(),
          createdFrom: 'web',
          sentAt: null,
          // Timezone metadata for display
          recipientTimezone: recipientTimezone,
          recipientLocalTime: localTimeString,
          scheduledInTimezone: selectedTimezone
        };

        scheduledData.messages.push(newMessage);

        await fetch('/api/scheduled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduledData)
        });
      } else {
        // Multiple messages - use multi-message job API
        const useAutomatic = settings?.jobs?.automaticMode !== false; // Default to true if not set

        const jobData = {
          recipients: [jid],
          messageParts: validMessages.map((text, index) => {
            let delayAfterSeconds = null;

            // Only add delay if not the last message
            if (index < validMessages.length - 1) {
              if (useAutomatic) {
                // Calculate delay based on message length
                delayAfterSeconds = calculateAutomaticDelay(text);
              } else {
                // Use manual delay from settings
                delayAfterSeconds = settings?.jobs?.defaultMessageDelay || 3;
              }
            }

            return {
              orderIndex: index,
              text,
              delayAfterSeconds
            };
          }),
          scheduledStartAt: scheduledDateTime,
          config: {
            intervalMode: useAutomatic ? 'automatic' : 'manual',
            recipientGapSeconds: settings?.jobs?.defaultRecipientGap || 30,
            maxRetries: settings?.jobs?.maxRetries || 3
          },
          // Timezone metadata for display
          timezoneMetadata: {
            recipientTimezone: recipientTimezone,
            recipientLocalTime: localTimeString,
            scheduledInTimezone: selectedTimezone
          }
        };

        await fetch('/api/scheduler/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jobData)
        });
      }

      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Failed to schedule message:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectContact = (phone: string) => {
    setSelectedPhone(phone);
    setContactSearch(contacts[phone].name);
    setShowContactDropdown(false);

    // Load recipient's timezone when contact is selected
    const contact = contacts[phone];
    if (contact?.timezone) {
      setRecipientTimezone(contact.timezone);
    } else {
      setRecipientTimezone('Europe/London'); // Default fallback
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-fadeIn" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-[#1a1a1a] border border-[#404040] rounded-xl w-full max-w-2xl p-6 animate-slideUp max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">
              {initialData.contactPhone ? 'Reschedule Message' : 'Schedule New Message'}
            </h2>
            <button onClick={onClose} className="text-[#a3a3a3] hover:text-white transition-colors p-1">
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Recipient <span className="text-red-500">*</span>
              </label>
              
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737373]" size={18} />
                  <input
                    type="text"
                    placeholder="Search by name, phone, or alias..."
                    value={contactSearch}
                    onChange={(e) => {
                      setContactSearch(e.target.value);
                      setShowContactDropdown(true);
                      if (!initialData.contactPhone) setSelectedPhone('');
                    }}
                    onFocus={() => setShowContactDropdown(true)}
                    className="input w-full pl-11 pr-24"
                  />
                  
                  <button
                    type="button"
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={'absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded text-xs font-medium transition-colors ' + (showFavoritesOnly ? 'bg-blue-500 text-white' : 'bg-[#2d2d2d] text-[#a3a3a3] hover:bg-[#3a3a3a]')}
                  >
                    <Star size={14} className={'inline mr-1 ' + (showFavoritesOnly ? 'fill-white' : '')} />
                    Favs
                  </button>
                </div>

                {showContactDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-[#1a1a1a] border border-[#404040] rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    {filteredContacts.length === 0 ? (
                      <div className="p-4 text-center text-[#737373]">No contacts found</div>
                    ) : (
                      <div className="py-2">
                        {filteredContacts.map(([phone, contact]) => (
                          <button
                            key={phone}
                            type="button"
                            onClick={() => selectContact(phone)}
                            className="w-full px-4 py-3 text-left hover:bg-[#2d2d2d] transition-colors flex items-center justify-between group"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {contact.favorite && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
                                <span className="text-white font-medium">{contact.name}</span>
                              </div>
                              <div className="text-sm text-[#737373] font-mono">
                                {getDefaultPhone(contact)}
                                {contact.defaultPhone === 'secondary' && contact.phones.secondary && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">Secondary</span>
                                )}
                              </div>
                              {contact.aliases.length > 0 && (
                                <div className="text-xs text-[#737373] mt-1">aka: {contact.aliases.join(', ')}</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {selectedContact && (
                <div className="mt-3 p-3 bg-[#2d2d2d] border border-[#404040] rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {selectedContact.favorite && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
                        <span className="text-white font-medium">{selectedContact.name}</span>
                      </div>
                      <div className="text-sm text-[#a3a3a3] font-mono mt-1">
                        {getDefaultPhone(selectedContact)}
                        {selectedContact.defaultPhone === 'secondary' && selectedContact.phones.secondary && (
                          <span className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">Secondary</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPhone('');
                        setContactSearch('');
                        setShowContactDropdown(true);
                      }}
                      className="text-[#737373] hover:text-white transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-[#737373] mt-2">
                💡 Tip: Type to search by name, phone number, or alias. Toggle "Favs" to show only favorites.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Message <span className="text-red-500">*</span>
              </label>
              <div className="space-y-3">
                {messages.map((msg, index) => (
                  <div key={index} className="space-y-2">
                    <textarea
                      value={msg}
                      onChange={(e) => {
                        const updated = [...messages];
                        updated[index] = e.target.value;
                        setMessages(updated);
                      }}
                      placeholder={messages.length > 1 ? `Message part ${index + 1}...` : 'Enter your message...'}
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
                        type="button"
                        onClick={() => {
                          if (messages.length === 1) return;
                          setMessages(messages.filter((_, i) => i !== index));
                        }}
                        className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setMessages([...messages, ''])}
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2 transition-colors"
                >
                  <Plus size={16} />
                  Add message part
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                <Globe size={14} className="inline mr-2" />
                Schedule Timezone
              </label>
              <select
                value={useRecipientTimezone ? 'recipient' : 'uk'}
                onChange={(e) => setUseRecipientTimezone(e.target.value === 'recipient')}
                disabled={!selectedContact}
                className="input w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="uk">UK Time ({formatTimezoneDisplay('Europe/London')})</option>
                <option value="recipient" disabled={!selectedContact}>
                  {selectedContact
                    ? `Their Time (${formatTimezoneDisplay(recipientTimezone)})`
                    : 'Their Time (Select contact first)'}
                </option>
              </select>
            </div>

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
                  min={new Date().toISOString().split('T')[0]}
                  className="input w-full [color-scheme:dark]"
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
                  className="input w-full [color-scheme:dark]"
                />
              </div>
            </div>

            <p className="text-xs text-[#737373]">
              💡 Time will be entered in {useRecipientTimezone ? formatTimezoneDisplay(recipientTimezone) : 'UK time (Europe/London)'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button 
                type="submit" 
                disabled={loading || !selectedPhone} 
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Scheduling...' : (initialData.contactPhone ? 'Reschedule Message' : 'Schedule Message')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
