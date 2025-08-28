// Upload helpers for mobile image handling
import { normalizeImage } from './normalizeImage';

// Replace these with your real API calls
async function requestSignedUpload(jobId: string): Promise<{ uploadUrl: string; publicUrl: string; photoId: string }> {
  const res = await fetch(`/api/photos?jobId=${encodeURIComponent(jobId)}`, { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function putBlob(uploadUrl: string, blob: Blob): Promise<void> {
  const put = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
  if (!put.ok) throw new Error(`Upload failed: ${put.status}`);
}

export async function uploadNormalizedPhoto(jobId: string, blob: Blob) {
  const { uploadUrl, publicUrl, photoId } = await requestSignedUpload(jobId);
  await putBlob(uploadUrl, blob);
  return { publicUrl, photoId };
}