// JobsList.tsx
// Location on Saadi VPS: /var/www/whatsapp-scheduler/components/JobsList.tsx
//
// Purpose: Display scheduled jobs with progress tracking for Phase 1
// Created: December 24, 2025

'use client';

import { Clock, Users, MessageSquare, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';

interface MessagePart {
  orderIndex: number;
  text: string;
  delayAfterSeconds: number | null;
}

interface JobConfig {
  intervalMode: 'manual' | 'auto';
  recipientGapSeconds: number;
  maxRetries: number;
}

interface JobProgress {
  currentRecipientIndex: number;
  currentPartIndex: number;
  recipientsSent: number;
  recipientsFailed: number;
  lastSentAt: string | null;
}

interface ScheduledJob {
  id: string;
  createdBy: string;
  createdAt: string;
  scheduledStartAt: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  recipients: string[];
  messageParts: MessagePart[];
  config: JobConfig;
  progress: JobProgress;
  completedAt?: string;
  error?: string;
}

interface JobsListProps {
  jobs: ScheduledJob[];
  onCancel: (jobId: string) => void;
  onRefresh: () => void;
}

export default function JobsList({ jobs, onCancel, onRefresh }: JobsListProps) {
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  };

  const formatRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const absDiff = Math.abs(diff);

    const minutes = Math.floor(absDiff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (diff > 0) {
      // Future
      if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
      if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
      if (minutes > 0) return `in ${minutes} min`;
      return 'very soon';
    } else {
      // Past
      if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
      if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      if (minutes > 0) return `${minutes} min ago`;
      return 'just now';
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: {
        bg: 'bg-yellow-500 bg-opacity-20',
        text: 'text-yellow-500',
        icon: Clock
      },
      running: {
        bg: 'bg-blue-500 bg-opacity-20',
        text: 'text-blue-500',
        icon: Loader
      },
      completed: {
        bg: 'bg-green-500 bg-opacity-20',
        text: 'text-green-500',
        icon: CheckCircle
      },
      failed: {
        bg: 'bg-red-500 bg-opacity-20',
        text: 'text-red-500',
        icon: XCircle
      },
      cancelled: {
        bg: 'bg-gray-500 bg-opacity-20',
        text: 'text-gray-500',
        icon: XCircle
      },
      paused: {
        bg: 'bg-orange-500 bg-opacity-20',
        text: 'text-orange-500',
        icon: AlertCircle
      }
    };

    const style = styles[status as keyof typeof styles] || styles.pending;
    const Icon = style.icon;

    return (
      <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${style.bg} ${style.text}`}>
        <Icon size={14} className={status === 'running' ? 'animate-spin' : ''} />
        {status.toUpperCase()}
      </span>
    );
  };

  const calculateProgressPercentage = (job: ScheduledJob) => {
    const totalRecipients = job.recipients.length;
    return (job.progress.recipientsSent / totalRecipients) * 100;
  };

  // Sort jobs: running first, then pending, then completed/failed
  const sortedJobs = [...jobs].sort((a, b) => {
    const statusOrder = { running: 0, pending: 1, paused: 2, completed: 3, failed: 4, cancelled: 5 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  if (jobs.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-block p-6 bg-dark-surface rounded-full mb-4">
          <MessageSquare size={48} className="text-dark-text-dim" />
        </div>
        <h3 className="text-xl font-semibold text-dark-text mb-2">No scheduled jobs yet</h3>
        <p className="text-dark-text-dim mb-6">
          Create your first multi-message job to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-dark-text">
          Scheduled Jobs ({jobs.length})
        </h2>
        <button
          onClick={onRefresh}
          className="px-4 py-2 text-sm bg-dark-surface hover:bg-dark-hover border border-dark-border rounded-lg text-dark-text transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Jobs Grid */}
      <div className="space-y-4">
        {sortedJobs.map(job => (
          <div
            key={job.id}
            className="bg-dark-surface border border-dark-border rounded-lg p-6 hover:border-primary transition-colors"
          >
            {/* Job Header */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex-grow">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg text-dark-text">
                    Job #{job.id.split('_').slice(-1)[0]}
                  </h3>
                  {getStatusBadge(job.status)}
                </div>
                <p className="text-sm text-dark-text-dim">
                  Scheduled for {formatDate(job.scheduledStartAt)}
                  <span className="ml-2 text-primary">({formatRelativeTime(job.scheduledStartAt)})</span>
                </p>
              </div>

              {job.status === 'pending' && (
                <button
                  onClick={() => onCancel(job.id)}
                  className="px-4 py-2 text-sm bg-danger hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Job Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-dark-bg rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users size={16} className="text-primary" />
                  <span className="text-xs text-dark-text-dim">Recipients</span>
                </div>
                <p className="text-xl font-bold text-dark-text">{job.recipients.length}</p>
              </div>

              <div className="bg-dark-bg rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare size={16} className="text-primary" />
                  <span className="text-xs text-dark-text-dim">Message Parts</span>
                </div>
                <p className="text-xl font-bold text-dark-text">{job.messageParts.length}</p>
              </div>

              <div className="bg-dark-bg rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle size={16} className="text-success" />
                  <span className="text-xs text-dark-text-dim">Sent</span>
                </div>
                <p className="text-xl font-bold text-dark-text">{job.progress.recipientsSent}</p>
              </div>

              <div className="bg-dark-bg rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle size={16} className="text-danger" />
                  <span className="text-xs text-dark-text-dim">Failed</span>
                </div>
                <p className="text-xl font-bold text-dark-text">{job.progress.recipientsFailed}</p>
              </div>
            </div>

            {/* Progress Bar */}
            {(job.status === 'running' || job.status === 'completed' || job.status === 'paused') && (
              <div className="mb-4">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-dark-text-dim">Progress</span>
                  <span className="text-dark-text font-medium">
                    {job.progress.recipientsSent} / {job.recipients.length} recipients
                  </span>
                </div>
                <div className="w-full bg-dark-bg rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      job.status === 'completed' ? 'bg-success' :
                      job.status === 'running' ? 'bg-primary' :
                      'bg-orange-500'
                    }`}
                    style={{
                      width: `${calculateProgressPercentage(job)}%`
                    }}
                  />
                </div>

                {job.status === 'running' && (
                  <p className="text-xs text-primary mt-2">
                    Currently on recipient {job.progress.currentRecipientIndex + 1}, part {job.progress.currentPartIndex + 1}
                  </p>
                )}

                {job.progress.recipientsFailed > 0 && (
                  <p className="text-xs text-danger mt-2">
                    ⚠️ {job.progress.recipientsFailed} recipient(s) failed
                  </p>
                )}
              </div>
            )}

            {/* Message Preview */}
            <div className="border-t border-dark-border pt-4">
              <p className="text-sm font-medium text-dark-text mb-3">Message Sequence:</p>
              <div className="space-y-2">
                {job.messageParts.slice(0, 3).map((part, i) => (
                  <div key={i} className="bg-dark-bg rounded-lg p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-primary bg-opacity-20 text-primary rounded-full flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-sm text-dark-text truncate">
                          {part.text}
                        </p>
                        {part.delayAfterSeconds && (
                          <p className="text-xs text-dark-text-dim mt-1">
                            ⏱️ {part.delayAfterSeconds}s delay after
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {job.messageParts.length > 3 && (
                  <p className="text-sm text-dark-text-dim text-center">
                    +{job.messageParts.length - 3} more message parts...
                  </p>
                )}
              </div>
            </div>

            {/* Configuration */}
            <div className="border-t border-dark-border pt-4 mt-4">
              <p className="text-sm font-medium text-dark-text mb-2">Configuration:</p>
              <div className="flex flex-wrap gap-3 text-xs text-dark-text-dim">
                <span className="bg-dark-bg px-3 py-1 rounded">
                  Gap: {job.config.recipientGapSeconds}s
                </span>
                <span className="bg-dark-bg px-3 py-1 rounded">
                  Max Retries: {job.config.maxRetries}
                </span>
                <span className="bg-dark-bg px-3 py-1 rounded">
                  Mode: {job.config.intervalMode}
                </span>
              </div>
            </div>

            {/* Error Display */}
            {job.error && (
              <div className="border-t border-dark-border pt-4 mt-4">
                <div className="bg-danger bg-opacity-10 border border-danger rounded-lg p-3">
                  <p className="text-sm font-medium text-danger mb-1">Error</p>
                  <p className="text-xs text-dark-text">{job.error}</p>
                </div>
              </div>
            )}

            {/* Completion Time */}
            {job.completedAt && (
              <div className="border-t border-dark-border pt-4 mt-4">
                <p className="text-xs text-dark-text-dim">
                  Completed: {formatDate(job.completedAt)} ({formatRelativeTime(job.completedAt)})
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
