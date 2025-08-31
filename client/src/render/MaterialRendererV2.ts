import * as PIXI from 'pixi.js';
import earcut from 'earcut';

export class MaterialRendererV2 {
  app: PIXI.Application;
  meshes = new Map<string, PIXI.Mesh>();
  container: HTMLElement;

  constructor(host: HTMLElement, w:number, h:number) {
    this.container = host;
    this.app = new PIXI.Application({
      width:w, height:h, backgroundAlpha:0, autoDensity:true,
      resolution: window.devicePixelRatio || 1, powerPreference:'high-performance'
    });
    host.appendChild(this.app.view as HTMLCanvasElement);
    (this.app.view as HTMLCanvasElement).style.transform = 'none';
    console.info('[V2] MaterialRenderer initialized', w, h);
  }

  setTransform(T:{S:number;originX:number;originY:number}) {
    this.app.stage.position.set(T.originX, T.originY);
    this.app.stage.scale.set(T.S, T.S);
    console.log('[V2] Transform applied:', T);
  }

  resize(w:number,h:number){ 
    this.app.renderer.resize(w,h); 
    console.log('[V2] Resized:', w, h);
  }

  upsertMesh(maskId:string, image:HTMLImageElement, vertsImg:Float32Array){
    try {
      const indices = new Uint16Array(earcut(Array.from(vertsImg)));
      const tex = PIXI.Texture.from(image);

      const uvs = new Float32Array(vertsImg.length); // Phase A: naive UV in image space
      for(let i=0;i<vertsImg.length;i+=2){ 
        uvs[i] = vertsImg[i]/image.width; 
        uvs[i+1] = vertsImg[i+1]/image.height; 
      }

      // Use PixiJS v8 compatible geometry
      const geo = new PIXI.MeshGeometry({
        positions: vertsImg,
        uvs: uvs,
        indices: indices
      });

      const mesh = new PIXI.Mesh(geo, tex);

      const old = this.meshes.get(maskId);
      if (old) { 
        this.app.stage.removeChild(old);
        old.destroy({children:true}); 
      }
      
      this.meshes.set(maskId, mesh);
      this.app.stage.addChild(mesh);
      
      console.info('[V2] Mesh created successfully:', maskId, image.width, image.height);
    } catch (error) {
      console.error('[V2] Failed to create mesh:', maskId, error);
    }
  }

  removeMesh(maskId:string){
    const m = this.meshes.get(maskId);
    if (m) { 
      this.app.stage.removeChild(m);
      m.destroy({children:true}); 
      this.meshes.delete(maskId); 
      console.info('[V2] Mesh removed:', maskId);
    }
  }
}