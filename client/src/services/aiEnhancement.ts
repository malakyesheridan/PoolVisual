// client/src/services/aiEnhancement.ts
export type CreateJobPayload = {
  tenantId: string;
  photoId: string;
  imageUrl: string;
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

