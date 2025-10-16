import { create } from "zustand";

type BackgroundState = 'idle' | 'loadingImage' | 'waitingContainer' | 'ready' | 'failed';

type Bg = {
  url: string | null;        // objectURL or external URL
  width: number;
  height: number;
  image: HTMLImageElement | null;
  state: BackgroundState;
  error?: string;
  loadStartTime?: number;
};

type BgStore = {
  bg: Bg;
  setUrl: (url: string | null) => void;
  setImage: (image: HTMLImageElement, width: number, height: number) => void;
  setState: (state: BackgroundState, error?: string) => void;
  clear: () => void;
  isReady: () => boolean;
  getState: () => BackgroundState;
  forceFit: () => void;
  retryUpload: () => void;
};

export const useBackgroundStore = create<BgStore>((set, get) => ({
  bg: { url: null, width: 0, height: 0, image: null, state: 'idle' },
  
  setUrl: (url) => {
    // Revoke previous URL to prevent leaks
    const currentBg = get().bg;
    if (currentBg.url && currentBg.url !== url) {
      URL.revokeObjectURL(currentBg.url);
    }
    
    // Transition to loading state when URL is set
    const newState = url ? 'loadingImage' : 'idle';
    
    // Dev instrumentation: bg.state transitions
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TRACE] bg.state transition: ${currentBg.state} → ${newState} at ${new Date().toISOString()}`, {
        caller: new Error().stack?.split('\n')[2]?.trim(),
        file: 'backgroundStore.ts:setUrl',
        url: url ? 'set' : 'cleared'
      });
    }
    
    set((s) => ({ 
      bg: { 
        ...s.bg, 
        url, 
        state: newState,
        loadStartTime: newState === 'loadingImage' ? Date.now() : undefined,
        error: undefined
      } 
    }));
    console.log('[BackgroundStore] State transition:', newState);
  },
  
  setImage: (image, width, height) => {
    // Validate dimensions with strict checks
    if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      console.error('[BackgroundStore] Invalid image dimensions:', { width, height });
      set((s) => ({ 
        bg: { 
          ...s.bg, 
          state: 'failed',
          error: 'Invalid image dimensions'
        } 
      }));
      return;
    }
    
    // Validate image element
    if (!image || !(image instanceof HTMLImageElement)) {
      console.error('[BackgroundStore] Invalid image element:', image);
      set((s) => ({ 
        bg: { 
          ...s.bg, 
          state: 'failed',
          error: 'Invalid image element'
        } 
      }));
      return;
    }
    
    const currentBg = get().bg;
    
    // Dev instrumentation: bg.state transitions
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TRACE] bg.state transition: ${currentBg.state} → waitingContainer at ${new Date().toISOString()}`, {
        caller: new Error().stack?.split('\n')[2]?.trim(),
        file: 'backgroundStore.ts:setImage',
        imgW: width,
        imgH: height,
        hasImage: !!image
      });
    }
    
    // Transition to waiting for container
    set({ 
      bg: { 
        url: null, 
        width, 
        height, 
        image, 
        state: 'waitingContainer',
        loadStartTime: Date.now(),
        error: undefined
      } 
    });
    console.log('[BackgroundStore] Image loaded, waiting for container:', { width, height, hasImage: !!image });
  },
  
  setState: (state, error) => {
    const currentBg = get().bg;
    
    // Prevent backsliding from ready to non-ready states unless explicitly requested
    if (currentBg.state === 'ready' && state !== 'ready' && state !== 'idle') {
      console.warn('[BackgroundStore] Preventing state backslide from ready to:', state);
      return;
    }
    
    // Dev instrumentation: bg.state transitions
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TRACE] bg.state transition: ${currentBg.state} → ${state} at ${new Date().toISOString()}`, {
        caller: new Error().stack?.split('\n')[2]?.trim(),
        file: 'backgroundStore.ts:setState',
        error,
        imgW: currentBg.width,
        imgH: currentBg.height,
        hasImage: !!currentBg.image
      });
    }
    
    set((s) => ({ 
      bg: { 
        ...s.bg, 
        state,
        error,
        loadStartTime: state === 'ready' ? undefined : s.bg.loadStartTime
      } 
    }));
    
    // Summary log when becoming ready
    if (state === 'ready' && process.env.NODE_ENV === 'development') {
      console.log(`[SUMMARY] BgState became ready at ${new Date().toISOString()}`, {
        imgW: currentBg.width,
        imgH: currentBg.height,
        hasImage: !!currentBg.image,
        loadTime: currentBg.loadStartTime ? Date.now() - currentBg.loadStartTime : 'unknown'
      });
    }
    
    console.log('[BackgroundStore] State transition:', state, error ? `(${error})` : '');
  },
  
  clear: () => {
    const currentBg = get().bg;
    if (currentBg.url) {
      URL.revokeObjectURL(currentBg.url);
    }
    
    // Dev instrumentation: bg.state transitions
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TRACE] bg.state transition: ${currentBg.state} → idle at ${new Date().toISOString()}`, {
        caller: new Error().stack?.split('\n')[2]?.trim(),
        file: 'backgroundStore.ts:clear'
      });
    }
    
    set({ bg: { url: null, width: 0, height: 0, image: null, state: 'idle', error: undefined, loadStartTime: undefined } });
  },
  
  isReady: () => {
    const bg = get().bg;
    return bg.state === 'ready' && !!(bg.image && bg.width > 0 && bg.height > 0);
  },
  
  getState: () => {
    return get().bg.state;
  },
  
  forceFit: () => {
    const bg = get().bg;
    if (bg.state === 'waitingContainer' && bg.width > 0 && bg.height > 0) {
      // Dev instrumentation: bg.state transitions
      if (process.env.NODE_ENV === 'development') {
        console.log(`[TRACE] bg.state transition: ${bg.state} → ready at ${new Date().toISOString()}`, {
          caller: new Error().stack?.split('\n')[2]?.trim(),
          file: 'backgroundStore.ts:forceFit',
          imgW: bg.width,
          imgH: bg.height
        });
      }
      
      // Force ready state if we have valid dimensions
      set((s) => ({ 
        bg: { 
          ...s.bg, 
          state: 'ready',
          error: undefined,
          loadStartTime: undefined
        } 
      }));
      console.log('[BackgroundStore] Force fit applied');
    }
  },
  
  retryUpload: () => {
    const currentBg = get().bg;
    
    // Dev instrumentation: bg.state transitions
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TRACE] bg.state transition: ${currentBg.state} → idle at ${new Date().toISOString()}`, {
        caller: new Error().stack?.split('\n')[2]?.trim(),
        file: 'backgroundStore.ts:retryUpload'
      });
    }
    
    set((s) => ({ 
      bg: { 
        ...s.bg, 
        state: 'idle',
        error: undefined,
        loadStartTime: undefined
      } 
    }));
    console.log('[BackgroundStore] Retry upload - reset to idle');
  }
}));
