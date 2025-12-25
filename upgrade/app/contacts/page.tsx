'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Search, Star, Edit2, Trash2, X, Plus, Globe } from 'lucide-react';
import type { Contact } from '@/lib/s3';
import { COMMON_TIMEZONES, getTimezoneFromPhone, formatTimezoneDisplay } from '@/lib/timezones';

interface EditingContact {
  phone: string;
  name: string;
  aliases: string[];
  phones: { primary: string; secondary: string | null };
  defaultPhone: 'primary' | 'secondary';
  favorite: boolean;
  tags: string[];
  timezone: string;
  isNew?: boolean;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [search, setSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingContact, setEditingContact] = useState<EditingContact | null>(null);
  const [newAlias, setNewAlias] = useState('');
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    const res = await fetch('/api/contacts');
    const data = await res.json();
    setContacts(data);
    setLoading(false);
  };

  const toggleFavorite = async (phone: string) => {
    const updated = {
      ...contacts,
      [phone]: { ...contacts[phone], favorite: !contacts[phone].favorite }
    };
    setContacts(updated);
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
  };

  // Get the default phone number for a contact
  const getDefaultPhone = (contact: Contact) => {
    if (contact.defaultPhone === 'secondary' && contact.phones.secondary) {
      return contact.phones.secondary;
    }
    return contact.phones.primary;
  };

  const openEditModal = (phone: string, contact: Contact) => {
    setEditingContact({
      phone,
      name: contact.name,
      aliases: [...contact.aliases],
      phones: { ...contact.phones },
      defaultPhone: contact.defaultPhone || 'primary',
      favorite: contact.favorite,
      tags: contact.tags || [],
      timezone: contact.timezone || getTimezoneFromPhone(contact.phones.primary)
    });
  };

  const openCreateModal = () => {
    setEditingContact({
      phone: '',
      name: '',
      aliases: [],
      phones: { primary: '', secondary: null },
      defaultPhone: 'primary',
      favorite: false,
      tags: [],
      timezone: 'Europe/London',
      isNew: true
    });
  };

  const closeEditModal = () => {
    setEditingContact(null);
    setNewAlias('');
    setNewTag('');
  };

  const saveContact = async () => {
    if (!editingContact) return;

    // Validation
    if (!editingContact.name.trim()) {
      alert('Please enter a contact name');
      return;
    }
    if (!editingContact.phones.primary.trim()) {
      alert('Please enter a primary phone number');
      return;
    }

    const updated = { ...contacts };

    // If primary phone changed or creating new, delete old key and create new one
    if (editingContact.phone !== editingContact.phones.primary) {
      delete updated[editingContact.phone];
    }

    updated[editingContact.phones.primary] = {
      name: editingContact.name,
      aliases: editingContact.aliases,
      phones: editingContact.phones,
      defaultPhone: editingContact.defaultPhone,
      favorite: editingContact.favorite,
      tags: editingContact.tags,
      timezone: editingContact.timezone
    };

    setContacts(updated);
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });

    closeEditModal();
    await loadContacts(); // Reload to ensure consistency
  };

  const deleteContact = async (phone: string, contactName: string) => {
    if (!confirm(`Delete contact "${contactName}"? This cannot be undone.`)) return;

    const updated = { ...contacts };
    delete updated[phone];

    setContacts(updated);
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });

    await loadContacts();
  };

  const addAlias = () => {
    if (!editingContact || !newAlias.trim()) return;
    setEditingContact({
      ...editingContact,
      aliases: [...editingContact.aliases, newAlias.trim()]
    });
    setNewAlias('');
  };

  const removeAlias = (index: number) => {
    if (!editingContact) return;
    setEditingContact({
      ...editingContact,
      aliases: editingContact.aliases.filter((_, i) => i !== index)
    });
  };

  const addTag = () => {
    if (!editingContact || !newTag.trim()) return;
    setEditingContact({
      ...editingContact,
      tags: [...editingContact.tags, newTag.trim()]
    });
    setNewTag('');
  };

  const removeTag = (index: number) => {
    if (!editingContact) return;
    setEditingContact({
      ...editingContact,
      tags: editingContact.tags.filter((_, i) => i !== index)
    });
  };

  const filteredContacts = Object.entries(contacts).filter(([phone, contact]) => {
    const matchesSearch = search === '' || 
      contact.name.toLowerCase().includes(search.toLowerCase()) ||
      phone.includes(search) ||
      contact.aliases.some(a => a.toLowerCase().includes(search.toLowerCase()));
    
    const matchesFavorite = !showFavoritesOnly || contact.favorite;
    
    return matchesSearch && matchesFavorite;
  });

  const favoriteContacts = filteredContacts.filter(([_, c]) => c.favorite);
  const regularContacts = filteredContacts.filter(([_, c]) => !c.favorite);
  const sortedContacts = [...favoriteContacts, ...regularContacts];

  return (
    <Layout hideScheduleButton>
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Contacts</h1>
              <p className="text-[#a3a3a3] mt-1">{Object.keys(contacts).length} total contacts</p>
            </div>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 font-medium whitespace-nowrap flex-shrink-0"
            >
              <Plus size={18} />
              Add Contact
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737373]" size={18} />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-11"
            />
          </div>
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={showFavoritesOnly ? 'btn-primary' : 'btn-secondary'}
          >
            <Star size={18} className="inline mr-2" />
            Favorites
          </button>
        </div>

        <div className="card">
          {loading ? (
            <p className="text-[#737373]">Loading...</p>
          ) : sortedContacts.length === 0 ? (
            <p className="text-[#737373] text-center py-8">No contacts found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#404040]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Phone</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Timezone</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Aliases</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Tags</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[#a3a3a3]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedContacts.map(([phone, contact]) => (
                    <tr key={phone} className="border-b border-[#404040] last:border-0 hover:bg-[#2d2d2d] transition-colors">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleFavorite(phone)}
                            className="text-[#737373] hover:text-yellow-500 transition-colors"
                          >
                            <Star
                              size={16}
                              className={contact.favorite ? 'text-yellow-500 fill-yellow-500' : ''}
                            />
                          </button>
                          <span className="text-white font-medium">{contact.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-[#a3a3a3] font-mono text-sm">
                        {getDefaultPhone(contact)}
                        {contact.defaultPhone === 'secondary' && contact.phones.secondary && (
                          <span className="ml-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">Secondary</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 text-sm">
                          <Globe size={14} className="text-[#737373]" />
                          <span className="text-[#a3a3a3]">
                            {contact.timezone ? formatTimezoneDisplay(contact.timezone) : 'UTC+00 London, UK'}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2 flex-wrap">
                          {contact.aliases.slice(0, 3).map((alias, i) => (
                            <span key={i} className="px-2 py-1 bg-[#2d2d2d] text-[#a3a3a3] text-xs rounded">
                              {alias}
                            </span>
                          ))}
                          {contact.aliases.length > 3 && (
                            <span className="px-2 py-1 bg-[#2d2d2d] text-[#737373] text-xs rounded">
                              +{contact.aliases.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex gap-2 flex-wrap">
                          {(contact.tags || []).slice(0, 2).map((tag, i) => (
                            <span key={i} className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded border border-blue-500/20">
                              {tag}
                            </span>
                          ))}
                          {(contact.tags || []).length > 2 && (
                            <span className="px-2 py-1 bg-[#2d2d2d] text-[#737373] text-xs rounded">
                              +{(contact.tags || []).length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => openEditModal(phone, contact)}
                            className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
                          >
                            <Edit2 size={16} />
                            Edit
                          </button>
                          <button
                            onClick={() => deleteContact(phone, contact.name)}
                            className="text-red-400 hover:text-red-300 transition-colors inline-flex items-center gap-1"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Contact Modal */}
      {editingContact && (
        <>
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={closeEditModal}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-[#404040] rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {editingContact.isNew ? 'Add New Contact' : 'Edit Contact'}
                </h2>
                <button onClick={closeEditModal} className="text-[#a3a3a3] hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Name</label>
                  <input
                    type="text"
                    value={editingContact.name}
                    onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                    className="input w-full"
                  />
                </div>

                {/* Phone Numbers */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">Phone Numbers</label>
                  <p className="text-xs text-[#737373] mb-3">Select which number to use as default for messaging</p>

                  {/* Primary Phone */}
                  <div className="mb-3">
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="radio"
                        id="default-primary"
                        name="defaultPhone"
                        checked={editingContact.defaultPhone === 'primary'}
                        onChange={() => setEditingContact({ ...editingContact, defaultPhone: 'primary' })}
                        className="w-4 h-4 text-blue-500 focus:ring-blue-500"
                      />
                      <label htmlFor="default-primary" className="text-sm text-white cursor-pointer flex items-center gap-2">
                        Primary Phone
                        {editingContact.defaultPhone === 'primary' && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
                            Default
                          </span>
                        )}
                      </label>
                    </div>
                    <input
                      type="text"
                      value={editingContact.phones.primary}
                      onChange={(e) => {
                        // Strip + prefix and whitespace from phone number
                        const cleaned = e.target.value.replace(/^\+/, '').replace(/\s/g, '');
                        setEditingContact({
                          ...editingContact,
                          phones: { ...editingContact.phones, primary: cleaned }
                        });
                      }}
                      className="input w-full font-mono ml-7"
                    />
                  </div>

                  {/* Secondary Phone */}
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="radio"
                        id="default-secondary"
                        name="defaultPhone"
                        checked={editingContact.defaultPhone === 'secondary'}
                        onChange={() => setEditingContact({ ...editingContact, defaultPhone: 'secondary' })}
                        disabled={!editingContact.phones.secondary}
                        className="w-4 h-4 text-blue-500 focus:ring-blue-500 disabled:opacity-30"
                      />
                      <label htmlFor="default-secondary" className={`text-sm cursor-pointer flex items-center gap-2 ${!editingContact.phones.secondary ? 'text-[#737373]' : 'text-white'}`}>
                        Secondary Phone (Optional)
                        {editingContact.defaultPhone === 'secondary' && editingContact.phones.secondary && (
                          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
                            Default
                          </span>
                        )}
                      </label>
                    </div>
                    <input
                      type="text"
                      value={editingContact.phones.secondary || ''}
                      onChange={(e) => {
                        // Strip + prefix and whitespace from phone number
                        const cleaned = e.target.value.replace(/^\+/, '').replace(/\s/g, '');
                        const newSecondary = cleaned || null;
                        setEditingContact({
                          ...editingContact,
                          phones: { ...editingContact.phones, secondary: newSecondary },
                          // If clearing secondary and it was default, switch to primary
                          defaultPhone: !newSecondary && editingContact.defaultPhone === 'secondary' ? 'primary' : editingContact.defaultPhone
                        });
                      }}
                      className="input w-full font-mono ml-7"
                      placeholder="Add secondary phone number..."
                    />
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    <Globe size={14} className="inline mr-2" />
                    Timezone
                  </label>
                  <p className="text-xs text-[#737373] mb-3">Used to schedule messages in their local time</p>
                  <select
                    value={editingContact.timezone}
                    onChange={(e) => setEditingContact({ ...editingContact, timezone: e.target.value })}
                    className="input w-full"
                  >
                    {COMMON_TIMEZONES.map(tz => (
                      <option key={tz.iana} value={tz.iana}>
                        UTC{tz.utcOffset} {tz.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-blue-400 mt-2">
                    💡 Auto-detected from phone: {formatTimezoneDisplay(getTimezoneFromPhone(editingContact.phones.primary))}
                  </p>
                </div>

                {/* Aliases */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Aliases</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newAlias}
                      onChange={(e) => setNewAlias(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAlias())}
                      className="input flex-1"
                      placeholder="Add alias..."
                    />
                    <button onClick={addAlias} className="btn-primary">
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {editingContact.aliases.map((alias, i) => (
                      <div key={i} className="px-3 py-1 bg-[#2d2d2d] text-white text-sm rounded flex items-center gap-2">
                        {alias}
                        <button onClick={() => removeAlias(i)} className="text-[#737373] hover:text-white">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Tags</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      className="input flex-1"
                      placeholder="Add tag..."
                    />
                    <button onClick={addTag} className="btn-primary">
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {editingContact.tags.map((tag, i) => (
                      <div key={i} className="px-3 py-1 bg-blue-500/10 text-blue-400 text-sm rounded border border-blue-500/20 flex items-center gap-2">
                        {tag}
                        <button onClick={() => removeTag(i)} className="text-blue-400/60 hover:text-blue-400">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Favorite */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingContact.favorite}
                      onChange={(e) => setEditingContact({ ...editingContact, favorite: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-white">Mark as favorite</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4">
                  <button onClick={closeEditModal} className="btn-secondary">
                    Cancel
                  </button>
                  <button onClick={saveContact} className="btn-primary">
                    {editingContact.isNew ? 'Add Contact' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
