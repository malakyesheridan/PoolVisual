import { useEffect, useState, useCallback } from "react";
import { snapshotFromCanvas, readSelectionFromCanvas } from "../bridge/canvasBridge";
import { usePhotoStore } from "../state/photoStore";

export function useAutoSyncFromCanvas(isPhotoTabActive: boolean) {
  const st = usePhotoStore();
  const [syncing, setSyncing] = useState(false);

  const syncFromCanvas = useCallback(async () => {
    try {
      setSyncing(true);
      const dataUrl = await snapshotFromCanvas({ pixelRatio: window.devicePixelRatio || 2 });
      st.set("backgroundUrl", dataUrl);

      // Optional: initialize plane from current selection bbox
      const sel = readSelectionFromCanvas();
      if (sel) {
        // Map selection (px) to relative plane size; start with 1 unit == 1m for now
        const newW = Math.max(0.5, sel.w / 200); // heuristic: 200px ≈ 1m
        const newH = Math.max(0.5, sel.h / 200);
        st.patch({ plane: { ...st.plane, width: newW, height: newH } });
      }

      // Optional: auto match color/exposure
      try {
        const { averageImageRGB, computeTintFromAvg, exposureFromLuma } = await import("../utils/colorMatch");
        const avg = await averageImageRGB(dataUrl);
        const tint = computeTintFromAvg(avg);
        const exp = exposureFromLuma(avg);
        st.patch({ 
          material: { ...st.material, tint }, 
          lighting: { ...st.lighting, exposure: exp } 
        });
      } catch (e) {
        console.warn("[Photo] Auto color matching failed:", e);
      }
    } catch (e) {
      console.warn("[Photo] Auto-sync failed:", e);
    } finally {
      setSyncing(false);
    }
  }, [st]);

  useEffect(() => {
    let ignore = false;
    
    if (isPhotoTabActive) {
      // Debounce the sync to avoid rapid tab switching issues
      const timer = setTimeout(() => {
        if (!ignore) {
          syncFromCanvas();
        }
      }, 150);
      
      return () => {
        ignore = true;
        clearTimeout(timer);
      };
    }
  }, [isPhotoTabActive, syncFromCanvas]);

  return { syncing, syncFromCanvas };
}
