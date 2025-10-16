import { useEffect } from 'react';
import { MaskingEngine } from '../../masking/engine';
import { commitMaskToStore } from '../../masking/storeAdapter';

interface KeyBindingsProps {
  engine: MaskingEngine;
}

export function KeyBindings({ engine }: KeyBindingsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const draft = engine.getDraft();
      if (!draft) return;

      console.log('[Finalize attempt]', draft);

      switch (e.key) {
        case 'Enter':
          if (engine.canFinalize()) {
            const res = engine.finalize();
            if (res) {
              console.log('[Finalize success]', res);
              commitMaskToStore(res.mode, res.pts);
            }
          }
          break;
          
        case 'Escape':
          engine.cancel();
          break;
          
        case 'Backspace':
          engine.backspace();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [engine]);

  return null;
}
