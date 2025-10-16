import { useState } from 'react';

type Pt = { x: number; y: number };
type Draft = { mode: 'area' | 'polygon'; pts: Pt[] } | null;

export function useDraft() {
  const [draft, setDraft] = useState<Draft>(null);

  return {
    draft,
    begin(mode: 'area' | 'polygon') { 
      setDraft({ mode, pts: [] }); 
    },
    append(pt: Pt) { 
      setDraft(d => !d ? d : ({ ...d, pts: [...d.pts, pt] })); 
    },
    updateLast(pt: Pt) {
      setDraft(d => !d || d.pts.length === 0 ? d : ({ ...d, pts: [...d.pts.slice(0, -1), pt] }));
    },
    pop() { 
      setDraft(d => !d || d.pts.length === 0 ? d : ({ ...d, pts: d.pts.slice(0, -1) })); 
    },
    cancel() { 
      setDraft(null); 
    },
    canFinalize() { 
      return !!draft && draft.pts.length >= 3; 
    },
    finalize() {
      if (!draft || draft.pts.length < 3) return null;
      const out = draft; 
      setDraft(null); 
      return out;
    },
  };
}
