import React, {createContext, useContext, useReducer, useMemo} from 'react';
import { Doc, DocSnapshot, PhotoSpace } from './model';

function finite(n: number, fallback: number){ return Number.isFinite(n) ? n : fallback; }

// Loop prevention helpers
function almost(a: number, b: number, eps = 0.001) { return Math.abs(a - b) < eps; }
function sameView(v: PhotoSpace, f: {scale: number; panX: number; panY: number}) {
  return almost(v.scale, f.scale) && almost(v.panX, f.panX) && almost(v.panY, f.panY);
}

// Dev-only counter for debugging
let fitCounter = 0;

export type Action =
  | {type:'bg/load-start', file: File}
  | {type:'bg/load-success', url:string, w:number, h:number}
  | {type:'bg/load-fail', message:string}
  | {type:'view/fit', containerW:number, containerH:number}
  | {type:'view/zoom', cx:number, cy:number, delta:number}
  | {type:'view/pan', dx:number, dy:number}
  | {type:'mode/set', mode: Doc['mode']}
  | {type:'mask/start-area', at:[number,number]}
  | {type:'mask/add-point', at:[number,number]}
  | {type:'mask/commit'}
  | {type:'mask/cancel'}
  | {type:'select', id?:string}
  | {type:'material/apply', id:string} // to selected mask
  | {type:'blend/result', maskId:string, url:string} // worker callback (optional)
  | {type:'undo'} | {type:'redo'};

function fitToScreen(containerW:number, containerH:number, imgW:number, imgH:number){
  if (!(containerW>0 && containerH>0 && imgW>0 && imgH>0)) {
    return {scale:1, panX:0, panY:0};
  }
  // Always start at 100% zoom for calibration compatibility
  const scale = 1.0;
  const panX = (containerW - imgW*scale)/2;
  const panY = (containerH - imgH*scale)/2;
  return { scale, panX, panY };
}

function snapshot(doc: Doc): DocSnapshot {
  const {history, status, error, ...rest} = doc;
  return JSON.parse(JSON.stringify(rest));
}

const initial: Doc = {
  status:'idle',
  bg:{},
  view:{scale:1, panX:0, panY:0, imgW:0, imgH:0, dpr:1},
  masks:{},
  mode:'select',
  history:{past:[], future:[]},
  materials:{
    'mat_1': {id:'mat_1', name:'Wood Planks', url:'/materials/wood-planks.jpg', scaleM:0.2},
    'mat_2': {id:'mat_2', name:'Stone Tile', url:'/materials/stone-tile.jpg', scaleM:0.3},
    'mat_3': {id:'mat_3', name:'Concrete', url:'/materials/concrete.jpg', scaleM:0.4}
  }
};

function reducer(doc: Doc, a: Action): Doc {
  // guard to avoid NaN loops:
  if (!Number.isFinite(doc.view.scale)) doc.view.scale = 1;
  switch(a.type){
    case 'bg/load-start':
      return {...doc, status:'loading', error:undefined};
    case 'bg/load-success': {
      const view = {...doc.view, imgW:a.w, imgH:a.h};
      return {...doc, status:'ready', bg:{url:a.url, w:a.w, h:a.h}, view};
    }
    case 'bg/load-fail':
      return {...doc, status:'error', error:a.message};
    case 'view/fit': {
      fitCounter++;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Editor v2] view/fit called ${fitCounter} times`);
      }
      const f = fitToScreen(a.containerW, a.containerH, doc.view.imgW, doc.view.imgH);
      if (!Number.isFinite(f.scale)) return doc;
      if (sameView(doc.view, f)) return doc;                    // 🔒 guard
      return {...doc, view:{...doc.view, ...f}};
    }
    case 'view/zoom': {
      const {scale, panX, panY, imgW, imgH} = doc.view;
      const nextScale = finite(scale * (a.delta>0 ? 0.9 : 1.1), scale);
      if (almost(nextScale, scale)) return doc;                 // 🔒 guard
      // cursor-centric zoom: convert screen->image anchor and preserve
      const ix = (a.cx - panX) / scale;
      const iy = (a.cy - panY) / scale;
      const nx = ix * nextScale + panX;
      const ny = iy * nextScale + panY;
      const nextPanX = finite(a.cx - ix*nextScale, panX);
      const nextPanY = finite(a.cy - iy*nextScale, panY);
      const f = {scale:nextScale, panX:nextPanX, panY:nextPanY};
      if (sameView(doc.view, f)) return doc;                    // 🔒 guard
      return {...doc, view:{...doc.view, ...f}};
    }
    case 'view/pan': {
      const f = {panX: doc.view.panX + a.dx, panY: doc.view.panY + a.dy, scale: doc.view.scale};
      if (sameView(doc.view, f)) return doc;                    // 🔒 guard
      return {...doc, view:{...doc.view, panX:f.panX, panY:f.panY}};
    }
    case 'mode/set':
      return {...doc, mode:a.mode};
    case 'mask/start-area': {
      const id = 'm_' + crypto.randomUUID();
      return {
        ...doc,
        selectedId:id,
        masks:{...doc.masks, [id]: {id, type:'area', points:[a.at[0], a.at[1]]}}
      };
    }
    case 'mask/add-point': {
      const id = doc.selectedId; if(!id) return doc;
      const m = doc.masks[id]; if(!m) return doc;
      return {...doc, masks:{...doc.masks, [id]: {...m, points:[...m.points, a.at[0], a.at[1]]}}};
    }
    case 'mask/commit': {
      const id = doc.selectedId; if(!id) return doc;
      const m = doc.masks[id]; if(!m || m.points.length < 6) return doc;
      return {...doc, mode:'select', history:{ past:[...doc.history.past, snapshot(doc)], future:[] }};
    }
    case 'mask/cancel': {
      const id = doc.selectedId;
      const { [id||'']:_, ...rest } = doc.masks;
      return {...doc, selectedId:undefined, masks:rest, mode:'select'};
    }
    case 'select':
      return {...doc, selectedId:a.id};
    case 'material/apply': {
      const id = doc.selectedId; if(!id) return doc;
      const m = doc.masks[id]; if(!m) return doc;
      
      // Trigger auto-blend worker
      if (typeof Worker !== 'undefined') {
        const worker = new Worker(new URL('./blendWorker.ts', import.meta.url));
        worker.postMessage({
          maskId: id,
          bgUrl: doc.bg.url,
          maskPoints: m.points,
          materialId: a.id
        });
        worker.onmessage = (e) => {
          if (e.data.type === 'blend/result') {
            // Handle blend result
            console.log('Blend completed for mask:', e.data.maskId);
          }
        };
      }
      
      return {...doc,
        masks:{...doc.masks, [id]: {...m, materialId:a.id}},
        history:{ past:[...doc.history.past, snapshot(doc)], future:[] }
      };
    }
    case 'blend/result': {
      // Optional: store composite URL per-mask or on bg layer
      return doc;
    }
    case 'undo': {
      const past = doc.history.past; if (!past.length) return doc;
      const prev = past[past.length-1];
      const future = [snapshot(doc), ...doc.history.future];
      return {...doc, ...prev, status:'ready', history:{past: past.slice(0,-1), future}};
    }
    case 'redo': {
      const fut = doc.history.future; if (!fut.length) return doc;
      const next = fut[0];
      const past = [...doc.history.past, snapshot(doc)];
      return {...doc, ...next, status:'ready', history:{past, future: fut.slice(1)}};
    }
    default:
      return doc;
  }
}

const Ctx = createContext<{doc:Doc, dispatch:React.Dispatch<Action>} | null>(null);

export function EditorProvider({children}:{children:React.ReactNode}){
  const [doc, dispatch] = useReducer(reducer, initial);
  const value = useMemo(()=>({doc, dispatch}), [doc]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useEditor = ()=> {
  const ctx = useContext(Ctx); if(!ctx) throw new Error('useEditor outside provider');
  return ctx;
};
