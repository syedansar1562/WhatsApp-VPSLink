'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { Save, RefreshCw } from 'lucide-react';

interface Settings {
  jobs: {
    automaticMode: boolean;
    defaultMessageDelay: number;
    defaultRecipientGap: number;
    maxRetries: number;
    humanization: {
      enabled: boolean;
      minDelay: number;
      maxDelay: number;
      typingSpeed: number;
    };
  };
  ui: {
    theme: string;
    notifications: boolean;
  };
  updatedAt?: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to save settings');
      }

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadSettings();
    setMessage({ type: 'success', text: 'Settings reset' });
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <Layout>
        {() => (
          <div className="flex items-center justify-center h-64">
            <div className="text-[#737373]">Loading settings...</div>
          </div>
        )}
      </Layout>
    );
  }

  if (!settings) {
    return (
      <Layout>
        {() => (
          <div className="flex items-center justify-center h-64">
            <div className="text-red-500">Failed to load settings</div>
          </div>
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      {() => (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Settings</h1>
              <p className="text-[#a3a3a3] mt-1">Configure global defaults for scheduled jobs</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                disabled={saving}
                className="px-4 py-2 bg-[#2d2d2d] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors flex items-center gap-2"
              >
                <RefreshCw size={18} />
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Success/Error Message */}
          {message && (
            <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {message.text}
            </div>
          )}

          {/* Job Settings */}
          <div className="card">
            <h2 className="text-xl font-bold text-white mb-4">Multi-Message Job Defaults</h2>

            {/* Automatic Mode */}
            <div className="mb-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.jobs.automaticMode}
                  onChange={(e) => setSettings({
                    ...settings,
                    jobs: { ...settings.jobs, automaticMode: e.target.checked }
                  })}
                  className="w-5 h-5 rounded border-[#404040] bg-[#2d2d2d] checked:bg-blue-500"
                />
                <div>
                  <div className="text-white font-medium">Automatic Mode (Recommended)</div>
                  <div className="text-sm text-[#737373]">Automatically calculate human-like delays based on message length</div>
                </div>
              </label>
            </div>

            {/* Manual Settings (shown when automatic mode is off) */}
            {!settings.jobs.automaticMode && (
              <div className="space-y-4 pl-8 border-l-2 border-[#404040] ml-2 mb-6">
                <div>
                  <label className="block text-sm font-medium text-[#a3a3a3] mb-2">
                    Default Delay Between Messages (seconds)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={settings.jobs.defaultMessageDelay}
                    onChange={(e) => setSettings({
                      ...settings,
                      jobs: { ...settings.jobs, defaultMessageDelay: parseFloat(e.target.value) }
                    })}
                    className="input w-full max-w-xs"
                  />
                  <p className="text-xs text-[#737373] mt-1">Time to wait between each message part</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#a3a3a3] mb-2">
                    Gap Between Recipients (seconds)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={settings.jobs.defaultRecipientGap}
                    onChange={(e) => setSettings({
                      ...settings,
                      jobs: { ...settings.jobs, defaultRecipientGap: parseInt(e.target.value) }
                    })}
                    className="input w-full max-w-xs"
                  />
                  <p className="text-xs text-[#737373] mt-1">Time to wait before moving to next recipient</p>
                </div>
              </div>
            )}

            {/* Humanization Settings (shown when automatic mode is on) */}
            {settings.jobs.automaticMode && (
              <div className="space-y-4 pl-8 border-l-2 border-blue-500/30 ml-2 mb-6">
                <div>
                  <label className="flex items-center gap-3 cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      checked={settings.jobs.humanization.enabled}
                      onChange={(e) => setSettings({
                        ...settings,
                        jobs: {
                          ...settings.jobs,
                          humanization: { ...settings.jobs.humanization, enabled: e.target.checked }
                        }
                      })}
                      className="w-5 h-5 rounded border-[#404040] bg-[#2d2d2d] checked:bg-blue-500"
                    />
                    <div>
                      <div className="text-white font-medium">Enable Humanization</div>
                      <div className="text-sm text-[#737373]">Add randomness and typing simulation</div>
                    </div>
                  </label>
                </div>

                {settings.jobs.humanization.enabled && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[#a3a3a3] mb-2">
                        Delay Range (seconds)
                      </label>
                      <div className="flex gap-4 items-center">
                        <div className="flex-1">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={settings.jobs.humanization.minDelay}
                            onChange={(e) => setSettings({
                              ...settings,
                              jobs: {
                                ...settings.jobs,
                                humanization: { ...settings.jobs.humanization, minDelay: parseFloat(e.target.value) }
                              }
                            })}
                            className="input w-full"
                          />
                          <p className="text-xs text-[#737373] mt-1">Min</p>
                        </div>
                        <span className="text-[#737373]">to</span>
                        <div className="flex-1">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={settings.jobs.humanization.maxDelay}
                            onChange={(e) => setSettings({
                              ...settings,
                              jobs: {
                                ...settings.jobs,
                                humanization: { ...settings.jobs.humanization, maxDelay: parseFloat(e.target.value) }
                              }
                            })}
                            className="input w-full"
                          />
                          <p className="text-xs text-[#737373] mt-1">Max</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[#a3a3a3] mb-2">
                        Simulated Typing Speed (chars/second)
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="200"
                        step="5"
                        value={settings.jobs.humanization.typingSpeed}
                        onChange={(e) => setSettings({
                          ...settings,
                          jobs: {
                            ...settings.jobs,
                            humanization: { ...settings.jobs.humanization, typingSpeed: parseInt(e.target.value) }
                          }
                        })}
                        className="input w-full max-w-xs"
                      />
                      <p className="text-xs text-[#737373] mt-1">Higher = faster typing (50 is average human speed)</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Max Retries */}
            <div>
              <label className="block text-sm font-medium text-[#a3a3a3] mb-2">
                Max Retries on Failure
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.jobs.maxRetries}
                onChange={(e) => setSettings({
                  ...settings,
                  jobs: { ...settings.jobs, maxRetries: parseInt(e.target.value) }
                })}
                className="input w-full max-w-xs"
              />
              <p className="text-xs text-[#737373] mt-1">Number of times to retry sending a failed message</p>
            </div>
          </div>

          {/* Last Updated */}
          {settings.updatedAt && (
            <div className="text-sm text-[#737373] text-center">
              Last updated: {new Date(settings.updatedAt).toLocaleString('en-GB', {
                timeZone: 'Europe/London',
                dateStyle: 'medium',
                timeStyle: 'short'
              })}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
