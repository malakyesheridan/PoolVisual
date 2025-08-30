import { useMaterialsStore } from '../state/materialsStore';
import { listMaterialsClient } from '../lib/materialsClient';

/** Call once at app startup (and optionally on window focus). */
export async function initMaterialsOnce() {
  const state = useMaterialsStore.getState();
  // If we already have cached items, don't block; just lazy-merge fresh list.
  try {
    const list = await listMaterialsClient();
    state.hydrateMerge(list); // MERGES; does nothing if list is []
  } catch (e) {
    // ignore; keep cache
    console.warn('[materials] init list failed', e);
  }
}

// Optional: background refresh on tab focus
export function attachMaterialsFocusRefresh() {
  const handler = async () => {
    try {
      const list = await listMaterialsClient();
      useMaterialsStore.getState().hydrateMerge(list);
    } catch {}
  };
  window.addEventListener('focus', handler);
  return () => window.removeEventListener('focus', handler);
}