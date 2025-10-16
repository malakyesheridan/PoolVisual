import { SmartBlendInput } from './types';

let worker: Worker | null = null;

function getWorker() {
  if (!worker) worker = new Worker(new URL('./smartBlendWorker.ts', import.meta.url), 
  { type: "module" });
  return worker;
}

export function runSmartBlend(input: SmartBlendInput): Promise<string> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2);
    const onMsg = (ev: MessageEvent) => {
      const m = ev.data;
      if (!m || m.id !== id) return;
      w.removeEventListener("message", onMsg as any);
      if (m.ok) resolve(m.dataURL);
      else reject(new Error(m.error || "SmartBlend failed"));
    };
    w.addEventListener("message", onMsg as any);
    w.postMessage({
      id,
      background: { dataURL: input.backgroundDataURL },
      material: { 
        albedoURL: input.materialAlbedoURL, 
        scale: input.scale ?? 1,
        physicalRepeatM: input.materialProperties?.physicalRepeatM
      },
      polygon: input.polygon,
      canvasSize: input.canvasSize,
      strength: input.strength ?? 0.7,
    });
  });
}

export function cleanupWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}
