// client/src/services/aiEnhancement.ts
export type CreateJobPayload = {
  tenantId: string;
  photoId: string;
  imageUrl: string;
  compositeImageUrl?: string; // Client-exported canvas (image with masks applied)
  inputHash: string;
  masks: any[];
  options: Record<string, any>;
  calibration: number;
  width: number;
  height: number;
  idempotencyKey?: string;
};

export type Job = {
  id: string;
  status: 'queued'|'downloading'|'preprocessing'|'rendering'|'postprocessing'|'uploading'|'completed'|'failed'|'canceled';
  progress_percent: number | null;
  variants?: Array<{ id: string; url: string; rank?: number }>;
  error_message?: string | null;
  updated_at?: string;
  created_at?: string;
  completed_at?: string;
  mode?: 'add_pool' | 'add_decoration' | 'blend_materials'; // Enhancement type
};

const BASE = '/api/ai/enhancement';

export async function createJob(payload: CreateJobPayload) {
  const res = await fetch(`${BASE}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ jobId: string; status: string }>;
}

export function openJobStream(jobId: string, onMessage: (data: any) => void) {
  const es = new EventSource(`${BASE}/${jobId}/stream`, { withCredentials: true });
  es.onmessage = (evt) => {
    try { onMessage(JSON.parse(evt.data)); } catch {}
  };
  es.onerror = () => { /* keep alive, server pings every 15s */ };
  return () => es.close();
}

export async function getRecentJobs(limit = 20): Promise<{ jobs: Job[] }> {
  const res = await fetch(`${BASE}?limit=${limit}`, { credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function cancelJob(jobId: string): Promise<{ ok: boolean; status: string }> {
  const res = await fetch(`${BASE}/${jobId}/cancel`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to cancel job');
  }
  return res.json();
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${BASE}/${jobId}`, { credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Bulk Operations
export async function bulkDeleteJobs(jobIds: string[]): Promise<{ deleted: number; failed: number }> {
  const res = await fetch(`${BASE}/bulk-delete`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobIds }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to delete jobs');
  }
  return res.json();
}

export async function bulkCancelJobs(jobIds: string[]): Promise<{ canceled: number; failed: number }> {
  const res = await fetch(`${BASE}/bulk-cancel`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobIds }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to cancel jobs');
  }
  return res.json();
}

export async function bulkRetryJobs(jobIds: string[]): Promise<{ retried: number; failed: number }> {
  const res = await fetch(`${BASE}/bulk-retry`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobIds }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to retry jobs');
  }
  return res.json();
}

