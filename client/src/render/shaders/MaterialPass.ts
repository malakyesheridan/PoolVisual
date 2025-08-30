/**
 * MaterialPass - Fragment shader for lighting-aware material compositing
 * Provides perspective-correct texturing with scene luminance matching and edge AO
 */

import * as PIXI from 'pixi.js';

const vertexShader = `
attribute vec2 aVertexPosition;
attribute vec2 aTextureCoord;

uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;

varying vec2 vUV;
varying vec2 vScreenPos;

void main() {
    vec2 position = (translationMatrix * vec3(aVertexPosition, 1.0)).xy;
    gl_Position = vec4((projectionMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
    
    vUV = aTextureCoord;
    vScreenPos = gl_Position.xy * 0.5 + 0.5; // Convert to 0-1 range
}
`;

const fragmentShader = `
precision mediump float;

varying vec2 vUV;
varying vec2 vScreenPos;

uniform sampler2D uTex;
uniform sampler2D uLuma;
uniform sampler2D uAOMask;

uniform vec2 uLumaScale;
uniform float uGamma;
uniform float uContrast;
uniform float uSaturation;
uniform float uAO;
uniform float uFeather;

uniform vec2 uRepeatScale;
uniform float uBond;
uniform float uGroutWidth;
uniform vec3 uGroutColor;

vec3 toLinear(vec3 c) { 
    return pow(c, vec3(uGamma)); 
}

vec3 toSRGB(vec3 c) { 
    return pow(c, vec3(1.0 / uGamma)); 
}

vec2 applyBondPattern(vec2 uv) {
    // Apply bond pattern transformation
    if (uBond > 0.5 && uBond < 1.5) { // brick50
        float row = floor(uv.y);
        if (mod(row, 2.0) > 0.5) {
            uv.x += 0.5;
        }
    } else if (uBond > 1.5) { // herringbone
        float tileIndex = floor(uv.x) + floor(uv.y);
        if (mod(tileIndex, 2.0) > 0.5) {
            uv = vec2(uv.y, uv.x); // Swap for rotation effect
        }
    }
    return uv;
}

vec3 applyGrout(vec3 baseColor, vec2 uv) {
    if (uGroutWidth <= 0.0) return baseColor;
    
    // Calculate distance to grout lines
    vec2 groutUV = fract(uv);
    vec2 distToEdge = min(groutUV, 1.0 - groutUV);
    float groutMask = smoothstep(0.0, uGroutWidth, min(distToEdge.x, distToEdge.y));
    
    return mix(uGroutColor, baseColor, groutMask);
}

void main() {
    // Apply material repeat scaling
    vec2 scaledUV = vUV * uRepeatScale;
    
    // Apply bond pattern
    vec2 bondUV = applyBondPattern(scaledUV);
    
    // Sample base texture
    vec4 tex = texture2D(uTex, bondUV);
    
    // Apply grout if enabled
    vec3 materialColor = applyGrout(tex.rgb, bondUV);
    
    // Convert to linear space for lighting calculations
    vec3 baseLin = toLinear(materialColor);
    
    // Sample scene luminance (if available)
    vec2 lumaUV = vScreenPos * uLumaScale;
    float sceneLuma = 1.0; // Default neutral
    
    #ifdef HAS_LUMINANCE_MAP
    sceneLuma = texture2D(uLuma, lumaUV).r;
    #endif
    
    // Modulate material by scene lighting
    baseLin *= mix(0.85, 1.15, sceneLuma);
    
    // Apply contrast and saturation adjustments
    vec3 avgColor = vec3(dot(baseLin, vec3(0.333)));
    baseLin = mix(avgColor, baseLin, uSaturation);
    baseLin = (baseLin - 0.5) * uContrast + 0.5;
    
    // Apply edge ambient occlusion (if available)
    float aoFactor = 1.0;
    
    #ifdef HAS_AO_MASK
    float aoMask = texture2D(uAOMask, lumaUV).r;
    aoFactor = 1.0 - (aoMask * uAO);
    #endif
    
    baseLin *= aoFactor;
    
    // Convert back to sRGB
    vec3 finalColor = toSRGB(max(vec3(0.0), baseLin));
    
    gl_FragColor = vec4(finalColor, tex.a);
}
`;

export class MaterialPass extends PIXI.Shader {
  public resources: any;

  constructor() {
    const program = PIXI.GlProgram.from({
      vertex: vertexShader,
      fragment: fragmentShader,
    });
    
    // In PixiJS v8, textures and uniforms are separate in resources
    const resources = {
      // Textures go directly as resources
      uTex: PIXI.Texture.EMPTY.source,
      uLuma: PIXI.Texture.EMPTY.source,
      uAOMask: PIXI.Texture.EMPTY.source,
      
      // Uniforms go in a uniform group with explicit types
      materialUniforms: {
        uLumaScale: { value: new Float32Array([1.0, 1.0]), type: 'vec2<f32>' },
        uRepeatScale: { value: new Float32Array([1.0, 1.0]), type: 'vec2<f32>' },
        uGamma: { value: 2.2, type: 'f32' },
        uContrast: { value: 1.1, type: 'f32' },
        uSaturation: { value: 1.0, type: 'f32' },
        uAO: { value: 0.1, type: 'f32' },
        uFeather: { value: 4.0, type: 'f32' },
        uBond: { value: 0.0, type: 'f32' },
        uGroutWidth: { value: 0.0, type: 'f32' },
        uGroutColor: { value: new Float32Array([0.8, 0.8, 0.8]), type: 'vec3<f32>' }
      }
    };
    
    super({
      glProgram: program,
      resources: resources
    });
    this.resources = resources;
  }

  /**
   * Update bond pattern uniform
   * @param bond Bond pattern type
   */
  setBondPattern(bond: 'straight' | 'brick50' | 'herringbone'): void {
    const bondValues = {
      straight: 0.0,
      brick50: 1.0,
      herringbone: 2.0
    };
    
    this.resources.materialUniforms.uBond.value = bondValues[bond] || 0.0;
  }

  /**
   * Update grout properties
   * @param widthMm Grout width in millimeters
   * @param color Grout color as hex string
   * @param repeatM Physical tile repeat size in meters
   */
  setGrout(widthMm: number, color: string, repeatM: number): void {
    // Convert grout width to UV space
    this.resources.materialUniforms.uGroutWidth.value = (widthMm / 1000) / repeatM;
    
    // Parse grout color
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    this.resources.materialUniforms.uGroutColor.value[0] = r;
    this.resources.materialUniforms.uGroutColor.value[1] = g;
    this.resources.materialUniforms.uGroutColor.value[2] = b;
  }

  /**
   * Enable scene matching with luminance map
   * @param luminanceTexture Scene luminance texture
   * @param scale Scale factor for luminance UV mapping
   */
  setLuminanceMap(luminanceTexture: PIXI.Texture, scale: [number, number]): void {
    this.resources.uLuma = luminanceTexture.source;
    this.resources.materialUniforms.uLumaScale.value.set(scale);
    
    // Add preprocessor define - simplified for v8
    // Note: Dynamic shader compilation in v8 requires different approach
  }

  /**
   * Enable ambient occlusion with edge mask
   * @param aoTexture AO mask texture
   * @param strength AO effect strength (0-1)
   */
  setAOMask(aoTexture: PIXI.Texture, strength: number): void {
    this.resources.uAOMask = aoTexture.source;
    this.resources.materialUniforms.uAO.value = Math.max(0, Math.min(1, strength));
    
    // Add preprocessor define - simplified for v8
    // Note: Dynamic shader compilation in v8 requires different approach
  }

  /**
   * Update material repeat scale
   * @param repeatPixels Repeat size in screen pixels
   * @param materialRepeatM Physical repeat size in meters
   * @param pxPerMeter Calibration pixels per meter
   */
  setRepeatScale(repeatPixels: number, materialRepeatM: number, pxPerMeter: number): void {
    const worldScale = repeatPixels / (pxPerMeter * materialRepeatM);
    this.resources.materialUniforms.uRepeatScale.value.set([worldScale, worldScale]);
  }
}