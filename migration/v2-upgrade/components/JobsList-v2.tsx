'use client';

import { useState } from 'react';
import { Trash2, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';

interface Job {
  id: string;
  createdAt: string;
  scheduledStartAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  recipients: string[];
  messageParts: Array<{
    orderIndex: number;
    text: string;
    delayAfterSeconds: number | null;
  }>;
  progress: {
    currentRecipientIndex: number;
    currentPartIndex: number;
    recipientsSent: number;
    recipientsFailed: number;
  };
}

interface Props {
  jobs: Job[];
  onCancel: (jobId: string) => void;
  onRefresh: () => void;
}

export default function JobsList({ jobs, onCancel, onRefresh }: Props) {
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [viewingJob, setViewingJob] = useState<Job | null>(null);

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-[#737373]">
        <p>No scheduled jobs</p>
        <p className="text-sm mt-1">Create your first multi-message job above</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      running: 'bg-blue-500/20 text-blue-400',
      completed: 'bg-green-500/20 text-green-400',
      failed: 'bg-red-500/20 text-red-400',
      cancelled: 'bg-gray-500/20 text-gray-400'
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status as keyof typeof colors] || colors.pending}`}>
        {status}
      </span>
    );
  };

  const formatRecipients = (recipients: string[]) => {
    if (recipients.length === 1) {
      const phone = recipients[0].replace('@s.whatsapp.net', '');
      return phone;
    }
    return `Multiple Recipients (${recipients.length})`;
  };

  const formatMessage = (parts: Job['messageParts']) => {
    if (parts.length === 1) {
      const text = parts[0].text;
      return text.length > 60 ? text.substring(0, 60) + '...' : text;
    }
    return `${parts.length} message parts`;
  };

  return (
    <>
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
            {jobs.map(job => (
              <tr
                key={job.id}
                className="border-b border-[#404040] last:border-0 hover:bg-[#2d2d2d] transition-colors cursor-pointer"
                onClick={() => setViewingJob(job)}
              >
                <td className="py-4 px-4">
                  <p className="text-white text-sm">{formatRecipients(job.recipients)}</p>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <p className="text-[#a3a3a3] text-sm">{formatMessage(job.messageParts)}</p>
                    {job.messageParts.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedJob(expandedJob === job.id ? null : job.id);
                        }}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {expandedJob === job.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                  {expandedJob === job.id && (
                    <div className="mt-2 space-y-1 pl-4 border-l-2 border-blue-500/30">
                      {job.messageParts.map((part, idx) => (
                        <div key={idx} className="text-xs text-[#737373]">
                          <span className="text-blue-400">Part {idx + 1}:</span> {part.text}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-4 px-4">
                  <p className="text-white text-sm whitespace-nowrap">
                    {new Date(job.scheduledStartAt).toLocaleString('en-GB', {
                      timeZone: 'Europe/London',
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </p>
                </td>
                <td className="py-4 px-4">
                  {getStatusBadge(job.status)}
                </td>
                <td className="py-4 px-4">
                  <div className="text-sm">
                    <p className="text-white">{job.progress.recipientsSent}/{job.recipients.length} sent</p>
                    {job.progress.recipientsFailed > 0 && (
                      <p className="text-red-400 text-xs">{job.progress.recipientsFailed} failed</p>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {job.status === 'pending' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Cancel this job?')) {
                            onCancel(job.id);
                          }
                        }}
                        className="text-red-400 hover:text-red-300 transition-colors p-1"
                        title="Cancel job"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Job Details Modal */}
      {viewingJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingJob(null)}>
          <div className="bg-[#1e1e1e] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-[#1e1e1e] border-b border-[#404040] p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Job Details</h2>
                <p className="text-sm text-[#737373] mt-1">{viewingJob.id}</p>
              </div>
              <button
                onClick={() => setViewingJob(null)}
                className="p-2 hover:bg-[#2d2d2d] rounded-lg transition-colors"
              >
                <X className="text-[#a3a3a3]" size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div>
                <h3 className="text-sm font-medium text-[#a3a3a3] mb-2">Status</h3>
                {getStatusBadge(viewingJob.status)}
              </div>

              {/* Recipients */}
              <div>
                <h3 className="text-sm font-medium text-[#a3a3a3] mb-2">
                  Recipients ({viewingJob.recipients.length})
                </h3>
                <div className="space-y-1">
                  {viewingJob.recipients.map((recipient, idx) => (
                    <div key={idx} className="text-white text-sm">
                      {recipient.replace('@s.whatsapp.net', '')}
                    </div>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div>
                <h3 className="text-sm font-medium text-[#a3a3a3] mb-2">
                  Messages ({viewingJob.messageParts.length} parts)
                </h3>
                <div className="space-y-3">
                  {viewingJob.messageParts.map((part, idx) => (
                    <div key={idx} className="bg-[#2d2d2d] rounded-lg p-3">
                      <div className="text-xs text-blue-400 mb-1">Part {idx + 1}</div>
                      <div className="text-white text-sm whitespace-pre-wrap">{part.text}</div>
                      {part.delayAfterSeconds !== null && (
                        <div className="text-xs text-[#737373] mt-2">
                          Delay after: {part.delayAfterSeconds}s
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress */}
              <div>
                <h3 className="text-sm font-medium text-[#a3a3a3] mb-2">Progress</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#737373]">Recipients Sent</span>
                    <span className="text-white">{viewingJob.progress.recipientsSent}/{viewingJob.recipients.length}</span>
                  </div>
                  {viewingJob.progress.recipientsFailed > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#737373]">Recipients Failed</span>
                      <span className="text-red-400">{viewingJob.progress.recipientsFailed}</span>
                    </div>
                  )}
                  <div className="w-full bg-[#2d2d2d] rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${(viewingJob.progress.recipientsSent / viewingJob.recipients.length) * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Timing */}
              <div>
                <h3 className="text-sm font-medium text-[#a3a3a3] mb-2">Timing</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Created</span>
                    <span className="text-white">
                      {new Date(viewingJob.createdAt).toLocaleString('en-GB', {
                        timeZone: 'Europe/London',
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Scheduled Start</span>
                    <span className="text-white">
                      {new Date(viewingJob.scheduledStartAt).toLocaleString('en-GB', {
                        timeZone: 'Europe/London',
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-[#1e1e1e] border-t border-[#404040] p-6 flex justify-end gap-3">
              {viewingJob.status === 'pending' && (
                <button
                  onClick={() => {
                    if (confirm('Cancel this job?')) {
                      onCancel(viewingJob.id);
                      setViewingJob(null);
                    }
                  }}
                  className="px-6 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Cancel Job
                </button>
              )}
              <button
                onClick={() => setViewingJob(null)}
                className="px-6 py-2 bg-[#2d2d2d] text-white rounded-lg hover:bg-[#3a3a3a] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
