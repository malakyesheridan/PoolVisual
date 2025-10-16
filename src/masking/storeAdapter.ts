import { useMaskStore } from '../../client/src/maskcore/store';

export function commitMaskToStore(mode: 'area' | 'polygon', pts: { x: number; y: number }[]) {
  const id = `mask_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  console.log('[CommitMaskToStore]', { id, mode, ptsLen: pts.length });
  console.log('[MaskingHotfix] Active – Enter now commits masks');
  useMaskStore.setState(prev => ({
    masks: { ...(prev.masks || {}), [id]: { id, mode, pts } }
  }));
}
