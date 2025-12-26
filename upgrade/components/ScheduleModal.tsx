'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, Star, ChevronLeft, ChevronRight, Send, Smile, Trash2, Settings2, ArrowRight, User } from 'lucide-react';
import type { Contact } from '@/lib/s3';
import { localToUTC, formatTimezoneDisplay, COMMON_TIMEZONES } from '@/lib/timezones';

interface MessagePart {
  id: string;
  text: string;
  time: string;
  isEditing?: boolean;
}

interface ScheduleModalProps {
  onClose: () => void;
  initialData?: {
    contactPhone?: string;
    contactName?: string;
    message?: string;
    scheduledTime?: string;
    messageId?: string;
    recipientTimezone?: string;
    scheduledInTimezone?: string;
  };
}

// Calendar Component
function Calendar({ selectedDate, onSelectDate }: { selectedDate: Date; onSelectDate: (date: Date) => void }) {
  const [viewDate, setViewDate] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const firstDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

  const calendarDays = [];

  // Empty slots for previous month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="aspect-square flex items-center justify-center text-[#737373]"></div>);
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
    const isSelected = date.toDateString() === selectedDate.toDateString();
    const isToday = date.toDateString() === new Date().toDateString();

    calendarDays.push(
      <div
        key={d}
        onClick={() => onSelectDate(date)}
        className={`aspect-square flex items-center justify-center rounded-full cursor-pointer text-sm transition-all ${
          isSelected
            ? 'bg-[#25D366] text-white shadow-[0_0_15px_-3px_rgba(37,211,102,0.4)]'
            : 'text-[#a3a3a3] hover:bg-white/10'
        } ${isToday && !isSelected ? 'border border-[#25D366]' : ''}`}
      >
        {d}
      </div>
    );
  }

  return (
    <div className="bg-[#27272a] rounded-xl p-4 border border-[#404040] shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</h3>
        <div className="flex space-x-1">
          <button onClick={prevMonth} className="p-1 hover:bg-white/10 rounded-full text-[#a3a3a3] hover:text-white transition-colors">
            <ChevronLeft size={18} />
          </button>
          <button onClick={nextMonth} className="p-1 hover:bg-white/10 rounded-full text-[#a3a3a3] hover:text-white transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {days.map(d => (
          <span key={d} className="text-[10px] font-medium text-[#737373]">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarDays}
      </div>
    </div>
  );
}

export default function ScheduleModal({ onClose, initialData = {} }: ScheduleModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Parse initial data
  const parseScheduledTime = () => {
    if (!initialData.scheduledTime) return { date: '', time: '' };
    const utcDate = new Date(initialData.scheduledTime);
    const originalTimezone = initialData.scheduledInTimezone || 'Europe/London';
    const localDate = new Date(utcDate.toLocaleString('en-US', { timeZone: originalTimezone }));
    const dateStr = localDate.toISOString().split('T')[0];
    const timeStr = localDate.toTimeString().slice(0, 5);
    return { date: dateStr, time: timeStr };
  };

  const parseInitialMessages = (): MessagePart[] => {
    if (!initialData.message) return [];
    const parts = initialData.message.includes('\n\n')
      ? initialData.message.split('\n\n').filter(part => part.trim())
      : [initialData.message];

    return parts.map((text, i) => ({
      id: Math.random().toString(36).substr(2, 9),
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEditing: false
    }));
  };

  const { date: initialDate, time: initialTime } = parseScheduledTime();
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [selectedContact, setSelectedContact] = useState<{ phone: string; name: string } | null>(
    initialData.contactPhone && initialData.contactName
      ? { phone: initialData.contactPhone, name: initialData.contactName }
      : null
  );
  const [showContactPicker, setShowContactPicker] = useState(!initialData.contactPhone);
  const [contactSearch, setContactSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [messageParts, setMessageParts] = useState<MessagePart[]>(parseInitialMessages());
  const [newMessage, setNewMessage] = useState('');
  const [selectedDate, setSelectedDate] = useState(initialDate ? new Date(initialDate) : tomorrow);
  const [selectedTime, setSelectedTime] = useState(initialTime || '10:00');
  const [selectedTzIdx, setSelectedTzIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/contacts')
      .then(res => res.json())
      .then(data => setContacts(data));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messageParts]);

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
    });
  }, [contacts, contactSearch, showFavoritesOnly]);

  const handleAddPart = () => {
    if (!newMessage.trim()) return;
    const part: MessagePart = {
      id: Math.random().toString(36).substr(2, 9),
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEditing: false
    };
    setMessageParts([...messageParts, part]);
    setNewMessage('');
  };

  const removePart = (id: string) => {
    setMessageParts(messageParts.filter(p => p.id !== id));
  };

  const toggleEdit = (id: string) => {
    setMessageParts(messageParts.map(p =>
      p.id === id ? { ...p, isEditing: !p.isEditing } : p
    ));
  };

  const updatePartText = (id: string, newText: string) => {
    setMessageParts(messageParts.map(p =>
      p.id === id ? { ...p, text: newText } : p
    ));
  };

  const saveEdit = (id: string) => {
    setMessageParts(messageParts.map(p =>
      p.id === id ? { ...p, isEditing: false } : p
    ));
  };

  // Time calculation logic
  const scheduleDetails = useMemo(() => {
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const date = new Date(selectedDate);
    date.setHours(hours, minutes, 0, 0);

    const targetTz = COMMON_TIMEZONES[selectedTzIdx];

    const format = (d: Date, tzLabel: string) => {
      const day = d.getDate();
      const month = d.toLocaleString('en-US', { month: 'long' });
      const year = d.getFullYear();
      const timeStr = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${day} ${month} ${year} at ${timeStr} (${tzLabel})`;
    };

    const recipientTime = format(date, formatTimezoneDisplay(targetTz.iana));

    const userOffsetMinutes = new Date().getTimezoneOffset();
    const targetOffsetMinutes = targetTz.utcOffset.replace('UTC', '').replace('+', '').replace('-', '-') as any * 60;
    const localDate = new Date(date.getTime() - (targetOffsetMinutes + userOffsetMinutes) * 60000);

    const localOffset = -new Date().getTimezoneOffset() / 60;
    const sign = localOffset >= 0 ? '+' : '';
    const yourTzLabel = `Local UTC${sign}${localOffset}`;
    const yourTime = format(localDate, yourTzLabel);

    return { yourTime, recipientTime };
  }, [selectedDate, selectedTime, selectedTzIdx]);

  const handleSchedule = async () => {
    if (!selectedContact || messageParts.length === 0) {
      alert('Please select a contact and add at least one message part');
      return;
    }

    setLoading(true);

    try {
      const messageText = messageParts.map(p => p.text).join('\n\n');
      const targetTimezone = COMMON_TIMEZONES[selectedTzIdx].iana;
      const localDateTime = `${selectedDate.toISOString().split('T')[0]}T${selectedTime}:00`;
      const utcTime = localToUTC(localDateTime, targetTimezone);

      const response = await fetch('/api/scheduled', {
        method: initialData.messageId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initialData.messageId,
          to: selectedContact.phone,
          contactName: selectedContact.name,
          message: messageText,
          scheduledTime: utcTime,
          recipientTimezone: targetTimezone,
          scheduledInTimezone: targetTimezone,
          recipientLocalTime: selectedTime
        })
      });

      if (response.ok) {
        onClose();
        window.location.reload();
      } else {
        alert('Failed to schedule message');
      }
    } catch (error) {
      console.error('Error scheduling message:', error);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Contact Picker Modal
  if (showContactPicker) {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-[#18181b] rounded-2xl shadow-2xl w-full max-w-md border border-[#404040] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#404040] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Select Contact</h2>
            <button onClick={onClose} className="text-[#a3a3a3] hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#737373]" size={18} />
              <input
                type="text"
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full bg-[#27272a] border border-[#404040] rounded-xl pl-10 pr-3 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#25D366]"
              />
            </div>

            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`mb-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showFavoritesOnly
                  ? 'bg-[#25D366] text-white'
                  : 'bg-transparent border border-[#404040] text-[#a3a3a3] hover:bg-white/5'
              }`}
            >
              <Star size={18} className="inline mr-2" />
              Favorites
            </button>

            <div className="max-h-96 overflow-y-auto">
              {filteredContacts.map(([phone, contact]) => (
                <button
                  key={phone}
                  onClick={() => {
                    setSelectedContact({ phone, name: contact.name });
                    setShowContactPicker(false);
                  }}
                  className="w-full text-left p-3 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#737373] to-[#404040] flex items-center justify-center text-xs font-medium text-white">
                      {contact.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{contact.name}</div>
                      <div className="text-xs text-[#737373]">{phone}</div>
                    </div>
                    {contact.favorite && <Star size={16} className="text-yellow-500 fill-yellow-500" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Scheduler Modal
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
      <div className="bg-[#18181b] rounded-2xl shadow-2xl shadow-black/50 w-full max-w-5xl border border-[#404040] flex flex-col h-[85vh] overflow-hidden ring-1 ring-white/10">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#404040] flex items-center justify-between bg-[#18181b] flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              <Send size={20} className="text-[#25D366]" />
              Schedule New Message
            </h2>
            <p className="text-xs text-[#a3a3a3] mt-0.5">Compose your message parts and pick a time.</p>
          </div>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-white transition-colors rounded-full p-2 hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

          {/* Chat / Composer Area */}
          <div className="w-full md:w-[60%] flex flex-col border-b md:border-b-0 md:border-r border-[#404040] bg-[#0b0b0b]">
            <div className="px-6 py-3 border-b border-[#404040] flex items-center justify-between bg-[#121212]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#737373] to-[#404040] flex items-center justify-center text-xs font-medium text-[#a3a3a3] border border-white/5">
                  <User size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#a3a3a3]">{selectedContact?.name || 'No contact selected'}</span>
                  <span className="text-xs text-[#737373]">Selected: {selectedContact?.phone || 'None'}</span>
                </div>
              </div>
              <button
                onClick={() => setShowContactPicker(true)}
                className="text-xs font-medium text-[#25D366] hover:text-[#128C7E] transition-colors px-3 py-1.5 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20"
              >
                Change
              </button>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 p-6 overflow-y-auto bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0icGF0dGVybiIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiPjxwYXRoIGQ9Ik0wLDBMNTAsNTBNNTAsMEwxMDAsNTAiIHN0cm9rZT0iIzFhMWExYSIgc3Ryb2tlLXdpZHRoPSIwLjUiIGZpbGw9Im5vbmUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjcGF0dGVybikiLz48L3N2Zz4=')] bg-repeat relative"
            >
              <div className="absolute inset-0 bg-[#0b0b0b]/95 z-0"></div>
              <div className="relative z-10 space-y-4 flex flex-col items-end">
                <div className="flex justify-center w-full my-4">
                  <span className="text-[10px] font-medium text-[#737373] bg-[#1f2225] px-3 py-1 rounded-full border border-white/5 shadow-sm">Message Parts</span>
                </div>
                {messageParts.map((part) => (
                  <div key={part.id} className={`group relative bg-[#005c4b] text-white rounded-tl-xl rounded-bl-xl rounded-br-xl p-3 max-w-[80%] text-sm shadow-md transition-all ${part.isEditing ? 'ring-2 ring-[#25D366]/50 w-full' : ''}`}>
                    <button
                      onClick={() => removePart(part.id)}
                      className={`absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-400 hover:scale-110 transition-all ${part.isEditing ? 'hidden' : ''}`}
                    >
                      <Trash2 size={18} />
                    </button>

                    {part.isEditing ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          autoFocus
                          value={part.text}
                          onChange={(e) => updatePartText(part.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              saveEdit(part.id);
                            }
                          }}
                          className="w-full bg-black/20 border-none text-sm text-white focus:ring-0 p-1 rounded min-h-[60px] resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => toggleEdit(part.id)}
                            className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(part.id)}
                            className="text-[10px] bg-[#25D366] hover:bg-[#128C7E] px-2 py-1 rounded transition-colors font-semibold"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap">{part.text}</p>
                        <div className="flex items-center justify-end gap-2 mt-1">
                          <span className="text-[10px] text-white/70">{part.time}</span>
                          <button
                            onClick={() => toggleEdit(part.id)}
                            className="text-[10px] text-[#25D366]/70 hover:text-[#25D366] transition-colors font-medium"
                          >
                            Edit
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[#121212] border-t border-[#404040]">
              <div className="flex items-end gap-2 bg-[#202023] rounded-2xl p-2 border border-[#404040] focus-within:ring-1 focus-within:ring-[#25D366]/50 transition-all">
                <button className="p-2 text-[#a3a3a3] hover:text-white transition-colors rounded-full hover:bg-white/5">
                  <Smile size={20} />
                </button>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddPart();
                    }
                  }}
                  className="flex-1 bg-transparent border-none text-sm text-white placeholder-[#737373] focus:ring-0 p-2 max-h-32 min-h-[44px] resize-none"
                  placeholder="Type a new message part..."
                  rows={1}
                ></textarea>
                <div className="flex items-center gap-1 p-1">
                  <button
                    onClick={handleAddPart}
                    className="bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full p-2 w-9 h-9 flex items-center justify-center transition-all shadow-md"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
              <div className="flex justify-end items-center mt-2 px-2">
                <span className="text-[10px] text-[#737373]">Press Shift + Enter for new line</span>
              </div>
            </div>
          </div>

          {/* Right Column: Schedule Settings */}
          <div className="w-full md:w-[40%] bg-[#18181b] flex flex-col">
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider">Schedule Details</label>
                <button className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg text-[#a3a3a3] hover:bg-white/5 transition-colors group">
                  <Settings2 size={16} />
                  Options
                </button>
              </div>

              <div className="mb-6">
                <Calendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              </div>

              <div className="mb-6">
                <label className="block text-xs font-semibold text-[#737373] uppercase tracking-wider mb-3">Select Time</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="w-full bg-[#27272a] border border-[#404040] rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#25D366]/50 focus:border-[#25D366] focus:outline-none"
                    />
                  </div>
                  <div className="relative flex-1">
                    <select
                      value={selectedTzIdx}
                      onChange={(e) => setSelectedTzIdx(Number(e.target.value))}
                      className="w-full bg-[#27272a] border border-[#404040] rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-[#25D366]/50 focus:border-[#25D366] focus:outline-none appearance-none cursor-pointer"
                    >
                      {COMMON_TIMEZONES.map((tz, i) => (
                        <option key={tz.iana} value={i}>{tz.utcOffset} {tz.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Time Summary */}
                <div className="mt-6 px-1 space-y-1">
                  <p className="text-[11px] text-white/40 font-medium mb-1.5 uppercase tracking-widest">Scheduled</p>
                  <p className="text-[10px] text-white/20 font-light leading-relaxed">
                    Your time: {scheduleDetails.yourTime}
                  </p>
                  <p className="text-[10px] text-white/20 font-light leading-relaxed">
                    Their time: {scheduleDetails.recipientTime}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#404040] bg-[#121212] flex flex-col gap-3">
              <button
                onClick={handleSchedule}
                disabled={loading || !selectedContact || messageParts.length === 0}
                className="w-full py-3.5 rounded-xl text-sm font-semibold bg-[#25D366] hover:bg-[#128C7E] text-white shadow-[0_0_15px_-3px_rgba(37,211,102,0.15)] transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Scheduling...' : 'Schedule Message'}
                <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
              <button className="w-full py-2.5 rounded-xl text-sm font-medium text-[#a3a3a3] hover:text-white hover:bg-white/5 transition-colors">
                Save as Draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
